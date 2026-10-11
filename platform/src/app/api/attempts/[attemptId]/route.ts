import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params

  try {
    // The question tree for a section is identical whether it is reached via
    // test.sections or via sectionAttempts[].section, so load it once (through
    // test.sections) and attach it to each section attempt below. Previously the
    // whole tree (sections → questions → question → topic/children/parent) was
    // fetched twice, doubling the number of sequential DB round trips.
    const sectionInclude = {
      questions: {
        orderBy: { orderIndex: 'asc' },
        include: {
          question: {
            include: {
              childQuestions: {
                orderBy: { createdAt: 'asc' },
                include: { topic: { include: { parent: true } } },
              },
              parentQuestion: {
                include: { topic: { include: { parent: true } } }
              },
              topic: { include: { parent: true } },
            },
          },
        },
      },
    } satisfies Prisma.TestSectionInclude

    const attemptRow = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            sections: {
              orderBy: { orderIndex: 'asc' },
              include: sectionInclude,
            },
          },
        },
        sectionAttempts: {
          orderBy: { section: { orderIndex: 'asc' } },
        },
        answers: { include: { question: true } },
        cheatingLogs: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!attemptRow) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })

    type SectionWithQuestions = (typeof attemptRow.test.sections)[number]
    const sectionsById = new Map<string, SectionWithQuestions>(
      attemptRow.test.sections.map((sec) => [sec.id, sec])
    )
    // Defensive: a section attempt pointing at a section outside this test's
    // section list (shouldn't happen) is still resolved, as before.
    const strayIds = [...new Set(attemptRow.sectionAttempts.map((sa) => sa.sectionId))]
      .filter((id) => !sectionsById.has(id))
    if (strayIds.length > 0) {
      const stray = await prisma.testSection.findMany({
        where: { id: { in: strayIds } },
        include: sectionInclude,
      })
      for (const sec of stray) sectionsById.set(sec.id, sec)
    }
    const attempt = {
      ...attemptRow,
      sectionAttempts: attemptRow.sectionAttempts
        .filter((sa) => sectionsById.has(sa.sectionId))
        .map((sa) => ({ ...sa, section: sectionsById.get(sa.sectionId)! })),
    }

    // Backfill any section missing its own SectionAttempt row (not just when
    // the whole array is empty) — otherwise that module silently disappears
    // from the response instead of showing a real (possibly zero) score.
    let sectionAttempts = attempt.sectionAttempts
    if (attempt.test?.sections) {
      const existingSectionIds = new Set(sectionAttempts.map((sa) => sa.sectionId))
      const missingSections = attempt.test.sections.filter((section) => !existingSectionIds.has(section.id))
      if (missingSections.length > 0) {
        console.log(`[BACKEND] Backfilling ${missingSections.length} missing section attempt(s): ${missingSections.map(s => s.name).join(', ')}`);
        const synthetic = missingSections.map(section => ({
          id: `synthetic-${section.id}`,
          attemptId: attempt.id,
          sectionId: section.id,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt || attempt.startedAt,
          section: section,
        })) as any
        sectionAttempts = [...sectionAttempts, ...synthetic].sort(
          (a, b) => a.section.orderIndex - b.section.orderIndex
        )
      }
    }
    
    return NextResponse.json({ attempt: { ...attempt, sectionAttempts } })
  } catch (error) {
    console.error('GET /api/attempts/[attemptId]:', error)
    return NextResponse.json({ error: 'Failed to fetch attempt' }, { status: 500 })
  }
}
