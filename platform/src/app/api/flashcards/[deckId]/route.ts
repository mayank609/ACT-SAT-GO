import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ensureFlashcardTables } from '@/lib/flashcardTables'
import { canManageDeck, json, knownCount, parseDeckInput, seenCount, validIds } from '@/lib/flashcards'

// GET    /api/flashcards/:deckId  — the deck with its cards (manager or a student it is shared with)
// PUT    /api/flashcards/:deckId  — replace title/topic/info/subject/cards (manager only)
// DELETE /api/flashcards/:deckId  — delete the deck and its shares (manager only)

type Ctx = { params: Promise<{ deckId: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const { deckId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureFlashcardTables()

    const deck = await prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      select: {
        id: true, title: true, topic: true, description: true, subject: true,
        createdAt: true, updatedAt: true, createdById: true,
        createdBy: { select: { name: true } },
        cards: { orderBy: { orderIndex: 'asc' }, select: { id: true, front: true, back: true, hint: true, example: true } },
      },
    })
    if (!deck) return json({ error: 'Flashcard deck not found' }, 404)

    const base = {
      id: deck.id,
      title: deck.title,
      topic: deck.topic,
      description: deck.description,
      subject: deck.subject,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
      createdById: deck.createdById,
      createdByName: deck.createdBy?.name ?? '',
      cards: deck.cards,
    }

    if (canManageDeck(user, deck)) {
      const ids = new Set(deck.cards.map((c) => c.id))
      const shares = await prisma.flashcardShare.findMany({
        where: { deckId },
        orderBy: { sharedAt: 'asc' },
        select: {
          studentId: true, sharedAt: true, viewedAt: true, lastStudiedAt: true, knownCardIds: true, seenCardIds: true,
          student: { select: { name: true, email: true } },
        },
      })
      return json({
        deck: {
          ...base,
          canEdit: true,
          shares: shares.map((s) => ({
            studentId: s.studentId,
            studentName: s.student?.name || s.student?.email || 'Student',
            sharedAt: s.sharedAt,
            viewedAt: s.viewedAt,
            lastStudiedAt: s.lastStudiedAt,
            knownCount: knownCount(s.knownCardIds, ids),
            seenCount: seenCount(s.seenCardIds, s.knownCardIds, ids),
          })),
        },
      })
    }

    if (user.role !== 'STUDENT') return json({ error: 'Forbidden' }, 403)
    const share = await prisma.flashcardShare.findUnique({
      where: { deckId_studentId: { deckId, studentId: user.id } },
      select: { id: true, viewedAt: true, knownCardIds: true, seenCardIds: true },
    })
    if (!share) return json({ error: 'This deck has not been shared with you' }, 403)
    // First open counts as "viewed" for the tutor's progress view.
    if (!share.viewedAt) {
      await prisma.flashcardShare.update({ where: { id: share.id }, data: { viewedAt: new Date() }, select: { id: true } })
    }
    const ids = new Set(deck.cards.map((c) => c.id))
    const known = validIds(share.knownCardIds, ids)
    const seen = [...new Set([...validIds(share.seenCardIds, ids), ...known])]
    return json({ deck: { ...base, canEdit: false, knownCardIds: known, seenCardIds: seen } })
  } catch (err) {
    console.error('GET /api/flashcards/[deckId]:', err)
    return json({ error: 'Failed to load flashcards' }, 500)
  }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const { deckId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureFlashcardTables()
    const deck = await prisma.flashcardDeck.findUnique({ where: { id: deckId }, select: { createdById: true } })
    if (!deck) return json({ error: 'Flashcard deck not found' }, 404)
    if (!canManageDeck(user, deck)) return json({ error: 'You can only edit your own decks' }, 403)

    const body = await request.json().catch(() => null)
    const parsed = parseDeckInput(body)
    if ('error' in parsed) return json({ error: parsed.error }, 400)
    const { title, topic, description, subject, cards } = parsed.value

    // Cards the client sends back with their id are updated in place, so a
    // student's "Got it" progress survives typo fixes and reordering; cards
    // without an id are new; cards no longer sent are deleted.
    const existingIds = new Set(
      (await prisma.flashcardCard.findMany({ where: { deckId }, select: { id: true } })).map((c) => c.id),
    )
    const rawCards = ((body as { cards?: unknown[] }).cards ?? []) as Array<{ id?: unknown; front?: unknown; back?: unknown }>
    const keep = new Set<string>()
    const cleanedWithIds: Array<{ id: string | null; front: string; back: string; hint: string | null; example: string | null }> = []
    let ci = 0
    for (const rc of rawCards) {
      const f = typeof rc?.front === 'string' ? rc.front.trim() : ''
      const b = typeof rc?.back === 'string' ? rc.back.trim() : ''
      if (!f && !b) continue // dropped by parseDeckInput too, so indexes stay aligned
      const c = cards[ci++]
      const id = typeof rc?.id === 'string' && existingIds.has(rc.id) && !keep.has(rc.id) ? rc.id : null
      if (id) keep.add(id)
      cleanedWithIds.push({ id, front: c.front, back: c.back, hint: c.hint, example: c.example })
    }

    await prisma.$transaction([
      prisma.flashcardCard.deleteMany({ where: { deckId, id: { notIn: [...keep] } } }),
      ...cleanedWithIds.map((c, i) =>
        c.id
          ? prisma.flashcardCard.update({
              where: { id: c.id },
              data: { front: c.front, back: c.back, hint: c.hint, example: c.example, orderIndex: i },
              select: { id: true },
            })
          : prisma.flashcardCard.create({
              data: { deckId, front: c.front, back: c.back, hint: c.hint, example: c.example, orderIndex: i },
              select: { id: true },
            }),
      ),
      prisma.flashcardDeck.update({ where: { id: deckId }, data: { title, topic, description, subject }, select: { id: true } }),
    ])
    return json({ id: deckId })
  } catch (err) {
    console.error('PUT /api/flashcards/[deckId]:', err)
    return json({ error: 'Failed to save flashcards' }, 500)
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { deckId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureFlashcardTables()
    const deck = await prisma.flashcardDeck.findUnique({ where: { id: deckId }, select: { createdById: true } })
    if (!deck) return json({ error: 'Flashcard deck not found' }, 404)
    if (!canManageDeck(user, deck)) return json({ error: 'You can only delete your own decks' }, 403)
    await prisma.flashcardDeck.delete({ where: { id: deckId }, select: { id: true } })
    return json({ success: true })
  } catch (err) {
    console.error('DELETE /api/flashcards/[deckId]:', err)
    return json({ error: 'Failed to delete flashcards' }, 500)
  }
}
