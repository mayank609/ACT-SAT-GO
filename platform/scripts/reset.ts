import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🧹 Starting database reset...\n')

  // ── 1. Wipe all content (FK-safe order) ─────────────────────────────────────
  console.log('🗑  Deleting all attempts and answers...')
  await prisma.cheatingLog.deleteMany()
  await prisma.attemptAnswer.deleteMany()
  await prisma.sectionAttempt.deleteMany()
  await prisma.testAttempt.deleteMany()
  console.log('✅ Attempts cleared')

  console.log('🗑  Deleting all tests and questions...')
  await prisma.testQuestion.deleteMany()
  await prisma.testSection.deleteMany()
  await prisma.test.deleteMany()
  await prisma.question.deleteMany()
  await prisma.topic.deleteMany()
  console.log('✅ Tests and questions cleared')

  console.log('🗑  Deleting all students and tutors...')
  await prisma.tutorAssignment.deleteMany()
  await prisma.user.deleteMany({ where: { role: { in: ['STUDENT', 'TUTOR'] } } })
  console.log('✅ Students and tutors cleared')

  // ── 2. Ensure at least one admin exists ──────────────────────────────────────
  const adminCount = await prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } })

  if (adminCount === 0) {
    console.log('\n⚠️  No admin users found — creating default admin...')
    await prisma.user.create({
      data: {
        email: 'admin@actsat.com',
        role: 'ADMIN',
        permissions: { displayName: 'Admin' },
      },
    })
    console.log('✅ Default admin created: admin@actsat.com')
  } else {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { email: true, role: true },
    })
    console.log(`\n✅ Kept ${adminCount} existing admin account(s):`)
    admins.forEach((a) => console.log(`   ${a.role.toLowerCase().padEnd(12)} → ${a.email}`))
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n🎉 Database reset complete!')
  console.log('   • All tests, questions, students, tutors, and attempts removed')
  console.log('   • Admin account(s) preserved — client can log in and start fresh')
}

main()
  .catch((e) => { console.error('❌ Reset failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
