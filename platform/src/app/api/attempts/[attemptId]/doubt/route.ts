import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params

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
