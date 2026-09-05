import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/test-assignments?testId=xxx
// Returns all assignments for a given test with student info
export async function GET(request: NextRequest) {
  const testId = request.nextUrl.searchParams.get('testId')
  if (!testId) {
    return NextResponse.json({ error: 'testId is required' }, { status: 400 })
  }

  try {
    const assignments = await prisma.testAssignment.findMany({
      where: { testId },
      include: {
        student: { select: { id: true, email: true, permissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      assignments: assignments.map((a) => {
        const perms = (a.student.permissions ?? {}) as Record<string, unknown>
        return {
          id: a.id,
          testId: a.testId,
          studentId: a.studentId,
          studentName: (perms.displayName as string) ?? a.student.email.split('@')[0],
          studentEmail: a.student.email,
          dueAt: a.dueAt,
          availableFrom: a.availableFrom,
          availableUntil: a.availableUntil,
          maxAttempts: a.maxAttempts,
          isActive: a.isActive,
          createdAt: a.createdAt,
        }
      }),
    })
  } catch (error) {
    console.error('GET /api/test-assignments:', error)
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }
}

// POST /api/test-assignments
// Body: { testId, studentIds: string[], dueAt?, availableFrom?, availableUntil?, maxAttempts? }
export async function POST(request: NextRequest) {
  // Students (including free-demo accounts) must never be able to self-assign tests.
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN', 'TUTOR'])
  if (auth instanceof NextResponse) return auth

  let body: {
    testId: string
    studentIds: string[]
    dueAt?: string | null
    availableFrom?: string | null
    availableUntil?: string | null
    maxAttempts?: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { testId, studentIds, dueAt, availableFrom, availableUntil, maxAttempts = 1 } = body

  if (!testId || !Array.isArray(studentIds) || studentIds.length === 0) {
    return NextResponse.json({ error: 'testId and studentIds are required' }, { status: 400 })
  }

  try {
    // Fetch test title once for the notification message
    const test = await prisma.test.findUnique({ where: { id: testId }, select: { title: true } })
    const testTitle = test?.title ?? 'A new test'

    const created: string[] = []
    const skipped: string[] = []
    const TTL = 2592000 // 30 days

    for (const studentId of studentIds) {
      try {
        const ta = await prisma.testAssignment.create({
          data: {
            testId,
            studentId,
            dueAt: dueAt ? new Date(dueAt) : null,
            availableFrom: availableFrom ? new Date(availableFrom) : null,
            availableUntil: availableUntil ? new Date(availableUntil) : null,
            maxAttempts,
            isActive: true,
          },
        })
        // Persist notification in DB as well for durability
        try {
          await prisma.notification.create({ data: {
            userId: studentId,
            type: 'TEST_ASSIGNED',
            title: 'New Test Assigned',
            body: `"${testTitle}" has been assigned to you.${dueAt ? ` Due: ${new Date(dueAt).toLocaleDateString()}` : ''}`,
            read: false,
          } })
        } catch (e) { console.error('Failed to create DB notification', e) }
        created.push(studentId)

        // Send notification to the student
        const notifId = randomUUID()
        const notification = {
          id: notifId,
          userId: studentId,
          type: 'TEST_ASSIGNED',
          title: 'New Test Assigned',
          body: `"${testTitle}" has been assigned to you.${dueAt ? ` Due: ${new Date(dueAt).toLocaleDateString()}` : ''}`,
          read: false,
          createdAt: new Date().toISOString(),
        }
        await redis.set(`notif:${notifId}`, JSON.stringify(notification), { ex: TTL })
        await redis.lpush(`user_notifs:${studentId}`, notifId)
      } catch {
        // Likely unique constraint violation — student already assigned
        skipped.push(studentId)
      }
    }

    return NextResponse.json({ created: created.length, skipped: skipped.length })
  } catch (error) {
    console.error('POST /api/test-assignments:', error)
    return NextResponse.json({ error: 'Failed to create assignments' }, { status: 500 })
  }
}

// DELETE /api/test-assignments?testId=xxx&studentId=xxx
export async function DELETE(request: NextRequest) {
  const testId = request.nextUrl.searchParams.get('testId')
  const studentId = request.nextUrl.searchParams.get('studentId')

  if (!testId || !studentId) {
    return NextResponse.json({ error: 'testId and studentId are required' }, { status: 400 })
  }

  try {
    await prisma.testAssignment.deleteMany({ where: { testId, studentId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/test-assignments:', error)
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 })
  }
}
