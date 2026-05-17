import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params

  try {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: {
            questions: {
              orderBy: { orderIndex: 'asc' },
              include: { question: true },
            },
          },
        },
      },
    })
    if (!test) return NextResponse.json({ error: 'Test not found' }, { status: 404 })
    return NextResponse.json({ test })
  } catch (error) {
    console.error('GET /api/tests/[testId]:', error)
    return NextResponse.json({ error: 'Failed to fetch test' }, { status: 500 })
  }
}
