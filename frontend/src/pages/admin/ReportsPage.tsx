import { useState, useEffect } from 'react';
import { Download, BarChart3, TrendingUp, Users, FileText, BookOpen } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card, StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { api } from '../../lib/api';
import type { DbUser } from '../../lib/api';
import { exportToCsv } from '../../utils/exportCsv';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';

type Analytics = Awaited<ReturnType<typeof api.getStudentAnalytics>>;

export function ReportsPage() {
  const [students, setStudents] = useState<DbUser[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    api.getUsersByRole('STUDENT')
      .then((r) => {
        setStudents(r.users);
        if (r.users.length > 0) setSelectedStudentId(r.users[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, []);

  useEffect(() => {
    if (!selectedStudentId) return;
    setLoadingAnalytics(true);
    setAnalytics(null);
    api.getStudentAnalytics(selectedStudentId)
      .then((r) => setAnalytics(r))
      .catch(() => setAnalytics(null))
      .finally(() => setLoadingAnalytics(false));
  }, [selectedStudentId]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const sectionChartData = analytics?.sectionStats.map((s) => ({
    name: s.sectionName.length > 12 ? s.sectionName.slice(0, 12) + '…' : s.sectionName,
    accuracy: Math.round(s.accuracy),
    timeUsed: Math.round(s.timeUsed / 60),
    timeAlloc: Math.round(s.timeAllocated / 60),
  })) ?? [];

  const trendData = analytics?.trend.map((t) => ({
    date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: t.totalScore ?? 0,
    title: t.testTitle,
  })) ?? [];

  const handleExportAnalytics = () => {
    if (!analytics || !selectedStudent) return;
    const rows = analytics.sectionStats.map((s) => ({
      Student: selectedStudent.name,
      Section: s.sectionName,
      'Correct': s.correct,
      'Total': s.totalQuestions,
      'Accuracy (%)': s.accuracy.toFixed(1),
      'Time Used (min)': Math.round(s.timeUsed / 60),
      'Time Allocated (min)': Math.round(s.timeAllocated / 60),
    }));
    exportToCsv(rows, `analytics_${selectedStudent.name.replace(/\s/g, '_')}.csv`);
  };

  const handleExportStudents = async () => {
    try {
      const r = await api.getUsersByRole('STUDENT');
      const rows = r.users.map((s) => ({
        Name: s.name,
        Email: s.email,
        Grade: s.grade ?? '',
        'Avg Score': s.avgScore ?? '',
        'Target Score': s.targetScore ?? '',
        'Tests Attempted': s.testsAttempted ?? 0,
        'Last Active': s.lastActive ?? '',
        Tutor: s.tutorName ?? '',
      }));
      exportToCsv(rows, 'students_summary.csv');
    } catch {}
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Analytics & Reports</h1>
          <p className="text-slate-500 text-sm mt-0.5">Detailed performance analysis and insights</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExportStudents}>Students CSV</Button>
          <Button size="sm" icon={<Download size={14} />} onClick={handleExportAnalytics} disabled={!analytics}>Export CSV</Button>
        </div>
      </div>

      {/* Student selector */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Student</label>
            {loadingStudents ? (
              <div className="px-3 py-2 text-sm text-slate-400 border border-slate-200 rounded-lg w-48">Loading…</div>
            ) : (
              <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-52">
                {students.length === 0 && <option value="">No students found</option>}
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
          {selectedStudent && (
            <div className="flex items-center gap-3 py-1">
              {selectedStudent.grade && <span className="text-xs text-slate-500">Grade {selectedStudent.grade}</span>}
              {selectedStudent.targetScore && <span className="text-xs text-slate-500">Target: {selectedStudent.targetScore}</span>}
              {selectedStudent.tutorName && <span className="text-xs text-slate-500">Tutor: {selectedStudent.tutorName}</span>}
            </div>
          )}
        </div>
      </Card>

      {/* No attempts */}
      {!loadingAnalytics && analytics && analytics.totalAttempts === 0 && (
        <div className="text-center py-12 bg-white border border-slate-100 rounded-xl text-slate-400">
          <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">No submitted attempts</p>
          <p className="text-xs mt-1">{selectedStudent?.name} hasn't completed any tests yet</p>
        </div>
      )}

      {/* Stats */}
      {analytics && analytics.totalAttempts > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatCard title="Latest Score" value={analytics.latestScore ?? '—'} subtitle="most recent attempt" icon={<BarChart3 size={20} />} color="blue" />
            <StatCard title="Avg Score" value={analytics.avgScore ?? '—'} subtitle="all attempts" icon={<TrendingUp size={20} />} color="emerald" trend={{ value: 0, positive: true }} />
            <StatCard title="Accuracy" value={`${analytics.overallAccuracy}%`} subtitle="latest attempt" icon={<FileText size={20} />} color="purple" />
            <StatCard title="Total Attempts" value={analytics.totalAttempts} subtitle="submitted" icon={<Users size={20} />} color="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Section performance */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
              <h3 className="font-semibold text-slate-900 mb-1">Section Performance</h3>
              <p className="text-sm text-slate-500 mb-4">Accuracy % and time used per section (latest attempt)</p>
              {sectionChartData.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No section data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sectionChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Accuracy %" barSize={22} />
                    <Bar dataKey="timeUsed" fill="#10b981" radius={[4, 4, 0, 0]} name="Time Used (min)" barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Score trend */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Score Trend</h3>
                  <p className="text-sm text-slate-500">Progress across all attempts</p>
                </div>
                <Badge variant="info">Raw Score</Badge>
              </div>
              {trendData.length < 2 ? (
                <p className="text-sm text-slate-400 text-center py-8">Need at least 2 attempts to show trend</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                      formatter={(val, _, props) => [val, props.payload?.title ?? 'Score']}
                    />
                    <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} name="Score" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Section breakdown table */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-4 md:px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Section Breakdown</h3>
              <p className="text-sm text-slate-500">Performance details per section (latest attempt)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Section', 'Correct / Total', 'Accuracy', 'Time Used', 'Time Allocated', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {analytics.sectionStats.map((s) => (
                    <tr key={s.sectionId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{s.sectionName}</td>
                      <td className="px-4 py-3 text-slate-700">{s.correct} / {s.totalQuestions}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                            <div className={`h-full rounded-full ${s.accuracy >= 80 ? 'bg-emerald-500' : s.accuracy >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${s.accuracy}%` }} />
                          </div>
                          <span className="font-medium text-slate-700">{Math.round(s.accuracy)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{Math.round(s.timeUsed / 60)} min</td>
                      <td className="px-4 py-3 text-slate-500">{Math.round(s.timeAllocated / 60)} min</td>
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
        </>
      )}

      {loadingAnalytics && (
        <div className="text-center py-12 text-slate-400">
          <BarChart3 size={32} className="mx-auto mb-2 opacity-30 animate-pulse" />
          <p className="text-sm">Loading analytics…</p>
        </div>
      )}
    </div>
  );
}
