import { useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Clock } from 'lucide-react';
import type { TaSection, TaVisit, TaResult } from '../../lib/api';
import { fmtSec } from '../../lib/utils';

// Visit-level Time Analytics — a timeline (Gantt) chart with one bar per
// *visit* to a question, laid at the real time it happened. See the "Visit-Level
// Time Analytics" spec: colour = answer state when the student left the visit,
// diamonds = answer selections, bold outline = visit where the final answer was
// given, dashed outline = glance, pale gap = tab hidden / idle, dashed grey line
// = navigation path, blue dashed line = average time per question.

// Colours chosen for colour-vision deficiency (dark green vs light red differ
// strongly in lightness); incorrect bars also carry a hatch for greyscale print.
const COLOR: Record<TaResult, string> = { correct: '#166534', incorrect: '#F87171', unanswered: '#94A3B8' };
const STROKE: Record<TaResult, string> = { correct: '#14532D', incorrect: '#B91C1C', unanswered: '#64748B' };
const LABEL_ON: Record<TaResult, string> = { correct: '#FFFFFF', incorrect: '#7F1D1D', unanswered: '#1E293B' };
const PATH = '#94A3B8';
const AVG = '#3B82F6';
const FINAL_STROKE = '#0F172A';

const ROW_H = 18;
const TICK_STEPS_MS = [10, 15, 30, 60, 120, 300, 600, 900, 1800].map((s) => s * 1000);
const BAR_H = 11;
const LEFT = 40;
const RIGHT = 12;
const TOP = 8;
const AXIS_H = 34;

const RESULT_LABEL: Record<TaResult, string> = { correct: 'Correct', incorrect: 'Incorrect', unanswered: 'No answer' };
const CHANGE_LABEL: Record<string, string> = {
  none: '—', wrong_to_right: 'Wrong → right', right_to_wrong: 'Right → wrong', wrong_to_wrong: 'Wrong → wrong',
};

function choiceText(choice: unknown): string {
  if (choice === null || choice === undefined) return 'cleared';
  if (typeof choice === 'object') {
    const c = choice as { key?: string; keys?: string[]; value?: number; text?: string };
    if (c.key !== undefined) return String(c.key);
    if (Array.isArray(c.keys)) return c.keys.join(', ');
    if (c.text !== undefined) return String(c.text);
    if (c.value !== undefined) return String(c.value);
  }
  return String(choice);
}

const fmtMs = (ms: number) => fmtSec(Math.round(ms / 1000));
const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

type Mode = 'timeline' | 'order';

interface Tip { x: number; y: number; html: React.ReactNode }

