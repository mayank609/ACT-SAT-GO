import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users, AlertTriangle, ChevronRight, Target, Shield, Eye,
  RefreshCw, AlertCircle, Clock, Activity, FileText,
  CalendarDays, Sparkles, BarChart3, ArrowRight, Loader2,
  HelpCircle, ClipboardList
} from 'lucide-react';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { ScoreDistributionBars } from '../../components/common/ScoreDistributionBars';
import { api, type DbUser } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

import { formatDate } from '../../lib/utils';

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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Score distribution buckets matching admin thresholds
const ACT_BUCKETS = [
  { label: '1–10', min: -Infinity, max: 10 },
  { label: '11–15', min: 10, max: 15 },
  { label: '16–20', min: 15, max: 20 },
  { label: '21–25', min: 20, max: 25 },
  { label: '26–30', min: 25, max: 30 },
  { label: '31–36', min: 30, max: Infinity },
];
const SAT_BUCKETS = [
  { label: '400–800', min: -Infinity, max: 800 },
  { label: '800–1000', min: 800, max: 1000 },
  { label: '1000–1200', min: 1000, max: 1200 },
  { label: '1200–1400', min: 1200, max: 1400 },
  { label: '1400–1600', min: 1400, max: Infinity },
];

export function TutorDashboard() {
  const { user, dbId } = useAuthStore();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'anticheating'>('overview');
  const [myStudents, setMyStudents] = useState<DbUser[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [tests, setTests] = useState<DbTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [selectedRange, setSelectedRange] = useState<string | null>(null);

  // Fetch initial dashboard data
  useEffect(() => {
    if (!dbId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api.getTutorAssignments({ tutorId: dbId }),
      api.getAttempts(),
      api.getAllTests()
    ])
      .then(([assignmentsRes, attemptsRes, testsRes]) => {
        const students = (assignmentsRes?.assignments ?? [])
          .map((a: any) => a.student as DbUser)
          .filter((s): s is DbUser => s !== null && s !== undefined);
        setMyStudents(students);
        setAttempts(attemptsRes.attempts ?? []);
        setTests((testsRes.tests as DbTest[]) ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dbId]);

  const fetchAttempts = () => {
    setLoadingAttempts(true);
    api.getAttempts()
      .then((r) => setAttempts(r.attempts ?? []))
      .catch(() => {})
      .finally(() => setLoadingAttempts(false));
  };

  useEffect(() => {
    if (activeTab === 'anticheating') {
      fetchAttempts();
    }
  }, [activeTab]);

  // Cohort filters and calculations
  const assignedStudentIds = useMemo(() => new Set(myStudents.map(s => s.id)), [myStudents]);
  
  const relevantAttempts = useMemo(() => {
    return attempts.filter(att => att && att.studentId && assignedStudentIds.has(att.studentId));
  }, [attempts, assignedStudentIds]);

  const hasSAT = useMemo(() => myStudents.some(s => (s.avgScore ?? 0) > 36 || (s.targetScore as number ?? 0) > 36), [myStudents]);

  const scoreDistData = useMemo(() => {
    const buckets = hasSAT ? SAT_BUCKETS : ACT_BUCKETS;
    const counts = buckets.map(b => ({ range: b.label, count: 0 }));
    myStudents.forEach(s => {
      if (s.avgScore != null) {
        const val = s.avgScore;
        const b = buckets.find(b => val > b.min && val <= b.max);
        if (b) {
          const idx = counts.findIndex(c => c.range === b.label);
          if (idx !== -1) counts[idx].count++;
        }
      }
    });
    return counts;
  }, [myStudents, hasSAT]);

  const studentsInSelectedRange = useMemo(() => {
    if (!selectedRange) return [];
    const buckets = hasSAT ? SAT_BUCKETS : ACT_BUCKETS;
    const bucket = buckets.find((b) => b.label === selectedRange);
    if (!bucket) return [];
    return myStudents
      .filter((s) => s.avgScore != null && s.avgScore > bucket.min && s.avgScore <= bucket.max)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  }, [selectedRange, hasSAT, myStudents]);

  const studentsWithScore = useMemo(() => myStudents.filter((s) => s.avgScore != null), [myStudents]);
  
  const avgScore = useMemo(() => {
    return studentsWithScore.length
      ? studentsWithScore.reduce((a, s) => a + (s.avgScore ?? 0), 0) / studentsWithScore.length
      : 0;
  }, [studentsWithScore]);

  const avgScoreImprovement = useMemo(() => {
    const now = Date.now();
    const thirtyDays = 30 * 86_400_000;
    const last30 = relevantAttempts.filter(a => a.status === 'SUBMITTED' && a.completedAt && (now - new Date(a.completedAt).getTime()) <= thirtyDays);
    const prior30 = relevantAttempts.filter(a => a.status === 'SUBMITTED' && a.completedAt && (now - new Date(a.completedAt).getTime()) > thirtyDays && (now - new Date(a.completedAt).getTime()) <= 2 * thirtyDays);
    
    const avgLast30 = last30.length ? last30.reduce((acc, a) => acc + (a.totalScore ?? 0), 0) / last30.length : 0;
    const avgPrior30 = prior30.length ? prior30.reduce((acc, a) => acc + (a.totalScore ?? 0), 0) / prior30.length : 0;
    
    if (last30.length && prior30.length) {
      return Math.round((avgLast30 - avgPrior30) * 10) / 10;
    }
    return null;
  }, [relevantAttempts]);

  const totalTests = useMemo(() => myStudents.reduce((a, s) => a + (s?.testsAttempted ?? 0), 0), [myStudents]);

  const studentsAboveTarget = useMemo(() => {
    return myStudents.filter((s) => {
      const target = (s.targetScore as number | null) ?? (hasSAT ? 1200 : 32);
      return s.avgScore != null && s.avgScore >= target;
    });
  }, [myStudents, hasSAT]);

  const overallAccuracy = useMemo(() => {
    if (studentsWithScore.length === 0) return null;
    const sum = studentsWithScore.reduce((acc, s) => acc + (s.avgScore ?? 0), 0);
    const avg = sum / studentsWithScore.length;
    const max = hasSAT ? 1600 : 36;
    return Math.round((avg / max) * 100);
  }, [studentsWithScore, hasSAT]);

  const activityData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();
    
    return days.map(date => {
      const started = relevantAttempts.filter(a => a.startedAt?.split('T')[0] === date).length;
      const completed = relevantAttempts.filter(a => a.status === 'SUBMITTED' && a.completedAt?.split('T')[0] === date).length;
      return { date, attempts: started, completions: completed };
    });
  }, [relevantAttempts]);

  const dailyScoreTrend = useMemo(() => {
    const days = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();
    
    return days.map(date => {
      const completed = relevantAttempts.filter(a => a.status === 'SUBMITTED' && a.completedAt?.split('T')[0] === date);
      if (completed.length === 0) return { date, avgSAT: null, avgACT: null };
      
      const sum = completed.reduce((acc, a) => acc + (a.totalScore ?? 0), 0);
      const avg = sum / completed.length;
      return {
        date,
        avgSAT: hasSAT ? Math.round(avg) : null,
        avgACT: !hasSAT ? Math.round(avg * 10) / 10 : null
      };
    });
  }, [relevantAttempts, hasSAT]);

  const attentionList = useMemo(() => {
    const now = Date.now();
    type Row = { student: DbUser; reason: string; severity: 'High' | 'Medium' | 'Low' };
    const rows: Row[] = [];
    for (const s of myStudents) {
      const target = (s.targetScore as number | null) ?? (hasSAT ? 1200 : 32);
      if (s.avgScore != null && s.avgScore < target) {
        const gap = Math.round((target - s.avgScore) * 10) / 10;
        rows.push({ student: s, reason: `${gap} pts below target`, severity: gap >= (hasSAT ? 150 : 5) ? 'High' : gap >= (hasSAT ? 50 : 2) ? 'Medium' : 'Low' });
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
  }, [myStudents, hasSAT]);

  const insights = useMemo(() => {
    const list: string[] = [];
    const inactiveStudents = myStudents.filter((s) => {
      const now = Date.now();
      return (s.testsAttempted ?? 0) > 0 && s.lastActive && (now - new Date(s.lastActive).getTime()) / 86_400_000 >= 7;
    });
    
    if (avgScoreImprovement != null && avgScoreImprovement !== 0) {
      list.push(avgScoreImprovement > 0
        ? `Cohort scores are up ${avgScoreImprovement} pts over the last 30 days.`
        : `Cohort scores are down ${Math.abs(avgScoreImprovement)} pts over the last 30 days.`);
    }
    if (studentsAboveTarget.length > 0) {
      list.push(`${studentsAboveTarget.length} of your students are currently at or above target score.`);
    }
    if (inactiveStudents.length > 0) {
      list.push(`${inactiveStudents.length} student${inactiveStudents.length === 1 ? '' : 's'} haven't attempted a test in over a week.`);
    }
    return list.slice(0, 5);
  }, [myStudents, avgScoreImprovement, studentsAboveTarget]);

  const upcomingTargets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return myStudents
      .filter((s) => s.targetDate)
      .map((s) => ({ student: s, date: new Date(s.targetDate as string) }))
      .filter((t) => !isNaN(t.date.getTime()) && t.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 4);
  }, [myStudents]);

  const nextTarget = upcomingTargets[0];
  const daysUntilNextTarget = nextTarget ? Math.ceil((nextTarget.date.getTime() - Date.now()) / 86_400_000) : null;

  const mergedActivity = useMemo(() => {
    const fourteenDaysAgo = Date.now() - 14 * 86_400_000;
    const signups = myStudents
      .filter((u) => new Date(u.createdAt).getTime() >= fourteenDaysAgo)
      .map((u) => ({ id: `signup-${u.id}`, text: `${u.name} joined as a student`, timestamp: u.createdAt }));
    
    const completions = relevantAttempts
      .filter(a => a.status === 'SUBMITTED' && a.completedAt)
      .map(a => ({ id: `comp-${a.id}`, text: `${a.studentName} completed ${a.testTitle} with score ${a.totalScore ?? '—'}`, timestamp: a.completedAt }));
      
    return [...completions, ...signups]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, [myStudents, relevantAttempts]);

  const publishedTests = tests.filter((t) => t.status === 'PUBLISHED');

  const mocksCompletedThisWeek = useMemo(() => {
    const now = Date.now();
    const oneWeek = 7 * 86_400_000;
    return relevantAttempts.filter(a => a.status === 'SUBMITTED' && a.completedAt && (now - new Date(a.completedAt).getTime()) <= oneWeek).length;
  }, [relevantAttempts]);

  const trendKey: 'avgSAT' | 'avgACT' = hasSAT ? 'avgSAT' : 'avgACT';
  const trendLabel = trendKey === 'avgSAT' ? 'Avg SAT Score' : 'Avg ACT Score';
  const scoreScaleLabel = hasSAT ? 'out of 1600' : 'out of 36';
  const today = new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="text-blue-650 animate-spin" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Greetings & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {greetingForHour(today.getHours())}, {user?.name?.split(' ')[0]}!
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {formatDate(today)}
          </p>
        </div>
      </div>

      {/* Info Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <CalendarDays size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Next Target Exam</p>
            <p className="text-sm font-semibold text-slate-900 truncate">
              {nextTarget ? formatDate(nextTarget.date) : '—'}
            </p>
            <p className="text-xs text-slate-400">{daysUntilNextTarget != null ? `${daysUntilNextTarget} days left` : 'No target set'}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Users size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Active Students</p>
            <p className="text-sm font-semibold text-slate-900">{myStudents.length}</p>
            <p className="text-xs text-slate-400">Assigned students</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 text-red-550 flex items-center justify-center flex-shrink-0">
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
            <Shield size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Pacing Violations</p>
            <p className="text-sm font-semibold text-slate-900">
              {relevantAttempts.filter(a => (a?.tabSwitches ?? 0) >= 3 || (a?.cheatingLogs?.length ?? 0) >= 3).length}
            </p>
            <p className="text-xs text-slate-400">Tab switches / exits detected</p>
          </div>
        </div>
      </div>

      {/* Tabs Selector Navigation */}
      <div className="flex border-b border-slate-200 gap-4 pb-px">
        <button 
          onClick={() => setActiveTab('overview')} 
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 -mb-px ${
            activeTab === 'overview' 
              ? 'border-blue-650 text-blue-650' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users size={16} />
          Overview & Progress
        </button>
        
        <button 
          onClick={() => setActiveTab('anticheating')} 
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-2 -mb-px ${
            activeTab === 'anticheating' 
              ? 'border-red-500 text-red-650' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Shield size={16} />
          Live Anti-Cheating Monitor
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Active Students" value={myStudents.length} subtitle="enrolled" color="blue" />
            <StatCard title="Avg Class Score" value={avgScore > 0 ? avgScore.toFixed(1) : '—'} subtitle={scoreScaleLabel} color="emerald" />
            <StatCard title="Total Mock Exams" value={totalTests} subtitle="attempts completed" color="purple" />
            <StatCard title="Students Above Target" value={studentsAboveTarget.length} subtitle={`of ${myStudents.filter(s => s.targetScore != null).length} with target`} color="amber" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Score Improvement"
              value={avgScoreImprovement != null ? `${avgScoreImprovement > 0 ? '+' : ''}${avgScoreImprovement}` : '—'}
              subtitle="last 30 vs prior 30 days"
              trend={avgScoreImprovement != null ? { value: Math.abs(avgScoreImprovement), positive: avgScoreImprovement >= 0 } : undefined}
            />
            <StatCard title="Practice Tests Completed" value={totalTests} subtitle="all attempts" />
            <StatCard title="Active Assignments" value={publishedTests.length} subtitle="available tests" />
            <StatCard title="Avg Class Accuracy" value={overallAccuracy != null ? `${overallAccuracy}%` : '—'} subtitle="recent submitted attempts" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
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
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="px-5 py-3.5 border-b border-slate-50">
                <p className="font-medium text-slate-900 text-sm">Upcoming Target Exams</p>
                <p className="text-xs text-slate-400">Nearest student target dates</p>
              </div>
              {upcomingTargets.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-450 text-center">No target dates set yet.</p>
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
                          <p className="text-sm text-slate-800 truncate font-semibold">{student.name}</p>
                          <p className="text-xs text-slate-400">{formatDate(date)}</p>
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
            {/* Score distribution */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
                <div>
                  <p className="font-medium text-slate-900 text-sm">Score Distribution</p>
                  <p className="text-xs text-slate-400 font-medium">Click a bar to see those students</p>
                </div>
                {selectedRange ? (
                  <button onClick={() => setSelectedRange(null)} className="text-xs text-blue-600 hover:text-blue-700">Clear filter</button>
                ) : (
                  <p className="text-xs text-slate-400 font-semibold">{myStudents.length} students</p>
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
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
                <p className="font-medium text-slate-900 text-sm">Students Requiring Attention</p>
                <Link to="/my-students" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 font-semibold">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
              {attentionList.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-455 text-center">Nobody needs attention right now.</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {attentionList.map(({ student, reason, severity }) => (
                    <div key={student.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-550 font-bold text-xs flex-shrink-0">
                        {student.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 font-semibold truncate">{student.name}</p>
                        <p className="text-xs text-slate-400 truncate font-semibold">{reason}</p>
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
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-50">
                <Sparkles size={14} className="text-purple-500" />
                <p className="font-medium text-slate-900 text-sm">Insights</p>
              </div>
              {insights.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-450 text-center">Not enough data yet for insights.</p>
              ) : (
                <ul className="px-5 py-4 space-y-3">
                  {insights.map((text, i) => (
                    <li key={i} className="text-xs text-slate-600 flex gap-2 font-semibold leading-relaxed">
                      <span className="text-slate-300 flex-shrink-0">•</span>
                      {text}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Students in the selected range */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
                <p className="font-medium text-slate-900 text-sm">
                  {selectedRange ? `Students: ${selectedRange}` : 'Students by Score Range'}
                </p>
                {selectedRange && (
                  <Badge variant="info" size="sm">{studentsInSelectedRange.length}</Badge>
                )}
              </div>
              {!selectedRange ? (
                <p className="px-5 py-6 text-xs text-slate-455 text-center leading-relaxed">Click a bar in Score Distribution to see the students in that range.</p>
              ) : studentsInSelectedRange.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-455 text-center">No students in this range.</p>
              ) : (
                <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                  {studentsInSelectedRange.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                        {s.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 truncate font-semibold">{s.name}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-900 flex-shrink-0">{s.avgScore?.toFixed(0)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Learning analytics this week */}
            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
              <p className="font-medium text-slate-900 text-sm mb-1">Learning Analytics</p>
              <p className="text-xs text-slate-400 mb-4">This week</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-slate-900">{totalTests * 50}</p>
                  <p className="text-[10px] text-slate-450 font-bold">Est Qs Solved</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-slate-900">{mocksCompletedThisWeek}</p>
                  <p className="text-[10px] text-slate-455 font-bold">Mocks Completed</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-slate-900">{totalTests > 0 ? `${totalTests * 2.5}h` : '—'}</p>
                  <p className="text-[10px] text-slate-455 font-bold">Est Study Time</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-lg font-bold text-slate-900">{overallAccuracy != null ? `${overallAccuracy}%` : '—'}</p>
                  <p className="text-[10px] text-slate-455 font-bold">Avg Accuracy</p>
                </div>
              </div>
            </div>

            {/* Test Activity area chart */}
            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-medium text-slate-900 text-sm">Test Activity</p>
                  <p className="text-xs text-slate-400">Attempts vs completions (last 7 days)</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={150}>
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
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recent activity feed */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-50">
                <Activity size={14} className="text-blue-500 animate-pulse" />
                <p className="font-medium text-slate-900 text-sm">Recent Activity</p>
              </div>
              {mergedActivity.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-450 text-center">Nothing yet.</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {mergedActivity.map((item) => (
                    <div key={item.id} className="px-5 py-3 text-xs leading-relaxed">
                      <p className="text-slate-700 font-semibold">{item.text}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">{relativeTime(item.timestamp)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent tests list */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
                <p className="font-medium text-slate-900 text-sm">Recent Tests</p>
                <Link to="/my-students" className="text-xs text-slate-400 hover:text-slate-650 flex items-center gap-1 font-semibold">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-slate-50">
                {tests.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-450 text-center">No tests yet.</p>
                ) : (
                  tests.slice(0, 4).map((test) => (
                    <div key={test.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                        <FileText size={13} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 truncate font-semibold">{test.title}</p>
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

            {/* Quick actions for tutors */}
            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
              <p className="font-medium text-slate-900 text-sm mb-4">Quick Actions</p>
              <div className="grid grid-cols-3 gap-3">
                <Link to="/my-students" className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Users size={16} /></div>
                  <span className="text-[10px] text-slate-600 text-center font-bold">My Students</span>
                </Link>
                <Link to="/analytics" className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><BarChart3 size={16} /></div>
                  <span className="text-[10px] text-slate-600 text-center font-bold">Analytics</span>
                </Link>
                <Link to="/student-doubts" className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><HelpCircle size={16} /></div>
                  <span className="text-[10px] text-slate-600 text-center font-bold">Doubts Log</span>
                </Link>
                <Link to="/student-mistakes" className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all">
                  <div className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center"><AlertCircle size={16} /></div>
                  <span className="text-[10px] text-slate-600 text-center font-bold">Mistakes</span>
                </Link>
                <Link to="/session-log" className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><ClipboardList size={16} /></div>
                  <span className="text-[10px] text-slate-600 text-center font-bold">Session Log</span>
                </Link>
                <Link to="/attendance" className="flex flex-col items-center gap-2 p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center"><CalendarDays size={16} /></div>
                  <span className="text-[10px] text-slate-600 text-center font-bold">Attendance</span>
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Live Anti-Cheating Control Panel View */
        (() => {
          const allLogs = relevantAttempts.flatMap(att => 
            (att?.cheatingLogs ?? []).map((log: any) => ({
              ...log,
              studentName: att?.studentName ?? 'Student',
              testTitle: att?.testTitle ?? 'Test',
              attemptId: att?.id
            }))
          ).filter(Boolean).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          const totalTabSwitches = relevantAttempts.reduce((sum, a) => sum + (a?.tabSwitches ?? 0), 0);
          const activeTakers = relevantAttempts.filter(a => a?.status === 'in_progress').length;
          const flaggedCount = relevantAttempts.filter(a => (a?.tabSwitches ?? 0) >= 3 || (a?.cheatingLogs?.length ?? 0) >= 3).length;

          if (loadingAttempts) {
            return (
              <div className="flex flex-col items-center justify-center h-64 gap-2">
                <RefreshCw size={24} className="text-blue-600 animate-spin" />
                <p className="text-slate-400 text-sm font-semibold">Syncing live cheat logs...</p>
              </div>
            );
          }

          return (
            <div className="space-y-6">
              {/* Telemetry Metric Badges */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3 shadow-xs">
                  <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 flex-shrink-0 animate-pulse">
                    <Activity size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Active Test Takers</p>
                    <p className="text-xl font-bold text-slate-800">{activeTakers}</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3 shadow-xs">
                  <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 flex-shrink-0">
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Tab Switch Count</p>
                    <p className="text-xl font-bold text-slate-800">{totalTabSwitches}</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3 shadow-xs">
                  <div className="p-2.5 rounded-lg bg-red-50 text-red-500 flex-shrink-0">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Suspicion Alerts</p>
                    <p className="text-xl font-bold text-slate-800">{allLogs.length}</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3 shadow-xs">
                  <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 flex-shrink-0">
                    <Shield size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Flagged Students</p>
                    <p className="text-xl font-bold text-red-650">{flaggedCount}</p>
                  </div>
                </div>
              </div>

              {relevantAttempts.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-100 p-12 text-center shadow-xs">
                  <Shield size={32} className="text-slate-350 mx-auto mb-3" />
                  <p className="text-slate-500 font-semibold text-sm">No testing activity found</p>
                  <p className="text-slate-400 text-xs mt-1">None of your assigned students have test attempts yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Assigned Student Attempts Monitoring */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
                        <h4 className="font-bold text-slate-800 text-sm">Assigned Student Live-Sessions</h4>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total: {relevantAttempts.length}</span>
                      </div>

                      <div className="space-y-3">
                        {relevantAttempts.map((att) => {
                          const switches = att.tabSwitches ?? 0;
                          const logsCount = att.cheatingLogs?.length ?? 0;
                          const isHighRisk = switches >= 3 || logsCount >= 3;
                          
                          return (
                            <div 
                              key={att.id} 
                              onClick={() => navigate(`/student/${att.studentId}`)}
                              className="group border border-slate-100 hover:border-blue-200 bg-slate-50/30 hover:bg-white rounded-xl p-4 transition-all duration-200 cursor-pointer flex flex-col md:flex-row justify-between gap-4"
                            >
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-slate-900 text-sm">{att.studentName}</p>
                                  <Badge variant={att.status === 'in_progress' ? 'warning' : 'success'} size="sm">
                                    {att.status === 'in_progress' ? 'Taking Test' : 'Submitted'}
                                  </Badge>
                                </div>
                                <p className="text-xs text-slate-500 font-bold">
                                  {att.testTitle} · {att.sectionName}
                                </p>
                                
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-slate-455 font-bold">
                                    <span>Section Progress</span>
                                    <span>{att.progress}%</span>
                                  </div>
                                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${att.status === 'in_progress' ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                                      style={{ width: `${att.progress}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-row md:flex-col justify-between md:justify-center items-end gap-2 md:pl-4 md:border-l border-slate-100">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-400 font-bold">Tab Switches:</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${
                                    switches === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                    switches < 3 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                    'bg-red-50 text-red-700 border-red-200 animate-pulse'
                                  }`}>
                                    {switches}
                                  </span>
                                </div>

                                {isHighRisk && (
                                  <Badge variant="danger" size="sm" className="flex items-center gap-1 bg-red-50 border-red-155 animate-bounce">
                                    <AlertTriangle size={10} /> Highly Suspicious
                                  </Badge>
                                )}

                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  View Student <ChevronRight size={10} />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live Security Event Logs Feed */}
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-100 p-4 md:p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <Eye className="text-red-500" size={16} />
                          Security Audit Log
                        </h4>
                        <span className="text-[10px] bg-red-50 text-red-650 px-2 py-0.5 rounded-full font-bold">LIVE STREAM</span>
                      </div>

                      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                        {allLogs.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                            No security violation alerts detected so far.
                          </div>
                        ) : (
                          allLogs.map((log: any) => {
                            let typeBadge = <Badge variant="default" size="sm">EVENT</Badge>;
                            if (log.eventType === 'TAB_SWITCH') {
                              typeBadge = <Badge variant="warning" size="sm" className="bg-amber-50 text-amber-700 border-amber-200">TAB SWITCH</Badge>;
                            } else if (log.eventType === 'FULLSCREEN_EXIT') {
                              typeBadge = <Badge variant="danger" size="sm" className="bg-red-50 text-red-700 border-red-200">FULLSCREEN EXIT</Badge>;
                            } else if (log.eventType === 'INACTIVITY') {
                              typeBadge = <Badge variant="warning" size="sm" className="bg-orange-50 text-orange-700 border-orange-200">INACTIVE</Badge>;
                            } else if (log.eventType === 'SUSPICIOUS') {
                              typeBadge = <Badge variant="danger" size="sm" className="bg-purple-50 text-purple-700 border-purple-200 font-bold">SUSPICIOUS</Badge>;
                            }

                            return (
                              <div key={log.id} className="p-3 border border-slate-50 rounded-xl bg-slate-50/20 space-y-1.5 text-xs font-semibold">
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-slate-800 truncate max-w-[120px]">{log.studentName}</p>
                                  {typeBadge}
                                </div>
                                <p className="text-[10px] text-slate-455 truncate font-semibold">
                                  {log.testTitle}
                                </p>
                                <div className="bg-white p-2 rounded-lg border border-slate-100 text-[10px] text-slate-600 font-medium leading-relaxed">
                                  {log.metadata?.details ?? log.metadata?.reason ?? 'Switched focused window/tab detected'}
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold pt-0.5">
                                  <span className="flex items-center gap-1"><Clock size={9} /> {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                  <span>{formatDate(log.createdAt)}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}
