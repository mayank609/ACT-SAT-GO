import { TrendingUp, Target, Clock, Award } from 'lucide-react';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { MOCK_ANALYTICS, MOCK_TRENDS } from '../../data/mockData';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, Legend
} from 'recharts';

const topicRadar = [
  { topic: 'Algebra', score: 87 },
  { topic: 'Grammar', score: 82 },
  { topic: 'Reading', score: 77 },
  { topic: 'Science', score: 73 },
  { topic: 'Geometry', score: 65 },
  { topic: 'Trig', score: 60 },
];

export function MyProgressPage() {
  const sectionData = MOCK_ANALYTICS.sections.map((s) => ({
    name: s.sectionName,
    accuracy: s.accuracy,
    timeEfficiency: Math.round((s.timeUsed / s.timeAllocated) * 100),
    correct: s.correct,
    total: s.totalQuestions,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Progress</h1>
        <p className="text-slate-500 text-sm mt-0.5">Detailed analytics of your performance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Current Score" value="28" subtitle="ACT composite" icon={<TrendingUp size={18} />} color="blue" trend={{ value: 4, positive: true }} />
        <StatCard title="Target Score" value="32" subtitle="4 points to go" icon={<Target size={18} />} color="emerald" />
        <StatCard title="Overall Accuracy" value={`${MOCK_ANALYTICS.overallAccuracy}%`} subtitle="last full test" icon={<Award size={18} />} color="purple" trend={{ value: 5, positive: true }} />
        <StatCard title="Percentile" value="72nd" subtitle="national ranking" icon={<Clock size={18} />} color="amber" />
      </div>

      {/* Score trend */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">Score History</h3>
            <p className="text-sm text-slate-500">ACT composite score over time</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-emerald-600">+4</p>
            <p className="text-xs text-slate-500">improvement since start</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={MOCK_TRENDS}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis domain={[20, 36]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              formatter={(v, n, p) => [v, p.payload?.testTitle ?? n]} />
            <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5, strokeWidth: 2, stroke: '#fff' }} name="Score" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section accuracy */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
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

        {/* Skill radar */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Topic Strengths</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={topicRadar}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="topic" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Topic breakdown */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Topic-by-Topic Analysis</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Topic', 'Section', 'Correct/Total', 'Accuracy', 'Avg Time/Q', 'Strength'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MOCK_ANALYTICS.sections.flatMap((sec) =>
                sec.topicBreakdown.map((tb) => (
                  <tr key={`${sec.sectionId}-${tb.topic}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{tb.topic}</td>
                    <td className="px-4 py-3 text-slate-500">{sec.sectionName}</td>
                    <td className="px-4 py-3 text-slate-700">{tb.correct}/{tb.total}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${tb.accuracy >= 80 ? 'bg-emerald-500' : tb.accuracy >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${tb.accuracy}%` }} />
                        </div>
                        <span className="font-medium text-slate-700">{tb.accuracy.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{tb.avgTimeSpent}s</td>
                    <td className="px-4 py-3">
                      <Badge variant={tb.accuracy >= 80 ? 'success' : tb.accuracy >= 60 ? 'warning' : 'danger'} size="sm">
                        {tb.accuracy >= 80 ? 'Strong' : tb.accuracy >= 60 ? 'Average' : 'Weak'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
