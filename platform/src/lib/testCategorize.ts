// Test Builder tags homework as subCategory "{Subject}-Homework" (e.g. "Math-Homework").
// Mirrors frontend/src/lib/testCategorize.ts so homework attempts are identified consistently
// wherever "tests attempted" is counted.
export function isHomeworkTest(test: { title?: string | null; subCategory?: string | null } | null | undefined): boolean {
  if (!test) return false
  const t = (test.title ?? '').toLowerCase()
  const sub = (test.subCategory ?? '').toLowerCase()
  return sub.includes('homework') || t.includes('homework') || t.includes(' hw') || t.endsWith('hw') || /\bhw\b/.test(t)
}

// Practice Sheet tests (which cover Homework/Classwork/General) are scored as a raw
// "X correct / Y total" count, never a scaled score — mirrors resolveScoreMode() in
// frontend/src/lib/testCategorize.ts. Any average of "score" across attempts must exclude
// these, since a raw count and a 200-1600 scaled score are not the same unit.
export function isRawScoredTest(test: { category?: string | null } | null | undefined): boolean {
  if (!test) return false
  return (test.category ?? '').trim().toLowerCase() === 'practice sheet'
}
