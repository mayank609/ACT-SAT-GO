import { useMemo } from 'react';
import { Clock, AlertTriangle, Zap } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

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
  correct: '#10b981',   // emerald
  incorrect: '#ef4444', // red
  skipped: '#cbd5e1',   // slate
};

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload as QuestionTimeStat;
  return (
    <div className="bg-slate-900 text-white p-2.5 rounded-lg text-[11px] shadow-xl border border-slate-800 space-y-1 text-left">
      <p className="font-bold text-blue-400">Question {d.questionIndex}</p>
      <p><span className="text-slate-300">Topic:</span> {d.topicName || '—'}</p>
      <p className="capitalize"><span className="text-slate-300">Result:</span> {d.status}</p>
      <p><span className="text-slate-300">Time:</span> <span className="font-mono">{d.timeSpentSeconds}s</span></p>
    </div>
  );
}

/**
 * Honest per-question time view: one bar per question, height = real time spent,
 * colored by result. A dashed line marks the student's average pace; questions
 * above the slow line or below the rushed line are surfaced as counts.
 */
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
      {/* Pacing stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center shadow-xs">
          <p className="text-xl font-bold text-gray-900 flex items-center justify-center gap-1.5">
            <Clock size={16} className="text-gray-400" /> {avgTime}s
          </p>
          <p className="text-xs text-gray-500 mt-0.5">avg / question</p>
        </div>
        <div className="bg-red-50/50 border border-red-100 rounded-lg p-3 text-center shadow-xs">
          <p className="text-xl font-bold text-red-600 flex items-center justify-center gap-1.5">
            <AlertTriangle size={16} /> {slowCount}
          </p>
          <p className="text-xs text-red-500 mt-0.5">slow &ge; {SLOW_THRESHOLD}s</p>
        </div>
        <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3 text-center shadow-xs">
          <p className="text-xl font-bold text-amber-600 flex items-center justify-center gap-1.5">
            <Zap size={16} /> {rushedCount}
          </p>
          <p className="text-xs text-amber-500 mt-0.5">rushed &lt; {RUSHED_THRESHOLD}s</p>
        </div>
      </div>

      {/* Time-per-question bar chart */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
          <Clock size={24} className="mb-2 opacity-40" />
          <p className="text-sm font-medium text-gray-500">No timing data recorded</p>
          <p className="text-xs text-gray-400 mt-1">Complete a timed test to see time spent per question.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          {/* Legend */}
          <div className="flex justify-center items-center gap-4 mb-3 text-[11px] font-medium text-gray-500">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLOR.correct }} /> Correct</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLOR.incorrect }} /> Incorrect</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLOR.skipped }} /> Skipped</div>
            <div className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-blue-400" /> Avg ({avgTime}s)</div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sorted} margin={{ top: 5, right: 10, left: -18, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="questionIndex"
                tickFormatter={(v) => `${v}`}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                interval="preserveStartEnd"
                label={{ value: 'Question #', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94a3b8' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                unit="s"
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
              <ReferenceLine y={avgTime} stroke="#60a5fa" strokeDasharray="4 4" />
              <Bar dataKey="timeSpentSeconds" radius={[2, 2, 0, 0]} maxBarSize={26}>
                {sorted.map((q, i) => (
                  <Cell key={i} fill={STATUS_COLOR[q.status] || STATUS_COLOR.skipped} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
