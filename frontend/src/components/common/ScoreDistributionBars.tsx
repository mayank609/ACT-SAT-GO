// Ranked horizontal bar list for an ordinal score-band distribution (SAT/ACT
// score range -> student count). Color is a single-hue ramp, light->dark,
// following the bands' own order (not the count) — see the dataviz skill's
// ordinal-ramp rule: swapping band order would change the meaning, so hue
// intensity encodes position in the sequence, and bar length encodes count.

interface ScoreDistributionBand {
  range: string;
  count: number;
}

interface ScoreDistributionBarsProps {
  data: ScoreDistributionBand[];
  selectedRange: string | null;
  onSelect: (range: string) => void;
  accent?: 'blue' | 'purple';
}

// Validated ordinal-ramp endpoints (node scripts/validate_palette.js --ordinal):
// light end clears the 2:1 contrast floor against a white card, single hue,
// monotone lightness. Interpolated in OKLab so any band count stays evenly
// spaced without re-validating per length.
const RAMP_ENDPOINTS: Record<'blue' | 'purple', { light: [number, number, number]; dark: [number, number, number] }> = {
  blue: { light: [0.7639734, -0.0279785, -0.0929079], dark: [0.3380766, -0.0233002, -0.1000063] },
  purple: { light: [0.7719579, 0.0331947, -0.1170633], dark: [0.300485, 0.0395095, -0.1622867] },
};

function oklabToHex([L, a, b]: [number, number, number]): string {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const toSrgb = (c: number) => {
    c = Math.max(0, Math.min(1, c));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  };
  return '#' + lin.map((c) => Math.round(toSrgb(c) * 255).toString(16).padStart(2, '0')).join('');
}

function ordinalRamp(n: number, accent: 'blue' | 'purple'): string[] {
  const { light, dark } = RAMP_ENDPOINTS[accent];
  if (n <= 1) return [oklabToHex(light)];
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const mix: [number, number, number] = [0, 1, 2].map((k) => light[k] + (dark[k] - light[k]) * t) as [number, number, number];
    return oklabToHex(mix);
  });
}

export function ScoreDistributionBars({ data, selectedRange, onSelect, accent = 'blue' }: ScoreDistributionBarsProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const ramp = ordinalRamp(data.length, accent);

  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
        const widthPct = d.count > 0 ? Math.max(3, Math.round((d.count / maxCount) * 100)) : 0;
        const isSelected = selectedRange === d.range;
        return (
          <button
            key={d.range}
            type="button"
            onClick={() => onSelect(d.range)}
            className={`w-full flex items-center gap-3 text-left rounded-lg px-1.5 py-1 -mx-1.5 transition-colors ${isSelected ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
          >
            <span className="w-[74px] flex-shrink-0 text-xs text-slate-500 truncate">{d.range}</span>
            <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <span
                className="block h-full rounded-full transition-[width]"
                style={{ width: `${widthPct}%`, backgroundColor: ramp[i] }}
              />
            </span>
            <span className="w-[70px] flex-shrink-0 text-right text-xs font-semibold text-slate-700 whitespace-nowrap">
              {d.count} <span className="text-slate-400 font-normal">({pct}%)</span>
            </span>
          </button>
        );
      })}
      <div className="pt-2 mt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500">Total Students</span>
        <span className="font-semibold text-slate-800">{total}</span>
      </div>
    </div>
  );
}
