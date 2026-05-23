import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attemptId: string; sectionId: string }> }
) {
  const { attemptId, sectionId } = await params

  try {
    let endTime = await redis.get<number>(`timer:${attemptId}:${sectionId}`)

    if (!endTime) {
      // Fallback: Reconstruct from PostgreSQL SectionAttempt
      const sectionAttempt = await prisma.sectionAttempt.findUnique({
        where: { attemptId_sectionId: { attemptId, sectionId } },
        include: { section: true },
      })

      if (sectionAttempt && sectionAttempt.startedAt && !sectionAttempt.completedAt) {
        endTime = new Date(sectionAttempt.startedAt).getTime() + sectionAttempt.section.durationMinutes * 60 * 1000
        // Set it back in Redis so subsequent requests don't hit the DB
        await redis.set(`timer:${attemptId}:${sectionId}`, endTime, { ex: 60 * 60 * 4 })
      }
    }

    if (!endTime) {
      return NextResponse.json({ remainingSeconds: 0, expired: true })
    }

    const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
    return NextResponse.json({ remainingSeconds: remaining, expired: remaining === 0 })
  } catch (error) {
    console.error('GET timer error:', error)
    return NextResponse.json({ remainingSeconds: 0, expired: true })
  }
}
