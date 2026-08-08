import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

const REDIS_TTL = 60 * 60 * 4 // 4 hours
// A section the admin marked "Untimed" in the Test Builder has durationMinutes
// === 0 — that means no time limit, not "expires immediately". Give it an
// effectively-unlimited endTime instead of Date.now() + 0.
const NO_LIMIT_MS = 1000 * 60 * 60 * 24 * 365 * 10 // 10 years

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ attemptId: string; sectionId: string }> }
) {
  const { attemptId, sectionId } = await params

  try {
    const section = await prisma.testSection.findUnique({ where: { id: sectionId } })
    if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

    const sectionAttempt = await prisma.sectionAttempt.upsert({
      where: { attemptId_sectionId: { attemptId, sectionId } },
      update: { startedAt: new Date(), completedAt: null },
      create: { attemptId, sectionId, startedAt: new Date() },
    })

    const endTime = section.durationMinutes > 0
      ? Date.now() + section.durationMinutes * 60 * 1000
      : Date.now() + NO_LIMIT_MS
    await redis.set(`timer:${attemptId}:${sectionId}`, endTime, { ex: REDIS_TTL })

    return NextResponse.json({ sectionAttempt, endTime }, { status: 201 })
  } catch (error) {
    console.error('POST start section:', error)
    return NextResponse.json({ error: 'Failed to start section' }, { status: 500 })
  }
}
