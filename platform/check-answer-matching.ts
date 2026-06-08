import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const attemptId = 'f51035ed-495d-4097-931e-450a0eb7f91f'
  
  // Get all questions from the test
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: { test: true }
  })
  
  // Get all test questions
  const testQuestions = await prisma.testQuestion.findMany({
    where: { testId: attempt!.testId },
    include: {
      question: {
        include: {
          childQuestions: true
        }
      }
    }
  })
  
  console.log('=== TEST QUESTIONS ===')
  console.log(`Total test questions: ${testQuestions.length}`)
  
  // Collect all question IDs (including child questions)
  const allQuestionIds = new Set<string>()
  testQuestions.forEach(tq => {
    allQuestionIds.add(tq.question.id)
    tq.question.childQuestions?.forEach(cq => {
      allQuestionIds.add(cq.id)
    })
  })
  
  console.log(`Total unique question IDs (including child): ${allQuestionIds.size}`)
  
  // Get ALL answers
  const answers = await prisma.attemptAnswer.findMany({
    where: { attemptId }
  })
  
  console.log(`\n=== ANSWERS MATCHING ===`)
  console.log(`Total answers: ${answers.length}`)
  
  let matchedCount = 0
  let unMatchedCount = 0
  
  answers.forEach((a, i) => {
    if (allQuestionIds.has(a.questionId)) {
      matchedCount++
      if (i < 5) console.log(`✓ Answer ${i+1}: Q=${a.questionId} matches`)
    } else {
      unMatchedCount++
      if (unMatchedCount <= 5) console.log(`✗ Answer for Q=${a.questionId} NOT FOUND in test questions`)
    }
  })
  
  console.log(`\nMatched: ${matchedCount}/${answers.length}`)
  console.log(`Unmatched: ${unMatchedCount}/${answers.length}`)
  
  // Check if any question is a parent passage
  console.log('\n=== PASSAGE STRUCTURE ===')
  testQuestions.forEach((tq, i) => {
    if (tq.question.type === 'PASSAGE' && tq.question.childQuestions && tq.question.childQuestions.length > 0) {
      if (i < 2) {
        console.log(`Passage: ${tq.question.id} has ${tq.question.childQuestions.length} child questions`)
        tq.question.childQuestions.slice(0, 2).forEach(cq => {
          console.log(`  - Child: ${cq.id}`)
        })
      }
    }
  })
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
