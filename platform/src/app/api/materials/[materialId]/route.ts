import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ensureMaterialTables } from '@/lib/materialTables'
import { json } from '@/lib/studentSharing'
import { materialAccess, parseMaterialMeta, watermarkFor } from '@/lib/materials'
import { deleteMaterialFile } from '@/lib/materialStorage'
import { forgetDoc } from '@/lib/materialRender'

export const runtime = 'nodejs'

// GET    /api/materials/:id — details for the viewer (page sizes, rights, watermark)
// PUT    /api/materials/:id — edit title/description/subject (uploader or admin)
// DELETE /api/materials/:id — delete it and the stored PDF (uploader or admin)

type Ctx = { params: Promise<{ materialId: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const { materialId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureMaterialTables()
    const access = await materialAccess(user, materialId)
    if (access.status === 404) return json({ error: 'Study material not found' }, 404)
    if (access.status === 403) return json({ error: 'This material has not been shared with you' }, 403)
    const { material: m, share, canManage, canDownload } = access

    if (share && !share.viewedAt) {
      await prisma.studyMaterialShare.update({ where: { id: share.id }, data: { viewedAt: new Date() } })
    }
    const shares = canManage
      ? (await prisma.studyMaterialShare.findMany({ where: { materialId }, select: { userId: true } })).map((s) => s.userId)
      : undefined
    return json({
      material: {
        id: m.id,
        title: m.title,
        description: m.description,
        subject: m.subject,
        fileName: canDownload ? m.fileName : undefined,
        fileSize: m.fileSize,
        pageCount: m.pageCount,
        pageSizes: m.pageSizes,
        createdById: m.createdById,
        createdByName: m.createdBy?.name ?? '',
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        canManage,
        canDownload,
        lastPage: share?.lastPage ?? null,
        watermark: watermarkFor(user),
        sharedWith: shares,
      },
    })
  } catch (err) {
    console.error('GET /api/materials/[materialId]:', err)
    return json({ error: 'Failed to load the material' }, 500)
  }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const { materialId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureMaterialTables()
    const access = await materialAccess(user, materialId)
    if (access.status === 404) return json({ error: 'Study material not found' }, 404)
    if (access.status === 403 || !access.canManage) return json({ error: 'You can only edit your own materials' }, 403)
    const meta = parseMaterialMeta(((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>)
    if ('error' in meta) return json({ error: meta.error }, 400)
    await prisma.studyMaterial.update({ where: { id: materialId }, data: meta.value })
    return json({ id: materialId })
  } catch (err) {
    console.error('PUT /api/materials/[materialId]:', err)
    return json({ error: 'Failed to save the material' }, 500)
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { materialId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureMaterialTables()
    const access = await materialAccess(user, materialId)
    if (access.status === 404) return json({ error: 'Study material not found' }, 404)
    if (access.status === 403 || !access.canManage) return json({ error: 'You can only delete your own materials' }, 403)
    await prisma.studyMaterial.delete({ where: { id: materialId } })
    forgetDoc(access.material.storagePath)
    await deleteMaterialFile(access.material.storagePath)
    return json({ success: true })
  } catch (err) {
    console.error('DELETE /api/materials/[materialId]:', err)
    return json({ error: 'Failed to delete the material' }, 500)
  }
}
