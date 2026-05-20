import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
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

type FrontendType = 'mcq_single' | 'mcq_multi' | 'numeric'
type FrontendDifficulty = 'easy' | 'medium' | 'hard'

const TYPE_MAP: Record<FrontendType, 'MCQ' | 'MSQ' | 'NUMERIC'> = {
  mcq_single: 'MCQ',
  mcq_multi: 'MSQ',
  numeric: 'NUMERIC',
}

const DIFF_MAP: Record<FrontendDifficulty, 'EASY' | 'MEDIUM' | 'HARD'> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
}

function transformOptions(options: Array<{ id: string; text: string }>): Prisma.InputJsonValue {
  const result: Record<string, string> = {}
  for (const opt of options) result[opt.id.toUpperCase()] = opt.text
  return result as Prisma.InputJsonValue
}

function transformCorrectAnswer(answer: string | string[] | number): Prisma.InputJsonValue {
  if (typeof answer === 'number') return { value: answer } as Prisma.InputJsonValue
  if (Array.isArray(answer)) return { keys: answer.map((k) => k.toUpperCase()) } as Prisma.InputJsonValue
  return { key: answer.toUpperCase() } as Prisma.InputJsonValue
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params

  let body: {
    status?: string
    title?: string
    description?: string
    category?: string
    subCategory?: string
    sections?: Array<{
      name: string
      timeLimit: number
      questions: Array<{
        text: string
        type: FrontendType
        options?: Array<{ id: string; text: string }>
        correctAnswer: string | string[] | number
        topic?: string
        difficulty: FrontendDifficulty
        explanation?: string
        marks?: number
        marksNegative?: number
      }>
    }>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const scalarData: { status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; title?: string; description?: string; category?: string; subCategory?: string } = {}
  if (body.title !== undefined) scalarData.title = body.title
  if (body.description !== undefined) scalarData.description = body.description
  if (body.category !== undefined) scalarData.category = body.category
  if (body.subCategory !== undefined) scalarData.subCategory = body.subCategory
  if (body.status !== undefined) {
    const mapped = STATUS_MAP[body.status.toLowerCase()]
    if (!mapped) return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
    scalarData.status = mapped
  }

  if (!body.sections && Object.keys(scalarData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  try {
    // ── Scalar-only update (status / title / description) ─────────────────────
    if (!body.sections) {
      const test = await prisma.test.update({
        where: { id: testId },
        data: scalarData,
        include: {
          sections: {
            orderBy: { orderIndex: 'asc' },
            include: { _count: { select: { questions: true } } },
          },
          _count: { select: { attempts: true } },
        },
      })
      return NextResponse.json({ test })
    }

    // ── Full sections + questions replacement ─────────────────────────────────
    const allTopics = await prisma.topic.findMany({ select: { id: true, name: true } })
    const topicMap = new Map(allTopics.map((t) => [t.name.toLowerCase(), t.id]))

    const test = await prisma.$transaction(async (tx) => {
      if (Object.keys(scalarData).length > 0) {
        await tx.test.update({ where: { id: testId }, data: scalarData })
      }

      // Delete existing sections (cascades to TestQuestion join rows)
      await tx.testSection.deleteMany({ where: { testId } })

      // Recreate sections and questions
      for (let sIdx = 0; sIdx < body.sections!.length; sIdx++) {
        const sec = body.sections![sIdx]
        const newSection = await tx.testSection.create({
          data: { testId, name: sec.name, durationMinutes: sec.timeLimit, orderIndex: sIdx },
        })

        for (let qIdx = 0; qIdx < sec.questions.length; qIdx++) {
          const q = sec.questions[qIdx]
          const dbType = TYPE_MAP[q.type]
          if (!dbType) throw new Error(`Invalid question type: ${q.type}`)
          const dbDiff = DIFF_MAP[q.difficulty]
          if (!dbDiff) throw new Error(`Invalid difficulty: ${q.difficulty}`)
          const topicId = q.topic ? (topicMap.get(q.topic.toLowerCase()) ?? null) : null

          const newQuestion = await tx.question.create({
            data: {
              type: dbType,
              content: { text: q.text, explanation: q.explanation ?? null } as Prisma.InputJsonValue,
              options: q.options ? transformOptions(q.options) : Prisma.DbNull,
              correctAnswer: transformCorrectAnswer(q.correctAnswer),
              difficultyLevel: dbDiff,
              topicId,
            },
          })

          await tx.testQuestion.create({
            data: {
              testId,
              sectionId: newSection.id,
              questionId: newQuestion.id,
              orderIndex: qIdx,
              marksPositive: q.marks ?? 1,
              marksNegative: q.marksNegative ?? 0,
            },
          })
        }
      }

      return tx.test.findUnique({
        where: { id: testId },
        include: {
          sections: {
            orderBy: { orderIndex: 'asc' },
            include: { _count: { select: { questions: true } } },
          },
          _count: { select: { attempts: true } },
        },
      })
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
