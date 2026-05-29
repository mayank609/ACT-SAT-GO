import { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, CheckCircle, XCircle, Minus, TrendingUp, Clock, Users, BarChart2, ExternalLink, FileSearch } from 'lucide-react';
import { api } from '../../lib/api';
import type { DbUser } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type Analytics = {
  trend: Array<{ date: string; score: number; testTitle: string; attemptId: string }>;
  sectionStats: Array<{ sectionId: string; sectionName: string; totalQuestions: number; correct: number; incorrect: number; skipped: number; accuracy: number; timeAllocated: number; timeUsed: number }>;
  questionPacingStats?: Array<{ questionIndex: number; sectionName: string; timeSpentSeconds: number; status: 'correct' | 'incorrect' | 'skipped'; difficulty: string; topicName: string }>;
  overallAccuracy: number;
  totalAttempts: number;
  latestScore: number;
  avgScore: number;
};

type StudentAttempt = {
  id: string;
  status: string;
  totalScore: number | null;
  startedAt: string;
  completedAt: string | null;
  test: { id: string; title: string; sections: Array<{ _count: { questions: number } }> };
};

type Filter = 'all' | 'attempted' | 'not_attempted';
type Sort = 'name' | 'score' | 'attempts' | 'accuracy';

export function ReportsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('name');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analyticsCache, setAnalyticsCache] = useState<Record<string, Analytics>>({});
  const [attemptsCache, setAttemptsCache] = useState<Record<string, StudentAttempt[]>>({});
  const [analyticsLoading, setAnalyticsLoading] = useState<string | null>(null);

  useEffect(() => {
    api.getUsersByRole('STUDENT')
      .then((r) => setStudents(r.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadAnalytics = async (studentId: string) => {
    if (analyticsCache[studentId] && attemptsCache[studentId]) return;
    setAnalyticsLoading(studentId);
    try {
      const [analyticsData, attemptsData] = await Promise.all([
        analyticsCache[studentId] ? null : api.getStudentAnalytics(studentId),
        attemptsCache[studentId] ? null : api.getStudentAttempts(studentId),
      ]);
      if (analyticsData) setAnalyticsCache((prev) => ({ ...prev, [studentId]: analyticsData as Analytics }));
      if (attemptsData) setAttemptsCache((prev) => ({ ...prev, [studentId]: (attemptsData.attempts as StudentAttempt[]).filter(a => a.status === 'SUBMITTED') }));
    } catch { /* silent */ }
    finally { setAnalyticsLoading(null); }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    loadAnalytics(id);
  };

  // Aggregate stats
  const attempted = students.filter((s) => (s.testsAttempted ?? 0) > 0);
  const notAttempted = students.filter((s) => (s.testsAttempted ?? 0) === 0);
  const avgAccuracy = attempted.length > 0
    ? Math.round(attempted.reduce((a, s) => a + (s.avgScore ?? 0), 0) / attempted.length)
    : 0;

  // Filter + sort
  const filtered = students
    .filter((s) => {
      if (filter === 'attempted' && (s.testsAttempted ?? 0) === 0) return false;
      if (filter === 'not_attempted' && (s.testsAttempted ?? 0) > 0) return false;
      const q = search.toLowerCase();
      return !q || (s.name ?? '').toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === 'score') return (b.avgScore ?? 0) - (a.avgScore ?? 0);
      if (sort === 'attempts') return (b.testsAttempted ?? 0) - (a.testsAttempted ?? 0);
      if (sort === 'accuracy') return (b.avgScore ?? 0) - (a.avgScore ?? 0);
      return (a.name ?? '').localeCompare(b.name ?? '');
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-[#1b3d6e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Title */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-0.5">Performance overview for all students</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Students', value: students.length, icon: <Users size={15} />, color: 'text-[#1b3d6e] bg-blue-50' },
          { label: 'Attempted', value: attempted.length, icon: <CheckCircle size={15} />, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Not Attempted', value: notAttempted.length, icon: <Minus size={15} />, color: 'text-gray-600 bg-gray-100' },
          { label: 'Avg Score', value: avgAccuracy || '—', icon: <TrendingUp size={15} />, color: 'text-purple-700 bg-purple-50' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md mb-2 ${s.color}`}>
              {s.icon} {s.label}
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1b3d6e] bg-white"
          />
        </div>

        {/* Status filter */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {([['all', 'All'], ['attempted', 'Attempted'], ['not_attempted', 'Not Attempted']] as [Filter, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#1b3d6e] text-gray-700">
          <option value="name">Sort: Name</option>
          <option value="score">Sort: Score</option>
          <option value="attempts">Sort: Tests Taken</option>
        </select>
      </div>

      {/* Count */}
      <p className="text-xs text-gray-400">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</p>

      {/* Student table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl py-16 text-center">
          <BarChart2 size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No students match the current filter</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((student) => {
            const hasAttempted = (student.testsAttempted ?? 0) > 0;
            const isExpanded = expandedId === student.id;
            const analytics = analyticsCache[student.id] ?? null;
            const isLoadingAnalytics = analyticsLoading === student.id;

            // Compute totals from analytics if loaded
            const totalCorrect = analytics?.sectionStats.reduce((a, s) => a + s.correct, 0) ?? null;
            const totalWrong = analytics?.sectionStats.reduce((a, s) => a + s.incorrect, 0) ?? null;
            const totalSkipped = analytics?.sectionStats.reduce((a, s) => a + s.skipped, 0) ?? null;

            return (
              <div key={student.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                {/* Row */}
                <div
                  className="flex items-center gap-4 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(student.id)}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-[#1b3d6e]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#1b3d6e]">
                      {(student.name ?? 'S').charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{student.name ?? '—'}</p>
                    <p className="text-xs text-gray-400 truncate">{student.email}</p>
                  </div>

                  {/* Status badge */}
                  <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
                    hasAttempted ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {hasAttempted ? `${student.testsAttempted} test${(student.testsAttempted ?? 0) !== 1 ? 's' : ''}` : 'Not attempted'}
                  </span>

                  {/* Score */}
                  {hasAttempted && (
                    <div className="flex-shrink-0 text-right hidden sm:block">
                      <p className="text-sm font-bold text-[#1b3d6e]">{student.avgScore ?? '—'}</p>
                      <p className="text-[10px] text-gray-400">avg score</p>
                    </div>
                  )}

                  {/* Correct / Wrong / Skip — only if analytics loaded */}
                  {hasAttempted && totalCorrect !== null && (
                    <div className="flex-shrink-0 flex items-center gap-3 text-xs hidden md:flex">
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle size={12} /> {totalCorrect}
                      </span>
                      <span className="flex items-center gap-1 text-red-500 font-medium">
                        <XCircle size={12} /> {totalWrong}
                      </span>
                      <span className="flex items-center gap-1 text-gray-400 font-medium">
                        <Minus size={12} /> {totalSkipped}
                      </span>
                    </div>
                  )}

                  {/* View profile link */}
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/students/${student.id}`); }}
                    className="flex-shrink-0 p-1.5 text-gray-400 hover:text-[#1b3d6e] hover:bg-blue-50 rounded-md transition-colors"
                    title="View student profile"
                  >
                    <ExternalLink size={14} />
                  </button>

                  {/* Expand icon */}
                  <div className="flex-shrink-0 text-gray-400">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Expanded analytics */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-5">
                    {!hasAttempted ? (
                      <p className="text-sm text-gray-400 text-center py-4">This student hasn't attempted any tests yet.</p>
                    ) : isLoadingAnalytics ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-[#1b3d6e] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : !analytics ? (
                      <p className="text-sm text-gray-400 text-center py-4">No analytics data available.</p>
                    ) : (
                      <div className="space-y-5">
                        {/* ── Attempts list ──────────────────────────────── */}
                        {attemptsCache[student.id] && attemptsCache[student.id].length > 0 && (
                          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Test Attempts</h4>
                              <span className="text-xs text-gray-400">{attemptsCache[student.id].length} submitted</span>
                            </div>
                            <div className="divide-y divide-gray-50">
                              {attemptsCache[student.id].map((attempt) => {
                                const totalQ = attempt.test.sections.reduce((a, s) => a + s._count.questions, 0);
                                return (
                                  <div key={attempt.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">{attempt.test.title}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">
                                        {attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date(attempt.startedAt).toLocaleDateString()}
                                        {' · '}{totalQ} questions
                                      </p>
                                    </div>
                                    {attempt.totalScore !== null && (
                                      <span className="flex-shrink-0 text-sm font-bold text-[#1b3d6e]">{attempt.totalScore} pts</span>
                                    )}
                                    <button
                                      onClick={() => navigate(`/test-review/${attempt.id}`)}
                                      className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-[#1b3d6e] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                      <FileSearch size={12} /> View Questions
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Top stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: 'Latest Score', value: analytics.latestScore || '—', color: 'text-[#1b3d6e]' },
                            { label: 'Avg Score', value: analytics.avgScore || '—', color: 'text-emerald-700' },
                            { label: 'Accuracy', value: `${analytics.overallAccuracy}%`, color: 'text-purple-700' },
                            { label: 'Tests Done', value: analytics.totalAttempts, color: 'text-amber-700' },
                          ].map((s) => (
                            <div key={s.label} className="bg-white border border-gray-100 rounded-lg p-3 text-center">
                              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          {/* Section breakdown */}
                          {analytics.sectionStats.length > 0 && (
                            <div className="bg-white border border-gray-100 rounded-xl p-4">
                              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Section Breakdown</h4>
                              <div className="space-y-3">
                                {analytics.sectionStats.map((sec) => (
                                  <div key={sec.sectionId}>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-medium text-gray-700">{sec.sectionName}</span>
                                      <div className="flex items-center gap-2 text-[11px]">
                                        <span className="text-emerald-600 font-medium flex items-center gap-0.5"><CheckCircle size={10} /> {sec.correct}</span>
                                        <span className="text-red-500 font-medium flex items-center gap-0.5"><XCircle size={10} /> {sec.incorrect}</span>
                                        <span className="text-gray-400 flex items-center gap-0.5"><Minus size={10} /> {sec.skipped}</span>
                                        <span className={`font-bold ml-1 ${sec.accuracy >= 80 ? 'text-emerald-600' : sec.accuracy >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                                          {sec.accuracy.toFixed(0)}%
                                        </span>
                                      </div>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${sec.accuracy >= 80 ? 'bg-emerald-500' : sec.accuracy >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                                        style={{ width: `${sec.accuracy}%` }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Score trend */}
                          {analytics.trend.length > 1 && (
                            <div className="bg-white border border-gray-100 rounded-xl p-4">
                              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Score Trend</h4>
                              <ResponsiveContainer width="100%" height={130}>
                                <LineChart data={analytics.trend} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                  <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                  <YAxis domain={[0, 36]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '11px' }}
                                    formatter={(v, _n, p) => [v, p.payload?.testTitle ?? 'Score']} />
                                  <Line type="monotone" dataKey="score" stroke="#1b3d6e" strokeWidth={2}
                                    dot={{ fill: '#1b3d6e', r: 3, stroke: '#fff', strokeWidth: 1.5 }} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>

                        {/* Question-level summary */}
                        {analytics.questionPacingStats && analytics.questionPacingStats.length > 0 && (() => {
                          const qs = analytics.questionPacingStats!;
                          const correct = qs.filter(q => q.status === 'correct').length;
                          const wrong = qs.filter(q => q.status === 'incorrect').length;
                          const skipped = qs.filter(q => q.status === 'skipped').length;
                          const stuck = qs.filter(q => q.timeSpentSeconds >= 90).length;
                          const rushed = qs.filter(q => q.timeSpentSeconds < 20 && q.status !== 'skipped').length;
                          return (
                            <div className="bg-white border border-gray-100 rounded-xl p-4">
                              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                                Question Summary — {qs.length} questions
                              </h4>
                              <div className="flex flex-wrap gap-3">
                                {[
                                  { label: 'Correct', value: correct, bg: 'bg-emerald-50', text: 'text-emerald-700', icon: <CheckCircle size={13} /> },
                                  { label: 'Wrong', value: wrong, bg: 'bg-red-50', text: 'text-red-600', icon: <XCircle size={13} /> },
                                  { label: 'Skipped', value: skipped, bg: 'bg-gray-100', text: 'text-gray-600', icon: <Minus size={13} /> },
                                  { label: 'Stuck (≥90s)', value: stuck, bg: 'bg-orange-50', text: 'text-orange-600', icon: <Clock size={13} /> },
                                  { label: 'Rushed (<20s)', value: rushed, bg: 'bg-amber-50', text: 'text-amber-700', icon: <Clock size={13} /> },
                                ].map((item) => (
                                  <div key={item.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${item.bg}`}>
                                    <span className={item.text}>{item.icon}</span>
                                    <span className={`text-sm font-bold ${item.text}`}>{item.value}</span>
                                    <span className="text-xs text-gray-500">{item.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
