import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// PATCH /api/test-assignments/[assignmentId] — admin-only. Body: { dueAt: string | null }
// Reschedules an existing assignment's due date without touching anything else about it.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  const { assignmentId } = await params
  const body = await request.json().catch(() => null)
  if (!body || !('dueAt' in body)) {
    return NextResponse.json({ error: 'dueAt is required' }, { status: 400 })
  }

  try {
    const updated = await prisma.testAssignment.update({
      where: { id: assignmentId },
      data: { dueAt: body.dueAt ? new Date(body.dueAt) : null },
    })
    return NextResponse.json({ assignment: { id: updated.id, dueAt: updated.dueAt } })
  } catch (error) {
    console.error('PATCH /api/test-assignments/[assignmentId]:', error)
    return NextResponse.json({ error: 'Failed to reschedule assignment' }, { status: 500 })
  }
}

// DELETE /api/test-assignments/[assignmentId] — admin-only. Unassigns the test —
// removes the assignment itself, not the student's completed attempts (if any).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  const { assignmentId } = await params
  try {
    await prisma.testAssignment.delete({ where: { id: assignmentId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/test-assignments/[assignmentId]:', error)
    return NextResponse.json({ error: 'Failed to unassign test' }, { status: 500 })
  }
}
