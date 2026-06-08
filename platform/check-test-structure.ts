import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const testId = '42e3cb7d-da57-469c-9f8d-29a814739dfb'
  
  // Get all test questions with passage structure
  const testQuestions = await prisma.testQuestion.findMany({
    where: { testId },
    include: {
      question: {
        select: {
          id: true,
          type: true,
          parentQuestion: { select: { id: true, type: true } },
          childQuestions: { select: { id: true } }
        }
      }
    },
    orderBy: { orderIndex: 'asc' },
    take: 10
  })
  
  console.log('=== Test Questions Structure ===')
  testQuestions.forEach((tq, i) => {
    const q = tq.question
    console.log(`\n${i+1}. Question: ${q.id}`)
    console.log(`   Type: ${q.type}`)
    console.log(`   Has parent: ${q.parentQuestion ? 'YES - ' + q.parentQuestion.id : 'NO'}`)
    console.log(`   Has children: ${q.childQuestions && q.childQuestions.length > 0 ? 'YES - ' + q.childQuestions.length : 'NO'}`)
  })
  
  // Count passages
  const passages = testQuestions.filter(tq => tq.question.type === 'PASSAGE')
  console.log(`\n=== Summary ===`)
  console.log(`Total questions (first 10): ${testQuestions.length}`)
  console.log(`Passages in first 10: ${passages.length}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
