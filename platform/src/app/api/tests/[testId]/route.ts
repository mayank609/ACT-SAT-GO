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

// ── PATCH ─────────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'> = {
  draft: 'DRAFT',
  published: 'PUBLISHED',
  archived: 'ARCHIVED',
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params

  let body: { status?: string; title?: string; description?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const data: { status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; title?: string; description?: string } = {}

  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description
  if (body.status !== undefined) {
    const mapped = STATUS_MAP[body.status.toLowerCase()]
    if (!mapped) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
    }
    data.status = mapped
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  try {
    const test = await prisma.test.update({
      where: { id: testId },
      data,
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: { _count: { select: { questions: true } } },
        },
        _count: { select: { attempts: true } },
      },
    })
    return NextResponse.json({ test })
  } catch (error) {
    console.error('PATCH /api/tests/[testId]:', error)
    return NextResponse.json({ error: 'Failed to update test' }, { status: 500 })
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params

  try {
    await prisma.test.delete({ where: { id: testId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/tests/[testId]:', error)
    return NextResponse.json({ error: 'Failed to delete test' }, { status: 500 })
  }
}
