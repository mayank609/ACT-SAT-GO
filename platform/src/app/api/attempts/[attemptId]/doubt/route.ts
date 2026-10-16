import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, requireAttemptAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params
  const access = await requireAttemptAccess(request, attemptId)
  if (access !== true) return access

  // Only the student or an admin may change Still Doubt / Cleared; tutors can view only.
  const user = await getCurrentUser(request)
  if (user?.role === 'TUTOR') {
    return NextResponse.json({ error: 'Tutors cannot change doubt status' }, { status: 403 })
  }

  try {
    const { questionId, doubtStatus } = (await request.json()) as {
      questionId: string
      doubtStatus: 'doubt' | 'cleared' | null
    }

    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 })
    }

    await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { doubtStatus: doubtStatus ?? null },
      create: {
        attemptId,
        questionId,
        doubtStatus: doubtStatus ?? null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/attempts/[attemptId]/doubt:', error)
    return NextResponse.json({ error: 'Failed to save doubt status' }, { status: 500 })
  }
}
