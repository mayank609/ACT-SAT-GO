import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Target, Clock, Layers, Wrench, BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell,
  RadialBarChart, RadialBar,
} from 'recharts';
import { useAuthStore } from '../../store/useAuthStore';
import { SAT_CONTENT } from '../../data/satDomains';
import {
  loadStudentAnalytics, computeSatScore, aggregate, buildBreakdown, combinedSkillAccuracy, fmtTime,
  attemptsInRange, summarizeRange, previousPeriodOf,
  type LoadedAttempt, type QRecord, type SubjectKey,
} from '../../lib/analyticsData';
import { formatDate } from '../../lib/utils';
import { BreakdownTable } from '../../components/analytics/BreakdownTable';
import {
  AnalyticsOverviewHeader, resolveDateRange, DEFAULT_DATE_RANGE, type DateRangeState,
} from '../../components/analytics/AnalyticsOverviewHeader';
import {
  ScoreAccuracyTrend, StrengthsAndWeaknesses, MotivationalBanner,
} from '../../components/analytics/ScoreTrendInsights';

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

// ── Domain accuracy bar chart ─────────────────────────────────────────────────
function DomainBars({ rows }: { rows: Array<{ name: string; agg: { correct: number; total: number } }> }) {
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
  const { dbId, user } = useAuthStore();
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState<LoadedAttempt[]>([]);
  const [records, setRecords] = useState<Map<string, QRecord[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<string>('all');
  const [subject, setSubject] = useState<Exclude<SubjectKey, 'other'>>('rw');
  const [dateRange, setDateRange] = useState<DateRangeState>(DEFAULT_DATE_RANGE);

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
        ? `${meta.title}${meta.completedAt ? ` · ${formatDate(meta.completedAt)}` : ''}`
        : '';
      return { label: 'Total Score', total: meta?.totalScore ?? s.total, rw: s.rw, math: s.math, sub };
    }
    // Practice Sheet/HW attempts are raw "X correct" counts, not scaled scores — averaging
    // them in with Mock/Sectional scores would be meaningless (e.g. a "17" HW result
    // dragging down a 1400 average).
    const scaledAttempts = attempts.filter(a => a.scoreMode !== 'raw');
    const per = scaledAttempts.map(a => computeSatScore(records.get(a.id) ?? []));
    if (per.length === 0) return { label: 'Avg Score', total: 0, rw: 0, math: 0, sub: '' };
    const rw = round10(per.reduce((s, p) => s + p.rw, 0) / per.length);
    const math = round10(per.reduce((s, p) => s + p.math, 0) / per.length);
    const totals = scaledAttempts.map(a => a.totalScore).filter((t): t is number => t != null);
    const total = totals.length ? round10(totals.reduce((s, t) => s + t, 0) / totals.length) : rw + math;
    return { label: 'Avg Score', total, rw, math, sub: `Average across ${per.length} test${per.length !== 1 ? 's' : ''}` };
  }, [scope, activeAttemptId, records, attempts]);

  const summary = useMemo(() => aggregate(scoped), [scoped]);
  const { domainRows, skillRows } = useMemo(() => buildBreakdown(scoped, subject), [scoped, subject]);
  const combinedSkillRows = useMemo(() => combinedSkillAccuracy(scoped), [scoped]);
  const subjectLabel = subject === 'rw' ? 'Reading & Writing' : 'Math';

  // ── Analytics Overview header: KPI cards + date-range delta ──────────────
  // Date-range filtering (and the "vs previous period" deltas) only makes sense
  // when aggregating across all tests — a single-test snapshot has no window to slice.
  const dateRangeApplicable = scope === 'all';

  const headerCurrent = useMemo(() => {
    if (!dateRangeApplicable) return { agg: summary, avgScore: scoreCard.total || null, testCount: attempts.length ? 1 : 0 };
    const { start, end } = resolveDateRange(dateRange);
    return summarizeRange(attempts, records, start, end);
  }, [dateRangeApplicable, summary, scoreCard, attempts, records, dateRange]);

  const headerPrevious = useMemo(() => {
    if (!dateRangeApplicable) return null;
    const { start, end } = resolveDateRange(dateRange);
    const prevRange = previousPeriodOf(start, end);
    if (!prevRange.start || !prevRange.end) return null;
    const prev = summarizeRange(attempts, records, prevRange.start, prevRange.end);
    return prev.testCount > 0 ? prev : null;
  }, [dateRangeApplicable, attempts, records, dateRange]);

  const attemptsForDownload = useMemo(() => {
    if (dateRangeApplicable) {
      const { start, end } = resolveDateRange(dateRange);
      return attemptsInRange(attempts, start, end);
    }
    return activeAttemptId ? attempts.filter(a => a.id === activeAttemptId) : attempts;
  }, [dateRangeApplicable, attempts, dateRange, activeAttemptId]);

  const handleDownload = () => {
    if (attemptsForDownload.length === 0) return;
    const header = ['Test', 'Completed', 'Score', 'Correct', 'Incorrect', 'Skipped', 'Doubts', 'Time Spent'];
    const rows = attemptsForDownload.map(a => {
      const recs = records.get(a.id) ?? [];
      const rowAgg = aggregate(recs);
      return [
        a.title,
        a.completedAt ? formatDate(a.completedAt) : '',
        a.totalScore ?? computeSatScore(recs).total,
        rowAgg.correct, rowAgg.incorrect, rowAgg.skipped, rowAgg.doubts, fmtTime(rowAgg.time),
      ];
    });
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Analytics_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
          Go to My Assignments
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <AnalyticsOverviewHeader
        title="Analytics Overview"
        subtitle="Track your performance and focus on what matters most."
        scopeControl={
          <select
            value={scope}
            onChange={e => setScope(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1b3d6e] min-w-[160px] shadow-sm"
          >
            <option value="latest">Latest Test</option>
            <option value="all">All Tests ({attempts.length})</option>
            <optgroup label="Specific test">
              {attempts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.title}{a.completedAt ? ` — ${formatDate(a.completedAt)}` : ''}
                </option>
              ))}
            </optgroup>
          </select>
        }
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        dateRangeDisabled={!dateRangeApplicable}
        onDownload={handleDownload}
        downloadDisabled={attemptsForDownload.length === 0}
        current={headerCurrent}
        previous={headerPrevious}
      />

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
            <DomainBars rows={domainRows} />
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
        title="Subdomain Analysis"
        icon={<Wrench size={15} />}
        firstColLabel="Subdomain"
        rows={skillRows}
      />

      {/* ── Score trend + strengths/weaknesses ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2">
          <ScoreAccuracyTrend attempts={attempts} records={records} />
        </div>
        <StrengthsAndWeaknesses skillRows={combinedSkillRows} />
      </div>

      <MotivationalBanner name={user?.name} />
    </div>
  );
}
