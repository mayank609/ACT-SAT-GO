import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Target, XCircle, HelpCircle, ShieldCheck,
  Clock, CheckCircle2, Layers, Wrench, TrendingUp, BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell,
  PieChart, Pie,
  RadialBarChart, RadialBar,
} from 'recharts';
import { useAuthStore } from '../../store/useAuthStore';
import { SAT_CONTENT } from '../../data/satDomains';
import {
  loadStudentAnalytics, computeSatScore, aggregate, buildBreakdown, accuracy, fmtTime,
  type LoadedAttempt, type QRecord, type SubjectKey,
} from '../../lib/analyticsData';
import { BreakdownTable } from '../../components/analytics/BreakdownTable';

// ── Colour tokens ─────────────────────────────────────────────────────────────
const C = {
  blue:    '#3b82f6',
  indigo:  '#6366f1',
  emerald: '#10b981',
  amber:   '#f59e0b',
  rose:    '#f43f5e',
  slate:   '#94a3b8',
};
const DOMAIN_PALETTE = [C.blue, C.indigo, C.emerald, C.amber, C.rose, '#06b6d4', '#8b5cf6'];

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-xl text-xs">
      {label && <p className="text-gray-500 mb-1 font-medium">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-800 font-semibold">{p.name}: {p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Score Trend chart ─────────────────────────────────────────────────────────
function ScoreTrend({ attempts, records }: { attempts: LoadedAttempt[]; records: Map<string, QRecord[]> }) {
  const data = useMemo(() => attempts.slice().reverse().map(a => {
    const s = computeSatScore(records.get(a.id) ?? []);
    const label = a.title.length > 14 ? a.title.slice(0, 13) + '…' : a.title;
    return { name: label, Total: a.totalScore ?? s.total, RW: s.rw, Math: s.math };
  }), [attempts, records]);

  if (data.length < 2) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300">
      <TrendingUp size={22} />
      <p className="text-xs text-gray-400">Need ≥ 2 tests for trend</p>
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis domain={[200, 1600]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
        <Line type="monotone" dataKey="Total" stroke={C.blue} strokeWidth={2.5} dot={{ r: 3, fill: C.blue }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="RW" stroke={C.indigo} strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2 }} />
        <Line type="monotone" dataKey="Math" stroke={C.emerald} strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Domain accuracy bar chart ─────────────────────────────────────────────────
function DomainBars({ rows, subject }: { rows: Array<{ name: string; agg: { correct: number; total: number } }>; subject: string }) {
  const data = rows.map((r, i) => ({
    name: r.name.length > 20 ? r.name.slice(0, 18) + '…' : r.name,
    fullName: r.name,
    accuracy: r.agg.total > 0 ? Math.round((r.agg.correct / r.agg.total) * 100) : 0,
    correct: r.agg.correct, total: r.agg.total,
    color: DOMAIN_PALETTE[i % DOMAIN_PALETTE.length],
  })).filter(d => d.total > 0);

  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300">
      <BarChart2 size={22} />
      <p className="text-xs text-gray-400">No data yet</p>
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barSize={22}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0].payload;
          return (
            <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs shadow-xl">
              <p className="text-gray-700 font-semibold mb-0.5">{d.fullName}</p>
              <p className="text-gray-900">Accuracy: <strong>{d.accuracy}%</strong></p>
              <p className="text-gray-400">{d.correct}/{d.total} correct</p>
            </div>
          );
        }} />
        <Bar dataKey="accuracy" radius={[6, 6, 0, 0]} name="Accuracy">
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Question donut ────────────────────────────────────────────────────────────
function QuestionDonut({ correct, incorrect, skipped, doubts }: {
  correct: number; incorrect: number; skipped: number; doubts: number;
}) {
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

// ── Time radial ────────────────────────────────────────────────────────────────
function TimeRadial({ time, attempts }: { time: number; attempts: number }) {
  const avgPerTest = attempts > 0 ? Math.round(time / attempts) : 0;
  const pct = Math.min(100, Math.round((avgPerTest / 3600) * 100));
  return (
    <div className="flex items-center gap-4 h-full">
      <div className="flex-shrink-0">
        <ResponsiveContainer width={90} height={90}>
          <RadialBarChart cx={45} cy={45} innerRadius={28} outerRadius={42}
            data={[{ value: pct, fill: C.amber }]} startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#f8fafc' }} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900">{fmtTime(time)}</p>
        <p className="text-xs text-gray-400 mt-0.5">total across {attempts} test{attempts !== 1 ? 's' : ''}</p>
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-base font-bold text-amber-500">{fmtTime(avgPerTest)}</p>
          <p className="text-xs text-gray-400">avg per test</p>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AnalyticsPage() {
  const { dbId } = useAuthStore();
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState<LoadedAttempt[]>([]);
  const [records, setRecords] = useState<Map<string, QRecord[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<string>('latest');
  const [subject, setSubject] = useState<Exclude<SubjectKey, 'other'>>('rw');

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    let cancelled = false;
    loadStudentAnalytics(dbId)
      .then(({ attempts, records }) => {
        if (cancelled) return;
        setAttempts(attempts);
        setRecords(records);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dbId]);

  const activeAttemptId = scope === 'all'
    ? null
    : scope === 'latest'
      ? attempts[0]?.id ?? null
      : scope;

  const scoped = useMemo(() => {
    if (scope === 'all') return Array.from(records.values()).flat();
    return activeAttemptId ? records.get(activeAttemptId) ?? [] : [];
  }, [records, scope, activeAttemptId]);

  const scoreCard = useMemo(() => {
    const round10 = (x: number) => Math.round(x / 10) * 10;
    if (scope !== 'all' && activeAttemptId) {
      const s = computeSatScore(records.get(activeAttemptId) ?? []);
      const meta = attempts.find(a => a.id === activeAttemptId);
      const sub = meta
        ? `${meta.title}${meta.completedAt ? ` · ${new Date(meta.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}`
        : '';
      return { label: 'Total Score', total: meta?.totalScore ?? s.total, rw: s.rw, math: s.math, sub };
    }
    const per = attempts.map(a => computeSatScore(records.get(a.id) ?? []));
    if (per.length === 0) return { label: 'Avg Score', total: 0, rw: 0, math: 0, sub: '' };
    const rw = round10(per.reduce((s, p) => s + p.rw, 0) / per.length);
    const math = round10(per.reduce((s, p) => s + p.math, 0) / per.length);
    const totals = attempts.map(a => a.totalScore).filter((t): t is number => t != null);
    const total = totals.length ? round10(totals.reduce((s, t) => s + t, 0) / totals.length) : rw + math;
    return { label: 'Avg Score', total, rw, math, sub: `Average across ${per.length} test${per.length !== 1 ? 's' : ''}` };
  }, [scope, activeAttemptId, records, attempts]);

  const summary = useMemo(() => aggregate(scoped), [scoped]);
  const { domainRows, skillRows } = useMemo(() => buildBreakdown(scoped, subject), [scoped, subject]);
  const acc = accuracy(summary);
  const subjectLabel = subject === 'rw' ? 'Reading & Writing' : 'Math';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={22} className="animate-spin text-[#1b3d6e]" />
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Target size={24} className="text-blue-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">No tests completed yet</h2>
        <p className="text-gray-500 text-sm mb-6">Finish a test to unlock your score &amp; analytics.</p>
        <button
          onClick={() => navigate('/my-tests')}
          className="px-5 py-2.5 bg-[#1b3d6e] text-white rounded-xl text-sm font-semibold hover:bg-[#15305a] transition-colors shadow-sm"
        >
          Go to My Tests
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ── Header + scope ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Score, performance &amp; domain breakdown</p>
        </div>
        <select
          value={scope}
          onChange={e => setScope(e.target.value)}
          className="ml-auto px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1b3d6e] min-w-[220px] shadow-sm"
        >
          <option value="latest">Latest Test</option>
          <option value="all">All Tests ({attempts.length})</option>
          <optgroup label="Specific test">
            {attempts.map(a => (
              <option key={a.id} value={a.id}>
                {a.title}{a.completedAt ? ` — ${new Date(a.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* ── Score hero card ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#1b3d6e] to-[#1e4d8c] rounded-2xl px-6 py-5 shadow-lg shadow-blue-200/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-blue-300 text-[11px] font-bold uppercase tracking-widest mb-1">{scoreCard.label}</p>
            <p className="text-6xl font-black text-white tracking-tight tabular-nums">{scoreCard.total}</p>
            {scoreCard.sub && <p className="text-blue-200/70 text-xs mt-1.5">{scoreCard.sub}</p>}
          </div>
          <div className="flex items-center gap-6 sm:gap-10 flex-wrap">
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-blue-300/70 mb-0.5">R&amp;W</p>
              <p className="text-3xl font-black text-white tabular-nums">{scoreCard.rw}</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-blue-300/70 mb-0.5">Math</p>
              <p className="text-3xl font-black text-white tabular-nums">{scoreCard.math}</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-blue-300/70 mb-0.5">Accuracy</p>
              <p className={`text-3xl font-black tabular-nums ${acc >= 80 ? 'text-emerald-300' : acc >= 60 ? 'text-amber-300' : 'text-rose-300'}`}>{acc}%</p>
            </div>
          </div>
        </div>
        {/* Quick stats strip */}
        <div className="relative mt-5 pt-4 border-t border-white/10 grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { icon: <Target size={12} />, label: 'Total', value: summary.total, color: 'text-blue-200' },
            { icon: <CheckCircle2 size={12} />, label: 'Correct', value: summary.correct, color: 'text-emerald-300' },
            { icon: <XCircle size={12} />, label: 'Incorrect', value: summary.incorrect, color: 'text-rose-300' },
            { icon: <HelpCircle size={12} />, label: 'Doubts', value: summary.doubts, color: 'text-amber-300' },
            { icon: <ShieldCheck size={12} />, label: 'Cleared', value: summary.cleared, color: 'text-sky-300' },
            { icon: <Clock size={12} />, label: 'Time', value: fmtTime(summary.time), color: 'text-purple-300' },
          ].map(m => (
            <div key={m.label} className="text-center">
              <div className="flex items-center justify-center gap-1 text-blue-300/50 mb-0.5">{m.icon}</div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-blue-300/50">{m.label}</p>
              <p className={`text-lg font-black tabular-nums ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 bg-white border border-gray-100 rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-blue-500" />
            <span className="text-sm font-bold text-gray-800">Score Trend</span>
            <span className="text-xs text-gray-400 ml-1">across {attempts.length} tests</span>
          </div>
          <div style={{ height: 200 }}>
            <ScoreTrend attempts={attempts} records={records} />
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={15} className="text-indigo-500" />
            <span className="text-sm font-bold text-gray-800">Question Breakdown</span>
          </div>
          <div style={{ height: 200 }}>
            <QuestionDonut
              correct={summary.correct}
              incorrect={summary.incorrect}
              skipped={summary.skipped}
              doubts={summary.doubts}
            />
          </div>
        </div>
      </div>

      {/* ── Subject toggle ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-gray-500 font-medium">Breakdown for:</span>
        {([['rw', 'Reading & Writing'], ['math', 'Math']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubject(key)}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
              subject === key
                ? 'bg-[#1b3d6e] text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Domain bars + time radial ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 bg-white border border-gray-100 rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={15} className="text-emerald-500" />
            <span className="text-sm font-bold text-gray-800">Domain Accuracy</span>
            <span className="text-xs text-gray-400 ml-1">· {subjectLabel}</span>
          </div>
          <div style={{ height: 180 }}>
            <DomainBars rows={domainRows} subject={subject} />
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-amber-500" />
            <span className="text-sm font-bold text-gray-800">Time Spent</span>
          </div>
          <div style={{ height: 180 }}>
            <TimeRadial time={summary.time} attempts={attempts.length} />
          </div>
        </div>
      </div>

      {/* ── Breakdown tables ─────────────────────────────────────────────── */}
      <BreakdownTable
        title="Domain-wise Analysis"
        subtitle={`${subjectLabel} · ${SAT_CONTENT[subject === 'math' ? 'Math' : 'Reading and Writing'].length} content domains`}
        icon={<Layers size={15} />}
        firstColLabel="Domain"
        rows={domainRows}
      />
      <BreakdownTable
        title="Skill Analysis"
        subtitle={`${subjectLabel} · subdomains, weakest first`}
        icon={<Wrench size={15} />}
        firstColLabel="Skill"
        rows={skillRows}
      />
    </div>
  );
}
