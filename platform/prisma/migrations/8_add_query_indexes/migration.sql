-- Indexes for the dashboard/analytics queries that were scanning the largest
-- tables: weekly answer activity (AttemptAnswer.updatedAt), open doubts
-- (AttemptAnswer.doubtStatus), daily attempt counts (TestAttempt.startedAt)
-- and a student's submitted history ordered by completion.
-- IF NOT EXISTS keeps this safe to re-run.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TestAttempt_studentId_status_completedAt_idx" ON "TestAttempt"("studentId", "status", "completedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TestAttempt_startedAt_idx" ON "TestAttempt"("startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AttemptAnswer_updatedAt_idx" ON "AttemptAnswer"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AttemptAnswer_doubtStatus_idx" ON "AttemptAnswer"("doubtStatus");
