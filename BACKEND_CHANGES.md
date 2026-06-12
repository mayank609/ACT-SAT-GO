# Backend Changes — for Sunanda

Frontend changes are already merged and call these endpoints. They will no-op
gracefully until the backend pieces below are in place.

> ⚠️ Per `platform/AGENTS.md`, this Next.js version has breaking changes — read
> the relevant guide in `node_modules/next/dist/docs/` before writing route code.

---

## 2026-06-12 — Stability fixes for shipping (already implemented)

1. **Test save timeout fixed** (`PATCH /api/tests/[testId]`): the save ran 4-5
   sequential queries *per question* inside one interactive transaction → 30s
   timeout on ~100-question tests (the "Transaction API error" in Test Builder).
   Rewritten to precompute all rows + one batched `$transaction([...])` pipeline
   with `createMany`. Same semantics (question UUID reuse, passage children,
   stale-child cleanup) — ~10x fewer round-trips.
2. **Test create timeout fixed** (`POST /api/tests`): same pattern, worse — it
   used Prisma's default 5s interactive timeout, so creating a large test from
   a PDF import always failed. Same batched rewrite.
3. **Question-count inflation repaired**: "Diagnostic Test 1" had 55 stale
   `TestQuestion` rows pointing at passage *child* questions (old bug's data),
   so students saw 154 questions instead of 99. Deleted those rows (children
   are served via their parent's `childQuestions` relation). Verified 0 remain.
   Current create/save code no longer produces such rows.
4. **SAT module scoring bug fixed** (submit route): section names like
   "Section 1 : RW (Module 2)" matched `includes('1')` and were counted as
   Module 1, skewing the scaled-score curve. Now matches explicit "Module N"
   first.
5. **Removed `src/middleware.ts`** (one-line re-export of proxy) — Next 16
   errors when both `middleware.ts` and `proxy.ts` exist; `proxy.ts` is the
   convention.
6. Frontend: PDF re-import into a same-named section now skips questions whose
   text already exists (prevents duplicates from repeated imports).

Note: there are ~3,500 orphaned questions in the bank (no test, no parent) from
old save churn. Harmless but clutters the Question Bank — worth a cleanup pass
someday; left untouched because bank questions can legitimately be testless.

---

## 2026-06-11 — Real authentication (Supabase) + API protection

The frontend now performs **real Supabase Auth login** and sends
`Authorization: Bearer <jwt>` on every API call. The API is no longer open.

### What changed (already implemented, both repos)

**Frontend**
- `frontend/src/lib/supabase.ts` — new browser Supabase client.
- `frontend/.env` — added `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  (public values, copied from the backend's `NEXT_PUBLIC_SUPABASE_*`).
- `frontend/src/lib/api.ts` — attaches the Supabase access token as a Bearer
  header on all requests (incl. image upload/delete).
- `frontend/src/store/useAuthStore.ts` — session-backed; `initAuth()` reconciles
  the persisted user with the real Supabase session on load; real `logout()`.
- `LoginPage` — real `signInWithPassword`; **removed** the pre-auth user listing
  and one-click "demo login" (those leaked every user's email to anonymous
  visitors and bypassed auth).
- `App.tsx` — calls `initAuth()` on mount and shows a loader until the session
  check completes (prevents a flash of protected content).

**Backend**
- `platform/src/proxy.ts` — now **verifies the Supabase JWT for every `/api/`
  request** (except `/api/health`). Anonymous/invalid → 401. On success it
  forwards a trusted `x-user-id` header (and strips any client-supplied one).
- `platform/src/lib/auth.ts` — new helpers `getCurrentUser`, `requireRole`,
  `requireUser` for route-level authorization (read `x-user-id`, load DB user).
- Role gates applied to: `POST /api/users`, `DELETE/PATCH /api/users/[userId]`
  (PATCH = self-or-admin), `GET/POST /api/permissions`, `POST/DELETE
  /api/tutor-assignments`, `GET /api/analytics/platform`.

### ⚠️ Deployment / env actions for you (Sunanda)

1. **Hosted frontend env:** set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   in the frontend host (Vercel/Netlify/etc.) — same public values as the
   backend's `NEXT_PUBLIC_SUPABASE_*`. (Already in local `frontend/.env`.)
2. **`CORS_ORIGIN`:** set it on the backend to the SPA's exact origin instead of
   the `*` default (we use bearer tokens, not cookies, so this is hardening, not
   strictly required). Note `next.config.js` sends `Allow-Credentials: true`
   with the origin — fine for bearer auth; if you ever switch to cookie auth,
   `*` + credentials is invalid and must be a concrete origin.
3. **Temp passwords:** `POST /api/users` creates the Supabase account with a
   generated temp password (`email_confirm: true`). Confirm that password is
   surfaced to the admin (or an invite/reset email is sent) so invited users can
   actually log in. Password reset was intentionally out of scope this pass.
4. **Server-to-server callers** (seed scripts, cron, health pingers other than
   `/api/health`) must now send a valid bearer token, or be added to
   `PUBLIC_API_PREFIXES` in `proxy.ts`.

### Bootstrap admin (done)

Because real auth replaced the fake login, the seed users (DB-only, no Supabase
account) can no longer log in. Added `platform/scripts/create-admin.ts` which
provisions a Supabase Auth account + matching DB row (id = auth id). Already run
once to create a default **SUPER_ADMIN**: `admin@actsat.com` / `Admin@12345`
(please change this). The seed's old `admin@actsat.com` DB row was renamed to
`legacy+721a8d04_admin@actsat.com` (non-destructive). Run with Node 22:
`PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" npx tsx scripts/create-admin.ts [email] [password] [name]`.

### Recommended follow-ups (not done — your call)

- **Finish role gates** on the remaining write endpoints: `POST/PATCH/DELETE`
  on `tests`, `tests/[testId]`, `questions`, `test-assignments`, `notes`
  (staff-only), and `GET /api/users` (list — staff-only; currently any
  authenticated user).
- **Ownership checks** (a student can only read their own data) on
  `attempts/[attemptId]`, `students/[studentId]/*`, `analytics/student/[studentId]`.
  The proxy guarantees *authentication*; these need per-resource *authorization*.
- **Perf:** the proxy calls `supabase.auth.getUser()` (network) per request. To
  cut that latency, verify the JWT locally with `SUPABASE_JWT_SECRET` + `jose`
  (needs the dep + env var). Matters most for test autosave traffic.
- **SSE:** `notifications/stream` is now behind the auth gate; `EventSource`
  can't send a bearer header. The frontend doesn't use it today — switch to a
  fetch-based stream or a query-param token if you wire it up.

---

## 2026-06-10 — "My Doubts" feature (test review)

**What the student sees:** On the test-review page, each question's *Explanation*
panel now has two CTAs — **Still Doubt** and **Cleared**. Marking *Still Doubt*
adds the question to a new **My Doubts** page (sidebar). *Cleared* removes it.
This is post-submission review, so the status must persist **durably in Postgres**
(the Redis autosave cache has a 4h TTL and is gone by review time).

### 1. Schema — add `doubtStatus` to `AttemptAnswer`

`platform/prisma/schema.prisma`, model `AttemptAnswer` (around line 205):

```prisma
model AttemptAnswer {
  id                 String   @id @default(uuid())
  attemptId          String
  questionId         String
  answerGiven        Json?
  timeSpentSeconds   Int      @default(0)
  isFlagged          Boolean  @default(false)
  doubtStatus        String?  // 'doubt' | 'cleared' | null   ← ADD THIS
  updatedAt          DateTime @updatedAt

  attempt  TestAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question Question    @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([attemptId, questionId])
}
```

Then run the migration (Supabase/Postgres):
```
npx prisma migrate dev --name add_doubt_status
```

### 2. New route — `POST /api/attempts/[attemptId]/doubt`

Create `platform/src/app/api/attempts/[attemptId]/doubt/route.ts`.
Body: `{ questionId: string, doubtStatus: 'doubt' | 'cleared' | null }`.
Upsert the `AttemptAnswer` row and set `doubtStatus` (DB, not Redis):

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma' // match the project's existing prisma import

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params
  try {
    const { questionId, doubtStatus } = await request.json() as {
      questionId?: string
      doubtStatus?: 'doubt' | 'cleared' | null
    }
    if (!questionId) {
      return NextResponse.json({ error: 'questionId required' }, { status: 400 })
    }
    if (doubtStatus !== 'doubt' && doubtStatus !== 'cleared' && doubtStatus !== null) {
      return NextResponse.json({ error: 'invalid doubtStatus' }, { status: 400 })
    }

    await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { doubtStatus },
      create: { attemptId, questionId, doubtStatus },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/attempts/[attemptId]/doubt:', error)
    return NextResponse.json({ error: 'Failed to set doubt status' }, { status: 500 })
  }
}
```

> Note: an `AttemptAnswer` row may not exist yet for a skipped question, so use
> `upsert` (not `update`). The `@@unique([attemptId, questionId])` makes the
> compound `where` key `attemptId_questionId` available.

### 3. `GET /api/attempts/[attemptId]` — no change needed

That route already does `answers: { include: { question: true } }`, and Prisma
returns all scalar fields by default, so `doubtStatus` flows through automatically
once the column exists. The **My Doubts** page reads doubts by calling
`getStudentAttempts` → `getAttempt` and filtering `answer.doubtStatus === 'doubt'`
— same pattern as the Review Mistakes page. No new "list doubts" endpoint required.

---

### Frontend touch-points (already done — for reference)
- `frontend/src/lib/api.ts` — `setDoubtStatus(attemptId, questionId, status)` → `POST /api/attempts/:id/doubt`
- `frontend/src/pages/student/TestReviewPage.tsx` — removed *Analyze* button; added *Still Doubt* / *Cleared* CTAs
- `frontend/src/pages/student/DoubtsPage.tsx` — new **My Doubts** page
- `frontend/src/App.tsx` — route `/doubts`
- `frontend/src/components/layout/Sidebar.tsx` — nav item "My Doubts"
