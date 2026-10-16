import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatDate, formatDateTime, localDateTimeToISO, isoToLocalDateTimeInput } from '../../lib/utils';
import { useParams, useNavigate } from 'react-router-dom';
import { PtmProfileSection, SatDateSelect } from '../../components/ptm/PtmReports';
import { PhoneInput } from '../../components/common/PhoneInput';
import { useUrlString } from '../../lib/urlState';
import {
  ArrowLeft, BookOpen, Target, TrendingUp, Clock, Phone, School, Calendar,
  User2, Mail, Pencil, Trash2, CheckCircle, X, Save, MessageSquare, PlusCircle,
  AlertTriangle, ChevronDown, ChevronUp,
  KeyRound, Copy, GraduationCap, Eye, CalendarClock, UserMinus, BookOpenCheck, Search, RefreshCw, Sparkles, FileText,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { StatCard } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { TutorMultiSelect } from '../../components/common/TutorMultiSelect';
import { AttemptAnalysis } from '../../components/report/AttemptAnalysis';
import { api, type DbUser } from '../../lib/api';
import { toLines } from '../../lib/sessionLog';
import { SubjectPicker } from '../../components/admin/SubjectPicker';
import { useAuthStore } from '../../store/useAuthStore';
import { defaultAssignFilter, examLabel, examTestsFirst, isCustomStudent, targetScoreHint } from '../../lib/examTrack';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';

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

interface Note { id: string; text: string; createdAt: string; author: string }
interface ClassProgressEntry { id: string; topic: string; homework?: string; notes: string; classDate: string; author: string; createdAt: string }
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

// Test Builder tags homework as subCategory "{Subject}-Homework" (e.g. "Math-Homework"),
// which does NOT contain the substring "hw" — match on "homework" instead.
const isHW = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('homework') || t.includes('homework') || t.includes(' hw') || t.endsWith('hw') || /\bhw\b/.test(t);
};

const isEnglish = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('rw') || sub.includes('english') || sub.includes('reading') || sub.includes('writing') ||
         /reading|writing|english|verbal|grammar|\brw\b/.test(t);
};

const isMath = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('math') || sub.includes('quant') ||
         /math|algebra|geometry|calc/.test(t) || /\b(m-hw|mhw)\b/.test(t) || /^m[\s-_0-9]/.test(t) || /\bm-\d+/.test(t);
};

const isWriting = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('writing') || /writing|grammar/.test(t) || /\b(w-hw|whw)\b/.test(t) || /^w[\s-_0-9]/.test(t) || /\bw-\d+/.test(t);
};

const isReading = (test: any): boolean => {
  if (isWriting(test)) return false;
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('reading') || (sub.includes('rw') && !sub.includes('writing')) || /reading|comprehension/.test(t) || /\b(r-hw|rhw)\b/.test(t) || /^r[\s-_0-9]/.test(t) || /\br-\d+/.test(t);
};

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-slate-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800 font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}

