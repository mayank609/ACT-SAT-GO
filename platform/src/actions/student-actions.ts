'use server'

import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'

/**
 * Creates a new TestAttempt for a student.
 * Call this when a student clicks "Start Test".
 */
export async function startTestAttempt(testId: string, studentId: string) {
  try {
    // Prevent duplicate in-progress attempts
    const existing = await prisma.testAttempt.findFirst({
      where: { testId, studentId, status: 'IN_PROGRESS' },
    })
    if (existing) return { success: true, attemptId: existing.id, alreadyStarted: true }

    const attempt = await prisma.testAttempt.create({
      data: { testId, studentId, status: 'IN_PROGRESS', startedAt: new Date() },
    })
    return { success: true, attemptId: attempt.id, alreadyStarted: false }
  } catch (error) {
    console.error('Error starting attempt:', error)
    return { success: false, error: 'Failed to start test' }
  }
}

/**
 * Fetches a full test with all sections and questions.
 * Used when loading the test interface.
 */
export async function getTestDetails(testId: string) {
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
    if (!test) return { success: false, error: 'Test not found' }
    return { success: true, test }
  } catch (error) {
    console.error('Error fetching test:', error)
    return { success: false, error: 'Failed to load test' }
  }
}

/**
 * Returns all test attempts for a student, with test info and scores.
 * Used on the student's "My Tests" page.
 */
export async function getStudentAttempts(studentId: string) {
  try {
    const attempts = await prisma.testAttempt.findMany({
      where: { studentId },
      orderBy: { startedAt: 'desc' },
      include: {
        test: true,
        sectionAttempts: {
          orderBy: { startedAt: 'asc' },
          include: {
            section: {
              include: {
                questions: {
                  orderBy: { orderIndex: 'asc' },
                  include: { question: true },
                },
              },
            },
          },
        },
        answers: true,
      },
    })
    return { success: true, attempts }
  } catch (error) {
    console.error('Error fetching attempts:', error)
    return { success: false, error: 'Failed to load attempts' }
  }
}

/**
 * Returns the remaining seconds for a section timer from Redis.
 * Returns 0 if the timer has expired or doesn't exist.
 */
export async function getTimerRemaining(attemptId: string, sectionId: string) {
  try {
    const endTime = await redis.get<number>(`timer:${attemptId}:${sectionId}`)
    if (!endTime) return { success: true, remainingSeconds: 0, expired: true }
    const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
    return { success: true, remainingSeconds: remaining, expired: remaining === 0 }
  } catch (error) {
    console.error('Error getting timer:', error)
    return { success: false, remainingSeconds: 0, expired: true }
  }
}

/**
 * Returns an attempt with all answers — used for the results/review page.
 */
export async function getAttemptResults(attemptId: string) {
  try {
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: true,
        sectionAttempts: {
          include: {
            section: {
              include: {
                questions: {
                  orderBy: { orderIndex: 'asc' },
                  include: { question: true },
                },
              },
            },
          },
        },
        answers: { include: { question: true } },
        cheatingLogs: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!attempt) return { success: false, error: 'Attempt not found' }
    return { success: true, attempt }
  } catch (error) {
    console.error('Error fetching results:', error)
    return { success: false, error: 'Failed to load results' }
  }
}

/**
 * Returns all tests available/assigned to a student.
 */
export async function getAvailableTests(studentId: string) {
  try {
    const attempts = await prisma.testAttempt.findMany({
      where: { studentId },
      select: { testId: true, status: true, totalScore: true, id: true },
    })
    const attemptMap = new Map(attempts.map((a) => [a.testId, a]))

    const tests = await prisma.test.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        sections: {
          include: { _count: { select: { questions: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      success: true,
      tests: tests.map((t) => ({
        ...t,
        attempt: attemptMap.get(t.id) ?? null,
      })),
    }
  } catch (error) {
    console.error('Error fetching tests:', error)
    return { success: false, error: 'Failed to load tests' }
  }
}
