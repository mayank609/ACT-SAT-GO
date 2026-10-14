import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { isHomeworkTest } from '@/lib/testCategorize'
import { notifyParentPtm } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

// PTM (parent-teacher meeting) reports. Stored on the student's User.permissions
// JSON as `ptmReports` (newest first), like the other student profile fields, so
// no database migration is needed. Only admins write; a tutor reads their
// assigned students' reports and a student reads their own.

const PREP_STATUSES = ['On track', 'Slightly Delayed', 'Needs attention'] as const

interface PtmReport {
  id: string
  ptmDate: string
  targetTestDate: string | null
  prepStatus: string
  mocksCompleted: number
  remarks: string
  createdAt: string
  createdBy: string
}

type Perms = Record<string, unknown>

function displayName(u: { name: string | null; email: string; permissions: unknown }): string {
  if (u.name) return u.name
  const p = (u.permissions ?? {}) as Perms
  return (p.displayName as string) ?? u.email.split('@')[0]
}

function reportsOf(permissions: unknown): PtmReport[] {
  const list = ((permissions ?? {}) as Perms).ptmReports
  return Array.isArray(list) ? (list as PtmReport[]) : []
}

// Completed full-length mocks: distinct tests in the Mock category (or titled
// "mock" when uncategorised), homework excluded, counted once even if retaken.
type AttemptRow = { testId: string; test: { title: string; category: string | null; subCategory: string | null } }
function mocksCompleted(attempts: AttemptRow[]): number {
  const ids = new Set<string>()
  for (const a of attempts) {
    const cat = (a.test.category ?? '').trim().toLowerCase()
    const isMock = cat === 'mock' || (!cat && a.test.title.toLowerCase().includes('mock'))
    if (isMock && !isHomeworkTest(a.test)) ids.add(a.testId)
  }
  return ids.size
}

const attemptSelect = {
  where: { status: { in: ['SUBMITTED', 'EVALUATED'] as const } },
  select: { testId: true, test: { select: { title: true, category: true, subCategory: true } } },
} satisfies Prisma.User$attemptsArgs

// GET /api/ptm-reports[?studentId=] — the students the caller may see, each
// with their reports and current completed-mock count.
export async function GET(request: NextRequest) {
  const caller = await requireUser(request)
  if (caller instanceof NextResponse) return caller
  const studentId = request.nextUrl.searchParams.get('studentId')

  try {
    const where: Prisma.UserWhereInput = { role: 'STUDENT', deletedAt: null }
    if (studentId) where.id = studentId
    if (caller.role === 'STUDENT') where.id = caller.id
    else if (caller.role === 'TUTOR') where.tutors = { some: { tutorId: caller.id } }

    const students = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, permissions: true, attempts: attemptSelect },
      orderBy: { createdAt: 'desc' },
    })

    const rows = students
      .filter((s) => {
        const p = (s.permissions ?? {}) as Perms
        if (p.accountType === 'DEMO') return false
        // Admins and tutors see only students marked Active on the Students page.
        return caller.role === 'STUDENT' || p.diagnosticDecision === 'keep'
      })
      .map((s) => {
        const p = (s.permissions ?? {}) as Perms
        return {
          id: s.id,
          name: displayName(s),
          email: s.email,
          targetDate: (p.targetDate as string) ?? null,
          mocksCompleted: mocksCompleted(s.attempts),
          reports: reportsOf(s.permissions),
        }
      })
    return NextResponse.json({ students: rows })
  } catch (error) {
    console.error('GET /api/ptm-reports:', error)
    return NextResponse.json({ error: 'Failed to load PTM reports' }, { status: 500 })
  }
}

// POST /api/ptm-reports — admin only. Body: { studentId, ptmDate, targetTestDate?, prepStatus, remarks? }
export async function POST(request: NextRequest) {
  const caller = await requireUser(request)
  if (caller instanceof NextResponse) return caller
  if (caller.role !== 'ADMIN' && caller.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only admins can update PTM reports' }, { status: 403 })
  }

  try {
    const { studentId, ptmDate, targetTestDate, prepStatus, remarks } = await request.json()
    if (!studentId || !ptmDate || !prepStatus) {
      return NextResponse.json({ error: 'studentId, ptmDate and prepStatus are required' }, { status: 400 })
    }
    if (!(PREP_STATUSES as readonly string[]).includes(prepStatus)) {
      return NextResponse.json({ error: 'Invalid prep status' }, { status: 400 })
    }

    const student = await prisma.user.findFirst({
      where: { id: studentId, role: 'STUDENT', deletedAt: null },
      select: { permissions: true, attempts: attemptSelect },
    })
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

    const report: PtmReport = {
      id: randomUUID(),
      ptmDate: String(ptmDate),
      targetTestDate: targetTestDate ? String(targetTestDate) : null,
      prepStatus,
      mocksCompleted: mocksCompleted(student.attempts),
      remarks: remarks ? String(remarks).trim() : '',
      createdAt: new Date().toISOString(),
      createdBy: displayName(caller),
    }
    const perms = (student.permissions ?? {}) as Perms
    const reports = [report, ...reportsOf(perms)].sort((a, b) =>
      b.ptmDate.localeCompare(a.ptmDate) || b.createdAt.localeCompare(a.createdAt))
    await prisma.user.update({
      where: { id: studentId },
      data: { permissions: { ...perms, ptmReports: reports } as unknown as Prisma.InputJsonValue },
    })
    // Tell the parent on WhatsApp (no-op until WhatsApp is configured; never blocks the save).
    void notifyParentPtm(studentId, report)
    return NextResponse.json({ report, reports })
  } catch (error) {
    console.error('POST /api/ptm-reports:', error)
    return NextResponse.json({ error: 'Failed to save PTM report' }, { status: 500 })
  }
}
