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
          phone: perms.phone ?? null,
          parentPhone: perms.parentPhone ?? null,
          dob: perms.dob ?? null,
          schoolName: perms.schoolName ?? null,
        }
      }),
    })
  } catch (error) {
    console.error('GET /api/users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'crypto'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') + '@1'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, role, grade, targetScore, tutorId, specialization, phone, parentPhone, dob, schoolName } = body as {
      name: string
      email: string
      role: string
      grade?: string
      targetScore?: number
      tutorId?: string
      specialization?: string[]
      phone?: string
      parentPhone?: string
      dob?: string
      schoolName?: string
    }

    // 1. Validation
    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required fields' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    const upperRole = role.toUpperCase() as ValidRole
    if (!VALID_ROLES.includes(upperRole)) {
      return NextResponse.json({ error: 'Invalid role value specified' }, { status: 400 })
    }

    if (grade) {
      const gradeNum = parseInt(grade, 10)
      if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 12) {
        return NextResponse.json({ error: 'Grade must be a number between 1 and 12' }, { status: 400 })
      }
    }

    if (targetScore) {
      const scoreNum = Number(targetScore)
      if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 36) {
        return NextResponse.json({ error: 'Target score must be a valid ACT score between 1 and 36' }, { status: 400 })
      }
    }

    // 2. Duplicate checking
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'A user with this email address already exists' }, { status: 400 })
    }

    // 3. Supabase Auth account creation (using Service Role Key)
    let authUserId: any = randomUUID()
    let supabaseWarning = null
    const supabaseAdmin = createAdminClient()
    const tempPassword = generateTempPassword()

    if (supabaseAdmin) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: name || email.split('@')[0], role: upperRole.toLowerCase() }
      })

      if (authError) {
        console.error('Supabase Auth error:', authError)
        return NextResponse.json({ error: `Supabase Auth: ${authError.message}` }, { status: 400 })
      }

      if (authData?.user?.id) {
        authUserId = authData.user.id
      }
    } else {
      supabaseWarning = 'SUPABASE_SERVICE_ROLE_KEY is missing in backend .env. Created database profile only with generated UUID.'
      console.warn(`WARNING: ${supabaseWarning}`)
    }

    // 4. Create local database user matching the Supabase Auth user ID
    const displayName = name || email.split('@')[0]
    const permissions: Record<string, unknown> = { displayName }
    if (grade) permissions.grade = grade
    if (targetScore) permissions.targetScore = Number(targetScore)
    if (specialization?.length) permissions.specialization = specialization
    if (phone) permissions.phone = phone
    if (parentPhone) permissions.parentPhone = parentPhone
    if (dob) permissions.dob = dob
    if (schoolName) permissions.schoolName = schoolName

    const user = await prisma.user.create({
      data: {
        id: authUserId as any,
        name: name || email.split('@')[0],
        email,
        role: upperRole,
        permissions: Object.keys(permissions).length ? permissions as any : undefined,
      },
    })

    // 5. Assigned tutor relation
    if (tutorId && upperRole === 'STUDENT') {
      await prisma.tutorAssignment.create({
        data: { tutorId, studentId: user.id },
      })
    }

    return NextResponse.json({
      user: { ...user, name: displayName, role: user.role.toLowerCase() },
      tempPassword,
      warning: supabaseWarning
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/users:', error)
    return NextResponse.json({ error: (error as Error).message || 'Failed to create user' }, { status: 500 })
  }
}
