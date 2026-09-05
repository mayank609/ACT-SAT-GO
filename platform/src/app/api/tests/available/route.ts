import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const studentId = request.nextUrl.searchParams.get('studentId')
  if (!studentId) {
    return NextResponse.json({ error: 'studentId query parameter is required' }, { status: 400 })
  }

  try {
    const assignments = await prisma.testAssignment.findMany({
      where: { studentId, isActive: true },
      select: { testId: true },
    })
    const assignedTestIds = assignments.map((a) => a.testId)
    // A student with no assignments sees nothing — never the whole catalogue.
    if (assignedTestIds.length === 0) {
      return NextResponse.json({ tests: [] })
    }

    const tests = await prisma.test.findMany({
      where: {
        status: 'PUBLISHED',
        id: { in: assignedTestIds },
      },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: { _count: { select: { questions: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ tests })
  } catch (error) {
    console.error('GET /api/tests/available:', error)
    return NextResponse.json({ error: 'Failed to fetch available tests' }, { status: 500 })
  }
}
