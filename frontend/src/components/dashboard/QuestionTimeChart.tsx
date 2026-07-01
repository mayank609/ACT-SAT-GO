import { useMemo, useRef, useState } from 'react';
import { Clock, AlertTriangle, Zap } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
export type QuestionTimeStat = {
  questionIndex: number;
  sectionName: string;
  timeSpentSeconds: number;
  status: 'correct' | 'incorrect' | 'skipped';
  difficulty: string;
  topicName: string;
};

// Thresholds for flagging pacing problems (seconds)
const SLOW_THRESHOLD = 90;
const RUSHED_THRESHOLD = 20;

const STATUS_COLOR: Record<string, string> = {
  correct:   '#10b981',  // emerald
  incorrect: '#ef4444',  // red
  skipped:   '#cbd5e1',  // slate
};

// ─── Gantt chart ──────────────────────────────────────────────────────────────
function GanttChart({ sorted, avgTime }: { sorted: QuestionTimeStat[]; avgTime: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [crosshair, setCrosshair] = useState<{ x: number; timeSec: number } | null>(null);

  // Build cumulative start times
  const rows = useMemo(() => {
    let cursor = 0;
    return sorted.map(q => {
      const start = cursor;
      cursor += q.timeSpentSeconds;
      return { ...q, startSec: start };
    });
  }, [sorted]);

  const totalSec = useMemo(() => rows.reduce((s, r) => s + r.timeSpentSeconds, 0), [rows]);

  // X-axis domain is the section's allotted time, not the time actually used:
  // Reading & Writing = 32 min, Math = 35 min. (Falls back to R&W if unknown.)
  const isMathSection = /math/i.test(sorted[0]?.sectionName ?? '');
  const sectionMaxMin = isMathSection ? 35 : 32;
  const domainSec = Math.max(sectionMaxMin * 60, totalSec);

  // Chart dimensions
  const ROW_H    = 12;   // px per question row (compact)
  const ROW_GAP  = 0;    // no gap between rows — bars stick to each other
  const LABEL_W  = 36;   // px for "Q27" labels on the left
  const TICK_H   = 24;   // px for the time axis at bottom
  const PADDING  = 12;   // px right margin

  const chartH = rows.length * (ROW_H + ROW_GAP);

  // We'll render into an auto-width container; use a viewBox trick with SVG
  // that scales to fill the container width.
  // For the x-axis, we map [0, domainSec] → [LABEL_W, chartW].
  // We don't know chartW at render time, so we use a fixed internal coordinate
  // system and let SVG viewBox scale it. Internal width = 1000 units.
  const IW = 1000; // internal width units
  const plotW = IW - LABEL_W - PADDING;

  const toX = (sec: number) => LABEL_W + (sec / Math.max(domainSec, 1)) * plotW;

  // Y-axis ordering: Q1 sits at the bottom (origin) and indices grow upward.
  const toRowY = (i: number) => (rows.length - 1 - i) * (ROW_H + ROW_GAP);

  // Time axis ticks — aim for ~8-12 ticks in minutes, spanning the full domain
  const domainMin = domainSec / 60;
  const tickStep = domainMin <= 10 ? 1 : domainMin <= 20 ? 2 : domainMin <= 40 ? 5 : 10;
  const ticks: number[] = [];
  for (let m = 0; m <= domainMin; m += tickStep) ticks.push(m);
  if (ticks[ticks.length - 1] !== domainMin) ticks.push(domainMin);

  const svgH = chartH + TICK_H + 8;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const x = svgPt.x;
    if (x < LABEL_W || x > IW - PADDING) { setCrosshair(null); return; }
    const timeSec = Math.round(((x - LABEL_W) / plotW) * domainSec);
    setCrosshair({ x, timeSec });
  };

  return (
    <div className="overflow-x-auto w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${IW} ${svgH}`}
        className="w-full cursor-crosshair"
        style={{ minWidth: Math.max(500, sorted.length * 8) }}
        xmlns="http://www.w3.org/2000/svg"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCrosshair(null)}
      >
        {/* ── Grid lines ── */}
        {ticks.map(m => {
          const x = toX(m * 60);
          return (
            <line
              key={m}
              x1={x} y1={0} x2={x} y2={chartH}
              stroke="#f1f5f9" strokeWidth={1}
            />
          );
        })}

        {/* ── Avg time reference line ── */}
        {rows.map((r) => {
          const avgX = toX(r.startSec + avgTime);
          // only draw if it's within this row's bar
          return avgX <= toX(r.startSec + r.timeSpentSeconds) ? null : null;
        })}

        {/* ── Question rows ── */}
        {rows.map((r, i) => {
          const y       = toRowY(i);
          const x1      = toX(r.startSec);
          const x2      = toX(r.startSec + r.timeSpentSeconds);
          const barW    = Math.max(x2 - x1, 1.5);
          const fill    = STATUS_COLOR[r.status] || STATUS_COLOR.skipped;
          const label   = `Q${r.questionIndex}`;
          const tipText = `Q${r.questionIndex} | ${r.topicName || '—'} | ${r.status} | ${r.timeSpentSeconds}s`;

          return (
            <g key={r.questionIndex}>
              {/* Row stripe (even rows) */}
              {i % 2 === 0 && (
                <rect x={0} y={y} width={IW} height={ROW_H + ROW_GAP}
                  fill="#f9fafb" fillOpacity={0.5} />
              )}
              {/* Q label — only even-numbered questions, to keep the axis uncluttered */}
              {r.questionIndex % 2 === 0 && (
                <text
                  x={LABEL_W - 4} y={y + ROW_H / 2 + 3}
                  textAnchor="end" fontSize={8} fill="#6b7280" fontFamily="system-ui, sans-serif"
                >
                  {label}
                </text>
              )}
              {/* Bar — fills the full row height so bars sit flush with no gap */}
              <rect
                x={x1} y={y} width={barW} height={ROW_H}
                rx={1.5} ry={1.5} fill={fill} fillOpacity={0.9}
              >
                <title>{tipText}</title>
              </rect>
            </g>
          );
        })}

        {/* ── Avg time vertical dashed line ── */}
        {(() => {
          // cumulative avg = at the midpoint of the total
          const avgX = toX(avgTime);
          return (
            <line
              x1={avgX} y1={0} x2={avgX} y2={chartH}
              stroke="#60a5fa" strokeWidth={1.2}
              strokeDasharray="5 3"
            />
          );
        })()}

        {/* ── X-axis tick labels ── */}
        {ticks.map(m => {
          const x = toX(m * 60);
          return (
            <g key={m}>
              <line x1={x} y1={chartH} x2={x} y2={chartH + 5} stroke="#e2e8f0" strokeWidth={1} />
              <text
                x={x} y={chartH + 16}
                textAnchor="middle" fontSize={9} fill="#94a3b8"
                fontFamily="system-ui, sans-serif"
              >
                {m}
              </text>
            </g>
          );
        })}

        {/* ── X-axis label ── */}
        <text
          x={LABEL_W + plotW / 2} y={svgH - 1}
          textAnchor="middle" fontSize={9} fill="#94a3b8"
          fontFamily="system-ui, sans-serif"
        >
          Time (in minutes)
        </text>

        {/* ── Hover crosshair ── */}
        {crosshair && (() => {
          const { x, timeSec } = crosshair;
          const mins = Math.floor(timeSec / 60);
          const secs = timeSec % 60;
          const label = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
          const tipW = 52;
          const tipX = x + tipW + 8 > IW - PADDING ? x - tipW - 6 : x + 6;
          return (
            <g pointerEvents="none">
              <line x1={x} y1={0} x2={x} y2={chartH} stroke="#475569" strokeWidth={1} strokeDasharray="4 3" />
              <rect x={tipX} y={4} width={tipW} height={18} rx={4} fill="#1e293b" fillOpacity={0.88} />
              <text
                x={tipX + tipW / 2} y={16}
                textAnchor="middle" fontSize={9} fill="white"
                fontFamily="system-ui, sans-serif" fontWeight="600"
              >
                {label}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export function QuestionTimeChart({ stats }: { stats: QuestionTimeStat[] }) {
  const sorted = useMemo(
    () => [...stats].sort((a, b) => a.questionIndex - b.questionIndex),
    [stats]
  );

  const { avgTime, slowCount, rushedCount } = useMemo(() => {
    if (sorted.length === 0) return { avgTime: 0, slowCount: 0, rushedCount: 0 };
    const total = sorted.reduce((a, q) => a + q.timeSpentSeconds, 0);
    return {
      avgTime: Math.round(total / sorted.length),
      slowCount: sorted.filter(q => q.timeSpentSeconds >= SLOW_THRESHOLD).length,
      rushedCount: sorted.filter(q => q.timeSpentSeconds < RUSHED_THRESHOLD && q.status !== 'skipped').length,
    };
  }, [sorted]);

  return (
    <div className="space-y-4">
      {/* Pacing stat cards — compact, left-aligned chips */}
      <div className="flex flex-wrap gap-2">
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-xs">
          <Clock size={14} className="text-gray-400" />
          <span className="text-sm font-bold text-gray-900">{avgTime}s</span>
          <span className="text-[11px] text-gray-500">avg / question</span>
        </div>
        <div className="bg-red-50/50 border border-red-100 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-xs">
          <AlertTriangle size={14} className="text-red-600" />
          <span className="text-sm font-bold text-red-600">{slowCount}</span>
          <span className="text-[11px] text-red-500">slow &ge; {SLOW_THRESHOLD}s</span>
        </div>
        <div className="bg-amber-50/50 border border-amber-100 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-xs">
          <Zap size={14} className="text-amber-600" />
          <span className="text-sm font-bold text-amber-600">{rushedCount}</span>
          <span className="text-[11px] text-amber-500">rushed &lt; {RUSHED_THRESHOLD}s</span>
        </div>
      </div>

      {/* Gantt chart */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <Clock size={24} className="mb-2 opacity-40" />
          <p className="text-sm font-medium text-gray-500">No timing data recorded</p>
          <p className="text-xs text-gray-400 mt-1">Complete a timed test to see time spent per question.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          {/* Legend */}
          <div className="flex justify-center items-center gap-5 mb-4 text-[11px] font-medium text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLOR.correct }} />
              Correct
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLOR.incorrect }} />
              Incorrect
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLOR.skipped }} />
              Skipped
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 border-t-2 border-dashed border-blue-400 inline-block" />
              Avg ({avgTime}s)
            </div>
          </div>

          <GanttChart sorted={sorted} avgTime={avgTime} />
        </div>
      )}
    </div>
  );
}
