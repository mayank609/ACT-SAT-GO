import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import type { DbUser } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Minus, TrendingUp, FileSearch, AlertTriangle, Target, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { QuestionTimeChart, type QuestionTimeStat } from '../../components/dashboard/QuestionTimeChart';
import { SearchableSelect } from '../../components/common/SearchableSelect';

// ─── Types ────────────────────────────────────────────────────────────────────

type QStat = QuestionTimeStat;

type Analytics = {
  trend: Array<{ date: string; score: number; testTitle: string; attemptId: string }>;
  sectionStats: Array<{ sectionId: string; sectionName: string; totalQuestions: number; correct: number; incorrect: number; skipped: number; accuracy: number; timeAllocated: number; timeUsed: number }>;
  questionPacingStats?: QStat[];
  overallAccuracy: number;
  totalAttempts: number;
  latestScore: number;
  avgScore: number;
};

type Attempt = {
  id: string;
  status: string;
  totalScore: number | null;
  startedAt: string;
  completedAt: string | null;
  test: { id: string; title: string; sections: Array<{ _count: { questions: number } }> };
};

type TopicRow = {
  section: string;
  topic: string;
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
  accuracy: number;
  avgTime: number;
};

function buildTopicTable(qs: QStat[]): TopicRow[] {
  const map = new Map<string, { section: string; topic: string; correct: number; incorrect: number; skipped: number; times: number[] }>();
  for (const q of qs) {
    const key = `${q.sectionName}|||${q.topicName || 'Unknown'}`;
    if (!map.has(key)) map.set(key, { section: q.sectionName, topic: q.topicName || 'Unknown', correct: 0, incorrect: 0, skipped: 0, times: [] });
    const row = map.get(key)!;
    if (q.status === 'correct') row.correct++;
    else if (q.status === 'incorrect') row.incorrect++;
    else row.skipped++;
    row.times.push(q.timeSpentSeconds);
  }
  return Array.from(map.values()).map(r => {
    const total = r.correct + r.incorrect + r.skipped;
    return {
      section: r.section,
      topic: r.topic,
      total,
      correct: r.correct,
      incorrect: r.incorrect,
      skipped: r.skipped,
      accuracy: total > 0 ? Math.round((r.correct / total) * 100) : 0,
      avgTime: r.times.length > 0 ? Math.round(r.times.reduce((a, b) => a + b, 0) / r.times.length) : 0,
    };
  }).sort((a, b) => a.accuracy - b.accuracy); // worst first
}

function AccuracyBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-9 text-right ${pct >= 80 ? 'text-emerald-700' : pct >= 60 ? 'text-amber-700' : 'text-red-600'}`}>{pct}%</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const navigate = useNavigate();

  const [students, setStudents] = useState<DbUser[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState(() => sessionStorage.getItem('admin_reports_studentId') || '');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState(() => sessionStorage.getItem('admin_reports_attemptId') || '');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState('All');

  // Sync selection to sessionStorage
  useEffect(() => {
    if (selectedStudentId) sessionStorage.setItem('admin_reports_studentId', selectedStudentId);
    else sessionStorage.removeItem('admin_reports_studentId');
  }, [selectedStudentId]);

  useEffect(() => {
    if (selectedAttemptId) sessionStorage.setItem('admin_reports_attemptId', selectedAttemptId);
    else sessionStorage.removeItem('admin_reports_attemptId');
  }, [selectedAttemptId]);

  // Load students
  useEffect(() => {
    api.getUsersByRole('STUDENT')
      .then(r => setStudents(r.users ?? []))
      .catch(() => {})
      .finally(() => setStudentsLoading(false));
  }, []);

  // Load attempts when student changes
  useEffect(() => {
    if (!selectedStudentId) {
      setAttempts([]);
      setSelectedAttemptId('');
      setAnalytics(null);
      return;
    }
    setLoading(true);
    api.getStudentAttempts(selectedStudentId)
      .then((attemptsRes) => {
        const submitted = ((attemptsRes.attempts ?? []) as Attempt[]).filter(a => a.status === 'SUBMITTED');
        setAttempts(submitted);
        if (submitted.length > 0) {
          const storedAttemptId = sessionStorage.getItem('admin_reports_attemptId');
          const hasStored = submitted.some(a => a.id === storedAttemptId);
          setSelectedAttemptId(hasStored && storedAttemptId ? storedAttemptId : submitted[0].id);
        } else {
          setSelectedAttemptId('');
          api.getStudentAnalytics(selectedStudentId)
            .then(analyticsRes => setAnalytics(analyticsRes as Analytics))
            .catch(() => {})
            .finally(() => setLoading(false));
        }
      })
      .catch(() => setLoading(false));
  }, [selectedStudentId]);

  // Load analytics when student or attempt changes
  useEffect(() => {
    if (!selectedStudentId) return;
    if (attempts.length > 0 && !selectedAttemptId) return;

    setLoading(true);
    api.getStudentAnalytics(selectedStudentId, selectedAttemptId || undefined)
      .then((analyticsRes) => setAnalytics(analyticsRes as Analytics))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedStudentId, selectedAttemptId]);

  const student = students.find(s => s.id === selectedStudentId);
  const attempt = attempts.find(a => a.id === selectedAttemptId);
  const qs = analytics?.questionPacingStats ?? [];

  // Auto-select first section when analytics data changes
  useEffect(() => {
    if (analytics?.questionPacingStats && analytics.questionPacingStats.length > 0) {
      setSectionFilter(analytics.questionPacingStats[0].sectionName);
    } else {
      setSectionFilter('All');
    }
  }, [analytics]);

  const filteredPacing = sectionFilter === 'All' ? qs : qs.filter(q => q.sectionName === sectionFilter);

  const topicRows = buildTopicTable(qs);
  const sections = ['All', ...Array.from(new Set(qs.map(q => q.sectionName)))];
  const filteredTopics = sectionFilter === 'All' ? topicRows : topicRows.filter(r => r.section === sectionFilter);
  const weakTopics = topicRows.filter(r => r.accuracy < 60).slice(0, 5);

  // Per-section totals
  const sectionMap = useMemo(() => {
    const m = new Map<string, { correct: number; total: number }>();
    for (const q of qs) {
      if (!m.has(q.sectionName)) m.set(q.sectionName, { correct: 0, total: 0 });
      const s = m.get(q.sectionName)!;
      s.total++;
      if (q.status === 'correct') s.correct++;
    }
    return m;
  }, [qs]);

  const totalQ = qs.length;
  const totalCorrect = qs.filter(q => q.status === 'correct').length;
  const totalWrong = qs.filter(q => q.status === 'incorrect').length;
  const overallAcc = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;
  const avgTimePerQ = totalQ > 0 ? Math.round(qs.reduce((a, q) => a + q.timeSpentSeconds, 0) / totalQ) : 0;

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── Header + selectors ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Student Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Accuracy, pacing & topic breakdown</p>
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          {/* Student picker */}
          <SearchableSelect
            options={students.map(s => ({
              id: s.id,
              label: `${s.name} (${s.email})`,
              searchText: s.name,
            }))}
            value={selectedStudentId}
            onChange={setSelectedStudentId}
            placeholder="Select student…"
            minWidth="min-w-[220px]"
          />
          {/* Attempt picker */}
          {attempts.length > 0 && (
            <SearchableSelect
              options={attempts.map(a => ({
                id: a.id,
                label: `${a.test.title} — ${a.completedAt ? new Date(a.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}`,
                searchText: a.test.title,
              }))}
              value={selectedAttemptId}
              onChange={setSelectedAttemptId}
              placeholder="Select attempt…"
              minWidth="min-w-[240px]"
            />
          )}
          {selectedAttemptId && (
            <button
              onClick={() => navigate(`/test-review/${selectedAttemptId}`)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#1b3d6e] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
            >
              <FileSearch size={14} /> Full Review
            </button>
          )}
        </div>
      </div>

      {studentsLoading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={20} className="animate-spin text-[#1b3d6e]" />
        </div>
      )}

      {!studentsLoading && !selectedStudentId && (
        <div className="bg-white border border-gray-100 rounded-xl py-20 text-center">
          <Target size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Select a student to view their report</p>
        </div>
      )}

      {selectedStudentId && loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={20} className="animate-spin text-[#1b3d6e]" />
        </div>
      )}

      {selectedStudentId && !loading && attempts.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl py-20 text-center">
          <AlertTriangle size={24} className="text-amber-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No submitted attempts found for this student</p>
        </div>
      )}

      {selectedStudentId && !loading && analytics && totalQ > 0 && (
        <>
          {/* ── Score header ─────────────────────────────────────────────────── */}
          <div className="bg-[#1b3d6e] rounded-2xl p-5 text-white">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-blue-300 text-xs font-medium uppercase tracking-wide">{student?.name}</p>
                <h2 className="text-xl font-bold mt-0.5">{attempt?.test.title ?? 'Test'}</h2>
                {attempt?.completedAt && (
                  <p className="text-blue-300 text-xs mt-0.5">
                    Completed {new Date(attempt.completedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-4xl font-black">{attempt?.totalScore ?? '—'}</p>
                <p className="text-blue-300 text-xs">raw score</p>
              </div>
            </div>

            {/* Section scores */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Array.from(sectionMap.entries()).map(([sec, data]) => (
                <div key={sec} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-lg font-bold">{data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0}%</p>
                  <p className="text-blue-200 text-[11px] truncate">{sec}</p>
                  <p className="text-blue-300 text-[10px]">{data.correct}/{data.total}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Key metric cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Accuracy', value: `${overallAcc}%`, sub: `${totalCorrect}/${totalQ} correct`, accent: 'text-[#1b3d6e]' },
              { label: 'Avg Time / Question', value: `${avgTimePerQ}s`, sub: 'across all questions', accent: 'text-gray-900' },
              { label: 'Correct', value: totalCorrect, sub: `${totalWrong} wrong`, accent: 'text-emerald-600' },
              { label: 'Attempts', value: analytics.totalAttempts, sub: `latest: ${analytics.latestScore || '—'}`, accent: 'text-gray-900' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.accent}`}>{s.value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Priority focus areas ─────────────────────────────────────────── */}
          {weakTopics.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
                <h3 className="text-sm font-semibold text-amber-900">Priority Focus Areas</h3>
                <span className="text-[11px] text-amber-600 ml-1">— topics below 60% accuracy</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {weakTopics.map(t => (
                  <div key={`${t.section}-${t.topic}`} className="bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-center">
                    <p className="text-xs font-bold text-amber-700">{t.topic}</p>
                    <p className="text-[10px] text-amber-500">{t.section} · {t.correct}/{t.total} correct · {t.accuracy}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Section filter (shared) ──────────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Section:</span>
            {sections.map(s => (
              <button key={s} onClick={() => setSectionFilter(s)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${sectionFilter === s ? 'bg-[#1b3d6e] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>

          {/* ── Performance by topic ─────────────────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Performance by Topic</h3>
              <p className="text-xs text-gray-400 mt-0.5">Weakest topics first</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Section</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Topic</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Qs</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-emerald-600 uppercase tracking-wide">✓</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-red-500 uppercase tracking-wide">✗</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">—</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTopics.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No data</td></tr>
                  ) : filteredTopics.map((row, i) => (
                    <tr key={i} className={`hover:bg-gray-50 transition-colors ${row.accuracy < 40 ? 'bg-red-50/30' : row.accuracy < 60 ? 'bg-amber-50/20' : ''}`}>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{row.section}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.topic}</td>
                      <td className="px-3 py-3 text-center text-gray-700 font-semibold">{row.total}</td>
                      <td className="px-3 py-3 text-center font-bold text-emerald-600">{row.correct}</td>
                      <td className="px-3 py-3 text-center font-bold text-red-500">{row.incorrect}</td>
                      <td className="px-3 py-3 text-center font-bold text-gray-400">{row.skipped}</td>
                      <td className="px-3 py-3 text-center text-xs text-gray-500">{row.avgTime}s</td>
                      <td className="px-4 py-3"><AccuracyBar pct={row.accuracy} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredTopics.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-4 text-xs text-gray-500">
                <span className="font-semibold text-gray-700">Totals:</span>
                <span><span className="font-bold text-gray-800">{filteredTopics.reduce((a, r) => a + r.total, 0)}</span> questions</span>
                <span className="text-emerald-700"><span className="font-bold">{filteredTopics.reduce((a, r) => a + r.correct, 0)}</span> correct</span>
                <span className="text-red-600"><span className="font-bold">{filteredTopics.reduce((a, r) => a + r.incorrect, 0)}</span> wrong</span>
                <span className="text-gray-400"><span className="font-bold">{filteredTopics.reduce((a, r) => a + r.skipped, 0)}</span> skipped</span>
                <span className="ml-auto font-semibold text-[#1b3d6e]">
                  Overall: {filteredTopics.reduce((a, r) => a + r.total, 0) > 0
                    ? Math.round((filteredTopics.reduce((a, r) => a + r.correct, 0) / filteredTopics.reduce((a, r) => a + r.total, 0)) * 100)
                    : 0}%
                </span>
              </div>
            )}
          </div>

          {/* ── Time per question ────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Time per Question{sectionFilter !== 'All' ? ` — ${sectionFilter}` : ''}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Real time spent on each question, colored by result</p>
            </div>
            <QuestionTimeChart stats={filteredPacing} />
          </div>

          {/* ── Question log ─────────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Question Log</h3>
              <p className="text-xs text-gray-400 mt-0.5">{filteredPacing.length} question{filteredPacing.length !== 1 ? 's' : ''}{sectionFilter !== 'All' ? ` in ${sectionFilter}` : ''}</p>
            </div>
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="border-b border-gray-100">
                    {['#', 'Section', 'Topic', 'Difficulty', 'Time', 'Result'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredPacing.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No questions found for this section filter.</td></tr>
                  ) : (
                    filteredPacing.map((q, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5 font-semibold text-gray-600">Q{q.questionIndex}</td>
                        <td className="px-3 py-2.5 text-gray-500">{q.sectionName}</td>
                        <td className="px-3 py-2.5 text-gray-700 font-medium">{q.topicName || '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${q.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700' : q.difficulty === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
                            {q.difficulty}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`font-bold ${q.timeSpentSeconds >= 90 ? 'text-red-500' : q.timeSpentSeconds < 20 ? 'text-amber-500' : 'text-gray-700'}`}>
                            {q.timeSpentSeconds}s
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`flex items-center gap-1 font-semibold capitalize ${q.status === 'correct' ? 'text-emerald-600' : q.status === 'incorrect' ? 'text-red-500' : 'text-gray-400'}`}>
                            {q.status === 'correct' ? <CheckCircle size={11} /> : q.status === 'incorrect' ? <XCircle size={11} /> : <Minus size={11} />}
                            {q.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Score trend ──────────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Score Over Time</h3>
                <p className="text-xs text-gray-400 mt-0.5">{analytics.trend.length} attempt{analytics.trend.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-[#1b3d6e]">Avg: {analytics.avgScore || '—'}</p>
                <p className="text-xs text-gray-400">Latest: {analytics.latestScore || '—'}</p>
              </div>
            </div>
            {analytics.trend.length < 2 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <TrendingUp size={24} className="mb-2 opacity-30" />
                <p className="text-sm">Need 2+ attempts to show trend</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={analytics.trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={v => v.slice(5)} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 36]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    formatter={(v: any, _n: any, p: any) => [v, p?.payload?.testTitle ?? 'Score']} />
                  <Line type="monotone" dataKey="score" stroke="#1b3d6e" strokeWidth={2.5}
                    dot={{ fill: '#1b3d6e', r: 4, stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#1b3d6e', stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}
