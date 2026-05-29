import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

type AnswerJson = { key?: string; keys?: string[]; value?: number } | null

function isCorrect(given: unknown, correct: unknown): boolean {
  if (!given || !correct) return false
  const g = given as AnswerJson
  const c = correct as AnswerJson
  if (!g || !c) return false
  if (c.value !== undefined) return g.value === c.value
  if (c.keys) {
    const gk = (g.keys ?? []).map(k => k.toUpperCase()).sort()
    const ck = c.keys.map(k => k.toUpperCase()).sort()
    return JSON.stringify(gk) === JSON.stringify(ck)
  }
  if (c.key) return g.key?.toUpperCase() === c.key.toUpperCase()
  return false
}

async function main() {
  const attemptId = process.argv[2]
  if (!attemptId) { console.error('Usage: npx tsx scripts/force-submit-attempt.ts <attemptId>'); process.exit(1) }

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: { include: { question: { include: { testQuestions: { where: {} } } } } },
    },
  })
  if (!attempt) { console.error('Attempt not found'); process.exit(1) }
  console.log(`Attempt ${attemptId} — current status: ${attempt.status}`)

  // Score it
  let totalScore = 0
  for (const answer of attempt.answers) {
    if (!answer.answerGiven) continue
    const tq = answer.question.testQuestions.find(tq => tq.testId === attempt.testId)
    if (isCorrect(answer.answerGiven, answer.question.correctAnswer)) {
      totalScore += tq?.marksPositive ?? 1
    } else {
      totalScore = Math.max(0, totalScore - (tq?.marksNegative ?? 0))
    }
  }

  await prisma.testAttempt.update({
    where: { id: attemptId },
    data: { status: 'SUBMITTED', totalScore, completedAt: new Date() },
  })

  console.log(`✅ Marked as SUBMITTED — score: ${totalScore}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
