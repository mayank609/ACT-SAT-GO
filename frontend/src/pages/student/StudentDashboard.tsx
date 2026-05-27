import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, BookOpen, CheckCircle2, Clock, Target } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import { AssignedTestsSection } from '../../components/dashboard/AssignedTestsSection';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ApiAttempt {
  id: string;
  testId: string;
  status: string;
  totalScore?: number;
  completedAt?: string;
  test?: { id: string; title: string; sections: Array<{ id: string; name: string; durationMinutes: number; _count?: { questions: number } }> };
}

interface Analytics {
  trend: Array<{ date: string; score: number; testTitle: string; attemptId: string }>;
  sectionStats: Array<{ sectionId: string; sectionName: string; accuracy: number }>;
  overallAccuracy: number;
  totalAttempts: number;
  latestScore: number;
  avgScore: number;
}

export function StudentDashboard() {
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const [attempts, setAttempts] = useState<ApiAttempt[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    Promise.all([
      api.getStudentAttempts(dbId),
      api.getStudentAnalytics(dbId),
    ]).then(([attData, analyticsData]) => {
      setAttempts(attData.attempts as ApiAttempt[]);
      setAnalytics(analyticsData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [dbId]);

  const completed = attempts.filter(a => a.status === 'SUBMITTED');
  const inProgress = attempts.filter(a => a.status === 'IN_PROGRESS');
  const trend = analytics?.trend ?? [];
  const scoreDelta = trend.length >= 2 ? trend[trend.length - 1].score - trend[0].score : null;
  const focusAreas = (analytics?.sectionStats ?? []).slice().sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);

  const stats = [
    { label: 'Latest Score', value: analytics?.latestScore ?? '—', sub: '/36', icon: <Target size={16} />, color: 'blue' },
    { label: 'Tests Done', value: completed.length, sub: 'completed', icon: <CheckCircle2 size={16} />, color: 'emerald' },
    { label: 'In Progress', value: inProgress.length, sub: 'ongoing', icon: <Clock size={16} />, color: 'amber' },
    { label: 'Accuracy', value: analytics?.overallAccuracy ? `${analytics.overallAccuracy}%` : '—', sub: 'overall', icon: <TrendingUp size={16} />, color: 'purple' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Good morning, {firstName} 👋</h1>
        <p className="text-slate-400 text-sm mt-0.5">Here's your progress at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-slate-100 rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg ${colorMap[s.color]} flex items-center justify-center mb-3`}>
              {s.icon}
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {s.value}<span className="text-sm font-normal text-slate-400 ml-0.5">{s.sub}</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Score trend chart */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-slate-900 text-sm">Score Trend</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {trend.length > 0 ? `Last ${trend.length} test${trend.length !== 1 ? 's' : ''}` : 'No tests yet'}
              </p>
            </div>
            {scoreDelta !== null && (
              <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${scoreDelta >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                {scoreDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {scoreDelta >= 0 ? '+' : ''}{scoreDelta} pts
              </div>
            )}
          </div>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                <XAxis dataKey="date" tickFormatter={v => v.slice(5)} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 36]} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }} />
                <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2.5} fill="url(#scoreGrad)" name="Score" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-slate-300">
              <BookOpen size={28} className="mb-2" />
              <p className="text-sm text-slate-400">Complete a test to see your trend</p>
            </div>
          )}
        </div>

        {/* Focus areas */}
        <div className="bg-white border border-slate-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-slate-900 text-sm">Focus Areas</p>
            <button onClick={() => navigate('/my-progress')} className="text-xs text-blue-500 hover:text-blue-700 font-medium">See all →</button>
          </div>
          {focusAreas.length > 0 ? (
            <div className="space-y-3">
              {focusAreas.map(w => (
                <div key={w.sectionId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">{w.sectionName}</span>
                    <span className={`text-xs font-semibold ${w.accuracy < 55 ? 'text-red-500' : w.accuracy < 70 ? 'text-amber-500' : 'text-emerald-600'}`}>{w.accuracy}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${w.accuracy < 55 ? 'bg-red-400' : w.accuracy < 70 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${w.accuracy}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center mt-8">Complete a test to see focus areas</p>
          )}
        </div>
      </div>

      {/* Assigned tests */}
      <AssignedTestsSection studentId={dbId ?? undefined} maxDisplay={5} showViewAll />
    </div>
  );
}
