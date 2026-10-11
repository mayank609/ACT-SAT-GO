import { useMemo, useRef, useState } from 'react';
import { Expand, X } from 'lucide-react';
import type { TaSection, TaResult } from '../../lib/api';
import type { QuestionTimeStat } from './QuestionTimeChart';

// Visit-level pacing chart, drawn to match Zuperscore's "Time Analytics":
// a horizontal floating-bar chart with one bar per *visit* to a question,
// placed at the minute it happened and coloured by the answer state when the
// student left that visit. Revisits are extra bars on the same row. Q1 sits at
// the bottom. The legend lists Visit 1…N (black swatches; click to hide one),
// and the expanded view adds a colour key.

export const VISIT_FILL: Record<TaResult, string> = {
  correct: '#66bb6a',
  incorrect: '#ef5350',
  unanswered: '#5c6bc0',
};
export const VISIT_LABEL: Record<TaResult, string> = {
  correct: 'Correct',
  incorrect: 'Incorrect',
  unanswered: 'Unattempted/Unchanged',
};
const AXIS = '#000';
const GRID = '#E5E5E5';

/** One bar: a visit to the question on `row` (0 = Q1), in ms from the module start. */
export interface GridBar {
  row: number;
  visitNo: number;
  start: number;
  end: number;
  result: TaResult;
}
/** Everything one module's chart needs, from visit data or from legacy per-question totals. */
export interface GridSection {
  sectionId: string;
  title: string;
  rowCount: number;
  bars: GridBar[];
  /** Total time on each question (row), in seconds, for the pacing counts. */
  rowSeconds: number[];
  /** Whether each question ended up answered (rushed counts only answered ones). */
  rowAnswered: boolean[];
}

/** Visit data from the time-analytics endpoint → chart bars (times relative to the module start). */
export function gridFromVisits(section: TaSection, title: string): GridSection {
  const rowOf = new Map(section.questionIds.map((q, i) => [q, i]));
  const bars: GridBar[] = [];
  const rowMs = section.questionIds.map(() => 0);
  const rowAnswered = section.questionIds.map(() => false);
  for (const v of section.visits) {
    const row = rowOf.get(v.questionId);
    if (row === undefined) continue;
    bars.push({ row, visitNo: v.visitNo, start: v.start - section.offsetMs, end: v.end - section.offsetMs, result: v.exitResult });
    rowMs[row] += v.activeMs;
    rowAnswered[row] = v.exitResult !== 'unanswered'; // visits arrive in time order, so the last one wins
  }
  return {
    sectionId: section.sectionId, title, rowCount: section.questionIds.length, bars,
    rowSeconds: rowMs.map((ms) => Math.round(ms / 1000)), rowAnswered,
  };
}

/**
 * Attempts without visit data only have total time per question: draw one
 * "Visit 1" bar per question, laid end to end in question order, coloured by
 * the final answer.
 */
export function gridFromTotals(sectionId: string, title: string, stats: QuestionTimeStat[]): GridSection {
  let cursor = 0;
  const bars = stats.map((q, i) => {
    const start = cursor;
    cursor += Math.max(0, q.timeSpentSeconds) * 1000;
    const result: TaResult = q.status === 'skipped' ? 'unanswered' : q.status;
    return { row: i, visitNo: 1, start, end: cursor, result };
  });
  return {
    sectionId, title, rowCount: stats.length, bars,
    rowSeconds: stats.map((q) => q.timeSpentSeconds), rowAnswered: stats.map((q) => q.status !== 'skipped'),
  };
}

interface Tip { x: number; y: number; title: string; body: string }

