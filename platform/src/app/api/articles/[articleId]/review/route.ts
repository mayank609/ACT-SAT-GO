import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ensureArticleTables } from '@/lib/articleTables'
import { canManage, json, notifyUsers } from '@/lib/studentSharing'
import { LIMITS, STATUS } from '@/lib/articles'

// PUT /api/articles/:articleId/review  { studentId, decision: 'approve' | 'revise', feedback? }
// The article's author (or an admin) approves a submitted summary or sends it
// back for revision. Asking for a revision requires feedback.

export async function PUT(request: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureArticleTables()
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, title: true, createdById: true },
    })
    if (!article) return json({ error: 'Article not found' }, 404)
    if (!canManage(user, article)) return json({ error: 'You can only review summaries for your own articles' }, 403)

    const body = (await request.json().catch(() => null)) as { studentId?: unknown; decision?: unknown; feedback?: unknown } | null
    const studentId = typeof body?.studentId === 'string' ? body.studentId : ''
    const decision = body?.decision
    const feedback = typeof body?.feedback === 'string' ? body.feedback.trim() : ''
    if (!studentId) return json({ error: 'studentId is required' }, 400)
    if (decision !== 'approve' && decision !== 'revise') return json({ error: "decision must be 'approve' or 'revise'" }, 400)
    if (decision === 'revise' && !feedback) return json({ error: 'Tell the student what to improve' }, 400)
    if (feedback.length > LIMITS.feedback) return json({ error: `Feedback must be at most ${LIMITS.feedback} characters` }, 400)

    const assignment = await prisma.articleAssignment.findUnique({
      where: { articleId_studentId: { articleId, studentId } },
      select: { id: true, status: true },
    })
    if (!assignment) return json({ error: 'This student is not assigned to the article' }, 404)
    if (assignment.status !== STATUS.SUBMITTED) return json({ error: 'There is no submitted summary waiting for review' }, 409)

    const status = decision === 'approve' ? STATUS.APPROVED : STATUS.NEEDS_REVISION
    await prisma.articleAssignment.update({
      where: { id: assignment.id },
      data: { status, feedback: feedback || null, reviewedAt: new Date(), reviewedById: user.id },
    })
    await notifyUsers([studentId], decision === 'approve'
      ? {
          title: 'Summary approved',
          body: `${user.name || 'Your tutor'} approved your summary of "${article.title}".${feedback ? ` "${feedback.slice(0, 140)}"` : ''}`,
          link: `/articles/${article.id}`,
        }
      : {
          title: 'Summary needs changes',
          body: `${user.name || 'Your tutor'} asked you to revise your summary of "${article.title}".`,
          link: `/articles/${article.id}`,
        })
    return json({ status })
  } catch (err) {
    console.error('PUT /api/articles/[articleId]/review:', err)
    return json({ error: 'Failed to save the review' }, 500)
  }
}
