import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['STUDENT', 'TUTOR', 'ADMIN', 'SUPER_ADMIN'] as const
type ValidRole = (typeof VALID_ROLES)[number]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')

  if (role !== null && !VALID_ROLES.includes(role as ValidRole)) {
    return NextResponse.json({ error: 'Invalid role value' }, { status: 400 })
  }

  try {
    const users = await prisma.user.findMany({
      where: role ? { role: role as ValidRole } : undefined,
      include: {
        tutors: { include: { tutor: { select: { id: true, email: true, permissions: true } } } },
        students: { include: { student: { select: { id: true, email: true } } } },
        attempts: {
          where: { status: 'SUBMITTED' },
          select: { totalScore: true, completedAt: true },
          orderBy: { completedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      users: users.map((u) => {
        const perms = (u.permissions ?? {}) as Record<string, unknown>
        const submittedAttempts = u.attempts
        const avgScore = submittedAttempts.length
          ? submittedAttempts.reduce((a, at) => a + (at.totalScore ?? 0), 0) / submittedAttempts.length
          : null
        const tutorUser = u.tutors[0]?.tutor
        // Try to get tutor's displayName if we queried their permissions
        const tutorName = tutorUser
          ? ((tutorUser as unknown as { permissions?: Record<string,unknown> }).permissions?.displayName as string ?? tutorUser.email.split('@')[0])
          : null
        return {
          id: u.id,
          name: (u as unknown as { name?: string | null }).name ?? perms.displayName as string ?? u.email.split('@')[0],
          email: u.email,
          role: u.role.toLowerCase(),
          createdAt: u.createdAt,
          tutorId: tutorUser?.id ?? null,
          tutorName,
          studentIds: u.students.map((s) => s.student.id),
          studentCount: u.students.length,
          testsAttempted: submittedAttempts.length,
          avgScore: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
          lastActive: submittedAttempts[0]?.completedAt ?? null,
          grade: perms.grade ?? null,
          targetScore: perms.targetScore ?? null,
          specialization: perms.specialization ?? [],
        }
      }),
    })
  } catch (error) {
    console.error('GET /api/users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, role, grade, targetScore, tutorId, specialization } = body as {
      name: string
      email: string
      role: string
      grade?: string
      targetScore?: number
      tutorId?: string
      specialization?: string[]
    }

    if (!email || !role) {
      return NextResponse.json({ error: 'email and role are required' }, { status: 400 })
    }

    const upperRole = role.toUpperCase() as ValidRole
    if (!VALID_ROLES.includes(upperRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const displayName = name || email.split('@')[0]
    const permissions: Record<string, unknown> = { displayName }
    if (grade) permissions.grade = grade
    if (targetScore) permissions.targetScore = targetScore
    if (specialization?.length) permissions.specialization = specialization

    const user = await prisma.user.create({
      data: {
        name: name || email.split('@')[0],
        email,
        role: upperRole,
        permissions: Object.keys(permissions).length ? permissions : undefined,
      },
    })

    if (tutorId && upperRole === 'STUDENT') {
      await prisma.tutorAssignment.create({
        data: { tutorId, studentId: user.id },
      })
    }

    return NextResponse.json({
      user: { ...user, name: displayName, role: user.role.toLowerCase() }
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/users:', error)
    const msg = (error as { code?: string }).code === 'P2002' ? 'Email already exists' : 'Failed to create user'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
