import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function userName(u: { email: string; permissions: unknown }): string {
  const perms = (u.permissions ?? {}) as Record<string, unknown>
  return (perms.displayName as string) ?? u.email.split('@')[0]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tutors: { include: { tutor: { select: { id: true, email: true, permissions: true } } } },
        students: { include: { student: { select: { id: true, email: true } } } },
        attempts: {
          where: { status: 'SUBMITTED' },
          select: { id: true, totalScore: true, completedAt: true, testId: true },
          orderBy: { completedAt: 'desc' },
        },
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const perms = (user.permissions ?? {}) as Record<string, unknown>
    const avgScore = user.attempts.length
      ? user.attempts.reduce((a, at) => a + (at.totalScore ?? 0), 0) / user.attempts.length
      : null

    return NextResponse.json({
      user: {
        id: user.id,
        name: (user as unknown as { name?: string | null }).name ?? perms.displayName as string ?? user.email.split('@')[0],
        email: user.email,
        role: user.role.toLowerCase(),
        createdAt: user.createdAt,
        tutorId: user.tutors[0]?.tutor.id ?? null,
        tutorName: user.tutors[0] ? userName(user.tutors[0].tutor as { email: string; permissions: unknown }) : null,
        studentIds: user.students.map((s) => s.student.id),
        studentCount: user.students.length,
        testsAttempted: user.attempts.length,
        avgScore: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
        lastActive: user.attempts[0]?.completedAt ?? null,
        grade: perms.grade ?? null,
        targetScore: perms.targetScore ?? null,
        specialization: perms.specialization ?? [],
        phone: perms.phone ?? null,
        parentPhone: perms.parentPhone ?? null,
        dob: perms.dob ?? null,
        schoolName: perms.schoolName ?? null,
      },
    })
  } catch (error) {
    console.error('GET /api/users/[userId]:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  try {
    await prisma.user.delete({ where: { id: userId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/users/[userId]:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  try {
    const body = await request.json()
    const { name, grade, targetScore, specialization, tutorId, notifications, phone, parentPhone, dob, schoolName } = body as {
      name?: string
      grade?: string
      targetScore?: number
      specialization?: string[]
      tutorId?: string | null
      notifications?: Record<string, boolean>
      phone?: string
      parentPhone?: string
      dob?: string
      schoolName?: string
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } })
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const existingPerms = (existing.permissions ?? {}) as Record<string, unknown>
    const permissions: Record<string, unknown> = { ...existingPerms }
    if (name !== undefined) permissions.displayName = name
    if (grade !== undefined) permissions.grade = grade
    if (targetScore !== undefined) permissions.targetScore = targetScore
    if (specialization !== undefined) permissions.specialization = specialization
    if (notifications !== undefined) permissions.notifications = notifications
    if (phone !== undefined) permissions.phone = phone
    if (parentPhone !== undefined) permissions.parentPhone = parentPhone
    if (dob !== undefined) permissions.dob = dob
    if (schoolName !== undefined) permissions.schoolName = schoolName

    const updateData: any = { permissions: permissions as any }
    if (name !== undefined) updateData.name = name

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    if (tutorId !== undefined) {
      await prisma.tutorAssignment.deleteMany({ where: { studentId: userId } })
      if (tutorId) {
        await prisma.tutorAssignment.create({ data: { tutorId, studentId: userId } })
      }
    }

    return NextResponse.json({ user: { ...user, role: user.role.toLowerCase(), name: permissions.displayName } })
  } catch (error) {
    console.error('PATCH /api/users/[userId]:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
