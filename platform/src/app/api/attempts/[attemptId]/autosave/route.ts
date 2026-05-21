import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params

  try {
    const body = await request.json()
    const { questionId, answerGiven, timeSpentSeconds, isFlagged, attemptState } = body as {
      questionId?: string
      answerGiven: unknown
      timeSpentSeconds?: number
      isFlagged?: boolean
      attemptState?: unknown
    }

    if (attemptState) {
      await redis.set(`state:${attemptId}`, JSON.stringify({ ...attemptState, updatedAt: Date.now() }), {
        ex: 60 * 60 * 4,
      })
    }

    if (questionId) {
      await redis.hset(`answers:${attemptId}`, {
        [questionId]: JSON.stringify({
          answerGiven,
          timeSpentSeconds: timeSpentSeconds ?? 0,
          isFlagged: isFlagged ?? false,
          updatedAt: Date.now(),
        }),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/attempts/[attemptId]/autosave:', error)
    return NextResponse.json({ error: 'Autosave failed' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params

  try {
    const [stateRaw, answersRaw] = await Promise.all([
      redis.get<string>(`state:${attemptId}`),
      redis.hgetall(`answers:${attemptId}`),
    ])

    // Upstash auto-deserializes JSON — handle both string and already-parsed object
    const state = stateRaw
      ? (typeof stateRaw === 'string' ? JSON.parse(stateRaw) : stateRaw)
      : null
    const answers = Object.fromEntries(
      Object.entries((answersRaw ?? {}) as Record<string, unknown>).map(([questionId, raw]) => [
        questionId,
        typeof raw === 'string' ? JSON.parse(raw) : raw,
      ])
    )

    return NextResponse.json({ state, answers })
  } catch (error) {
    console.error('GET /api/attempts/[attemptId]/autosave:', error)
    return NextResponse.json({ error: 'Failed to load autosave state' }, { status: 500 })
  }
}
