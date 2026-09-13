import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, Clock, Target, BookOpen, MessageSquare, PlusCircle,
  AlertTriangle, GraduationCap, BookOpenCheck, Search, CalendarClock, UserMinus,
  CheckCircle2, ListTodo, RefreshCw, Eye, AlertCircle, FileText, Sparkles
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { StatCard } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { api, type DbUser } from '../../lib/api';
import { isHW, isEnglish, isMath } from '../../lib/testCategorize';
import { toLines } from '../../lib/sessionLog';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';
import { formatDate, localDateTimeToISO, isoToLocalDateTimeInput } from '../../lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';

interface Note {
  id: string;
  text: string;
  createdAt: string;
  author: string;
}

interface ClassProgressEntry {
  id: string;
  topic: string;
  homework?: string;
  notes: string;
  classDate: string;
  author: string;
  createdAt: string;
}

interface Analytics {
  trend: Array<{ date: string; score: number; testTitle: string; attemptId: string }>;
  sectionStats: Array<{ sectionName: string; accuracy: number; timeAllocated: number; timeUsed: number }>;
  overallAccuracy: number;
  totalAttempts: number;
  latestScore: number;
  avgScore: number;
  cheatingLogs?: Array<{
    id: string;
    attemptId: string;
    testTitle: string;
    eventType: string;
    metadata: any;
    createdAt: string;
  }>;
}

interface DbTest { id: string; title: string; status: string; category?: string; subCategory?: string; sections: unknown[] }

