import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, AlertTriangle, ChevronRight, Target } from 'lucide-react';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { api, type DbUser } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

export function TutorDashboard() {
  const { user, dbId } = useAuthStore();
  const navigate = useNavigate();
  const [myStudents, setMyStudents] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbId) return;
    api.getTutorAssignments({ tutorId: dbId })
      .then((r) => setMyStudents(r.assignments.map((a) => a.student as DbUser)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dbId]);

  const avgScore = myStudents.length
    ? myStudents.reduce((a, s) => a + (s.avgScore ?? 0), 0) / myStudents.length
    : 0;
  const totalTests = myStudents.reduce((a, s) => a + (s.testsAttempted ?? 0), 0);

  const studentCompareData = myStudents.map((s) => ({
    name: s.name.split(' ')[0],
    score: s.avgScore ?? 0,
    target: (s.targetScore as number | null) ?? 32,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-sm">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Tutor Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Welcome back, {user?.name?.split(' ')[0]} · {myStudents.length} students
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard title="My Students" value={myStudents.length} subtitle="enrolled" icon={<Users size={20} />} color="blue" />
        <StatCard title="Avg. Score" value={avgScore > 0 ? avgScore.toFixed(1) : '—'} subtitle="composite" icon={<TrendingUp size={20} />} color="emerald" />
        <StatCard title="Tests Taken" value={totalTests} subtitle="all students" icon={<Target size={20} />} color="purple" />
        <StatCard title="Need Help" value={myStudents.filter(s => {
          const pct = ((s.avgScore ?? 0) / ((s.targetScore as number | null) ?? 32)) * 100;
          return pct < 70;
        }).length} subtitle="below target" icon={<AlertTriangle size={20} />} color="amber" />
      </div>

      {myStudents.length > 0 && (
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
      )}

      <div>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="font-semibold text-slate-900">My Students</h3>
          <button onClick={() => navigate('/my-students')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View all <ChevronRight size={14} />
          </button>
        </div>

        {myStudents.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-8 text-center">
            <p className="text-slate-400 text-sm">No students assigned yet.</p>
            <p className="text-slate-400 text-xs mt-1">Ask an admin to assign students to you.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {myStudents.slice(0, 4).map((student) => {
              const target = (student.targetScore as number | null) ?? 32;
              const gap = target - (student.avgScore ?? 0);
              const pct = Math.min(100, ((student.avgScore ?? 0) / target) * 100);
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
                        {student.name.charAt(0).toUpperCase()}
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
                      { label: 'Target', value: target },
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
        )}
      </div>
    </div>
  );
}
