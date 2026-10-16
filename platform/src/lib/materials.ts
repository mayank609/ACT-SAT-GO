import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { allowedStudentIds, isAdmin } from '@/lib/studentSharing'

// Protected study materials — who may see, share and download.
//  - TUTOR uploads: shares with their own students; the tutor may download it.
//  - ADMIN / SUPER_ADMIN uploads: shares with any students and tutors; only
//    admins may download it, so it is view-only for tutors too.
//  - Students never download, and never get the PDF — only watermarked pages.

export const LIMITS = { title: 160, description: 2000, subject: 60, fileBytes: 20 * 1024 * 1024, pages: 500 }

export interface MaterialRef { id: string; createdById: string }

export const canManageMaterial = (u: User, m: MaterialRef) => isAdmin(u) || m.createdById === u.id
/** Only the uploader and admins can get the original PDF. */
export const canDownloadMaterial = (u: User, m: MaterialRef) => isAdmin(u) || m.createdById === u.id

/**
 * Keeps only the ids this user may share with: admins → any active student or
 * tutor; tutors → their assigned students.
 */
export async function allowedRecipientIds(u: User, requested: unknown): Promise<string[]> {
  if (!isAdmin(u)) return allowedStudentIds(u, requested)
  const ids = Array.isArray(requested) ? [...new Set(requested.filter((x): x is string => typeof x === 'string'))] : []
  if (ids.length === 0) return []
  const rows = await prisma.user.findMany({
    where: { id: { in: ids }, role: { in: ['STUDENT', 'TUTOR'] }, deletedAt: null },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

/**
 * Access for one material: null when it doesn't exist or this user may not
 * open it. Recipients get their share row (for viewed/last page).
 */
export async function materialAccess(u: User, materialId: string) {
  const material = await prisma.studyMaterial.findUnique({
    where: { id: materialId },
    select: {
      id: true, title: true, description: true, subject: true, fileName: true, fileSize: true, pageCount: true,
      pageSizes: true, storagePath: true, createdById: true, createdAt: true, updatedAt: true,
      createdBy: { select: { name: true, role: true } },
    },
  })
  if (!material) return { status: 404 as const }
  const manage = canManageMaterial(u, material)
  const share = manage ? null : await prisma.studyMaterialShare.findUnique({
    where: { materialId_userId: { materialId, userId: u.id } },
    select: { id: true, viewedAt: true, lastPage: true },
  })
  if (!manage && !share) return { status: 403 as const }
  return { status: 200 as const, material, share, canManage: manage, canDownload: canDownloadMaterial(u, material) }
}

export function parseMaterialMeta(raw: Record<string, unknown>): { error: string } | { value: { title: string; description: string | null; subject: string | null } } {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const title = str(raw.title)
  const description = str(raw.description) || null
  const subject = str(raw.subject) || null
  if (!title) return { error: 'Title is required' }
  if (title.length > LIMITS.title) return { error: `Title must be at most ${LIMITS.title} characters` }
  if (description && description.length > LIMITS.description) return { error: `Description must be at most ${LIMITS.description} characters` }
  if (subject && subject.length > LIMITS.subject) return { error: `Subject must be at most ${LIMITS.subject} characters` }
  return { value: { title, description, subject } }
}

/** Text burned into every page a viewer sees, so a leaked screenshot names them. */
export function watermarkFor(u: User): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return [u.name, u.email, date].filter(Boolean).join(' · ')
}

/** "%PDF-" within the first KB — the cheap check before handing bytes to pdf.js. */
export function looksLikePdf(data: Uint8Array): boolean {
  const head = Buffer.from(data.subarray(0, 1024)).toString('latin1')
  return head.includes('%PDF-')
}
