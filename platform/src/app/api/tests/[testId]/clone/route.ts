import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params

  try {
    const original = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: {
            questions: { orderBy: { orderIndex: 'asc' } },
          },
        },
      },
    })

    if (!original) return NextResponse.json({ error: 'Test not found' }, { status: 404 })

    const newTestId = randomUUID()

    // Build flat rows for a batched insert — same approach as createTest
    const sectionRows: { id: string; testId: string; name: string; durationMinutes: number; orderIndex: number }[] = []
    const tqRows: { id: string; testId: string; sectionId: string; questionId: string; marksPositive: number; marksNegative: number; orderIndex: number }[] = []

    for (let sIdx = 0; sIdx < original.sections.length; sIdx++) {
      const sec = original.sections[sIdx]
      const newSectionId = randomUUID()
      sectionRows.push({
        id: newSectionId,
        testId: newTestId,
        name: sec.name,
        durationMinutes: sec.durationMinutes,
        orderIndex: sIdx,
      })
      for (const tq of sec.questions) {
        tqRows.push({
          id: randomUUID(),
          testId: newTestId,
          sectionId: newSectionId,
          questionId: tq.questionId,
          marksPositive: tq.marksPositive,
          marksNegative: tq.marksNegative,
          orderIndex: tq.orderIndex,
        })
      }
    }

    await prisma.$transaction([
      prisma.test.create({
        data: {
          id: newTestId,
          title: `Copy of ${original.title}`,
          description: original.description,
          status: 'DRAFT',
          category: original.category,
          subCategory: original.subCategory,
          createdById: original.createdById,
        },
      }),
      prisma.testSection.createMany({ data: sectionRows }),
      prisma.testQuestion.createMany({ data: tqRows }),
    ])

    return NextResponse.json({ test: { id: newTestId } })
  } catch (error) {
    console.error('POST /api/tests/[testId]/clone:', error)
    return NextResponse.json({ error: 'Failed to clone test' }, { status: 500 })
  }
}