export interface AssignedTestItem {
  assignmentId: string;
  testId: string;
  title: string;
  description?: string;
  category?: string;
  subCategory?: string;
  dueDate?: string;
  availableFrom?: string;
  availableUntil?: string;
  availabilityState: 'upcoming' | 'open' | 'expired';
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Expired';
  completionStatus: 'Submitted' | 'In Progress' | 'Pending';
  usedAttempts: number;
  remainingAttempts: number;
  maxAttempts: number;
  latestAttemptId?: string | null;
  inProgressAttemptId?: string | null;
  submittedAttemptId?: string | null;
  sections: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    _count?: { questions: number };
  }>;
  totalQuestions?: number;
  answeredCount?: number;
}

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();

  const [student, setStudent] = useState<DbUser | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [publishedTests, setPublishedTests] = useState<DbTest[]>([]);
  const [loading, setLoading] = useState(true);

  // Assigned Tests & Homework state
  const [assignedTests, setAssignedTests] = useState<AssignedTestItem[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(true);
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'homework' | 'mock' | 'practice' | 'pending' | 'completed'>('all');
  const [assignedSearch, setAssignedSearch] = useState('');

  // Reschedule & Unassign states
  const [rescheduleTarget, setRescheduleTarget] = useState<{ assignmentId: string; title: string } | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState('');
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<{ assignmentId: string; title: string } | null>(null);
  const [unassignSaving, setUnassignSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [assignFilter, setAssignFilter] = useState('All');
  const [assignSubFilter, setAssignSubFilter] = useState<'All' | 'HW' | 'English' | 'Maths'>('All');
  const [assignSearch, setAssignSearch] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);

  const [progressEntries, setProgressEntries] = useState<ClassProgressEntry[]>([]);

  const fetchAssigned = useCallback(async () => {
    if (!id) return;
    setAssignedLoading(true);
    try {
      const res = await api.getAssignedTests(id);
      setAssignedTests((res.assignedTests ?? []) as AssignedTestItem[]);
    } catch (err) {
      console.error('Failed to load assigned tests:', err);
    } finally {
      setAssignedLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getUser(id).then((r) => setStudent(r.user)),
      api.getStudentAnalytics(id).then((r) => setAnalytics(r)),
      api.getAllTests().then((r) => setPublishedTests(
        (r.tests as DbTest[]).filter((t) => t.status === 'PUBLISHED')
      )),
      fetchAssigned(),
    ]).finally(() => setLoading(false));
  }, [id, fetchAssigned]);

  // Load persisted notes once tutorId (dbId) is available
  useEffect(() => {
    if (!dbId || !id) return;
    api.getNotes(dbId, id)
      .then((r) => setNotes(r.notes))
      .catch(() => {});
    api.getClassProgress(dbId, id)
      .then((r) => setProgressEntries(r.entries))
      .catch(() => {});
  }, [dbId, id]);

  const handleAddNote = async () => {
    if (!noteText.trim() || !dbId || !id) return;
    setNoteSaving(true);
    try {
      const { note } = await api.addNote(dbId, id, noteText.trim(), user?.name ?? 'Tutor');
      setNotes((prev) => [note, ...prev]);
      setNoteText('');
      setNoteOpen(false);
      toast.success('Note saved.');
    } catch {
      toast.error('Failed to save note.');
    } finally {
      setNoteSaving(false);
    }
  };

  const openAssignHomework = () => {
    setAssignFilter('Practice Sheet');
    setAssignSubFilter('HW');
    setAssignOpen(true);
  };

  // Filtered assigned tests
  const filteredAssignedTests = useMemo(() => {
    return assignedTests.filter((test) => {
      const title = (test.title || '').toLowerCase();
      const cat = (test.category || '').toLowerCase();
      const sub = (test.subCategory || '').toLowerCase();
      const testIsHw = isHW(test) || sub.includes('homework') || title.includes('homework') || /\bhw\b/.test(title);
      const testIsMock = cat.includes('mock') || cat.includes('diagnostic') || title.includes('mock') || title.includes('diagnostic');
      const testIsPractice = cat.includes('practice') || sub.includes('practice') || title.includes('practice') || (!testIsHw && !testIsMock);

      if (assignedFilter === 'homework' && !testIsHw) return false;
      if (assignedFilter === 'mock' && !testIsMock) return false;
      if (assignedFilter === 'practice' && !testIsPractice) return false;
      if (assignedFilter === 'pending' && test.status !== 'Not Started' && test.status !== 'In Progress') return false;
      if (assignedFilter === 'completed' && test.status !== 'Completed') return false;

      if (assignedSearch.trim()) {
        const q = assignedSearch.toLowerCase().trim();
        return title.includes(q) || cat.includes(q) || sub.includes(q);
      }
      return true;
    });
  }, [assignedTests, assignedFilter, assignedSearch]);

  const assignedCounts = useMemo(() => {
    return {
      all: assignedTests.length,
      homework: assignedTests.filter(t => isHW(t) || (t.subCategory ?? '').toLowerCase().includes('homework') || t.title.toLowerCase().includes('homework') || /\bhw\b/i.test(t.title)).length,
      mock: assignedTests.filter(t => (t.category ?? '').toLowerCase().includes('mock') || (t.category ?? '').toLowerCase().includes('diagnostic') || t.title.toLowerCase().includes('mock') || t.title.toLowerCase().includes('diagnostic')).length,
      practice: assignedTests.filter(t => (t.category ?? '').toLowerCase().includes('practice') || t.title.toLowerCase().includes('practice')).length,
      pending: assignedTests.filter(t => t.status === 'Not Started' || t.status === 'In Progress').length,
      inProgress: assignedTests.filter(t => t.status === 'In Progress').length,
      completed: assignedTests.filter(t => t.status === 'Completed').length,
      expired: assignedTests.filter(t => t.status === 'Expired').length,
    };
  }, [assignedTests]);

  const handleReschedule = async () => {
    if (!rescheduleTarget) return;
    setRescheduleSaving(true);
    try {
      const iso = localDateTimeToISO(rescheduleValue);
      await api.rescheduleTestAssignment(rescheduleTarget.assignmentId, iso);
      toast.success(`Due date updated for "${rescheduleTarget.title}".`);
      setRescheduleTarget(null);
      fetchAssigned();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reschedule.');
    } finally {
      setRescheduleSaving(false);
    }
  };

  const handleUnassign = async () => {
    if (!unassignTarget) return;
    setUnassignSaving(true);
    try {
      await api.unassignTest(unassignTarget.assignmentId);
      toast.success(`"${unassignTarget.title}" unassigned.`);
      setUnassignTarget(null);
      fetchAssigned();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to unassign.');
    } finally {
      setUnassignSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400 text-sm">Loading...</div></div>;
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-3">
        <p className="text-slate-500">Student not found.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">Go back</button>
      </div>
    );
  }

  const target = (student.targetScore as number | null) ?? 32;
  const gap = target - (student.avgScore ?? 0);
  const pct = Math.min(100, ((student.avgScore ?? 0) / target) * 100);

  const sectionData = (analytics?.sectionStats ?? []).map((s) => ({
    name: s.sectionName,
    accuracy: s.accuracy,
    timeEfficiency: s.timeAllocated > 0 ? Math.round((s.timeUsed / s.timeAllocated) * 100) : 0,
  }));

  const formatTestDueDate = (due?: string) => {
    if (!due) return { label: 'No due date', style: 'text-slate-400 bg-slate-50 border-slate-200' };
    const d = new Date(due);
    if (isNaN(d.getTime())) return { label: 'No due date', style: 'text-slate-400 bg-slate-50 border-slate-200' };
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: `Expired ${Math.abs(diffDays)}d ago`, style: 'text-rose-700 bg-rose-50 border-rose-200 font-semibold' };
    } else if (diffDays === 0) {
      return { label: 'Due Today', style: 'text-amber-700 bg-amber-50 border-amber-200 font-semibold' };
    } else if (diffDays === 1) {
      return { label: 'Due Tomorrow', style: 'text-blue-700 bg-blue-50 border-blue-200 font-semibold' };
    } else if (diffDays <= 7) {
      return { label: `Due in ${diffDays} days (${formatDate(d)})`, style: 'text-slate-700 bg-slate-50 border-slate-200' };
    } else {
      return { label: `Due ${formatDate(d)}`, style: 'text-slate-600 bg-slate-50 border-slate-200' };
    }
  };

  const getTestBadge = (test: AssignedTestItem) => {
    const isHomework = isHW(test) || (test.subCategory ?? '').toLowerCase().includes('homework') || test.title.toLowerCase().includes('homework') || /\bhw\b/i.test(test.title);
    const isMathTest = isMath(test);
    const isEngTest = isEnglish(test);

    if (isHomework) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
          <BookOpenCheck size={12} className="text-amber-600" />
          {isMathTest ? 'Math HW' : isEngTest ? 'R&W HW' : 'Homework'}
        </span>
      );
    }
    if ((test.category ?? '').toLowerCase() === 'mock' || test.title.toLowerCase().includes('mock')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <Target size={12} className="text-blue-600" />
          Mock Test
        </span>
      );
    }
    if ((test.category ?? '').toLowerCase() === 'diagnostic' || test.title.toLowerCase().includes('diagnostic')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <Sparkles size={12} className="text-purple-600" />
          Diagnostic
        </span>
      );
    }
    if ((test.category ?? '').toLowerCase() === 'sectional' || test.title.toLowerCase().includes('sectional')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <BookOpen size={12} className="text-emerald-600" />
          Sectional
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
        <FileText size={12} className="text-slate-500" />
        {test.category || 'Practice Sheet'}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-600" />
            COMPLETED
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock size={12} className="text-blue-600 animate-pulse" />
            IN PROGRESS
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertCircle size={12} className="text-rose-600" />
            EXPIRED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <ListTodo size={12} className="text-amber-500" />
            NOT STARTED
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 self-start transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 truncate">{student.name}</h1>
          <p className="text-slate-400 text-sm">{student.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<MessageSquare size={13} />} onClick={() => setNoteOpen(true)}>
            Add Note
          </Button>
          <Button variant="secondary" size="sm" icon={<GraduationCap size={13} />} onClick={openAssignHomework}>
            Assign Homework
          </Button>
          <Button size="sm" icon={<BookOpen size={13} />} onClick={() => setAssignOpen(true)}>
            Assign Test
          </Button>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold flex-shrink-0">
            {student.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: 'Current Score', value: student.avgScore ?? '—', color: 'text-slate-900' },
              { label: 'Target Score', value: target, color: 'text-blue-600' },
              { label: 'Gap', value: gap > 0 ? `+${gap}` : String(gap), color: gap > 0 ? 'text-amber-600' : 'text-emerald-600' },
              { label: 'Tests Done', value: student.testsAttempted ?? 0, color: 'text-slate-900' },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 rounded-lg p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Progress to target</span>
            <Badge variant={pct >= 85 ? 'success' : pct >= 70 ? 'warning' : 'danger'} size="sm">
              {pct >= 85 ? 'On Track' : pct >= 70 ? 'Progressing' : 'Needs Help'}
            </Badge>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${pct >= 85 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Overall Accuracy" value={analytics ? `${analytics.overallAccuracy}%` : '—'} icon={<TrendingUp size={16} />} trend={{ value: 5, positive: true }} />
        <StatCard title="Tests Taken" value={analytics?.totalAttempts ?? 0} subtitle="submitted" icon={<Clock size={16} />} />
        <StatCard title="Avg Score" value={analytics?.avgScore ?? '—'} subtitle={analytics?.trend.some(d => d.score > 36) ? "submitted tests (SAT)" : "submitted tests (ACT)"} icon={<Target size={16} />} />
        <StatCard title="Latest Score" value={analytics?.latestScore ?? '—'} subtitle={analytics?.trend.some(d => d.score > 36) ? "SAT composite" : "ACT composite"} icon={<BookOpen size={16} />} />
      </div>

      {analytics && analytics.trend.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
            <p className="font-medium text-slate-900 text-sm mb-1">Score Progress</p>
            <p className="text-xs text-slate-400 mb-4">Test-by-test improvement</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={analytics.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                <YAxis domain={analytics.trend.some(d => d.score > 36) ? [400, 1600] : [0, 36]} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }}
                  formatter={(v, n, p) => [v, p.payload?.testTitle ?? n]} />
                <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} name="Score" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {sectionData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="font-medium text-slate-900 text-sm mb-1">Section Analysis</p>
              <p className="text-xs text-slate-400 mb-4">Accuracy by section</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sectionData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="accuracy" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Accuracy %" barSize={20} />
                  <Bar dataKey="timeEfficiency" fill="#10b981" radius={[3, 3, 0, 0]} name="Time Used %" barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Assigned Homework & Tests Section ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 via-white to-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <BookOpenCheck size={16} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Assigned Homework & Tests</h2>
                <p className="text-xs text-slate-500">
                  {assignedCounts.all} assigned • {assignedCounts.pending} pending ({assignedCounts.inProgress} in progress) • {assignedCounts.completed} completed
                  {assignedCounts.expired > 0 && ` • ${assignedCounts.expired} expired`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchAssigned}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh assignments"
            >
              <RefreshCw size={14} className={assignedLoading ? 'animate-spin text-blue-600' : ''} />
            </button>
            <Button variant="secondary" size="sm" icon={<GraduationCap size={13} />} onClick={openAssignHomework}>
              Assign HW
            </Button>
            <Button size="sm" icon={<BookOpen size={13} />} onClick={() => setAssignOpen(true)}>
              Assign Test
            </Button>
          </div>
        </div>

        {/* Filter Pills & Search */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: 'all', label: 'All', count: assignedCounts.all },
              { key: 'homework', label: 'Homework', count: assignedCounts.homework },
              { key: 'mock', label: 'Mock / Diag', count: assignedCounts.mock },
              { key: 'practice', label: 'Practice Sheets', count: assignedCounts.practice },
              { key: 'pending', label: 'Pending', count: assignedCounts.pending },
              { key: 'completed', label: 'Completed', count: assignedCounts.completed },
            ].map((tab) => {
              const active = assignedFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setAssignedFilter(tab.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    active ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                  }`}
                >
                  {tab.label}
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    active ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search assigned tests..."
              value={assignedSearch}
              onChange={(e) => setAssignedSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>

        {/* Assigned list */}
        {assignedLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <RefreshCw size={20} className="animate-spin text-blue-600" />
            <p className="text-xs">Loading assigned tests & homework...</p>
          </div>
        ) : filteredAssignedTests.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <BookOpenCheck size={32} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No assigned tests or homework found</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {assignedSearch ? 'No tests match your search filter.' : 'Assign a homework or test using the buttons above.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-semibold">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Test / Homework Name</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-center">Due Date</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Attempts</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignedTests.map((item, idx) => {
                  const dueInfo = formatTestDueDate(item.dueDate);
                  const totalQs = item.sections?.reduce((acc, s) => acc + (s._count?.questions ?? 0), 0) || item.totalQuestions || 0;
                  const totalMins = item.sections?.reduce((acc, s) => acc + s.durationMinutes, 0) || 0;

                  return (
                    <tr key={item.assignmentId} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-4 py-3 text-xs text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{item.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                            {totalQs > 0 && <span>{totalQs} questions</span>}
                            {totalMins > 0 && <span>• {totalMins} mins</span>}
                            {item.description && <span className="truncate max-w-xs">• {item.description}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {getTestBadge(item)}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs border ${dueInfo.style}`}>
                          {dueInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs whitespace-nowrap">
                        <span className="font-medium text-slate-700">
                          {item.usedAttempts} / {item.maxAttempts}
                        </span>
                        <span className="text-slate-400 block text-[10px]">
                          {item.status === 'Completed' ? 'Submitted' : `${item.remainingAttempts} left`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {(item.status === 'Completed' || item.submittedAttemptId || item.latestAttemptId) && (
                            <button
                              onClick={() => navigate(`/test-review/${item.submittedAttemptId || item.latestAttemptId}`)}
                              className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex items-center gap-1"
                              title="Review attempt"
                            >
                              <Eye size={12} /> Review
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setRescheduleTarget({ assignmentId: item.assignmentId, title: item.title });
                              setRescheduleValue(isoToLocalDateTimeInput(item.dueDate));
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                            title="Reschedule due date"
                          >
                            <CalendarClock size={14} />
                          </button>
                          <button
                            onClick={() => setUnassignTarget({ assignmentId: item.assignmentId, title: item.title })}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                            title="Unassign this test/homework"
                          >
                            <UserMinus size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Test history */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="px-5 py-3.5 border-b border-slate-50">
          <p className="font-medium text-slate-900 text-sm">Test History</p>
          <p className="text-xs text-slate-400 mt-0.5">Click any test to view full review</p>
        </div>
        {!analytics || analytics.trend.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">No tests taken yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {analytics.trend.map((entry, i) => (
              <div key={i}
                onClick={() => navigate(`/test-review/${entry.attemptId}`)}
                className="flex items-center gap-3 px-5 py-3 hover:bg-blue-50/40 transition-colors cursor-pointer group">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={13} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 group-hover:text-blue-700 transition-colors truncate">{entry.testTitle}</p>
                  <p className="text-xs text-slate-400">{entry.date}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-semibold text-slate-900">{entry.score}</p>
                  <p className="text-xs text-slate-400">/ 36</p>
                </div>
                <div className="hidden sm:block w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(entry.score / 36) * 100}%` }} />
                </div>
                <ArrowLeft size={13} className="text-slate-300 group-hover:text-blue-500 rotate-180 transition-colors flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security & Integrity Logs */}
      {analytics?.cheatingLogs && analytics.cheatingLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
            <p className="font-medium text-slate-900 text-sm flex items-center gap-1.5"><AlertTriangle size={14} className="text-red-500" /> Security & Integrity Logs</p>
          </div>
          <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
            {analytics.cheatingLogs.map((log) => (
              <div key={log.id} className="flex flex-col gap-1 px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-red-600 font-medium flex items-center gap-1.5">{log.eventType}</p>
                  <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
                <p className="text-xs text-slate-600">Test: {log.testTitle}</p>
                {log.metadata && (
                  <pre className="mt-1 text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance & Homework Log */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <div>
            <p className="font-medium text-slate-900 text-sm">Attendance & Homework Log</p>
            <p className="text-xs text-slate-400 mt-0.5">Sessions taught and homework assigned — logged from the Attendance page</p>
          </div>
          <span className="text-xs text-slate-400 flex-shrink-0">
            {new Set(progressEntries.map((e) => e.classDate)).size} day{new Set(progressEntries.map((e) => e.classDate)).size !== 1 ? 's' : ''} taught
          </span>
        </div>
        {progressEntries.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">No sessions logged yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {progressEntries.map((entry) => (
              <div key={entry.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-slate-900">{entry.topic}</p>
                  <p className="text-xs text-slate-400 flex-shrink-0">
                    {formatDate(entry.classDate)}
                  </p>
                </div>
                {toLines(entry.homework).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {toLines(entry.homework).map((hw, idx) => (
                      <span key={idx} className="text-xs text-amber-800 bg-amber-50 border border-amber-200/60 rounded-md px-2 py-0.5 inline-flex items-center gap-1">
                        <BookOpenCheck size={11} className="text-amber-600 flex-shrink-0" />
                        <span className="font-semibold">HW:</span> {hw}
                      </span>
                    ))}
                  </div>
                )}
                {entry.notes && <p className="text-sm text-slate-600 leading-relaxed mt-1">{entry.notes}</p>}
                <p className="text-xs text-slate-400 mt-1">{entry.author}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tutor Notes */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="font-medium text-slate-900 text-sm">Tutor Notes</p>
          <button onClick={() => setNoteOpen(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
            <PlusCircle size={12} /> Add note
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">No notes yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {notes.map((note) => (
              <div key={note.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-slate-600">{note.author}</p>
                  <p className="text-xs text-slate-400">{note.createdAt}</p>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{note.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Test Modal */}
      <Modal isOpen={assignOpen} onClose={() => { setAssignOpen(false); setSelectedTestIds([]); setAssignFilter('All'); setAssignSubFilter('All'); setAssignSearch(''); }}
        title="Assign Tests" size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => { setAssignOpen(false); setSelectedTestIds([]); setAssignFilter('All'); setAssignSubFilter('All'); setAssignSearch(''); }}>Cancel</Button>
            <Button size="sm" disabled={selectedTestIds.length === 0 || assignLoading} onClick={async () => {
              if (selectedTestIds.length === 0 || !id) return;
              setAssignLoading(true);
              try {
                await Promise.all(
                  selectedTestIds.map((testId) =>
                    api.createTestAssignments({ testId, studentIds: [id] })
                  )
                );
                const titles = selectedTestIds
                  .map((tId) => publishedTests.find((t) => t.id === tId)?.title)
                  .filter((t): t is string => Boolean(t));

                if (dbId && titles.length > 0) {
                  const today = new Date().toISOString().split('T')[0];
                  const todayEntry = progressEntries.find((e) => e.classDate === today);
                  if (todayEntry) {
                    const existingLines = toLines(todayEntry.homework);
                    const combined = Array.from(new Set([...existingLines, ...titles])).join('\n');
                    try {
                      const { entry: updated } = await api.updateClassProgress(dbId, id, todayEntry.id, { homework: combined });
                      setProgressEntries((prev) => prev.map((e) => e.id === todayEntry.id ? { ...e, ...updated } : e));
                    } catch {
                      // Fallback if update fails
                    }
                  } else {
                    try {
                      const { entry } = await api.addClassProgress(dbId, id, {
                        topic: 'Homework Assigned',
                        homework: titles.join('\n'),
                        classDate: today,
                        author: user?.name ?? 'Tutor',
                        status: 'Completed',
                        subject: 'Other',
                      });
                      setProgressEntries((prev) => [entry, ...prev]);
                    } catch (e) {
                      console.error('Failed to log homework progress:', e);
                    }
                  }
                }

                toast.success(
                  titles.length > 1
                    ? `${titles.length} tests assigned successfully.`
                    : `"${titles[0]}" assigned successfully.`
                );
                setAssignOpen(false);
                setSelectedTestIds([]);
                setAssignFilter('All');
                setAssignSubFilter('All');
                setAssignSearch('');
                fetchAssigned();
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : 'Failed to assign tests.');
              } finally {
                setAssignLoading(false);
              }
            }}>{assignLoading ? 'Assigning...' : 'Assign'}</Button>
          </div>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Select one or more published tests to assign to <strong>{student.name}</strong>.</p>
          {publishedTests.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No published tests available.</p>
          ) : (() => {
            const categories = ['All', ...Array.from(new Set(publishedTests.map(t => t.category ?? 'Other')))];
            const filtered = publishedTests
              .filter(t => assignFilter === 'All' || (t.category ?? 'Other') === assignFilter)
              .filter((t) => {
                if (assignFilter !== 'Practice Sheet' || assignSubFilter === 'All') return true;
                if (assignSubFilter === 'HW') return isHW(t);
                if (assignSubFilter === 'English') return isEnglish(t);
                if (assignSubFilter === 'Maths') return isMath(t);
                return true;
              })
              .filter(t => !assignSearch.trim() || t.title.toLowerCase().includes(assignSearch.trim().toLowerCase()));
            return (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setAssignFilter(cat); setAssignSubFilter('All'); }}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        assignFilter === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                      <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${assignFilter === cat ? 'bg-blue-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
                        {cat === 'All' ? publishedTests.length : publishedTests.filter(t => (t.category ?? 'Other') === cat).length}
                      </span>
                    </button>
                  ))}
                </div>

                {assignFilter === 'Practice Sheet' && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    {(['All', 'HW', 'English', 'Maths'] as const).map((sub) => {
                      const count = publishedTests
                        .filter((t) => (t.category ?? 'Other') === 'Practice Sheet')
                        .filter((t) => {
                          if (sub === 'All') return true;
                          if (sub === 'HW') return isHW(t);
                          if (sub === 'English') return isEnglish(t);
                          if (sub === 'Maths') return isMath(t);
                          return true;
                        }).length;

                      return (
                        <button
                          key={sub}
                          onClick={() => setAssignSubFilter(sub)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                            assignSubFilter === sub ? 'bg-blue-500 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                          }`}
                        >
                          {sub}
                          <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full ${assignSubFilter === sub ? 'bg-blue-400 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <input
                  type="text"
                  value={assignSearch}
                  onChange={e => { setAssignSearch(e.target.value); }}
                  placeholder="Search tests by name…"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center">No tests found.</p>
                  ) : filtered.map((test) => {
                    const isSelected = selectedTestIds.includes(test.id);
                    return (
                      <label key={test.id}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                        }`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTestIds((prev) => [...prev, test.id]);
                            } else {
                              setSelectedTestIds((prev) => prev.filter((tId) => tId !== test.id));
                            }
                          }}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{test.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{(test.sections as unknown[]).length} sections</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      </Modal>

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <Modal
          isOpen={true}
          onClose={() => setRescheduleTarget(null)}
          title="Reschedule Assignment"
          size="sm"
          footer={
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setRescheduleTarget(null)}>
                Cancel
              </Button>
              <Button size="sm" disabled={rescheduleSaving} onClick={handleReschedule}>
                {rescheduleSaving ? 'Saving...' : 'Save Due Date'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Set a new deadline for <strong>{rescheduleTarget.title}</strong>:
            </p>
            <input
              type="datetime-local"
              value={rescheduleValue}
              onChange={(e) => setRescheduleValue(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            {rescheduleValue && (
              <button
                type="button"
                onClick={() => setRescheduleValue('')}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Clear due date (No deadline)
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Unassign Confirmation Modal */}
      {unassignTarget && (
        <Modal
          isOpen={true}
          onClose={() => setUnassignTarget(null)}
          title="Unassign Test / Homework"
          size="sm"
          footer={
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setUnassignTarget(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={unassignSaving}
                onClick={handleUnassign}
              >
                {unassignSaving ? 'Unassigning...' : 'Confirm Unassign'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="flex items-start gap-3 text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed text-rose-900">
                Are you sure you want to unassign <strong>{unassignTarget.title}</strong> from <strong>{student.name}</strong>?
                Any completed attempt data will remain intact in test history.
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Note Modal */}
      <Modal isOpen={noteOpen} onClose={() => { setNoteOpen(false); setNoteText(''); }} title="Add Tutor Note" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim() || noteSaving}>
              {noteSaving ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Note for <strong>{student.name}</strong> — visible only to tutors and admins.</p>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
            placeholder="Observations, focus areas, session notes..." rows={5}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            autoFocus />
          <p className="text-xs text-slate-400">{noteText.length}/500</p>
        </div>
      </Modal>
    </div>
  );
}

