import { useState, type ReactNode } from 'react';
import {
  Calendar, ChevronDown, Download, Clock, ListChecks, Gauge, Timer,
  CheckCircle2, XCircle, MinusCircle, HelpCircle, Target,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { fmtTime, accuracy as accuracyOf, avgTime as avgTimeOf, type Agg } from '../../lib/analyticsData';

const C = { emerald: '#10b981', rose: '#f43f5e', slate: '#94a3b8', amber: '#f59e0b' };

// ── Date range control ──────────────────────────────────────────────────────
export type DateRangePreset = 'all' | 'month' | '30d' | '3m' | 'custom';
export interface DateRangeState { preset: DateRangePreset; from: string; to: string }
export const DEFAULT_DATE_RANGE: DateRangeState = { preset: 'all', from: '', to: '' };

export function resolveDateRange(state: DateRangeState): { start: Date | null; end: Date | null; label: string } {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  switch (state.preset) {
    case 'all':
      return { start: null, end: null, label: 'All Time' };
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: endOfToday, label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
    }
    case '30d': {
      const start = new Date(endOfToday.getTime() - 29 * 86400000);
      return { start, end: endOfToday, label: 'Last 30 Days' };
    }
    case '3m': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { start, end: endOfToday, label: 'Last 3 Months' };
    }
    default: {
      const start = state.from ? new Date(`${state.from}T00:00:00`) : null;
      const end = state.to ? new Date(`${state.to}T23:59:59`) : null;
      const label = start && end
        ? `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : 'Custom Range';
      return { start, end, label };
    }
  }
}

function DateRangeControl({ value, onChange, disabled }: { value: DateRangeState; onChange: (s: DateRangeState) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const { label } = resolveDateRange(value);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-gray-300 transition-colors"
      >
        <Calendar size={14} className="text-gray-400" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl p-3 z-20 space-y-1.5">
            {([['all', 'All Time'], ['month', 'This Month'], ['30d', 'Last 30 Days'], ['3m', 'Last 3 Months']] as const).map(([key, lbl]) => (
              <button
                key={key}
                onClick={() => { onChange({ ...value, preset: key }); setOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${value.preset === key ? 'bg-[#1b3d6e] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {lbl}
              </button>
            ))}
            <div className="pt-2 border-t border-gray-100 space-y-1.5">
              <p className="text-[11px] font-semibold text-gray-500">Custom range</p>
              <div className="flex items-center gap-1.5">
                <input type="date" value={value.from} onChange={e => onChange({ ...value, preset: 'custom', from: e.target.value })}
                  className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700" />
                <span className="text-gray-300 text-xs">–</span>
                <input type="date" value={value.to} onChange={e => onChange({ ...value, preset: 'custom', to: e.target.value })}
                  className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Delta indicators ────────────────────────────────────────────────────────
function KpiDelta({ diff, format, positiveIsGood = true }: { diff: number | null; format: (n: number) => string; positiveIsGood?: boolean }) {
  if (diff == null) return <span className="text-white/40 text-[11px]">No prior data</span>;
  if (diff === 0) return <span className="text-white/50 text-[11px]">No change vs previous period</span>;
  const up = diff > 0;
  const good = positiveIsGood ? up : !up;
  return (
    <span className={`text-[11px] font-semibold ${good ? 'text-emerald-200' : 'text-rose-200'}`}>
      {up ? '↑' : '↓'} {format(Math.abs(diff))} from previous period
    </span>
  );
}

function MiniDelta({ diff, positiveIsGood = true }: { diff: number | null; positiveIsGood?: boolean }) {
  if (diff == null) return <span className="text-gray-300 text-[10px]">No prior data</span>;
  if (diff === 0) return <span className="text-gray-400 text-[10px]">No change</span>;
  const up = diff > 0;
  const good = positiveIsGood ? up : !up;
  return (
    <span className={`text-[10px] font-semibold ${good ? 'text-emerald-600' : 'text-rose-600'}`}>
      {up ? '↑' : '↓'} {Math.abs(diff)} from prev.
    </span>
  );
}

// ── Question breakdown donut ────────────────────────────────────────────────
function QuestionDonut({ correct, incorrect, skipped, doubts }: { correct: number; incorrect: number; skipped: number; doubts: number }) {
  const total = correct + incorrect + skipped;
  const accPct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const slices = [
    { name: 'Correct', value: correct, color: C.emerald },
    { name: 'Incorrect', value: incorrect, color: C.rose },
    { name: 'Skipped', value: skipped, color: C.slate },
  ].filter(d => d.value > 0);

  return (
    <div className="flex items-center gap-4 h-full">
      <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie data={slices} cx={57} cy={57} innerRadius={38} outerRadius={55}
              dataKey="value" stroke="none" paddingAngle={2}>
              {slices.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-black text-gray-900">{accPct}%</span>
          <span className="text-[10px] text-gray-400">accuracy</span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 flex-1 min-w-0">
        {[
          { label: 'Correct', value: correct, color: C.emerald },
          { label: 'Incorrect', value: incorrect, color: C.rose },
          { label: 'Skipped', value: skipped, color: C.slate },
          { label: 'Doubts', value: doubts, color: C.amber },
        ].map(r => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
            <span className="text-xs text-gray-500 flex-1">{r.label}</span>
            <span className="text-xs font-bold text-gray-800">{r.value}</span>
            <div className="w-14 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${total > 0 ? (r.value / total) * 100 : 0}%`, background: r.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main overview header ────────────────────────────────────────────────────
export interface AnalyticsOverviewHeaderProps {
  leftAccessory?: ReactNode;
  title?: string;
  subtitle?: string;
  scopeControl?: ReactNode;
  dateRange: DateRangeState;
  onDateRangeChange: (s: DateRangeState) => void;
  dateRangeDisabled?: boolean;
  onDownload: () => void;
  downloadDisabled?: boolean;
  current: { agg: Agg; avgScore: number | null; testCount: number };
  previous?: { agg: Agg; avgScore: number | null; testCount: number } | null;
  scoreMax?: number;
  onIncorrectClick?: () => void;
  onDoubtsClick?: () => void;
}

export function AnalyticsOverviewHeader({
  leftAccessory, title, subtitle, scopeControl, dateRange, onDateRangeChange, dateRangeDisabled,
  onDownload, downloadDisabled, current, previous, scoreMax = 1600, onIncorrectClick, onDoubtsClick,
}: AnalyticsOverviewHeaderProps) {
  const acc = accuracyOf(current.agg);
  const prevAcc = previous ? accuracyOf(previous.agg) : null;
  const avgQTime = avgTimeOf(current.agg);
  const prevAvgQTime = previous ? avgTimeOf(previous.agg) : null;

  const kpis = [
    {
      label: 'Total Study Time', icon: <Clock size={20} />, value: fmtTime(current.agg.time),
      delta: <KpiDelta diff={previous ? current.agg.time - previous.agg.time : null} format={fmtTime} />,
    },
    {
      label: 'Questions Attempted', icon: <ListChecks size={20} />, value: current.agg.total,
      delta: <KpiDelta diff={previous ? current.agg.total - previous.agg.total : null} format={n => `${n}`} />,
    },
    {
      label: 'Average Score', icon: <Target size={20} />, value: <>{current.avgScore ?? '—'} <span className="text-lg font-bold text-blue-200/70">/ {scoreMax}</span></>,
      delta: <KpiDelta diff={previous && current.avgScore != null && previous.avgScore != null ? current.avgScore - previous.avgScore : null} format={n => `${n} points`} />,
    },
    {
      label: 'Average Accuracy', icon: <Gauge size={20} />, value: `${acc}%`,
      delta: <KpiDelta diff={previous ? acc - (prevAcc ?? 0) : null} format={n => `${n}%`} />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header + filters ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-3">
        {(title || leftAccessory) && (
          <div className="flex items-center gap-3 min-w-0">
            {leftAccessory}
            {title && (
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900">{title}</h1>
                {subtitle && <p className="text-gray-500 text-sm mt-0.5 truncate">{subtitle}</p>}
              </div>
            )}
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {scopeControl}
          <DateRangeControl value={dateRange} onChange={onDateRangeChange} disabled={dateRangeDisabled} />
          <button
            type="button"
            onClick={onDownload}
            disabled={downloadDisabled}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1b3d6e] text-white rounded-xl text-sm font-semibold shadow-sm hover:bg-[#15305a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={14} />
            <span className="whitespace-nowrap">Download Report</span>
          </button>
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-gradient-to-br from-[#1b3d6e] to-[#1e4d8c] rounded-2xl p-4 shadow-lg shadow-blue-200/40 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/5 rounded-full pointer-events-none" />
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center text-white mb-3">{k.icon}</div>
              <p className="text-blue-200/80 text-[11px] font-bold uppercase tracking-wide mb-1">{k.label}</p>
              <p className="text-2xl font-black text-white tabular-nums leading-tight">{k.value}</p>
              <div className="mt-1.5">{k.delta}</div>
            </div>
          </div>
        ))}
        <div className="bg-gradient-to-br from-[#2f6fd6] to-[#3b82f6] rounded-2xl p-4 shadow-lg shadow-blue-200/40 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full pointer-events-none" />
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center text-white mb-3"><Timer size={20} /></div>
            <p className="text-blue-100 text-[11px] font-bold uppercase tracking-wide mb-1">Avg. Time / Question</p>
            <p className="text-2xl font-black text-white tabular-nums leading-tight">{avgQTime}s</p>
            <div className="mt-1.5"><KpiDelta diff={previous ? avgQTime - (prevAvgQTime ?? 0) : null} format={n => `${n}s`} positiveIsGood={false} /></div>
          </div>
        </div>
      </div>

      {/* ── Mini stat cards + question breakdown ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Correct Answers', value: current.agg.correct, prev: previous?.agg.correct ?? null, icon: <CheckCircle2 size={16} />, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Incorrect Answers', value: current.agg.incorrect, prev: previous?.agg.incorrect ?? null, icon: <XCircle size={16} />, color: 'text-rose-600 bg-rose-50', positiveIsGood: false, onClick: onIncorrectClick },
            { label: 'Skipped Questions', value: current.agg.skipped, prev: previous?.agg.skipped ?? null, icon: <MinusCircle size={16} />, color: 'text-amber-600 bg-amber-50', positiveIsGood: false },
            { label: 'Doubts Raised', value: current.agg.doubts, prev: previous?.agg.doubts ?? null, icon: <HelpCircle size={16} />, color: 'text-purple-600 bg-purple-50', onClick: onDoubtsClick },
          ].map(m => (
            <div
              key={m.label}
              onClick={m.onClick}
              title={m.onClick ? `View this student’s ${m.label.toLowerCase()}` : undefined}
              className={`bg-white border border-gray-100 rounded-xl shadow-sm p-3.5 ${m.onClick ? 'cursor-pointer hover:border-gray-200 hover:shadow-md transition-all' : ''}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${m.color}`}>{m.icon}</span>
                <span className="text-[11px] font-semibold text-gray-500 leading-tight">{m.label}</span>
              </div>
              <p className="text-2xl font-black text-gray-900 tabular-nums">{m.value}</p>
              <div className="mt-1">
                <MiniDelta diff={previous ? m.value - (m.prev ?? 0) : null} positiveIsGood={m.positiveIsGood ?? true} />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={15} className="text-indigo-500" />
            <span className="text-sm font-bold text-gray-800">Question Breakdown</span>
          </div>
          <div style={{ height: 150 }}>
            <QuestionDonut
              correct={current.agg.correct}
              incorrect={current.agg.incorrect}
              skipped={current.agg.skipped}
              doubts={current.agg.doubts}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
