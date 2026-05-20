import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const all = searchParams.get('all') === 'true'
  const category = searchParams.get('category')
  const subCategory = searchParams.get('subCategory')

  try {
    const tests = await prisma.test.findMany({
      where: {
        ...(all ? {} : { status: 'PUBLISHED' }),
        ...(category ? { category: { equals: category, mode: 'insensitive' } } : {}),
        ...(subCategory ? { subCategory: { equals: subCategory, mode: 'insensitive' } } : {}),
      },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: { _count: { select: { questions: true } } },
        },
        _count: { select: { attempts: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ tests })
  } catch (error) {
    console.error('GET /api/tests:', error)
    return NextResponse.json({ error: 'Failed to fetch tests' }, { status: 500 })
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

type FrontendStatus = 'draft' | 'published' | 'archived'
type FrontendType = 'mcq_single' | 'mcq_multi' | 'numeric'
type FrontendDifficulty = 'easy' | 'medium' | 'hard'

const STATUS_MAP: Record<FrontendStatus, 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'> = {
  draft: 'DRAFT',
  published: 'PUBLISHED',
  archived: 'ARCHIVED',
}

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

function transformOptions(
  options: Array<{ id: string; text: string }>,
): Prisma.InputJsonValue {
  const result: Record<string, string> = {}
  for (const opt of options) {
    result[opt.id.toUpperCase()] = opt.text
  }
  return result as Prisma.InputJsonValue
}

function transformCorrectAnswer(
  answer: string | string[] | number,
): Prisma.InputJsonValue {
  if (typeof answer === 'number') return { value: answer } as Prisma.InputJsonValue
  if (Array.isArray(answer))
    return { keys: answer.map((k) => k.toUpperCase()) } as Prisma.InputJsonValue
  return { key: answer.toUpperCase() } as Prisma.InputJsonValue
}

interface FrontendQuestion {
  text: string
  type: FrontendType
  options?: Array<{ id: string; text: string }>
  correctAnswer: string | string[] | number
  topic?: string
  difficulty: FrontendDifficulty
  explanation?: string
  marks?: number
  marksNegative?: number
}

interface FrontendSection {
  name: string
  timeLimit: number
  questions: FrontendQuestion[]
}

interface PostBody {
  title: string
  description?: string
  status: FrontendStatus
  category?: string
  subCategory?: string
  createdById: string
  sections: FrontendSection[]
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, description, status, category, subCategory, createdById, sections } = body

  if (!title || !status || !createdById || !Array.isArray(sections)) {
    return NextResponse.json(
      { error: 'title, status, createdById, and sections are required' },
      { status: 400 },
    )
  }

  const dbStatus = STATUS_MAP[status]
  if (!dbStatus) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
  }

  try {
    // Load all topics once for name → id resolution
    const allTopics = await prisma.topic.findMany({ select: { id: true, name: true } })
    const topicMap = new Map(allTopics.map((t) => [t.name.toLowerCase(), t.id]))

    const test = await prisma.$transaction(async (tx) => {
      // 1. Create the test
      const newTest = await tx.test.create({
        data: {
          title,
          description: description ?? null,
          status: dbStatus,
          category: category ?? null,
          subCategory: subCategory ?? null,
          createdById,
        },
      })

      // 2. Create sections, questions, and TestQuestion join rows
      for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        const sec = sections[sIdx]

        const newSection = await tx.testSection.create({
          data: {
            testId: newTest.id,
            name: sec.name,
            durationMinutes: sec.timeLimit,
            orderIndex: sIdx,
          },
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
              testId: newTest.id,
              sectionId: newSection.id,
              questionId: newQuestion.id,
              orderIndex: qIdx,
              marksPositive: q.marks ?? 1,
              marksNegative: q.marksNegative ?? 0,
            },
          })
        }
      }

      // 3. Return the full test with sections
      return tx.test.findUnique({
        where: { id: newTest.id },
        include: {
          sections: {
            orderBy: { orderIndex: 'asc' },
            include: { _count: { select: { questions: true } } },
          },
          _count: { select: { attempts: true } },
        },
      })
    })

    return NextResponse.json({ test }, { status: 201 })
  } catch (error) {
    console.error('POST /api/tests:', error)
    return NextResponse.json({ error: 'Failed to create test' }, { status: 500 })
  }
}
