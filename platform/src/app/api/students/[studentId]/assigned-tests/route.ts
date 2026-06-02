import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params

  try {
    const assignments = await prisma.testAssignment.findMany({
      where: { studentId, isActive: true },
      include: {
        test: {
          include: {
            sections: {
              orderBy: { orderIndex: 'asc' },
              include: { _count: { select: { questions: true } } },
            },
          },
        },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    })

    const attempts = await prisma.testAttempt.findMany({
      where: { studentId, testId: { in: assignments.map((a) => a.testId) } },
      orderBy: { startedAt: 'desc' },
      include: { sectionAttempts: true },
    })

    const now = Date.now()
    const attemptsByTest = new Map<string, typeof attempts>()
    for (const attempt of attempts) {
      const list = attemptsByTest.get(attempt.testId) ?? []
      list.push(attempt)
      attemptsByTest.set(attempt.testId, list)
    }

    const assignedTests = assignments.map((assignment) => {
      const testAttempts = attemptsByTest.get(assignment.testId) ?? []
      const inProgressAttempt = testAttempts.find((a) => a.status === 'IN_PROGRESS') ?? null
      const submittedAttempt = testAttempts.find((a) => a.status === 'SUBMITTED') ?? null
      const latestAttempt = testAttempts[0] ?? null
      const usedAttempts = testAttempts.length
      const remainingAttempts = Math.max(assignment.maxAttempts - usedAttempts, 0)

      const availableFromMs = assignment.availableFrom ? assignment.availableFrom.getTime() : null
      const availableUntilMs = assignment.availableUntil ? assignment.availableUntil.getTime() : null
      const isExpired = availableUntilMs !== null && now > availableUntilMs
      const isNotYetAvailable = availableFromMs !== null && now < availableFromMs

      // A test stays available as long as attempts remain (supports multi-attempt
      // assignments). It is only "Completed" once every assigned attempt is used.
      let statusLabel: 'Not Started' | 'In Progress' | 'Completed' | 'Expired' = 'Not Started'
      if (isExpired) statusLabel = 'Expired'
      else if (inProgressAttempt) statusLabel = 'In Progress'
      else if (remainingAttempts > 0) statusLabel = 'Not Started'
      else statusLabel = 'Completed'      // submitted all assigned attempts

      const completionStatus = submittedAttempt ? 'Submitted' : inProgressAttempt ? 'In Progress' : 'Pending'

      return {
        assignmentId: assignment.id,
        testId: assignment.testId,
        title: assignment.test.title,
        description: assignment.test.description,
        category: assignment.test.category,
        subCategory: assignment.test.subCategory,
        dueDate: assignment.dueAt,
        availableFrom: assignment.availableFrom,
        availableUntil: assignment.availableUntil,
        availabilityState: isNotYetAvailable ? 'upcoming' : isExpired ? 'expired' : 'open',
        status: statusLabel,
        completionStatus,
        usedAttempts,
        remainingAttempts,
        maxAttempts: assignment.maxAttempts,
        latestAttemptId: latestAttempt?.id ?? null,
        inProgressAttemptId: inProgressAttempt?.id ?? null,
        submittedAttemptId: submittedAttempt?.id ?? null,
        sections: assignment.test.sections,
      }
    })

    return NextResponse.json({ assignedTests })
  } catch (error) {
    console.error('GET /api/students/[studentId]/assigned-tests:', error)
    return NextResponse.json({ error: 'Failed to fetch assigned tests' }, { status: 500 })
  }
}
