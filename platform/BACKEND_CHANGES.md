# Backend Changes Log

This file is the single source of truth for all backend changes.
**Mayank** reviews and adds entries. **Sunanda** applies them and marks `[DONE]`.

Format for each entry:
- Status: `[PENDING]` → needs to be applied | `[DONE]` → applied | `[SUPERSEDED]` → replaced by a later change, skip it
- Type: `SCHEMA` | `REDIS` | `ENV` | `SEED` | `CONFIG` | `CODE`

---

## Pending Changes

### Change #011 — Extend PATCH /api/tests/[testId] to support full sections+questions update [DONE]

**Type:** CODE
**Requested by:** Mayank
**Why:** Admin panel now supports editing a saved draft — the Test Builder loads the existing test and lets the admin add/edit questions. On save it calls `PATCH /api/tests/[testId]` with full sections payload. Current PATCH only handles title/description/status; this change adds section replacement so the edit saves correctly.

**File to edit:** `src/app/api/tests/[testId]/route.ts`

**What to do:** In the PATCH handler, after updating title/description/status, check if `body.sections` is present. If so, delete all existing TestSections for this test (cascade deletes TestQuestion join rows automatically), then recreate sections and questions exactly like the POST handler does.

**Exact change — replace the entire `PATCH` export with this:**

```typescript
// ── PATCH ─────────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'> = {
  draft: 'DRAFT',
  published: 'PUBLISHED',
  archived: 'ARCHIVED',
}

type FrontendType = 'mcq_single' | 'mcq_multi' | 'numeric'
type FrontendDifficulty = 'easy' | 'medium' | 'hard'

const TYPE_MAP: Record<FrontendType, 'MCQ' | 'MSQ' | 'NUMERIC'> = {
  mcq_single: 'MCQ',
  mcq_multi: 'MSQ',
  numeric: 'NUMERIC',
}

const DIFF_MAP: Record<FrontendDifficulty, 'EASY' | 'MEDIUM' | 'HARD'> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
}

function transformOptions(options: Array<{ id: string; text: string }>): Prisma.InputJsonValue {
  const result: Record<string, string> = {}
  for (const opt of options) result[opt.id.toUpperCase()] = opt.text
  return result as Prisma.InputJsonValue
}

function transformCorrectAnswer(answer: string | string[] | number): Prisma.InputJsonValue {
  if (typeof answer === 'number') return { value: answer } as Prisma.InputJsonValue
  if (Array.isArray(answer)) return { keys: answer.map((k) => k.toUpperCase()) } as Prisma.InputJsonValue
  return { key: answer.toUpperCase() } as Prisma.InputJsonValue
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params

  let body: {
    status?: string
    title?: string
    description?: string
    sections?: Array<{
      name: string
      timeLimit: number
      questions: Array<{
        text: string
        type: FrontendType
        options?: Array<{ id: string; text: string }>
        correctAnswer: string | string[] | number
        topic?: string
        difficulty: FrontendDifficulty
        explanation?: string
        marks?: number
        marksNegative?: number
      }>
    }>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    // ── 1. Update scalar fields ────────────────────────────────────────────────
    const scalarData: { status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; title?: string; description?: string } = {}
    if (body.title !== undefined) scalarData.title = body.title
    if (body.description !== undefined) scalarData.description = body.description
    if (body.status !== undefined) {
      const mapped = STATUS_MAP[body.status.toLowerCase()]
      if (!mapped) return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
      scalarData.status = mapped
    }

    if (!body.sections && Object.keys(scalarData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    if (!body.sections) {
      // Simple scalar-only update (status/title/description)
      const test = await prisma.test.update({
        where: { id: testId },
        data: scalarData,
        include: {
          sections: {
            orderBy: { orderIndex: 'asc' },
            include: { _count: { select: { questions: true } } },
          },
          _count: { select: { attempts: true } },
        },
      })
      return NextResponse.json({ test })
    }

    // ── 2. Full sections+questions replacement ────────────────────────────────
    const allTopics = await prisma.topic.findMany({ select: { id: true, name: true } })
    const topicMap = new Map(allTopics.map((t) => [t.name.toLowerCase(), t.id]))

    const test = await prisma.$transaction(async (tx) => {
      // Update scalar fields
      if (Object.keys(scalarData).length > 0) {
        await tx.test.update({ where: { id: testId }, data: scalarData })
      }

      // Delete all existing sections (cascades to TestQuestion join rows)
      await tx.testSection.deleteMany({ where: { testId } })

      // Recreate sections and questions
      for (let sIdx = 0; sIdx < body.sections!.length; sIdx++) {
        const sec = body.sections![sIdx]
        const newSection = await tx.testSection.create({
          data: { testId, name: sec.name, durationMinutes: sec.timeLimit, orderIndex: sIdx },
        })

        for (let qIdx = 0; qIdx < sec.questions.length; qIdx++) {
          const q = sec.questions[qIdx]
          const dbType = TYPE_MAP[q.type]
          if (!dbType) throw new Error(`Invalid question type: ${q.type}`)
          const dbDiff = DIFF_MAP[q.difficulty]
          if (!dbDiff) throw new Error(`Invalid difficulty: ${q.difficulty}`)
          const topicId = q.topic ? (topicMap.get(q.topic.toLowerCase()) ?? null) : null

          const newQuestion = await tx.question.create({
            data: {
              type: dbType,
              content: { text: q.text, explanation: q.explanation ?? null } as Prisma.InputJsonValue,
              options: q.options ? transformOptions(q.options) : Prisma.DbNull,
              correctAnswer: transformCorrectAnswer(q.correctAnswer),
              difficultyLevel: dbDiff,
              topicId,
            },
          })

          await tx.testQuestion.create({
            data: {
              testId,
              sectionId: newSection.id,
              questionId: newQuestion.id,
              orderIndex: qIdx,
              marksPositive: q.marks ?? 1,
              marksNegative: q.marksNegative ?? 0,
            },
          })
        }
      }

      return tx.test.findUnique({
        where: { id: testId },
        include: {
          sections: {
            orderBy: { orderIndex: 'asc' },
            include: { _count: { select: { questions: true } } },
          },
          _count: { select: { attempts: true } },
        },
      })
    })

    return NextResponse.json({ test })
  } catch (error) {
    console.error('PATCH /api/tests/[testId]:', error)
    return NextResponse.json({ error: 'Failed to update test' }, { status: 500 })
  }
}
```

