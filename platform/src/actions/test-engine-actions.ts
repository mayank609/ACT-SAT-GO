'use server'

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { revalidatePath } from 'next/cache'

const REDIS_TTL = 60 * 60 * 4 // 4 hours safety window

/**
 * Starts a test section and establishes a server-authoritative timer in Redis.
 */
export async function startSectionAttempt(attemptId: string, sectionId: string) {
  try {
    const section = await prisma.testSection.findUnique({
      where: { id: sectionId }
    })

    if (!section) throw new Error('Section not found')

    // Create or update section attempt in Postgres
    const sectionAttempt = await prisma.sectionAttempt.upsert({
      where: {
        attemptId_sectionId: { attemptId, sectionId }
      },
      update: { startedAt: new Date(), completedAt: null },
      create: { attemptId, sectionId, startedAt: new Date() }
    })

    // Store server-authoritative end time in Redis
    const endTime = Date.now() + section.durationMinutes * 60 * 1000
    await redis.set(`timer:${attemptId}:${sectionId}`, endTime, { ex: REDIS_TTL })

    return { success: true, sectionAttempt, endTime }
  } catch (error) {
    console.error('Error starting section:', error)
    return { success: false, error: 'Failed to start section' }
  }
}

/**
 * High-performance autosave using Redis Hash. 
 * This avoids hitting the PostgreSQL database too frequently during the test.
 */
export async function autosaveAnswer(data: {
  attemptId: string
  questionId: string
  answerGiven: any
  timeSpentSeconds: number
  isFlagged: boolean
}) {
  try {
    const key = `answers:${data.attemptId}`
    const field = data.questionId
    
    await redis.hset(key, {
      [field]: JSON.stringify({
        answerGiven: data.answerGiven,
        timeSpentSeconds: data.timeSpentSeconds,
        isFlagged: data.isFlagged,
        updatedAt: Date.now()
      })
    })

    return { success: true }
  } catch (error) {
    console.error('Error in autosave:', error)
    return { success: false }
  }
}

/**
 * Finalizes a section by flushing all Redis answers to PostgreSQL and calculating the score.
 */
export async function submitSectionAttempt(attemptId: string, sectionId: string) {
  try {
    // 1. Fetch answers from Redis
    const key = `answers:${attemptId}`
    const cachedAnswers = await redis.hgetall(key) as Record<string, string>

    if (!cachedAnswers) {
      console.log('No answers found in cache for this attempt.')
    }

    // 2. Bulk upsert answers to PostgreSQL
    const upsertPromises = Object.entries(cachedAnswers || {}).map(([questionId, dataStr]) => {
      const data = JSON.parse(dataStr)
      return prisma.attemptAnswer.upsert({
        where: {
          attemptId_questionId: { attemptId, questionId }
        },
        update: {
          answerGiven: data.answerGiven,
          timeSpentSeconds: data.timeSpentSeconds,
          isFlagged: data.isFlagged
        },
        create: {
          attemptId,
          questionId,
          answerGiven: data.answerGiven,
          timeSpentSeconds: data.timeSpentSeconds,
          isFlagged: data.isFlagged
        }
      })
    })

    await Promise.all(upsertPromises)

    // 3. Mark section as completed
    await prisma.sectionAttempt.update({
      where: { attemptId_sectionId: { attemptId, sectionId } },
      data: { completedAt: new Date() }
    })

    // 4. Cleanup Redis
    await redis.del(`timer:${attemptId}:${sectionId}`)
    // Note: We don't delete answers yet in case they are needed for the next section's UI

    revalidatePath(`/test-engine/${attemptId}`)
    return { success: true }
  } catch (error) {
    console.error('Error submitting section:', error)
    return { success: false, error: 'Submission failed' }
  }
}

/**
 * Logs anti-cheating events (tab switching, etc.)
 */
export async function logCheatingEvent(attemptId: string, eventType: 'tab_switch' | 'fullscreen_exit') {
  try {
    await prisma.cheatingLog.create({
      data: {
        attemptId,
        eventType,
      }
    })
    return { success: true }
  } catch (error) {
    console.error('Error logging cheating:', error)
    return { success: false }
  }
}
