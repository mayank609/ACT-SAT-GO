import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const attemptId = 'f51035ed-495d-4097-931e-450a0eb7f91f'
  
  // Get the test
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: { test: true }
  })
  
  // Get all answers with their questions and parent info
  const answers = await prisma.attemptAnswer.findMany({
    where: { attemptId },
    take: 5,
    include: {
      question: {
        select: {
          id: true,
          type: true,
          parentQuestion: { select: { id: true } }
        }
      }
    }
  })
  
  console.log('=== Answers with Parent Question Info ===')
  answers.forEach((a, i) => {
    console.log(`\nAnswer ${i+1}:`)
    console.log(`  Question ID: ${a.questionId}`)
    console.log(`  Question Type: ${a.question?.type}`)
    console.log(`  Parent Question ID: ${a.question?.parentQuestion?.id || 'NONE'}`)
  })
  
  // Check if parent questions are in the test
  const parentIds = answers.map(a => a.question?.parentQuestion?.id).filter(Boolean)
  
  if (parentIds.length > 0) {
    const testQuestions = await prisma.testQuestion.findMany({
      where: { testId: attempt!.testId },
      select: { questionId: true }
    })
    
    const testQuestionIdSet = new Set(testQuestions.map(tq => tq.questionId))
    
    console.log(`\n=== Checking Parent Questions in Test ===`)
    parentIds.forEach((pid) => {
      if (pid) console.log(`  Parent ID: ${pid}, In test: ${testQuestionIdSet.has(pid)}`)
    })
    
    // Check how many parent questions are in the test
    const parentIdsInTest = parentIds.filter((pid): pid is string => !!pid && testQuestionIdSet.has(pid)).length
    console.log(`\nParent questions in test: ${parentIdsInTest}/${parentIds.length}`)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
