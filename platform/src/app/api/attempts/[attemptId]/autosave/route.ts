import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params

  try {
    const body = await request.json()
    const { questionId, answerGiven, timeSpentSeconds, isFlagged } = body as {
      questionId?: string
      answerGiven: unknown
      timeSpentSeconds?: number
      isFlagged?: boolean
    }

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
    }

    await redis.hset(`answers:${attemptId}`, {
      [questionId]: JSON.stringify({
        answerGiven,
        timeSpentSeconds: timeSpentSeconds ?? 0,
        isFlagged: isFlagged ?? false,
        updatedAt: Date.now(),
      }),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/attempts/[attemptId]/autosave:', error)
    return NextResponse.json({ error: 'Autosave failed' }, { status: 500 })
  }
}
