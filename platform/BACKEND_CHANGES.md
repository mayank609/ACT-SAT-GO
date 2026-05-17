# Backend Changes Log

This file is the single source of truth for all backend changes.
**Mayank** reviews and adds entries. **Sunanda** applies them and marks `[DONE]`.

Format for each entry:
- Status: `[PENDING]` → needs to be applied | `[DONE]` → applied | `[SUPERSEDED]` → replaced by a later change, skip it
- Type: `SCHEMA` | `REDIS` | `ENV` | `SEED` | `CONFIG` | `CODE`

---

## Pending Changes

### Change #008 — Admin module: delete user endpoint + platform analytics [PENDING]

**Type:** CODE
**Requested by:** Mayank
**Why:** Needed to make the admin module fully dynamic — no more mock/hardcoded data anywhere.

**What was added (already in the codebase, just needs deploy):**

1. `DELETE /api/users/[userId]` — hard-deletes a user. Cascade deletes handle all related TutorAssignments, TestAttempts, SectionAttempts, AttemptAnswers, CheatingLogs automatically (Prisma cascade rules already in schema). File: `src/app/api/users/[userId]/route.ts`.

2. `GET /api/analytics/platform` — returns last-7-days daily activity (attempts + completions) and ACT score distribution across all SUBMITTED attempts. File: `src/app/api/analytics/platform/route.ts` (new file).

3. `PATCH /api/users/[userId]` now also accepts `notifications: Record<string, boolean>` in body — saves it into `permissions.notifications` JSON field. Already in the PATCH handler.

**Test it by:**
- `DELETE /api/users/<some-test-user-id>` → should return `{ success: true }` and the user should be gone
- `GET /api/analytics/platform` → should return `{ activityData: [...], scoreDistribution: [...] }`

---

## ✅ ALL PREVIOUS BACKEND CHANGES APPLIED

### Change #007 — Add SUPABASE_SERVICE_ROLE_KEY to .env [DONE]

**Type:** ENV
**Requested by:** Mayank
**Why:** Required for admin-level Supabase operations (creating users, bypassing RLS). Without it, any admin Server Action that uses the service role client will throw an error at runtime.

**Step 1 — Get the key:**
Supabase Dashboard → **Settings → API → Service Role** (the `secret` key, NOT the anon key)

