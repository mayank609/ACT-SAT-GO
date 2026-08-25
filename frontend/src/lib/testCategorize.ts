// Test Builder tags homework as subCategory "{Subject}-Homework" (e.g. "Math-Homework"),
// which does NOT contain the substring "hw" — match on "homework" instead.
export const isHW = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('homework') || t.includes('homework') || t.includes(' hw') || t.endsWith('hw') || /\b(hw|m-hw|r-hw|w-hw|rw-hw|mhw|rhw|whw|rwhw)\b/.test(t);
};

export const isEnglish = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('rw') || sub.includes('english') || sub.includes('reading') || sub.includes('writing') ||
         /reading|writing|english|verbal|grammar|\brw\b/.test(t) || /\b(r-hw|w-hw|rw-hw|rhw|whw|rwhw)\b/.test(t);
};

export const isMath = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('math') || sub.includes('quant') ||
         /math|algebra|geometry|calc/.test(t) || /\b(m-hw|mhw)\b/.test(t);
};

export type PracticeSubject = 'math' | 'reading' | 'writing' | 'other';

// Practice Sheet subCategory is "{Subject}-{AssignmentType}" (e.g. "Math-Homework") or just
// "{Subject}" with no assignment type — Subject is one of Math/Reading/Writing (distinct from
// Sectional's combined "Reading & Writing"). Only call this once the test is already known to
// be a Practice Sheet. Falls back to the title for tests created before this tagging existed.
export const practiceSubjectOf = (test: { subCategory?: string; title?: string }): PracticeSubject => {
  const sub = (test.subCategory ?? '').toLowerCase();
  if (sub.includes('math')) return 'math';
  if (sub.includes('reading')) return 'reading';
  if (sub.includes('writing')) return 'writing';
  const t = (test.title ?? '').toLowerCase();
  if (/math|algebra|geometry|calc/.test(t) || /\b(m-hw|mhw)\b/.test(t)) return 'math';
  if (/reading|comprehension/.test(t) || /\b(r-hw|rhw)\b/.test(t)) return 'reading';
  if (/writing|grammar/.test(t) || /\b(w-hw|whw)\b/.test(t)) return 'writing';
  return 'other';
};

export type ScoreMode = 'mock' | 'sectional-math' | 'sectional-rw' | 'raw';

/**
 * How a test's score should be displayed, based on its category:
 * - Mock (and Diagnostic, which is full-length like a Mock) -> scaled score for BOTH Math and R&W.
 * - Sectional -> scaled score for whichever ONE subject the section covers.
 * - Practice Sheet (includes Homework, a Practice Sheet subCategory) -> raw "X correct / Y total" only, no scaled score.
 * Falls back to 'mock' (both subjects) for anything ambiguous, since that's the safer default
 * over silently hiding a legitimate score.
 */
export function resolveScoreMode(test: { category?: string; subCategory?: string; title?: string }): ScoreMode {
  const cat = (test.category ?? '').toLowerCase();
  if (cat === 'practice sheet') return 'raw';
  if (cat === 'sectional') {
    const math = isMath(test);
    const english = isEnglish(test);
    if (math && !english) return 'sectional-math';
    if (english && !math) return 'sectional-rw';
  }
  return 'mock';
}
