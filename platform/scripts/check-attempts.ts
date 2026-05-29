import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const students = await prisma.user.findMany({ where: { role: 'STUDENT' }, select: { id: true, email: true, name: true } })
  console.log('Students:', students.map(s => `${s.email} (${s.id})`).join(', '))

  for (const s of students) {
    const attempts = await prisma.testAttempt.findMany({
      where: { studentId: s.id },
      select: { id: true, testId: true, status: true, startedAt: true, completedAt: true },
      orderBy: { startedAt: 'desc' },
    })
    if (attempts.length === 0) continue
    console.log(`\n📋 ${s.email}:`)
    attempts.forEach(a => {
      console.log(`  ${a.status.padEnd(12)} | started ${a.startedAt?.toISOString().slice(0,19)} | completed ${a.completedAt?.toISOString().slice(0,19) ?? '—'} | ${a.id}`)
    })
  }

  // Fix: mark any IN_PROGRESS attempts as ABANDONED if there's a SUBMITTED attempt for same test+student
  if (process.argv.includes('--fix')) {
    console.log('\n🔧 Fixing stale IN_PROGRESS attempts...')
    const allAttempts = await prisma.testAttempt.findMany({ select: { id: true, studentId: true, testId: true, status: true } })
    const submittedPairs = new Set(allAttempts.filter(a => a.status === 'SUBMITTED').map(a => `${a.studentId}:${a.testId}`))
    const staleInProgress = allAttempts.filter(a => a.status === 'IN_PROGRESS' && submittedPairs.has(`${a.studentId}:${a.testId}`))

    if (staleInProgress.length === 0) {
      console.log('  No stale attempts found.')
    } else {
      for (const a of staleInProgress) {
        await prisma.testAttempt.update({ where: { id: a.id }, data: { status: 'SUBMITTED', completedAt: new Date() } })
        console.log(`  ✅ Fixed attempt ${a.id}`)
      }
    }
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
