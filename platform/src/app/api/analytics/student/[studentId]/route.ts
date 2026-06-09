import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function isAnswerCorrect(given: unknown, correct: unknown): boolean {
  if (!given || !correct) return false;
  const g = given as { key?: string; keys?: string[]; value?: number };
  const c = correct as { key?: string; keys?: string[]; value?: number };
  
  // Numeric
  if (c.value !== undefined) {
    if (g.value === undefined) return false;
    return Number(g.value) === Number(c.value) || String(g.value).trim() === String(c.value).trim();
  }
  
  // MSQ
  if (Array.isArray(c.keys)) {
    if (!Array.isArray(g.keys)) return false;
    const gKeys = g.keys.map((k) => String(k).toUpperCase().trim()).sort();
    const cKeys = c.keys.map((k) => String(k).toUpperCase().trim()).sort();
    return JSON.stringify(gKeys) === JSON.stringify(cKeys);
  }
  
  // MCQ
  if (c.key !== undefined) {
    if (g.key === undefined) return false;
    return String(g.key).toUpperCase().trim() === String(c.key).toUpperCase().trim();
  }
  
  return false;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params
  const { searchParams } = new URL(_request.url)
  const attemptId = searchParams.get('attemptId')

  try {
    const attempts = await prisma.testAttempt.findMany({
      where: { studentId, status: 'SUBMITTED' },
      include: {
        test: {
          include: {
            sections: {
              orderBy: { orderIndex: 'asc' },
              include: {
                questions: {
                  orderBy: { orderIndex: 'asc' },
                  include: {
                    question: {
                      include: {
                        childQuestions: {
                          orderBy: { createdAt: 'asc' },
                          include: { topic: { select: { name: true } } },
                        },
                        topic: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        sectionAttempts: {
          include: {
            section: { select: { id: true, name: true, durationMinutes: true } },
          },
        },
        answers: true,
      },
      orderBy: { completedAt: 'asc' },
    })

    const trend = attempts.map((a) => ({
      date: a.completedAt?.toISOString().split('T')[0] ?? a.startedAt.toISOString().split('T')[0],
      score: a.totalScore ?? 0,
      testTitle: a.test.title,
      attemptId: a.id,
    }))

    // Compute section stats for the selected attempt
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

    let questionPacingStats: {
      questionIndex: number
      sectionName: string
      timeSpentSeconds: number
      status: 'correct' | 'incorrect' | 'skipped'
      difficulty: string
      topicName: string
    }[] = []

    let latest = attempts[attempts.length - 1]
    if (attemptId && attempts.length > 0) {
      const found = attempts.find((a) => a.id === attemptId)
      if (found) {
        latest = found
      }
    }

    if (latest) {
      const answerMap = new Map(latest.answers.map((ans) => [ans.questionId, ans]))
      console.log(`\n[Analytics] ======== PROCESSING ATTEMPT ${latest.id} ========`)
      console.log(`[Analytics] Attempt has ${latest.answers.length} answers`)
      
      const timeBreakdown = latest.answers.map(a => `Q${a.questionId.substring(0,8)}=${a.timeSpentSeconds}s`).join(', ')
      console.log(`[Analytics] Time breakdown: ${timeBreakdown}`)

      for (const section of latest.test.sections) {
        let correct = 0, incorrect = 0, skipped = 0
        let timeUsed = 0
        let questionIndex = 1

        // Debug: Log section structure
        console.log(`[Analytics] Section "${section.name}" has ${section.questions?.length ?? 0} questions`)

        // Handle case where questions might be empty (fallback to answer map)
        if (!section.questions || section.questions.length === 0) {
          console.log(`[Analytics] ⚠️  Section "${section.name}" has no linked questions, using fallback`)
          // Fallback: iterate through answers to at least show time data
          let answerIndex = 1
          for (const [questionId, ans] of answerMap.entries()) {
            const timeSpentSeconds = ans.timeSpentSeconds || 0
            let status: 'correct' | 'incorrect' | 'skipped' = 'skipped'
            
            if (ans.answerGiven !== null && ans.answerGiven !== undefined) {
              status = 'correct'
              correct++
            } else {
              skipped++
            }
            timeUsed += timeSpentSeconds

            questionPacingStats.push({
              questionIndex: answerIndex++,
              sectionName: section.name,
              timeSpentSeconds,
              status,
              difficulty: 'unknown',
              topicName: 'General Skill'
            })
            console.log(`[Analytics]   Q${answerIndex-1}: ${timeSpentSeconds}s (${status})`)
          }
        } else {
          // Flatten questions so PASSAGE parent questions are replaced by their child questions
          const flattenedQuestions: any[] = []
          for (const tq of section.questions) {
            const q = tq.question as any
            // Skip child question rows: they are reached via their passage parent's
            // childQuestions below. Counting their own rows too double-counts passages.
            if (q.parentQuestionId) continue
            const isPassage = q.type === 'PASSAGE' || (q.content && q.content.meta?.isPassage === true)
            if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
              for (const cq of q.childQuestions) {
                flattenedQuestions.push({
                  ...tq,
                  question: { ...cq, topic: cq.topic || q.topic }
                })
              }
            } else {
              flattenedQuestions.push(tq)
            }
          }

          for (const tq of flattenedQuestions) {
            const q = tq.question
            const ans = answerMap.get(q.id)
            
            let status: 'correct' | 'incorrect' | 'skipped' = 'skipped'
            let timeSpentSeconds = 0

            if (ans) {
              timeSpentSeconds = ans.timeSpentSeconds || 0
              timeUsed += timeSpentSeconds
              if (ans.answerGiven !== null && ans.answerGiven !== undefined) {
                const isCorrect = isAnswerCorrect(ans.answerGiven, q.correctAnswer)
                if (isCorrect) {
                  correct++
                  status = 'correct'
                } else {
                  incorrect++
                  status = 'incorrect'
                }
              } else {
                skipped++
              }
            } else {
              skipped++
            }

            questionPacingStats.push({
              questionIndex: questionIndex++,
              sectionName: section.name,
              timeSpentSeconds,
              status,
              difficulty: q.difficultyLevel?.toLowerCase() || 'unknown',
              topicName: (q.content as any)?.meta?.domain ?? q.topic?.name ?? 'General Skill'
            })
            console.log(`[Analytics]   Q${questionIndex-1}: ${timeSpentSeconds}s (${status}) - ${q.topic?.name}`)
          }
        }

        const totalQuestions = section.questions?.length > 0 ? (correct + incorrect + skipped) : answerMap.size
        sectionStats.push({
          sectionId: section.name, // using section name as UI friendly id
          sectionName: section.name,
          totalQuestions,
          correct,
          incorrect,
          skipped,
          accuracy: totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0,
          timeAllocated: section.durationMinutes * 60,
          timeUsed,
        })
      }
    }

    const overallAccuracy = sectionStats.length > 0
      ? Math.round(sectionStats.reduce((a, s) => a + s.accuracy, 0) / sectionStats.length)
      : 0

    const totalScore = latest ? (latest.totalScore ?? 0) : 0
    const avgScore = attempts.length > 0
      ? Math.round(attempts.reduce((a, at) => a + (at.totalScore ?? 0), 0) / attempts.length * 10) / 10
      : 0

    const cheatingLogsData = await prisma.cheatingLog.findMany({
      where: { attempt: { studentId } },
      include: { attempt: { include: { test: { select: { title: true } } } } },
      orderBy: { createdAt: 'desc' }
    });

    const cheatingLogs = cheatingLogsData.map(log => ({
      id: log.id,
      attemptId: log.attemptId,
      testTitle: log.attempt.test.title,
      eventType: log.eventType,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString()
    }))

    return NextResponse.json({
      trend,
      sectionStats,
      questionPacingStats,
      overallAccuracy,
      totalAttempts: attempts.length,
      latestScore: totalScore,
      avgScore,
      cheatingLogs,
    })
  } catch (error) {
    console.error('GET /api/analytics/student/[studentId]:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
