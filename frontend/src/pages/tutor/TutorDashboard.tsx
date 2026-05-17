import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, AlertTriangle, ChevronRight, Target } from 'lucide-react';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { MOCK_STUDENTS, MOCK_ANALYTICS, MOCK_TRENDS } from '../../data/mockData';
import { useAuthStore } from '../../store/useAuthStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';

const weakTopics = MOCK_ANALYTICS.sections
  .flatMap((s) => s.topicBreakdown.map((t) => ({ ...t, section: s.sectionName })))
  .filter((t) => t.accuracy < 75)
  .sort((a, b) => a.accuracy - b.accuracy);

export function TutorDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const myStudents = MOCK_STUDENTS.filter((s) => s.tutorId === user?.id || s.tutorId === 'tutor-1');
  const avgScore = myStudents.reduce((a, s) => a + (s.avgScore || 0), 0) / (myStudents.length || 1);
  const totalTests = myStudents.reduce((a, s) => a + (s.testsAttempted || 0), 0);

  const studentCompareData = myStudents.map((s) => ({
    name: s.name.split(' ')[0],
    score: s.avgScore || 0,
    target: s.targetScore || 36,
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Tutor Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Welcome back, {user?.name?.split(' ')[0]} · {myStudents.length} students
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="My Students" value={myStudents.length} subtitle="enrolled" icon={<Users size={20} />} color="blue" />
        <StatCard title="Avg. Score" value={avgScore.toFixed(1)} subtitle="composite ACT" icon={<TrendingUp size={20} />} color="emerald" trend={{ value: 6, positive: true }} />
        <StatCard title="Tests Taken" value={totalTests} subtitle="all students" icon={<Target size={20} />} color="purple" />
        <StatCard title="Attention" value={weakTopics.length} subtitle="weak topic areas" icon={<AlertTriangle size={20} />} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Score comparison */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Scores vs Targets</h3>
          <p className="text-sm text-slate-500 mb-4">Current average vs target score</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={studentCompareData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 36]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Current" barSize={20} />
              <Bar dataKey="target" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Target" barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Progress trend */}
        <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Class Progress</h3>
          <p className="text-sm text-slate-500 mb-4">Score improvement over time</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={MOCK_TRENDS}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[20, 36]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} name="Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Student cards */}
      <div>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="font-semibold text-slate-900">My Students</h3>
          <button onClick={() => navigate('/my-students')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View all <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {myStudents.map((student) => {
            const gap = (student.targetScore || 36) - (student.avgScore || 0);
            const pct = Math.min(100, ((student.avgScore || 0) / (student.targetScore || 36)) * 100);
            const isOnTrack = pct >= 85;
            const needsWork = pct < 70;

            return (
              <div
                key={student.id}
                onClick={() => navigate(`/student/${student.id}`)}
                className="bg-white rounded-xl border border-slate-100 p-4 md:p-5 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                      {student.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{student.name}</p>
                      <p className="text-xs text-slate-500">{student.testsAttempted ?? 0} tests</p>
                    </div>
                  </div>
                  <Badge variant={isOnTrack ? 'success' : needsWork ? 'danger' : 'warning'} className="flex-shrink-0">
                    {isOnTrack ? 'On Track' : needsWork ? 'Help' : 'Progress'}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Score', value: student.avgScore ?? '—' },
                    { label: 'Target', value: student.targetScore ?? '—' },
                    { label: 'Gap', value: gap > 0 ? `+${gap}` : gap, color: gap > 0 ? 'text-amber-600' : 'text-emerald-600' },
                  ].map((s) => (
                    <div key={s.label} className="text-center bg-slate-50 rounded-lg p-2">
                      <p className={`text-base font-bold ${s.color || 'text-slate-900'}`}>{s.value}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>To target</span><span>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isOnTrack ? 'bg-emerald-500' : needsWork ? 'bg-red-400' : 'bg-amber-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weak areas */}
      {weakTopics.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <h3 className="font-semibold text-slate-900">Areas Needing Attention</h3>
            </div>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {weakTopics.length} topics
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {weakTopics.slice(0, 5).map((topic, i) => (
              <div key={i} className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600 text-xs font-bold flex-shrink-0">
                  {topic.accuracy.toFixed(0)}%
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{topic.topic}</p>
                  <p className="text-xs text-slate-500">{topic.section} · {topic.correct}/{topic.total}</p>
                </div>
                <div className="hidden sm:block w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                  <div className="h-full rounded-full bg-red-400" style={{ width: `${topic.accuracy}%` }} />
                </div>
                <Badge variant="danger" size="sm" className="flex-shrink-0">Weak</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
