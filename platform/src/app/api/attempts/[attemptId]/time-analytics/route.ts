import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { isAnswerCorrect } from '@/lib/answerCheck'
import { ensureAttemptEventsTable } from '@/lib/attemptEventsTable'
import {
  buildVisits, summarise, insights, isEmptyChoice,
  type Grader, type Result, type TrackedEvent,
} from '@/lib/timeAnalytics'

// GET /api/attempts/:attemptId/time-analytics
//
// Rebuilds visits from the attempt's event log and grades them with the answer
// key. Results are only ever returned here, after the attempt is submitted, so
// the answer key never reaches the browser during a test.
//
// Response: { hasEvents, sections: [{ sectionId, name, orderIndex, questionIds,
//   offsetMs, endMs, avgMs, visits, summary, metrics }] }
// Times in `visits` are ms since the attempt started; subtract `offsetMs` for a
// module-relative axis. Attempts taken before event tracking existed return
// hasEvents=false and the client shows the legacy chart.

type QuestionKey = {
  id: string
  type: string
  content: unknown
  correctAnswer: unknown
  childQuestions: { id: string; correctAnswer: unknown }[]
}

function makeGrader(questions: Map<string, QuestionKey>): Grader {
  return (questionId, choice): Result => {
    const q = questions.get(questionId)
    if (!q || isEmptyChoice(choice)) return 'unanswered'
    const isPassage = q.type === 'PASSAGE' || (q.content as { meta?: { isPassage?: boolean } } | null)?.meta?.isPassage === true
    if (isPassage && q.childQuestions.length > 0) {
      // Passage answers are { childQuestionId: answer }. Correct only when every
      // child is answered correctly; incorrect if any answered child is wrong.
      const map = (choice ?? {}) as Record<string, unknown>
      let answered = 0
      let correct = 0
      for (const cq of q.childQuestions) {
        const a = map[cq.id]
        if (isEmptyChoice(a)) continue
        answered++
        if (isAnswerCorrect(a, cq.correctAnswer)) correct++
      }
      if (answered === 0) return 'unanswered'
      return correct === q.childQuestions.length ? 'correct' : 'incorrect'
    }
    return isAnswerCorrect(choice, q.correctAnswer) ? 'correct' : 'incorrect'
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true, studentId: true, status: true, testId: true,
        sectionAttempts: { select: { sectionId: true, completedAt: true } },
      },
    })
    if (!attempt) return NextResponse.json({ error: 'Test attempt not found' }, { status: 404 })

    // Access: the student (for modules they have finished), their assigned
    // tutors, and admins. Results are never shown for a module still being
    // taken, so the answer key can't leak mid-test.
    let onlySections: Set<string> | null = null
    if (user.role === 'STUDENT') {
      if (attempt.studentId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      if (attempt.status === 'IN_PROGRESS') {
        onlySections = new Set(attempt.sectionAttempts.filter((sa) => sa.completedAt).map((sa) => sa.sectionId))
      }
    } else if (user.role === 'TUTOR') {
      const assigned = await prisma.tutorAssignment.findUnique({
        where: { tutorId_studentId: { tutorId: user.id, studentId: attempt.studentId } },
        select: { id: true },
      })
      if (!assigned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await ensureAttemptEventsTable()
    const [events, allSections] = await Promise.all([
      prisma.attemptEvent.findMany({
        where: { attemptId },
        orderBy: { seq: 'asc' },
        select: { seq: true, eventType: true, questionId: true, tMs: true, choice: true },
      }),
      prisma.testSection.findMany({
        where: { testId: attempt.testId },
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          name: true,
          orderIndex: true,
          questions: {
            orderBy: { orderIndex: 'asc' },
            select: {
              question: {
                select: {
                  id: true, type: true, content: true, correctAnswer: true, parentQuestionId: true,
                  childQuestions: { orderBy: { createdAt: 'asc' }, select: { id: true, correctAnswer: true } },
                },
              },
            },
          },
        },
      }),
    ])

    const sections = onlySections ? allSections.filter((s) => onlySections.has(s.id)) : allSections

    if (events.length === 0) {
      return NextResponse.json({ hasEvents: false, sections: [] })
    }

    // Rows mirror the test player (flattenTest): child-question rows are skipped
    // and each passage is expanded into its linked questions, which is what the
    // player shows — and tracks — one at a time.
    const keyMap = new Map<string, QuestionKey>()
    const rowsBySection = new Map<string, string[]>()
    for (const s of sections) {
      const rows: string[] = []
      for (const tq of s.questions) {
        const q = tq.question
        if (q.parentQuestionId) continue
        const isPassage = q.type === 'PASSAGE' || (q.content as { meta?: { isPassage?: boolean } } | null)?.meta?.isPassage === true
        if (isPassage && q.childQuestions.length > 0) {
          for (const cq of q.childQuestions) {
            keyMap.set(cq.id, { id: cq.id, type: 'MCQ', content: null, correctAnswer: cq.correctAnswer, childQuestions: [] })
            rows.push(cq.id)
          }
        } else {
          keyMap.set(q.id, q as QuestionKey)
          rows.push(q.id)
        }
      }
      rowsBySection.set(s.id, rows)
    }

    const tracked: TrackedEvent[] = events.map((e) => ({
      seq: e.seq,
      type: e.eventType,
      questionId: e.questionId,
      t: e.tMs,
      choice: e.choice ?? null,
    }))
    const visits = buildVisits(tracked, makeGrader(keyMap))

    const result = sections.map((s) => {
      const questionIds = rowsBySection.get(s.id) ?? []
      const idSet = new Set(questionIds)
      const sv = visits.filter((v) => idSet.has(v.questionId))
      const summary = summarise(sv, questionIds)
      const totalActive = sv.reduce((acc, v) => acc + v.activeMs, 0)
      const avgMs = questionIds.length ? Math.round(totalActive / questionIds.length) : 0
      return {
        sectionId: s.id,
        name: s.name,
        orderIndex: s.orderIndex,
        questionIds,
        offsetMs: sv.length ? Math.min(...sv.map((v) => v.start)) : 0,
        endMs: sv.length ? Math.max(...sv.map((v) => v.end)) : 0,
        avgMs,
        visits: sv,
        summary,
        metrics: insights(sv, summary, avgMs),
      }
    })

    return NextResponse.json({ hasEvents: true, sections: result })
  } catch (err) {
    console.error('GET /api/attempts/[attemptId]/time-analytics:', err)
    return NextResponse.json({ error: 'Failed to build time analytics' }, { status: 500 })
  }
}
