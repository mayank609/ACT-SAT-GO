import { useState, useEffect } from 'react';
import { TrendingUp, Target, Clock, CheckCircle, ChevronRight } from 'lucide-react';
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
  overallAccuracy: number;
  totalAttempts: number;
  latestScore: number;
  avgScore: number;
}

type Attempt = {
  id: string;
  status: string;
  totalScore: number | null;
  startedAt: string;
  completedAt: string | null;
  test: { title: string; sections: Array<{ _count: { questions: number } }> };
};

export function MyProgressPage() {
  const { dbId } = useAuthStore();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  // Load the student's overall analytics (trend + aggregate stats)
  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    setLoading(true);
    api.getStudentAnalytics(dbId)
      .then((r) => setAnalytics(r as Analytics))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dbId]);

  // Load the list of completed test attempts
  useEffect(() => {
    if (!dbId) return;
    api.getStudentAttempts(dbId)
      .then((r) => {
        const submitted = ((r.attempts as any[]) ?? []).filter((a) => a.status === 'SUBMITTED');
        setAttempts(submitted as Attempt[]);
      })
      .catch(() => {});
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
                formatter={(v: any, _n: any, p: any) => [v, p?.payload?.testTitle ?? 'Score']}
              />
              <Line type="monotone" dataKey="score" stroke="#1b3d6e" strokeWidth={2.5}
                dot={{ fill: '#1b3d6e', r: 4, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#1b3d6e', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── TEST LIST (all tests, click to open its own page) ──────────── */}
      {attempts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">Your Tests</h2>
            <span className="text-xs text-gray-400">Click a test to open its full report</span>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden">
            {attempts.map((a, idx) => {
              const totalQ = a.test.sections.reduce((sum, s) => sum + s._count.questions, 0);
              return (
                <button
                  key={a.id}
                  onClick={() => navigate(`/test-review/${a.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-50 transition-colors group"
                >
                  {/* Number badge */}
                  <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gray-100 text-gray-500 group-hover:bg-[#1b3d6e] group-hover:text-white transition-colors">
                    {idx + 1}
                  </span>
                  {/* Title + date */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate text-gray-900 group-hover:text-[#1b3d6e] transition-colors">
                      {a.test.title}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {a.completedAt
                        ? new Date(a.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : new Date(a.startedAt).toLocaleDateString()}
                      {' · '}{totalQ} questions
                    </p>
                  </div>
                  {/* Score */}
                  <div className="flex-shrink-0 text-right">
                    <span className="text-lg font-bold text-gray-800">{a.totalScore ?? '—'}</span>
                    <span className="block text-[10px] text-gray-400 uppercase tracking-wide leading-none">score</span>
                  </div>
                  <ChevronRight size={16} className="flex-shrink-0 text-gray-300 group-hover:text-[#1b3d6e] transition-colors" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