Also add `import { Prisma } from '@prisma/client'` at the top of the file (it's already imported in `route.ts` at `/api/tests/route.ts` but not in the `[testId]/route.ts` file).

**Test it by:**
- Open the admin panel → Tests → click Edit (pencil icon) on any draft
- Verify the builder loads with existing title, sections, and questions
- Add a new question → click Update
- Go back to Tests list → the draft should show the updated question count

---

### Change #010 — Clean database for client handoff [PENDING]

**Type:** SEED
**Requested by:** Mayank
**Why:** Client wants a blank slate to enter their own questions. All dev/demo data (sample tests, questions, students, tutors, attempts) should be removed. Admin account must survive so client can log in.

**What to run (one command, from `platform/` directory):**
```bash
npm run db:reset
```

**What it does:**
- Deletes: CheatingLogs, AttemptAnswers, SectionAttempts, TestAttempts, TestQuestions, TestSections, Tests, Questions, Topics, TutorAssignments, all STUDENT and TUTOR users
- Keeps: all ADMIN and SUPER_ADMIN user accounts (so client can log in)
- Safety: if zero admins remain after wipe, creates `admin@actsat.com` as fallback

**After running, client logs in as admin and:**
1. Creates questions via Test Builder (manual entry, CSV, image OCR, or PDF import)
2. Adds their own tutors and students via the admin panel
3. Publishes tests

**Do NOT run `npm run db:seed` after this** — that will repopulate with demo data.

---

### Change #009 — Deployment: Render (backend) + Vercel (frontend) [PENDING]

**Type:** ENV + CONFIG
**Requested by:** Mayank
**Why:** Client demo — deploying backend to Render, frontend to Vercel.

**What Sunanda needs to do on Render:**

Set these environment variables in Render dashboard → act-sat-platform → Environment:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Supabase pooler URL — Settings → Database → Connection string (Transaction mode, port 6543) |
| `DIRECT_URL` | Supabase direct URL — same page, port 5432 (needed for Prisma migrations) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `UPSTASH_REDIS_REST_URL` | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST token |
| `CORS_ORIGIN` | Set AFTER Vercel deploys frontend — paste the Vercel URL (e.g. `https://act-sat-go.vercel.app`) |
| `NODE_ENV` | `production` |

**Deploy order:**
1. Deploy backend to Render first → copy the Render URL (e.g. `https://act-sat-platform.onrender.com`)
2. Deploy frontend to Vercel → set `VITE_API_URL` = the Render URL above
3. Copy the Vercel URL → go back to Render → set `CORS_ORIGIN` = the Vercel URL
4. Trigger a redeploy on Render (Manual Deploy) so CORS_ORIGIN takes effect

**Test it by:**
- `GET https://act-sat-platform.onrender.com/api/health` → should return `{ "status": "ok" }`
- Open the Vercel frontend URL → should load the login page with no CORS errors

---

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

### Change #014 — Defensive null/NaN guard in transformCorrectAnswer [DONE]

**Type:** CODE
**Requested by:** Mayank
**Why:** When a NUMERIC question's answer field is left empty, the frontend serialises `NaN` as JSON `null`. The backend `transformCorrectAnswer` function doesn't handle `null`/`undefined`, falls through to `null.toUpperCase()`, and throws a TypeError → 500 on PATCH /api/tests/[testId].

**File to edit:** `src/app/api/tests/[testId]/route.ts`

**Replace** the existing `transformCorrectAnswer` function:

```ts
function transformCorrectAnswer(answer: string | string[] | number): Prisma.InputJsonValue {
  if (typeof answer === 'number') return { value: answer } as Prisma.InputJsonValue
  if (Array.isArray(answer)) return { keys: answer.map((k) => k.toUpperCase()) } as Prisma.InputJsonValue
  return { key: answer.toUpperCase() } as Prisma.InputJsonValue
}
```

**With:**

```ts
function transformCorrectAnswer(answer: string | string[] | number | null | undefined): Prisma.InputJsonValue {
  if (answer === null || answer === undefined) return { key: 'A' } as Prisma.InputJsonValue
  if (typeof answer === 'number') {
    return { value: isNaN(answer) ? 0 : answer } as Prisma.InputJsonValue
  }
  if (Array.isArray(answer)) {
    const keys = answer.filter(Boolean).map((k) => k.toUpperCase())
    return { keys: keys.length ? keys : ['A'] } as Prisma.InputJsonValue
  }
  return { key: (answer || 'A').toUpperCase() } as Prisma.InputJsonValue
}
```

**Test it by:**
1. Create a test with a NUMERIC question and leave the answer blank
2. Click Save/Update — should succeed (no 500)
3. Verify the question is saved with `correctAnswer: { value: 0 }` in the DB

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
