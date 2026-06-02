import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params

  try {
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
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
                          include: { topic: { include: { parent: true } } },
                        },
                        parentQuestion: true,
                        topic: { include: { parent: true } },
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
            section: {
              include: {
                questions: {
                  orderBy: { orderIndex: 'asc' },
                  include: {
                    question: {
                      include: {
                        childQuestions: {
                          orderBy: { createdAt: 'asc' },
                          include: { topic: { include: { parent: true } } },
                        },
                        parentQuestion: true,
                        topic: { include: { parent: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        answers: { include: { question: true } },
        cheatingLogs: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    return NextResponse.json({ attempt })
  } catch (error) {
    console.error('GET /api/attempts/[attemptId]:', error)
    return NextResponse.json({ error: 'Failed to fetch attempt' }, { status: 500 })
  }
}
