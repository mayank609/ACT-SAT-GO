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

    await prisma.cheatingLog.create({
      data: {
        attemptId,
        eventType,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    })
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/attempts/[attemptId]/cheat-log:', error)
    return NextResponse.json({ error: 'Failed to log event' }, { status: 500 })
  }
}
