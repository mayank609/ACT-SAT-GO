import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const studentEmail = process.argv[2] ?? 'sunanda@gmail.com'
  console.log(`\n📊 Checking time data for student: ${studentEmail}`)

  const student = await prisma.user.findUnique({
    where: { email: studentEmail },
    select: { id: true, email: true, name: true }
  })
  
  if (!student) {
    console.log('❌ Student not found')
    return
  }

  const attempts = await prisma.testAttempt.findMany({
    where: { studentId: student.id, status: 'SUBMITTED' },
    include: {
      test: { select: { id: true, title: true } },
      answers: {
        select: { questionId: true, timeSpentSeconds: true, answerGiven: true }
      }
    },
    orderBy: { completedAt: 'desc' },
    take: 5
  })

  console.log(`\n✅ Found ${attempts.length} submitted attempts\n`)

  for (const attempt of attempts) {
    console.log(`📝 ${attempt.test.title}`)
    console.log(`   Attempt ID: ${attempt.id}`)
    console.log(`   Started: ${attempt.startedAt.toISOString()}`)
    console.log(`   Completed: ${attempt.completedAt?.toISOString() ?? '—'}`)
    console.log(`   Status: ${attempt.status}`)
    console.log(`   Answers: ${attempt.answers.length}`)
    
    const totalTime = attempt.answers.reduce((sum, ans) => sum + (ans.timeSpentSeconds || 0), 0)
    console.log(`   Total Time: ${totalTime}s`)
    
    // Show sample of time data
    const withTime = attempt.answers.filter(a => a.timeSpentSeconds > 0)
    console.log(`   Questions with time data: ${withTime.length}/${attempt.answers.length}`)
    
    if (withTime.length === 0) {
      console.log(`   ⚠️  WARNING: No time data found for any question!`)
    } else {
      console.log(`   Sample times:`)
      withTime.slice(0, 3).forEach((ans, i) => {
        console.log(`     Q${i+1}: ${ans.timeSpentSeconds}s`)
      })
    }
    console.log()
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