/** Short tab label for a module: "RW Module 1", "Math Module 2". */
export function AdminStudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();
  // One shared screen for admins and tutors — only permissions differ (see isTutor checks).
  const isTutor = user?.role === 'tutor';
  const backPath = isTutor ? '/my-students' : '/students';
  // Notes are keyed per owner: admins share one 'admin' bucket, tutors use their own dbId.
  const notesOwnerId = isTutor ? dbId : 'admin';

  const [student, setStudent] = useState<DbUser | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [publishedTests, setPublishedTests] = useState<DbTest[]>([]);
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  // Tutor-only: today's session-log entry gets a "Homework Assigned" line when a tutor assigns HW.
  const [progressEntries, setProgressEntries] = useState<ClassProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Assigned Homework & Tests state
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

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', parentPhone: '', dob: '', schoolName: '', grade: '', targetScore: '', targetDate: '', tutorIds: [] as string[], subjects: [] as string[] });
  const [editSaving, setEditSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [assignFilter, setAssignFilter] = useState('All');
  const [assignSubFilter, setAssignSubFilter] = useState<'All' | 'HW' | 'English' | 'Maths'>('All');
  const [assignSearch, setAssignSearch] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [newPasswordResult, setNewPasswordResult] = useState<{ password: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Test Analysis state
  // The opened attempt lives in the URL so the browser Back button closes it.
  const [expandedAttemptId, setExpandedAttemptId] = useUrlString('attempt');
  const [analysisStatus, setAnalysisStatus] = useState<Record<string, 'submitted' | 'not_submitted'>>({});

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
      api.getUser(id),
      api.getStudentAnalytics(id),
      api.getAllTests(),
      isTutor ? Promise.resolve({ users: [] as DbUser[] }) : api.getUsersByRole('TUTOR'),
      fetchAssigned(),
    ]).then(([u, a, t, tu]) => {
      const s = u.user;
      setStudent(s);
      setAnalytics(a as Analytics);
      setPublishedTests((t.tests as DbTest[]).filter((x) => x.status === 'PUBLISHED'));
      setTutors(tu.users ?? []);
      const parts = s.name.split(' ');
      setEditForm({
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        phone: s.phone || '',
        parentPhone: s.parentPhone || '',
        dob: s.dob || '',
        schoolName: s.schoolName || '',
        grade: s.grade || '',
        targetScore: s.targetScore ? String(s.targetScore) : '',
        targetDate: s.targetDate || '',
        tutorIds: s.tutors?.length ? s.tutors.map((t) => t.id) : (s.tutorId ? [s.tutorId] : []),
        subjects: s.specialization ?? [],
      });
    }).catch(() => toast.error('Failed to load student')).finally(() => setLoading(false));

  }, [id, fetchAssigned, isTutor]);

  // Load notes (and, for tutors, the session log) without blocking the page.
  useEffect(() => {
    if (!id || !notesOwnerId) return;
    api.getNotes(notesOwnerId, id).then((r) => setNotes(r.notes)).catch(() => {});
    if (isTutor) {
      api.getClassProgress(notesOwnerId, id).then((r) => setProgressEntries(r.entries)).catch(() => {});
    }
  }, [id, notesOwnerId, isTutor]);

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
    const isWritingTest = isWriting(test);
    const isReadingTest = isReading(test);
    const isEngTest = isEnglish(test);

    if (isHomework) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
          <BookOpenCheck size={12} className="text-amber-600" />
          {isMathTest ? 'Math HW' : isWritingTest ? 'Writing HW' : isReadingTest ? 'Reading HW' : isEngTest ? 'R&W HW' : 'Homework'}
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
        return <Badge variant="success">Completed</Badge>;
      case 'In Progress':
        return <Badge variant="info">In Progress</Badge>;
      case 'Expired':
        return <Badge variant="danger">Expired</Badge>;
      default:
        return <Badge variant="warning">Not Started</Badge>;
    }
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    setEditSaving(true);
    try {
      const updated = await api.updateUser(id, {
        name: `${editForm.firstName} ${editForm.lastName}`.trim(),
        grade: editForm.grade || undefined,
        targetScore: editForm.targetScore ? Number(editForm.targetScore) : undefined,
        targetDate: editForm.targetDate || undefined,
        tutorIds: editForm.tutorIds,
        phone: editForm.phone || undefined,
        parentPhone: editForm.parentPhone || undefined,
        dob: editForm.dob || undefined,
        schoolName: editForm.schoolName || undefined,
        specialization: editForm.subjects,
      });
      setStudent(updated.user);
      setEditing(false);
      toast.success('Profile updated');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleteLoading(true);
    try {
      await api.deleteUser(id);
      toast.success('Student deleted');
      navigate(backPath);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to delete');
      setDeleteLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!id) return;
    setResetPasswordLoading(true);
    try {
      const r = await api.resetUserPassword(id);
      setNewPasswordResult({ password: r.tempPassword });
      setResetPasswordOpen(false);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to reset password');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !id || !notesOwnerId) return;
    setNoteSaving(true);
    try {
      const { note } = await api.addNote(notesOwnerId, id, noteText.trim(), isTutor ? (user?.name ?? 'Tutor') : 'Admin');
      setNotes((prev) => [note, ...prev]);
      setNoteText('');
      setNoteOpen(false);
      toast.success('Note saved');
    } catch {
      toast.error('Failed to save note');
    } finally {
      setNoteSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-sm">Loading student profile…</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-500">Student not found.</p>
        <button onClick={() => navigate(backPath)} className="text-sm text-blue-600 hover:underline">Back to students</button>
      </div>
    );
  }

  // ACT only when every recorded score fits the 1-36 scale; new students default to SAT.
  const isSATStudent = !(analytics && analytics.trend.length > 0 && analytics.trend.every(d => d.score <= 36));
  // Custom-exam students: avgScore and target are percentages (see lib/examTrack).
  const customStudent = isCustomStudent(student);
  const unit = customStudent ? '%' : '';
  const scaleMax = customStudent ? 100 : isSATStudent ? 1600 : 36;
  const targetScore = (student.targetScore as number | null) ?? null;
  // Progress is measured against the target when one is set, else against the scale max.
  const target = targetScore ?? scaleMax;
  const avg = student.avgScore ?? 0;
  const gap = target - avg;
  const pct = target > 0 ? Math.min(100, (avg / target) * 100) : 0;

  const sectionData = (analytics?.sectionStats ?? []).map((s) => ({
    name: s.sectionName,
    accuracy: s.accuracy,
    timeEfficiency: s.timeAllocated > 0 ? Math.round((s.timeUsed / s.timeAllocated) * 100) : 0,
  }));

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="space-y-5 pb-8">
      <Toaster position="bottom-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={() => navigate(backPath)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 self-start transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{student.name}
            {customStudent && <span className="ml-2 align-middle rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">{examLabel(student)}</span>}
          </h1>
          <p className="text-sm text-slate-500">{student.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button variant="secondary" size="sm" icon={<X size={13} />} onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" icon={<Save size={13} />} onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" icon={<MessageSquare size={13} />} onClick={() => setNoteOpen(true)}>Note</Button>
              {!isTutor && (
                <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(true)}>Edit</Button>
              )}
              <Button size="sm" icon={<BookOpen size={13} />} onClick={() => { setAssignOpen(true); setAssignFilter(defaultAssignFilter(student, publishedTests)); setAssignSearch(''); setSelectedTestIds([]); }}>Assign Test</Button>
              {!isTutor && (
                <>
                  <button onClick={() => setResetPasswordOpen(true)}
                    className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Reset password">
                    <KeyRound size={15} />
                  </button>
                  <button onClick={() => setDeleteOpen(true)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete student">
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left column: profile card ─────────────────────────────────── */}
        <div className="space-y-4">

          {/* Avatar + name */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-bold flex-shrink-0">
                {student.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{student.name}</p>
                <p className="text-xs text-slate-400 truncate">{student.email}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="info" size="sm">Student</Badge>
                  {student.grade && <Badge variant="default" size="sm">Gr. {student.grade}</Badge>}
                  {student.onboarded && <Badge variant="success" size="sm">Onboarded</Badge>}
                  {student.stage != null && <Badge variant="purple" size="sm">Stage {student.stage}</Badge>}
                </div>
              </div>
            </div>

            {!editing ? (
              <div className="divide-y divide-slate-50">
                <InfoRow icon={<Mail size={13} />} label="Email" value={student.email} />
                <InfoRow icon={<Phone size={13} />} label="Student Phone" value={student.phone} />
                <InfoRow icon={<Phone size={13} />} label="Parent / Guardian" value={student.parentPhone} />
                <InfoRow icon={<Calendar size={13} />} label="Date of Birth"
                  value={student.dob ? formatDate(student.dob) : null} />
                <InfoRow icon={<School size={13} />} label="School" value={student.schoolName} />
                <InfoRow icon={<BookOpen size={13} />} label="Board" value={student.board} />
                <InfoRow icon={<Clock size={13} />} label="Timezone" value={student.timezone} />
                <InfoRow icon={<BookOpen size={13} />} label="Subjects" value={student.specialization?.length ? student.specialization.join(', ') : null} />
                <div className="border-t-2 border-slate-200 my-2" />
                <InfoRow icon={<Target size={13} />} label="Target Test Date"
                  value={student.targetDate ? formatDate(student.targetDate) : null} />
                <InfoRow icon={<Calendar size={13} />} label="First Class Started On"
                  value={student.firstClassDate ? formatDate(student.firstClassDate) : null} />
                <InfoRow icon={<BookOpen size={13} />} label="Preparing For" value={student.track ? examLabel(student) : null} />
                <InfoRow icon={<BookOpen size={13} />} label="Program Variant" value={student.programVariant} />
                <InfoRow icon={<BookOpen size={13} />} label="Mock Variant" value={student.mockVariant} />
                <InfoRow icon={<CheckCircle size={13} />} label="Accommodation"
                  value={student.accommodation == null ? undefined : student.accommodation ? 'Yes' : 'No'} />
                <InfoRow icon={<User2 size={13} />} label={student.tutors && student.tutors.length > 1 ? 'Tutors' : 'Tutor'}
                  value={student.tutors?.length ? student.tutors.map((t) => t.name).join(', ') : (student.tutorName || undefined)} />
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>First Name</label>
                    <input className={inputCls} value={editForm.firstName} onChange={(e) => setEditForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name</label>
                    <input className={inputCls} value={editForm.lastName} onChange={(e) => setEditForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Student Phone</label>
                  <PhoneInput className={inputCls} value={editForm.phone} onChange={(v) => setEditForm(f => ({ ...f, phone: v }))} placeholder="Student phone" />
                </div>
                <div>
                  <label className={labelCls}>Parent / Guardian Phone</label>
                  <PhoneInput className={inputCls} value={editForm.parentPhone} onChange={(v) => setEditForm(f => ({ ...f, parentPhone: v }))} placeholder="Parent phone" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Date of Birth</label>
                    <input type="date" className={inputCls} value={editForm.dob} onChange={(e) => setEditForm(f => ({ ...f, dob: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Target Test Date</label>
                    <SatDateSelect className={inputCls} value={editForm.targetDate} onChange={(v) => setEditForm(f => ({ ...f, targetDate: v }))} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>School Name</label>
                  <input className={inputCls} value={editForm.schoolName} onChange={(e) => setEditForm(f => ({ ...f, schoolName: e.target.value }))} placeholder="Lincoln High School" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Grade</label>
                    <SearchableSelect
                      options={[
                        { id: '', label: '—', searchText: 'none' },
                        ...['9', '10', '11', '12'].map(g => ({ id: g, label: `Grade ${g}`, searchText: g }))
                      ]}
                      value={editForm.grade}
                      onChange={(value) => setEditForm(f => ({ ...f, grade: value }))}
                      placeholder="Select grade"
                      minWidth="min-w-[100px]"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{targetScoreHint(student.track).label}</label>
                    <input type="number" min={targetScoreHint(student.track).min} max={targetScoreHint(student.track).max} className={inputCls} value={editForm.targetScore} onChange={(e) => setEditForm(f => ({ ...f, targetScore: e.target.value }))} placeholder={targetScoreHint(student.track).placeholder} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Assign Tutor(s)</label>
                  <TutorMultiSelect
                    options={tutors.map((t) => ({ id: t.id, name: t.name }))}
                    value={editForm.tutorIds}
                    onChange={(ids) => setEditForm(f => ({ ...f, tutorIds: ids }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Subjects to be taught</label>
                  <SubjectPicker value={editForm.subjects} onChange={(subjects) => setEditForm(f => ({ ...f, subjects }))} />
                </div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600">Progress to Target</p>
              <Badge variant={pct >= 85 ? 'success' : pct >= 70 ? 'warning' : 'danger'} size="sm">
                {pct >= 85 ? 'On Track' : pct >= 70 ? 'Progressing' : 'Needs Help'}
              </Badge>
            </div>
            <div className="flex items-end justify-between text-sm font-bold mb-2">
              <span className="text-slate-900">{avg ? `${Math.round(avg * 10) / 10}${unit}` : '—'} <span className="text-xs text-slate-400 font-normal">current</span></span>
              <span className="text-blue-600">{target}{unit} <span className="text-xs text-slate-400 font-normal">{targetScore != null ? 'target' : customStudent ? 'no target set' : `no target set (${isSATStudent ? 'SAT' : 'ACT'} max)`}</span></span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pct >= 85 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${pct}%` }} />
            </div>
            {avg > 0 && (
              <p className="text-xs text-slate-400 mt-2">
                {gap > 0 ? (customStudent ? `${Math.round(gap * 10) / 10}% to go` : `${gap} points to go`) : 'Target reached!'}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-slate-100">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
              <p className="text-sm font-semibold text-slate-700">{isTutor ? 'Tutor Notes' : 'Admin Notes'}</p>
              <button onClick={() => setNoteOpen(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                <PlusCircle size={12} /> Add
              </button>
            </div>
            {notes.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-400">No notes yet.</p>
            ) : (
              <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                {notes.map((note) => (
                  <div key={note.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-slate-600">{note.author}</p>
                      <p className="text-xs text-slate-400">{note.createdAt ? formatDate(note.createdAt) : ''}</p>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{note.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PTM reports (admins add them on the PTM Reports page) */}
          <PtmProfileSection studentId={student.id} />
        </div>

        {/* ── Right column: analytics ───────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard title="Accuracy" value={analytics ? `${analytics.overallAccuracy}%` : '—'} icon={<TrendingUp size={15} />} />
            <StatCard title="Tests Taken" value={analytics?.totalAttempts ?? 0} subtitle="completed" icon={<Clock size={15} />} />
            <StatCard title="Avg Score" value={analytics?.avgScore ?? '—'} subtitle={isSATStudent ? "out of 1600" : "out of 36"} icon={<Target size={15} />} />
            <StatCard title="Latest Score" value={analytics?.latestScore ?? '—'} subtitle={isSATStudent ? "SAT composite" : "ACT composite"} icon={<BookOpen size={15} />} />
          </div>

          {/* Score trend */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <p className="font-medium text-slate-900 text-sm mb-0.5">Score Progress</p>
            <p className="text-xs text-slate-400 mb-4">Test-by-test improvement</p>
            {!analytics || analytics.trend.length === 0 ? (
              <div className="flex items-center justify-center h-36 text-slate-300 text-sm">No test data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={analytics.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                  <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <YAxis domain={analytics.trend.some(d => d.score > 36) ? [400, 1600] : [0, 36]} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }}
                    formatter={(v, n, p) => [v, p.payload?.testTitle ?? n]} />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} name="Score" />
                  {targetScore != null && targetScore > 0 && (
                    <Line type="monotone" dataKey={() => target} stroke="#e2e8f0" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Target" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Section analysis */}
          {sectionData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="font-medium text-slate-900 text-sm mb-0.5">Section Analysis</p>
              <p className="text-xs text-slate-400 mb-4">Accuracy and time usage by section</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sectionData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="accuracy" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Accuracy %" barSize={22} />
                  <Bar dataKey="timeEfficiency" fill="#10b981" radius={[3, 3, 0, 0]} name="Time Used %" barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Assigned Homework & Tests ── */}
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">Assigned Homework &amp; Tests</h3>
                  <Badge variant="default">{assignedTests.length}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track real-time progress, completion statuses, deadlines, and review student attempts.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" icon={<GraduationCap size={13} />} onClick={openAssignHomework}>
                  Assign HW
                </Button>
                <Button size="sm" icon={<BookOpen size={13} />} onClick={() => { setAssignOpen(true); setAssignFilter(defaultAssignFilter(student, publishedTests)); setAssignSearch(''); setSelectedTestIds([]); }}>
                  Assign Test
                </Button>
              </div>
            </div>

            {/* Filter Pills & Search */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-1.5 flex-wrap max-md:flex-nowrap max-md:overflow-x-auto max-md:-mx-4 max-md:px-4 max-md:pb-1">
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 max-md:flex-shrink-0 max-md:whitespace-nowrap ${
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
                <p className="text-xs">Loading assigned tests &amp; homework...</p>
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
              <>
              {/* Phones: one card per assignment (status and due date up front) instead of the wide table. */}
              <ul className="md:hidden divide-y divide-slate-100">
                {filteredAssignedTests.map((item) => {
                  const dueInfo = formatTestDueDate(item.dueDate);
                  const totalQs = item.sections?.reduce((acc, s) => acc + (s._count?.questions ?? 0), 0) || item.totalQuestions || 0;
                  const totalMins = item.sections?.reduce((acc, s) => acc + s.durationMinutes, 0) || 0;
                  const reviewId = item.submittedAttemptId || item.latestAttemptId;
                  return (
                    <li key={item.assignmentId} className="px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm leading-snug">{item.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {[totalQs > 0 ? `${totalQs} questions` : null, totalMins > 0 ? `${totalMins} mins` : null, `${item.usedAttempts}/${item.maxAttempts} attempts`].filter(Boolean).join(' • ')}
                          </p>
                        </div>
                        <div className="flex-shrink-0">{getStatusBadge(item.status)}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {getTestBadge(item)}
                        <span className={`inline-block px-2 py-0.5 rounded text-xs border ${dueInfo.style}`}>{dueInfo.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {reviewId && (
                          <button
                            onClick={() => navigate(`/test-review/${reviewId}`)}
                            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                          >
                            Review
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/test-instructions/${item.testId}?preview=true`)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 flex items-center gap-1"
                        >
                          <Eye size={12} /> Preview
                        </button>
                        <button
                          onClick={() => {
                            setRescheduleTarget({ assignmentId: item.assignmentId, title: item.title });
                            setRescheduleValue(isoToLocalDateTimeInput(item.dueDate));
                          }}
                          className="ml-auto p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          aria-label="Reschedule due date"
                        >
                          <CalendarClock size={16} />
                        </button>
                        <button
                          onClick={() => setUnassignTarget({ assignmentId: item.assignmentId, title: item.title })}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          aria-label="Unassign this test/homework"
                        >
                          <UserMinus size={16} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="overflow-x-auto hidden md:block">
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
                              <button
                                onClick={() => navigate(`/test-instructions/${item.testId}?preview=true`)}
                                className="text-left font-semibold text-slate-900 text-sm hover:text-blue-700 hover:underline flex items-center gap-1.5 group"
                                title="Open / Preview this test"
                              >
                                <span>{item.title}</span>
                                <Eye size={13} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
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
                              <button
                                onClick={() => navigate(`/test-instructions/${item.testId}?preview=true`)}
                                className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                                title="Open and preview test questions"
                              >
                                <Eye size={12} /> Open
                              </button>
                              {(item.status === 'Completed' || item.submittedAttemptId || item.latestAttemptId) && (
                                <button
                                  onClick={() => navigate(`/test-review/${item.submittedAttemptId || item.latestAttemptId}`)}
                                  className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex items-center gap-1"
                                  title="Review attempt"
                                >
                                  Review
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
              </>
            )}
          </div>

          {/* Test history */}
          <div className="bg-white rounded-xl border border-slate-100">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
              <p className="font-medium text-slate-900 text-sm">Test History</p>
              <Button size="sm" variant="secondary" icon={<BookOpen size={12} />} onClick={() => { setAssignOpen(true); setAssignFilter(defaultAssignFilter(student, publishedTests)); setAssignSearch(''); setSelectedTestIds([]); }}>
                Assign Test
              </Button>
            </div>
            {!analytics || analytics.trend.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">No tests taken yet.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {analytics.trend.map((entry, i) => {
                  // This summary entry has no category/section data (that only loads once
                  // expanded below), so the max score isn't reliably known — score > 36 is
                  // the same SAT-vs-ACT heuristic used elsewhere (e.g. isSATStudent above).
                  const scaleMax = entry.score > 36 ? 1600 : 36;
                  const pctBar = Math.min(100, Math.round((entry.score / scaleMax) * 100));
                  const isExpanded = expandedAttemptId === entry.attemptId;
                  return (
                    <div key={i}>
                      <div
                        className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => setExpandedAttemptId(isExpanded ? '' : entry.attemptId)}
                      >
                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <BookOpen size={13} className="text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 font-medium truncate">{entry.testTitle}</p>
                          <p className="text-xs text-slate-400">{entry.date}</p>
                        </div>
                        <div className="text-right flex-shrink-0 mr-2">
                          <p className="text-base font-bold text-slate-900">{entry.score}</p>
                          <p className="text-xs text-slate-400">{entry.score > 36 ? 'scaled' : 'raw'}</p>
                        </div>
                        <div className="hidden sm:flex flex-col gap-1 w-20 flex-shrink-0">
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pctBar >= 80 ? 'bg-emerald-400' : pctBar >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${pctBar}%` }} />
                          </div>
                          <p className="text-[10px] text-slate-400 text-right">{pctBar}%</p>
                        </div>
                        <div className="flex-shrink-0 ml-1">
                          {isExpanded ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-slate-400" />}
                        </div>
                      </div>

                      {/* ─── EXPANDED TEST ANALYSIS PANEL ─── */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/40">
                          <div className="p-4" onClick={(e) => e.stopPropagation()}>
                            <AttemptAnalysis
                              attemptId={entry.attemptId}
                              header={(attempt) => {
                                const status = analysisStatus[entry.attemptId] ?? 'not_submitted';
                                const completedDate = attempt.completedAt ? formatDateTime(attempt.completedAt) : '—';
                                return (
                                  <div className="bg-white rounded-xl border border-slate-200 py-3 px-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="relative flex-shrink-0">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                          <User2 size={24} />
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                                          <CheckCircle size={8} className="text-white" />
                                        </div>
                                      </div>
                                      <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-slate-900">{attempt.test.title}</h3>
                                        <p className="text-[11px] text-slate-400 mt-0.5">Completed on {completedDate}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAnalysisStatus(prev => ({
                                            ...prev,
                                            [entry.attemptId]: status === 'submitted' ? 'not_submitted' : 'submitted'
                                          }));
                                          toast.success(status === 'submitted' ? 'Marked as not submitted' : 'Marked as submitted');
                                        }}
                                        className={`px-3 py-1.5 text-xs font-semibold text-white rounded-md transition-colors shadow-sm ${
                                          status === 'submitted'
                                            ? 'bg-emerald-600 hover:bg-emerald-700'
                                            : 'bg-blue-800 hover:bg-blue-900'
                                        }`}
                                      >
                                        {status === 'submitted' ? 'Analysis Submitted' : 'Analysis not Submitted'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Security & Integrity Logs */}
          {analytics?.cheatingLogs && analytics.cheatingLogs.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 mt-4">
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
        </div>
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

                // Tutor only: record the assignment in today's session log so the
                // "Homework Assigned" entry shows up in class progress. Admins don't log.
                if (isTutor && dbId && titles.length > 0) {
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
                    ? `${titles.length} tests assigned successfully`
                    : `"${titles[0]}" assigned successfully`
                );
                setAssignOpen(false);
                setSelectedTestIds([]);
                setAssignFilter('All');
                setAssignSubFilter('All');
                setAssignSearch('');
                fetchAssigned();
              } catch (e) {
                toast.error((e as Error).message || 'Failed to assign tests');
              } finally {
                setAssignLoading(false);
              }
            }}>{assignLoading ? 'Assigning…' : 'Assign'}</Button>
          </div>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Select one or more published tests to assign to <strong>{student.name}</strong>.</p>
          {publishedTests.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No published tests available.</p>
          ) : (() => {
            const categories = ['All', ...Array.from(new Set(publishedTests.map(t => t.category ?? 'Other')))];
            const filtered = examTestsFirst(publishedTests, student)
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
                        {isSelected && <CheckCircle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />}
                      </label>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      </Modal>

      {/* ── Reschedule Assignment Modal ── */}
      <Modal
        isOpen={!!rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        title="Reschedule Test / Homework"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setRescheduleTarget(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleReschedule} disabled={rescheduleSaving}>
              {rescheduleSaving ? 'Saving...' : 'Save New Deadline'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Set a new due date and time for <strong>"{rescheduleTarget?.title}"</strong> assigned to <strong>{student.name}</strong>.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date &amp; Time</label>
            <input
              type="datetime-local"
              value={rescheduleValue}
              onChange={(e) => setRescheduleValue(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>
      </Modal>

      {/* ── Unassign Confirmation Modal ── */}
      <Modal
        isOpen={!!unassignTarget}
        onClose={() => setUnassignTarget(null)}
        title="Unassign Test / Homework"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setUnassignTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleUnassign} disabled={unassignSaving}>
              {unassignSaving ? 'Unassigning...' : 'Unassign'}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Are you sure you want to unassign <strong>"{unassignTarget?.title}"</strong> from <strong>{student.name}</strong>?
          </p>
          <p className="text-xs text-slate-400">
            The student will no longer see this test or homework on their assigned test list.
          </p>
        </div>
      </Modal>

      {/* Add Note Modal */}
      <Modal isOpen={noteOpen} onClose={() => { setNoteOpen(false); setNoteText(''); }} title="Add Note" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim() || noteSaving}>
              {noteSaving ? 'Saving…' : 'Save Note'}
            </Button>
          </div>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Note for <strong>{student.name}</strong> — visible to admins and tutors.</p>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
            placeholder="Observations, focus areas, progress notes…" rows={4}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            autoFocus />
        </div>
      </Modal>

      {/* Admin-only modals: tutors can't delete students or reset passwords. */}
      {!isTutor && (<>
      {/* Delete Confirm Modal — moves to Trash, not a permanent delete. */}
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Move Student to Trash" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Moving…' : 'Move to Trash'}
            </Button>
          </div>
        }>
        <p className="text-sm text-slate-600">
          <strong>{student.name}</strong> will be moved to Trash and hidden from active lists. Nothing is erased — restore them or
          delete them permanently from Students → Trash at any time.
        </p>
      </Modal>

      {/* Reset Password confirm */}
      <Modal isOpen={resetPasswordOpen} onClose={() => setResetPasswordOpen(false)} title="Reset Password" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setResetPasswordOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleResetPassword} disabled={resetPasswordLoading}>
              {resetPasswordLoading ? 'Generating…' : 'Generate New Password'}
            </Button>
          </div>
        }>
        <p className="text-sm text-slate-600">
          This immediately replaces <strong>{student.name}</strong>'s current password with a new one-time password — their old
          password stops working right away.
        </p>
      </Modal>

      {/* New Password result — backdrop click disabled so a stray click can't lose a
          password that's never shown again (it's never stored in plaintext). */}
      <Modal isOpen={!!newPasswordResult} onClose={() => { setNewPasswordResult(null); setCopiedPassword(false); }} title="New Password Generated" size="sm"
        closeOnBackdrop={false}
        footer={<Button size="sm" onClick={() => { setNewPasswordResult(null); setCopiedPassword(false); }}>Done, I've saved this</Button>}>
        {newPasswordResult && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="text-sm font-semibold text-emerald-900">{student.name}</p>
              <p className="text-xs text-emerald-700 truncate">{student.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><KeyRound size={12} /> New Temporary Password</p>
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <code className="flex-1 text-base font-mono font-bold text-amber-900 tracking-widest select-all">{newPasswordResult.password}</code>
                <button onClick={() => { navigator.clipboard.writeText(newPasswordResult.password); setCopiedPassword(true); setTimeout(() => setCopiedPassword(false), 2000); }}
                  className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors flex-shrink-0" title="Copy password">
                  {copiedPassword ? <CheckCircle size={15} className="text-emerald-600" /> : <Copy size={15} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2">Copy this now — it won't be shown again. Share it with the student.</p>
            </div>
          </div>
        )}
      </Modal>
      </>)}

    </div>
  );
}
