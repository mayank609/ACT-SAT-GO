import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function isAnswerCorrect(given: unknown, correct: unknown): boolean {
  if (!given || !correct) return false
  const g = given as { key?: string; keys?: string[]; value?: number }
  const c = correct as { key?: string; keys?: string[]; value?: number }
  if (c.value !== undefined) return g.value === c.value
  if (c.keys) {
    const gKeys = (g.keys ?? []).map((k) => k.toUpperCase()).sort()
    const cKeys = c.keys.map((k) => k.toUpperCase()).sort()
    return JSON.stringify(gKeys) === JSON.stringify(cKeys)
  }
  if (c.key) return g.key?.toUpperCase() === c.key.toUpperCase()
  return false
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params

  try {
    const attempts = await prisma.testAttempt.findMany({
      where: { studentId, status: 'SUBMITTED' },
      include: {
        test: { select: { id: true, title: true } },
        sectionAttempts: {
          include: {
            section: { select: { id: true, name: true, durationMinutes: true } },
          },
        },
        answers: {
          include: {
            question: {
              include: {
                testQuestions: true,
              },
            },
          },
        },
      },
      orderBy: { completedAt: 'asc' },
    })

    const trend = attempts.map((a) => ({
      date: a.completedAt?.toISOString().split('T')[0] ?? a.startedAt.toISOString().split('T')[0],
      score: a.totalScore ?? 0,
      testTitle: a.test.title,
      attemptId: a.id,
    }))

    // Compute section stats for the most recent attempt
    let sectionStats: {
      sectionId: string
      sectionName: string
      totalQuestions: number
      correct: number
      incorrect: number
      skipped: number
      accuracy: number
      timeAllocated: number
      timeUsed: number
    }[] = []

    if (attempts.length > 0) {
      const latest = attempts[attempts.length - 1]
      for (const sa of latest.sectionAttempts) {
        const sectionAnswers = latest.answers.filter((ans) => {
          const tq = ans.question.testQuestions.find((t) => t.testId === latest.testId)
          return tq?.sectionId === sa.sectionId
        })
        let correct = 0, incorrect = 0, skipped = 0
        for (const ans of sectionAnswers) {
          if (ans.answerGiven === null) { skipped++; continue }
          if (isAnswerCorrect(ans.answerGiven, ans.question.correctAnswer)) correct++
          else incorrect++
        }
        const totalQuestions = sectionAnswers.length
        sectionStats.push({
          sectionId: sa.sectionId,
          sectionName: sa.section.name,
          totalQuestions,
          correct,
          incorrect,
          skipped,
          accuracy: totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0,
          timeAllocated: sa.section.durationMinutes * 60,
          timeUsed: sectionAnswers.reduce((a, ans) => a + ans.timeSpentSeconds, 0),
        })
      }
    }

    const overallAccuracy = sectionStats.length > 0
      ? Math.round(sectionStats.reduce((a, s) => a + s.accuracy, 0) / sectionStats.length)
      : 0

    const totalScore = attempts.length > 0 ? (attempts[attempts.length - 1].totalScore ?? 0) : 0
    const avgScore = attempts.length > 0
      ? Math.round(attempts.reduce((a, at) => a + (at.totalScore ?? 0), 0) / attempts.length * 10) / 10
      : 0

    return NextResponse.json({
      trend,
      sectionStats,
      overallAccuracy,
      totalAttempts: attempts.length,
      latestScore: totalScore,
      avgScore,
    })
  } catch (error) {
    console.error('GET /api/analytics/student/[studentId]:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
