import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params

  try {
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
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
                          include: { topic: { include: { parent: true } } },
                        },
                        parentQuestion: true,
                        topic: { include: { parent: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        sectionAttempts: {
          include: {
            section: {
              include: {
                questions: {
                  orderBy: { orderIndex: 'asc' },
                  include: {
                    question: {
                      include: {
                        childQuestions: {
                          orderBy: { createdAt: 'asc' },
                          include: { topic: { include: { parent: true } } },
                        },
                        parentQuestion: true,
                        topic: { include: { parent: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        answers: { include: { question: true } },
        cheatingLogs: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    
    // Log the data structure for debugging
    console.log(`[BACKEND] Attempt ${attemptId}:`);
    console.log(`  - Sections: ${attempt.test?.sections?.length || 0}`);
    console.log(`  - Total Answers: ${attempt.answers.length}`);
    if (attempt.sectionAttempts.length > 0) {
      const sa = attempt.sectionAttempts[0];
      console.log(`  - First Section: "${sa.section.name}"`);
      console.log(`  - First Section Questions: ${sa.section.questions?.length || 0}`);
      if (sa.section.questions && sa.section.questions.length > 0) {
        const firstQ = sa.section.questions[0];
        console.log(`    - First Question Type: ${firstQ.question.type}`);
        console.log(`    - First Question ID: ${firstQ.question.id}`);
        console.log(`    - Has correctAnswer: ${!!firstQ.question.correctAnswer}`);
      }
    }
    console.log(`  - Sample Answer IDs:`, attempt.answers.slice(0, 3).map(a => a.questionId));
    
    // If sectionAttempts is empty, create synthetic ones from test.sections
    let sectionAttempts = attempt.sectionAttempts
    if (sectionAttempts.length === 0 && attempt.test?.sections) {
      console.log(`[BACKEND] Creating synthetic section attempts`);
      sectionAttempts = attempt.test.sections.map(section => ({
        id: `synthetic-${section.id}`,
        attemptId: attempt.id,
        sectionId: section.id,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt || attempt.startedAt,
        section: section,
      })) as any
    }
    
    return NextResponse.json({ attempt: { ...attempt, sectionAttempts } })
  } catch (error) {
    console.error('GET /api/attempts/[attemptId]:', error)
    return NextResponse.json({ error: 'Failed to fetch attempt' }, { status: 500 })
  }
}
