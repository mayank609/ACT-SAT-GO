// Test Builder tags homework as subCategory "{Subject}-Homework" (e.g. "Math-Homework"),
// which does NOT contain the substring "hw" — match on "homework" instead.
export const isHW = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('homework') || t.includes('homework') || t.includes(' hw') || t.endsWith('hw') || /\bhw\b/.test(t);
};

export const isEnglish = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('rw') || sub.includes('english') || sub.includes('reading') || sub.includes('writing') ||
         /reading|writing|english|verbal|grammar|\brw\b/.test(t);
};

export const isMath = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('math') || sub.includes('quant') ||
         /math|algebra|geometry|calc/.test(t);
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
