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
