import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { parseNumericValue } from '@/lib/numericAnswer'

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
              include: {
                question: {
                  include: {
                    topic: true,
                    childQuestions: {
                      orderBy: { createdAt: 'asc' },
                      include: { topic: true },
                    },
                    parentQuestion: true,
                  },
                },
              },
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

type FrontendType = 'mcq_single' | 'mcq_multi' | 'numeric' | 'passage'
type FrontendDifficulty = 'easy' | 'medium' | 'hard'

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

function transformOptions(options: Array<{ id: string; text: string }>): Prisma.InputJsonValue {
  const result: Record<string, string> = {}
  for (const opt of options) result[opt.id.toUpperCase()] = opt.text
  return result as Prisma.InputJsonValue
}

function transformCorrectAnswer(
  answer: string | string[] | number | number[] | null | undefined,
  dbType: 'MCQ' | 'MSQ' | 'NUMERIC' | 'PASSAGE',
  displayValues?: string[],
): Prisma.InputJsonValue {
  if (answer === null || answer === undefined) return { key: 'A' } as Prisma.InputJsonValue
  if (dbType === 'NUMERIC') {
    // See platform/src/app/api/tests/route.ts transformCorrectAnswer for the
    // rationale — `value` stays the primary/representative accepted value so
    // every existing grading/display path keeps working; `values` (when there's
    // more than one distinct accepted value) is the full set, for grading only.
    const raw = Array.isArray(answer) ? answer : [answer]
    const nums = raw.map((v) => parseNumericValue(v)).filter((n): n is number => n !== null)
    const unique = [...new Set(nums)]
    const values = unique.length ? unique : [0]
    // The editor lets an admin type "3/4" — parsing it to 0.75 for grading must
    // not erase that original form, or every reload silently rewrites fractions
    // to decimals. displayValues carries the as-typed strings, aligned to values
    // by dedup order; grading never reads it, only the editor's re-population.
    const display = Array.isArray(displayValues) && displayValues.length === unique.length ? displayValues : undefined
    return {
      value: values[0],
      ...(values.length > 1 ? { values } : {}),
      ...(display ? { displayValues: display } : {}),
    } as Prisma.InputJsonValue
  }
  if (typeof answer === 'number') {
    return { value: isNaN(answer) ? 0 : answer } as Prisma.InputJsonValue
  }
  if (Array.isArray(answer)) {
    const keys = answer.filter(Boolean).map((k) => String(k).toUpperCase())
    return { keys: keys.length ? keys : ['A'] } as Prisma.InputJsonValue
  }
  return { key: (answer || 'A').toUpperCase() } as Prisma.InputJsonValue
}

interface FrontendQuestion {
  id?: string
  text: string
  type: FrontendType
  options?: Array<{ id: string; text: string }>
  correctAnswer: string | string[] | number | number[]
  correctAnswerDisplay?: string[]
  topic?: string
  subTopic?: string
  skill?: string
  difficulty: FrontendDifficulty
  explanation?: string
  marks?: number
  marksNegative?: number
  linkedQuestions?: FrontendQuestion[]
}

