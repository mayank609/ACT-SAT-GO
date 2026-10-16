import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { isAnswerCorrect } from '@/lib/answerCheck'
import { isRawScoredTest } from '@/lib/testCategorize'

export const dynamic = 'force-dynamic'

// GET /api/students/analysis-summary
// Everything the admin Students "analysis" table needs, for every student, in
// ONE request. It replaces two requests per student (the light attempt list +
// /api/analytics/student/:id), which meant hundreds of requests per page view.
//   ADMIN / SUPER_ADMIN: every active student; TUTOR: their assigned students.
// Per student (same values those endpoints gave):
//   attempts      – submitted attempts, newest started first (test title/category/sections, score, dates)
//   latestScore   – totalScore of the latest submitted attempt (0 if none)
//   lastTrend     – { testTitle, date } of the latest scaled-score attempt, or null
//   sectionStats  – per-section correct counts of the latest submitted attempt

type Q = {
  id: string; type: string; content: unknown; parentQuestionId: string | null
  correctAnswer: unknown; childQuestions: { id: string; correctAnswer: unknown }[]
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
  if (!isAdmin && user.role !== 'TUTOR') return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  try {
    const studentIds = isAdmin
      ? (await prisma.user.findMany({ where: { role: 'STUDENT', deletedAt: null }, select: { id: true } })).map((u) => u.id)
      : (await prisma.tutorAssignment.findMany({ where: { tutorId: user.id }, select: { studentId: true } })).map((a) => a.studentId)

    const attempts = await prisma.testAttempt.findMany({
      where: { studentId: { in: studentIds }, status: 'SUBMITTED' },
      orderBy: { completedAt: 'asc' },
      select: {
        id: true, testId: true, studentId: true, status: true, totalScore: true, startedAt: true, completedAt: true,
        test: {
          select: {
            id: true, title: true, category: true, subCategory: true,
            sections: { orderBy: { orderIndex: 'asc' }, select: { id: true, name: true, orderIndex: true } },
          },
        },
      },
    })

    const byStudent = new Map<string, typeof attempts>()
    for (const a of attempts) {
      const list = byStudent.get(a.studentId) ?? []
      list.push(a)
      byStudent.set(a.studentId, list)
    }

    // Latest submitted attempt per student (completedAt order, as /api/analytics/student uses).
    const latestIds = [...byStudent.values()].map((list) => list[list.length - 1].id)
    const [latestAnswers, testKeys] = await Promise.all([
      prisma.attemptAnswer.findMany({
        where: { attemptId: { in: latestIds } },
        select: { attemptId: true, questionId: true, answerGiven: true },
      }),
      prisma.test.findMany({
        where: { id: { in: [...new Set([...byStudent.values()].map((l) => l[l.length - 1].testId))] } },
        select: {
          id: true,
          sections: {
            orderBy: { orderIndex: 'asc' },
            select: {
              name: true,
              questions: {
                orderBy: { orderIndex: 'asc' },
                select: {
                  question: {
                    select: {
                      id: true, type: true, content: true, parentQuestionId: true, correctAnswer: true,
                      childQuestions: { orderBy: { createdAt: 'asc' }, select: { id: true, correctAnswer: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ])
    const answersByAttempt = new Map<string, Map<string, unknown>>()
    for (const a of latestAnswers) {
      const m = answersByAttempt.get(a.attemptId) ?? new Map<string, unknown>()
      m.set(a.questionId, a.answerGiven)
      answersByAttempt.set(a.attemptId, m)
    }
    const sectionsByTest = new Map(testKeys.map((t) => [t.id, t.sections]))

    // Same per-section counting as /api/analytics/student (passages graded per sub-question).
    const sectionStatsFor = (attemptId: string, testId: string) => {
      const answers = answersByAttempt.get(attemptId) ?? new Map<string, unknown>()
      return (sectionsByTest.get(testId) ?? []).map((section) => {
        let correct = 0, incorrect = 0, skipped = 0
        if (section.questions.length === 0) {
          for (const given of answers.values()) {
            if (given !== null && given !== undefined) correct++
            else skipped++
          }
          return { sectionName: section.name, correct, incorrect, skipped, totalQuestions: answers.size }
        }
        for (const tq of section.questions) {
          const q = tq.question as Q
          if (q.parentQuestionId) continue
          const isPassage = q.type === 'PASSAGE' || (q.content as { meta?: { isPassage?: boolean } } | null)?.meta?.isPassage === true
          const gradable = isPassage && q.childQuestions.length > 0 ? q.childQuestions : [q]
          for (const gq of gradable) {
            const given = answers.get(gq.id)
            if (given === null || given === undefined) skipped++
            else if (isAnswerCorrect(given, gq.correctAnswer)) correct++
            else incorrect++
          }
        }
        return { sectionName: section.name, correct, incorrect, skipped, totalQuestions: correct + incorrect + skipped }
      })
    }

    const students: Record<string, unknown> = {}
    for (const id of studentIds) {
      const list = byStudent.get(id) ?? []
      const latest = list[list.length - 1]
      const scored = list.filter((a) => !isRawScoredTest(a.test))
      const lastScored = scored[scored.length - 1]
      students[id] = {
        attempts: [...list].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()),
        latestScore: latest ? (latest.totalScore ?? 0) : 0,
        lastTrend: lastScored
          ? {
              testTitle: lastScored.test.title,
              date: lastScored.completedAt?.toISOString().split('T')[0] ?? lastScored.startedAt.toISOString().split('T')[0],
            }
          : null,
        sectionStats: latest ? sectionStatsFor(latest.id, latest.testId) : [],
      }
    }
    return NextResponse.json({ students })
  } catch (error) {
    console.error('GET /api/students/analysis-summary:', error)
    return NextResponse.json({ error: 'Failed to load the student summary' }, { status: 500 })
  }
}
