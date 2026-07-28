import { useMemo, useState } from 'react';
import { ChevronDown, CheckCircle2, AlertCircle, Trophy, Target, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  computeSatScore, aggregate, accuracy as accuracyOf,
  type LoadedAttempt, type QRecord, type Agg,
} from '../../lib/analyticsData';

const BLUE = '#1b3d6e';
const SKY = '#7dd3fc';

// ── Score + Accuracy trend ──────────────────────────────────────────────────
type TrendWindow = '5' | '10' | '20' | 'all';

function EndDot(props: any) {
  const { cx, cy, index, totalLen, color, textColor, formatter, value } = props;
  if (cx == null || cy == null) return null;
  if (index !== totalLen - 1) return <circle cx={cx} cy={cy} r={3} fill={color} />;
  const label = formatter(value);
  const w = Math.max(34, label.length * 8 + 16);
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />
      <rect x={cx + 8} y={cy - 11} width={w} height={22} rx={7} fill={color} />
      <text x={cx + 8 + w / 2} y={cy + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={textColor}>{label}</text>
    </g>
  );
}

function TrendTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-xl text-xs">
      <p className="text-gray-500 mb-1 font-medium">{p.title}{p.date ? ` · ${new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: BLUE }} />
        <span className="text-gray-800 font-semibold">Score: {p.score}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SKY }} />
        <span className="text-gray-800 font-semibold">Accuracy: {p.accuracy}%</span>
      </div>
    </div>
  );
}

export function ScoreAccuracyTrend({ attempts, records }: { attempts: LoadedAttempt[]; records: Map<string, QRecord[]> }) {
  const [win, setWin] = useState<TrendWindow>('10');

  const data = useMemo(() => {
    // Practice Sheet/HW attempts are raw "X correct" counts, not scaled scores — plotting
    // them on this chart's fixed 200-1600 axis alongside Mock/Sectional scores would read
    // as a score crash rather than the different-unit value it actually is.
    const scaledAttempts = attempts.filter(a => a.scoreMode !== 'raw');
    const chronological = scaledAttempts.slice().reverse();
    const n = win === 'all' ? chronological.length : Math.min(Number(win), chronological.length);
    const windowed = chronological.slice(chronological.length - n);
    return windowed.map((a, i) => {
      const recs = records.get(a.id) ?? [];
      const s = computeSatScore(recs);
      const agg = aggregate(recs);
      return {
        label: `Test ${i + 1}`,
        title: a.title,
        date: a.completedAt,
        score: a.totalScore ?? s.total,
        accuracy: accuracyOf(agg),
      };
    });
  }, [attempts, records, win]);

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={15} className="text-blue-500" />
        <span className="text-sm font-bold text-gray-800">Score Trend</span>
        <div className="relative ml-auto">
          <select
            value={win}
            onChange={e => setWin(e.target.value as TrendWindow)}
            className="appearance-none pl-3 pr-7 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-[#1b3d6e]"
          >
            <option value="5">Last 5 Tests</option>
            <option value="10">Last 10 Tests</option>
            <option value="20">Last 20 Tests</option>
            <option value="all">All Tests</option>
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>
      <div className="flex-1" style={{ minHeight: 220 }}>
        {data.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300">
            <TrendingUp size={22} />
            <p className="text-xs text-gray-400">Need &ge; 2 tests for trend</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 60, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="score" domain={[200, 1600]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="accuracy" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TrendTip />} />
              <Legend
                formatter={(value: string) => <span className="text-xs text-gray-500">{value}</span>}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Line
                yAxisId="score" type="monotone" dataKey="score" name="Average Score"
                stroke={BLUE} strokeWidth={2.5}
                dot={(p: any) => <EndDot {...p} totalLen={data.length} color={BLUE} textColor="#fff" formatter={(v: number) => `${v}`} />}
                activeDot={{ r: 5 }}
              />
              <Line
                yAxisId="accuracy" type="monotone" dataKey="accuracy" name="Average Accuracy"
                stroke={SKY} strokeWidth={2.5}
                dot={(p: any) => <EndDot {...p} totalLen={data.length} color={SKY} textColor={BLUE} formatter={(v: number) => `${v}%`} />}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Strongest / Needs Practice cards ────────────────────────────────────────
const STRONG_BLURBS = ["You're performing great!", 'Keep up the good work!', 'Strong understanding!'];
const WEAK_BLURBS = ['Focus more on this area', 'Practice regularly', 'Strengthen your concepts'];
const MIN_QUESTIONS = 3;

function InsightCard({ tone, title, items }: { tone: 'strong' | 'weak'; title: string; items: Array<{ name: string; agg: Agg }> }) {
  const blurbs = tone === 'strong' ? STRONG_BLURBS : WEAK_BLURBS;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 h-full relative overflow-hidden">
      <h3 className={`text-sm font-bold mb-3 ${tone === 'strong' ? 'text-emerald-700' : 'text-rose-700'}`}>{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 relative z-10">Not enough data yet.</p>
      ) : (
        <div className="space-y-3 relative z-10">
          {items.map((it, i) => (
            <div key={it.name} className="flex items-start gap-2">
              {tone === 'strong'
                ? <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                : <AlertCircle size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />}
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-800 truncate">{it.name}</p>
                <p className="text-[11px] text-gray-400">{blurbs[i % blurbs.length]}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="absolute -bottom-3 -right-3 pointer-events-none">
        {tone === 'strong'
          ? <Trophy size={64} className="text-amber-200" />
          : <Target size={64} className="text-rose-100" />}
      </div>
    </div>
  );
}

export function StrengthsAndWeaknesses({ skillRows }: { skillRows: Array<{ name: string; agg: Agg }> }) {
  const sorted = useMemo(() => {
    return skillRows
      .filter(r => r.agg.total >= MIN_QUESTIONS)
      .slice()
      .sort((a, b) => accuracyOf(b.agg) - accuracyOf(a.agg));
  }, [skillRows]);

  const strongest = sorted.slice(0, 3);
  const needsPractice = sorted.slice(-3).reverse().filter(r => !strongest.includes(r));

  return (
    <>
      <InsightCard tone="strong" title="Strongest Areas" items={strongest} />
      <InsightCard tone="weak" title="Needs Practice" items={needsPractice} />
    </>
  );
}

// ── Motivational banner ─────────────────────────────────────────────────────
export function MotivationalBanner({ name }: { name?: string | null }) {
  const firstName = name?.trim().split(/\s+/)[0];
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3.5 text-center text-sm text-blue-900 font-medium">
      🚀 Keep going{firstName ? `, ${firstName}` : ''}! Consistent practice today leads to a high score tomorrow.
    </div>
  );
}
