import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import { AssignedTestsSection } from '../../components/dashboard/AssignedTestsSection';
import { MOCK_TRENDS } from '../../data/mockData';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const weakAreas = [
  { topic: 'Trigonometry', accuracy: 48, section: 'Math' },
  { topic: 'Geometry', accuracy: 55, section: 'Math' },
  { topic: 'Inference', accuracy: 61, section: 'Reading' },
  { topic: 'Data Analysis', accuracy: 63, section: 'Science' },
];

interface ApiAttempt {
  id: string;
  testId: string;
  status: string;
  totalScore?: number;
  completedAt?: string;
  test?: { id: string; title: string; description?: string; sections: Array<{ id: string; name: string; durationMinutes: number; _count?: { questions: number } }> };
}

export function StudentDashboard() {
  const { user, dbId } = useAuthStore();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const [attempts, setAttempts] = useState<ApiAttempt[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const studentId = dbId;
        if (studentId) {
          const [attData] = await Promise.all([
            api.getStudentAttempts(studentId),
          ]);
          setAttempts(attData.attempts as ApiAttempt[]);
        }
      } catch {
        // keep empty — page still renders with mock trend chart
      }
    }
    load();
  }, [dbId]);

  const completedAttempts = attempts.filter((a) => a.status === 'SUBMITTED');
  const latestScore = completedAttempts[0]?.totalScore ?? null;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Good morning, {firstName}</h1>
        <p className="text-slate-400 text-sm mt-0.5">Here's where you stand today</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card padding="sm">
          <p className="text-xs text-slate-400 mb-1">Latest Score</p>
          <p className="text-2xl font-semibold text-slate-900">{latestScore ?? '—'}<span className="text-sm font-normal text-slate-400">/36</span></p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-slate-400 mb-1">Tests Done</p>
          <p className="text-2xl font-semibold text-slate-900">{completedAttempts.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-slate-400 mb-1">In Progress</p>
          <p className="text-2xl font-semibold text-slate-900">{attempts.filter((a) => a.status === 'IN_PROGRESS').length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-slate-400 mb-1">Accuracy</p>
          <p className="text-2xl font-semibold text-slate-900">—<span className="text-sm font-normal text-slate-400">%</span></p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Score trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium text-slate-900 text-sm">Score Trend</p>
              <p className="text-xs text-slate-400 mt-0.5">Your last {MOCK_TRENDS.length} tests</p>
            </div>
            <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
              <TrendingUp size={12} />
              <span>+{MOCK_TRENDS[MOCK_TRENDS.length - 1].score - MOCK_TRENDS[0].score} pts</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={MOCK_TRENDS} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
              <YAxis domain={[20, 36]} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }} />
              <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} fill="url(#scoreGrad)" name="Score" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Weak areas */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="font-medium text-slate-900 text-sm mb-3">Focus Areas</p>
          <div className="space-y-2.5">
            {weakAreas.map((w) => (
              <div key={w.topic}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700">{w.topic}</span>
                  <span className={`text-xs font-medium ${w.accuracy < 55 ? 'text-red-500' : w.accuracy < 65 ? 'text-amber-500' : 'text-slate-500'}`}>{w.accuracy}%</span>
                </div>
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${w.accuracy < 55 ? 'bg-red-400' : w.accuracy < 65 ? 'bg-amber-400' : 'bg-blue-400'}`} style={{ width: `${w.accuracy}%` }} />
                </div>
              </div>
            ))}
          </div>
          <a href="/my-progress" className="mt-4 text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1">
            Full breakdown →
          </a>
        </div>
      </div>

      {/* Assigned Tests Section */}
      <AssignedTestsSection 
        studentId={dbId ?? undefined}
        maxDisplay={5}
        showViewAll={true}
      />
    </div>
  );
}
