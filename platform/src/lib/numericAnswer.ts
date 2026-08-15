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

function checkSatEquivalent(av: number, bv: number): boolean {
  for (let d = 2; d <= 99; d++) {
    const n = Math.round(av * d);
    if (Math.abs(av - n / d) < 0.02) {
      const V = n / d;
      if (Math.abs(bv - V) <= 1e-9 + 1e-6 * Math.abs(V)) return true;
      for (let p = 2; p <= 6; p++) {
        if (Math.abs(bv - Number(V.toFixed(p))) < 1e-9) return true;
        const factor = Math.pow(10, p);
        const truncated = (V >= 0 ? Math.floor(V * factor) : Math.ceil(V * factor)) / factor;
        if (Math.abs(bv - truncated) < 1e-9) return true;
      }
    }
  }
  return false;
}

export function numericValuesEqual(a: unknown, b: unknown): boolean {
  const av = parseNumericValue(a);
  const bv = parseNumericValue(b);
  if (av === null || bv === null) return false;
  if (Math.abs(av - bv) <= 1e-9 + 1e-6 * Math.abs(bv)) return true;
  return checkSatEquivalent(av, bv) || checkSatEquivalent(bv, av);
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

