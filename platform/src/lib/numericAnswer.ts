// Numeric / fraction answer helpers (mirror of frontend src/lib/numericAnswer.ts).
// Answers may be stored as decimals or arrive as fraction strings ("7/10"); we
// compare on decimal value with a small tolerance so 7/10, 0.7, 14/20 and
// repeating decimals like 1/3 all count as equal.

export function parseNumericValue(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;

  const s = String(input).trim();
  if (!s) return null;

  const mixed = s.match(/^([+-]?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = parseInt(mixed[1], 10);
    const num = parseInt(mixed[2], 10);
    const den = parseInt(mixed[3], 10);
    if (den === 0) return null;
    const sign = mixed[1].trim().startsWith('-') ? -1 : 1;
    return whole + sign * (num / den);
  }

  const frac = s.match(/^([+-]?\d*\.?\d+)\/([+-]?\d*\.?\d+)$/);
  if (frac) {
    const num = parseFloat(frac[1]);
    const den = parseFloat(frac[2]);
    if (!den || !Number.isFinite(num) || !Number.isFinite(den)) return null;
    return num / den;
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function numericValuesEqual(a: unknown, b: unknown): boolean {
  const av = parseNumericValue(a);
  const bv = parseNumericValue(b);
  if (av === null || bv === null) return false;
  return Math.abs(av - bv) <= 1e-9 + 1e-6 * Math.abs(bv);
}
