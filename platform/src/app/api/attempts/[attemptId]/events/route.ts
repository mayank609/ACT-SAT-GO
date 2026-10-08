import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { EVENT_TYPES } from '@/lib/timeAnalytics'
import { syncAnswerTimesFromEvents } from '@/lib/answerTimes'

// Test-player event log for visit-level time analytics.
//
//   POST { events: [{ seq, type, questionId, t, wall?, choice? }] } -> 204
//     Append-only. Retried batches are idempotent: (attemptId, seq) is unique
//     and duplicates are skipped.
//   GET  -> { lastSeq, lastT, serverElapsedMs }
//     Lets a reloaded player continue the same seq counter and time axis.

const MAX_EVENTS_PER_BATCH = 500
// The final flush (sent as the tab closes) can land just after submit.
const LATE_EVENT_GRACE_MS = 10 * 60_000

async function loadOwnAttempt(request: NextRequest, attemptId: string) {
  const user = await getCurrentUser(request)
  if (!user) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) }
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, studentId: true, status: true, startedAt: true, completedAt: true },
  })
  if (!attempt) return { error: NextResponse.json({ error: 'Test attempt not found' }, { status: 404 }) }
  if (attempt.studentId !== user.id) {
    return { error: NextResponse.json({ error: 'Not your attempt' }, { status: 403 }) }
  }
  return { attempt }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params
  try {
    const { attempt, error } = await loadOwnAttempt(request, attemptId)
    if (error) return error
    const max = await prisma.attemptEvent.aggregate({ where: { attemptId }, _max: { seq: true, tMs: true } })
    return NextResponse.json({
      lastSeq: max._max.seq ?? 0,
      lastT: max._max.tMs ?? 0,
      serverElapsedMs: Math.max(0, Date.now() - attempt!.startedAt.getTime()),
    })
  } catch (err) {
    console.error('GET /api/attempts/[attemptId]/events:', err)
    return NextResponse.json({ error: 'Failed to load event state' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params
  try {
    const body = (await request.json().catch(() => null)) as { events?: unknown } | null
    const raw = Array.isArray(body?.events) ? body!.events : null
    if (!raw) return NextResponse.json({ error: 'events[] is required' }, { status: 400 })
    if (raw.length > MAX_EVENTS_PER_BATCH) {
      return NextResponse.json({ error: `At most ${MAX_EVENTS_PER_BATCH} events per batch` }, { status: 413 })
    }

    const { attempt, error } = await loadOwnAttempt(request, attemptId)
    if (error) return error
    if (
      attempt!.status !== 'IN_PROGRESS' &&
      attempt!.completedAt &&
      Date.now() - attempt!.completedAt.getTime() > LATE_EVENT_GRACE_MS
    ) {
      return NextResponse.json({ error: 'Attempt is closed' }, { status: 409 })
    }

    const rows: Prisma.AttemptEventCreateManyInput[] = []
    for (const item of raw) {
      const e = item as Record<string, unknown>
      const seq = Number(e.seq)
      const t = Number(e.t)
      const type = String(e.type ?? '')
      if (!Number.isInteger(seq) || seq < 1 || !Number.isFinite(t) || t < 0 || !EVENT_TYPES.has(type)) continue
      const questionId = typeof e.questionId === 'string' && e.questionId.length <= 64 ? e.questionId : null
      const wall = Number(e.wall)
      rows.push({
        attemptId,
        seq,
        eventType: type,
        questionId,
        tMs: Math.min(Math.round(t), 2_147_483_647),
        // Only the raw choice is accepted — the client never decides correctness.
        choice: type === 'ANSWER' && e.choice !== undefined && e.choice !== null
          ? (e.choice as Prisma.InputJsonValue)
          : Prisma.DbNull,
        clientWall: Number.isFinite(wall) && wall > 0 ? new Date(wall) : null,
      })
    }
    if (rows.length) {
      await prisma.attemptEvent.createMany({ data: rows, skipDuplicates: true })
      // The final batch can land just after the last module was submitted;
      // refresh the stored per-question times so they include it.
      if (attempt!.status !== 'IN_PROGRESS') {
        await syncAnswerTimesFromEvents(attemptId).catch((err) =>
          console.error('[events] syncAnswerTimesFromEvents failed:', err))
      }
    }
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('POST /api/attempts/[attemptId]/events:', err)
    return NextResponse.json({ error: 'Failed to store events' }, { status: 500 })
  }
}
