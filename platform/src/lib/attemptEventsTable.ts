import { prisma } from '@/lib/prisma'

// The AttemptEvent table is created by migration 6_add_attempt_events. If a
// deploy's `prisma migrate deploy` step was skipped or failed, every
// time-analytics request would error with "relation does not exist". To keep
// the feature working regardless, the table is (idempotently) created on first
// use in each server process. Same SQL as the migration.

const DDL = [
  `CREATE TABLE IF NOT EXISTS "AttemptEvent" (
    "id" BIGSERIAL NOT NULL,
    "attemptId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "eventType" VARCHAR(16) NOT NULL,
    "questionId" TEXT,
    "tMs" INTEGER NOT NULL,
    "choice" JSONB,
    "clientWall" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttemptEvent_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AttemptEvent_attemptId_seq_key" ON "AttemptEvent"("attemptId", "seq")`,
  `DO $$ BEGIN
    ALTER TABLE "AttemptEvent" ADD CONSTRAINT "AttemptEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`,
]

let ready: Promise<void> | null = null

export function ensureAttemptEventsTable(): Promise<void> {
  ready ??= (async () => {
    const exists = await prisma.$queryRawUnsafe<{ t: string | null }[]>(
      `SELECT to_regclass('public."AttemptEvent"')::text AS t`,
    )
    if (exists[0]?.t) return
    console.warn('[attempt-events] AttemptEvent table missing (migration 6 not applied) — creating it')
    for (const sql of DDL) await prisma.$executeRawUnsafe(sql)
  })().catch((err) => {
    ready = null // try again on the next request
    console.error('[attempt-events] could not ensure AttemptEvent table:', err)
  })
  return ready
}
