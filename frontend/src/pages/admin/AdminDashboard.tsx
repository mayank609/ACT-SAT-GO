import { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, ArrowRight, CalendarDays, Target, AlertTriangle,
  HelpCircle, Sparkles, Activity, UserPlus, UserCheck,
  ClipboardList, Database, BarChart3,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ScoreDistributionBars } from '../../components/common/ScoreDistributionBars';
import { useAuthStore } from '../../store/useAuthStore';
import { api, type DbUser } from '../../lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

interface DbTest {
  id: string;
  title: string;
  status: string;
  sections: { _count?: { questions: number } }[];
}

interface FeedItem {
  id: string;
  text: string;
  timestamp: string;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// Mirrors the bucket thresholds used server-side in /api/analytics/platform
// so clicking a bar can filter students by the exact same range.
const ACT_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '1–10', min: -Infinity, max: 10 },
  { label: '11–15', min: 10, max: 15 },
  { label: '16–20', min: 15, max: 20 },
  { label: '21–25', min: 20, max: 25 },
  { label: '26–30', min: 25, max: 30 },
  { label: '31–36', min: 30, max: Infinity },
];
const SAT_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '400–800', min: -Infinity, max: 800 },
  { label: '800–1000', min: 800, max: 1000 },
  { label: '1000–1200', min: 1000, max: 1200 },
  { label: '1200–1400', min: 1200, max: 1400 },
  { label: '1400–1600', min: 1400, max: Infinity },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AdminDashboard() {
  const { user } = useAuthStore();
  const [tests, setTests] = useState<DbTest[]>([]);
  const [students, setStudents] = useState<DbUser[]>([]);
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [activityData, setActivityData] = useState<{ date: string; attempts: number; completions: number }[]>([]);
  const [scoreDistData, setScoreDistData] = useState<{ range: string; count: number }[]>([]);
  const [hasSAT, setHasSAT] = useState(false);
  const [hasACT, setHasACT] = useState(false);
  const [avgScoreImprovement, setAvgScoreImprovement] = useState<number | null>(null);
  const [subjectStrength, setSubjectStrength] = useState<{ rw: number | null; math: number | null }>({ rw: null, math: null });
  const [overallAccuracy, setOverallAccuracy] = useState<number | null>(null);
  const [openDoubtsCount, setOpenDoubtsCount] = useState(0);
  const [dailyScoreTrend, setDailyScoreTrend] = useState<{ date: string; avgSAT: number | null; avgACT: number | null }[]>([]);
  const [recentActivity, setRecentActivity] = useState<FeedItem[]>([]);
  const [questionsAttemptedThisWeek, setQuestionsAttemptedThisWeek] = useState(0);
  const [avgStudyHoursThisWeek, setAvgStudyHoursThisWeek] = useState<number | null>(null);
  const [selectedRange, setSelectedRange] = useState<string | null>(null);

  useEffect(() => {
    api.getAllTests().then((r) => setTests((r.tests as DbTest[]) ?? [])).catch(() => {});
    api.getUsersByRole('STUDENT').then((r) => setStudents(r.users ?? [])).catch(() => {});
    api.getUsersByRole('TUTOR').then((r) => setTutors(r.users ?? [])).catch(() => {});
    api.getPlatformAnalytics()
      .then((r) => {
        setActivityData(r.activityData);
        setScoreDistData(r.scoreDistribution);
        setHasSAT(r.hasSAT);
        setHasACT(r.hasACT);
        setAvgScoreImprovement(r.avgScoreImprovement);
        setSubjectStrength(r.subjectStrength);
        setOverallAccuracy(r.overallAccuracy);
        setOpenDoubtsCount(r.openDoubtsCount);
        setDailyScoreTrend(r.dailyScoreTrend);
        setRecentActivity(r.recentActivity);
        setQuestionsAttemptedThisWeek(r.questionsAttemptedThisWeek);
        setAvgStudyHoursThisWeek(r.avgStudyHoursThisWeek);
      })
      .catch(() => {});
  }, []);

  const publishedTests = tests.filter((t) => t.status === 'PUBLISHED');
  const draftTests = tests.filter((t) => t.status === 'DRAFT');

  const studentsWithScore = useMemo(() => students.filter((s) => s.avgScore != null), [students]);
  const avgScore = studentsWithScore.length
    ? studentsWithScore.reduce((a, s) => a + (s.avgScore ?? 0), 0) / studentsWithScore.length
    : 0;

  const studentsInSelectedRange = useMemo(() => {
    if (!selectedRange) return [];
    const buckets = hasSAT && !hasACT ? SAT_BUCKETS : ACT_BUCKETS;
    const bucket = buckets.find((b) => b.label === selectedRange);
    if (!bucket) return [];
    return studentsWithScore
      .filter((s) => (s.avgScore ?? 0) > bucket.min && (s.avgScore ?? 0) <= bucket.max)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  }, [selectedRange, hasSAT, hasACT, studentsWithScore]);

  const studentsAboveTarget = useMemo(
    () => students.filter((s) => s.targetScore != null && s.avgScore != null && s.avgScore >= s.targetScore),
    [students]
  );
  const inactiveStudents = useMemo(() => {
    const now = Date.now();
    return students.filter((s) => (s.testsAttempted ?? 0) > 0 && s.lastActive && (now - new Date(s.lastActive).getTime()) / 86_400_000 >= 7);
  }, [students]);

  // Real, derived attention list: below-target gap, total inactivity, or never attempted.
  const attentionList = useMemo(() => {
    const now = Date.now();
    type Row = { student: DbUser; reason: string; severity: 'High' | 'Medium' | 'Low' };
    const rows: Row[] = [];
    for (const s of students) {
      if (s.targetScore != null && s.avgScore != null && s.avgScore < s.targetScore) {
        const gap = Math.round((s.targetScore - s.avgScore) * 10) / 10;
        rows.push({ student: s, reason: `${gap} pts below target`, severity: gap >= 5 ? 'High' : gap >= 2 ? 'Medium' : 'Low' });
      } else if ((s.testsAttempted ?? 0) === 0) {
        rows.push({ student: s, reason: 'No tests attempted yet', severity: 'Medium' });
      } else if (s.lastActive) {
        const daysInactive = Math.floor((now - new Date(s.lastActive).getTime()) / 86_400_000);
        if (daysInactive >= 7) {
          rows.push({ student: s, reason: `No practice in ${daysInactive}d`, severity: daysInactive >= 21 ? 'High' : 'Medium' });
        }
      }
    }
    const rank = { High: 0, Medium: 1, Low: 2 };
    return rows.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 5);
  }, [students]);

  const insights = useMemo(() => {
    const list: string[] = [];
    if (subjectStrength.rw != null && subjectStrength.math != null && subjectStrength.rw !== subjectStrength.math) {
      const weaker = subjectStrength.rw < subjectStrength.math ? 'Reading & Writing' : 'Math';
      const weakerPct = Math.min(subjectStrength.rw, subjectStrength.math);
      list.push(`${weaker} is the weakest section platform-wide at ${weakerPct}% accuracy.`);
    }
    if (avgScoreImprovement != null && avgScoreImprovement !== 0) {
      list.push(avgScoreImprovement > 0
        ? `Average scores are up ${avgScoreImprovement} pts over the last 30 days.`
        : `Average scores are down ${Math.abs(avgScoreImprovement)} pts over the last 30 days.`);
    }
    if (studentsAboveTarget.length > 0) {
      list.push(`${studentsAboveTarget.length} student${studentsAboveTarget.length === 1 ? ' is' : 's are'} currently at or above target score.`);
    }
    if (inactiveStudents.length > 0) {
      list.push(`${inactiveStudents.length} student${inactiveStudents.length === 1 ? '' : 's'} haven't attempted a test in over a week.`);
    }
    if (openDoubtsCount > 0) {
      list.push(`${openDoubtsCount} question${openDoubtsCount === 1 ? ' is' : 's are'} marked as open doubts awaiting review.`);
    }
    return list.slice(0, 5);
  }, [subjectStrength, avgScoreImprovement, studentsAboveTarget, inactiveStudents, openDoubtsCount]);

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

  // Recent signups (from already-loaded student/tutor lists) merged with the
  // backend's recent-completions feed into a single, real activity timeline.
  const mergedActivity = useMemo(() => {
    const fourteenDaysAgo = Date.now() - 14 * 86_400_000;
    const signups: FeedItem[] = [...students, ...tutors]
      .filter((u) => new Date(u.createdAt).getTime() >= fourteenDaysAgo)
      .map((u) => ({ id: `signup-${u.id}`, text: `${u.name} joined as ${u.role === 'STUDENT' ? 'a student' : 'a tutor'}`, timestamp: u.createdAt }));
    return [...recentActivity, ...signups]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, [recentActivity, students, tutors]);

  const attemptsToday = activityData.length ? activityData[activityData.length - 1].attempts : 0;
  const mocksCompletedThisWeek = activityData.reduce((a, d) => a + d.completions, 0);

  const trendKey: 'avgSAT' | 'avgACT' = hasSAT && !hasACT ? 'avgSAT' : 'avgACT';
  const trendLabel = trendKey === 'avgSAT' ? 'Avg SAT Score' : 'Avg ACT Score';

  const firstName = (user?.name ?? 'Admin').split(' ')[0];
  const today = new Date();
  const scoreScaleLabel = hasSAT && !hasACT ? 'out of 1600' : 'out of 36';

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
            <p className="text-sm font-semibold text-slate-900">{attentionList.length}</p>
            <p className="text-xs text-slate-400">Below target or inactive</p>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Students" value={students.length} subtitle={`${tutors.length} tutors`} />
        <StatCard title="Attempts Today" value={attemptsToday} subtitle="test sessions started" />
        <StatCard title="Active Tests" value={publishedTests.length} subtitle={`${draftTests.length} drafts`} />
        <StatCard title="Students Above Target" value={studentsAboveTarget.length} subtitle={`of ${students.filter(s => s.targetScore != null).length} with a target`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
        <StatCard title="Practice Qs This Week" value={questionsAttemptedThisWeek} subtitle="questions answered" />
        <StatCard title="Avg Accuracy" value={overallAccuracy != null ? `${overallAccuracy}%` : '—'} subtitle="recent submitted attempts" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
          <p className="font-medium text-slate-900 text-sm mb-1">Student Performance Trend</p>
          <p className="text-xs text-slate-400 mb-4">{trendLabel} (last 30 days)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyScoreTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }} />
              <Line type="monotone" dataKey={trendKey} stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls name={trendLabel} />
            </LineChart>
          </ResponsiveContainer>
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
            <div>
              <p className="font-medium text-slate-900 text-sm">Score Distribution</p>
              <p className="text-xs text-slate-400">Click a bar to see those students</p>
            </div>
            {selectedRange ? (
              <button onClick={() => setSelectedRange(null)} className="text-xs text-blue-600 hover:text-blue-700">Clear filter</button>
            ) : (
              <p className="text-xs text-slate-400">{students.length} students</p>
            )}
          </div>
          <div className="p-5 pt-3">
            {scoreDistData.length === 0 ? (
              <p className="py-8 text-sm text-slate-400 text-center">No score distribution data</p>
            ) : (
              <ScoreDistributionBars
                data={scoreDistData}
                selectedRange={selectedRange}
                onSelect={(range) => setSelectedRange((prev) => (prev === range ? null : range))}
                accent="blue"
              />
            )}
          </div>
        </div>

        {/* Students requiring attention */}
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
            <p className="font-medium text-slate-900 text-sm">Students Requiring Attention</p>
            <Link to="/students" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {attentionList.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">Nobody needs attention right now.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {attentionList.map(({ student, reason, severity }) => (
                <div key={student.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-semibold text-xs flex-shrink-0">
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{student.name}</p>
                    <p className="text-xs text-slate-400 truncate">{reason}</p>
                  </div>
                  <Badge variant={severity === 'High' ? 'danger' : severity === 'Medium' ? 'warning' : 'default'} size="sm">
                    {severity}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Insights */}
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-50">
            <Sparkles size={14} className="text-purple-500" />
            <p className="font-medium text-slate-900 text-sm">Insights</p>
          </div>
          {insights.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">Not enough data yet for insights.</p>
          ) : (
            <ul className="px-5 py-4 space-y-3">
              {insights.map((text, i) => (
                <li key={i} className="text-sm text-slate-600 flex gap-2">
                  <span className="text-slate-300 flex-shrink-0">•</span>
                  {text}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Subject strength */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="font-medium text-slate-900 text-sm mb-1">Subject Strength</p>
          <p className="text-xs text-slate-400 mb-4">Accuracy by section</p>
          {subjectChartData.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No graded attempts yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={110}>
                <PieChart>
                  <Pie data={subjectChartData} cx="50%" cy="50%" innerRadius={32} outerRadius={50} dataKey="value" stroke="none" paddingAngle={2}>
                    {subjectChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {subjectChartData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-slate-500 flex-1">{d.name}</span>
                    <span className="font-semibold text-slate-800">{d.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

        {/* Learning analytics this week */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="font-medium text-slate-900 text-sm mb-1">Learning Analytics</p>
          <p className="text-xs text-slate-400 mb-4">This week</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-lg font-semibold text-slate-900">{questionsAttemptedThisWeek}</p>
              <p className="text-xs text-slate-400">Practice Qs Solved</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-lg font-semibold text-slate-900">{mocksCompletedThisWeek}</p>
              <p className="text-xs text-slate-400">Mocks Completed</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-lg font-semibold text-slate-900">{avgStudyHoursThisWeek != null ? `${avgStudyHoursThisWeek}h` : '—'}</p>
              <p className="text-xs text-slate-400">Avg Study Time</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-lg font-semibold text-slate-900">{overallAccuracy != null ? `${overallAccuracy}%` : '—'}</p>
              <p className="text-xs text-slate-400">Avg Accuracy</p>
            </div>
          </div>
        </div>

        {/* Students in the selected score-distribution range */}
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
            <p className="font-medium text-slate-900 text-sm">
              {selectedRange ? `Students: ${selectedRange}` : 'Students by Score Range'}
            </p>
            {selectedRange && (
              <Badge variant="info" size="sm">{studentsInSelectedRange.length}</Badge>
            )}
          </div>
          {!selectedRange ? (
            <p className="px-5 py-6 text-sm text-slate-400 text-center">Click a bar in Score Distribution to see the students in that range.</p>
          ) : studentsInSelectedRange.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">No students in this range.</p>
          ) : (
            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {studentsInSelectedRange.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-semibold text-xs flex-shrink-0">
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">{s.name}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 flex-shrink-0">{s.avgScore?.toFixed(0)}</p>
                </div>
              ))}
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

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-50">
            <Activity size={14} className="text-blue-500" />
            <p className="font-medium text-slate-900 text-sm">Recent Activity</p>
          </div>
          {mergedActivity.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-400">Nothing yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {mergedActivity.map((item) => (
                <div key={item.id} className="px-5 py-3">
                  <p className="text-sm text-slate-700">{item.text}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{relativeTime(item.timestamp)}</p>
                </div>
              ))}
            </div>
          )}
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

        {/* Quick actions — only links to pages that actually exist and are routed */}
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="font-medium text-slate-900 text-sm mb-4">Quick Actions</p>
          <div className="grid grid-cols-3 gap-3">
            <Link to="/students" className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><UserPlus size={16} /></div>
              <span className="text-xs text-slate-600 text-center">Add Student</span>
            </Link>
            <Link to="/tutors" className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><UserCheck size={16} /></div>
              <span className="text-xs text-slate-600 text-center">Add Tutor</span>
            </Link>
            <Link to="/test-builder" className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><ClipboardList size={16} /></div>
              <span className="text-xs text-slate-600 text-center">Create Test</span>
            </Link>
            <Link to="/analytics" className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><BarChart3 size={16} /></div>
              <span className="text-xs text-slate-600 text-center">Analytics</span>
            </Link>
            <Link to="/question-bank" className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center"><Database size={16} /></div>
              <span className="text-xs text-slate-600 text-center">Question Bank</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
