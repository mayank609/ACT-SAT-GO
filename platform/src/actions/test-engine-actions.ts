'use server'

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { revalidatePath } from 'next/cache'

const REDIS_TTL = 60 * 60 * 4 // 4 hours safety window

export async function startSectionAttempt(attemptId: string, sectionId: string) {
  try {
    const section = await prisma.testSection.findUnique({ where: { id: sectionId } })
    if (!section) throw new Error('Section not found')

    const sectionAttempt = await prisma.sectionAttempt.upsert({
      where: { attemptId_sectionId: { attemptId, sectionId } },
      update: { startedAt: new Date(), completedAt: null },
      create: { attemptId, sectionId, startedAt: new Date() },
    })

    const endTime = Date.now() + section.durationMinutes * 60 * 1000
    await redis.set(`timer:${attemptId}:${sectionId}`, endTime, { ex: REDIS_TTL })

    return { success: true, sectionAttempt, endTime }
  } catch (error) {
    console.error('Error starting section:', error)
    return { success: false, error: 'Failed to start section' }
  }
}

export async function autosaveAnswer(data: {
  attemptId: string
  questionId: string
  answerGiven: unknown
  timeSpentSeconds: number
  isFlagged: boolean
}) {
  try {
    await redis.hset(`answers:${data.attemptId}`, {
      [data.questionId]: JSON.stringify({
        answerGiven: data.answerGiven,
        timeSpentSeconds: data.timeSpentSeconds,
        isFlagged: data.isFlagged,
        updatedAt: Date.now(),
      }),
    })
    return { success: true }
  } catch (error) {
    console.error('Error in autosave:', error)
    return { success: false }
  }
}

export async function submitSectionAttempt(attemptId: string, sectionId: string) {
  try {
    // 1. Flush Redis answers → PostgreSQL
    const cachedAnswers = (await redis.hgetall(`answers:${attemptId}`)) as Record<string, string> | null

    if (cachedAnswers) {
      const upserts = Object.entries(cachedAnswers).map(([questionId, dataStr]) => {
        const data = JSON.parse(dataStr)
        return prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId } },
          update: { answerGiven: data.answerGiven, timeSpentSeconds: data.timeSpentSeconds, isFlagged: data.isFlagged },
          create: { attemptId, questionId, answerGiven: data.answerGiven, timeSpentSeconds: data.timeSpentSeconds, isFlagged: data.isFlagged },
        })
      })
      await Promise.all(upserts)
    }

    // 2. Mark section complete
    await prisma.sectionAttempt.update({
      where: { attemptId_sectionId: { attemptId, sectionId } },
      data: { completedAt: new Date() },
    })

    // 3. Cleanup Redis timer
    await redis.del(`timer:${attemptId}:${sectionId}`)

    // 4. Check if ALL sections are now complete → calculate total score
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: { sectionAttempts: true },
    })

    if (attempt) {
      const allSections = await prisma.testSection.findMany({ where: { testId: attempt.testId } })
      const completedCount = attempt.sectionAttempts.filter((sa) => sa.completedAt !== null).length

      if (completedCount >= allSections.length) {
        // All sections done — score every answer
        const answers = await prisma.attemptAnswer.findMany({
          where: { attemptId },
          include: {
            question: {
              include: {
                testQuestions: { where: { testId: attempt.testId } },
              },
            },
          },
        })

        let totalScore = 0
        for (const answer of answers) {
          if (answer.answerGiven === null) continue
          const correct = JSON.stringify(answer.answerGiven) === JSON.stringify(answer.question.correctAnswer)
          if (correct) {
            const tq = answer.question.testQuestions[0]
            totalScore += tq?.marksPositive ?? 1
          } else {
            const tq = answer.question.testQuestions[0]
            totalScore = Math.max(0, totalScore - (tq?.marksNegative ?? 0))
          }
        }

        await prisma.testAttempt.update({
          where: { id: attemptId },
          data: { status: 'SUBMITTED', totalScore, completedAt: new Date() },
        })
      }
    }

    revalidatePath(`/test-engine/${attemptId}`)
    return { success: true }
  } catch (error) {
    console.error('Error submitting section:', error)
    return { success: false, error: 'Submission failed' }
  }
}

export async function logCheatingEvent(
  attemptId: string,
  eventType: 'tab_switch' | 'fullscreen_exit',
  metadata?: Record<string, string | number>
) {
  try {
    await prisma.cheatingLog.create({
      data: { attemptId, eventType, metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined },
    })
    return { success: true }
  } catch (error) {
    console.error('Error logging cheating:', error)
    return { success: false }
  }
}
