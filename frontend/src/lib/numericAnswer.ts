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

// Matches the digital SAT/ACT grid-in entry box: only digits, a decimal point,
// a fraction slash, and a space (for mixed numbers like "1 1/2") are allowed —
// no letters or other symbols. The box holds up to 5 characters, or 6 when the
// answer is negative (the extra slot is for the leading "-").
const NUMERIC_INPUT_CHARS = /[^0-9.\-/ ]/g;

/**
 * Sanitize free-typed numeric-answer input as the student types: strips any
 * non-numeric character (letters, etc.), keeps only a single leading minus
 * sign, and caps the length at 5 characters (6 if negative).
 */
export function sanitizeNumericInput(raw: string): string {
  let cleaned = raw.replace(NUMERIC_INPUT_CHARS, '');
  // Only a single leading "-" is meaningful; drop any others.
  cleaned = cleaned[0] === '-' ? '-' + cleaned.slice(1).replace(/-/g, '') : cleaned.replace(/-/g, '');
  const maxLen = cleaned.startsWith('-') ? 6 : 5;
  return cleaned.slice(0, maxLen);
}

/** Formats a numeric value for display: terminating decimals remain as decimals, repeating decimals are converted to fractions. */
export function formatNumericDisplay(val: number): string {
  if (Number.isInteger(val)) return String(val);
  
  // Find fraction representation n/d
  // Since SAT answers are usually simple fractions, limit denominator to 99
  for (let d = 2; d <= 99; d++) {
    const n = Math.round(val * d);
    if (Math.abs(val - n / d) < 1e-6) {
      // Check if it is a repeating decimal (simplified denominator has factors other than 2 or 5)
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const g = gcd(Math.abs(n), d);
      const simplifiedD = d / g;
      
      let temp = simplifiedD;
      while (temp % 2 === 0) temp /= 2;
      while (temp % 5 === 0) temp /= 5;
      
      if (temp > 1) {
        // It's a repeating decimal! Show as fraction
        return `${n}/${d}`;
      }
    }
  }
  
  // Fallback to decimal, limit to 9 decimal places and trim trailing zeros
  return String(Number(val.toFixed(9)));
}

