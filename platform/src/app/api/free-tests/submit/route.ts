import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { parseNumericValue } from '@/lib/numericAnswer'
import type { FreeTestLead } from '../register/route'

export const dynamic = 'force-dynamic'

const leadKey = (id: string) => `lead:freeTest:${id}`

function gradeAnswer(correctAnswer: any, answerGiven: any, type: string): boolean {
  if (answerGiven === null || answerGiven === undefined || answerGiven === '') {
    return false
  }

  if (type === 'NUMERIC') {
    const givenNum = parseNumericValue(answerGiven)
    if (givenNum === null) return false

    if (correctAnswer && typeof correctAnswer === 'object') {
      if (Array.isArray(correctAnswer.values)) {
        return correctAnswer.values.some((v: number) => Math.abs(v - givenNum) < 1e-4)
      }
      if (correctAnswer.value !== undefined) {
        return Math.abs(Number(correctAnswer.value) - givenNum) < 1e-4
      }
    }
    if (typeof correctAnswer === 'number') {
      return Math.abs(correctAnswer - givenNum) < 1e-4
    }
    return false
  }

  if (type === 'MSQ') {
    const givenArr = Array.isArray(answerGiven) ? answerGiven.map(String).map((s) => s.toUpperCase()).sort() : [String(answerGiven).toUpperCase()]
    let correctArr: string[] = []
    if (correctAnswer && typeof correctAnswer === 'object') {
      if (Array.isArray(correctAnswer.keys)) {
        correctArr = correctAnswer.keys.map(String).map((s) => s.toUpperCase()).sort()
      } else if (correctAnswer.key) {
        correctArr = [String(correctAnswer.key).toUpperCase()]
      }
    }
    if (givenArr.length !== correctArr.length) return false
    return givenArr.every((val, idx) => val === correctArr[idx])
  }

  // Default MCQ
  let correctKey = ''
  if (correctAnswer && typeof correctAnswer === 'object' && correctAnswer.key) {
    correctKey = String(correctAnswer.key).toUpperCase()
  } else if (typeof correctAnswer === 'string') {
    correctKey = correctAnswer.toUpperCase()
  }

  const givenKey = String(answerGiven).trim().toUpperCase()
  return givenKey === correctKey
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leadId, testId, answers = {}, timeSpentSeconds = 0 } = body

    if (!leadId || !testId) {
      return NextResponse.json({ error: 'leadId and testId are required' }, { status: 400 })
    }

    // Load lead from Redis
    const rawLead = await redis.get<string>(leadKey(leadId))
    if (!rawLead) {
      return NextResponse.json({ error: 'Lead session not found' }, { status: 404 })
    }

    const lead: FreeTestLead = typeof rawLead === 'string' ? JSON.parse(rawLead) : (rawLead as unknown as FreeTestLead)

    // Load test with sections, questions, and topics to grade
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: {
            questions: {
              orderBy: { orderIndex: 'asc' },
              include: {
                question: {
                  include: {
                    topic: true,
                    childQuestions: {
                      include: { topic: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    }

    let totalPositiveMarks = 0
    let earnedMarks = 0
    let totalQuestionsCount = 0
    let correctCount = 0
    let incorrectCount = 0
    let unattemptedCount = 0

    const sectionScores: Array<{
      sectionId: string
      sectionName: string
      score: number
      maxScore: number
      correct: number
      incorrect: number
      unattempted: number
      total: number
      accuracy: number
    }> = []

    const detailedAnswers: Record<string, {
      questionId: string
      questionText: string
      type: string
      options?: any
      correctAnswer: any
      answerGiven: any
      isCorrect: boolean
      explanation?: string
      timeSpentSeconds: number
      topic?: string
    }> = {}

    const topicPerformance: Record<string, { correct: number; total: number }> = {}

    for (const sec of test.sections) {
      let secEarned = 0
      let secMax = 0
      let secCorrect = 0
      let secIncorrect = 0
      let secUnattempted = 0

      for (const tq of sec.questions) {
        const q = tq.question
        const isPassage = q.type === 'PASSAGE' && q.childQuestions && q.childQuestions.length > 0

        const evalQuestions = isPassage ? q.childQuestions : [q]

        for (const eq of evalQuestions) {
          totalQuestionsCount++
          const marksPos = tq.marksPositive ?? 1
          const marksNeg = tq.marksNegative ?? 0
          secMax += marksPos
          totalPositiveMarks += marksPos

          const userAnsEntry = answers[eq.id]
          const answerGiven = userAnsEntry?.answerGiven ?? null
          const qTime = userAnsEntry?.timeSpentSeconds ?? 0

          const hasAnswered = answerGiven !== null && answerGiven !== undefined && answerGiven !== ''
          let isCorrect = false

          if (hasAnswered) {
            isCorrect = gradeAnswer(eq.correctAnswer, answerGiven, eq.type)
            if (isCorrect) {
              earnedMarks += marksPos
              secEarned += marksPos
              correctCount++
              secCorrect++
            } else {
              earnedMarks = Math.max(0, earnedMarks - marksNeg)
              secEarned = Math.max(0, secEarned - marksNeg)
              incorrectCount++
              secIncorrect++
            }
          } else {
            unattemptedCount++
            secUnattempted++
          }

          // Topic aggregation
          const topicName = eq.topic?.name || (eq.content as any)?.meta?.domain || (eq.content as any)?.meta?.topic || 'General'
          if (!topicPerformance[topicName]) {
            topicPerformance[topicName] = { correct: 0, total: 0 }
          }
          topicPerformance[topicName].total++
          if (isCorrect) topicPerformance[topicName].correct++

          detailedAnswers[eq.id] = {
            questionId: eq.id,
            questionText: (eq.content as any)?.text || '',
            type: eq.type,
            options: eq.options,
            correctAnswer: eq.correctAnswer,
            answerGiven,
            isCorrect,
            explanation: (eq.content as any)?.explanation || '',
            timeSpentSeconds: qTime,
            topic: topicName,
          }
        }
      }

      sectionScores.push({
        sectionId: sec.id,
        sectionName: sec.name,
        score: Math.round(secEarned * 10) / 10,
        maxScore: secMax,
        correct: secCorrect,
        incorrect: secIncorrect,
        unattempted: secUnattempted,
        total: sec.questions.length,
        accuracy: secMax > 0 ? Math.round((secCorrect / (secCorrect + secIncorrect || 1)) * 100) : 0,
      })
    }

    const percentage = totalPositiveMarks > 0 ? Math.round((earnedMarks / totalPositiveMarks) * 100) : 0

    // Scaled score computation based on exam type
    let scaledScore = Math.round(earnedMarks)
    let maxScaledScore = totalPositiveMarks
    const category = (test.category || lead.exam || 'SAT').toUpperCase()

    if (category.includes('SAT')) {
      // SAT Scaled Score (400 - 1600)
      maxScaledScore = 1600
      scaledScore = Math.round(400 + (percentage / 100) * 1200)
    } else if (category.includes('ACT')) {
      // ACT Scaled Score (1 - 36)
      maxScaledScore = 36
      scaledScore = Math.max(1, Math.round((percentage / 100) * 36))
    }

    // Update lead record
    const updatedLead: FreeTestLead = {
      ...lead,
      status: 'Completed',
      completedAt: new Date().toISOString(),
      totalScore: scaledScore,
      maxScore: maxScaledScore,
      percentage,
      timeSpentSeconds: Number(timeSpentSeconds) || 0,
      sectionScores,
      answers: detailedAnswers,
    }

    await redis.set(leadKey(leadId), JSON.stringify(updatedLead))

    return NextResponse.json({
      success: true,
      report: {
        leadId,
        studentName: lead.name,
        exam: lead.exam,
        testTitle: test.title,
        scaledScore,
        maxScaledScore,
        rawScore: earnedMarks,
        maxRawScore: totalPositiveMarks,
        percentage,
        accuracy: (correctCount + incorrectCount) > 0 ? Math.round((correctCount / (correctCount + incorrectCount)) * 100) : 0,
        correctCount,
        incorrectCount,
        unattemptedCount,
        totalQuestionsCount,
        timeSpentSeconds,
        sectionScores,
        topicPerformance,
        completedAt: updatedLead.completedAt,
        answers: detailedAnswers,
      },
    })
  } catch (error) {
    console.error('POST /api/free-tests/submit:', error)
    return NextResponse.json({ error: 'Failed to evaluate free test submission' }, { status: 500 })
  }
}
