import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ensureFlashcardTables } from '@/lib/flashcardTables'
import {
  allowedStudentIds, canAuthor, isAdmin, json, knownCount, notifyStudentsOfDeck, parseDeckInput, seenCount,
} from '@/lib/flashcards'

// GET /api/flashcards
//   STUDENT → decks shared with them (with their own progress)
//   TUTOR   → decks they created (with each student's progress)
//   ADMIN   → every deck (add ?mine=1 for only their own)
// POST /api/flashcards  { title, topic, description?, subject?, cards: [{front, back, hint?, example?}], studentIds?: [] }

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureFlashcardTables()

    if (user.role === 'STUDENT') {
      const shares = await prisma.flashcardShare.findMany({
        where: { studentId: user.id },
        orderBy: { sharedAt: 'desc' },
        select: {
          sharedAt: true, viewedAt: true, lastStudiedAt: true, knownCardIds: true, seenCardIds: true,
          deck: {
            select: {
              id: true, title: true, topic: true, description: true, subject: true, updatedAt: true,
              createdBy: { select: { name: true } },
              cards: { select: { id: true } },
            },
          },
        },
      })
      return json({
        decks: shares.map((s) => {
          const ids = new Set(s.deck.cards.map((c) => c.id))
          return {
            id: s.deck.id,
            title: s.deck.title,
            topic: s.deck.topic,
            description: s.deck.description,
            subject: s.deck.subject,
            updatedAt: s.deck.updatedAt,
            createdByName: s.deck.createdBy?.name ?? 'Your tutor',
            cardCount: ids.size,
            sharedAt: s.sharedAt,
            viewedAt: s.viewedAt,
            lastStudiedAt: s.lastStudiedAt,
            knownCount: knownCount(s.knownCardIds, ids),
            seenCount: seenCount(s.seenCardIds, s.knownCardIds, ids),
          }
        }),
      })
    }

    if (!canAuthor(user)) return json({ error: 'Insufficient permissions' }, 403)
    const mine = request.nextUrl.searchParams.get('mine') === '1'
    const decks = await prisma.flashcardDeck.findMany({
      where: isAdmin(user) && !mine ? {} : { createdById: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, title: true, topic: true, description: true, subject: true, createdAt: true, updatedAt: true,
        createdById: true,
        createdBy: { select: { name: true } },
        cards: { select: { id: true } },
        shares: {
          orderBy: { sharedAt: 'asc' },
          select: {
            studentId: true, sharedAt: true, viewedAt: true, lastStudiedAt: true, knownCardIds: true, seenCardIds: true,
            student: { select: { name: true, email: true } },
          },
        },
      },
    })
    return json({
      decks: decks.map((d) => {
        const ids = new Set(d.cards.map((c) => c.id))
        return {
          id: d.id,
          title: d.title,
          topic: d.topic,
          description: d.description,
          subject: d.subject,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          createdById: d.createdById,
          createdByName: d.createdBy?.name ?? '',
          cardCount: ids.size,
          shares: d.shares.map((s) => ({
            studentId: s.studentId,
            studentName: s.student?.name || s.student?.email || 'Student',
            sharedAt: s.sharedAt,
            viewedAt: s.viewedAt,
            lastStudiedAt: s.lastStudiedAt,
            knownCount: knownCount(s.knownCardIds, ids),
            seenCount: seenCount(s.seenCardIds, s.knownCardIds, ids),
          })),
        }
      }),
    })
  } catch (err) {
    console.error('GET /api/flashcards:', err)
    return json({ error: 'Failed to load flashcards' }, 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    if (!canAuthor(user)) return json({ error: 'Only tutors and admins can create flashcards' }, 403)
    await ensureFlashcardTables()

    const body = await request.json().catch(() => null)
    const parsed = parseDeckInput(body)
    if ('error' in parsed) return json({ error: parsed.error }, 400)
    const { title, topic, description, subject, cards } = parsed.value
    const studentIds = await allowedStudentIds(user, (body as { studentIds?: unknown })?.studentIds)

    const deck = await prisma.flashcardDeck.create({
      data: {
        title, topic, description, subject, createdById: user.id,
        cards: { create: cards.map((c, i) => ({ front: c.front, back: c.back, hint: c.hint, example: c.example, orderIndex: i })) },
        shares: { create: studentIds.map((studentId) => ({ studentId })) },
      },
      select: { id: true },
    })
    if (studentIds.length) {
      await notifyStudentsOfDeck(studentIds, { id: deck.id, title, topic, cardCount: cards.length }, user.name || 'Your tutor')
    }
    return json({ id: deck.id, sharedWith: studentIds.length }, 201)
  } catch (err) {
    console.error('POST /api/flashcards:', err)
    return json({ error: 'Failed to create flashcards' }, 500)
  }
}
