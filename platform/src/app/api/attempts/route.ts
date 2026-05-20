import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const studentId = searchParams.get('studentId')

  try {
    const attempts = await prisma.testAttempt.findMany({
      where: {
        ...(status ? { status: status as 'IN_PROGRESS' | 'SUBMITTED' } : {}),
        ...(studentId ? { studentId } : {}),
      },
      include: {
        student: { select: { id: true, email: true, permissions: true } },
        test: {
          select: {
            id: true, title: true,
            sections: { select: { id: true, name: true, durationMinutes: true }, orderBy: { orderIndex: 'asc' } },
          },
        },
        sectionAttempts: {
          select: { sectionId: true, startedAt: true, completedAt: true },
          orderBy: { startedAt: 'asc' },
        },
        cheatingLogs: { select: { id: true, eventType: true, metadata: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
        _count: { select: { answers: true } },
      },
      orderBy: { startedAt: 'desc' },
    })

    return NextResponse.json({
      attempts: attempts.map((a) => {
        const perms = (a.student.permissions ?? {}) as Record<string, unknown>
        const studentName = (perms.displayName as string) ?? a.student.email.split('@')[0]
        const completedSections = a.sectionAttempts.filter((s) => s.completedAt).length
        const activeSectionAttempt = a.sectionAttempts.find((s) => !s.completedAt)
        const currentSection = activeSectionAttempt
          ? a.test.sections.find((s) => s.id === activeSectionAttempt.sectionId)
          : a.test.sections[completedSections]

        const sectionDuration = currentSection?.durationMinutes ?? 0
        const elapsed = activeSectionAttempt
          ? Math.floor((Date.now() - new Date(activeSectionAttempt.startedAt).getTime()) / 1000)
          : 0
        const timeRemaining = Math.max(0, sectionDuration * 60 - elapsed)

        const tabSwitchesCount = a.cheatingLogs.filter((l) => l.eventType === 'TAB_SWITCH').length

        return {
          id: a.id,
          studentId: a.studentId,
          studentName,
          testId: a.testId,
          testTitle: a.test.title,
          sectionName: currentSection?.name ?? (completedSections >= a.test.sections.length ? 'Completed' : 'Not started'),
          sectionIndex: completedSections,
          totalSections: a.test.sections.length,
          tabSwitches: tabSwitchesCount,
          cheatingLogs: a.cheatingLogs.map(l => ({
            id: l.id,
            eventType: l.eventType,
            metadata: l.metadata as Record<string, unknown>,
            createdAt: l.createdAt,
          })),
          answersCount: a._count.answers,
          startedAt: a.startedAt,
          completedAt: a.completedAt,
          status: a.status.toLowerCase(),
          progress: a.test.sections.length > 0 ? Math.round((completedSections / a.test.sections.length) * 100) : 0,
          timeRemaining,
          totalScore: a.totalScore,
        }
      }),
    })
  } catch (error) {
    console.error('GET /api/attempts:', error)
    return NextResponse.json({ error: 'Failed to fetch attempts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { testId, studentId } = body as { testId?: string; studentId?: string }

    if (!testId || !studentId) {
      return NextResponse.json({ error: 'testId and studentId are required' }, { status: 400 })
    }

    const assignment = await prisma.testAssignment.findFirst({
      where: { testId, studentId, isActive: true },
    })
    if (!assignment) {
      return NextResponse.json({ error: 'This test is not assigned to the student' }, { status: 403 })
    }

    const now = Date.now()
    if (assignment.availableFrom && now < assignment.availableFrom.getTime()) {
      return NextResponse.json({ error: 'This test is not yet available' }, { status: 403 })
    }
    if (assignment.availableUntil && now > assignment.availableUntil.getTime()) {
      return NextResponse.json({ error: 'This test assignment has expired' }, { status: 403 })
    }

    const existing = await prisma.testAttempt.findFirst({
      where: { testId, studentId, status: 'IN_PROGRESS' },
    })
    if (existing) {
      return NextResponse.json({ attemptId: existing.id, alreadyStarted: true })
    }

    const attemptsUsed = await prisma.testAttempt.count({ where: { testId, studentId } })
    if (attemptsUsed >= assignment.maxAttempts) {
      return NextResponse.json({ error: 'No attempts remaining for this test' }, { status: 403 })
    }

    const attempt = await prisma.testAttempt.create({
      data: { testId, studentId, status: 'IN_PROGRESS', startedAt: new Date() },
    })
    return NextResponse.json({ attemptId: attempt.id, alreadyStarted: false }, { status: 201 })
  } catch (error) {
    console.error('POST /api/attempts:', error)
    return NextResponse.json({ error: 'Failed to start test' }, { status: 500 })
  }
}
