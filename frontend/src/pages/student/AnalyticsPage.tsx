import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Target, XCircle, HelpCircle, ShieldCheck, Clock, CheckCircle2, Layers, Wrench,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { SAT_CONTENT } from '../../data/satDomains';
import {
  loadStudentAnalytics, computeSatScore, aggregate, buildBreakdown, accuracy, fmtTime,
  type LoadedAttempt, type QRecord, type SubjectKey,
} from '../../lib/analyticsData';
import { BreakdownTable } from '../../components/analytics/BreakdownTable';

export function AnalyticsPage() {
  const { dbId } = useAuthStore();
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState<LoadedAttempt[]>([]);
  const [records, setRecords] = useState<Map<string, QRecord[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<string>('latest'); // 'all', 'latest', or an attempt id
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

  // The single attempt the score header refers to (latest, or an explicit pick).
  const activeAttemptId = scope === 'all'
    ? null
    : scope === 'latest'
      ? attempts[0]?.id ?? null
      : scope;

  const scoped = useMemo(() => {
    if (scope === 'all') return Array.from(records.values()).flat();
    return activeAttemptId ? records.get(activeAttemptId) ?? [] : [];
  }, [records, scope, activeAttemptId]);

  // Score card — scaled SAT score (a single attempt) or the average across tests.
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-[#1b3d6e]" />
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Target size={24} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">No tests completed yet</h2>
        <p className="text-gray-500 text-sm mb-6">Finish a test to unlock your score &amp; analytics.</p>
        <button
          onClick={() => navigate('/my-tests')}
          className="px-5 py-2.5 bg-[#1b3d6e] text-white rounded-lg text-sm font-medium hover:bg-[#15305a] transition-colors"
        >
          Go to My Tests
        </button>
      </div>
    );
  }

  const acc = accuracy(summary);
  const metrics = [
    { label: 'Correct / Total', value: `${summary.correct}/${summary.total}`, cls: 'text-gray-900', icon: <Target size={14} className="text-gray-400" /> },
    { label: 'Mistakes', value: summary.incorrect, cls: 'text-red-600', icon: <XCircle size={14} className="text-red-400" /> },
    { label: 'Doubts', value: summary.doubts, cls: 'text-amber-600', icon: <HelpCircle size={14} className="text-amber-400" /> },
    { label: 'Cleared', value: summary.cleared, cls: 'text-emerald-600', icon: <ShieldCheck size={14} className="text-emerald-400" /> },
    { label: 'Total Time Spent', value: fmtTime(summary.time), cls: 'text-gray-900', icon: <Clock size={14} className="text-gray-400" /> },
    { label: 'Accuracy', value: `${acc}%`, cls: acc >= 80 ? 'text-emerald-600' : acc >= 60 ? 'text-amber-600' : 'text-red-600', icon: <CheckCircle2 size={14} className="text-gray-400" /> },
  ];

  const subjectLabel = subject === 'rw' ? 'Reading & Writing' : 'Math';

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ── Header + scope ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Score, overall summary &amp; domain breakdown</p>
        </div>
        <select
          value={scope}
          onChange={e => setScope(e.target.value)}
          className="ml-auto px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1b3d6e] min-w-[220px]"
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

      {/* ── Total score (RW | Math | Accuracy) ─────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-5 sm:px-7 py-5">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-[11px] font-bold uppercase tracking-widest leading-tight w-16">{scoreCard.label}</span>
            <span className="text-5xl sm:text-6xl font-black text-[#0f1e3d] tracking-tight tabular-nums">{scoreCard.total}</span>
          </div>
          <div className="flex items-center gap-6 sm:gap-8 pr-1">
            <div className="flex items-baseline gap-2">
              <span className="text-blue-600 font-semibold text-base sm:text-lg">RW</span>
              <span className="text-2xl sm:text-3xl font-black text-gray-900 tabular-nums">{scoreCard.rw}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-blue-600 font-semibold text-base sm:text-lg">Math</span>
              <span className="text-2xl sm:text-3xl font-black text-gray-900 tabular-nums">{scoreCard.math}</span>
            </div>
            <div className="flex items-baseline gap-2 pl-5 sm:pl-7 border-l border-gray-100">
              <span className="text-gray-400 font-semibold text-base sm:text-lg">Accuracy</span>
              <span className={`text-2xl sm:text-3xl font-black tabular-nums ${acc >= 80 ? 'text-emerald-600' : acc >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{acc}%</span>
            </div>
          </div>
        </div>
        {scoreCard.sub && <p className="text-xs text-gray-400 mt-3 border-t border-gray-50 pt-2.5">{scoreCard.sub}</p>}
      </div>

      {/* ── Overall summary strip ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map(m => (
          <div key={m.label} className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1">{m.icon}{m.label}</p>
            <p className={`text-2xl font-bold mt-1 ${m.cls}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* ── Subject toggle ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-1">
        <span className="text-xs text-gray-500 font-medium">Breakdown for:</span>
        {([['rw', 'Reading & Writing'], ['math', 'Math']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubject(key)}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors ${
              subject === key ? 'bg-[#1b3d6e] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Domain-wise analysis ───────────────────────────────────────── */}
      <BreakdownTable
        title="Domain-wise Analysis"
        subtitle={`${subjectLabel} · ${SAT_CONTENT[subject === 'math' ? 'Math' : 'Reading and Writing'].length} content domains`}
        icon={<Layers size={15} />}
        firstColLabel="Domain"
        rows={domainRows}
      />

      {/* ── Skill analysis ─────────────────────────────────────────────── */}
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
