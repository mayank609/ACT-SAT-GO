# Backend Changes — for Sunanda

Frontend changes are already merged and call these endpoints. They will no-op
gracefully until the backend pieces below are in place.

> ⚠️ Per `platform/AGENTS.md`, this Next.js version has breaking changes — read
> the relevant guide in `node_modules/next/dist/docs/` before writing route code.

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
