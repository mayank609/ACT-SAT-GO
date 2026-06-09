import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { writeFileSync } from 'fs'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const TEST_ID = '42e3cb7d-da57-469c-9f8d-29a814739dfb'
const DRY_RUN = process.env.APPLY !== 'true'

function isPassage(q: any) {
  const c = q.content as any
  return q.type === 'PASSAGE' || c?.meta?.isPassage === true
}
function txt(q: any) { return ((q.content as any)?.text ?? '') as string }

async function main() {
  const sections = await prisma.testSection.findMany({
    where: { testId: TEST_ID },
    orderBy: { orderIndex: 'asc' },
    include: { questions: { include: { question: true } } },
  })

  const standaloneToDelete: string[] = []   // question ids (leaked R&W standalone)
  const passagesToDelete: string[] = []     // question ids (extra duplicate passages in R&W)

  for (const sec of sections) {
    const isRW = /reading\s*&?\s*writing/i.test(sec.name)
    if (!isRW) continue

    const passages = sec.questions.filter(t => isPassage(t.question))
    const standalone = sec.questions.filter(t => !isPassage(t.question) && t.question.parentQuestionId == null)

    // 1. All leaked standalone in R&W are duplicates of passage children → delete
    standalone.forEach(t => standaloneToDelete.push(t.question.id))

    // 2. Detect duplicate passages by text (keep first, delete extras) so each module → 27
    const seen = new Map<string, string>()
    for (const t of passages) {
      const key = txt(t.question).trim()
      if (seen.has(key)) passagesToDelete.push(t.question.id)
      else seen.set(key, t.question.id)
    }
    const uniquePassages = seen.size
    console.log(`[${sec.orderIndex}] ${sec.name}`)
    console.log(`     passages=${passages.length} (unique-by-text=${uniquePassages})  standalone(leaked)=${standalone.length}`)
  }

  console.log(`\nLeaked standalone questions to delete: ${standaloneToDelete.length}`)
  console.log(`Duplicate passages to delete:          ${passagesToDelete.length}`)

  // Compute resulting answerable count
  const remaining = await prisma.testQuestion.count({ where: { testId: TEST_ID } })
  console.log(`Current TestQuestion rows: ${remaining}`)

  if (DRY_RUN) {
    console.log('\n*** DRY RUN — nothing deleted. Set APPLY=true to execute. ***')
    // Save a backup of everything we'd touch
    const allIds = [...standaloneToDelete, ...passagesToDelete]
    const backup = await prisma.question.findMany({
      where: { OR: [{ id: { in: allIds } }, { parentQuestionId: { in: passagesToDelete } }] },
      include: { testQuestions: true },
    })
    writeFileSync('diagnostic1-backup.json', JSON.stringify(backup, null, 2))
    console.log(`Backup of ${backup.length} question rows (incl. cascading children) → diagnostic1-backup.json`)
    return
  }

  // APPLY: delete in a transaction. Deleting the Question cascades to its
  // TestQuestion rows and (for passages) its child Questions via onDelete: Cascade.
  await prisma.$transaction(async (tx) => {
    // Backup first
    const allIds = [...standaloneToDelete, ...passagesToDelete]
    const backup = await tx.question.findMany({
      where: { OR: [{ id: { in: allIds } }, { parentQuestionId: { in: passagesToDelete } }] },
      include: { testQuestions: true },
    })
    writeFileSync('diagnostic1-backup.json', JSON.stringify(backup, null, 2))

    const a = await tx.question.deleteMany({ where: { id: { in: standaloneToDelete } } })
    const b = await tx.question.deleteMany({ where: { id: { in: passagesToDelete } } })
    console.log(`Deleted ${a.count} standalone + ${b.count} passage questions (children cascade).`)
  }, { timeout: 60000 })

  const after = await prisma.testQuestion.count({ where: { testId: TEST_ID } })
  console.log(`TestQuestion rows after cleanup: ${after}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