export function VisitGridChart({
  section,
  size = 'compact',
  onQuestionClick,
}: {
  section: GridSection;
  /** `compact` for the 2×2 grid, `large` inside the expanded view. */
  size?: 'compact' | 'large';
  onQuestionClick?: (questionIndex: number) => void;
}) {
  const large = size === 'large';
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(() => new Set());

  const maxVisitNo = useMemo(() => section.bars.reduce((m, b) => Math.max(m, b.visitNo), 1), [section.bars]);
  const bars = useMemo(() => section.bars.filter((b) => !hidden.has(b.visitNo)), [section.bars, hidden]);

  // Geometry: fixed internal coordinates; the SVG scales to its container.
  const W = large ? 1100 : 560;
  const H = large ? 470 : 320;
  const LEFT = large ? 64 : 52;
  const RIGHT = large ? 16 : 12;
  const TOP = large ? 40 : 34;
  const BOTTOM = large ? 52 : 48;
  const plotW = W - LEFT - RIGHT;
  const plotH = H - TOP - BOTTOM;
  const rows = Math.max(section.rowCount, 1);
  const rowH = plotH / rows;
  const barH = Math.max(Math.min(rowH * 0.5, large ? 9 : 6), 2.5);

  // Like Zuperscore, the time axis ends at the last visit (rounded up to a whole minute).
  const lastEnd = section.bars.reduce((m, b) => Math.max(m, b.end), 0);
  const domainMin = Math.max(1, Math.ceil(lastEnd / 60_000));
  const domainMs = domainMin * 60_000;

  const x = (ms: number) => LEFT + (Math.max(0, ms) / domainMs) * plotW;
  const yMid = (row: number) => TOP + plotH - (row + 0.5) * rowH;

  // Question labels are skipped counting down from the last question (Q27,
  // Q24, … Q3), as Chart.js does; every other one in the expanded view.
  const labelStep = large ? 2 : 3;
  const rotateTicks = !large && domainMin > 20;

  const fontSm = large ? 12 : 10;
  const fontXs = large ? 11 : 9;

  const toggleVisit = (n: number) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });

  const showTip = (e: React.MouseEvent, b: GridBar) => {
    const host = wrapRef.current?.getBoundingClientRect();
    if (!host) return;
    setTip({
      x: e.clientX - host.left,
      y: e.clientY - host.top,
      title: `Q${b.row + 1}`,
      body: `Visit ${b.visitNo}: [${(b.start / 60_000).toFixed(2)}, ${(b.end / 60_000).toFixed(2)}]`,
    });
  };

  const legendItemW = large ? 92 : 74;
  const legendStart = LEFT + plotW / 2 - (maxVisitNo * legendItemW) / 2;

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Time analytics for ${section.title}: one bar per visit to each question, placed at the time it happened.`}
        onMouseLeave={() => setTip(null)}
        style={{ display: 'block' }}
      >
        {/* Legend: Visit 1 … Visit N (click to hide or show) */}
        <g fontFamily="system-ui, sans-serif" fontSize={fontSm} fill={AXIS}>
          {Array.from({ length: maxVisitNo }, (_, i) => {
            const n = i + 1;
            const lx = legendStart + i * legendItemW;
            const off = hidden.has(n);
            return (
              <g key={n} className="cursor-pointer" onClick={() => toggleVisit(n)}>
                <rect x={lx} y={8} width={large ? 36 : 30} height={large ? 12 : 10} fill="#000" opacity={off ? 0.3 : 1} />
                <text
                  x={lx + (large ? 42 : 35)}
                  y={8 + (large ? 10 : 8.5)}
                  textDecoration={off ? 'line-through' : undefined}
                >
                  Visit {n}
                </text>
              </g>
            );
          })}
        </g>

        {/* Question labels + horizontal grid lines */}
        <g fontFamily="system-ui, sans-serif" fontSize={fontSm} fill={AXIS}>
          {Array.from({ length: section.rowCount }, (_, i) => {
            if ((section.rowCount - 1 - i) % labelStep !== 0) return null;
            return (
              <g key={i}>
                <line x1={LEFT} y1={yMid(i)} x2={LEFT + plotW} y2={yMid(i)} stroke={GRID} strokeWidth={1} />
                <text x={LEFT - 6} y={yMid(i) + fontSm * 0.35} textAnchor="end">Q{i + 1}</text>
              </g>
            );
          })}
          <text transform={`translate(${large ? 14 : 11} ${TOP + plotH / 2}) rotate(-90)`} textAnchor="middle" fill="#666">
            Questions
          </text>
        </g>

        {/* Axes */}
        <line x1={LEFT} y1={TOP + plotH} x2={LEFT + plotW} y2={TOP + plotH} stroke="#BDBDBD" strokeWidth={1} />
        <line x1={LEFT} y1={TOP} x2={LEFT} y2={TOP + plotH} stroke="#BDBDBD" strokeWidth={1} />

        {/* One tick per minute */}
        <g fontFamily="system-ui, sans-serif" fontSize={fontXs} fill={AXIS}>
          {Array.from({ length: domainMin + 1 }, (_, m) => {
            const tx = x(m * 60_000);
            return (
              <g key={m}>
                <line x1={tx} y1={TOP + plotH} x2={tx} y2={TOP + plotH + 4} stroke="#BDBDBD" strokeWidth={1} />
                {rotateTicks ? (
                  <text transform={`translate(${tx + 3} ${TOP + plotH + 9}) rotate(-45)`} textAnchor="end">{m}</text>
                ) : (
                  <text x={tx} y={TOP + plotH + 16} textAnchor="middle">{m}</text>
                )}
              </g>
            );
          })}
          <text x={LEFT + plotW / 2} y={H - (large ? 8 : 6)} textAnchor="middle" fontSize={fontSm} fill="#666">
            Time(in minutes)
          </text>
        </g>

        {/* Visit bars */}
        {bars.map((b) => {
          const x1 = x(b.start);
          const w = Math.max(x(b.end) - x1, 1);
          return (
            <g
              key={`${b.row}-${b.visitNo}`}
              className={onQuestionClick ? 'cursor-pointer' : undefined}
              onMouseMove={(e) => showTip(e, b)}
              onClick={() => onQuestionClick?.(b.row)}
            >
              <rect x={x1 - 2} y={yMid(b.row) - rowH / 2} width={w + 4} height={rowH} fill="transparent" />
              <rect
                x={x1}
                y={yMid(b.row) - barH / 2}
                width={w}
                height={barH}
                rx={1}
                fill={VISIT_FILL[b.result]}
                stroke="#000"
                strokeWidth={0.5}
              />
            </g>
          );
        })}
      </svg>

      {large && (
        <div className="absolute right-3 top-10 space-y-1 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-800">
          {(['correct', 'incorrect', 'unanswered'] as TaResult[]).map((r) => (
            <div key={r} className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: VISIT_FILL[r] }} />
              {VISIT_LABEL[r]}
            </div>
          ))}
        </div>
      )}

      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-md bg-black/80 px-2.5 py-1.5 text-xs text-white shadow"
          style={{
            left: Math.min(tip.x + 12, Math.max(0, (wrapRef.current?.clientWidth ?? 0) - 170)),
            top: tip.y + 14,
          }}
        >
          <div className="font-bold">{tip.title}</div>
          <div className="whitespace-nowrap">{tip.body}</div>
        </div>
      )}
    </div>
  );
}

/** One module's card in the grid: white, light border, expand icon top-right. */
export function VisitGridCard({
  section,
  onExpand,
  onQuestionClick,
}: {
  section: GridSection;
  onExpand: () => void;
  onQuestionClick?: (questionIndex: number) => void;
}) {
  return (
    <div className="relative rounded border border-[#E2E2E2] bg-white p-5">
      <button
        type="button"
        onClick={onExpand}
        aria-label={`Expand ${section.title} chart`}
        className="absolute right-3 top-3 z-10 rounded p-1 text-slate-700 hover:bg-slate-100"
      >
        <Expand size={18} />
      </button>
      <VisitGridChart section={section} onQuestionClick={onQuestionClick} />
    </div>
  );
}

/** Full-screen view of one chart: dark backdrop, lavender header with a close button, colour key. */
export function VisitGridModal({
  section,
  onClose,
  onQuestionClick,
}: {
  section: GridSection;
  onClose: () => void;
  onQuestionClick?: (questionIndex: number) => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={section.title}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-end bg-[#E0E1FA] px-3 py-2">
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-700 hover:bg-white/60">
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[85vh] overflow-auto p-4">
          <VisitGridChart section={section} size="large" onQuestionClick={onQuestionClick} />
        </div>
      </div>
    </div>
  );
}
