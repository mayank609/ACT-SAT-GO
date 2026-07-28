import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { isHomeworkTest, isRawScoredTest } from '@/lib/testCategorize'

export const dynamic = 'force-dynamic'

type UserRow = { id: string; name?: string | null; email: string; permissions: unknown }

function userName(u: UserRow): string {
  if (u.name) return u.name
  const perms = (u.permissions ?? {}) as Record<string, unknown>
  return (perms.displayName as string) ?? u.email.split('@')[0]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tutorId = searchParams.get('tutorId')
  const studentId = searchParams.get('studentId')

  try {
    const assignments = await prisma.tutorAssignment.findMany({
      where: {
        ...(tutorId ? { tutorId } : {}),
        ...(studentId ? { studentId } : {}),
      },
      include: {
        tutor: { select: { id: true, name: true, email: true, permissions: true } },
        student: {
          select: {
            id: true, name: true, email: true, permissions: true, role: true,
            attempts: {
              where: { status: 'SUBMITTED' },
              select: { totalScore: true, completedAt: true, test: { select: { title: true, subCategory: true, category: true } } },
              orderBy: { completedAt: 'desc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      assignments: assignments.map((a) => {
        const sp = (a.student.permissions ?? {}) as Record<string, unknown>
        const studentAttempts = (a.student as unknown as { attempts: { totalScore: number | null; completedAt: Date | null; test: { title: string | null; subCategory: string | null; category: string | null } | null }[] }).attempts ?? []
        const testsAttempted = studentAttempts.filter((at) => !isHomeworkTest(at.test)).length
        // Practice Sheet attempts are raw counts, not scaled scores — exclude them from the average.
        const scaledAttempts = studentAttempts.filter((at) => !isRawScoredTest(at.test))
        const avgScore = scaledAttempts.length
          ? scaledAttempts.reduce((x, at) => x + (at.totalScore ?? 0), 0) / scaledAttempts.length
          : null
        return {
          id: `${a.tutorId}_${a.studentId}`,
          tutorId: a.tutorId,
          studentId: a.studentId,
          tutor: { id: a.tutor.id, name: userName(a.tutor as UserRow), email: a.tutor.email },
          student: {
            id: a.student.id,
            name: userName(a.student as UserRow),
            email: a.student.email,
            role: (a.student.role as string).toLowerCase(),
            grade: sp.grade ?? null,
            targetScore: sp.targetScore ?? null,
            specialization: sp.specialization ?? [],
            testsAttempted,
            avgScore: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
            lastActive: studentAttempts[0]?.completedAt ?? null,
            diagnosticDecision: sp.diagnosticDecision ?? null,
          },
        }
      }),
    })
  } catch (error) {
    console.error('GET /api/tutor-assignments:', error)
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth
  try {
    const { tutorId, studentId } = await request.json() as { tutorId: string; studentId: string }
    if (!tutorId || !studentId) {
      return NextResponse.json({ error: 'tutorId and studentId required' }, { status: 400 })
    }

    const assignment = await prisma.tutorAssignment.upsert({
      where: { tutorId_studentId: { tutorId, studentId } },
      update: {},
      create: { tutorId, studentId },
    })
    return NextResponse.json({ assignment }, { status: 201 })
  } catch (error) {
    console.error('POST /api/tutor-assignments:', error)
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'SUPER_ADMIN'])
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const tutorId = searchParams.get('tutorId')
  const studentId = searchParams.get('studentId')

  if (!tutorId || !studentId) {
    return NextResponse.json({ error: 'tutorId and studentId required' }, { status: 400 })
  }

  try {
    await prisma.tutorAssignment.delete({
      where: { tutorId_studentId: { tutorId, studentId } },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/tutor-assignments:', error)
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 })
  }
}
