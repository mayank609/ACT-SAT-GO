import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ensureArticleTables } from '@/lib/articleTables'
import { canManage, json } from '@/lib/studentSharing'
import { publicFeedback, retryPendingFeedback } from '@/lib/articleFeedback'

// POST /api/articles/:articleId/feedback  { studentId? }
// "Get feedback": asks Claude again for the latest submission's feedback if it
// is still pending. Students act on their own summary; the article's author
// (or an admin) passes the studentId.

export async function POST(request: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureArticleTables()
    const article = await prisma.article.findUnique({ where: { id: articleId }, select: { createdById: true } })
    if (!article) return json({ error: 'Article not found' }, 404)

    const body = (await request.json().catch(() => null)) as { studentId?: unknown } | null
    const manager = canManage(user, article)
    let studentId = user.id
    if (user.role !== 'STUDENT') {
      if (!manager) return json({ error: 'You can only request feedback for your own articles' }, 403)
      if (typeof body?.studentId !== 'string' || !body.studentId) return json({ error: 'studentId is required' }, 400)
      studentId = body.studentId
    }
    const assignment = await prisma.articleAssignment.findUnique({
      where: { articleId_studentId: { articleId, studentId } },
      select: { id: true, submittedAt: true },
    })
    if (!assignment) {
      return json({ error: user.role === 'STUDENT' ? 'This article has not been assigned to you' : 'This student is not assigned to the article' }, user.role === 'STUDENT' ? 403 : 404)
    }
    if (!assignment.submittedAt) return json({ error: 'There is no submitted summary yet' }, 409)

    const ai = await retryPendingFeedback(assignment.id, true)
    return json({ aiFeedback: publicFeedback(ai, manager && user.role !== 'STUDENT') })
  } catch (err) {
    console.error('POST /api/articles/[articleId]/feedback:', err)
    return json({ error: 'Failed to get feedback' }, 500)
  }
}
