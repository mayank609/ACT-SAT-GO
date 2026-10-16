import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ensureMaterialTables } from '@/lib/materialTables'
import { json, notifyUsers } from '@/lib/studentSharing'
import { allowedRecipientIds, materialAccess } from '@/lib/materials'

export const runtime = 'nodejs'

// PUT /api/materials/:id/shares  { recipientIds: string[] }
// Sets exactly who can view the material. Newly added people are notified.
// A tutor can't remove a share they couldn't have made (e.g. an admin shared
// it with someone who isn't their student).

export async function PUT(request: NextRequest, { params }: { params: Promise<{ materialId: string }> }) {
  const { materialId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureMaterialTables()
    const access = await materialAccess(user, materialId)
    if (access.status === 404) return json({ error: 'Study material not found' }, 404)
    if (access.status === 403 || !access.canManage) return json({ error: 'You can only share your own materials' }, 403)

    const body = (await request.json().catch(() => null)) as { recipientIds?: unknown } | null
    if (!Array.isArray(body?.recipientIds)) return json({ error: 'recipientIds[] is required' }, 400)
    const wanted = (await allowedRecipientIds(user, body!.recipientIds)).filter((id) => id !== access.material.createdById)

    const current = await prisma.studyMaterialShare.findMany({ where: { materialId }, select: { userId: true } })
    const currentIds = new Set(current.map((s) => s.userId))
    const wantedIds = new Set(wanted)
    const added = wanted.filter((id) => !currentIds.has(id))
    const manageable = new Set(await allowedRecipientIds(user, [...currentIds]))
    const removed = [...currentIds].filter((id) => !wantedIds.has(id) && manageable.has(id))

    await prisma.$transaction([
      ...(removed.length ? [prisma.studyMaterialShare.deleteMany({ where: { materialId, userId: { in: removed } } })] : []),
      ...(added.length ? [prisma.studyMaterialShare.createMany({ data: added.map((userId) => ({ materialId, userId })), skipDuplicates: true })] : []),
    ])
    if (added.length) {
      const m = access.material
      await notifyUsers(added, {
        title: 'New study material',
        body: `${user.name || 'Your tutor'} shared "${m.title}" (${m.pageCount} page${m.pageCount === 1 ? '' : 's'}).`,
        link: `/materials/${m.id}`,
      })
    }
    return json({ added: added.length, removed: removed.length, total: currentIds.size + added.length - removed.length })
  } catch (err) {
    console.error('PUT /api/materials/[materialId]/shares:', err)
    return json({ error: 'Failed to update sharing' }, 500)
  }
}
