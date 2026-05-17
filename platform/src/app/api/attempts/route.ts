import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { testId, studentId } = body as { testId?: string; studentId?: string }

    if (!testId || !studentId) {
      return NextResponse.json({ error: 'testId and studentId are required' }, { status: 400 })
    }

    const existing = await prisma.testAttempt.findFirst({
      where: { testId, studentId, status: 'IN_PROGRESS' },
    })
    if (existing) {
      return NextResponse.json({ attemptId: existing.id, alreadyStarted: true })
    }

    const attempt = await prisma.testAttempt.create({
      data: { testId, studentId, status: 'IN_PROGRESS', startedAt: new Date() },
    })
    return NextResponse.json({ attemptId: attempt.id, alreadyStarted: false }, { status: 201 })
  } catch (error) {
    console.error('POST /api/attempts:', error)
    return NextResponse.json({ error: 'Failed to start test' }, { status: 500 })
  }
}
