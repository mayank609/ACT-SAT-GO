import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ensureArticleTables } from '@/lib/articleTables'
import { allowedStudentIds, canManage, json, notifyUsers } from '@/lib/studentSharing'
import { parseDueAt } from '@/lib/articles'

// PUT /api/articles/:articleId/assignments  { studentIds: string[], dueAt?: string | null }
// Sets exactly who must read the article. Newly added students are notified;
// removed students lose the article and their summary. When dueAt is sent it
// applies to every assignment (null clears it). Tutors can only assign their
// own students and can't remove assignments an admin made for other students.

export async function PUT(request: NextRequest, { params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureArticleTables()
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, title: true, minSummaryWords: true, createdById: true },
    })
    if (!article) return json({ error: 'Article not found' }, 404)
    if (!canManage(user, article)) return json({ error: 'You can only assign your own articles' }, 403)

    const body = (await request.json().catch(() => null)) as { studentIds?: unknown; dueAt?: unknown } | null
    if (!Array.isArray(body?.studentIds)) return json({ error: 'studentIds[] is required' }, 400)
    const due = parseDueAt(body!.dueAt)
    if ('error' in due) return json({ error: due.error }, 400)
    const wanted = await allowedStudentIds(user, body!.studentIds)

    const current = await prisma.articleAssignment.findMany({ where: { articleId }, select: { studentId: true } })
    const currentIds = new Set(current.map((s) => s.studentId))
    const wantedIds = new Set(wanted)
    const added = wanted.filter((id) => !currentIds.has(id))
    const manageable = new Set(await allowedStudentIds(user, [...currentIds]))
    const removed = [...currentIds].filter((id) => !wantedIds.has(id) && manageable.has(id))

    await prisma.$transaction([
      ...(removed.length ? [prisma.articleAssignment.deleteMany({ where: { articleId, studentId: { in: removed } } })] : []),
      ...(added.length
        ? [prisma.articleAssignment.createMany({
            data: added.map((studentId) => ({ articleId, studentId, dueAt: due.value ?? null })),
            skipDuplicates: true,
          })]
        : []),
      ...(due.value !== undefined ? [prisma.articleAssignment.updateMany({ where: { articleId }, data: { dueAt: due.value } })] : []),
    ])
    if (added.length) {
      await notifyUsers(added, {
        title: 'New article to read',
        body: `${user.name || 'Your tutor'} assigned "${article.title}". Read it and write a summary of at least ${article.minSummaryWords} words.`,
        link: `/articles/${article.id}`,
      })
    }
    return json({ added: added.length, removed: removed.length, total: currentIds.size + added.length - removed.length })
  } catch (err) {
    console.error('PUT /api/articles/[articleId]/assignments:', err)
    return json({ error: 'Failed to update assignments' }, 500)
  }
}
