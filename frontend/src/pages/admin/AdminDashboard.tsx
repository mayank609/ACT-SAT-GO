import { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, ArrowRight, CalendarDays, Target, AlertTriangle,
  HelpCircle, Medal,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { api, type DbUser } from '../../lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell,
} from 'recharts';

interface DbTest {
  id: string;
  title: string;
  status: string;
  sections: { _count?: { questions: number } }[];
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function AdminDashboard() {
  const { user } = useAuthStore();
  const [tests, setTests] = useState<DbTest[]>([]);
  const [students, setStudents] = useState<DbUser[]>([]);
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [activityData, setActivityData] = useState<{ date: string; attempts: number; completions: number }[]>([]);
  const [scoreDistData, setScoreDistData] = useState<{ range: string; count: number }[]>([]);
  const [hasSAT, setHasSAT] = useState(false);
  const [avgScoreImprovement, setAvgScoreImprovement] = useState<number | null>(null);
  const [subjectStrength, setSubjectStrength] = useState<{ rw: number | null; math: number | null }>({ rw: null, math: null });
  const [openDoubtsCount, setOpenDoubtsCount] = useState(0);
  const [topPerformerImprovements, setTopPerformerImprovements] = useState<Record<string, number | null>>({});

  useEffect(() => {
    api.getAllTests().then((r) => setTests((r.tests as DbTest[]) ?? [])).catch(() => {});
    api.getUsersByRole('STUDENT').then((r) => setStudents(r.users ?? [])).catch(() => {});
    api.getUsersByRole('TUTOR').then((r) => setTutors(r.users ?? [])).catch(() => {});
    api.getPlatformAnalytics()
      .then((r) => {
        setActivityData(r.activityData);
        setScoreDistData(r.scoreDistribution);
        setHasSAT(r.hasSAT);
        setAvgScoreImprovement(r.avgScoreImprovement);
        setSubjectStrength(r.subjectStrength);
        setOpenDoubtsCount(r.openDoubtsCount);
      })
      .catch(() => {});
  }, []);

  const publishedTests = tests.filter((t) => t.status === 'PUBLISHED');
  const draftTests = tests.filter((t) => t.status === 'DRAFT');

  const studentsWithScore = useMemo(() => students.filter((s) => s.avgScore != null), [students]);
  const avgScore = studentsWithScore.length
    ? studentsWithScore.reduce((a, s) => a + (s.avgScore ?? 0), 0) / studentsWithScore.length
    : 0;

  const topPerformers = useMemo(
    () => studentsWithScore.slice().sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0)).slice(0, 4),
    [studentsWithScore]
  );

  // Fetch score trend for the (small, fixed) set of top performers to derive a
  // real per-student improvement figure — cheap since it's capped at 4 calls.
  useEffect(() => {
    if (topPerformers.length === 0) return;
    let cancelled = false;
    Promise.all(
      topPerformers.map((s) =>
        api.getStudentAnalytics(s.id)
          .then((r) => [s.id, r.trend.length >= 2 ? Math.round((r.trend[r.trend.length - 1].score - r.trend[0].score) * 10) / 10 : null] as const)
          .catch(() => [s.id, null] as const)
      )
    ).then((pairs) => { if (!cancelled) setTopPerformerImprovements(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [topPerformers]);

  const studentsNeedingAttention = useMemo(
    () => students.filter((s) => s.targetScore != null && s.avgScore != null && s.avgScore < s.targetScore),
    [students]
  );

  const upcomingTargets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return students
      .filter((s) => s.targetDate)
      .map((s) => ({ student: s, date: new Date(s.targetDate as string) }))
      .filter((t) => !isNaN(t.date.getTime()) && t.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 4);
  }, [students]);

  const nextTarget = upcomingTargets[0];
  const daysUntilNextTarget = nextTarget ? Math.ceil((nextTarget.date.getTime() - Date.now()) / 86_400_000) : null;

  const tutorOverview = useMemo(
    () =>
      tutors.slice(0, 4).map((tutor) => {
        const tutorStudents = students.filter((s) => (tutor.studentIds ?? []).includes(s.id) && s.avgScore != null);
        const avgStudentScore = tutorStudents.length
          ? tutorStudents.reduce((a, s) => a + (s.avgScore ?? 0), 0) / tutorStudents.length
          : null;
        return { tutor, avgStudentScore };
      }),
    [tutors, students]
  );

  const subjectChartData = [
    { name: 'Reading & Writing', value: subjectStrength.rw ?? 0, color: '#3b82f6' },
    { name: 'Math', value: subjectStrength.math ?? 0, color: '#10b981' },
  ].filter((d) => d.value > 0);

  const firstName = (user?.name ?? 'Admin').split(' ')[0];
  const today = new Date();
  const scoreScaleLabel = hasSAT ? 'out of 1600' : 'out of 36';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {greetingForHour(today.getHours())}, {firstName}!
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/test-builder">
            <Button size="sm" icon={<Plus size={14} />}>New Test</Button>
          </Link>
        </div>
      </div>

      {/* Info strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <CalendarDays size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Next Target Exam</p>
            <p className="text-sm font-semibold text-slate-900 truncate">
              {nextTarget ? nextTarget.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
            </p>
            <p className="text-xs text-slate-400">{daysUntilNextTarget != null ? `${daysUntilNextTarget} days left` : 'No target set'}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <FileText size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Pending Tasks</p>
            <p className="text-sm font-semibold text-slate-900">{draftTests.length}</p>
            <p className="text-xs text-slate-400">Draft tests to publish</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Students Need Attention</p>
            <p className="text-sm font-semibold text-slate-900">{studentsNeedingAttention.length}</p>
            <p className="text-xs text-slate-400">Below target score</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <HelpCircle size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Open Doubts</p>
            <p className="text-sm font-semibold text-slate-900">{openDoubtsCount}</p>
            <p className="text-xs text-slate-400">Marked still-a-doubt</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard title="Students" value={students.length} subtitle={`${tutors.length} tutors`} />
        <StatCard title="Active Tutors" value={tutors.length} subtitle="on platform" />
        <StatCard title="Active Tests" value={publishedTests.length} subtitle={`${draftTests.length} drafts`} />
        <StatCard
          title="Avg Score"
          value={avgScore > 0 ? avgScore.toFixed(1) : '—'}
          subtitle={scoreScaleLabel}
        />
        <StatCard
          title="Score Improvement"
          value={avgScoreImprovement != null ? `${avgScoreImprovement > 0 ? '+' : ''}${avgScoreImprovement}` : '—'}
          subtitle="last 30 vs prior 30 days"
          trend={avgScoreImprovement != null ? { value: Math.abs(avgScoreImprovement), positive: avgScoreImprovement >= 0 } : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
          <p className="font-medium text-slate-900 text-sm mb-1">Score Distribution</p>
          <p className="text-xs text-slate-400 mb-4">Based on latest submitted attempts</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scoreDistData} barSize={26} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Students" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tutor overview */}
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
            <p className="font-medium text-slate-900 text-sm">Tutor Overview</p>
            <Link to="/tutors" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {tutorOverview.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">No tutors yet. Add one!</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {tutorOverview.map(({ tutor, avgStudentScore }) => (
                <div key={tutor.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-semibold text-xs flex-shrink-0">
                    {tutor.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{tutor.name}</p>
                    <p className="text-xs text-slate-400">{tutor.studentCount ?? 0} students</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {avgStudentScore != null ? avgStudentScore.toFixed(1) : '—'}
                    </p>
                    <p className="text-xs text-slate-400">avg score</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top performers */}
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
            <p className="font-medium text-slate-900 text-sm">Top Performers</p>
            <Link to="/students" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {topPerformers.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">No scored attempts yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {topPerformers.map((s, i) => {
                const improvement = topPerformerImprovements[s.id];
                return (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-6 flex items-center justify-center flex-shrink-0">
                      {i < 3 ? <Medal size={15} className={i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : 'text-orange-400'} /> : <span className="text-xs text-slate-400">{i + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate">{s.name}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-slate-900">{s.avgScore?.toFixed(0)}</p>
                      {improvement != null && (
                        <p className={`text-xs ${improvement >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {improvement >= 0 ? '+' : ''}{improvement} pts
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Subject strength */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="font-medium text-slate-900 text-sm mb-1">Subject Strength Overview</p>
          <p className="text-xs text-slate-400 mb-4">Platform-wide accuracy by section</p>
          {subjectChartData.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No graded attempts yet.</p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={110} height={110}>
                  <PieChart>
                    <Pie data={subjectChartData} cx="50%" cy="50%" innerRadius={32} outerRadius={50} dataKey="value" stroke="none" paddingAngle={2}>
                      {subjectChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {subjectChartData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-slate-500 flex-1">{d.name}</span>
                      <span className="font-semibold text-slate-800">{d.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
              {subjectStrength.rw != null && subjectStrength.math != null && (
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-50">
                  <div>
                    <p className="text-xs text-slate-400">Top Strength</p>
                    <p className="text-sm font-semibold text-emerald-600">
                      {subjectStrength.rw >= subjectStrength.math ? 'Reading & Writing' : 'Math'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Needs Focus</p>
                    <p className="text-sm font-semibold text-red-500">
                      {subjectStrength.rw < subjectStrength.math ? 'Reading & Writing' : 'Math'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Upcoming target exams */}
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="px-5 py-3.5 border-b border-slate-50">
            <p className="font-medium text-slate-900 text-sm">Upcoming Target Exams</p>
            <p className="text-xs text-slate-400">Nearest student target dates</p>
          </div>
          {upcomingTargets.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">No target dates set yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {upcomingTargets.map(({ student, date }) => {
                const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
                return (
                  <div key={student.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Target size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate">{student.name}</p>
                      <p className="text-xs text-slate-400">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <Badge variant="info" size="sm">{days}d</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
                    <p className="text-xs text-slate-400">{test.sections?.length ?? 0} sections</p>
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
      </div>
    </div>
  );
}
