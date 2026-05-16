import { useState } from 'react';
import { Download, Filter, BarChart3, TrendingUp, Users, FileText } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card, StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { MOCK_STUDENTS, MOCK_TESTS, MOCK_ATTEMPTS, MOCK_ANALYTICS } from '../../data/mockData';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';

const sectionComparisonData = MOCK_ANALYTICS.sections.map((s) => ({
  name: s.sectionName,
  accuracy: s.accuracy,
  timeUsed: Math.round(s.timeUsed / 60),
  timeAlloc: Math.round(s.timeAllocated / 60),
}));

const topicRadarData = [
  { topic: 'Algebra', score: 87 },
  { topic: 'Grammar', score: 82 },
  { topic: 'Reading', score: 77 },
  { topic: 'Science', score: 73 },
  { topic: 'Geometry', score: 65 },
  { topic: 'Trig', score: 60 },
];

const trendData = [
  { month: 'Oct', actScore: 24, satScore: null },
  { month: 'Nov', actScore: 25, satScore: 1150 },
  { month: 'Dec', actScore: 26, satScore: 1200 },
  { month: 'Jan', actScore: 27, satScore: 1250 },
  { month: 'Feb', actScore: 28, satScore: 1300 },
];

export function ReportsPage() {
  const [selectedStudent, setSelectedStudent] = useState(MOCK_STUDENTS[0].id);
  const [selectedTest, setSelectedTest] = useState(MOCK_TESTS[0].id);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Analytics & Reports</h1>
          <p className="text-slate-500 text-sm mt-0.5">Detailed performance analysis and insights</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Filter size={14} />}>Filters</Button>
          <Button variant="secondary" size="sm" icon={<Download size={14} />}>PDF</Button>
          <Button size="sm" icon={<Download size={14} />}>Excel</Button>
        </div>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Student</label>
            <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-44">
              {MOCK_STUDENTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Test</label>
            <select value={selectedTest} onChange={(e) => setSelectedTest(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-52">
              {MOCK_TESTS.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Date Range</label>
            <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Last 3 months</option>
              <option>Last 6 months</option>
              <option>All time</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Composite Score" value={`${MOCK_ANALYTICS.totalScore}/36`} subtitle={`${MOCK_ANALYTICS.percentile}th percentile`} icon={<BarChart3 size={20} />} color="blue" trend={{ value: 7, positive: true }} />
        <StatCard title="Accuracy" value={`${MOCK_ANALYTICS.overallAccuracy}%`} subtitle="All sections" icon={<TrendingUp size={20} />} color="emerald" trend={{ value: 5, positive: true }} />
        <StatCard title="Time Used" value={`${Math.round((MOCK_ANALYTICS.totalTimeUsed / MOCK_ANALYTICS.totalTimeAllocated) * 100)}%`} subtitle={`${Math.round(MOCK_ANALYTICS.totalTimeUsed / 60)}/${Math.round(MOCK_ANALYTICS.totalTimeAllocated / 60)} min`} icon={<FileText size={20} />} color="purple" />
        <StatCard title="Tests Done" value={MOCK_ATTEMPTS.length} subtitle="in period" icon={<Users size={20} />} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Section accuracy */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 md:p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Section Performance</h3>
          <p className="text-sm text-slate-500 mb-4">Accuracy % and time usage per section</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sectionComparisonData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Accuracy %" barSize={22} />
              <Bar dataKey="timeUsed" fill="#10b981" radius={[4, 4, 0, 0]} name="Time (min)" barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Topic radar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Topic Proficiency</h3>
          <p className="text-sm text-slate-500 mb-4">Strength across key topics</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={topicRadarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="topic" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#cbd5e1' }} />
              <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Score trend */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">Score Trend</h3>
            <p className="text-sm text-slate-500">Progress over time</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="info">ACT</Badge>
            <Badge variant="purple">SAT</Badge>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="act" domain={[20, 36]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="sat" orientation="right" domain={[1000, 1600]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line yAxisId="act" type="monotone" dataKey="actScore" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} name="ACT Score" />
            <Line yAxisId="sat" type="monotone" dataKey="satScore" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: '#8b5cf6', r: 4 }} name="SAT Score" connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Topic breakdown table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 md:px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Topic-Level Breakdown</h3>
          <p className="text-sm text-slate-500">Accuracy and timing per topic</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Topic', 'Section', 'Correct/Total', 'Accuracy', 'Avg Time', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MOCK_ANALYTICS.sections.flatMap((sec) =>
                sec.topicBreakdown.map((tb) => (
                  <tr key={`${sec.sectionId}-${tb.topic}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{tb.topic}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{sec.sectionName}</td>
                    <td className="px-4 py-3 text-slate-700">{tb.correct}/{tb.total}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                          <div className={`h-full rounded-full ${tb.accuracy >= 80 ? 'bg-emerald-500' : tb.accuracy >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${tb.accuracy}%` }} />
                        </div>
                        <span className="font-medium text-slate-700 whitespace-nowrap">{tb.accuracy.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{tb.avgTimeSpent}s</td>
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
