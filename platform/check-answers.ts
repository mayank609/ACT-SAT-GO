import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const attemptId = 'f51035ed-495d-4097-931e-450a0eb7f91f'
  
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, status: true, startedAt: true, completedAt: true, studentId: true, testId: true }
  })
  
  console.log('Attempt:', attempt)
  
  const answers = await prisma.attemptAnswer.findMany({
    where: { attemptId },
    select: { questionId: true, answerGiven: true, timeSpentSeconds: true, isFlagged: true }
  })
  
  console.log(`\nTotal answers in database: ${answers.length}`)
  if (answers.length > 0) {
    console.log('First 5 answers:')
    answers.slice(0, 5).forEach(a => {
      console.log(`  Q: ${a.questionId}, Answer: ${JSON.stringify(a.answerGiven)}, Time: ${a.timeSpentSeconds}s`)
    })
  }
  
  // Check Redis for cached answers
  console.log('\n--- Checking Redis ---')
  try {
    const { redis } = await import('./src/lib/redis')
    const cachedAnswers = await redis.hgetall(`answers:${attemptId}`)
    console.log(`Cached answers in Redis: ${Object.keys(cachedAnswers || {}).length}`)
    if (cachedAnswers && Object.keys(cachedAnswers).length > 0) {
      const keys = Object.keys(cachedAnswers).slice(0, 3)
      keys.forEach(k => {
        console.log(`  Q: ${k}, Data: ${JSON.stringify(cachedAnswers[k]).slice(0, 100)}...`)
      })
    }
  } catch (e) {
    console.log('Could not check Redis:', (e as any).message)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
