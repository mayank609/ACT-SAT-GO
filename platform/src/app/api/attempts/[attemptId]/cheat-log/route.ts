import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params

  try {
    const body = await request.json()
    const { eventType, metadata } = body as {
      eventType?: string
      metadata?: Record<string, string | number>
    }

    if (!eventType) {
      return NextResponse.json({ error: 'eventType is required' }, { status: 400 })
    }

    // Fetch the test attempt to get studentId and testId
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId }
    })

    if (!attempt) {
      return NextResponse.json({ error: 'Test attempt not found' }, { status: 404 })
    }

    // Count existing violations of this type for this attempt
    const count = await prisma.cheatingLog.count({
      where: {
        attemptId,
        eventType
      }
    })

    const violationCount = count + 1
    const timestamp = new Date().toISOString()

    const finalMetadata = {
      ...(metadata || {}),
      studentId: attempt.studentId,
      testId: attempt.testId,
      timestamp,
      violationCount
    }

    await prisma.cheatingLog.create({
      data: {
        attemptId,
        eventType,
        metadata: finalMetadata,
      },
    })
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/attempts/[attemptId]/cheat-log:', error)
    return NextResponse.json({ error: 'Failed to log event' }, { status: 500 })
  }
}
