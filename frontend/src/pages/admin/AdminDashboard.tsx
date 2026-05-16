import { FileText, Plus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { MOCK_TESTS, MOCK_STUDENTS, MOCK_TUTORS } from '../../data/mockData';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
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
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Platform overview</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm">Export</Button>
          <Link to="/test-builder">
            <Button size="sm" icon={<Plus size={14} />}>New Test</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Students" value={MOCK_STUDENTS.length} subtitle="+3 this week" trend={{ value: 12, positive: true }} />
        <StatCard title="Active Tests" value={publishedTests.length} subtitle={`${draftTests.length} drafts`} />
        <StatCard title="Avg Score" value="27.4" subtitle="out of 36" trend={{ value: 8, positive: true }} />
        <StatCard title="Completion" value="87%" subtitle="tests finished" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium text-slate-900 text-sm">Test Activity</p>
              <p className="text-xs text-slate-400">Attempts vs completions</p>
            </div>
            <select className="text-xs border border-slate-100 rounded-lg px-2 py-1.5 text-slate-500 focus:outline-none bg-white">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
            </select>
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
            {MOCK_TESTS.slice(0, 4).map((test) => (
              <div key={test.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                  <FileText size={13} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 truncate">{test.title}</p>
                  <p className="text-xs text-slate-400">{test.sections.length} sections · {test.sections.reduce((a, s) => a + s.questions.length, 0)}q</p>
                </div>
                <Badge variant={test.status === 'published' ? 'success' : test.status === 'draft' ? 'warning' : 'default'} size="sm">
                  {test.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
            <p className="font-medium text-slate-900 text-sm">Activity</p>
            <span className="text-xs text-red-500 font-medium">3 new</span>
          </div>
          <div className="divide-y divide-slate-50">
            {[
              { label: 'Tab switching detected', sub: 'Alex Thompson · 3 switches', time: '12m', type: 'warn' },
              { label: 'Test completed', sub: 'Morgan Davis · ACT Full #1', time: '1h', type: 'ok' },
              { label: 'New student', sub: 'Taylor Brown · assigned to Rodriguez', time: '2h', type: 'info' },
              { label: 'Report ready', sub: 'Monthly analytics · February', time: '3h', type: 'info' },
            ].map((a, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${a.type === 'warn' ? 'bg-red-400' : a.type === 'ok' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800">{a.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{a.sub}</p>
                </div>
                <span className="text-xs text-slate-300 whitespace-nowrap">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tutor overview */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="font-medium text-slate-900 text-sm">Tutors</p>
          <Link to="/tutors" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            Manage <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-50">
          {MOCK_TUTORS.map((tutor) => {
            const students = MOCK_STUDENTS.filter((s) => s.tutorId === tutor.id);
            const avg = students.reduce((a, s) => a + (s.avgScore || 0), 0) / (students.length || 1);
            return (
              <div key={tutor.id} className="px-5 py-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-semibold text-sm flex-shrink-0">
                  {tutor.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{tutor.name}</p>
                  <p className="text-xs text-slate-400">{students.length} students</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-900">{avg.toFixed(1)}</p>
                  <p className="text-xs text-slate-400">avg score</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-900">{students.reduce((a, s) => a + (s.testsAttempted || 0), 0)}</p>
                  <p className="text-xs text-slate-400">tests</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
