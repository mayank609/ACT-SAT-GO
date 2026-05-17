import { useState, useEffect } from 'react';
import { TrendingUp, Target, Clock, Award } from 'lucide-react';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
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

export function MyProgressPage() {
  const { dbId } = useAuthStore();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    api.getStudentAnalytics(dbId)
      .then((r) => setAnalytics(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dbId]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400 text-sm">Loading...</div></div>;
  }

  if (!analytics || analytics.totalAttempts === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">My Progress</h1>
          <p className="text-slate-500 text-sm mt-0.5">Detailed analytics of your performance</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
          <Target size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No tests completed yet</p>
          <p className="text-slate-400 text-sm mt-1">Complete a test to see your progress analytics here.</p>
        </div>
      </div>
    );
  }

  const sectionData = analytics.sectionStats.map((s) => ({
    name: s.sectionName,
    accuracy: s.accuracy,
    timeEfficiency: s.timeAllocated > 0 ? Math.round((s.timeUsed / s.timeAllocated) * 100) : 0,
    correct: s.correct,
    total: s.totalQuestions,
  }));

  const improvement = analytics.trend.length > 1
    ? analytics.trend[analytics.trend.length - 1].score - analytics.trend[0].score
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Progress</h1>
        <p className="text-slate-500 text-sm mt-0.5">Detailed analytics of your performance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Latest Score" value={analytics.latestScore || '—'} subtitle="ACT composite" icon={<TrendingUp size={18} />} color="blue"
          trend={improvement > 0 ? { value: improvement, positive: true } : undefined} />
        <StatCard title="Avg Score" value={analytics.avgScore || '—'} subtitle={`${analytics.totalAttempts} tests`} icon={<Target size={18} />} color="emerald" />
        <StatCard title="Overall Accuracy" value={`${analytics.overallAccuracy}%`} subtitle="last test" icon={<Award size={18} />} color="purple" />
        <StatCard title="Tests Done" value={analytics.totalAttempts} subtitle="submitted" icon={<Clock size={18} />} color="amber" />
      </div>

      {analytics.trend.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Score History</h3>
              <p className="text-sm text-slate-500">ACT composite score over time</p>
            </div>
            {improvement !== 0 && (
              <div className="text-right">
                <p className={`text-3xl font-bold ${improvement > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {improvement > 0 ? '+' : ''}{improvement}
                </p>
                <p className="text-xs text-slate-500">improvement</p>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={analytics.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 36]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                formatter={(v, n, p) => [v, p.payload?.testTitle ?? n]} />
              <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 5, strokeWidth: 2, stroke: '#fff' }} name="Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {sectionData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Section Performance</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sectionData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Accuracy %" barSize={28} />
              <Bar dataKey="timeEfficiency" fill="#10b981" radius={[4, 4, 0, 0]} name="Time Used %" barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {sectionData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Section Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Section', 'Correct/Total', 'Skipped', 'Accuracy', 'Time Used', 'Strength'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {analytics.sectionStats.map((s) => (
                  <tr key={s.sectionId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.sectionName}</td>
                    <td className="px-4 py-3 text-slate-700">{s.correct}/{s.totalQuestions}</td>
                    <td className="px-4 py-3 text-slate-500">{s.skipped}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.accuracy >= 80 ? 'bg-emerald-500' : s.accuracy >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${s.accuracy}%` }} />
                        </div>
                        <span className="font-medium text-slate-700">{s.accuracy.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.timeUsed > 0 ? `${Math.round(s.timeUsed / 60)}m` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={s.accuracy >= 80 ? 'success' : s.accuracy >= 60 ? 'warning' : 'danger'} size="sm">
                        {s.accuracy >= 80 ? 'Strong' : s.accuracy >= 60 ? 'Average' : 'Weak'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
