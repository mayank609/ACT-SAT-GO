import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

type AnswerJson = { key?: string; keys?: string[]; value?: number } | null

function isAnswerCorrect(given: unknown, correct: unknown): boolean {
  if (!given || !correct) return false;
  const g = given as AnswerJson;
  const c = correct as AnswerJson;
  if (!g || !c) return false;
  
  // Numeric
  if (c.value !== undefined) {
    if (g.value === undefined) return false;
    return Number(g.value) === Number(c.value) || String(g.value).trim() === String(c.value).trim();
  }
  
  // MSQ — order-independent, case-insensitive
  if (Array.isArray(c.keys)) {
    if (!Array.isArray(g.keys)) return false;
    const gKeys = g.keys.map((k) => String(k).toUpperCase().trim()).sort();
    const cKeys = c.keys.map((k) => String(k).toUpperCase().trim()).sort();
    return JSON.stringify(gKeys) === JSON.stringify(cKeys);
  }
  
  // MCQ — case-insensitive
  if (c.key !== undefined) {
    if (g.key === undefined) return false;
    return String(g.key).toUpperCase().trim() === String(c.key).toUpperCase().trim();
  }
  
  return false;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ attemptId: string; sectionId: string }> }
) {
  const { attemptId, sectionId } = await params

  try {
    // 1. Flush Redis answers → PostgreSQL
    // Upstash auto-deserializes JSON, so values may arrive as objects instead of strings
    const cachedAnswers = (await redis.hgetall(`answers:${attemptId}`)) as Record<string, unknown> | null

    if (cachedAnswers) {
      const upserts = Object.entries(cachedAnswers).map(([questionId, raw]) => {
        const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as {
          answerGiven: Prisma.InputJsonValue | null; timeSpentSeconds: number; isFlagged: boolean
        }
        return prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId } },
          update: {
            answerGiven: data.answerGiven ?? Prisma.DbNull,
            timeSpentSeconds: data.timeSpentSeconds,
            isFlagged: data.isFlagged,
          },
          create: {
            attemptId,
            questionId,
            answerGiven: data.answerGiven ?? Prisma.DbNull,
            timeSpentSeconds: data.timeSpentSeconds,
            isFlagged: data.isFlagged,
          },
        })
      })
      await Promise.all(upserts)
      await redis.del(`answers:${attemptId}`)
    }

    // 2. Mark section complete — upsert in case startSection was never called
    await prisma.sectionAttempt.upsert({
      where: { attemptId_sectionId: { attemptId, sectionId } },
      update: { completedAt: new Date() },
      create: { attemptId, sectionId, startedAt: new Date(), completedAt: new Date() },
    })

    // 3. Clean up Redis timer
    await redis.del(`timer:${attemptId}:${sectionId}`)

    // 4. Check if all sections done → calculate and save total score
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: { sectionAttempts: true },
    })

    if (attempt) {
      const allSections = await prisma.testSection.findMany({ where: { testId: attempt.testId } })
      const completedCount = attempt.sectionAttempts.filter((sa) => sa.completedAt !== null).length

      if (completedCount >= allSections.length) {
        const answers = await prisma.attemptAnswer.findMany({
          where: { attemptId },
          include: {
            question: {
              include: { 
                testQuestions: { where: { testId: attempt.testId } },
                parentQuestion: {
                  include: { testQuestions: { where: { testId: attempt.testId } } }
                }
              },
            },
          },
        })

        let totalScore = 0
        for (const answer of answers) {
          if (answer.answerGiven === null) continue
          const correct = isAnswerCorrect(answer.answerGiven, answer.question.correctAnswer)
          
          let tq = answer.question.testQuestions[0]
          if (!tq && answer.question.parentQuestion?.testQuestions?.length) {
            tq = answer.question.parentQuestion.testQuestions[0]
          }

          if (correct) {
            totalScore += tq?.marksPositive ?? 1
          } else {
            totalScore = Math.max(0, totalScore - (tq?.marksNegative ?? 0))
          }
        }

        await prisma.testAttempt.update({
          where: { id: attemptId },
          data: { status: 'SUBMITTED', totalScore, completedAt: new Date() },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST submit section:', error)
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 })
  }
}
