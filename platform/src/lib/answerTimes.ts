import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildVisits } from '@/lib/timeAnalytics'

/**
 * Rewrites AttemptAnswer.timeSpentSeconds from the attempt's event log, so
 * every existing view (pacing table, per-question time, analytics, admin and
 * tutor pages) agrees with the visit-level Time Analytics chart:
 * total time on a question = sum of its visits' active time (tab-hidden and
 * idle time excluded), per the Time Analytics spec.
 *
 * Attempts without events (taken before tracking existed) are left untouched.
 * Idempotent; only rows whose value changes are written.
 */
export async function syncAnswerTimesFromEvents(attemptId: string): Promise<void> {
  const events = await prisma.attemptEvent.findMany({
    where: { attemptId },
    orderBy: { seq: 'asc' },
    select: { seq: true, eventType: true, questionId: true, tMs: true, choice: true },
  })
  if (events.length === 0) return

  // Correctness is irrelevant for durations, so a constant grader is enough.
  const visits = buildVisits(
    events.map((e) => ({ seq: e.seq, type: e.eventType, questionId: e.questionId, t: e.tMs, choice: e.choice ?? null })),
    () => 'incorrect',
  )
  const totals = new Map<string, number>()
  for (const v of visits) totals.set(v.questionId, (totals.get(v.questionId) ?? 0) + v.activeMs)
  if (totals.size === 0) return

  const existing = await prisma.attemptAnswer.findMany({
    where: { attemptId, questionId: { in: [...totals.keys()] } },
    select: { questionId: true, timeSpentSeconds: true },
  })
  const current = new Map(existing.map((a) => [a.questionId, a.timeSpentSeconds]))
  // Only questions that belong to this attempt's test (guards against stray ids).
  const valid = new Set(
    (await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      select: { test: { select: { questions: { select: { questionId: true, question: { select: { childQuestions: { select: { id: true } } } } } } } } },
    }))?.test.questions.flatMap((tq) => [tq.questionId, ...tq.question.childQuestions.map((c) => c.id)]) ?? [],
  )

  const writes: Prisma.PrismaPromise<unknown>[] = []
  for (const [questionId, ms] of totals) {
    if (!valid.has(questionId)) continue
    const seconds = Math.round(ms / 1000)
    if (current.get(questionId) === seconds) continue
    writes.push(
      prisma.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        update: { timeSpentSeconds: seconds },
        create: { attemptId, questionId, answerGiven: Prisma.DbNull, timeSpentSeconds: seconds },
      }),
    )
  }
  if (writes.length) await prisma.$transaction(writes)
}
