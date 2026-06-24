// Shared helpers for numeric / fraction answers used across the test interface,
// the question authoring forms, and answer grading.
//
// Students and admins may enter answers as decimals ("0.7"), simple fractions
// ("7/10"), or mixed numbers ("1 1/2"). We always store the decimal value so the
// existing { value: number } answer shape is unchanged, and compare with a small
// tolerance so equivalents like 7/10, 0.7, 14/20 (and repeating decimals such as
// 1/3) all count as correct.

/** Parse a decimal / fraction / mixed-number string into a number. Returns null if invalid. */
export function parseNumericAnswer(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;

  const s = input.trim();
  if (!s) return null;

  // Mixed number, e.g. "1 1/2" or "-2 3/4"
  const mixed = s.match(/^([+-]?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = parseInt(mixed[1], 10);
    const num = parseInt(mixed[2], 10);
    const den = parseInt(mixed[3], 10);
    if (den === 0) return null;
    const sign = mixed[1].trim().startsWith('-') ? -1 : 1;
    return whole + sign * (num / den);
  }

  // Simple fraction, e.g. "7/10", "-3/4", "1.5/2"
  const frac = s.match(/^([+-]?\d*\.?\d+)\/([+-]?\d*\.?\d+)$/);
  if (frac) {
    const num = parseFloat(frac[1]);
    const den = parseFloat(frac[2]);
    if (!den || !Number.isFinite(num) || !Number.isFinite(den)) return null;
    return num / den;
  }

  // Plain decimal / integer
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Decimal-equivalent comparison with a small relative tolerance. */
export function numericEqual(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= 1e-9 + 1e-6 * Math.abs(b);
}

/** True if the input is a syntactically valid numeric/fraction answer (or empty). */
export function isValidNumericInput(input: string): boolean {
  if (input.trim() === '') return true;
  return parseNumericAnswer(input) !== null;
}
