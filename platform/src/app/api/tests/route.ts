import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

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
type FrontendType = 'mcq_single' | 'mcq_multi' | 'numeric' | 'passage'
type FrontendDifficulty = 'easy' | 'medium' | 'hard'

const STATUS_MAP: Record<FrontendStatus, 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'> = {
  draft: 'DRAFT',
  published: 'PUBLISHED',
  archived: 'ARCHIVED',
}

const TYPE_MAP: Record<FrontendType, 'MCQ' | 'MSQ' | 'NUMERIC' | 'PASSAGE'> = {
  mcq_single: 'MCQ',
  mcq_multi: 'MSQ',
  numeric: 'NUMERIC',
  passage: 'PASSAGE',
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
  subTopic?: string
  skill?: string
  difficulty: FrontendDifficulty
  explanation?: string
  marks?: number
  marksNegative?: number
  linkedQuestions?: FrontendQuestion[]
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

    // Precompute every row with explicit ids so the whole create is a short
    // batched transaction (createMany), instead of 2-3 sequential queries per
    // question — which blew Prisma's interactive-transaction timeout on large
    // (e.g. PDF-imported) tests.
    const testId = randomUUID()
    const sectionRows: Prisma.TestSectionCreateManyInput[] = []
    const parentRows: Prisma.QuestionCreateManyInput[] = []
    const childRows: Prisma.QuestionCreateManyInput[] = []
    const testQuestionRows: Prisma.TestQuestionCreateManyInput[] = []

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const sec = sections[sIdx]
      const sectionId = randomUUID()
      sectionRows.push({ id: sectionId, testId, name: sec.name, durationMinutes: sec.timeLimit, orderIndex: sIdx })

      for (let qIdx = 0; qIdx < sec.questions.length; qIdx++) {
        const q = sec.questions[qIdx]

        const dbType = TYPE_MAP[q.type]
        if (!dbType) throw new Error(`Invalid question type: ${q.type}`)
        const dbDiff = DIFF_MAP[q.difficulty]
        if (!dbDiff) throw new Error(`Invalid difficulty: ${q.difficulty}`)
        const topicId = q.topic ? (topicMap.get(q.topic.toLowerCase()) ?? null) : null

        // Temporary fallback: some DBs may not have PASSAGE in enum yet.
        // Store passage items as MCQ and mark in content.meta.isPassage to avoid Prisma enum errors.
        const isPassage = dbType === 'PASSAGE'
        const questionId = randomUUID()
        parentRows.push({
          id: questionId,
          type: (isPassage ? 'MCQ' : dbType) as any,
          content: {
            text: q.text,
            explanation: q.explanation ?? null,
            meta: {
              ...(isPassage ? { isPassage: true } : {}),
              domain: q.topic ?? null,
              subTopic: q.subTopic ?? null,
              skill: q.skill ?? null,
            },
          } as Prisma.InputJsonValue,
          options: q.options ? transformOptions(q.options) : undefined,
          correctAnswer: transformCorrectAnswer(q.correctAnswer),
          difficultyLevel: dbDiff,
          topicId,
        })

        if (isPassage && q.linkedQuestions && Array.isArray(q.linkedQuestions)) {
          for (const child of q.linkedQuestions) {
            // No TestQuestion row for child questions — they belong to the test
            // via their passage parent's childQuestions relation. Creating a row
            // here would double-count the passage everywhere it's read.
            childRows.push({
              id: randomUUID(),
              type: (TYPE_MAP[child.type] || 'MCQ') as any,
              content: {
                text: child.text,
                explanation: child.explanation ?? null,
                meta: {
                  domain: child.topic ?? null,
                  subTopic: child.subTopic ?? null,
                  skill: child.skill ?? null,
                },
              } as Prisma.InputJsonValue,
              options: child.options ? transformOptions(child.options) : undefined,
              correctAnswer: transformCorrectAnswer(child.correctAnswer),
              difficultyLevel: (DIFF_MAP[child.difficulty] || 'MEDIUM') as any,
              topicId: child.topic ? (topicMap.get(child.topic.toLowerCase()) ?? null) : null,
              parentQuestionId: questionId,
            })
          }
        }

        testQuestionRows.push({
          testId,
          sectionId,
          questionId,
          orderIndex: qIdx,
          marksPositive: q.marks ?? 1,
          marksNegative: q.marksNegative ?? 0,
        })
      }
    }

    await prisma.$transaction([
      prisma.test.create({
        data: {
          id: testId,
          title,
          description: description ?? null,
          status: dbStatus,
          category: category ?? null,
          subCategory: subCategory ?? null,
          createdById,
        },
      }),
      ...(sectionRows.length ? [prisma.testSection.createMany({ data: sectionRows })] : []),
      // Parents before children so parentQuestionId FK references resolve.
      ...(parentRows.length ? [prisma.question.createMany({ data: parentRows })] : []),
      ...(childRows.length ? [prisma.question.createMany({ data: childRows })] : []),
      ...(testQuestionRows.length ? [prisma.testQuestion.createMany({ data: testQuestionRows })] : []),
    ])

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: { _count: { select: { questions: true } } },
        },
        _count: { select: { attempts: true } },
      },
    })

    return NextResponse.json({ test }, { status: 201 })
  } catch (error) {
    console.error('POST /api/tests:', error)
    return NextResponse.json({ error: 'Failed to create test' }, { status: 500 })
  }
}
