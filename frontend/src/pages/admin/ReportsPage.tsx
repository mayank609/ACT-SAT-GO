import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { DbUser } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, CheckCircle, XCircle, Minus, TrendingUp, FileSearch, AlertTriangle, Target, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type QStat = {
  questionIndex: number;
  sectionName: string;
  timeSpentSeconds: number;
  status: 'correct' | 'incorrect' | 'skipped';
  difficulty: string;
  topicName: string;
};

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

// ─── Topic row type ───────────────────────────────────────────────────────────

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
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'topics' | 'questions' | 'trend'>('topics');
  const [sectionFilter, setSectionFilter] = useState('All');

  // Load students
  useEffect(() => {
    api.getUsersByRole('STUDENT')
      .then(r => setStudents(r.users ?? []))
      .catch(() => {})
      .finally(() => setStudentsLoading(false));
  }, []);

  // Load attempts + analytics when student changes
  useEffect(() => {
    if (!selectedStudentId) return;
    setLoading(true);
    setAttempts([]); setSelectedAttemptId(''); setAnalytics(null);
    Promise.all([
      api.getStudentAttempts(selectedStudentId),
      api.getStudentAnalytics(selectedStudentId),
    ]).then(([attemptsRes, analyticsRes]) => {
      const submitted = ((attemptsRes.attempts ?? []) as Attempt[]).filter(a => a.status === 'SUBMITTED');
      setAttempts(submitted);
      if (submitted.length > 0) setSelectedAttemptId(submitted[0].id);
      setAnalytics(analyticsRes as Analytics);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, [selectedStudentId]);

  const student = students.find(s => s.id === selectedStudentId);
  const attempt = attempts.find(a => a.id === selectedAttemptId);
  const qs = analytics?.questionPacingStats ?? [];
  const topicRows = buildTopicTable(qs);
  const sections = ['All', ...Array.from(new Set(qs.map(q => q.sectionName)))];
  const filteredTopics = sectionFilter === 'All' ? topicRows : topicRows.filter(r => r.section === sectionFilter);
  const weakTopics = topicRows.filter(r => r.accuracy < 60).slice(0, 5);

  // Per-section totals
  const sectionMap = new Map<string, { correct: number; total: number }>();
  for (const q of qs) {
    if (!sectionMap.has(q.sectionName)) sectionMap.set(q.sectionName, { correct: 0, total: 0 });
    const s = sectionMap.get(q.sectionName)!;
    s.total++;
    if (q.status === 'correct') s.correct++;
  }

  const totalQ = qs.length;
  const totalCorrect = qs.filter(q => q.status === 'correct').length;
  const totalWrong = qs.filter(q => q.status === 'incorrect').length;
  const overallAcc = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── Header + selectors ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Diagnostic Analysis</h1>
          <p className="text-gray-500 text-sm mt-0.5">Zuperscore-style topic breakdown</p>
        </div>
        <div className="flex flex-wrap gap-2 ml-auto">
          {/* Student picker */}
          <div className="relative">
            <select
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#1b3d6e] text-gray-700 font-medium min-w-[180px]"
            >
              <option value="">Select student…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {/* Attempt picker */}
          {attempts.length > 0 && (
            <div className="relative">
              <select
                value={selectedAttemptId}
                onChange={e => setSelectedAttemptId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#1b3d6e] text-gray-700 min-w-[200px]"
              >
                {attempts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.test.title} — {a.completedAt ? new Date(a.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
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
          <p className="text-gray-500 font-medium">Select a student to view their diagnostic report</p>
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
          {/* ── Score Header (Zuperscore style) ─────────────────────────────── */}
          <div className="bg-[#1b3d6e] rounded-2xl p-5 text-white">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-blue-300 text-xs font-medium uppercase tracking-wide">{student?.name}</p>
                <h2 className="text-xl font-bold mt-0.5">{attempt?.test.title ?? 'Diagnostic Test'}</h2>
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

            {/* Overall stats bar */}
            <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Total Questions', value: totalQ },
                { label: 'Correct', value: totalCorrect },
                { label: 'Wrong', value: totalWrong },
                { label: 'Accuracy', value: `${overallAcc}%` },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-base font-bold">{s.value}</p>
                  <p className="text-blue-300 text-[10px]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Improvement Focus (Zuperscore insight box) ───────────────────── */}
          {weakTopics.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
                <h3 className="text-sm font-semibold text-amber-900">Priority Focus Areas</h3>
                <span className="text-[11px] text-amber-600 ml-1">— topics with &lt;60% accuracy</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {weakTopics.map(t => (
                  <div key={`${t.section}-${t.topic}`} className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5">
                    <div className="text-center">
                      <p className="text-xs font-bold text-amber-700">{t.topic}</p>
                      <p className="text-[10px] text-amber-500">{t.section} · {t.correct}/{t.total} correct · {t.accuracy}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab nav ──────────────────────────────────────────────────────── */}
          <div className="flex border-b border-gray-200 gap-0">
            {([
              ['topics',    'Performance by Topic'],
              ['questions', 'Question Log'],
              ['trend',     'Score Trend'],
            ] as const).map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${activeTab === key ? 'border-[#1b3d6e] text-[#1b3d6e]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Topic table (Zuperscore main feature) ────────────────────────── */}
          {activeTab === 'topics' && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              {/* Section filter */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 flex-wrap">
                <span className="text-xs text-gray-500 font-medium">Section:</span>
                {sections.map(s => (
                  <button key={s} onClick={() => setSectionFilter(s)}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${sectionFilter === s ? 'bg-[#1b3d6e] text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
                    {s}
                  </button>
                ))}
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

              {/* Summary footer */}
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
          )}

          {/* ── Question log ─────────────────────────────────────────────────── */}
          {activeTab === 'questions' && (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
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
                    {qs.map((q, i) => (
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Score trend ──────────────────────────────────────────────────── */}
          {activeTab === 'trend' && (
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
                      formatter={(v: number, _n: string, p: { payload?: { testTitle?: string } }) => [v, p.payload?.testTitle ?? 'Score']} />
                    <Line type="monotone" dataKey="score" stroke="#1b3d6e" strokeWidth={2.5}
                      dot={{ fill: '#1b3d6e', r: 4, stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#1b3d6e', stroke: '#fff', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
