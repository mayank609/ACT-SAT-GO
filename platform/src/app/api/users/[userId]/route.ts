import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { isHomeworkTest, isRawScoredTest } from '@/lib/testCategorize'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function userName(u: { email: string; permissions: unknown }): string {
  const perms = (u.permissions ?? {}) as Record<string, unknown>
  return (perms.displayName as string) ?? u.email.split('@')[0]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  // Hourly rate is compensation data — only ever sent to admin/super-admin callers,
  // never included in a tutor's own view of their (or anyone else's) profile.
  const requester = await getCurrentUser(request)
  const canSeeHourlyRate = requester?.role === 'ADMIN' || requester?.role === 'SUPER_ADMIN'
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tutors: { include: { tutor: { select: { id: true, email: true, permissions: true } } } },
        students: { include: { student: { select: { id: true, email: true } } } },
        attempts: {
          where: { status: 'SUBMITTED' },
          select: { id: true, totalScore: true, completedAt: true, testId: true, test: { select: { title: true, subCategory: true, category: true } } },
          orderBy: { completedAt: 'desc' },
        },
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const perms = (user.permissions ?? {}) as Record<string, unknown>
    const testsAttempted = user.attempts.filter((at) => !isHomeworkTest(at.test)).length
    // Practice Sheet attempts are raw counts, not scaled scores — exclude them from the
    // average so a "17" HW score doesn't drag down a 1400 Mock average.
    const scaledAttempts = user.attempts.filter((at) => !isRawScoredTest(at.test))
    const avgScore = scaledAttempts.length
      ? scaledAttempts.reduce((a, at) => a + (at.totalScore ?? 0), 0) / scaledAttempts.length
      : null

    return NextResponse.json({
      user: {
        id: user.id,
        name: (user as unknown as { name?: string | null }).name ?? perms.displayName as string ?? user.email.split('@')[0],
        email: user.email,
        role: user.role.toLowerCase(),
        createdAt: user.createdAt,
        deletedAt: user.deletedAt,
        // Kept for back-compat with callers that only render one tutor.
        tutorId: user.tutors[0]?.tutor.id ?? null,
        tutorName: user.tutors[0] ? userName(user.tutors[0].tutor as { email: string; permissions: unknown }) : null,
        tutors: user.tutors.map((t) => ({
          id: t.tutor.id,
          name: userName(t.tutor as { email: string; permissions: unknown }),
        })),
        studentIds: user.students.map((s) => s.student.id),
        studentCount: user.students.length,
        testsAttempted,
        avgScore: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
        lastActive: user.attempts[0]?.completedAt ?? null,
        grade: perms.grade ?? null,
        targetScore: perms.targetScore ?? null,
        targetDate: perms.targetDate ?? null,
        specialization: perms.specialization ?? [],
        ...(canSeeHourlyRate ? { hourlyRate: perms.hourlyRate ?? null } : {}),
        phone: perms.phone ?? null,
        parentPhone: perms.parentPhone ?? null,
        dob: perms.dob ?? null,
        schoolName: perms.schoolName ?? null,
        board: perms.board ?? null,
        timezone: perms.timezone ?? null,
        firstClassDate: perms.firstClassDate ?? null,
        programVariant: perms.programVariant ?? null,
        mockVariant: perms.mockVariant ?? null,
        accommodation: perms.accommodation ?? null,
        stage: perms.stage ?? null,
        onboarded: perms.onboarded ?? null,
        diagnosticDecision: perms.diagnosticDecision ?? null,
        manualDiagTotal: perms.manualDiagTotal ?? null,
        manualDiagRW: perms.manualDiagRW ?? null,
        manualDiagMath: perms.manualDiagMath ?? null,
      },
    })
  } catch (error) {
    console.error('GET /api/users/[userId]:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// DELETE /api/users/[userId] — soft-deletes by default (sets deletedAt, can be
// undone via PATCH { restore: true }). Pass ?permanent=true to actually erase
// the row and everything that cascades from it (attempts, assignments, tutor
// links) — irreversible, so the frontend must get explicit confirmation for
// that path separately from the normal "move to trash" delete.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  const { userId } = await params
  const permanent = request.nextUrl.searchParams.get('permanent') === 'true'
  try {
    if (permanent) {
      await prisma.user.delete({ where: { id: userId } })
    } else {
      await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } })
    }
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

  // Users may edit their own profile; staff admins may edit anyone.
  const requester = await getCurrentUser(request)
  if (!requester) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const isAdmin = requester.role === 'ADMIN' || requester.role === 'SUPER_ADMIN'
  if (requester.id !== userId && !isAdmin) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    const body = await request.json()

    // Undo a soft delete. Handled as its own branch — restoring shouldn't
    // require (or accept) any of the profile-field edits below.
    if (body.restore === true) {
      if (!isAdmin) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      const restored = await prisma.user.update({ where: { id: userId }, data: { deletedAt: null } })
      return NextResponse.json({ user: { id: restored.id, deletedAt: null } })
    }

    const {
      name, email, role, grade, targetScore, targetDate, specialization, tutorId, tutorIds, notifications,
      phone, parentPhone, dob, schoolName, diagnosticDecision,
      board, timezone, firstClassDate, programVariant, mockVariant,
      accommodation, stage, onboarded,
      manualDiagTotal, manualDiagRW, manualDiagMath, hourlyRate,
    } = body as {
      name?: string
      email?: string
      role?: string
      grade?: string
      targetScore?: number
      targetDate?: string
      specialization?: string[]
      tutorId?: string | null
      tutorIds?: string[]
      notifications?: Record<string, boolean>
      phone?: string
      parentPhone?: string
      dob?: string
      schoolName?: string
      diagnosticDecision?: string | null
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
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } })
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // 1. Validation for superadmin / admin fields
    if (email !== undefined) {
      if (!isAdmin) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      if (!email) return NextResponse.json({ error: 'Email cannot be empty' }, { status: 400 })
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
      }
      const existingEmail = await prisma.user.findUnique({ where: { email } })
      if (existingEmail && existingEmail.id !== userId) {
        return NextResponse.json({ error: 'A user with this email address already exists' }, { status: 400 })
      }
    }

    if (role !== undefined) {
      if (!isAdmin) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      if (!role) return NextResponse.json({ error: 'Role cannot be empty' }, { status: 400 })
      const upperRole = role.toUpperCase()
      if (!['SUPER_ADMIN', 'ADMIN', 'TUTOR', 'STUDENT'].includes(upperRole)) {
        return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 })
      }
    }

    // 2. Sync with Supabase Auth
    const supabaseAdmin = createAdminClient()
    if (supabaseAdmin) {
      const authUpdate: any = {}
      if (email !== undefined) {
        authUpdate.email = email
        authUpdate.email_confirm = true
      }
      
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
      const existingMetadata = userData?.user?.user_metadata || {}
      const nextMetadata = { ...existingMetadata }
      if (name !== undefined) nextMetadata.name = name
      if (role !== undefined) nextMetadata.role = role.toLowerCase()
      authUpdate.user_metadata = nextMetadata

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate)
      if (updateError) {
        console.error('Supabase Auth update error:', updateError)
        return NextResponse.json({ error: `Supabase Auth Update: ${updateError.message}` }, { status: 400 })
      }
    }

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
    if (targetDate !== undefined) permissions.targetDate = targetDate
    if (diagnosticDecision !== undefined) permissions.diagnosticDecision = diagnosticDecision
    if (board !== undefined) permissions.board = board
    if (timezone !== undefined) permissions.timezone = timezone
    if (firstClassDate !== undefined) permissions.firstClassDate = firstClassDate
    if (programVariant !== undefined) permissions.programVariant = programVariant
    if (mockVariant !== undefined) permissions.mockVariant = mockVariant
    if (accommodation !== undefined) permissions.accommodation = accommodation
    if (stage !== undefined) permissions.stage = stage
    if (onboarded !== undefined) permissions.onboarded = onboarded
    if (manualDiagTotal !== undefined) permissions.manualDiagTotal = manualDiagTotal
    if (manualDiagRW !== undefined) permissions.manualDiagRW = manualDiagRW
    if (manualDiagMath !== undefined) permissions.manualDiagMath = manualDiagMath
    // Compensation data — only an admin/super-admin may set this, never the tutor
    // editing their own profile (the self-edit path above allows requester.id === userId).
    if (isAdmin && hourlyRate !== undefined) permissions.hourlyRate = hourlyRate

    const updateData: any = { permissions: permissions as any }
    if (name !== undefined) updateData.name = name
    if (isAdmin && email !== undefined) updateData.email = email
    if (isAdmin && role !== undefined) updateData.role = role.toUpperCase()

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    if (tutorIds !== undefined) {
      // Reconcile the full set of tutors for this student (a student may have
      // more than one tutor, e.g. one per subject) — add/remove only what
      // changed instead of wiping every assignment on each save.
      const current = await prisma.tutorAssignment.findMany({ where: { studentId: userId }, select: { tutorId: true } })
      const currentIds = new Set(current.map((c) => c.tutorId))
      const nextIds = new Set(tutorIds)
      const toRemove = [...currentIds].filter((id) => !nextIds.has(id))
      const toAdd = [...nextIds].filter((id) => !currentIds.has(id))
      if (toRemove.length) {
        await prisma.tutorAssignment.deleteMany({ where: { studentId: userId, tutorId: { in: toRemove } } })
      }
      if (toAdd.length) {
        await prisma.tutorAssignment.createMany({
          data: toAdd.map((id) => ({ tutorId: id, studentId: userId })),
          skipDuplicates: true,
        })
      }
    } else if (tutorId !== undefined) {
      // Legacy single-tutor path — replaces the entire assignment set with (at most) one tutor.
      await prisma.tutorAssignment.deleteMany({ where: { studentId: userId } })
      if (tutorId) {
        await prisma.tutorAssignment.create({ data: { tutorId, studentId: userId } })
      }
    }

    const tutorRows = (tutorIds !== undefined || tutorId !== undefined)
      ? await prisma.tutorAssignment.findMany({
          where: { studentId: userId },
          include: { tutor: { select: { id: true, email: true, permissions: true } } },
        })
      : null
    const tutors = tutorRows?.map((t) => ({ id: t.tutor.id, name: userName(t.tutor as { email: string; permissions: unknown }) }))

    return NextResponse.json({
      user: {
        id: user.id,
        name: (user as unknown as { name?: string | null }).name ?? permissions.displayName as string ?? user.email.split('@')[0],
        email: user.email,
        role: user.role.toLowerCase(),
        createdAt: user.createdAt,
        ...(tutors ? { tutors, tutorId: tutors[0]?.id ?? null, tutorName: tutors[0]?.name ?? null } : {}),
        grade: permissions.grade ?? null,
        targetScore: permissions.targetScore ?? null,
        targetDate: permissions.targetDate ?? null,
        specialization: permissions.specialization ?? [],
        ...(isAdmin ? { hourlyRate: permissions.hourlyRate ?? null } : {}),
        phone: permissions.phone ?? null,
        parentPhone: permissions.parentPhone ?? null,
        dob: permissions.dob ?? null,
        schoolName: permissions.schoolName ?? null,
        board: permissions.board ?? null,
        timezone: permissions.timezone ?? null,
        firstClassDate: permissions.firstClassDate ?? null,
        programVariant: permissions.programVariant ?? null,
        mockVariant: permissions.mockVariant ?? null,
        accommodation: permissions.accommodation ?? null,
        stage: permissions.stage ?? null,
        onboarded: permissions.onboarded ?? null,
        diagnosticDecision: permissions.diagnosticDecision ?? null,
        manualDiagTotal: permissions.manualDiagTotal ?? null,
        manualDiagRW: permissions.manualDiagRW ?? null,
        manualDiagMath: permissions.manualDiagMath ?? null,
      }
    })
  } catch (error) {
    console.error('PATCH /api/users/[userId]:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
