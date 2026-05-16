import { Users, FileText, TrendingUp, Clock, Plus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { MOCK_TESTS, MOCK_STUDENTS, MOCK_TUTORS } from '../../data/mockData';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

const activityData = [
  { date: 'Mon', attempts: 12, completions: 10 },
  { date: 'Tue', attempts: 18, completions: 15 },
  { date: 'Wed', attempts: 24, completions: 20 },
  { date: 'Thu', attempts: 16, completions: 14 },
  { date: 'Fri', attempts: 28, completions: 25 },
  { date: 'Sat', attempts: 32, completions: 28 },
  { date: 'Sun', attempts: 20, completions: 18 },
];

const scoreDistData = [
  { range: '1–10', count: 2 },
  { range: '11–15', count: 5 },
  { range: '16–20', count: 12 },
  { range: '21–25', count: 18 },
  { range: '26–30', count: 22 },
  { range: '31–36', count: 8 },
];

export function AdminDashboard() {
  const publishedTests = MOCK_TESTS.filter((t) => t.status === 'published');
  const draftTests = MOCK_TESTS.filter((t) => t.status === 'draft');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Overview of platform activity and performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">Export Report</Button>
          <Link to="/test-builder">
            <Button size="sm" icon={<Plus size={15} />}>New Test</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={MOCK_STUDENTS.length}
          subtitle="+3 this week"
          icon={<Users size={20} />}
          color="blue"
          trend={{ value: 12, positive: true }}
        />
        <StatCard
          title="Active Tests"
          value={publishedTests.length}
          subtitle={`${draftTests.length} drafts pending`}
          icon={<FileText size={20} />}
          color="emerald"
        />
        <StatCard
          title="Avg. Score (ACT)"
          value="27.4"
          subtitle="Out of 36"
          icon={<TrendingUp size={20} />}
          color="purple"
          trend={{ value: 8, positive: true }}
        />
        <StatCard
          title="Avg. Completion"
          value="87%"
          subtitle="Tests completed fully"
          icon={<Clock size={20} />}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Test Activity</h3>
              <p className="text-sm text-slate-500">Attempts vs completions this week</p>
            </div>
            <select className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 3 months</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={activityData}>
              <defs>
                <linearGradient id="colorAttempts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorComplete" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Area type="monotone" dataKey="attempts" stroke="#3b82f6" strokeWidth={2} fill="url(#colorAttempts)" name="Attempts" />
              <Area type="monotone" dataKey="completions" stroke="#10b981" strokeWidth={2} fill="url(#colorComplete)" name="Completions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Score distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Score Distribution</h3>
          <p className="text-sm text-slate-500 mb-4">ACT composite scores</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreDistData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Students" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent tests */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Recent Tests</h3>
            <Link to="/tests" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {MOCK_TESTS.slice(0, 4).map((test) => (
              <div key={test.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <FileText size={16} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{test.title}</p>
                  <p className="text-xs text-slate-500">
                    {test.sections.length} sections · {test.sections.reduce((a, s) => a + s.questions.length, 0)} questions
                  </p>
                </div>
                <Badge variant={test.status === 'published' ? 'success' : test.status === 'draft' ? 'warning' : 'default'}>
                  {test.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts / Issues */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Alerts & Activity</h3>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">3 new</span>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { icon: '⚠️', title: 'Tab switching detected', desc: 'Alex Thompson switched tabs 3 times during SAT Practice #1', time: '12m ago', type: 'warning' },
              { icon: '✅', title: 'Test completed', desc: 'Morgan Davis completed ACT Full Practice Test #1', time: '1h ago', type: 'success' },
              { icon: '🔔', title: 'New student registered', desc: 'Taylor Brown joined and was assigned to Tutor Rodriguez', time: '2h ago', type: 'info' },
              { icon: '📊', title: 'Report generated', desc: 'Monthly analytics report for February is ready', time: '3h ago', type: 'default' },
            ].map((alert, i) => (
              <div key={i} className="flex items-start gap-3 px-6 py-3.5 hover:bg-slate-50 cursor-pointer">
                <span className="text-lg mt-0.5">{alert.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{alert.desc}</p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{alert.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tutor summary */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Tutor Overview</h3>
          <Link to="/students" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            Manage students <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {MOCK_TUTORS.map((tutor) => {
            const students = MOCK_STUDENTS.filter((s) => s.tutorId === tutor.id);
            const avgScore = students.reduce((a, s) => a + (s.avgScore || 0), 0) / (students.length || 1);
            return (
              <div key={tutor.id} className="px-6 py-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                    {tutor.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{tutor.name}</p>
                    <p className="text-xs text-slate-500">{students.length} assigned students</p>
                  </div>
                  <Badge variant="success" className="ml-auto">Active</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-slate-900">{students.length}</p>
                    <p className="text-xs text-slate-500">Students</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-slate-900">{avgScore.toFixed(0)}</p>
                    <p className="text-xs text-slate-500">Avg Score</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-slate-900">
                      {students.reduce((a, s) => a + (s.testsAttempted || 0), 0)}
                    </p>
                    <p className="text-xs text-slate-500">Tests Done</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
