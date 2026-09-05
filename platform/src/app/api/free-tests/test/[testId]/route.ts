import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FALLBACK_SAT_TEST, FALLBACK_ACT_TEST } from '@/data/mockDiagnosticTest'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ testId: string }>
}

// GET /api/free-tests/test/[testId] — public test endpoint for website test taker
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { testId } = await params
    if (!testId) {
      return NextResponse.json({ error: 'Test ID is required' }, { status: 400 })
    }

    // Check built-in fallback tests first if ID matches
    if (testId === 'sat_diagnostic_default' || testId === 'act_diagnostic_default') {
      const fb = testId === 'act_diagnostic_default' ? FALLBACK_ACT_TEST : FALLBACK_SAT_TEST
      const sanitizedSections = fb.sections.map((sec) => ({
        id: sec.id,
        name: sec.name,
        durationMinutes: sec.durationMinutes,
        orderIndex: sec.orderIndex,
        questions: sec.questions.map((q) => ({
          id: q.id,
          type: q.type,
          content: q.content,
          options: q.options,
          marksPositive: q.marksPositive,
          marksNegative: q.marksNegative,
        })),
      }))

      return NextResponse.json({
        test: {
          id: fb.id,
          title: fb.title,
          description: fb.description,
          category: fb.category,
          sections: sanitizedSections,
        },
      })
    }

    let test: any = null
    try {
      test = await prisma.test.findUnique({
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
                      childQuestions: {
                        orderBy: { createdAt: 'asc' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    } catch {
      // Prisma error
    }

    if (!test) {
      // Fallback
      const fb = testId.toLowerCase().includes('act') ? FALLBACK_ACT_TEST : FALLBACK_SAT_TEST
      const sanitizedSections = fb.sections.map((sec) => ({
        id: sec.id,
        name: sec.name,
        durationMinutes: sec.durationMinutes,
        orderIndex: sec.orderIndex,
        questions: sec.questions.map((q) => ({
          id: q.id,
          type: q.type,
          content: q.content,
          options: q.options,
          marksPositive: q.marksPositive,
          marksNegative: q.marksNegative,
        })),
      }))

      return NextResponse.json({
        test: {
          id: fb.id,
          title: fb.title,
          description: fb.description,
          category: fb.category,
          sections: sanitizedSections,
        },
      })
    }

    // Format and sanitize questions (strip correctAnswer so answers aren't exposed upfront)
    const sanitizedSections = test.sections.map((sec: any) => ({
      id: sec.id,
      name: sec.name,
      durationMinutes: sec.durationMinutes,
      orderIndex: sec.orderIndex,
      config: sec.config,
      questions: sec.questions.map((tq: any) => {
        const q = tq.question
        return {
          id: q.id,
          testQuestionId: tq.id,
          orderIndex: tq.orderIndex,
          marksPositive: tq.marksPositive,
          marksNegative: tq.marksNegative,
          type: q.type,
          content: q.content,
          options: q.options,
          difficultyLevel: q.difficultyLevel,
          subject: q.subject,
          childQuestions: q.childQuestions?.map((cq: any) => ({
            id: cq.id,
            type: cq.type,
            content: cq.content,
            options: cq.options,
            difficultyLevel: cq.difficultyLevel,
            subject: cq.subject,
          })),
        }
      }),
    }))

    return NextResponse.json({
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        category: test.category,
        subCategory: test.subCategory,
        sections: sanitizedSections,
      },
    })
  } catch (error) {
    console.error('GET /api/free-tests/test/[testId]:', error)
    return NextResponse.json({ error: 'Failed to fetch free test' }, { status: 500 })
  }
}
