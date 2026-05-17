import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params

  try {
    const attempts = await prisma.testAttempt.findMany({
      where: { studentId },
      orderBy: { startedAt: 'desc' },
      include: {
        test: {
          include: {
            sections: {
              orderBy: { orderIndex: 'asc' },
              include: { _count: { select: { questions: true } } },
            },
          },
        },
        sectionAttempts: { orderBy: { startedAt: 'asc' } },
      },
    })
    return NextResponse.json({ attempts })
  } catch (error) {
    console.error('GET /api/students/[studentId]/attempts:', error)
    return NextResponse.json({ error: 'Failed to fetch attempts' }, { status: 500 })
  }
}
