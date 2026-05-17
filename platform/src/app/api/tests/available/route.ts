import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const studentId = request.nextUrl.searchParams.get('studentId')
  if (!studentId) {
    return NextResponse.json({ error: 'studentId query parameter is required' }, { status: 400 })
  }

  try {
    const attempts = await prisma.testAttempt.findMany({
      where: { studentId },
      select: { testId: true, status: true, totalScore: true, id: true },
    })
    const attemptMap = new Map(attempts.map((a) => [a.testId, a]))

    const tests = await prisma.test.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: { _count: { select: { questions: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      tests: tests.map((t) => ({ ...t, attempt: attemptMap.get(t.id) ?? null })),
    })
  } catch (error) {
    console.error('GET /api/tests/available:', error)
    return NextResponse.json({ error: 'Failed to fetch available tests' }, { status: 500 })
  }
}
