import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  console.log('🔍 COMPREHENSIVE TIME TRACKING VERIFICATION\n')

  // 1. Get all students
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, email: true, name: true }
  })

  console.log(`📊 Total Students: ${students.length}\n`)

  let totalAttempts = 0
  let attemptsWithTime = 0
  let attemptsWithoutTime = 0
  let zeroTimeCount = 0
  let averageTimePerQuestion = 0
  let allTimeData: number[] = []

  // 2. Check each student's attempts
  for (const student of students) {
    const attempts = await prisma.testAttempt.findMany({
      where: { studentId: student.id, status: 'SUBMITTED' },
      include: {
        test: { select: { title: true } },
        answers: {
          select: {
            questionId: true,
            timeSpentSeconds: true,
            answerGiven: true
          }
        }
      },
      orderBy: { completedAt: 'desc' }
    })

    if (attempts.length === 0) continue

    console.log(`\n👤 ${student.email} (${student.name || 'No name'})`)
    console.log(`   Submitted Attempts: ${attempts.length}`)

    for (const attempt of attempts) {
      totalAttempts++
      
      const answersWithTime = attempt.answers.filter(a => a.timeSpentSeconds > 0)
      const answersWithoutTime = attempt.answers.filter(a => a.timeSpentSeconds === 0)
      const totalTime = attempt.answers.reduce((sum, a) => sum + (a.timeSpentSeconds || 0), 0)

      allTimeData.push(...attempt.answers.map(a => a.timeSpentSeconds || 0))

      if (answersWithTime.length > 0) {
        attemptsWithTime++
      } else {
        attemptsWithoutTime++
      }

      if (totalTime === 0) {
        zeroTimeCount++
      }

      console.log(`   📝 ${attempt.test.title}`)
      console.log(`      Total Questions: ${attempt.answers.length}`)
      console.log(`      With Time Data: ${answersWithTime.length}`)
      console.log(`      Zero Time: ${answersWithoutTime.length}`)
      console.log(`      Total Time: ${totalTime}s (avg: ${totalTime > 0 ? Math.round(totalTime / attempt.answers.length) : 0}s/q)`)

      // Show which questions have time
      if (answersWithTime.length > 0) {
        const maxTime = Math.max(...answersWithTime.map(a => a.timeSpentSeconds))
        const minTime = Math.min(...answersWithTime.map(a => a.timeSpentSeconds))
        console.log(`      Time Range: ${minTime}s - ${maxTime}s`)
      }

      // Sample of time data
      const sample = attempt.answers.slice(0, 5)
      console.log(`      Sample Times: ${sample.map(a => `${a.timeSpentSeconds}s`).join(', ')} ${attempt.answers.length > 5 ? '...' : ''}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📈 SUMMARY STATISTICS')
  console.log('='.repeat(60))
  console.log(`Total Submitted Attempts: ${totalAttempts}`)
  console.log(`Attempts WITH time data: ${attemptsWithTime} (${totalAttempts > 0 ? Math.round((attemptsWithTime / totalAttempts) * 100) : 0}%)`)
  console.log(`Attempts WITHOUT time data: ${attemptsWithoutTime} (${totalAttempts > 0 ? Math.round((attemptsWithoutTime / totalAttempts) * 100) : 0}%)`)
  console.log(`Attempts with ZERO time: ${zeroTimeCount}`)

  if (allTimeData.length > 0) {
    const nonZeroTimes = allTimeData.filter(t => t > 0)
    averageTimePerQuestion = nonZeroTimes.length > 0 ? nonZeroTimes.reduce((a, b) => a + b) / nonZeroTimes.length : 0
    const maxTime = Math.max(...allTimeData)
    const minTime = Math.min(...nonZeroTimes)
    console.log(`\nAverage Time per Question: ${Math.round(averageTimePerQuestion)}s`)
    console.log(`Max Time on any Question: ${maxTime}s`)
    console.log(`Min Time on any Question (non-zero): ${minTime}s`)
    console.log(`Questions with recorded time: ${nonZeroTimes.length}`)
    console.log(`Questions with zero time: ${allTimeData.filter(t => t === 0).length}`)
  }

  // 3. Check TestQuestion linking
  console.log('\n' + '='.repeat(60))
  console.log('🔗 TEST STRUCTURE VERIFICATION')
  console.log('='.repeat(60))

  const tests = await prisma.test.findMany({
    include: {
      sections: {
        include: {
          questions: {
            select: { id: true, questionId: true }
          }
        }
      }
    }
  })

  console.log(`\nTotal Tests: ${tests.length}`)
  for (const test of tests) {
    let totalTQLinks = 0
    for (const section of test.sections) {
      totalTQLinks += section.questions.length
    }
    console.log(`  ${test.title}: ${test.sections.length} sections, ${totalTQLinks} question links`)
  }

  console.log('\n✅ Verification Complete!\n')
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
