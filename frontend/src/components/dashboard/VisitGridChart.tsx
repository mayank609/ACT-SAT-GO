import { useMemo, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import type { TaSection, TaVisit, TaResult } from '../../lib/api';
import { fmtSec } from '../../lib/utils';

// Compact visit-level pacing chart — one card per module, meant to sit four
// to a page. One bar per *visit* to a question, placed at the real time it
// happened, coloured by the answer state when the student left that visit.
// A dashed line traces the student's path between consecutive visits, so
// jumps back to earlier questions stand out. Q1 sits at the bottom.

const FILL: Record<TaResult, string> = {
  correct: '#5BB85C',
  incorrect: '#E5484D',
  unanswered: '#6A5ACD',
};
const PATH = '#4B5563';
const AXIS = '#374151';
const GRID = '#E5E7EB';
const CARD_BG = '#F3F4F6';

const RESULT_LABEL: Record<TaResult, string> = { correct: 'Correct', incorrect: 'Incorrect', unanswered: 'Not answered' };

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Section time limit used for the x-axis, so all four charts share a scale. */
function moduleMinutes(name: string): number {
  return /math/i.test(name) ? 35 : 32;
}

interface Tip { x: number; y: number; node: React.ReactNode }

export function VisitGridChart({
  section,
  size = 'compact',
  onExpand,
  onQuestionClick,
}: {
  section: TaSection;
  /** `compact` for the 2×2 grid, `large` inside the expanded modal. */
  size?: 'compact' | 'large';
  onExpand?: () => void;
  onQuestionClick?: (questionIndex: number) => void;
}) {
  const large = size === 'large';
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const rowOf = useMemo(() => new Map(section.questionIds.map((q, i) => [q, i])), [section.questionIds]);
  const visits = useMemo(
    () => section.visits.filter((v) => rowOf.has(v.questionId)).slice().sort((a, b) => a.start - b.start),
    [section.visits, rowOf],
  );
  const maxVisitNo = useMemo(() => visits.reduce((m, v) => Math.max(m, v.visitNo), 0), [visits]);

  // Geometry — fixed internal coordinates; the SVG scales to its container.
  const W = large ? 1100 : 520;
  const H = large ? 560 : 300;
  const LEFT = large ? 64 : 50;
  const RIGHT = large ? 24 : 16;
  const TOP = large ? 20 : 14;
  const BOTTOM = large ? 56 : 48;
  const plotW = W - LEFT - RIGHT;
  const plotH = H - TOP - BOTTOM;
  const rows = Math.max(section.questionIds.length, 1);
  const rowH = plotH / rows;
  const barH = Math.max(Math.min(rowH * 0.5, large ? 9 : 6), 3);

  const limitMs = moduleMinutes(section.name) * 60_000;
  const usedMs = visits.reduce((m, v) => Math.max(m, v.end - section.offsetMs), 0);
  const domainMin = Math.max(moduleMinutes(section.name), Math.ceil(usedMs / 60_000));
  const domainMs = Math.max(domainMin * 60_000, limitMs);

  const x = (ms: number) => LEFT + (Math.max(0, ms) / domainMs) * plotW;
  // Q1 at the bottom, higher questions upward.
  const yMid = (row: number) => TOP + plotH - (row + 0.5) * rowH;

  const minuteTicks = useMemo(() => {
    const t: number[] = [];
    for (let m = 0; m <= domainMin; m++) t.push(m);
    return t;
  }, [domainMin]);
  const everyMinute = large || domainMin <= 36;
  const qLabelStep = rows > 30 ? 5 : 3;

  const pathD = useMemo(() => {
    if (visits.length < 2) return '';
    const parts: string[] = [];
    for (let i = 1; i < visits.length; i++) {
      const a = visits[i - 1];
      const b = visits[i];
      parts.push(
        `M${x(a.end - section.offsetMs).toFixed(1)} ${yMid(rowOf.get(a.questionId)!).toFixed(1)} ` +
        `L${x(b.start - section.offsetMs).toFixed(1)} ${yMid(rowOf.get(b.questionId)!).toFixed(1)}`,
      );
    }
    return parts.join(' ');
  }, [visits, section.offsetMs, rowOf, W, H]); // eslint-disable-line react-hooks/exhaustive-deps

  const showTip = (e: React.MouseEvent, node: React.ReactNode) => {
    const host = wrapRef.current?.getBoundingClientRect();
    if (!host) return;
    setTip({ x: e.clientX - host.left, y: e.clientY - host.top, node });
  };

  const visitTip = (v: TaVisit) => {
    const row = rowOf.get(v.questionId)!;
    return (
      <>
        <div className="font-bold">Q{row + 1} · Visit {v.visitNo}</div>
        <div>{fmtClock(v.start - section.offsetMs)} → {fmtClock(v.end - section.offsetMs)} ({fmtSec(Math.round(v.activeMs / 1000))})</div>
        <div>Left as: <b>{RESULT_LABEL[v.exitResult]}</b>{v.isFinal ? ' (final answer)' : ''}</div>
      </>
    );
  };

  const fontSm = large ? 12 : 9;
  const fontXs = large ? 11 : 8;

  return (
    <div
      ref={wrapRef}
      className="relative rounded-lg border border-gray-200"
      style={{ background: CARD_BG }}
    >
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          aria-label={`Expand ${section.name} chart`}
          className="absolute right-2 top-2 z-10 rounded p-1 text-gray-600 hover:bg-white hover:text-gray-900"
        >
          <Maximize2 size={14} />
        </button>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Pacing chart for ${section.name}: one bar per visit to each question, placed at the time it happened.`}
        onMouseLeave={() => setTip(null)}
        style={{ display: 'block' }}
      >
        {/* Legend: Visit 1 … Visit N */}
        <g fontFamily="system-ui, sans-serif" fontSize={fontSm} fill={AXIS}>
          {Array.from({ length: Math.max(maxVisitNo, 1) }, (_, i) => {
            const n = Math.max(maxVisitNo, 1);
            const itemW = large ? 90 : 64;
            const startX = LEFT + plotW / 2 - (n * itemW) / 2;
            const cx = startX + i * itemW;
            return (
              <g key={i}>
                <rect x={cx} y={TOP - (large ? 6 : 4)} width={large ? 28 : 20} height={large ? 12 : 9} fill="#111827" />
                <text x={cx + (large ? 34 : 24)} y={TOP + (large ? 4 : 3)}>Visit {i + 1}</text>
              </g>
            );
          })}
        </g>

        {/* Row grid lines + Q labels */}
        <g fontFamily="system-ui, sans-serif" fontSize={fontSm} fill={AXIS}>
          {section.questionIds.map((q, i) => {
            const labelled = (i + 1) % qLabelStep === 0;
            return (
              <g key={q}>
                <line x1={LEFT} y1={yMid(i)} x2={LEFT + plotW} y2={yMid(i)} stroke={GRID} strokeWidth={1} />
                {labelled && (
                  <text x={LEFT - 6} y={yMid(i) + fontSm * 0.35} textAnchor="end">Q{i + 1}</text>
                )}
              </g>
            );
          })}
          <text
            transform={`translate(${large ? 16 : 11} ${TOP + plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={fontSm}
          >
            Questions
          </text>
        </g>

        {/* Axes */}
        <line x1={LEFT} y1={TOP + plotH} x2={LEFT + plotW} y2={TOP + plotH} stroke={AXIS} strokeWidth={1} />
        <line x1={LEFT} y1={TOP + 8} x2={LEFT} y2={TOP + plotH} stroke={AXIS} strokeWidth={1} />

        {/* Minute ticks */}
        <g fontFamily="system-ui, sans-serif" fontSize={fontXs} fill={AXIS}>
          {minuteTicks.map((m) => {
            const tx = x(m * 60_000);
            const show = everyMinute || m % 2 === 0;
            return (
              <g key={m}>
                <line x1={tx} y1={TOP + plotH} x2={tx} y2={TOP + plotH + 4} stroke={AXIS} strokeWidth={1} />
                {show && (
                  <text transform={`translate(${tx} ${TOP + plotH + 8}) rotate(-45)`} textAnchor="end">{m}</text>
                )}
              </g>
            );
          })}
          <text x={LEFT + plotW / 2} y={H - (large ? 10 : 6)} textAnchor="middle" fontSize={fontSm}>
            Time(in minutes)
          </text>
        </g>

        {/* Navigation path between consecutive visits */}
        {pathD && (
          <path d={pathD} fill="none" stroke={PATH} strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
        )}

        {/* Visit bars */}
        {visits.map((v) => {
          const row = rowOf.get(v.questionId)!;
          const x1 = x(v.start - section.offsetMs);
          const w = Math.max(x(v.end - section.offsetMs) - x1, 2.5);
          const y = yMid(row) - barH / 2;
          return (
            <g
              key={`${v.questionId}-${v.visitNo}`}
              className={onQuestionClick ? 'cursor-pointer' : undefined}
              onMouseMove={(e) => showTip(e, visitTip(v))}
              onClick={() => onQuestionClick?.(row)}
            >
              <rect x={x1 - 2} y={yMid(row) - rowH / 2} width={w + 4} height={rowH} fill="transparent" />
              <rect x={x1} y={y} width={w} height={barH} rx={1.5} fill={FILL[v.exitResult]} />
            </g>
          );
        })}
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 max-w-[240px] rounded-md bg-slate-900/95 px-2.5 py-1.5 text-[11px] leading-relaxed text-white shadow-lg"
          style={{
            left: Math.min(tip.x + 12, Math.max(0, (wrapRef.current?.clientWidth ?? 0) - 250)),
            top: tip.y + 14,
          }}
        >
          {tip.node}
        </div>
      )}
    </div>
  );
}

/** Legend for the colour coding, shown once under the grid rather than in every card. */
export function VisitGridLegend() {
  return (
    <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-1.5 text-[11px] font-medium text-gray-600">
      {(['correct', 'incorrect', 'unanswered'] as TaResult[]).map((r) => (
        <span key={r} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: FILL[r] }} />
          {RESULT_LABEL[r]}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-5 border-t border-dashed" style={{ borderColor: PATH }} />
        Order of attempt
      </span>
      <span className="text-gray-400">Each bar is one visit to a question, at the time it happened.</span>
    </div>
  );
}
