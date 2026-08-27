import { useState, useEffect, useMemo } from 'react';
import {
  Users, Shield, Settings, Activity, Plus, Trash2, Server, Database, Zap, Check, X, KeyRound, Copy, CheckCircle,
  CalendarDays, Target, ArrowRight, Clock, Pencil,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { ScoreDistributionBars } from '../../components/common/ScoreDistributionBars';
import { Modal } from '../../components/common/Modal';
import { api } from '../../lib/api';
import type { DbUser } from '../../lib/api';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type TabKey = 'overview' | 'users' | 'permissions' | 'sat_dates' | 'system';

const roleColors: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  tutor: 'bg-emerald-100 text-emerald-700',
  student: 'bg-amber-100 text-amber-700',
};

interface FeedItem {
  id: string;
  text: string;
  timestamp: string;
}

// Mirrors the SAT bucket thresholds used server-side in /api/analytics/platform
// so clicking a bar can filter students by the exact same range. This console
// always reports SAT score distribution.
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

export function SuperAdminDashboard() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [users, setUsers] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState<string>('all');
  const [permissions, setPermissions] = useState<any[]>([]);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionsSaved, setPermissionsSaved] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [deleteUser, setDeleteUser] = useState<DbUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', role: 'student' as string });
  const [createdPassword, setCreatedPassword] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<DbUser | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'student', hourlyRate: '' });

  const [activityData, setActivityData] = useState<{ date: string; attempts: number; completions: number }[]>([]);
  const [scoreDistData, setScoreDistData] = useState<{ range: string; count: number }[]>([]);
  const [avgScoreImprovement, setAvgScoreImprovement] = useState<number | null>(null);
  const [subjectStrength, setSubjectStrength] = useState<{ rw: number | null; math: number | null }>({ rw: null, math: null });
  const [overallAccuracy, setOverallAccuracy] = useState<number | null>(null);
  const [recentActivity, setRecentActivity] = useState<FeedItem[]>([]);
  const [questionsAttemptedThisWeek, setQuestionsAttemptedThisWeek] = useState(0);
  const [avgStudyHoursThisWeek, setAvgStudyHoursThisWeek] = useState<number | null>(null);
  const [selectedRange, setSelectedRange] = useState<string | null>(null);

  // Per-student "last mock / last HW / last session" activity — drives the
  // attention list and the target-date list's "days since last class" column.
  const [studentActivity, setStudentActivity] = useState<Record<string, { lastMockDate: string | null; lastHwDate: string | null; lastSessionDate: string | null }>>({});

  // Official SAT test-date calendar (admin-managed, separate from a student's own target date).
  const [satTestDates, setSatTestDates] = useState<string[]>([]);
  const [newSatDate, setNewSatDate] = useState('');
  const [satDateSaving, setSatDateSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getUsersByRole().then((r) => setUsers(r.users)),
      api.getPermissions().then((r) => setPermissions(r.permissions)),
      api.getPlatformAnalytics().then((r) => {
        setActivityData(r.activityData || []);
        // Always SAT — this console reports on SAT performance specifically.
        setScoreDistData(r.scoreDistributionSAT || []);
        setAvgScoreImprovement(r.avgScoreImprovement);
        setSubjectStrength(r.subjectStrength);
        setOverallAccuracy(r.overallAccuracy);
        setRecentActivity(r.recentActivity);
        setQuestionsAttemptedThisWeek(r.questionsAttemptedThisWeek);
        setAvgStudyHoursThisWeek(r.avgStudyHoursThisWeek);
      }).catch(() => {}),
      api.getStudentActivity().then((r) => {
        const map: typeof studentActivity = {};
        for (const a of r.activity) map[a.studentId] = a;
        setStudentActivity(map);
      }).catch(() => {}),
      api.getSettings().then((r) => setSatTestDates(r.satTestDates ?? [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const roleCounts = { all: users.length, super_admin: 0, admin: 0, tutor: 0, student: 0 } as Record<string, number>;
  users.forEach((u) => { roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1; });

  const filteredUsers = userFilter === 'all' ? users : users.filter((u) => u.role === userFilter);

  const students = useMemo(() => users.filter((u) => u.role === 'student'), [users]);
  const tutors = useMemo(() => users.filter((u) => u.role === 'tutor'), [users]);

  const studentsWithScore = useMemo(() => students.filter((s) => s.avgScore != null), [students]);

  const studentsInSelectedRange = useMemo(() => {
    if (!selectedRange) return [];
    const bucket = SAT_BUCKETS.find((b) => b.label === selectedRange);
    if (!bucket) return [];
    return studentsWithScore
      .filter((s) => (s.avgScore ?? 0) > bucket.min && (s.avgScore ?? 0) <= bucket.max)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
  }, [selectedRange, studentsWithScore]);

  const daysSince = (iso: string | null | undefined) =>
    iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

  // Attention list: flags below-target gap, zero attempts, a long session gap, or general
  // inactivity — then, for every flagged student, breaks the reason down into the concrete
  // signals a tutor/admin actually needs (last mock, last homework, last logged session).
  const attentionList = useMemo(() => {
    const now = Date.now();
    type Row = { student: DbUser; reason: string; severity: 'High' | 'Medium' | 'Low'; dMock: number | null; dHw: number | null; dSession: number | null };
    const rows: Row[] = [];
    for (const s of students) {
      const activity = studentActivity[s.id];
      const dMock = daysSince(activity?.lastMockDate);
      const dHw = daysSince(activity?.lastHwDate);
      const dSession = daysSince(activity?.lastSessionDate);
      let reason = '';
      let severity: 'High' | 'Medium' | 'Low' | null = null;

      if (s.targetScore != null && s.avgScore != null && s.avgScore < s.targetScore) {
        const gap = Math.round((s.targetScore - s.avgScore) * 10) / 10;
        reason = `${gap} pts below target`;
        severity = gap >= 5 ? 'High' : gap >= 2 ? 'Medium' : 'Low';
      } else if ((s.testsAttempted ?? 0) === 0) {
        reason = 'No tests attempted yet';
        severity = 'Medium';
      } else if (dSession !== null && dSession >= 14) {
        reason = `No session in ${dSession}d`;
        severity = dSession >= 30 ? 'High' : 'Medium';
      } else if (s.lastActive) {
        const daysInactive = Math.floor((now - new Date(s.lastActive).getTime()) / 86_400_000);
        if (daysInactive >= 7) {
          reason = `No practice in ${daysInactive}d`;
          severity = daysInactive >= 21 ? 'High' : 'Medium';
        }
      }

      if (severity) rows.push({ student: s, reason, severity, dMock, dHw, dSession });
    }
    const rank = { High: 0, Medium: 1, Low: 2 };
    return rows.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }, [students, studentActivity]);

  // Every student with a target date, nearest first — plus how long it's been since
  // their last logged tutoring session, so this doubles as an at-a-glance check-in list.
  const upcomingTargets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return students
      .filter((s) => s.targetDate)
      .map((s) => ({ student: s, date: new Date(s.targetDate as string), dSession: daysSince(studentActivity[s.id]?.lastSessionDate) }))
      .filter((t) => !isNaN(t.date.getTime()) && t.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [students, studentActivity]);

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

  // Recent signups (from the already-loaded users list) merged with the
  // backend's recent-completions feed into a single, real activity timeline.
  const mergedActivity = useMemo(() => {
    const fourteenDaysAgo = Date.now() - 14 * 86_400_000;
    const signups: FeedItem[] = users
      .filter((u) => new Date(u.createdAt).getTime() >= fourteenDaysAgo)
      .map((u) => ({ id: `signup-${u.id}`, text: `${u.name} joined as ${u.role.replace('_', ' ')}`, timestamp: u.createdAt }));
    return [...recentActivity, ...signups]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 30);
  }, [recentActivity, users]);

  const mocksCompletedThisWeek = activityData.reduce((a, d) => a + d.completions, 0);

  const handleAddUser = async () => {
    if (!addForm.name || !addForm.email) return;
    setSaving(true);
    try {
      const res = await api.createUser({ name: addForm.name, email: addForm.email, role: addForm.role });
      setUsers((prev) => [...prev, res.user]);
      const tempName = addForm.name;
      const tempEmail = addForm.email;
      setAddForm({ name: '', email: '', role: 'student' });
      setShowAddUser(false);
      if (res.tempPassword) {
        setCreatedPassword({ name: tempName, email: tempEmail, password: res.tempPassword });
      }
    } catch {
      // keep modal open on error
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setSaving(true);
    try {
      await api.deleteUser(deleteUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
      setDeleteUser(null);
    } catch {
      // keep modal open on error
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (user: DbUser) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'student',
      hourlyRate: user.hourlyRate != null ? String(user.hourlyRate) : '',
    });
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const rateVal = editForm.hourlyRate.trim() === '' ? null : Number(editForm.hourlyRate);
      const res = await api.updateUser(editingUser.id, {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        hourlyRate: rateVal,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, ...res.user } : u))
      );
      setEditingUser(null);
    } catch {
      // keep modal open on error
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (idx: number, role: string) => {
    if (role === 'super_admin') return;
    setPermissions((prev) => prev.map((p, i) => i === idx ? { ...p, [role]: !p[role as keyof typeof p] } : p));
  };

  const handleSavePermissions = async () => {
    setPermissionsSaving(true);
    try {
      const res = await api.updatePermissions(permissions);
      setPermissions(res.permissions);
      setPermissionsSaved(true);
      setTimeout(() => setPermissionsSaved(false), 3000);
    } catch {
      // silent
    } finally {
      setPermissionsSaving(false);
    }
  };

  const handleAddSatDate = async () => {
    if (!newSatDate) return;
    setSatDateSaving(true);
    try {
      const next = [...new Set([...satTestDates, newSatDate])].sort();
      const r = await api.updateSettings({ satTestDates: next });
      setSatTestDates(r.satTestDates ?? next);
      setNewSatDate('');
    } catch {
      // silent
    } finally {
      setSatDateSaving(false);
    }
  };

  const handleRemoveSatDate = async (date: string) => {
    const next = satTestDates.filter((d) => d !== date);
    setSatTestDates(next); // optimistic — this list is small and low-stakes to roll back on failure
    try {
      await api.updateSettings({ satTestDates: next });
    } catch {
      setSatTestDates(satTestDates);
    }
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Activity size={14} /> },
    { key: 'users', label: 'User Management', icon: <Users size={14} /> },
    { key: 'permissions', label: 'Roles & Permissions', icon: <Shield size={14} /> },
    { key: 'sat_dates', label: 'SAT Dates', icon: <CalendarDays size={14} /> },
    { key: 'system', label: 'System', icon: <Settings size={14} /> },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Super Admin Console</h1>
          <p className="text-slate-500 text-sm mt-0.5">Full platform control and configuration</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  tab === t.key ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <Badge variant="purple" className="flex-shrink-0">Super Admin</Badge>
        </div>
      </div>

      {/* Overview */}
      {tab === 'overview' && (() => {
        const roleChartData = [
          { name: 'Super Admin', value: roleCounts['super_admin'] ?? 0, color: '#a855f7' },
          { name: 'Admin', value: roleCounts['admin'] ?? 0, color: '#3b82f6' },
          { name: 'Tutor', value: roleCounts['tutor'] ?? 0, color: '#10b981' },
          { name: 'Student', value: roleCounts['student'] ?? 0, color: '#f59e0b' },
        ].filter(item => item.value > 0);

        return (
          <div className="space-y-5 md:space-y-6">
            {/* Info strip */}
            <div className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3 max-w-sm">
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

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              <StatCard title="Total Users" value={loading ? '…' : users.length} subtitle={`${roleCounts['student'] ?? 0} students`} icon={<Users size={20} />} color="blue" />
              <StatCard title="Tutors" value={loading ? '…' : roleCounts['tutor'] ?? 0} subtitle="active tutors" icon={<Shield size={20} />} color="purple" />
              <StatCard title="Admins" value={loading ? '…' : (roleCounts['admin'] ?? 0) + (roleCounts['super_admin'] ?? 0)} subtitle="platform admins" icon={<Zap size={20} />} color="amber" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <StatCard
                title="Score Improvement"
                value={avgScoreImprovement != null ? `${avgScoreImprovement > 0 ? '+' : ''}${avgScoreImprovement}` : '—'}
                subtitle="last 30 vs prior 30 days"
                trend={avgScoreImprovement != null ? { value: Math.abs(avgScoreImprovement), positive: avgScoreImprovement >= 0 } : undefined}
              />
              <StatCard title="Practice Qs This Week" value={questionsAttemptedThisWeek} subtitle="questions answered" />
              <StatCard title="Avg Accuracy" value={overallAccuracy != null ? `${overallAccuracy}%` : '—'} subtitle="recent submitted attempts" />
            </div>

            {/* Students Requiring Attention + Upcoming Target Dates — both full, scrollable student lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card padding="none">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Students Requiring Attention</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Below target, or behind on mocks / homework / sessions</p>
                  </div>
                  <Link to="/students" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 flex-shrink-0">
                    View all <ArrowRight size={12} />
                  </Link>
                </div>
                {attentionList.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400">Nobody needs attention right now.</p>
                ) : (
                  <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                    {attentionList.map(({ student, reason, severity, dMock, dHw, dSession }) => (
                      <div key={student.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-semibold text-xs flex-shrink-0">
                          {student.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 truncate">{student.name}</p>
                          <p className="text-xs text-slate-400 truncate">{reason}</p>
                          <p className="text-[11px] text-slate-300 truncate mt-0.5">
                            Mock: {dMock != null ? `${dMock}d ago` : 'never'} · HW: {dHw != null ? `${dHw}d ago` : 'never'} · Session: {dSession != null ? `${dSession}d ago` : 'never'}
                          </p>
                        </div>
                        <Badge variant={severity === 'High' ? 'danger' : severity === 'Medium' ? 'warning' : 'default'} size="sm">
                          {severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card padding="none">
                <div className="px-5 py-3.5 border-b border-slate-50">
                  <h3 className="font-bold text-slate-800 text-sm">Upcoming Target Dates</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Every student with a target date, nearest first</p>
                </div>
                {upcomingTargets.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400">No target dates set yet.</p>
                ) : (
                  <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                    {upcomingTargets.map(({ student, date, dSession }) => {
                      const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
                      return (
                        <div key={student.id} className="flex items-center gap-3 px-5 py-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                            <Target size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-800 truncate">{student.name}</p>
                            <p className="text-xs text-slate-400">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <Badge variant="info" size="sm">{days}d left</Badge>
                            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 justify-end">
                              <Clock size={10} /> {dSession != null ? `${dSession}d since last class` : 'no class yet'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Score Distribution + Students by Score Range (merged) + Subject Strength + User Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
              <Card className="lg:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Score Distribution</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Click a bar to see those students</p>
                  </div>
                  {selectedRange && (
                    <button onClick={() => setSelectedRange(null)} className="text-xs text-purple-600 hover:text-purple-700 flex-shrink-0">Clear</button>
                  )}
                </div>
                <div className="mt-4">
                  {loading ? (
                    <div className="h-40 flex items-center justify-center"><p className="text-sm text-slate-400">Loading…</p></div>
                  ) : scoreDistData.length === 0 ? (
                    <div className="h-40 flex items-center justify-center"><p className="text-sm text-slate-400">No score distribution data</p></div>
                  ) : (
                    <ScoreDistributionBars
                      data={scoreDistData}
                      selectedRange={selectedRange}
                      onSelect={(range) => setSelectedRange((prev) => (prev === range ? null : range))}
                      accent="purple"
                    />
                  )}
                </div>
                {/* Students in the clicked range, right under the bars they came from. */}
                {selectedRange && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-600">Students: {selectedRange}</p>
                      <Badge variant="info" size="sm">{studentsInSelectedRange.length}</Badge>
                    </div>
                    {studentsInSelectedRange.length === 0 ? (
                      <p className="text-sm text-slate-400 py-2">No students in this range.</p>
                    ) : (
                      <div className="divide-y divide-slate-50 max-h-56 overflow-y-auto">
                        {studentsInSelectedRange.map((s) => (
                          <div key={s.id} className="flex items-center gap-3 py-2.5">
                            <div className="w-7 h-7 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 font-semibold text-xs flex-shrink-0">
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
                )}
              </Card>

              <Card>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Subject Strength</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Accuracy by section</p>
                </div>
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
              </Card>

              <Card className="flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">User Distribution</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Active platform members by role</p>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center py-2">
                  {loading ? (
                    <p className="text-sm text-slate-400">Loading…</p>
                  ) : roleChartData.length === 0 ? (
                    <p className="text-sm text-slate-400">No users found</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie
                            data={roleChartData}
                            innerRadius={40}
                            outerRadius={58}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {roleChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: '8px',
                              border: '1px solid #f1f5f9',
                              fontSize: '11px',
                              boxShadow: 'none'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2">
                        {roleChartData.map((item) => (
                          <div key={item.name} className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                            <span>{item.name.replace('Super ', 'S. ')} ({item.value})</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </div>

            {/* Tutor Overview + Learning Analytics + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card padding="none">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
                  <h3 className="font-bold text-slate-800 text-sm">Tutor Overview</h3>
                  <Link to="/tutors" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                    View all <ArrowRight size={12} />
                  </Link>
                </div>
                {tutorOverview.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400">No tutors yet.</p>
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
              </Card>

              <Card>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Learning Analytics</h3>
                  <p className="text-xs text-slate-400 mt-0.5">This week</p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
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
              </Card>

              <Card padding="none">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-50">
                  <Activity size={14} className="text-purple-500" />
                  <h3 className="font-bold text-slate-800 text-sm">Recent Activity</h3>
                </div>
                {mergedActivity.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400">Nothing yet.</p>
                ) : (
                  <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                    {mergedActivity.map((item) => (
                      <div key={item.id} className="px-5 py-3">
                        <p className="text-sm text-slate-700">{item.text}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{relativeTime(item.timestamp)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        );
      })()}

      {/* User Management */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-1 overflow-x-auto">
              {(['all', 'super_admin', 'admin', 'tutor', 'student'] as const).map((r) => (
                <button key={r} onClick={() => setUserFilter(r)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                    userFilter === r ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {r === 'all' ? 'All' : r.replace('_', ' ')} ({roleCounts[r] ?? 0})
                </button>
              ))}
            </div>
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setShowAddUser(true)}>Add User</Button>
          </div>
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-50 to-blue-100/40 border-b border-blue-100">
                    {['Name', 'Email', 'Role', 'Tests Done', 'Avg Score', 'Created', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-blue-800 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">Loading users…</td></tr>
                  ) : filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${roleColors[u.role] ?? 'bg-slate-100 text-slate-600'}`}>
                            {u.name.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-900 truncate max-w-32">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-40">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleColors[u.role] ?? 'bg-slate-100 text-slate-600'}`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{u.testsAttempted ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{u.avgScore != null ? u.avgScore : '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleStartEdit(u)} className="p-1 text-slate-400 hover:text-blue-600 rounded" title="Edit User"><Pencil size={13} /></button>
                          {u.role !== 'super_admin' && (
                            <button onClick={() => setDeleteUser(u)} className="p-1 text-slate-400 hover:text-red-600 rounded" title="Remove User"><Trash2 size={13} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Permissions */}
      {tab === 'permissions' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900 flex items-start gap-2 shadow-xs">
            <Shield size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs uppercase tracking-wider text-blue-800">Dynamic Role-Based Access Control</p>
              <p className="text-xs text-blue-700 mt-0.5 leading-relaxed font-semibold">
                Configure platform accessibility dynamically. The active roles (Super Admin, Admin, Tutor, and Student) map directly to active client routes and database checks. Double-click or toggle switches and click Save Changes to apply instantly.
              </p>
            </div>
          </div>
          
          <Card padding="none" className="border border-slate-100 shadow-sm overflow-hidden bg-white">
            <div className="px-4 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-850 text-sm">Dynamic Permission Matrix</h3>
                <p className="text-[11px] text-slate-450 font-medium">Assign specific operational capabilities to academic roles</p>
              </div>
              <Button 
                size="sm" 
                variant={permissionsSaved ? 'success' : 'primary'}
                onClick={handleSavePermissions}
                disabled={permissionsSaving}
                className={`text-xs font-bold px-4 py-2 shadow-xs transition-all ${permissionsSaved ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              >
                {permissionsSaving ? 'Saving Matrix...' : permissionsSaved ? 'Matrix Persisted!' : 'Save Matrix Changes'}
              </Button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-50 to-blue-100/40 border-b border-blue-100">
                    <th className="px-4 py-3 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Permission Module</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">Category</th>
                    {(['super_admin', 'admin', 'tutor', 'student'] as const).map((r) => (
                      <th key={r} className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${roleColors[r]}`}>{r.replace('_', ' ')}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {permissions.map((p, i) => {
                    const catColors: Record<string, string> = {
                      view: 'bg-blue-50 text-blue-700 border-blue-150',
                      edit: 'bg-amber-50 text-amber-700 border-amber-150',
                      analytics: 'bg-emerald-50 text-emerald-700 border-emerald-150',
                      monitoring: 'bg-red-50 text-red-700 border-red-150',
                      assignment: 'bg-purple-50 text-purple-700 border-purple-150',
                      admin: 'bg-slate-100 text-slate-700 border-slate-200',
                    };
                    
                    return (
                      <tr key={p.permission} className="hover:bg-blue-50/15 transition-all">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-slate-800 text-xs">{p.label || p.permission}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{p.permission}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge className={`text-[9px] uppercase font-black tracking-wider px-2 py-0 ${catColors[p.category] || 'bg-slate-100 text-slate-600'}`}>
                            {p.category || 'general'}
                          </Badge>
                        </td>
                        {(['super_admin', 'admin', 'tutor', 'student'] as const).map((role) => (
                          <td key={role} className="px-4 py-3.5 text-center">
                            <button 
                              onClick={() => togglePermission(i, role)} 
                              disabled={role === 'super_admin'}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center mx-auto transition-all shadow-xs border ${
                                p[role]
                                  ? role === 'super_admin' 
                                    ? 'bg-purple-500 border-purple-500 text-white cursor-default' 
                                    : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-slate-50 border-slate-200 text-slate-350 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                              }`}
                            >
                              {p[role] ? <Check size={12} className="stroke-[3]" /> : <X size={12} className="stroke-[3]" />}
                            </button>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="px-4 py-3 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <Button 
                size="sm" 
                variant={permissionsSaved ? 'success' : 'primary'}
                onClick={handleSavePermissions}
                disabled={permissionsSaving}
                className="text-xs font-bold shadow-xs py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
              >
                {permissionsSaving ? 'Saving Permissions...' : permissionsSaved ? 'All Settings Saved!' : 'Save Permission Configurations'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* SAT Dates */}
      {tab === 'sat_dates' && (() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const sorted = [...satTestDates].sort();
        return (
          <div className="space-y-4">
            <Card>
              <h3 className="font-bold text-slate-800 text-sm mb-1">Add a Test Date</h3>
              <p className="text-xs text-slate-400 mb-3">Official SAT administration dates — shown across the platform's upcoming-exam views.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="date" value={newSatDate} onChange={(e) => setNewSatDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <Button size="sm" icon={<Plus size={13} />} onClick={handleAddSatDate} disabled={!newSatDate || satDateSaving}>
                  {satDateSaving ? 'Adding…' : 'Add Date'}
                </Button>
              </div>
            </Card>

            <Card padding="none">
              <div className="px-5 py-3.5 border-b border-slate-50">
                <h3 className="font-bold text-slate-800 text-sm">All Upcoming SAT Test Dates</h3>
                <p className="text-xs text-slate-400 mt-0.5">Sorted soonest first</p>
              </div>
              {sorted.length === 0 ? (
                <p className="px-5 py-8 text-sm text-slate-400 text-center">No test dates added yet.</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {sorted.map((date) => {
                    const d = new Date(`${date}T00:00:00`);
                    const days = Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
                    const isPast = days < 0;
                    return (
                      <div key={date} className={`flex items-center gap-3 px-5 py-3 ${isPast ? 'opacity-50' : ''}`}>
                        <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                          <CalendarDays size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        {isPast ? (
                          <Badge size="sm">Passed</Badge>
                        ) : days === 0 ? (
                          <Badge variant="danger" size="sm">Today</Badge>
                        ) : (
                          <Badge variant="info" size="sm">{days}d left</Badge>
                        )}
                        <button onClick={() => handleRemoveSatDate(date)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0" title="Remove date">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        );
      })()}

      {/* System */}
      {tab === 'system' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {[
              { label: 'API Server', uptime: '99.9%', icon: <Server size={16} /> },
              { label: 'Database', uptime: '99.99%', icon: <Database size={16} /> },
              { label: 'Test Delivery', uptime: '99.8%', icon: <Zap size={16} /> },
            ].map((s) => (
              <Card key={s.label} padding="sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">{s.icon}</div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{s.label}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-xs text-emerald-600">Operational · {s.uptime}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card>
            <h3 className="font-semibold text-slate-900 mb-4">Platform Configuration</h3>
            <div className="space-y-4">
              {[
                { label: 'Default Test Duration Warning', desc: 'Minutes before timer end to show warning', value: '5' },
                { label: 'Max Tab Switches Allowed', desc: 'Attempts flagged above this count', value: '3' },
                { label: 'Autosave Interval (seconds)', desc: 'Frequency of automatic answer saves', value: '30' },
                { label: 'Session Timeout (minutes)', desc: 'Inactivity before auto-logout', value: '60' },
              ].map((cfg) => (
                <div key={cfg.label} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{cfg.label}</p>
                    <p className="text-xs text-slate-500">{cfg.desc}</p>
                  </div>
                  <input type="number" defaultValue={cfg.value}
                    className="w-full sm:w-24 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-right" />
                </div>
              ))}
              <div className="flex justify-end">
                <Button size="sm">Save Configuration</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Add User Modal */}
      <Modal isOpen={showAddUser} onClose={() => setShowAddUser(false)} title="Add New User"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAddUser(false)}>Cancel</Button>
            <Button size="sm" icon={<Plus size={13} />} onClick={handleAddUser} disabled={saving}>
              {saving ? 'Creating…' : 'Create User'}
            </Button>
          </div>
        }>
        <div className="space-y-3">
          {[
            { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Full name' },
            { label: 'Email Address', key: 'email', type: 'email', placeholder: 'user@example.com' },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
              <input type={f.type} value={addForm[f.key as 'name' | 'email']}
                onChange={(e) => setAddForm((p) => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={f.placeholder} />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select value={addForm.role} onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="student">Student</option>
              <option value="tutor">Tutor</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="Edit User Details"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button size="sm" onClick={handleEditUser} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        }>
        <div className="space-y-3">
          {[
            { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Full name' },
            { label: 'Email Address', key: 'email', type: 'email', placeholder: 'user@example.com' },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
              <input type={f.type} value={editForm[f.key as 'name' | 'email']}
                onChange={(e) => setEditForm((p) => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={f.placeholder} />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="student">Student</option>
              <option value="tutor">Tutor</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          {editForm.role === 'tutor' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Compensation Rate ($/hr)</label>
              <input type="number" value={editForm.hourlyRate}
                onChange={(e) => setEditForm((p) => ({ ...p, hourlyRate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Compensation rate" />
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteUser} onClose={() => setDeleteUser(null)} title="Remove User" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDeleteUser} disabled={saving}>Remove</Button>
          </div>
        }>
        <p className="text-sm text-slate-600">Remove <strong>{deleteUser?.name}</strong> from the platform view? Their data in the database will remain.</p>
      </Modal>

      {/* Temp Password Modal */}
      <Modal isOpen={!!createdPassword} onClose={() => { setCreatedPassword(null); setCopiedPassword(false); }} title="User Created" size="sm"
        footer={<Button size="sm" onClick={() => { setCreatedPassword(null); setCopiedPassword(false); }}>Done</Button>}>
        {createdPassword && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-sm font-semibold text-emerald-900">{createdPassword.name}</p>
              <p className="text-xs text-emerald-700 truncate">{createdPassword.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><KeyRound size={12} /> Temporary Password</p>
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <code className="flex-1 text-base font-mono font-bold text-amber-900 tracking-widest select-all">{createdPassword.password}</code>
                <button onClick={() => { navigator.clipboard.writeText(createdPassword!.password); setCopiedPassword(true); setTimeout(() => setCopiedPassword(false), 2000); }}
                  className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors flex-shrink-0" title="Copy password">
                  {copiedPassword ? <CheckCircle size={15} className="text-emerald-600" /> : <Copy size={15} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">Share this password with the user. They can change it after first login.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
