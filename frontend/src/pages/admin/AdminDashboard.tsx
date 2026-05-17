import { useState, useEffect } from 'react';
import { FileText, Plus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button'; // used for New Test button
import { api, type DbUser } from '../../lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';

interface DbTest {
  id: string;
  title: string;
  status: string;
  sections: { _count?: { questions: number } }[];
}

export function AdminDashboard() {
  const [tests, setTests] = useState<DbTest[]>([]);
  const [students, setStudents] = useState<DbUser[]>([]);
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [activityData, setActivityData] = useState<{ date: string; attempts: number; completions: number }[]>([]);
  const [scoreDistData, setScoreDistData] = useState<{ range: string; count: number }[]>([]);

  useEffect(() => {
    api.getAllTests().then((r) => setTests((r.tests as DbTest[]) ?? [])).catch(() => {});
    api.getUsersByRole('STUDENT').then((r) => setStudents(r.users ?? [])).catch(() => {});
    api.getUsersByRole('TUTOR').then((r) => setTutors(r.users ?? [])).catch(() => {});
    api.getPlatformAnalytics()
      .then((r) => { setActivityData(r.activityData); setScoreDistData(r.scoreDistribution); })
      .catch(() => {});
  }, []);

  const publishedTests = tests.filter((t) => t.status === 'PUBLISHED');
  const draftTests = tests.filter((t) => t.status === 'DRAFT');

  const avgScore = students.length
    ? (students.reduce((a, s) => a + (s.avgScore ?? 0), 0) / students.filter(s => s.avgScore != null).length || 0)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Platform overview</p>
        </div>
        <div className="flex gap-2">
          <Link to="/test-builder">
            <Button size="sm" icon={<Plus size={14} />}>New Test</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Students" value={students.length} subtitle={`${tutors.length} tutors`} trend={{ value: 12, positive: true }} />
        <StatCard title="Active Tests" value={publishedTests.length} subtitle={`${draftTests.length} drafts`} />
        <StatCard
          title="Avg Score"
          value={avgScore > 0 ? avgScore.toFixed(1) : '—'}
          subtitle="out of 36"
          trend={{ value: 8, positive: true }}
        />
        <StatCard title="Total Tests" value={tests.length} subtitle="in platform" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium text-slate-900 text-sm">Test Activity</p>
              <p className="text-xs text-slate-400">Attempts vs completions (last 7 days)</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={activityData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gAttempts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gComplete" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }} />
              <Area type="monotone" dataKey="attempts" stroke="#3b82f6" strokeWidth={1.5} fill="url(#gAttempts)" name="Attempts" />
              <Area type="monotone" dataKey="completions" stroke="#10b981" strokeWidth={1.5} fill="url(#gComplete)" name="Completions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="font-medium text-slate-900 text-sm mb-1">Score Distribution</p>
          <p className="text-xs text-slate-400 mb-4">ACT composite</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={scoreDistData} barSize={20} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Students" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent tests */}
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
            <p className="font-medium text-slate-900 text-sm">Recent Tests</p>
            <Link to="/tests" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {tests.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">No tests yet. Create one!</p>
            ) : (
              tests.slice(0, 4).map((test) => (
                <div key={test.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                    <FileText size={13} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{test.title}</p>
                    <p className="text-xs text-slate-400">{test.sections.length} sections</p>
                  </div>
                  <Badge
                    variant={test.status === 'PUBLISHED' ? 'success' : test.status === 'DRAFT' ? 'warning' : 'default'}
                    size="sm"
                  >
                    {test.status.toLowerCase()}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tutors overview */}
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
            <p className="font-medium text-slate-900 text-sm">Tutors</p>
            <Link to="/tutors" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              Manage <ArrowRight size={12} />
            </Link>
          </div>
          {tutors.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">No tutors yet. Add one!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-50">
              {tutors.slice(0, 2).map((tutor) => (
                <div key={tutor.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-semibold text-sm flex-shrink-0">
                    {tutor.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{tutor.name}</p>
                    <p className="text-xs text-slate-400">{tutor.studentCount ?? 0} students</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {tutor.avgScore != null ? tutor.avgScore.toFixed(1) : '—'}
                    </p>
                    <p className="text-xs text-slate-400">avg score</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
