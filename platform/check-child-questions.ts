import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const testId = '42e3cb7d-da57-469c-9f8d-29a814739dfb'
  
  // Get a MCQ question with children
  const testQuestions = await prisma.testQuestion.findMany({
    where: { testId },
    include: {
      question: {
        include: {
          childQuestions: true
        }
      }
    },
    take: 1,
    skip: 1  // Get the second one which has children
  })
  
  const tq = testQuestions[0]
  if (!tq) {
    console.log('No test question found')
    return
  }
  
  const q = tq.question
  console.log('=== Parent Question ===')
  console.log(`ID: ${q.id}`)
  console.log(`Type: ${q.type}`)
  console.log(`Content: ${typeof q.content === 'object' ? JSON.stringify(q.content).slice(0, 50) : q.content}`)
  console.log(`Number of children: ${q.childQuestions?.length || 0}`)
  
  console.log('\n=== Child Questions ===')
  q.childQuestions?.slice(0, 3).forEach((cq, i) => {
    console.log(`${i+1}. ID: ${cq.id}`)
    console.log(`   Type: ${cq.type}`)
  })
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
