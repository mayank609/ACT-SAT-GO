import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ensureArticleTables } from '@/lib/articleTables'
import { allowedStudentIds, canAuthor, isAdmin, json, notifyUsers } from '@/lib/studentSharing'
import { parseArticleInput, parseDueAt, readingMinutes } from '@/lib/articles'
import { aiOverview } from '@/lib/articleFeedback'

// GET  /api/articles
//   STUDENT → articles assigned to them, with their summary status
//   TUTOR   → articles they wrote, with every assigned student's status
//   ADMIN   → every article (add ?mine=1 for only their own)
// POST /api/articles { title, topic?, subject?, body, sourceUrl?, minSummaryWords?, dueAt?, studentIds?: [] }

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureArticleTables()

    if (user.role === 'STUDENT') {
      const rows = await prisma.articleAssignment.findMany({
        where: { studentId: user.id },
        orderBy: { assignedAt: 'desc' },
        select: {
          status: true, assignedAt: true, dueAt: true, openedAt: true, submittedAt: true, reviewedAt: true,
          summaryWordCount: true, feedback: true, submissions: true,
          article: {
            select: {
              id: true, title: true, topic: true, subject: true, body: true, minSummaryWords: true,
              createdBy: { select: { name: true } },
            },
          },
        },
      })
      return json({
        articles: rows.map((r) => ({
          id: r.article.id,
          title: r.article.title,
          topic: r.article.topic,
          subject: r.article.subject,
          readMinutes: readingMinutes(r.article.body),
          minSummaryWords: r.article.minSummaryWords,
          createdByName: r.article.createdBy?.name ?? 'Your tutor',
          status: r.status,
          assignedAt: r.assignedAt,
          dueAt: r.dueAt,
          openedAt: r.openedAt,
          submittedAt: r.submittedAt,
          reviewedAt: r.reviewedAt,
          summaryWordCount: r.summaryWordCount,
          hasFeedback: !!r.feedback,
          ...aiOverview(r.submissions),
        })),
      })
    }

    if (!canAuthor(user)) return json({ error: 'Insufficient permissions' }, 403)
    const mine = request.nextUrl.searchParams.get('mine') === '1'
    const articles = await prisma.article.findMany({
      where: isAdmin(user) && !mine ? {} : { createdById: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, title: true, topic: true, subject: true, body: true, sourceUrl: true, minSummaryWords: true,
        createdAt: true, updatedAt: true, createdById: true,
        createdBy: { select: { name: true } },
        assignments: {
          orderBy: { assignedAt: 'asc' },
          select: {
            studentId: true, status: true, assignedAt: true, dueAt: true, openedAt: true, submittedAt: true,
            reviewedAt: true, summaryWordCount: true, copiedRatio: true, submissions: true,
            student: { select: { name: true, email: true } },
          },
        },
      },
    })
    return json({
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        topic: a.topic,
        subject: a.subject,
        sourceUrl: a.sourceUrl,
        minSummaryWords: a.minSummaryWords,
        readMinutes: readingMinutes(a.body),
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        createdById: a.createdById,
        createdByName: a.createdBy?.name ?? '',
        assignments: a.assignments.map((s) => ({
          studentId: s.studentId,
          studentName: s.student?.name || s.student?.email || 'Student',
          status: s.status,
          assignedAt: s.assignedAt,
          dueAt: s.dueAt,
          openedAt: s.openedAt,
          submittedAt: s.submittedAt,
          reviewedAt: s.reviewedAt,
          summaryWordCount: s.summaryWordCount,
          copiedRatio: s.copiedRatio,
          ...aiOverview(s.submissions),
        })),
      })),
    })
  } catch (err) {
    console.error('GET /api/articles:', err)
    return json({ error: 'Failed to load articles' }, 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    if (!canAuthor(user)) return json({ error: 'Only tutors and admins can add articles' }, 403)
    await ensureArticleTables()

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const parsed = parseArticleInput(body)
    if ('error' in parsed) return json({ error: parsed.error }, 400)
    const due = parseDueAt(body?.dueAt)
    if ('error' in due) return json({ error: due.error }, 400)
    const studentIds = await allowedStudentIds(user, body?.studentIds)

    const article = await prisma.article.create({
      data: {
        ...parsed.value,
        createdById: user.id,
        assignments: { create: studentIds.map((studentId) => ({ studentId, dueAt: due.value ?? null })) },
      },
      select: { id: true },
    })
    if (studentIds.length) {
      await notifyUsers(studentIds, {
        title: 'New article to read',
        body: `${user.name || 'Your tutor'} assigned "${parsed.value.title}". Read it and write a summary of at least ${parsed.value.minSummaryWords} words.`,
        link: `/articles/${article.id}`,
      })
    }
    return json({ id: article.id, assignedTo: studentIds.length }, 201)
  } catch (err) {
    console.error('POST /api/articles:', err)
    return json({ error: 'Failed to create the article' }, 500)
  }
}
