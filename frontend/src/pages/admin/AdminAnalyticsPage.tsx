import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Loader2, Search, ChevronRight, ArrowLeft, Users, Target,
  Clock, Wrench,
  TrendingUp, BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell,
  PieChart, Pie,
} from 'recharts';
import { api, type DbUser } from '../../lib/api';
import {
  loadStudentAnalytics, aggregate, buildBreakdown, accuracy, fmtTime, computeSatScore,
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
  navy:    '#1b3d6e',
};
const DOMAIN_PALETTE = [C.blue, C.indigo, C.emerald, C.amber, C.rose, '#06b6d4', '#8b5cf6'];

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-xl text-xs">
      {label && <p className="text-gray-500 mb-1 font-medium">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-800 font-semibold">{p.name}: {p.value}{typeof p.value === 'number' && p.name === 'Accuracy' ? '%' : ''}</span>
        </div>
      ))}
    </div>
  );
}

// ── Score Trend mini-chart ─────────────────────────────────────────────────────
function ScoreTrend({ attempts, records }: { attempts: LoadedAttempt[]; records: Map<string, QRecord[]> }) {
  const data = useMemo(() => attempts.slice().reverse().map(a => {
    const s = computeSatScore(records.get(a.id) ?? []);
    const label = a.title.length > 14 ? a.title.slice(0, 13) + '…' : a.title;
    return { name: label, Total: a.totalScore ?? s.total, RW: s.rw, Math: s.math };
  }), [attempts, records]);

  if (data.length < 2) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
      <TrendingUp size={20} />
      <p className="text-xs">Need ≥ 2 tests for trend</p>
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
function DomainBars({ rows }: { rows: Array<{ name: string; agg: { correct: number; total: number } }> }) {
  const data = rows.map((r, i) => ({
    name: r.name.length > 20 ? r.name.slice(0, 18) + '…' : r.name,
    fullName: r.name,
    accuracy: r.agg.total > 0 ? Math.round((r.agg.correct / r.agg.total) * 100) : 0,
    correct: r.agg.correct, total: r.agg.total,
    color: DOMAIN_PALETTE[i % DOMAIN_PALETTE.length],
  })).filter(d => d.total > 0);

  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
      <BarChart2 size={20} />
      <p className="text-xs">No data yet</p>
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

// ── Donut breakdown ───────────────────────────────────────────────────────────
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

// ── Student cumulative view ───────────────────────────────────────────────────
function StudentCumulative({ student, onBack }: { student: DbUser; onBack: () => void }) {
  const [attempts, setAttempts] = useState<LoadedAttempt[]>([]);
  const [records, setRecords] = useState<Map<string, QRecord[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState<Exclude<SubjectKey, 'other'>>('rw');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadStudentAnalytics(student.id)
      .then(({ attempts, records }) => {
        if (cancelled) return;
        setAttempts(attempts);
        setRecords(records);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [student.id]);

  const nonDiagAttempts = useMemo(() => attempts.filter(a => !a.isDiagnostic), [attempts]);
  const scoped = useMemo(() => {
    const ids = new Set(nonDiagAttempts.map(a => a.id));
    const recs: QRecord[] = [];
    for (const [id, r] of records) if (ids.has(id)) recs.push(...r);
    return recs;
  }, [records, nonDiagAttempts]);

  const summary = useMemo(() => aggregate(scoped), [scoped]);
  const { domainRows, skillRows } = useMemo(() => buildBreakdown(scoped, subject), [scoped, subject]);
  const acc = accuracy(summary);
  const avgTimePerTest = nonDiagAttempts.length > 0 ? Math.round(summary.time / nonDiagAttempts.length) : 0;

  const subjectLabel = subject === 'rw' ? 'Reading & Writing' : 'Math';

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Back to students"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-400 text-sm">{student.name}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
            {nonDiagAttempts.length} test{nonDiagAttempts.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={22} className="animate-spin text-[#1b3d6e]" />
        </div>
      ) : nonDiagAttempts.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl py-16 text-center shadow-sm">
          <Target size={24} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No non-diagnostic tests attempted yet</p>
          <p className="text-gray-400 text-sm mt-1">
            {attempts.length > 0 ? 'This student has only taken diagnostic tests.' : 'This student has not completed any tests.'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Hero: Total time + key metrics + question breakdown ─────── */}
          <div className="bg-gradient-to-br from-[#16325c] via-[#1e4d8c] to-[#2563eb] rounded-2xl p-5 sm:p-6 shadow-lg shadow-blue-200/40 relative overflow-hidden">
            <div className="absolute -top-16 -right-12 w-72 h-72 bg-white/5 rounded-full pointer-events-none" />
            <div className="absolute -bottom-20 left-1/4 w-56 h-56 bg-white/[0.04] rounded-full pointer-events-none" />
            <div className="relative flex flex-col lg:flex-row lg:items-stretch gap-5">
              {/* Left: total time + metric chips */}
              <div className="flex-1 min-w-0 flex flex-col justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0">
                    <Clock size={26} className="text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-blue-200/80 text-[11px] font-bold uppercase tracking-widest mb-0.5">Total Time Spent</p>
                    <p className="text-4xl sm:text-5xl font-black text-white tracking-tight tabular-nums leading-none">{fmtTime(summary.time)}</p>
                    <p className="text-blue-200 text-xs mt-1.5">
                      across <span className="text-white font-bold">{nonDiagAttempts.length}</span> test{nonDiagAttempts.length !== 1 ? 's' : ''}
                      {nonDiagAttempts.length > 0 && <> &nbsp;·&nbsp; avg <span className="text-white font-bold">{fmtTime(avgTimePerTest)}</span> / test</>}
                    </p>
                  </div>
                </div>
                {/* Metric chips */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { label: 'Total Qs', value: summary.total, color: 'text-blue-100' },
                    { label: 'Correct', value: summary.correct, color: 'text-emerald-300' },
                    { label: 'Mistakes', value: summary.incorrect, color: 'text-rose-300' },
                    { label: 'Doubts', value: summary.doubts, color: 'text-amber-300' },
                    { label: 'Accuracy', value: `${acc}%`, color: acc >= 80 ? 'text-emerald-300' : acc >= 60 ? 'text-amber-300' : 'text-rose-300' },
                  ].map(m => (
                    <div key={m.label} className="bg-white/10 ring-1 ring-white/10 rounded-xl px-3 py-2 text-center">
                      <p className="text-[9px] uppercase tracking-widest font-semibold text-blue-200/70">{m.label}</p>
                      <p className={`text-xl font-black tabular-nums ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: question breakdown panel (moved into hero) */}
              <div className="lg:w-80 flex-shrink-0 bg-white rounded-xl p-4 shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <Target size={15} className="text-indigo-500" />
                  <span className="text-sm font-bold text-gray-800">Question Breakdown</span>
                </div>
                <div style={{ height: 150 }}>
                  <QuestionDonut
                    correct={summary.correct}
                    incorrect={summary.incorrect}
                    skipped={summary.skipped}
                    doubts={summary.doubts}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Subject toggle ───────────────────────────────────────────── */}
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

          {/* ── Breakdown tables (above the graphs) ──────────────────────── */}
          <BreakdownTable
            title="Skill Analysis"
            icon={<Wrench size={15} />}
            firstColLabel="Skill"
            rows={skillRows}
          />

          {/* ── Graphs (kept at the bottom) ──────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-blue-100/40 flex items-center gap-2.5">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-[#1b3d6e]"><BarChart2 size={15} /></span>
              <div>
                <h3 className="text-sm font-bold text-blue-900">Domain Accuracy</h3>
                <p className="text-xs text-blue-500/80 mt-0.5">{subjectLabel}</p>
              </div>
            </div>
            <div className="p-4">
              <div style={{ height: 180 }}>
                <DomainBars rows={domainRows} />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-blue-100/40 flex items-center gap-2.5">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-[#1b3d6e]"><TrendingUp size={15} /></span>
              <div>
                <h3 className="text-sm font-bold text-blue-900">Score Trend</h3>
                <p className="text-xs text-blue-500/80 mt-0.5">all {nonDiagAttempts.length} tests</p>
              </div>
            </div>
            <div className="p-4">
              <div style={{ height: 200 }}>
                <ScoreTrend attempts={nonDiagAttempts} records={records} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Student picker ────────────────────────────────────────────────────────────
export function AdminAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const studentIdParam = searchParams.get('studentId');

  const [students, setStudents] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DbUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getUsersByRole('STUDENT')
      .then(r => { if (!cancelled) setStudents(r.users ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (students.length > 0) {
      if (studentIdParam) {
        const found = students.find(s => s.id === studentIdParam);
        setSelected(found ?? null);
      } else {
        setSelected(null);
      }
    }
  }, [studentIdParam, students]);

  if (selected) {
    return <StudentCumulative student={selected} onBack={() => setSearchParams({})} />;
  }

  const filtered = students.filter(s => {
    const q = search.trim().toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Student Analytics</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Pick a student to see their cumulative performance &amp; charts (diagnostics excluded).
        </p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1b3d6e] shadow-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={22} className="animate-spin text-[#1b3d6e]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl py-16 text-center shadow-sm">
          <Users size={24} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {students.length === 0 ? 'No students found' : 'No students match your search'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden shadow-sm">
          {filtered.map(s => (
            <button
              key={s.id}
              onClick={() => setSearchParams({ studentId: s.id })}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-blue-50/50 transition-colors group"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {s.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-blue-700">{s.name}</p>
              </div>
              {typeof s.testsAttempted === 'number' && (
                <span className="text-xs text-gray-400 flex-shrink-0 bg-gray-100 px-2 py-0.5 rounded-full">
                  {s.testsAttempted} test{s.testsAttempted !== 1 ? 's' : ''}
                </span>
              )}
              <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 flex-shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