**Step 2 — Add to your `.env` file:**
```
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

**Step 3 — Verify the app still starts:**
```bash
cd platform
npm run dev
```

That's it. No schema changes, no `prisma db push`, no re-seeding needed.

---

## All Other Changes — Already Applied

| # | Title | Type | Status |
|---|---|---|---|
| 001 | CheatingLog Model | SCHEMA | ✅ DONE |
| 002 | Fix broken import in prisma.ts | CODE | ✅ DONE |
| 003 | Fix logCheatingEvent field name | CODE | ✅ DONE |
| 004 | Rename middleware.ts → proxy.ts | CONFIG | ✅ DONE |
| 005 | Add DIRECT_URL for migrations | ENV | ✅ DONE |
| 006 | Fix dev/build scripts (webpack flag) | CONFIG | ✅ DONE |
| 007 | Add SUPABASE_SERVICE_ROLE_KEY to .env | ENV | ✅ DONE |
| 008 | Score calculation on section submit | CODE | ✅ DONE (see #010) |
| 009 | Seed more test data | SEED | ✅ DONE (see #011) |
| 010 | Full score calculation in submitSectionAttempt | CODE | ✅ DONE |
| 011 | Rich seed data (5 users, 30 questions, 4 tests) | SEED | ✅ DONE |
| 012 | student-actions.ts (6 server actions) | CODE | ✅ DONE |
| 013 | REST API routes for frontend integration | CODE | ✅ DONE |

---

## Change History (Detail)

---

### Change #001 — CheatingLog Model [DONE]

**Type:** SCHEMA
**Applied by:** Mayank (2026-05-17)
**Why:** `logCheatingEvent()` called `prisma.cheatingLog.create()` but the model didn't exist — would crash at runtime.

Added to `prisma/schema.prisma`:
```prisma
model CheatingLog {
  id        String   @id @default(uuid())
  attemptId String
  eventType String
  metadata  Json?
  createdAt DateTime @default(now())

  attempt TestAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
}
```
Also added `cheatingLogs CheatingLog[]` to the `TestAttempt` model.

---

### Change #002 — Fix Broken Import in prisma.ts [DONE]

**Type:** CODE
**Applied by:** Mayank (2026-05-17)
**Why:** `src/lib/prisma.ts` had `import { PrismaPg } from '@supabase/prisma-adapter-pg'` — package doesn't exist, fails at build time.

**Fix:** Changed to `import { PrismaPg } from '@prisma/adapter-pg'`

---

### Change #003 — Fix logCheatingEvent Field Name [DONE]

**Type:** CODE
**Applied by:** Mayank (2026-05-17)
**Why:** Was passing `timestamp: new Date()` but the schema auto-sets `createdAt`. Removed the manual field.

**File:** `src/actions/test-engine-actions.ts`

---

### Change #004 — Rename middleware.ts → proxy.ts [DONE]

**Type:** CONFIG
**Applied by:** Mayank (2026-05-17)
**Why:** Next.js 16 requires the file to be named `proxy.ts` with the function named `proxy`.

---

### Change #005 — Add DIRECT_URL for Migrations [DONE]

**Type:** ENV + CONFIG
**Applied by:** Mayank (2026-05-17)
**Why:** Supabase's transaction pooler (port 6543) blocks advisory locks. `prisma db push` must use the direct connection (port 5432).

Added `DIRECT_URL` to `.env` and updated `prisma.config.ts` to use it.

---

### Change #006 — Fix Dev/Build Scripts (webpack flag) [DONE]

**Type:** CONFIG
**Applied by:** Mayank (2026-05-17)
**Why:** Turbopack ARM64 binary has an invalid code signature on this Mac.

`package.json` scripts now use `--webpack`:
```json
"dev": "next dev --webpack",
"build": "next build --webpack"
```

---

### Change #008 — Score Calculation [SUPERSEDED by #010]

Replaced by Change #010 which has the full implementation including `marksPositive`/`marksNegative`. Skip this one.

---

### Change #009 — Seed More Test Data [SUPERSEDED by #011]

Replaced by Change #011 which has the complete rich seed. Skip this one.

---

### Change #010 — Full Score Calculation on Section Submit [DONE]

**Type:** CODE
**Applied by:** Mayank (2026-05-17)
**Why:** After all sections complete, the action now computes `totalScore` using `marksPositive`/`marksNegative` per question, sets `status = SUBMITTED`, and saves `completedAt`.

**File:** `src/actions/test-engine-actions.ts` — the scoring block at the end of `submitSectionAttempt`.

---

### Change #011 — Rich Seed Data [DONE]

**Type:** SEED
**Applied by:** Mayank (2026-05-17)
**Seeded to Supabase:** 5 users · 14 topics · 30 questions · 4 tests · 3 attempts · 60 answers · 2 cheat logs

To re-seed if needed:
```bash
cd platform
node -r ts-node/register prisma/seed.ts
```

---

### Change #012 — student-actions.ts [DONE]

**Type:** CODE
**Applied by:** Mayank (2026-05-17)
**Why:** No server actions existed for student-facing operations.

**New file:** `src/actions/student-actions.ts`
- `startTestAttempt(testId, studentId)` — creates attempt, prevents duplicates
- `getTestDetails(testId)` — full test with ordered sections + questions
- `getStudentAttempts(studentId)` — all attempts with test info and scores
- `getTimerRemaining(attemptId, sectionId)` — reads Redis, returns seconds left
- `getAttemptResults(attemptId)` — full attempt with answers + cheating logs
- `getAvailableTests(studentId)` — published tests with attempt status overlay

---

### Change #013 — REST API Routes for Frontend Integration [DONE]

**Type:** CODE + CONFIG
**Applied by:** Mayank (2026-05-17)
**Why:** The React frontend (Vite SPA) cannot call Next.js Server Actions directly. These routes expose all operations as HTTP endpoints.

**Routes created under `src/app/api/`:**

| Route | Method | Purpose |
|---|---|---|
| `/api/tests` | GET | All published tests |
| `/api/tests/available?studentId=X` | GET | Tests with attempt status overlay |
| `/api/tests/:testId` | GET | Full test + sections + questions |
| `/api/attempts` | POST | Start or resume a test attempt |
| `/api/attempts/:id` | GET | Full attempt results + answers + cheat logs |
| `/api/attempts/:id/autosave` | POST | Save answer to Redis |
| `/api/attempts/:id/cheat-log` | POST | Log tab switch / fullscreen exit |
| `/api/attempts/:id/sections/:sectionId/start` | POST | Start section + set Redis timer |
| `/api/attempts/:id/sections/:sectionId/timer` | GET | Remaining seconds from Redis |
| `/api/attempts/:id/sections/:sectionId/submit` | POST | Flush Redis → Postgres + score |
| `/api/students/:studentId/attempts` | GET | All attempts for a student |

**CORS:** Configured in `next.config.ts` (static headers) and `src/proxy.ts` (OPTIONS preflight). All `/api/*` routes are open — no session auth required. To restrict to your Vercel frontend:
```
CORS_ORIGIN="https://your-frontend.vercel.app"
```

---

## Template for New Changes

```
### Change #XXX — Title [PENDING]

**Type:** SCHEMA / REDIS / ENV / SEED / CONFIG / CODE
**Requested by:** Mayank / Sunanda
**Why:** (reason — what breaks without this)

**What to do:**
(exact code or commands)

**Test it by:**
(how to verify it worked)
```
