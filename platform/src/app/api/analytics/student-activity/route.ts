import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { redis } from '@/lib/redis'
import { isHomeworkTest } from '@/lib/testCategorize'

export const dynamic = 'force-dynamic'

interface ClassProgressEntry {
  classDate?: string
}

// GET /api/analytics/student-activity — admin-only. Per-student "how long since they
// last did X", used to drive the dashboard's attention list and target-date list:
// last completed Mock, last completed Homework, and last logged tutoring session.
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  try {
    const [attempts, assignments] = await Promise.all([
      prisma.testAttempt.findMany({
        where: { status: 'SUBMITTED' },
        select: { studentId: true, completedAt: true, test: { select: { category: true, subCategory: true, title: true } } },
        orderBy: { completedAt: 'desc' },
      }),
      prisma.tutorAssignment.findMany({ select: { tutorId: true, studentId: true } }),
    ])

    // Attempts are already ordered most-recent-first, so the first match per
    // student for each category is that student's latest one.
    const lastMock = new Map<string, string>()
    const lastHw = new Map<string, string>()
    for (const a of attempts) {
      if (!a.completedAt) continue
      const iso = a.completedAt.toISOString()
      const isMock = (a.test?.category ?? '').trim() === 'Mock'
      if (isMock && !lastMock.has(a.studentId)) lastMock.set(a.studentId, iso)
      if (isHomeworkTest(a.test) && !lastHw.has(a.studentId)) lastHw.set(a.studentId, iso)
    }

    // Session log entries live in Redis per (tutor, student) pair — a student can
    // have had more than one tutor over time, so take the latest across all of them.
    const lastSession = new Map<string, string>()
    await Promise.all(assignments.map(async ({ tutorId, studentId }) => {
      const raw = await redis.get<string>(`classProgress:${tutorId}:${studentId}`)
      if (!raw) return
      const entries: ClassProgressEntry[] = typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as ClassProgressEntry[])
      const dates = entries.map((e) => e.classDate).filter((d): d is string => !!d)
      if (dates.length === 0) return
      const latest = dates.reduce((a, b) => (a > b ? a : b))
      const existing = lastSession.get(studentId)
      if (!existing || latest > existing) lastSession.set(studentId, latest)
    }))

    const studentIds = new Set([...lastMock.keys(), ...lastHw.keys(), ...lastSession.keys()])
    const activity = [...studentIds].map((studentId) => ({
      studentId,
      lastMockDate: lastMock.get(studentId) ?? null,
      lastHwDate: lastHw.get(studentId) ?? null,
      lastSessionDate: lastSession.get(studentId) ?? null,
    }))

    return NextResponse.json({ activity })
  } catch (error) {
    console.error('GET /api/analytics/student-activity:', error)
    return NextResponse.json({ error: 'Failed to fetch student activity' }, { status: 500 })
  }
}
