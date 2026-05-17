import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const difficulty = searchParams.get('difficulty')
  const search = searchParams.get('search')

  try {
    const questions = await prisma.question.findMany({
      where: {
        ...(type ? { type: type as 'MCQ' | 'MSQ' | 'NUMERIC' } : {}),
        ...(difficulty ? { difficultyLevel: difficulty as 'EASY' | 'MEDIUM' | 'HARD' } : {}),
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
