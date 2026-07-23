// Test Builder tags homework as subCategory "{Subject}-Homework" (e.g. "Math-Homework").
// Mirrors frontend/src/lib/testCategorize.ts so homework attempts are identified consistently
// wherever "tests attempted" is counted.
export function isHomeworkTest(test: { title?: string | null; subCategory?: string | null } | null | undefined): boolean {
  if (!test) return false
  const t = (test.title ?? '').toLowerCase()
  const sub = (test.subCategory ?? '').toLowerCase()
  return sub.includes('homework') || t.includes('homework') || t.includes(' hw') || t.endsWith('hw') || /\bhw\b/.test(t)
}
