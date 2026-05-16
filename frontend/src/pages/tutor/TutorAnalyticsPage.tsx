import { useState } from 'react';
import { TrendingUp, AlertTriangle, Clock, Users } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { MOCK_STUDENTS, MOCK_TUTORS, MOCK_ANALYTICS } from '../../data/mockData';
import { useAuthStore } from '../../store/useAuthStore';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const trendData = [
  { date: 'Oct', 'Alex T.': 22, 'Jamie R.': 20, 'Sam K.': 18 },
  { date: 'Nov', 'Alex T.': 24, 'Jamie R.': 22, 'Sam K.': 21 },
  { date: 'Dec', 'Alex T.': 25, 'Jamie R.': 24, 'Sam K.': 23 },
  { date: 'Jan', 'Alex T.': 27, 'Jamie R.': 25, 'Sam K.': 24 },
  { date: 'Feb', 'Alex T.': 28, 'Jamie R.': 26, 'Sam K.': 26 },
];

const weakAreaData = [
  { topic: 'Trigonometry', students: 4, avgAccuracy: 45 },
  { topic: 'Geometry', students: 3, avgAccuracy: 52 },
  { topic: 'Science Reasoning', students: 3, avgAccuracy: 55 },
  { topic: 'Inference', students: 2, avgAccuracy: 58 },
  { topic: 'Statistics', students: 2, avgAccuracy: 62 },
];

const timeManagementData = MOCK_ANALYTICS.sections.map((s) => ({
  section: s.sectionName,
  allocated: Math.round(s.timeAllocated / 60),
  used: Math.round(s.timeUsed / 60),
  efficiency: Math.round((s.timeUsed / s.timeAllocated) * 100),
}));

export function TutorAnalyticsPage() {
  const { user } = useAuthStore();
  const [selectedStudent, setSelectedStudent] = useState<string>('all');

  const tutor = MOCK_TUTORS.find((t) => t.id === user?.id) ?? MOCK_TUTORS[0];
  const assignedStudents = MOCK_STUDENTS.filter((s) =>
    tutor.assignedStudentIds?.includes(s.id)
  );

  const avgScore = assignedStudents.length
    ? Math.round(assignedStudents.reduce((a, s) => a + (s.avgScore ?? 0), 0) / assignedStudents.length)
    : 0;
  const totalTests = assignedStudents.reduce((a, s) => a + (s.testsAttempted ?? 0), 0);
  const onTrackCount = assignedStudents.filter(
    (s) => (s.avgScore ?? 0) >= (s.targetScore ?? 36) * 0.85
  ).length;

  const topicRadarData = MOCK_ANALYTICS.sections.flatMap((s) =>
    s.topicBreakdown.map((tb) => ({ topic: tb.topic, accuracy: tb.accuracy }))
  ).slice(0, 7);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">Performance insights for your {assignedStudents.length} students</p>
        </div>
        <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Students</option>
          {assignedStudents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="My Students" value={assignedStudents.length} subtitle="assigned to you" icon={<Users size={20} />} color="blue" />
        <StatCard title="Avg Score" value={avgScore || '—'} subtitle="across all students" icon={<TrendingUp size={20} />} color="emerald" trend={{ value: 3, positive: true }} />
        <StatCard title="Tests Completed" value={totalTests} subtitle="all time" icon={<Clock size={20} />} color="purple" />
        <StatCard title="On Track" value={`${onTrackCount}/${assignedStudents.length}`} subtitle="≥85% of target" icon={<AlertTriangle size={20} />} color="amber" />
      </div>

      {/* Score trends */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
        <h3 className="font-semibold text-slate-900 mb-1">Score Trends</h3>
        <p className="text-sm text-slate-500 mb-4">Monthly score progression per student</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis domain={[15, 36]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {assignedStudents.slice(0, 3).map((s, i) => (
              <Line key={s.id} type="monotone" dataKey={s.name.split(' ').map((n, j) => j === 0 ? n : n.charAt(0) + '.').join(' ')}
                stroke={COLORS[i]} strokeWidth={2} dot={{ r: 3, fill: COLORS[i] }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Weak areas */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Common Weak Areas</h3>
          <p className="text-sm text-slate-500 mb-4">Topics where most students struggle</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weakAreaData} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="topic" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                formatter={(v) => [`${v}%`, 'Avg Accuracy']} />
              <Bar dataKey="avgAccuracy" radius={[0, 4, 4, 0]} name="Avg Accuracy %">
                {weakAreaData.map((_, i) => (
                  <Cell key={i} fill={weakAreaData[i].avgAccuracy < 55 ? '#ef4444' : weakAreaData[i].avgAccuracy < 65 ? '#f59e0b' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Skill radar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Skill Profile</h3>
          <p className="text-sm text-slate-500 mb-4">Average topic proficiency across students</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={topicRadarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="topic" tick={{ fontSize: 9, fill: '#94a3b8' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Avg Accuracy" dataKey="accuracy" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time management */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
        <h3 className="font-semibold text-slate-900 mb-1">Time Management Patterns</h3>
        <p className="text-sm text-slate-500 mb-4">Allocated vs used time per section</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={timeManagementData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="section" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              formatter={(v) => [`${v} min`]} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="allocated" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Allocated (min)" barSize={22} />
            <Bar dataKey="used" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Used (min)" barSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-student table */}
      <Card padding="none">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 text-sm">Student Performance Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Student', 'Grade', 'Tests', 'Avg Score', 'Target', 'Gap', 'Trend', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {assignedStudents.map((s, i) => {
                const gap = (s.targetScore ?? 36) - (s.avgScore ?? 0);
                const onTrack = gap <= 3;
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-900">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.grade ? `${s.grade}` : '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{s.testsAttempted ?? 0}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{s.avgScore ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{s.targetScore ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${gap > 5 ? 'text-red-600' : gap > 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {gap > 0 ? `−${gap}` : '+' + Math.abs(gap)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${i % 2 === 0 ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {i % 2 === 0 ? '↑ Improving' : '→ Steady'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={onTrack ? 'success' : gap > 5 ? 'danger' : 'warning'} size="sm">
                        {onTrack ? 'On Track' : gap > 5 ? 'At Risk' : 'Monitor'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
