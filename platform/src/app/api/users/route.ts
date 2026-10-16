import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { isHomeworkTest, isRawScoredTest } from '@/lib/testCategorize'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['STUDENT', 'TUTOR', 'ADMIN', 'SUPER_ADMIN'] as const
type ValidRole = (typeof VALID_ROLES)[number]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')
  const wantsDeleted = searchParams.get('deleted') === 'true'
  // Free-demo-test signups are STUDENT rows flagged permissions.accountType = 'DEMO'.
  // They live on the "Free Test Leads" page, so keep them out of the regular student
  // lists unless explicitly requested.
  const includeDemo = searchParams.get('includeDemo') === 'true'

  if (role !== null && !VALID_ROLES.includes(role as ValidRole)) {
    return NextResponse.json({ error: 'Invalid role value' }, { status: 400 })
  }

  // Hourly rate is compensation data — only ever sent to admin/super-admin callers,
  // never included in a tutor's own view of their (or anyone else's) profile.
  const requester = await getCurrentUser(request)
  const canSeeHourlyRate = requester?.role === 'ADMIN' || requester?.role === 'SUPER_ADMIN'

  // The trash view (soft-deleted users, for restore/permanent-delete) is admin-only.
  if (wantsDeleted && !canSeeHourlyRate) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role: role as ValidRole } : {}),
        deletedAt: wantsDeleted ? { not: null } : null,
      },
      include: {
        tutors: { include: { tutor: { select: { id: true, email: true, permissions: true } } } },
        students: { include: { student: { select: { id: true, email: true } } } },
        attempts: {
          where: { status: 'SUBMITTED' },
          select: { totalScore: true, completedAt: true, testId: true, test: { select: { title: true, subCategory: true, category: true } } },
          orderBy: { completedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const visibleUsers = includeDemo
      ? users
      : users.filter((u) => ((u.permissions ?? {}) as Record<string, unknown>).accountType !== 'DEMO')

    // Max marks for the custom-exam tests custom students took (one query), so their
    // average can be shown as a percentage — see lib/customScores.ts.
    const customTestIds = visibleUsers
      .filter((u) => ((u.permissions ?? {}) as Record<string, unknown>).track === 'CUSTOM')
      .flatMap((u) => u.attempts.filter((a) => (a.test.category ?? '').toLowerCase() === 'custom').map((a) => a.testId))
    const customMaxMarks = await maxMarksByTest(customTestIds)

    return NextResponse.json({
      users: visibleUsers.map((u) => {
        const perms = (u.permissions ?? {}) as Record<string, unknown>
        const submittedAttempts = u.attempts
        const testsAttempted = submittedAttempts.filter((at) => !isHomeworkTest(at.test)).length
        // Practice Sheet attempts are raw counts, not scaled scores — averaging them in
        // with Mock/Sectional scores would be meaningless (e.g. a "17" HW score dragging
        // down a 1400 average).
        const scaledAttempts = submittedAttempts.filter((at) => !isRawScoredTest(at.test))
        const avgScore = perms.track === 'CUSTOM'
          ? averagePercent(submittedAttempts, customMaxMarks)
          : scaledAttempts.length
            ? scaledAttempts.reduce((a, at) => a + (at.totalScore ?? 0), 0) / scaledAttempts.length
            : null
        const tutorUsers = u.tutors.map((t) => t.tutor)
        const tutorNameOf = (tu: (typeof tutorUsers)[number]) =>
          (tu as unknown as { permissions?: Record<string, unknown> }).permissions?.displayName as string ?? tu.email.split('@')[0]
        const tutorUser = tutorUsers[0]
        // Try to get tutor's displayName if we queried their permissions
        const tutorName = tutorUser ? tutorNameOf(tutorUser) : null
        return {
          id: u.id,
          name: (u as unknown as { name?: string | null }).name ?? perms.displayName as string ?? u.email.split('@')[0],
          email: u.email,
          role: u.role.toLowerCase(),
          isDemo: perms.accountType === 'DEMO',
          canAddStudents: perms.canAddStudents === true,
          coordinator: perms.coordinator === true,
          avatar: (perms.avatar as string | undefined) ?? null,
          createdAt: u.createdAt,
          deletedAt: u.deletedAt,
          // Kept for back-compat with callers that only render one tutor.
          tutorId: tutorUser?.id ?? null,
          tutorName,
          tutors: tutorUsers.map((tu) => ({ id: tu.id, name: tutorNameOf(tu) })),
          studentIds: u.students.map((s) => s.student.id),
          studentCount: u.students.length,
          testsAttempted,
          avgScore: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
          lastActive: submittedAttempts[0]?.completedAt ?? null,
          grade: perms.grade ?? null,
          targetScore: perms.targetScore ?? null,
          targetDate: perms.targetDate ?? null,
          ...(canSeeHourlyRate ? {
            hourlyRate: perms.hourlyRate ?? null,
            salarySettlements: perms.salarySettlements ?? [],
            paidSessionIds: perms.paidSessionIds ?? [],
          } : {}),
          phone: perms.phone ?? null,
          parentPhone: perms.parentPhone ?? null,
          dob: perms.dob ?? null,
          schoolName: perms.schoolName ?? null,
          board: perms.board ?? null,
          timezone: perms.timezone ?? null,
          specialization: perms.specialization ?? [],
          firstClassDate: perms.firstClassDate ?? null,
          programVariant: perms.programVariant ?? null,
          track: perms.track ?? null,
          customExam: perms.customExam ?? null,
          mockVariant: perms.mockVariant ?? null,
          accommodation: perms.accommodation ?? null,
          stage: perms.stage ?? null,
          onboarded: perms.onboarded ?? null,
          diagnosticDecision: perms.diagnosticDecision ?? null,
          manualDiagTotal: perms.manualDiagTotal ?? null,
          manualDiagRW: perms.manualDiagRW ?? null,
          manualDiagMath: perms.manualDiagMath ?? null,
        }
      }),
    })
  } catch (error) {
    console.error('GET /api/users:', error)
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({ error: 'Failed to fetch users', message: (error as any)?.message, stack: (error as any)?.stack }, { status: 500 })
    }
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'crypto'
import { generateTempPassword } from '@/lib/tempPassword'
import { parseTrack, targetScoreError } from '@/lib/examTrack'
import { averagePercent, maxMarksByTest } from '@/lib/customScores'

export async function POST(request: NextRequest) {
  try {
    // Staff admins may create any user. A tutor may create STUDENT accounts only
    // when an admin turned on "Can add student accounts" (permissions.canAddStudents);
    // those students are assigned to that tutor. A coordinator (a TUTOR flagged
    // permissions.coordinator by an admin) may create students and tutors; tutors it
    // creates can never add students themselves.
    const requester = await getCurrentUser(request)
    if (!requester) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const isAdmin = requester.role === 'ADMIN' || requester.role === 'SUPER_ADMIN'
    const requesterPerms = (requester.permissions ?? {}) as Record<string, unknown>
    const isCoordinator = requester.role === 'TUTOR' && requesterPerms.coordinator === true
    const tutorMayAdd = requester.role === 'TUTOR' && (requesterPerms.canAddStudents === true || isCoordinator)
    if (!isAdmin && !tutorMayAdd) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name, email, role, grade, targetScore, targetDate, tutorId, tutorIds, specialization,
      phone, parentPhone, dob, schoolName, board, timezone, firstClassDate,
      programVariant, mockVariant, accommodation, stage, onboarded,
      manualDiagTotal, manualDiagRW, manualDiagMath, hourlyRate, canAddStudents, coordinator, track, customExam,
    } = body as {
      name: string
      email: string
      role: string
      grade?: string
      targetScore?: number
      targetDate?: string
      tutorId?: string
      tutorIds?: string[]
      specialization?: string[]
      phone?: string
      parentPhone?: string
      dob?: string
      schoolName?: string
      board?: string
      timezone?: string
      firstClassDate?: string
      programVariant?: string
      mockVariant?: string
      accommodation?: boolean
      stage?: number
      onboarded?: boolean
      manualDiagTotal?: number | null
      manualDiagRW?: number | null
      manualDiagMath?: number | null
      hourlyRate?: number | null
      canAddStudents?: boolean
      coordinator?: boolean
      track?: string | null
      customExam?: string | null
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
    if (!isAdmin && upperRole !== 'STUDENT' && !(isCoordinator && upperRole === 'TUTOR')) {
      return NextResponse.json({ error: 'You can only add student accounts' }, { status: 403 })
    }

    if (grade) {
      const gradeNum = parseInt(grade, 10)
      if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 12) {
        return NextResponse.json({ error: 'Grade must be a number between 1 and 12' }, { status: 400 })
      }
    }

    const parsedTrack = parseTrack(track, customExam)
    if ('error' in parsedTrack) return NextResponse.json({ error: parsedTrack.error }, { status: 400 })

    if (targetScore) {
      const scoreError = targetScoreError(Number(targetScore), parsedTrack.value.track)
      if (scoreError) return NextResponse.json({ error: scoreError }, { status: 400 })
    }

    // 2. Duplicate checking
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      const msg = existingUser.deletedAt
        ? 'A deleted user with this email is still in the trash — restore them instead of creating a new account, or permanently delete them first.'
        : 'A user with this email address already exists'
      return NextResponse.json({ error: msg }, { status: 400 })
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
    // A temporary password was issued: ask for a new one on first login.
    if (supabaseAdmin) permissions.mustChangePassword = true
    if (grade) permissions.grade = grade
    if (targetScore) permissions.targetScore = Number(targetScore)
    if (specialization?.length) permissions.specialization = specialization
    if (phone) permissions.phone = phone
    if (parentPhone) permissions.parentPhone = parentPhone
    if (dob) permissions.dob = dob
    if (schoolName) permissions.schoolName = schoolName
    if (targetDate) permissions.targetDate = targetDate
    if (board) permissions.board = board
    if (timezone) permissions.timezone = timezone
    if (firstClassDate) permissions.firstClassDate = firstClassDate
    if (programVariant) permissions.programVariant = programVariant
    if (upperRole === 'STUDENT' && parsedTrack.value.track) {
      permissions.track = parsedTrack.value.track
      if (parsedTrack.value.customExam) permissions.customExam = parsedTrack.value.customExam
    }
    if (mockVariant) permissions.mockVariant = mockVariant
    if (accommodation !== undefined) permissions.accommodation = accommodation
    if (stage !== undefined) permissions.stage = stage
    if (onboarded !== undefined) permissions.onboarded = onboarded
    if (manualDiagTotal != null) permissions.manualDiagTotal = manualDiagTotal
    if (manualDiagRW != null) permissions.manualDiagRW = manualDiagRW
    if (manualDiagMath != null) permissions.manualDiagMath = manualDiagMath
    // Compensation data — only meaningful (and only ever stored) for tutors.
    if (upperRole === 'TUTOR' && hourlyRate != null) permissions.hourlyRate = Number(hourlyRate)
    if (upperRole === 'TUTOR') {
      if (isAdmin && coordinator === true) {
        permissions.coordinator = true
        permissions.canAddStudents = true
      } else {
        permissions.canAddStudents = isAdmin && canAddStudents === true
      }
    }

    const user = await prisma.user.create({
      data: {
        id: authUserId as any,
        name: name || email.split('@')[0],
        email,
        role: upperRole,
        permissions: Object.keys(permissions).length ? permissions as any : undefined,
      },
    })

    // 5. Assigned tutor relation(s) — a student may have more than one tutor.
    if (upperRole === 'STUDENT') {
      const ids = isAdmin || isCoordinator
        ? Array.from(new Set(tutorIds?.length ? tutorIds : tutorId ? [tutorId] : []))
        : [requester.id]
      if (ids.length) {
        await prisma.tutorAssignment.createMany({
          data: ids.map((id) => ({ tutorId: id, studentId: user.id })),
          skipDuplicates: true,
        })
      }
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
