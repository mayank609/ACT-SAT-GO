import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ensureFlashcardTables } from '@/lib/flashcardTables'
import { allowedStudentIds, canManageDeck, json, notifyStudentsOfDeck } from '@/lib/flashcards'

// PUT /api/flashcards/:deckId/shares  { studentIds: string[] }
// Sets exactly who the deck is shared with. Newly added students are
// notified; removed students lose access (their progress is deleted with the
// share). Tutors can only share with their own assigned students.

export async function PUT(request: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureFlashcardTables()
    const deck = await prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      select: { id: true, title: true, topic: true, createdById: true, _count: { select: { cards: true } } },
    })
    if (!deck) return json({ error: 'Flashcard deck not found' }, 404)
    if (!canManageDeck(user, deck)) return json({ error: 'You can only share your own decks' }, 403)

    const body = (await request.json().catch(() => null)) as { studentIds?: unknown } | null
    if (!Array.isArray(body?.studentIds)) return json({ error: 'studentIds[] is required' }, 400)
    const wanted = await allowedStudentIds(user, body!.studentIds)

    const current = await prisma.flashcardShare.findMany({ where: { deckId }, select: { studentId: true } })
    const currentIds = new Set(current.map((s) => s.studentId))
    const wantedIds = new Set(wanted)
    const added = wanted.filter((id) => !currentIds.has(id))
    // A tutor can't remove a share they couldn't have made (e.g. an admin
    // shared it with a student who isn't theirs) — only ones they may manage.
    const manageable = new Set(await allowedStudentIds(user, [...currentIds]))
    const removed = [...currentIds].filter((id) => !wantedIds.has(id) && manageable.has(id))

    await prisma.$transaction([
      ...(removed.length ? [prisma.flashcardShare.deleteMany({ where: { deckId, studentId: { in: removed } } })] : []),
      ...(added.length ? [prisma.flashcardShare.createMany({ data: added.map((studentId) => ({ deckId, studentId })), skipDuplicates: true })] : []),
    ])
    if (added.length) {
      await notifyStudentsOfDeck(
        added,
        { id: deck.id, title: deck.title, topic: deck.topic, cardCount: deck._count.cards },
        user.name || 'Your tutor',
      )
    }
    return json({ added: added.length, removed: removed.length, total: currentIds.size + added.length - removed.length })
  } catch (err) {
    console.error('PUT /api/flashcards/[deckId]/shares:', err)
    return json({ error: 'Failed to update sharing' }, 500)
  }
}
