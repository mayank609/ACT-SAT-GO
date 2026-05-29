import { useState, useEffect } from 'react';
import { TrendingUp, Target, Clock, CheckCircle, XCircle, Minus, AlertCircle, Zap } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface Analytics {
  trend: Array<{ date: string; score: number; testTitle: string; attemptId: string }>;
  sectionStats: Array<{
    sectionId: string;
    sectionName: string;
    totalQuestions: number;
    correct: number;
    incorrect: number;
    skipped: number;
    accuracy: number;
    timeAllocated: number;
    timeUsed: number;
  }>;
  questionPacingStats?: Array<{
    questionIndex: number;
    sectionName: string;
    timeSpentSeconds: number;
    status: 'correct' | 'incorrect' | 'skipped';
    difficulty: string;
    topicName: string;
  }>;
  overallAccuracy: number;
  totalAttempts: number;
  latestScore: number;
  avgScore: number;
}

export function MyProgressPage() {
  const { dbId } = useAuthStore();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('all');

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    api.getStudentAnalytics(dbId)
      .then((r) => setAnalytics(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dbId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-[#1b3d6e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!analytics || analytics.totalAttempts === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Target size={24} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">No tests completed yet</h2>
        <p className="text-gray-500 text-sm mb-6">Complete a test to see your performance analytics here.</p>
        <button
          onClick={() => navigate('/my-tests')}
          className="px-5 py-2.5 bg-[#1b3d6e] text-white rounded-lg text-sm font-medium hover:bg-[#15305a] transition-colors"
        >
          Go to My Tests
        </button>
      </div>
    );
  }

  const improvement = analytics.trend.length > 1
    ? analytics.trend[analytics.trend.length - 1].score - analytics.trend[0].score
    : 0;

  const pacing = analytics.questionPacingStats ?? [];
  const filteredPacing = activeSection === 'all' ? pacing : pacing.filter(q => q.sectionName === activeSection);
  const sectionNames = Array.from(new Set(pacing.map(q => q.sectionName)));

  const stuckCount = pacing.filter(q => q.timeSpentSeconds >= 90).length;
  const rushedCount = pacing.filter(q => q.timeSpentSeconds < 20 && q.status !== 'skipped').length;
  const avgTime = pacing.length > 0 ? Math.round(pacing.reduce((a, q) => a + q.timeSpentSeconds, 0) / pacing.length) : 0;

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My Progress</h1>
        <p className="text-gray-500 text-sm mt-0.5">{analytics.totalAttempts} test{analytics.totalAttempts !== 1 ? 's' : ''} completed</p>
      </div>

      {/* ── SCORE SUMMARY ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Latest Score', value: analytics.latestScore || '—',
            sub: improvement !== 0 ? `${improvement > 0 ? '+' : ''}${improvement} from first` : 'first attempt',
            color: 'text-[#1b3d6e]', icon: <TrendingUp size={16} />,
          },
          {
            label: 'Average Score', value: analytics.avgScore || '—',
            sub: `over ${analytics.totalAttempts} tests`, color: 'text-emerald-700', icon: <Target size={16} />,
          },
          {
            label: 'Accuracy', value: `${analytics.overallAccuracy}%`,
            sub: 'overall correct', color: 'text-purple-700', icon: <CheckCircle size={16} />,
          },
          {
            label: 'Tests Done', value: analytics.totalAttempts,
            sub: 'submitted', color: 'text-amber-700', icon: <Clock size={16} />,
          },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
            <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${s.color}`}>
              {s.icon} {s.label}
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── SCORE TREND ────────────────────────────────────────────────── */}
      {analytics.trend.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Score Trend</h2>
              <p className="text-xs text-gray-400 mt-0.5">Composite score across all attempts</p>
            </div>
            {improvement !== 0 && (
              <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${improvement > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {improvement > 0 ? '+' : ''}{improvement} pts
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={analytics.trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 36]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                formatter={(v, _n, p) => [v, p.payload?.testTitle ?? 'Score']}
              />
              <Line type="monotone" dataKey="score" stroke="#1b3d6e" strokeWidth={2.5}
                dot={{ fill: '#1b3d6e', r: 4, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#1b3d6e', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── SECTION PERFORMANCE ────────────────────────────────────────── */}
      {analytics.sectionStats.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Section Performance</h2>
          <div className="space-y-4">
            {analytics.sectionStats.map((s) => (
              <div key={s.sectionId}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{s.sectionName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.accuracy >= 80 ? 'bg-emerald-50 text-emerald-700' :
                      s.accuracy >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                    }`}>
                      {s.accuracy >= 80 ? 'Strong' : s.accuracy >= 60 ? 'Average' : 'Needs Work'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><CheckCircle size={11} className="text-emerald-500" /> {s.correct}</span>
                    <span className="flex items-center gap-1"><XCircle size={11} className="text-red-400" /> {s.incorrect}</span>
                    <span className="flex items-center gap-1"><Minus size={11} className="text-gray-400" /> {s.skipped}</span>
                    <span className={`font-semibold ${s.accuracy >= 80 ? 'text-emerald-700' : s.accuracy >= 60 ? 'text-amber-700' : 'text-red-600'}`}>
                      {s.accuracy.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${s.accuracy >= 80 ? 'bg-emerald-500' : s.accuracy >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${s.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PACING ANALYSIS ────────────────────────────────────────────── */}
      {pacing.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Pacing Analysis</h2>
              <p className="text-xs text-gray-400 mt-0.5">Time spent per question on your latest test</p>
            </div>
            {/* Section filter */}
            <div className="flex gap-1">
              {['all', ...sectionNames].map((s) => (
                <button key={s} onClick={() => setActiveSection(s)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${activeSection === s ? 'bg-[#1b3d6e] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Pacing stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{avgTime}s</p>
              <p className="text-xs text-gray-500 mt-0.5">avg / question</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-red-600 flex items-center justify-center gap-1">
                <AlertCircle size={16} /> {stuckCount}
              </p>
              <p className="text-xs text-red-500 mt-0.5">stuck ≥ 90s</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-amber-600 flex items-center justify-center gap-1">
                <Zap size={16} /> {rushedCount}
              </p>
              <p className="text-xs text-amber-500 mt-0.5">rushed &lt; 20s</p>
            </div>
          </div>

          {/* Question log table */}
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['#', 'Section', 'Topic', 'Time', 'Result'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredPacing.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No data</td></tr>
                ) : filteredPacing.map((q) => {
                  const isStuck = q.timeSpentSeconds >= 90;
                  const isRushed = q.timeSpentSeconds < 20 && q.status !== 'skipped';
                  return (
                    <tr key={q.questionIndex} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 font-semibold text-gray-700">Q{q.questionIndex}</td>
                      <td className="px-3 py-2.5 text-gray-500">{q.sectionName}</td>
                      <td className="px-3 py-2.5 text-gray-700">{q.topicName || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`font-bold ${isStuck ? 'text-red-600' : isRushed ? 'text-amber-600' : 'text-gray-700'}`}>
                          {q.timeSpentSeconds}s
                        </span>
                        {isStuck && <span className="ml-1 text-red-400 text-[10px]">stuck</span>}
                        {isRushed && <span className="ml-1 text-amber-400 text-[10px]">rushed</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 font-medium capitalize ${
                          q.status === 'correct' ? 'text-emerald-600' :
                          q.status === 'incorrect' ? 'text-red-500' : 'text-gray-400'
                        }`}>
                          {q.status === 'correct' ? <CheckCircle size={11} /> : q.status === 'incorrect' ? <XCircle size={11} /> : <Minus size={11} />}
                          {q.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
