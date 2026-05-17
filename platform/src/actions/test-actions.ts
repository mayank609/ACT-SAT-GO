'use server'

import { prisma } from '@/lib/prisma'
import { QuestionType, Difficulty, TestStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'

/**
 * Creates a new test in DRAFT mode.
 */
export async function createTest(data: {
  title: string
  description?: string
  createdById: string
}) {
  try {
    const test = await prisma.test.create({
      data: {
        ...data,
        status: 'DRAFT',
      },
    })
    revalidatePath('/admin/tests')
    return { success: true, test }
  } catch (error) {
    console.error('Error creating test:', error)
    return { success: false, error: 'Failed to create test' }
  }
}

/**
 * Adds a timed section to a test.
 */
export async function addSectionToTest(data: {
  testId: string
  name: string
  durationMinutes: number
  orderIndex: number
}) {
  try {
    const section = await prisma.testSection.create({
      data,
    })
    revalidatePath(`/admin/tests/${data.testId}`)
    return { success: true, section }
  } catch (error) {
    console.error('Error adding section:', error)
    return { success: false, error: 'Failed to add section' }
  }
}

/**
 * Creates a question in the global question bank.
 */
export async function createQuestion(data: {
  type: QuestionType
  content: any
  options?: any
  correctAnswer: any
  difficultyLevel: Difficulty
  topicId?: string
}) {
  try {
    const question = await prisma.question.create({
      data,
    })
    return { success: true, question }
  } catch (error) {
    console.error('Error creating question:', error)
    return { success: false, error: 'Failed to create question' }
  }
}

/**
 * Updates an existing question in the database.
 */
export async function updateQuestion(
  id: string,
  data: Partial<{
    content: any
    options: any
    correctAnswer: any
    difficultyLevel: Difficulty
    topicId: string
  }>
) {
  try {
    const question = await prisma.question.update({
      where: { id },
      data,
    })
    return { success: true, question }
  } catch (error) {
    console.error('Error updating question:', error)
    return { success: false, error: 'Failed to update question' }
  }
}

/**
 * Maps a question to a specific test and section.
 */
export async function addQuestionToTest(data: {
  testId: string
  sectionId: string
  questionId: string
  marksPositive: number
  marksNegative: number
  orderIndex: number
}) {
  try {
    const testQuestion = await prisma.testQuestion.create({
      data,
    })
    revalidatePath(`/admin/tests/${data.testId}`)
    return { success: true, testQuestion }
  } catch (error) {
    console.error('Error adding question to test:', error)
    return { success: false, error: 'Failed to add question to test' }
  }
}

/**
 * Fetches all tests with their sections and question counts.
 */
export async function getAllTests() {
  try {
    const tests = await prisma.test.findMany({
      include: {
        _count: {
          select: { questions: true, sections: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return { success: true, tests }
  } catch (error) {
    console.error('Error fetching tests:', error)
    return { success: false, error: 'Failed to fetch tests' }
  }
}

/**
 * Fetches a complete test structure for the test-taking engine.
 */
export async function getFullTestDetails(testId: string) {
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
                question: true
              }
            }
          }
        }
      }
    })
    return { success: true, test }
  } catch (error) {
    console.error('Error fetching full test details:', error)
    return { success: false, error: 'Failed to fetch test details' }
  }
}

/**
 * Creates a new topic or sub-topic for analytical tagging.
 */
export async function createTopic(name: string, parentId?: string) {
  try {
    const topic = await prisma.topic.create({
      data: { name, parentId },
    })
    return { success: true, topic }
  } catch (error) {
    console.error('Error creating topic:', error)
    return { success: false, error: 'Failed to create topic' }
  }
}

/**
 * Fetches all topics for tagging.
 */
export async function getAllTopics() {
  try {
    const topics = await prisma.topic.findMany({
      include: { subTopics: true },
      where: { parentId: null }
    })
    return { success: true, topics }
  } catch (error) {
    console.error('Error fetching topics:', error)
    return { success: false, error: 'Failed to fetch topics' }
  }
}

