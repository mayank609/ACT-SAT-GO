import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ensureMaterialTables } from '@/lib/materialTables'
import { canAuthor, isAdmin, json, notifyUsers } from '@/lib/studentSharing'
import { LIMITS, allowedRecipientIds, canDownloadMaterial, looksLikePdf, parseMaterialMeta } from '@/lib/materials'
import { putMaterialFile } from '@/lib/materialStorage'
import { inspectPdf } from '@/lib/materialRender'

export const runtime = 'nodejs'

// GET  /api/materials
//   → { shared: [...materials shared with me], mine: [...materials I manage] }
//   Students only get `shared`; tutors get both (admins' PDFs land in shared);
//   admins manage everything (add ?mine=1 for only their own).
// POST /api/materials (multipart: file, title, description?, subject?, recipientIds? = JSON array)

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    await ensureMaterialTables()

    const sharedRows = await prisma.studyMaterialShare.findMany({
      where: { userId: user.id },
      orderBy: { sharedAt: 'desc' },
      select: {
        sharedAt: true, viewedAt: true, lastPage: true,
        material: {
          select: {
            id: true, title: true, description: true, subject: true, pageCount: true, fileSize: true, createdById: true,
            updatedAt: true, createdBy: { select: { name: true } },
          },
        },
      },
    })
    const shared = sharedRows.map((r) => ({
      id: r.material.id,
      title: r.material.title,
      description: r.material.description,
      subject: r.material.subject,
      pageCount: r.material.pageCount,
      updatedAt: r.material.updatedAt,
      createdByName: r.material.createdBy?.name ?? '',
      sharedAt: r.sharedAt,
      viewedAt: r.viewedAt,
      lastPage: r.lastPage,
      canDownload: canDownloadMaterial(user, r.material),
    }))
    if (!canAuthor(user)) return json({ shared, mine: [] })

    const all = isAdmin(user) && request.nextUrl.searchParams.get('mine') !== '1'
    const mine = await prisma.studyMaterial.findMany({
      where: all ? {} : { createdById: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, title: true, description: true, subject: true, fileName: true, fileSize: true, pageCount: true,
        createdById: true, createdAt: true, updatedAt: true,
        createdBy: { select: { name: true, role: true } },
        shares: {
          orderBy: { sharedAt: 'asc' },
          select: { userId: true, sharedAt: true, viewedAt: true, lastPage: true, user: { select: { name: true, email: true, role: true } } },
        },
      },
    })
    return json({
      shared,
      mine: mine.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        subject: m.subject,
        fileName: m.fileName,
        fileSize: m.fileSize,
        pageCount: m.pageCount,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        createdById: m.createdById,
        createdByName: m.createdBy?.name ?? '',
        createdByAdmin: m.createdBy?.role === 'ADMIN' || m.createdBy?.role === 'SUPER_ADMIN',
        shares: m.shares.map((s) => ({
          userId: s.userId,
          name: s.user?.name || s.user?.email || 'User',
          role: s.user?.role ?? 'STUDENT',
          sharedAt: s.sharedAt,
          viewedAt: s.viewedAt,
          lastPage: s.lastPage,
        })),
      })),
    })
  } catch (err) {
    console.error('GET /api/materials:', err)
    return json({ error: 'Failed to load study materials' }, 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) return json({ error: 'Authentication required' }, 401)
    if (!canAuthor(user)) return json({ error: 'Only tutors and admins can upload study materials' }, 403)
    await ensureMaterialTables()

    const form = await request.formData().catch(() => null)
    if (!form) return json({ error: 'Send the PDF as multipart form data' }, 400)
    const file = form.get('file')
    if (!(file instanceof File)) return json({ error: 'Choose a PDF file to upload' }, 400)
    if (file.size > LIMITS.fileBytes) return json({ error: `The PDF must be at most ${LIMITS.fileBytes / 1024 / 1024} MB` }, 413)
    const meta = parseMaterialMeta({
      title: form.get('title') || file.name.replace(/\.pdf$/i, ''),
      description: form.get('description'),
      subject: form.get('subject'),
    })
    if ('error' in meta) return json({ error: meta.error }, 400)

    const data = new Uint8Array(await file.arrayBuffer())
    if (data.length === 0 || data.length !== file.size || !looksLikePdf(data)) {
      return json({ error: 'That file is not a valid PDF' }, 400)
    }
    let info
    try {
      info = await inspectPdf(data)
    } catch (e) {
      const msg = (e as Error).message || ''
      return json({ error: /password/i.test(msg) ? 'Password-protected PDFs are not supported — remove the password and upload again' : 'That PDF could not be read — it may be damaged' }, 400)
    }
    if (info.pageCount === 0) return json({ error: 'That PDF has no pages' }, 400)
    if (info.pageCount > LIMITS.pages) return json({ error: `A PDF can have at most ${LIMITS.pages} pages` }, 400)

    let requested: unknown = []
    try { requested = JSON.parse(String(form.get('recipientIds') ?? '[]')) } catch { /* treated as none */ }
    const recipientIds = await allowedRecipientIds(user, requested)

    const id = randomUUID()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'document.pdf'
    const storagePath = await putMaterialFile(`${id}/${safeName}`, data)
    await prisma.studyMaterial.create({
      data: {
        id,
        ...meta.value,
        fileName: file.name.slice(0, 255),
        fileSize: data.length,
        pageCount: info.pageCount,
        pageSizes: info.pages,
        storagePath,
        createdById: user.id,
        shares: { create: recipientIds.map((userId) => ({ userId })) },
      },
    })
    if (recipientIds.length) {
      await notifyUsers(recipientIds, {
        title: 'New study material',
        body: `${user.name || 'Your tutor'} shared "${meta.value.title}" (${info.pageCount} page${info.pageCount === 1 ? '' : 's'}).`,
        link: `/materials/${id}`,
      })
    }
    return json({ id, pageCount: info.pageCount, sharedWith: recipientIds.length }, 201)
  } catch (err) {
    console.error('POST /api/materials:', err)
    return json({ error: 'Failed to upload the PDF' }, 500)
  }
}
