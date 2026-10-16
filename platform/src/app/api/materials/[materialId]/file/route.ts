import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { ensureMaterialTables } from '@/lib/materialTables'
import { json } from '@/lib/studentSharing'
import { materialAccess } from '@/lib/materials'
import { getMaterialFile } from '@/lib/materialStorage'

export const runtime = 'nodejs'

// GET /api/materials/:id/file — the original PDF. Only its uploader and
// admins may download; everyone else is view-only.

export async function GET(request: NextRequest, { params }: { params: Promise<{ materialId: string }> }) {
  const { materialId } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureMaterialTables()
    const access = await materialAccess(user, materialId)
    if (access.status === 404) return json({ error: 'Study material not found' }, 404)
    if (access.status === 403 || !access.canDownload) return json({ error: 'This material is view-only' }, 403)

    const data = await getMaterialFile(access.material.storagePath)
    const name = access.material.fileName.replace(/[^\w.\- ]/g, '_') || 'document.pdf'
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(access.material.fileName)}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/materials/[materialId]/file:', err)
    return json({ error: 'Failed to download the file' }, 500)
  }
}
