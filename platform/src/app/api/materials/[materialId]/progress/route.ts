import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ensureMaterialTables } from '@/lib/materialTables'
import { json } from '@/lib/studentSharing'

// PUT /api/materials/:id/progress { page } — remembers where a recipient stopped reading.

export async function PUT(request: NextRequest, { params }: { params: Promise<{ materialId: string }> }) {
  const { materialId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureMaterialTables()
    const body = (await request.json().catch(() => null)) as { page?: unknown } | null
    const page = Number(body?.page)
    if (!Number.isInteger(page) || page < 1) return json({ error: 'page must be a page number' }, 400)
    const share = await prisma.studyMaterialShare.findUnique({
      where: { materialId_userId: { materialId, userId: user.id } },
      select: { id: true, material: { select: { pageCount: true } } },
    })
    if (!share) return json({ saved: false })
    await prisma.studyMaterialShare.update({
      where: { id: share.id },
      data: { lastPage: Math.min(page, share.material.pageCount) },
    })
    return json({ saved: true })
  } catch (err) {
    console.error('PUT /api/materials/[materialId]/progress:', err)
    return json({ error: 'Failed to save your place' }, 500)
  }
}
