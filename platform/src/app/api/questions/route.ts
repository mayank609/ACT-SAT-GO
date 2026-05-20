import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const difficulty = searchParams.get('difficulty')
  const search = searchParams.get('search')
    const subject = searchParams.get('subject')

  try {
    const questions = await prisma.question.findMany({
      where: {
        ...(type ? { type: type as 'MCQ' | 'MSQ' | 'NUMERIC' } : {}),
        ...(difficulty ? { difficultyLevel: difficulty as 'EASY' | 'MEDIUM' | 'HARD' } : {}),
        ...(subject ? { subject: { equals: subject, mode: 'insensitive' } } : {}),
      },
      include: {
        topic: { select: { id: true, name: true } },
        testQuestions: {
          include: { test: { select: { id: true, title: true } } },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const filtered = search
      ? questions.filter((q) => {
          const text = ((q.content as Record<string, unknown>)?.text as string) ?? ''
          return text.toLowerCase().includes(search.toLowerCase())
        })
      : questions

    return NextResponse.json({
      questions: filtered.map((q) => ({
        id: q.id,
        type: q.type,
        content: q.content,
        options: q.options,
        correctAnswer: q.correctAnswer,
        difficultyLevel: q.difficultyLevel,
        topic: q.topic,
        referenceId: q.referenceId,
        subject: q.subject,
        createdAt: q.createdAt,
        usedInTests: q.testQuestions.map((tq) => ({
          testId: tq.testId,
          testTitle: tq.test.title,
        })),
      })),
    })
  } catch (error) {
    console.error('GET /api/questions:', error)
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }
}

// ── POST — create standalone question in the bank ────────────────────────────

type FrontendType = 'mcq_single' | 'mcq_multi' | 'numeric'
type FrontendDifficulty = 'easy' | 'medium' | 'hard'

const TYPE_MAP: Record<FrontendType, 'MCQ' | 'MSQ' | 'NUMERIC'> = {
  mcq_single: 'MCQ', mcq_multi: 'MSQ', numeric: 'NUMERIC',
}
const DIFF_MAP: Record<FrontendDifficulty, 'EASY' | 'MEDIUM' | 'HARD'> = {
  easy: 'EASY', medium: 'MEDIUM', hard: 'HARD',
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

export async function POST(request: NextRequest) {
  let body: {
    type: FrontendType
    text: string
    options?: Array<{ id: string; text: string }>
    correctAnswer: string | string[] | number
    difficulty: FrontendDifficulty
    topic?: string
    subject?: string
    referenceId?: string
    explanation?: string
    marks?: number
    marksNegative?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const dbType = TYPE_MAP[body.type]
  if (!dbType) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  const dbDiff = DIFF_MAP[body.difficulty]
  if (!dbDiff) return NextResponse.json({ error: 'Invalid difficulty' }, { status: 400 })

  try {
    let topicId: string | null = null
    if (body.topic) {
      const topic = await prisma.topic.findFirst({
        where: { name: { equals: body.topic, mode: 'insensitive' } },
      })
      topicId = topic?.id ?? null
    }

    const question = await prisma.question.create({
      data: {
        type: dbType,
        content: { text: body.text, explanation: body.explanation ?? null } as Prisma.InputJsonValue,
        options: body.options ? transformOptions(body.options) : Prisma.DbNull,
        correctAnswer: transformCorrectAnswer(body.correctAnswer),
        difficultyLevel: dbDiff,
        topicId,
        subject: body.subject ?? null,
        referenceId: body.referenceId ?? null,
      },
      include: {
        topic: { select: { id: true, name: true } },
        testQuestions: { include: { test: { select: { id: true, title: true } } }, take: 5 },
      },
    })

    return NextResponse.json({
      question: {
        id: question.id,
        type: question.type,
        content: question.content,
        options: question.options,
        correctAnswer: question.correctAnswer,
        difficultyLevel: question.difficultyLevel,
        topic: question.topic,
        referenceId: question.referenceId,
        subject: question.subject,
        createdAt: question.createdAt,
        usedInTests: [],
      },
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/questions:', error)
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 })
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    await prisma.question.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/questions:', error)
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 })
  }
}
