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
  console.log('🔍 Previewing what will be deleted...\n')

  const allTests = await prisma.test.findMany({ select: { id: true, title: true, category: true, subCategory: true } })
  const diagnosticTests = allTests.filter(
    (t) => t.category?.toLowerCase() === 'diagnostic' || t.title?.toLowerCase().includes('diagnostic')
  )
  const nonDiagnosticTests = allTests.filter(
    (t) => !diagnosticTests.find((d) => d.id === t.id)
  )

  const students = await prisma.user.findMany({ where: { role: 'STUDENT' }, select: { id: true, email: true } })
  const attemptCount = await prisma.testAttempt.count()
  const assignmentCount = await prisma.testAssignment.count()

  console.log(`📋 Tests to KEEP (diagnostic): ${diagnosticTests.length}`)
  diagnosticTests.forEach((t) => console.log(`   ✅ [${t.category ?? '—'}] ${t.title}`))

  console.log(`\n🗑  Tests to DELETE (non-diagnostic): ${nonDiagnosticTests.length}`)
  nonDiagnosticTests.forEach((t) => console.log(`   ❌ [${t.category ?? '—'}] ${t.title}`))

  console.log(`\n👤 Students to DELETE: ${students.length}`)
  students.forEach((s) => console.log(`   ❌ ${s.email}`))

  console.log(`\n📊 Other data to DELETE:`)
  console.log(`   ❌ ${attemptCount} test attempt(s)`)
  console.log(`   ❌ ${assignmentCount} test assignment(s)`)

  if (process.argv.includes('--confirm')) {
    console.log('\n🚀 Running cleanup...\n')

    // 1. Wipe all attempt-related data
    console.log('🗑  Deleting attempts...')
    await prisma.cheatingLog.deleteMany()
    await prisma.attemptAnswer.deleteMany()
    await prisma.sectionAttempt.deleteMany()
    await prisma.testAttempt.deleteMany()
    console.log('✅ Attempts cleared')

    // 2. Wipe all assignments
    console.log('🗑  Deleting assignments...')
    await prisma.testAssignment.deleteMany()
    console.log('✅ Assignments cleared')

    // 3. Wipe non-diagnostic tests (cascade removes sections/questions from those tests)
    if (nonDiagnosticTests.length > 0) {
      console.log('🗑  Deleting non-diagnostic tests...')
      const ids = nonDiagnosticTests.map((t) => t.id)
      await prisma.testQuestion.deleteMany({ where: { section: { testId: { in: ids } } } })
      await prisma.testSection.deleteMany({ where: { testId: { in: ids } } })
      await prisma.test.deleteMany({ where: { id: { in: ids } } })
      console.log('✅ Non-diagnostic tests cleared')
    }

    // 4. Wipe students and their tutor links
    console.log('🗑  Deleting students...')
    await prisma.tutorAssignment.deleteMany()
    await prisma.user.deleteMany({ where: { role: 'STUDENT' } })
    console.log('✅ Students cleared')

    console.log('\n🎉 Cleanup complete!')
    console.log(`   • Kept ${diagnosticTests.length} diagnostic test(s)`)
    console.log(`   • All students, attempts, and assignments removed`)
  } else {
    console.log('\n⚠️  DRY RUN — nothing was deleted.')
    console.log('    Run with --confirm to execute:')
    console.log('    npx tsx scripts/cleanup-students.ts --confirm')
  }
}

main()
  .catch((e) => { console.error('❌ Cleanup failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
