import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const attemptId = 'f51035ed-495d-4097-931e-450a0eb7f91f'
  
  // Get attempt and its test
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: { test: true }
  })
  
  // Get all answers
  const answers = await prisma.attemptAnswer.findMany({
    where: { attemptId },
    select: { questionId: true }
  })
  
  console.log('=== Answer Question IDs (first 10) ===')
  answers.slice(0, 10).forEach(a => console.log(`  ${a.questionId}`))
  
  // Get all test question IDs
  const testQuestions = await prisma.testQuestion.findMany({
    where: { testId: attempt!.testId },
    select: { questionId: true }
  })
  
  const testQuestionIds = new Set(testQuestions.map(tq => tq.questionId))
  
  console.log(`\n=== Test Question IDs (first 10) ===`)
  testQuestions.slice(0, 10).forEach(tq => console.log(`  ${tq.questionId}`))
  
  // Check if answer question IDs exist in test
  const firstAnswerQuestionId = answers[0]?.questionId
  const firstTestQuestionId = testQuestions[0]?.questionId
  
  console.log(`\nFirst answer question ID: ${firstAnswerQuestionId}`)
  console.log(`First test question ID: ${firstTestQuestionId}`)
  console.log(`First answer in test questions? ${testQuestionIds.has(firstAnswerQuestionId || '')}`)
  
  // Check if perhaps there's a different set of questions being referenced
  console.log('\n=== Checking all answer question IDs against test ===')
  const answerQuestionIds = new Set(answers.map(a => a.questionId))
  console.log(`Unique answer question IDs: ${answerQuestionIds.size}`)
  console.log(`Unique test question IDs: ${testQuestionIds.size}`)
  console.log(`Intersection: ${[...answerQuestionIds].filter(id => testQuestionIds.has(id)).length}`)
  
  // Check if maybe answers reference different questions
  const firstAnswer = answers[0]?.questionId
  const answeredQuestion = await prisma.question.findUnique({
    where: { id: firstAnswer || '' },
    select: { id: true, type: true, parentQuestion: { select: { id: true } } }
  })
  
  console.log(`\n=== First Answer's Question Details ===`)
  console.log(`Question ID: ${answeredQuestion?.id}`)
  console.log(`Type: ${answeredQuestion?.type}`)
  console.log(`Parent question: ${answeredQuestion?.parentQuestion?.id}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
