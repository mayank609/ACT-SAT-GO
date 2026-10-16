import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ensureArticleTables } from '@/lib/articleTables'
import { canManage, json } from '@/lib/studentSharing'
import { MAX_COPIED_RATIO, parseArticleInput, readingMinutes } from '@/lib/articles'
import {
  AUTO_RETRY_LIMIT, type AiFeedback, latestSubmission, needsRetry, parseSubmissions, publicFeedback, retryPendingFeedback,
} from '@/lib/articleFeedback'

// GET    /api/articles/:articleId — the article (+ every student's summary for managers,
//                                   + the student's own assignment for students).
//                                   Pending AI feedback is retried here (a few per load).
// PUT    /api/articles/:articleId — edit the article (manager only)
// DELETE /api/articles/:articleId — delete it and all summaries (manager only)

type Ctx = { params: Promise<{ articleId: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const { articleId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureArticleTables()

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: {
        id: true, title: true, topic: true, subject: true, body: true, sourceUrl: true, instructions: true, minSummaryWords: true,
        createdAt: true, updatedAt: true, createdById: true,
        createdBy: { select: { name: true } },
      },
    })
    if (!article) return json({ error: 'Article not found' }, 404)
    const base = {
      ...article,
      createdBy: undefined,
      createdByName: article.createdBy?.name ?? '',
      readMinutes: readingMinutes(article.body),
      maxCopiedRatio: MAX_COPIED_RATIO,
    }

    if (canManage(user, article)) {
      const assignments = await prisma.articleAssignment.findMany({
        where: { articleId },
        orderBy: { assignedAt: 'asc' },
        select: {
          id: true, studentId: true, status: true, assignedAt: true, dueAt: true, openedAt: true, summary: true,
          summaryWordCount: true, copiedRatio: true, submittedAt: true, submissionCount: true,
          feedback: true, reviewedAt: true, submissions: true,
          student: { select: { name: true, email: true } },
          reviewedBy: { select: { name: true } },
        },
      })
      // Retry a few pending AI feedbacks (latest submission only) before answering.
      const retried = new Map<string, AiFeedback | null>()
      const pending = assignments.filter((a) => needsRetry(a)).slice(0, AUTO_RETRY_LIMIT)
      await Promise.all(pending.map(async (a) => {
        retried.set(a.id, await retryPendingFeedback(a.id).catch(() => null))
      }))
      return json({
        article: {
          ...base,
          canEdit: true,
          assignments: assignments.map((a) => ({
            studentId: a.studentId,
            studentName: a.student?.name || a.student?.email || 'Student',
            status: a.status,
            assignedAt: a.assignedAt,
            dueAt: a.dueAt,
            openedAt: a.openedAt,
            // Drafts are the student's own until they submit.
            summary: a.submittedAt ? a.summary : null,
            summaryWordCount: a.submittedAt ? a.summaryWordCount : 0,
            copiedRatio: a.submittedAt ? a.copiedRatio : null,
            submittedAt: a.submittedAt,
            submissionCount: a.submissionCount,
            feedback: a.feedback,
            reviewedAt: a.reviewedAt,
            reviewedByName: a.reviewedBy?.name ?? null,
            ...aiFields(a.submissions, retried.get(a.id), true),
          })),
        },
      })
    }

    if (user.role !== 'STUDENT') return json({ error: 'Forbidden' }, 403)
    const mine = await prisma.articleAssignment.findUnique({
      where: { articleId_studentId: { articleId, studentId: user.id } },
      select: {
        id: true, status: true, assignedAt: true, dueAt: true, openedAt: true, summary: true, summaryWordCount: true,
        submittedAt: true, submissionCount: true, feedback: true, reviewedAt: true, submissions: true,
        reviewedBy: { select: { name: true } },
      },
    })
    if (!mine) return json({ error: 'This article has not been assigned to you' }, 403)
    if (!mine.openedAt) {
      await prisma.articleAssignment.update({ where: { id: mine.id }, data: { openedAt: new Date() }, select: { id: true } })
    }
    const myRetry = needsRetry(mine)
      ? await retryPendingFeedback(mine.id).catch(() => null)
      : undefined
    return json({
      article: {
        ...base,
        canEdit: false,
        assignment: {
          status: mine.status,
          assignedAt: mine.assignedAt,
          dueAt: mine.dueAt,
          openedAt: mine.openedAt ?? new Date(),
          summary: mine.summary,
          summaryWordCount: mine.summaryWordCount,
          submittedAt: mine.submittedAt,
          submissionCount: mine.submissionCount,
          feedback: mine.feedback,
          reviewedAt: mine.reviewedAt,
          reviewedByName: mine.reviewedBy?.name ?? null,
          ...aiFields(mine.submissions, myRetry, false),
        },
      },
    })
  } catch (err) {
    console.error('GET /api/articles/[articleId]:', err)
    return json({ error: 'Failed to load the article' }, 500)
  }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const { articleId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureArticleTables()
    const article = await prisma.article.findUnique({ where: { id: articleId }, select: { createdById: true } })
    if (!article) return json({ error: 'Article not found' }, 404)
    if (!canManage(user, article)) return json({ error: 'You can only edit your own articles' }, 403)

    const parsed = parseArticleInput(await request.json().catch(() => null))
    if ('error' in parsed) return json({ error: parsed.error }, 400)
    await prisma.article.update({ where: { id: articleId }, data: parsed.value, select: { id: true } })
    return json({ id: articleId })
  } catch (err) {
    console.error('PUT /api/articles/[articleId]:', err)
    return json({ error: 'Failed to save the article' }, 500)
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { articleId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureArticleTables()
    const article = await prisma.article.findUnique({ where: { id: articleId }, select: { createdById: true } })
    if (!article) return json({ error: 'Article not found' }, 404)
    if (!canManage(user, article)) return json({ error: 'You can only delete your own articles' }, 403)
    await prisma.article.delete({ where: { id: articleId }, select: { id: true } })
    return json({ success: true })
  } catch (err) {
    console.error('DELETE /api/articles/[articleId]:', err)
    return json({ error: 'Failed to delete the article' }, 500)
  }
}

/**
 * The AI feedback on the latest submission plus the submission history
 * (newest first). `fresh` is the result of a retry made during this request.
 */
function aiFields(raw: unknown, fresh: AiFeedback | null | undefined, forManager: boolean) {
  const subs = parseSubmissions(raw)
  const last = latestSubmission(subs)
  if (last && fresh) last.ai = fresh
  return {
    aiFeedback: publicFeedback(last?.ai, forManager),
    submissions: subs
      .slice()
      .reverse()
      .map((s) => ({ ...s, ai: publicFeedback(s.ai, forManager) })),
  }
}
