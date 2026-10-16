import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { ensureMaterialTables } from '@/lib/materialTables'
import { json } from '@/lib/studentSharing'
import { materialAccess, watermarkFor } from '@/lib/materials'
import { getMaterialFile } from '@/lib/materialStorage'
import { RENDER_WIDTHS, renderPage } from '@/lib/materialRender'

export const runtime = 'nodejs'

// GET /api/materials/:id/pages/:page?w=1200
// One page as a watermarked image. This is the only way a view-only reader
// sees the content — the PDF itself is never sent to them.

export async function GET(request: NextRequest, { params }: { params: Promise<{ materialId: string; page: string }> }) {
  const { materialId, page } = await params
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureMaterialTables()
    const access = await materialAccess(user, materialId)
    if (access.status === 404) return json({ error: 'Study material not found' }, 404)
    if (access.status === 403) return json({ error: 'This material has not been shared with you' }, 403)

    const n = Number(page)
    if (!Number.isInteger(n) || n < 1 || n > access.material.pageCount) return json({ error: 'Page not found' }, 404)
    const asked = Number(request.nextUrl.searchParams.get('w')) || 1200
    const width = RENDER_WIDTHS.find((w) => w >= asked) ?? RENDER_WIDTHS[RENDER_WIDTHS.length - 1]

    const path = access.material.storagePath
    const image = await renderPage(path, () => getMaterialFile(path), n, width, watermarkFor(user))
    return new NextResponse(new Uint8Array(image), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, max-age=600',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('GET /api/materials/[materialId]/pages/[page]:', err)
    return json({ error: 'Failed to show this page' }, 500)
  }
}
