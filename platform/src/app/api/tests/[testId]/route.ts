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

function transformCorrectAnswer(answer: string | string[] | number | null | undefined): Prisma.InputJsonValue {
  if (answer === null || answer === undefined) return { key: 'A' } as Prisma.InputJsonValue
  if (typeof answer === 'number') {
    return { value: isNaN(answer) ? 0 : answer } as Prisma.InputJsonValue
  }
  if (Array.isArray(answer)) {
    const keys = answer.filter(Boolean).map((k) => k.toUpperCase())
    return { keys: keys.length ? keys : ['A'] } as Prisma.InputJsonValue
  }
  return { key: (answer || 'A').toUpperCase() } as Prisma.InputJsonValue
}

interface FrontendQuestion {
  id?: string
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

          // Temporary fallback: if DB doesn't accept PASSAGE enum, store as MCQ and mark content.meta.isPassage
          const isPassage = dbType === 'PASSAGE'
          const writeType = isPassage ? 'MCQ' : dbType
          const contentJson = {
            text: q.text,
            explanation: q.explanation ?? null,
            meta: {
              ...(isPassage ? { isPassage: true } : {}),
              domain: q.topic ?? null,
              subTopic: q.subTopic ?? null,
              skill: q.skill ?? null,
            }
          } as Prisma.InputJsonValue

          // Reuse the existing Question row when the editor sent a real UUID, so
          // prior attempt answers stay linked; otherwise create a new one.
          const reuseId = q.id && UUID_RE.test(q.id)
            ? (await tx.question.findUnique({ where: { id: q.id }, select: { id: true } }))?.id ?? null
            : null
          const questionData = {
            type: writeType as any,
            content: contentJson,
            options: q.options ? transformOptions(q.options) : Prisma.DbNull,
            correctAnswer: transformCorrectAnswer(q.correctAnswer),
            difficultyLevel: dbDiff,
            topicId,
          }
          const parentId = reuseId
            ? (await tx.question.update({ where: { id: reuseId }, data: { ...questionData, parentQuestionId: null } })).id
            : (await tx.question.create({ data: questionData })).id

          // Track which child questions survive so stale ones (removed in the editor)
          // can be deleted from the reused parent below.
          const keptChildIds: string[] = []
          if (isPassage && q.linkedQuestions && Array.isArray(q.linkedQuestions)) {
            for (let childIdx = 0; childIdx < q.linkedQuestions.length; childIdx++) {
              const child = q.linkedQuestions[childIdx]
              const childDbType = TYPE_MAP[child.type] || 'MCQ'
              const childDbDiff = DIFF_MAP[child.difficulty] || 'MEDIUM'
              const childTopicId = child.topic ? (topicMap.get(child.topic.toLowerCase()) ?? null) : null
              const childContentJson = {
                text: child.text,
                explanation: child.explanation ?? null,
                meta: {
                  domain: child.topic ?? null,
                  subTopic: child.subTopic ?? null,
                  skill: child.skill ?? null,
                }
              } as Prisma.InputJsonValue

              const childData = {
                type: childDbType as any,
                content: childContentJson,
                options: child.options ? transformOptions(child.options) : Prisma.DbNull,
                correctAnswer: transformCorrectAnswer(child.correctAnswer),
                difficultyLevel: childDbDiff as any,
                topicId: childTopicId,
                parentQuestionId: parentId,
              }
              const childReuseId = child.id && UUID_RE.test(child.id)
                ? (await tx.question.findUnique({ where: { id: child.id }, select: { id: true } }))?.id ?? null
                : null
              // No TestQuestion row for child questions — they belong to the test via
              // the passage parent's childQuestions relation; a row would double-count.
              if (childReuseId) {
                await tx.question.update({ where: { id: childReuseId }, data: childData })
                keptChildIds.push(childReuseId)
              } else {
                keptChildIds.push((await tx.question.create({ data: childData })).id)
              }
            }
          }
          // Remove children that were detached from this (reused) passage in the editor.
          await tx.question.deleteMany({
            where: { parentQuestionId: parentId, id: { notIn: keptChildIds.length ? keptChildIds : ['__none__'] } },
          })

          await tx.testQuestion.create({
            data: {
              testId,
              sectionId: newSection.id,
              questionId: parentId,
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
    }, { timeout: 30000 })

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
