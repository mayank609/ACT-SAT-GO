import { prisma } from '@/lib/prisma'

// Custom-exam tests are scored on raw marks (see the submit route). To compare
// students and show progress against a percentage target, a raw score is
// turned into a percentage of the test's maximum marks.

/** Maximum marks per test: each gradeable question's marksPositive; a passage counts once per sub-question (graded with the passage's marks). */
export async function maxMarksByTest(testIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (testIds.length === 0) return out
  const rows = await prisma.testQuestion.findMany({
    where: { testId: { in: [...new Set(testIds)] } },
    select: {
      testId: true,
      marksPositive: true,
      question: { select: { type: true, content: true, _count: { select: { childQuestions: true } } } },
    },
  })
  for (const r of rows) {
    const q = r.question
    const isPassage = q.type === 'PASSAGE' || (q.content as { meta?: { isPassage?: boolean } } | null)?.meta?.isPassage === true
    const count = isPassage ? q._count.childQuestions : 1
    out.set(r.testId, (out.get(r.testId) ?? 0) + count * (r.marksPositive ?? 1))
  }
  return out
}

/** Average percentage (0–100, 1 decimal) over custom-test attempts, or null when there are none. */
export function averagePercent(
  attempts: Array<{ testId: string; totalScore: number | null; test: { category?: string | null } }>,
  maxMarks: Map<string, number>,
): number | null {
  const pcts: number[] = []
  for (const a of attempts) {
    if ((a.test.category ?? '').trim().toLowerCase() !== 'custom') continue
    const max = maxMarks.get(a.testId)
    if (!max || a.totalScore == null) continue
    pcts.push(Math.max(0, Math.min(100, (a.totalScore / max) * 100)))
  }
  return pcts.length ? Math.round((pcts.reduce((s, p) => s + p, 0) / pcts.length) * 10) / 10 : null
}
