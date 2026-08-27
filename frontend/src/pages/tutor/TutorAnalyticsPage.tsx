import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import {
  Loader2, Search, ChevronRight, ArrowLeft, Users, Target,
  Wrench, Layers,
  BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell,
} from 'recharts';
import { api, type DbUser } from '../../lib/api';
import {
  loadStudentAnalytics, aggregate, buildBreakdown, combinedSkillAccuracy, fmtTime, computeSatScore,
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
  navy:    '#1b3d6e',
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

// ── Student cumulative view ───────────────────────────────────────────────────
function StudentCumulative({ student, onBack }: { student: DbUser; onBack: () => void }) {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<LoadedAttempt[]>([]);
  const [records, setRecords] = useState<Map<string, QRecord[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState<Exclude<SubjectKey, 'other'>>('rw');
  const [dateRange, setDateRange] = useState<DateRangeState>(DEFAULT_DATE_RANGE);

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

  const { domainRows, skillRows } = useMemo(() => buildBreakdown(scoped, subject), [scoped, subject]);
  const combinedSkillRows = useMemo(() => combinedSkillAccuracy(scoped), [scoped]);
  const subjectLabel = subject === 'rw' ? 'Reading & Writing' : 'Math';

  // ── Analytics Overview header: KPI cards + date-range delta ──────────────
  const headerCurrent = useMemo(() => {
    const { start, end } = resolveDateRange(dateRange);
    return summarizeRange(nonDiagAttempts, records, start, end);
  }, [nonDiagAttempts, records, dateRange]);

  const headerPrevious = useMemo(() => {
    const { start, end } = resolveDateRange(dateRange);
    const prevRange = previousPeriodOf(start, end);
    if (!prevRange.start || !prevRange.end) return null;
    const prev = summarizeRange(nonDiagAttempts, records, prevRange.start, prevRange.end);
    return prev.testCount > 0 ? prev : null;
  }, [nonDiagAttempts, records, dateRange]);

  const attemptsForDownload = useMemo(() => {
    const { start, end } = resolveDateRange(dateRange);
    return attemptsInRange(nonDiagAttempts, start, end);
  }, [nonDiagAttempts, dateRange]);

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
    link.download = `${student.name.replace(/\s+/g, '_')}_Analytics_Report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
          <h1 className="text-xl font-bold text-gray-900">Analytics Overview</h1>
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
          <AnalyticsOverviewHeader
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            onDownload={handleDownload}
            downloadDisabled={attemptsForDownload.length === 0}
            current={headerCurrent}
            previous={headerPrevious}
            onIncorrectClick={() => navigate(`/student-mistakes?studentId=${student.id}`)}
            onDoubtsClick={() => navigate(`/student-doubts?studentId=${student.id}`)}
          />

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
            title="Domain-wise Analysis"
            subtitle={`${subjectLabel} · ${domainRows.length} content domain${domainRows.length !== 1 ? 's' : ''}`}
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

          {/* ── Score trend + strengths/weaknesses ───────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <ScoreAccuracyTrend attempts={nonDiagAttempts} records={records} />
            </div>
            <StrengthsAndWeaknesses skillRows={combinedSkillRows} />
          </div>

          <MotivationalBanner name={student.name} />
        </>
      )}
    </div>
  );
}

// ── Student picker ────────────────────────────────────────────────────────────
export function TutorAnalyticsPage() {
  const { dbId } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const studentIdParam = searchParams.get('studentId');

  const [students, setStudents] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DbUser | null>(null);

  useEffect(() => {
    if (!dbId) return;
    let cancelled = false;
    setLoading(true);
    api.getTutorAssignments({ tutorId: dbId })
      .then(r => { if (!cancelled) setStudents(r.assignments.map(a => a.student as DbUser)); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dbId]);

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
