import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, BookOpen, CheckCircle2, Clock, Target, Calendar, ArrowRight, Award, Compass, ChevronRight } from 'lucide-react';
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
    { label: 'Latest Composite Score', value: analytics?.latestScore ?? '—', sub: '/36', icon: <Target size={18} />, color: 'blue', desc: 'Most recent mock outcome' },
    { label: 'Mock Exams Completed', value: completed.length, sub: 'exams', icon: <CheckCircle2 size={18} />, color: 'emerald', desc: 'Fully evaluated attempts' },
    { label: 'Active Attempts', value: inProgress.length, sub: 'ongoing', icon: <Clock size={18} />, color: 'amber', desc: 'Incomplete sectional tests' },
    { label: 'Overall Accuracy Rate', value: analytics?.overallAccuracy ? `${analytics.overallAccuracy}%` : '—', sub: 'overall', icon: <TrendingUp size={18} />, color: 'purple', desc: 'Percentage of correct answers' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <Clock className="animate-spin text-blue-500" size={24} />
          <span className="text-sm font-semibold">Gathering your progress...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Premium Hero Greeting Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 md:p-8 text-white shadow-md shadow-blue-500/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full translate-x-20 -translate-y-20 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-white/5 rounded-full translate-y-16 blur-xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="bg-white/20 text-white font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 w-fit">
              <Award size={12} /> Prep Level Active
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">Welcome back, {firstName}! 👋</h1>
            <p className="text-blue-100 text-sm max-w-lg leading-relaxed">
              Your preparation status is strong. You have completed {completed.length} comprehensive practice milestones. Ready to raise your composite target score today?
            </p>
          </div>
          <div className="flex gap-2.5">
            <button 
              onClick={() => navigate('/my-tests')}
              className="px-4 py-2.5 bg-white text-blue-700 font-bold text-xs rounded-xl shadow-md hover:bg-blue-50 hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Compass size={14} /> Resume Prep Sheet
            </button>
            <button 
              onClick={() => navigate('/my-progress')}
              className="px-4 py-2.5 bg-blue-500/30 border border-white/20 text-white font-semibold text-xs rounded-xl hover:bg-white/15 transition-all flex items-center gap-2"
            >
              Analyze Pacing <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div 
            key={s.label} 
            className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-slate-200 hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-xl ${colorMap[s.color]} flex items-center justify-center border font-bold shadow-sm`}>
                  {s.icon}
                </div>
                <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">Live Feed</span>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-4 tracking-tight flex items-baseline gap-1">
                {s.value}
                <span className="text-xs font-bold text-slate-400">{s.sub}</span>
              </p>
              <p className="text-xs font-bold text-slate-800 mt-1">{s.label}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-50">
              <p className="text-[10px] text-slate-400 font-semibold">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score trend chart */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <TrendingUp className="text-blue-500" size={18} />
                Composite Score Evolution
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {trend.length > 0 ? `Historical summary of your last ${trend.length} test sessions` : 'Take standard mock exams to trigger trend analysis'}
              </p>
            </div>
            {scoreDelta !== null && (
              <div className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full ${scoreDelta >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                {scoreDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {scoreDelta >= 0 ? 'Gain of ' : 'Loss of '}{Math.abs(scoreDelta)} pts
              </div>
            )}
          </div>
          {trend.length > 0 ? (
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 5, right: 5, bottom: -5, left: -25 }}>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={v => v.slice(5)} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 36]} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} 
                    formatter={(v, n, p) => [v, p.payload?.testTitle ?? n]}
                  />
                  <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} fill="url(#scoreGrad)" name="Score" dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: '#3b82f6' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
              <BookOpen size={32} className="text-slate-350 mb-2" />
              <p className="text-xs font-bold text-slate-700">No mock history available</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Assigned assessments will appear in the action panel below</p>
            </div>
          )}
        </div>

        {/* Focus areas */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Critical Revision Focus</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Priority study areas based on accuracy</p>
            </div>
            <button onClick={() => navigate('/my-progress')} className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-0.5">
              See details <ChevronRight size={12} />
            </button>
          </div>
          {focusAreas.length > 0 ? (
            <div className="space-y-4">
              {focusAreas.map(w => {
                const isVeryLow = w.accuracy < 55;
                const isModerate = w.accuracy >= 55 && w.accuracy < 70;
                return (
                  <div key={w.sectionId} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700">{w.sectionName}</span>
                      <span className={`text-xs font-black ${isVeryLow ? 'text-red-500' : isModerate ? 'text-amber-500' : 'text-emerald-600'}`}>
                        {w.accuracy}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${isVeryLow ? 'bg-red-500' : isModerate ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                        style={{ width: `${w.accuracy}%` }} 
                      />
                    </div>
                    <p className="text-[9px] text-slate-450 mt-1.5 font-semibold uppercase tracking-wider">
                      {isVeryLow ? '⚠️ High Priority Focus' : isModerate ? '⚡ Moderate Practice Needed' : '✓ Good Master level'}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl">
              <Calendar size={32} className="text-slate-350 mb-2" />
              <p className="text-xs font-bold text-slate-700">Analytics pending</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Submit practice sheets to extract concepts</p>
            </div>
          )}
        </div>
      </div>

      {/* Assigned tests */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 md:p-6 shadow-sm">
        <AssignedTestsSection studentId={dbId ?? undefined} maxDisplay={5} showViewAll />
      </div>
    </div>
  );
}

