import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attemptId: string; sectionId: string }> }
) {
  const { attemptId, sectionId } = await params

  try {
    const endTime = await redis.get<number>(`timer:${attemptId}:${sectionId}`)
    if (!endTime) {
      return NextResponse.json({ remainingSeconds: 0, expired: true })
    }
    const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
    return NextResponse.json({ remainingSeconds: remaining, expired: remaining === 0 })
  } catch (error) {
    console.error('GET timer:', error)
    return NextResponse.json({ remainingSeconds: 0, expired: true })
  }
}