// Existing DB questions carry a real UUID; questions newly added in the editor
// carry a short client-generated id. Reusing the real UUID on save keeps prior
// attempt answers (which reference questionId) linked, so analytics survive edits.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
      config?: any
      questions: Array<FrontendQuestion>
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
  if (body.status !== undefined && typeof body.status === 'string') {
    const mapped = STATUS_MAP[body.status.toLowerCase()]
    if (mapped) scalarData.status = mapped
  }

  try {
    // If no sections provided, only update scalar fields
    if (!body.sections || body.sections.length === 0) {
      if (Object.keys(scalarData).length === 0) {
        return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
      }
      const updated = await prisma.test.update({ where: { id: testId }, data: scalarData })
      return NextResponse.json({ test: updated })
    }

    // ── Full sections + questions replacement ─────────────────────────────────
    // Everything is precomputed up front (one topic fetch + one existence check
    // for all reusable UUIDs), then executed as a single batched transaction
    // pipeline. The previous interactive-transaction version issued 4-5
    // sequential round-trips per question and timed out on large tests.
    const allTopics = await prisma.topic.findMany({ select: { id: true, name: true } })
    const topicMap = new Map(allTopics.map((t) => [t.name.toLowerCase(), t.id]))

    // One query to learn which editor-sent UUIDs actually exist in the DB.
    const candidateIds: string[] = []
    for (const sec of body.sections!) {
      for (const q of sec.questions) {
        if (q.id && UUID_RE.test(q.id)) candidateIds.push(q.id)
        for (const child of q.linkedQuestions ?? []) {
          if (child.id && UUID_RE.test(child.id)) candidateIds.push(child.id)
        }
      }
    }
    // Full rows so unchanged questions can skip their UPDATE statement entirely
    // — for a typical edit this collapses ~100 statements down to a handful.
    const existingRows = candidateIds.length
      ? await prisma.question.findMany({
          where: { id: { in: candidateIds } },
          select: { id: true, type: true, content: true, options: true, correctAnswer: true, difficultyLevel: true, topicId: true, parentQuestionId: true },
        })
      : []
    const existingById = new Map(existingRows.map((r) => [r.id, r]))
    const existingIds = new Set(existingRows.map((r) => r.id))

    const isUnchanged = (id: string, data: { type: any; content: unknown; options: unknown; correctAnswer: unknown; difficultyLevel: any; topicId: string | null; parentQuestionId: string | null }) => {
      const row = existingById.get(id)
      if (!row) return false
      const newOptions = data.options === Prisma.DbNull ? null : data.options
      return (
        row.type === data.type &&
        row.difficultyLevel === data.difficultyLevel &&
        row.topicId === data.topicId &&
        row.parentQuestionId === data.parentQuestionId &&
        JSON.stringify(row.content) === JSON.stringify(data.content) &&
        JSON.stringify(row.options) === JSON.stringify(newOptions) &&
        JSON.stringify(row.correctAnswer) === JSON.stringify(data.correctAnswer)
      )
    }

    const buildQuestionData = (q: FrontendQuestion, parentQuestionId: string | null) => {
      const dbType = TYPE_MAP[q.type]
      if (!dbType) throw new Error(`Invalid question type: ${q.type}`)
      const dbDiff = DIFF_MAP[q.difficulty]
      if (!dbDiff) throw new Error(`Invalid difficulty: ${q.difficulty}`)
      // Temporary fallback: if DB doesn't accept PASSAGE enum, store as MCQ and mark content.meta.isPassage
      const isPassage = dbType === 'PASSAGE'
      return {
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
        options: q.options ? transformOptions(q.options) : Prisma.DbNull,
        correctAnswer: transformCorrectAnswer(q.correctAnswer, dbType, q.correctAnswerDisplay),
        difficultyLevel: dbDiff as any,
        topicId: q.topic ? (topicMap.get(q.topic.toLowerCase()) ?? null) : null,
        parentQuestionId,
      }
    }

    // Pre-assign every id so creates can be batched with createMany.
    const sectionRows: Prisma.TestSectionCreateManyInput[] = []
    const parentCreates: Prisma.QuestionCreateManyInput[] = []
    const childCreates: Prisma.QuestionCreateManyInput[] = []
    const updates: Array<{ id: string; data: ReturnType<typeof buildQuestionData> }> = []
    const testQuestionRows: Prisma.TestQuestionCreateManyInput[] = []
    const reusedParentIds: string[] = []
    const keptChildIdsByParent = new Map<string, string[]>()

    for (let sIdx = 0; sIdx < body.sections!.length; sIdx++) {
      const sec = body.sections![sIdx]
      const sectionId = randomUUID()
      sectionRows.push({ id: sectionId, testId, name: sec.name, durationMinutes: sec.timeLimit, orderIndex: sIdx, config: sec.config ?? null })

      for (let qIdx = 0; qIdx < sec.questions.length; qIdx++) {
        const q = sec.questions[qIdx]
        const isPassage = TYPE_MAP[q.type] === 'PASSAGE'
        // Reuse the existing Question row when the editor sent a real UUID, so
        // prior attempt answers stay linked; otherwise create a new one.
        const reuse = !!(q.id && UUID_RE.test(q.id) && existingIds.has(q.id))
        const parentId = reuse ? q.id! : randomUUID()
        const parentData = buildQuestionData(q, null)
        if (reuse) {
          if (!isUnchanged(parentId, parentData)) updates.push({ id: parentId, data: parentData })
          reusedParentIds.push(parentId)
          keptChildIdsByParent.set(parentId, [])
        } else {
          parentCreates.push({ id: parentId, ...parentData, options: parentData.options === Prisma.DbNull ? undefined : parentData.options })
        }

        if (isPassage && Array.isArray(q.linkedQuestions)) {
          for (const child of q.linkedQuestions) {
            const childReuse = !!(child.id && UUID_RE.test(child.id) && existingIds.has(child.id))
            const childId = childReuse ? child.id! : randomUUID()
            const childData = buildQuestionData(
              { ...child, type: TYPE_MAP[child.type] ? child.type : 'mcq_single', difficulty: DIFF_MAP[child.difficulty] ? child.difficulty : 'medium' },
              parentId
            )
            // No TestQuestion row for child questions — they belong to the test via
            // the passage parent's childQuestions relation; a row would double-count.
            if (childReuse) {
              if (!isUnchanged(childId, childData)) updates.push({ id: childId, data: childData })
            } else {
              childCreates.push({ id: childId, ...childData, options: childData.options === Prisma.DbNull ? undefined : childData.options })
            }
            if (reuse) keptChildIdsByParent.get(parentId)!.push(childId)
          }
        }

        testQuestionRows.push({
          testId,
          sectionId,
          questionId: parentId,
          orderIndex: qIdx,
          marksPositive: q.marks ?? 1,
          marksNegative: q.marksNegative ?? 0,
        })
      }
    }

    // All kept child ids across reused parents (a child may have moved between parents).
    const allKeptChildIds = Array.from(keptChildIdsByParent.values()).flat()

    await prisma.$transaction([
      ...(Object.keys(scalarData).length > 0
        ? [prisma.test.update({ where: { id: testId }, data: scalarData })]
        : []),
      // Delete existing sections (cascades to TestQuestion join rows)
      prisma.testSection.deleteMany({ where: { testId } }),
      prisma.testSection.createMany({ data: sectionRows }),
      // Parents first so child FK references resolve.
      ...(parentCreates.length ? [prisma.question.createMany({ data: parentCreates })] : []),
      ...updates.map(({ id, data }) => prisma.question.update({ where: { id }, data })),
      ...(childCreates.length ? [prisma.question.createMany({ data: childCreates })] : []),
      // Remove children that were detached from reused passages in the editor.
      ...(reusedParentIds.length
        ? [prisma.question.deleteMany({
            where: {
              parentQuestionId: { in: reusedParentIds },
              id: { notIn: allKeptChildIds.length ? allKeptChildIds : ['__none__'] },
            },
          })]
        : []),
      prisma.testQuestion.createMany({ data: testQuestionRows }),
    ], { maxWait: 10000, timeout: 60000 })

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

    return NextResponse.json({ test })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('PATCH /api/tests/[testId]:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
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
