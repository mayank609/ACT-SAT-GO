import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type UserRow = { id: string; email: string; permissions: unknown }

function userName(u: UserRow): string {
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
        tutor: { select: { id: true, email: true, permissions: true } },
        student: {
          select: {
            id: true, email: true, permissions: true, role: true,
            attempts: {
              where: { status: 'SUBMITTED' },
              select: { totalScore: true, completedAt: true },
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
        const studentAttempts = (a.student as unknown as { attempts: { totalScore: number | null; completedAt: Date | null }[] }).attempts ?? []
        const avgScore = studentAttempts.length
          ? studentAttempts.reduce((x, at) => x + (at.totalScore ?? 0), 0) / studentAttempts.length
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
            testsAttempted: studentAttempts.length,
            avgScore: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
            lastActive: studentAttempts[0]?.completedAt ?? null,
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
