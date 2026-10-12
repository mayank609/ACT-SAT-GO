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
    const attempts = await prisma.testAttempt.findMany({
      where: { studentId },
      orderBy: { startedAt: 'desc' },
      include: {
        test: {
          include: {
            sections: {
              include: {
                _count: {
                  select: { questions: true }
                }
              }
            }
          }
        },
        sectionAttempts: {
          orderBy: { section: { orderIndex: 'asc' } },
          include: {
            section: {
              include: {
                questions: {
                  orderBy: { orderIndex: 'asc' },
                  // Only what the list's scoring (frontend lib/analyticsData.ts
                  // recordsFromAttempt) reads. The full question text and
                  // options made this response ~300 KB per attempt; screens
                  // that show questions load them via GET /api/attempts/:id.
                  include: {
                    question: {
                      select: { id: true, type: true, correctAnswer: true, subject: true, content: true },
                    },
                  },
                },
              },
            },
          },
        },
        answers: true,
      },
    })
    // Keep only content.meta (isPassage / domain / subTopic); the rest of
    // `content` is the question body, which nothing reading this list uses.
    for (const attempt of attempts) {
      for (const sa of attempt.sectionAttempts) {
        for (const tq of sa.section.questions) {
          const content = tq.question.content as { meta?: unknown } | null
          tq.question.content = (content && typeof content === 'object' && 'meta' in content
            ? { meta: content.meta }
            : {}) as Prisma.JsonObject
        }
      }
    }
    return NextResponse.json({ attempts })
  } catch (error) {
    console.error('GET /api/students/[studentId]/attempts:', error)
    return NextResponse.json({ error: 'Failed to fetch attempts' }, { status: 500 })
  }
}
