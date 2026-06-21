import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

// POST /api/test-packages/:packageId/assign
// Body: { studentIds: string[], dueAt?, availableFrom?, availableUntil?, maxAttempts? }
// Creates a TestAssignment for every (test in package) × (student) pair.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> },
) {
  const { packageId } = await params
  let body: {
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

  const { studentIds, dueAt, availableFrom, availableUntil, maxAttempts = 1 } = body
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return NextResponse.json({ error: 'studentIds is required' }, { status: 400 })
  }

  try {
    const pkg = await prisma.testPackage.findUnique({
      where: { id: packageId },
      include: { items: { include: { test: { select: { id: true, title: true } } } } },
    })
    if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

    const tests = pkg.items.map((i) => i.test)
    if (tests.length === 0) {
      return NextResponse.json({ error: 'Package has no tests' }, { status: 400 })
    }

    const TTL = 2592000 // 30 days
    let created = 0
    let skipped = 0

    for (const studentId of studentIds) {
      for (const test of tests) {
        try {
          await prisma.testAssignment.create({
            data: {
              testId: test.id,
              studentId,
              dueAt: dueAt ? new Date(dueAt) : null,
              availableFrom: availableFrom ? new Date(availableFrom) : null,
              availableUntil: availableUntil ? new Date(availableUntil) : null,
              maxAttempts,
              isActive: true,
            },
          })
          created++
        } catch {
          // Likely already assigned — skip this pair.
          skipped++
        }
      }

      // One bundled notification per student (rather than one per test).
      try {
        await prisma.notification.create({
          data: {
            userId: studentId,
            type: 'TEST_ASSIGNED',
            title: 'New Test Package Assigned',
            body: `"${pkg.title}" (${tests.length} test${tests.length !== 1 ? 's' : ''}) has been assigned to you.${dueAt ? ` Due: ${new Date(dueAt).toLocaleDateString()}` : ''}`,
            read: false,
          },
        })
      } catch (e) {
        console.error('Failed to create DB notification', e)
      }

      try {
        const notifId = randomUUID()
        const notification = {
          id: notifId,
          userId: studentId,
          type: 'TEST_ASSIGNED',
          title: 'New Test Package Assigned',
          body: `"${pkg.title}" (${tests.length} test${tests.length !== 1 ? 's' : ''}) has been assigned to you.${dueAt ? ` Due: ${new Date(dueAt).toLocaleDateString()}` : ''}`,
          read: false,
          createdAt: new Date().toISOString(),
        }
        await redis.set(`notif:${notifId}`, JSON.stringify(notification), { ex: TTL })
        await redis.lpush(`user_notifs:${studentId}`, notifId)
      } catch (e) {
        console.error('Failed to push redis notification', e)
      }
    }

    return NextResponse.json({ created, skipped, tests: tests.length, students: studentIds.length })
  } catch (error) {
    console.error('POST /api/test-packages/[packageId]/assign:', error)
    return NextResponse.json({ error: 'Failed to assign package' }, { status: 500 })
  }
}
