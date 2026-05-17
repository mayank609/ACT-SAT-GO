import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, RotateCcw, ChevronRight, TrendingUp, Clock, BookOpen, Target } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';
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
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const [attempts, setAttempts] = useState<ApiAttempt[]>([]);
  const [availableTests, setAvailableTests] = useState<ApiAttempt['test'][]>([]);

  useEffect(() => {
    async function load() {
      try {
        const studentId = dbId;
        if (studentId) {
          const [attData, testData] = await Promise.all([
            api.getStudentAttempts(studentId),
            api.getAvailableTests(studentId),
          ]);
          setAttempts(attData.attempts as ApiAttempt[]);
          setAvailableTests((testData.tests as ApiAttempt['test'][]).slice(0, 3));
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
          <p className="text-xs text-slate-400 mb-1">Tests Available</p>
          <p className="text-2xl font-semibold text-slate-900">{availableTests.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-slate-400 mb-1">In Progress</p>
          <p className="text-2xl font-semibold text-slate-900">{attempts.filter((a) => a.status === 'IN_PROGRESS').length}</p>
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
          <button onClick={() => navigate('/my-progress')} className="mt-4 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            Full breakdown <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Available tests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium text-slate-900 text-sm">Available Tests</p>
          <button onClick={() => navigate('/my-tests')} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            View all <ChevronRight size={12} />
          </button>
        </div>
        <div className="space-y-2">
          {availableTests.length === 0 && (
            <div className="text-center py-8 bg-white rounded-xl border border-slate-100">
              <BookOpen size={24} className="text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No tests available yet</p>
            </div>
          )}
          {availableTests.map((test) => {
            if (!test) return null;
            const attempt = attempts.find((a) => a.testId === test.id);
            const isCompleted = attempt?.status === 'SUBMITTED';
            const inProgress = attempt?.status === 'IN_PROGRESS';
            const totalTime = test.sections.reduce((a, s) => a + s.durationMinutes, 0);
            const totalQ = test.sections.reduce((a, s) => a + (s._count?.questions ?? 0), 0);

            return (
              <div key={test.id} className="bg-white border border-slate-100 rounded-xl p-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={15} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{test.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    <span className="flex items-center gap-1"><Target size={10} /> {totalQ}q</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {totalTime}m</span>
                    <span>{test.sections.length} sections</span>
                  </p>
                </div>
                {isCompleted && (
                  <span className="text-sm font-semibold text-slate-900 flex-shrink-0">{attempt?.totalScore ?? '—'}<span className="text-xs font-normal text-slate-400">/36</span></span>
                )}
                <Badge variant={isCompleted ? 'success' : inProgress ? 'warning' : 'default'} size="sm">
                  {isCompleted ? 'Done' : inProgress ? 'Active' : 'New'}
                </Badge>
                <Button
                  size="sm"
                  variant={isCompleted ? 'secondary' : 'primary'}
                  icon={inProgress ? <RotateCcw size={12} /> : isCompleted ? undefined : <Play size={12} />}
                  onClick={() => isCompleted ? navigate(`/test-review/${attempt?.id}`) : navigate(`/test-instructions/${test.id}`)}
                >
                  {isCompleted ? 'Review' : inProgress ? 'Resume' : 'Start'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
