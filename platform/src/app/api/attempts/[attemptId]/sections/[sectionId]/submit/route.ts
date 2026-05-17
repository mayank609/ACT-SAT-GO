import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ attemptId: string; sectionId: string }> }
) {
  const { attemptId, sectionId } = await params

  try {
    // 1. Flush Redis answers → PostgreSQL
    const cachedAnswers = (await redis.hgetall(`answers:${attemptId}`)) as Record<string, string> | null

    if (cachedAnswers) {
      const upserts = Object.entries(cachedAnswers).map(([questionId, dataStr]) => {
        const data = JSON.parse(dataStr)
        return prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId } },
          update: {
            answerGiven: data.answerGiven,
            timeSpentSeconds: data.timeSpentSeconds,
            isFlagged: data.isFlagged,
          },
          create: {
            attemptId,
            questionId,
            answerGiven: data.answerGiven,
            timeSpentSeconds: data.timeSpentSeconds,
            isFlagged: data.isFlagged,
          },
        })
      })
      await Promise.all(upserts)
      await redis.del(`answers:${attemptId}`)
    }

    // 2. Mark section complete
    await prisma.sectionAttempt.update({
      where: { attemptId_sectionId: { attemptId, sectionId } },
      data: { completedAt: new Date() },
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
              include: { testQuestions: { where: { testId: attempt.testId } } },
            },
          },
        })

        let totalScore = 0
        for (const answer of answers) {
          if (answer.answerGiven === null) continue
          const correct =
            JSON.stringify(answer.answerGiven) === JSON.stringify(answer.question.correctAnswer)
          const tq = answer.question.testQuestions[0]
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