/** Width of the element, tracked with ResizeObserver. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function VisitTimelineChart({
  section,
  onQuestionClick,
}: {
  section: TaSection;
  /** Called with the question's 0-based row index when a bar is clicked. */
  onQuestionClick?: (questionIndex: number) => void;
}) {
  const [mode, setMode] = useState<Mode>('timeline');
  const [zoom, setZoom] = useState(1);
  const [showGlances, setShowGlances] = useState(true);
  const [tip, setTip] = useState<Tip | null>(null);
  const [wrapRef, wrapW] = useWidth<HTMLDivElement>();

  const rowOf = useMemo(() => new Map(section.questionIds.map((q, i) => [q, i])), [section.questionIds]);
  const visitsPerQ = useMemo(() => {
    const m = new Map<string, number>();
    section.visits.forEach((v) => m.set(v.questionId, (m.get(v.questionId) ?? 0) + 1));
    return m;
  }, [section.visits]);

  // In "question order" mode every question's visits are stacked from x = 0,
  // which makes the total time per question easy to compare.
  const placed = useMemo(() => {
    const visible = section.visits.filter((v) => rowOf.has(v.questionId) && (showGlances || !v.glance));
    if (mode === 'timeline') {
      return visible.map((v) => ({ v, shift: section.offsetMs }));
    }
    const cursor = new Map<string, number>();
    return visible.map((v) => {
      const startAt = cursor.get(v.questionId) ?? 0;
      cursor.set(v.questionId, startAt + (v.end - v.start));
      return { v, shift: v.start - startAt };
    });
  }, [section.visits, section.offsetMs, rowOf, mode, showGlances]);

  const rows = section.questionIds.length;
  const plotH = rows * ROW_H;
  const svgW = Math.max(320, (wrapW || 640) * zoom);
  const plotW = svgW - LEFT - RIGHT;

  // Tick step first (≥ ~56 px apart), then a domain that ends on a tick.
  // Short modules get 10–30 s ticks instead of a bare "0 … 1" minute axis.
  const maxEnd = useMemo(() => placed.reduce((m, p) => Math.max(m, p.v.end - p.shift), 0), [placed]);
  const stepMs = TICK_STEPS_MS.find((st) => (st / Math.max(maxEnd, 10_000)) * plotW >= 56) ?? TICK_STEPS_MS[TICK_STEPS_MS.length - 1];
  const domainMs = Math.max(stepMs, Math.ceil(maxEnd / stepMs) * stepMs);
  const x = (ms: number) => LEFT + (ms / domainMs) * plotW;
  const yMid = (row: number) => TOP + row * ROW_H + ROW_H / 2;
  const ticks: number[] = [];
  for (let t = 0; t <= domainMs + 1; t += stepMs) ticks.push(t);
  const tickLabel = (t: number) => (stepMs < 60_000 ? fmtClock(t) : String(t / 60_000));

  // Navigation path: consecutive visits in time order (timeline mode only).
  const pathPoints = useMemo(() => {
    if (mode !== 'timeline') return '';
    const ordered = placed.slice().sort((a, b) => a.v.start - b.v.start);
    return ordered
      .map(({ v, shift }) => `${x(v.start - shift)},${yMid(rowOf.get(v.questionId)!)} ${x(v.end - shift)},${yMid(rowOf.get(v.questionId)!)}`)
      .join(' ');
  }, [placed, mode, svgW, domainMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const showTip = (e: React.MouseEvent, html: React.ReactNode) => {
    const host = wrapRef.current?.getBoundingClientRect();
    if (!host) return;
    setTip({ x: e.clientX - host.left, y: e.clientY - host.top, html });
  };

  const visitTip = (v: TaVisit) => {
    const row = rowOf.get(v.questionId)!;
    const paused = v.pauses.reduce((s, p) => s + p.end - p.start, 0);
    return (
      <>
        <div className="font-bold">Q{row + 1} · visit {v.visitNo}{v.glance ? ' (glance)' : ''}</div>
        <div>On screen: {fmtMs(v.activeMs)}{paused > 0 ? ` (+${fmtMs(paused)} hidden/idle, not counted)` : ''}</div>
        <div>{fmtClock(v.start - section.offsetMs)} → {fmtClock(v.end - section.offsetMs)}</div>
        <div>Answer on entry: {RESULT_LABEL[v.entryResult].toLowerCase()}</div>
        <div>
          Answers this visit:{' '}
          {v.answers.length ? v.answers.map((a) => `${choiceText(a.choice)} (${RESULT_LABEL[a.result].toLowerCase()})`).join(' → ') : 'no change'}
        </div>
        <div>
          Left as: <b>{RESULT_LABEL[v.exitResult].toLowerCase()}</b>
          {v.isFinal ? ' — final answer given here' : ''}
          {v.flagged ? ' · flagged' : ''}
        </div>
      </>
    );
  };

  const m = section.metrics;
  const multiVisit = section.summary.filter((s) => s.visits > 1);
  const [showAllRows, setShowAllRows] = useState(false);
  const tableRows = showAllRows ? section.summary : multiVisit;

  const chips: { label: string; value: string; hint: string }[] = [
    { label: 'Avg / question', value: fmtMs(section.avgMs), hint: 'Active time ÷ questions in this module' },
    { label: 'Right → wrong', value: String(m.rightToWrong), hint: 'First answer correct, final answer incorrect — second-guessing' },
    { label: 'Wrong → right', value: String(m.wrongToRight), hint: 'First answer incorrect, final answer correct — review is working' },
    {
      label: 'Revisits that helped',
      value: m.revisits ? `${m.revisitsImproved}/${m.revisits}` : '—',
      hint: 'Revisits that left the question in a better state than they found it',
    },
    {
      label: 'First-pass accuracy',
      value: m.firstPassAnswered ? `${Math.round((m.firstPassCorrect / m.firstPassAnswered) * 100)}%` : '—',
      hint: 'Correct on the first visit ÷ answered on the first visit',
    },
    { label: 'Skip & return', value: String(m.skipAndReturn), hint: 'Left unanswered on the first visit, answered later' },
    { label: 'Time sinks', value: String(m.timeSinks), hint: 'Visits longer than 2× the average that ended incorrect' },
    { label: 'Glances', value: String(m.glances), hint: 'Visits under 1.5 s with no answer change' },
    { label: 'Hidden / idle', value: fmtMs(m.pausedMs), hint: 'Time with the tab hidden or no input for 2 minutes (excluded from active time)' },
    { label: 'Still flagged', value: String(m.unfinishedFlags), hint: 'Questions still marked for review when the module ended' },
  ];

  return (
    <div className="space-y-4">
      {/* Insight chips */}
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <div key={c.label} title={c.hint} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex items-baseline gap-2 shadow-xs">
            <span className="text-sm font-bold text-gray-900 tabular-nums">{c.value}</span>
            <span className="text-[11px] text-gray-500">{c.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-bold" role="group" aria-label="Chart layout">
            {(['timeline', 'order'] as const).map((md) => (
              <button
                key={md}
                type="button"
                onClick={() => setMode(md)}
                aria-pressed={mode === md}
                className={`px-3 py-1.5 rounded-md ${mode === md ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {md === 'timeline' ? 'Timeline' : 'Question order'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showGlances} onChange={(e) => setShowGlances(e.target.checked)} />
              Show glances
            </label>
            <div className="inline-flex items-center gap-1">
              <button type="button" className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40" onClick={() => setZoom((z) => Math.max(1, z / 2))} disabled={zoom <= 1} aria-label="Zoom out">
                <ZoomOut size={14} />
              </button>
              <span className="tabular-nums w-7 text-center">{zoom}×</span>
              <button type="button" className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-40" onClick={() => setZoom((z) => Math.min(8, z * 2))} disabled={zoom >= 8} aria-label="Zoom in">
                <ZoomIn size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1.5 mb-3 text-[11px] font-medium text-gray-600">
          <LegendSwatch result="correct" label="Left correct" />
          <LegendSwatch result="incorrect" label="Left incorrect" />
          <LegendSwatch result="unanswered" label="No answer" />
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden="true"><path d="M6 1 11 6 6 11 1 6Z" fill="#fff" stroke="#334155" strokeWidth="1.5" /></svg>
            Answer selected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded-sm border-2" style={{ borderColor: FINAL_STROKE }} />
            Final answer given
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded-sm border border-dashed border-slate-500" />
            Glance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded-sm" style={{ background: 'repeating-linear-gradient(90deg,#166534 0 4px,#d9e6dd 4px 8px)' }} />
            Tab hidden / idle
          </span>
          {mode === 'timeline' && (
            <span className="flex items-center gap-1.5">
              <span className="w-5 border-t border-dashed" style={{ borderColor: PATH }} />
              Navigation path
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dashed" style={{ borderColor: AVG }} />
            Avg ({fmtMs(section.avgMs)})
          </span>
        </div>

        <div ref={wrapRef} className="relative">
          <div className="overflow-x-auto" onScroll={() => setTip(null)}>
            <svg
              width={svgW}
              height={TOP + plotH + AXIS_H}
              role="img"
              aria-label={`Timeline of visits to each question in ${section.name}. The table below lists the same data.`}
              onMouseLeave={() => setTip(null)}
              style={{ display: 'block' }}
            >
              <defs>
                <pattern id="ta-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                  <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(127,29,29,0.35)" strokeWidth="1.6" />
                </pattern>
              </defs>

              {/* Row stripes + labels */}
              {section.questionIds.map((q, i) => (
                <g key={q}>
                  {i % 2 === 0 && <rect x={LEFT} y={TOP + i * ROW_H} width={plotW} height={ROW_H} fill="#F8FAFC" />}
                  <text
                    x={LEFT - 6} y={yMid(i) + 3} textAnchor="end" fontSize={10}
                    fill={(visitsPerQ.get(q) ?? 0) > 1 ? '#0F172A' : '#64748B'}
                    fontWeight={(visitsPerQ.get(q) ?? 0) > 1 ? 700 : 400}
                    fontFamily="system-ui, sans-serif"
                  >
                    Q{i + 1}
                  </text>
                </g>
              ))}

              {/* Grid + axis */}
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={x(t)} y1={TOP} x2={x(t)} y2={TOP + plotH} stroke="#E2E8F0" strokeWidth={1} />
                  <text x={x(t)} y={TOP + plotH + 14} textAnchor="middle" fontSize={10} fill="#64748B" fontFamily="system-ui, sans-serif">
                    {tickLabel(t)}
                  </text>
                </g>
              ))}
              <text x={LEFT + plotW / 2} y={TOP + plotH + 30} textAnchor="middle" fontSize={10} fill="#64748B" fontFamily="system-ui, sans-serif">
                {mode === 'timeline' ? 'Time into module' : 'Time on question'}{stepMs < 60_000 ? ' (min:sec)' : ' (minutes)'}
              </text>

              {/* Navigation path */}
              {pathPoints && (
                <polyline points={pathPoints} fill="none" stroke={PATH} strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
              )}

              {/* Average time per question */}
              {section.avgMs > 0 && (
                <g pointerEvents="none">
                  <line x1={x(section.avgMs)} y1={TOP} x2={x(section.avgMs)} y2={TOP + plotH} stroke={AVG} strokeWidth={1.2} strokeDasharray="5 3" />
                  <text x={x(section.avgMs) + 4} y={TOP + plotH - 4} fontSize={9} fill={AVG} fontFamily="system-ui, sans-serif">
                    Avg {fmtMs(section.avgMs)}
                  </text>
                </g>
              )}

              {/* Visit bars */}
              {placed.map(({ v, shift }) => {
                const row = rowOf.get(v.questionId)!;
                const x1 = x(v.start - shift);
                const w = Math.max(x(v.end - shift) - x1, 2);
                const y = yMid(row) - BAR_H / 2;
                const color = COLOR[v.exitResult];
                const faded = !v.answers.length && !v.isFinal && !v.glance;
                return (
                  <g
                    key={`${v.questionId}-${v.visitNo}`}
                    className={onQuestionClick ? 'cursor-pointer' : undefined}
                    onMouseMove={(e) => showTip(e, visitTip(v))}
                    onClick={() => onQuestionClick?.(row)}
                  >
                    {/* generous invisible hit target */}
                    <rect x={x1 - 2} y={yMid(row) - ROW_H / 2} width={w + 4} height={ROW_H} fill="transparent" />
                    <rect
                      x={x1} y={y} width={w} height={BAR_H} rx={3}
                      fill={v.glance ? 'transparent' : color}
                      fillOpacity={faded ? 0.55 : 1}
                      stroke={v.isFinal ? FINAL_STROKE : v.glance ? '#64748B' : STROKE[v.exitResult]}
                      strokeWidth={v.isFinal ? 2.2 : 1}
                      strokeDasharray={v.glance ? '2 2' : undefined}
                    />
                    {v.exitResult === 'incorrect' && !v.glance && (
                      <rect x={x1} y={y} width={w} height={BAR_H} rx={3} fill="url(#ta-hatch)" pointerEvents="none" />
                    )}
                    {/* pale gap: tab hidden / idle */}
                    {!v.glance && v.pauses.map((p, i) => (
                      <rect
                        key={i}
                        x={x(p.start - shift)} y={y + 1}
                        width={Math.max(x(p.end - shift) - x(p.start - shift), 1)} height={BAR_H - 2}
                        fill="#FFFFFF" fillOpacity={0.7} pointerEvents="none"
                      />
                    ))}
                    {(visitsPerQ.get(v.questionId) ?? 0) > 1 && w > 26 && (
                      <text
                        x={x1 + 4} y={yMid(row) + 3} textAnchor="start" fontSize={8} fontWeight={700}
                        fill={LABEL_ON[v.exitResult]} fontFamily="system-ui, sans-serif" pointerEvents="none"
                      >
                        V{v.visitNo}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Answer-selection diamonds */}
              {placed.flatMap(({ v, shift }) =>
                v.answers.map((a, i) => {
                  const cx = x(a.t - shift);
                  const cy = yMid(rowOf.get(v.questionId)!);
                  const r = 4.5;
                  return (
                    <path
                      key={`${v.questionId}-${v.visitNo}-a${i}`}
                      d={`M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z`}
                      fill="#FFFFFF"
                      stroke={STROKE[a.result]}
                      strokeWidth={1.8}
                      onMouseMove={(e) =>
                        showTip(e, (
                          <>
                            <div className="font-bold">Q{rowOf.get(v.questionId)! + 1} · {fmtClock(a.t - section.offsetMs)}</div>
                            <div>Chose {choiceText(a.choice)} — {RESULT_LABEL[a.result].toLowerCase()}</div>
                            <div className="text-slate-300">was {RESULT_LABEL[a.from].toLowerCase()}</div>
                          </>
                        ))
                      }
                    />
                  );
                }),
              )}
            </svg>
          </div>

          {tip && (
            <div
              className="pointer-events-none absolute z-10 max-w-[260px] rounded-lg bg-slate-900/95 px-3 py-2 text-[11px] leading-relaxed text-white shadow-lg"
              style={{
                left: Math.min(tip.x + 12, Math.max(0, (wrapW || 0) - 270)),
                top: tip.y + 14,
              }}
            >
              {tip.html}
            </div>
          )}
        </div>
        {onQuestionClick && <p className="mt-2 text-[11px] text-slate-400 text-center">Click a bar to open that question.</p>}
      </div>

      {/* Companion table — also the accessible view of the chart */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-sm font-bold text-slate-900">
            {showAllRows ? 'All questions' : 'Questions visited more than once'}
          </h5>
          <button type="button" className="text-xs font-bold text-blue-600 hover:underline" onClick={() => setShowAllRows((s) => !s)}>
            {showAllRows ? 'Show revisited only' : 'Show all questions'}
          </button>
        </div>
        {tableRows.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">Every question was visited once — no revisits in this module.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Q</th>
                  <th className="py-2 pr-3 font-semibold text-center">Visits</th>
                  <th className="py-2 pr-3 font-semibold text-right">Active time</th>
                  <th className="py-2 pr-3 font-semibold">Answer pattern</th>
                  <th className="py-2 pr-3 font-semibold">Change</th>
                  <th className="py-2 pr-3 font-semibold">Final</th>
                  <th className="py-2 font-semibold text-center">Answered in visit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {tableRows.map((s) => {
                  const row = rowOf.get(s.questionId) ?? 0;
                  return (
                    <tr key={s.questionId} className={onQuestionClick ? 'hover:bg-slate-50 cursor-pointer' : undefined} onClick={() => onQuestionClick?.(row)}>
                      <td className="py-1.5 pr-3 font-bold">Q{row + 1}</td>
                      <td className="py-1.5 pr-3 text-center tabular-nums">{s.visits}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{fmtMs(s.totalMs)}</td>
                      <td className="py-1.5 pr-3 font-mono">{s.pattern}</td>
                      <td className={`py-1.5 pr-3 ${s.change === 'right_to_wrong' ? 'text-red-700 font-bold' : s.change === 'wrong_to_right' ? 'text-green-800 font-bold' : ''}`}>
                        {CHANGE_LABEL[s.change]}
                      </td>
                      <td className="py-1.5 pr-3">{RESULT_LABEL[s.finalResult]}</td>
                      <td className="py-1.5 text-center tabular-nums">{s.answeredInVisit ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-slate-400">Pattern: R = right, W = wrong, – = cleared. Active time excludes hidden-tab and idle time.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendSwatch({ result, label }: { result: TaResult; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="16" height="12" aria-hidden="true">
        <rect x="0.5" y="0.5" width="15" height="11" rx="2" fill={COLOR[result]} stroke={STROKE[result]} />
        {result === 'incorrect' && <rect x="0.5" y="0.5" width="15" height="11" rx="2" fill="url(#ta-hatch-legend)" />}
        <defs>
          <pattern id="ta-hatch-legend" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(127,29,29,0.35)" strokeWidth="1.6" />
          </pattern>
        </defs>
      </svg>
      {label}
    </span>
  );
}

/** Shown in place of the chart when an attempt has no visit data. */
export function NoVisitData() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-400 border border-dashed border-gray-200 rounded-xl">
      <Clock size={24} className="mb-2 opacity-40" />
      <p className="text-sm font-medium text-gray-500">No visits recorded in this module</p>
    </div>
  );
}
