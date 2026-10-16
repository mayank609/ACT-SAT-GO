import { NextRequest, NextResponse } from 'next/server'
import { requireStudentAccess } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params
  const access = await requireStudentAccess(request, studentId)
  if (access !== true) return access

  try {
    // ?summary=1 — just each attempt's test, score and dates (no questions or
    // answers). List/summary screens (e.g. the admin Students analysis table,
    // which loads this for every student) only need these fields.
    if (request.nextUrl.searchParams.get('summary') === '1') {
      const attempts = await prisma.testAttempt.findMany({
        where: { studentId },
        orderBy: { startedAt: 'desc' },
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
      return NextResponse.json({ attempts })
    }

    // Full list. Each question carries everything the scoring in frontend
    // lib/analyticsData.ts (recordsFromAttempt) reads, including topic tags,
    // passage children and difficulty, so callers no longer need one
    // GET /api/attempts/:id per attempt to "enrich" the list (an N+1 that the
    // student dashboard, My Tests and Analytics all paid). `taxonomy: true`
    // in the response tells the client this list is already complete.
    const attempts = await prisma.testAttempt.findMany({
      where: { studentId },
      orderBy: { startedAt: 'desc' },
      include: {
        test: {
          include: {
            sections: {
              orderBy: { orderIndex: 'asc' },
              include: {
                _count: {
                  select: { questions: true }
                }
              }
            }
          }
        },
        sectionAttempts: { orderBy: { section: { orderIndex: 'asc' } } },
        answers: true,
      },
    })

    // Question trees are loaded once per section (retakes of a test share
    // them), not once per attempt, and only with the fields scoring reads.
    // The question body is trimmed to content.meta below: the full text made
    // this response ~300 KB per attempt; screens that show questions load
    // them via GET /api/attempts/:id.
    const topicSelect = { select: { name: true, parent: { select: { name: true } } } } as const
    const leafSelect = {
      id: true, type: true, correctAnswer: true, subject: true, content: true,
      difficultyLevel: true, parentQuestionId: true, topic: topicSelect,
    } as const
    const sectionIds = [...new Set(attempts.flatMap((a) => a.test.sections.map((s) => s.id)))]
    const sectionRows = sectionIds.length
      ? await prisma.testSection.findMany({
          where: { id: { in: sectionIds } },
          include: {
            questions: {
              orderBy: { orderIndex: 'asc' },
              include: {
                question: {
                  select: {
                    ...leafSelect,
                    childQuestions: { orderBy: { createdAt: 'asc' }, select: leafSelect },
                    parentQuestion: { select: { subject: true, content: true, difficultyLevel: true, topic: topicSelect } },
                  },
                },
              },
            },
          },
        })
      : []

    // Keep only content.meta (isPassage / domain / subTopic).
    const trimContent = (q: { content: Prisma.JsonValue } | null | undefined) => {
      if (!q) return
      const content = q.content as { meta?: unknown } | null
      q.content = (content && typeof content === 'object' && 'meta' in content
        ? { meta: content.meta }
        : {}) as Prisma.JsonObject
    }
    for (const sec of sectionRows) {
      for (const tq of sec.questions) {
        trimContent(tq.question)
        tq.question.childQuestions.forEach(trimContent)
        trimContent(tq.question.parentQuestion)
      }
    }
    type SectionRow = (typeof sectionRows)[number]
    const sectionsById = new Map<string, SectionRow>(sectionRows.map((s) => [s.id, s]))

    const withSections = attempts.map((attempt) => {
      const sectionAttempts: Array<{ id: string; attemptId: string; sectionId: string; startedAt: Date; completedAt: Date | null; section: SectionRow }> =
        attempt.sectionAttempts
          .filter((sa) => sectionsById.has(sa.sectionId))
          .map((sa) => ({ ...sa, section: sectionsById.get(sa.sectionId)! }))
      // As in GET /api/attempts/:id: a submitted attempt missing a module's
      // SectionAttempt row still scores that module (as unanswered).
      if (attempt.status === 'SUBMITTED') {
        const have = new Set(attempt.sectionAttempts.map((sa) => sa.sectionId))
        for (const s of attempt.test.sections) {
          const sec = sectionsById.get(s.id)
          if (have.has(s.id) || !sec) continue
          sectionAttempts.push({
            id: `synthetic-${s.id}`, attemptId: attempt.id, sectionId: s.id,
            startedAt: attempt.startedAt, completedAt: attempt.completedAt ?? attempt.startedAt,
            section: sec,
          })
        }
        sectionAttempts.sort((a, b) => a.section.orderIndex - b.section.orderIndex)
      }
      return { ...attempt, sectionAttempts }
    })
    return NextResponse.json({ attempts: withSections, taxonomy: true })
  } catch (error) {
    console.error('GET /api/students/[studentId]/attempts:', error)
    return NextResponse.json({ error: 'Failed to fetch attempts' }, { status: 500 })
  }
}
