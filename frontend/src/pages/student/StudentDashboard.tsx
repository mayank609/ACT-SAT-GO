import { useNavigate } from 'react-router-dom';
import { BookOpen, TrendingUp, Clock, Target, ChevronRight, Play, CheckCircle } from 'lucide-react';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { MOCK_TESTS, MOCK_ATTEMPTS, MOCK_TRENDS, MOCK_ANALYTICS } from '../../data/mockData';
import { useAuthStore } from '../../store/useAuthStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

export function StudentDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const assignedTests = MOCK_TESTS.filter((t) => t.assignedStudentIds?.includes(user?.id ?? 's-1'));
  const completed = MOCK_ATTEMPTS.filter((a) => a.studentId === (user?.id ?? 's-1') && a.status === 'completed');
  const avgScore = completed.reduce((a, att) => a + (att.score ?? 0), 0) / (completed.length || 1);

  const sectionBars = MOCK_ANALYTICS.sections.map((s) => ({
    name: s.sectionName,
    accuracy: s.accuracy,
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-4 md:p-6 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-bold">
              Welcome back, {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-blue-200 mt-1 text-xs md:text-sm">
              {assignedTests.length} tests assigned · {completed.length} completed
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-blue-200 text-xs">Target Score</p>
            <p className="text-2xl md:text-3xl font-bold">32</p>
            <p className="text-blue-300 text-xs">ACT composite</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-blue-200 mb-1.5">
            <span>Progress to target (28/32)</span>
            <span>87.5%</span>
          </div>
          <div className="h-2 bg-blue-900/50 rounded-full overflow-hidden">
            <div className="h-full bg-white/70 rounded-full" style={{ width: '87.5%' }} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="Current Score" value={avgScore.toFixed(0) || '—'} subtitle="ACT composite" icon={<TrendingUp size={18} />} color="blue" trend={{ value: 4, positive: true }} />
        <StatCard title="Completed" value={completed.length} subtitle="out of assigned" icon={<CheckCircle size={18} />} color="emerald" />
        <StatCard title="Accuracy" value={`${MOCK_ANALYTICS.overallAccuracy}%`} subtitle="last test" icon={<Target size={18} />} color="purple" trend={{ value: 5, positive: true }} />
        <StatCard title="Percentile" value="72nd" subtitle="national ranking" icon={<Clock size={18} />} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Score trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 md:p-6">
          <h3 className="font-semibold text-slate-900 mb-1">My Score History</h3>
          <p className="text-sm text-slate-500 mb-4">Track your improvement over time</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={MOCK_TRENDS}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[20, 36]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} name="Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Section accuracy */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Section Accuracy</h3>
          <p className="text-sm text-slate-500 mb-4">Last test performance</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sectionBars} layout="vertical" barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Bar dataKey="accuracy" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Accuracy %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Assigned tests */}
      <div>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="font-semibold text-slate-900">Assigned Tests</h3>
          <button onClick={() => navigate('/my-tests')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View all <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {assignedTests.map((test) => {
            const attempt = MOCK_ATTEMPTS.find((a) => a.testId === test.id && a.studentId === (user?.id ?? 's-1'));
            const isCompleted = attempt?.status === 'completed';
            const inProgress = attempt?.status === 'in_progress';
            const totalTime = test.sections.reduce((a, s) => a + s.timeLimit, 0);

            return (
              <div key={test.id} className="bg-white rounded-xl border border-slate-200 p-4 md:p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={16} className="text-blue-600" />
                  </div>
                  <Badge variant={isCompleted ? 'success' : inProgress ? 'warning' : 'info'}>
                    {isCompleted ? 'Completed' : inProgress ? 'In Progress' : 'Not Started'}
                  </Badge>
                </div>
                <h4 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-2">{test.title}</h4>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                  <span>{test.sections.length} sections</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><Clock size={10} /> {totalTime}m</span>
                </div>
                {isCompleted ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-xl">{attempt?.score}</span>
                      <span className="text-slate-400 text-xs">/36</span>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/test-review/${attempt?.id}`)}>
                      Review
                    </Button>
                  </div>
                ) : (
                  <Button variant="primary" size="sm" icon={<Play size={13} />} className="w-full justify-center"
                    onClick={() => navigate(`/test-instructions/${test.id}`)}>
                    {inProgress ? 'Continue' : 'Start Test'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Weak areas */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-5">
        <h3 className="font-semibold text-amber-900 mb-3">📌 Focus Areas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {MOCK_ANALYTICS.sections.flatMap((s) => s.topicBreakdown.filter((t) => t.accuracy < 70)).slice(0, 4).map((t) => (
            <div key={t.topic} className="bg-white rounded-xl p-3 border border-amber-200">
              <p className="text-sm font-medium text-slate-900">{t.topic}</p>
              <p className="text-xs text-slate-500 mb-1.5">Accuracy: {t.accuracy.toFixed(0)}%</p>
              <div className="h-1.5 bg-red-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-400 rounded-full" style={{ width: `${t.accuracy}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
