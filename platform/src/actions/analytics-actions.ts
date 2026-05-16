'use server'

import { prisma } from '@/lib/prisma'

/**
 * Generates deep analytics for a specific student.
 * Breaks down performance by Topic, Sub-topic, and Speed vs Accuracy.
 */
export async function getStudentPerformanceData(studentId: string) {
  try {
    const answers = await prisma.attemptAnswer.findMany({
      where: {
        attempt: {
          studentId: studentId,
          status: 'SUBMITTED'
        }
      },
      include: {
        question: {
          include: { topic: true }
        }
      }
    })

    if (answers.length === 0) return { success: true, data: [] }

    // Aggregate statistics by Topic
    const stats: Record<string, { 
      correct: number, 
      total: number, 
      time: number, 
      difficultyMap: Record<string, { correct: number, total: number }>
    }> = {}

    answers.forEach(ans => {
      const topic = ans.question.topic?.name || 'General'
      const difficulty = ans.question.difficultyLevel
      
      if (!stats[topic]) {
        stats[topic] = { correct: 0, total: 0, time: 0, difficultyMap: {} }
      }
      
      if (!stats[topic].difficultyMap[difficulty]) {
        stats[topic].difficultyMap[difficulty] = { correct: 0, total: 0 }
      }

      // Evaluation Logic (Simple JSON comparison for dummy data)
      const isCorrect = JSON.stringify(ans.answerGiven) === JSON.stringify(ans.question.correctAnswer)
      
      stats[topic].total += 1
      stats[topic].time += ans.timeSpentSeconds
      stats[topic].difficultyMap[difficulty].total += 1
      
      if (isCorrect) {
        stats[topic].correct += 1
        stats[topic].difficultyMap[difficulty].correct += 1
      }
    })

    // Final Analysis Mapping
    const analytics = Object.entries(stats).map(([topic, s]) => {
      const accuracy = (s.correct / s.total) * 100
      const avgTime = s.time / s.total
      
      // Insight Logic
      let insight = 'Average performance'
      if (accuracy >= 80) insight = 'Mastered - Keep maintaining'
      else if (accuracy < 40) insight = 'Critical Weakness - Needs immediate focus'
      else if (avgTime > 120) insight = 'Slow Accuracy - Work on time management'
      else if (accuracy < 60 && avgTime < 30) insight = 'Careless Mistakes - Read questions carefully'

      return {
        topic,
        accuracy: Math.round(accuracy),
        avgTime: Math.round(avgTime),
        totalQuestions: s.total,
        insight,
        difficultyBreakdown: s.difficultyMap
      }
    })

    return { success: true, analytics }
  } catch (error) {
    console.error('Error generating student performance:', error)
    return { success: false, error: 'Analytics engine failed' }
  }
}

/**
 * Aggregates performance data for all students assigned to a tutor.
 * Helps tutors identify class-wide trends.
 */
export async function getTutorClassAnalytics(tutorId: string) {
  try {
    const students = await prisma.tutorAssignment.findMany({
      where: { tutorId },
      include: {
        student: {
          include: {
            attempts: {
              where: { status: 'SUBMITTED' },
              select: { totalScore: true, test: { select: { title: true } } }
            }
          }
        }
      }
    })

    const classStats = students.map(item => {
      const totalTests = item.student.attempts.length
      const avgScore = totalTests > 0 
        ? item.student.attempts.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) / totalTests 
        : 0

      return {
        studentName: item.student.email,
        studentId: item.student.id,
        avgScore: Math.round(avgScore),
        testCount: totalTests,
      }
    })

    return { success: true, classStats }
  } catch (error) {
    console.error('Error generating class analytics:', error)
    return { success: false, error: 'Failed to load class metrics' }
  }
}
