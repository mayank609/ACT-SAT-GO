import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, PlusCircle, X, RotateCcw, Star, Clock, ChevronLeft, ChevronRight,
  Calendar, User as UserIcon, Search, CheckSquare, Square, Users, CheckCircle2,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { StatCard } from '../../components/common/Card';
import { api, type ClassProgressEntry, type ClassProgressInput } from '../../lib/api';
import { isHW, isEnglish, isMath } from '../../lib/testCategorize';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface Session extends ClassProgressEntry {
  studentId: string;
  studentName: string;
}

interface DbTest { id: string; title: string; status: string; category?: string; subCategory?: string; sections: unknown[] }

const SUBJECTS = ['SAT Math', 'SAT Reading', 'SAT Writing', 'ACT Math', 'ACT English', 'ACT Reading', 'ACT Science', 'Other'];
const STATUSES = ['Completed', 'No Show - Tutor', 'No Show - Student', 'Cancelled'] as const;
const ENGAGEMENTS = ['High', 'Medium', 'Low'] as const;
const HW_SUBFILTERS = ['HW', 'English', 'Maths', 'All'] as const;
const PAGE_SIZE = 10;

const SESSION_TYPES = ['Core Prep', 'Review Session', 'Doubt Session', 'Master Class'] as const;
// Core Prep and Master Class run a full 60-minute session; Review and Doubt
// sessions default to a shorter 30-minute slot. Tutors can still edit the
// duration field afterward — this only sets the default on type change.
const SESSION_TYPE_DEFAULT_DURATION: Record<(typeof SESSION_TYPES)[number], number> = {
  'Core Prep': 60,
  'Review Session': 30,
  'Doubt Session': 30,
  'Master Class': 60,
};

const READING_TOPICS = [
  'Words in Context', 'Traps', 'Main Idea', 'Purpose', 'Fact / Inference',
  'Illustrating Claims', 'Logically Text Completion', 'Command of Evidence',
  'Cross Text Connections', 'Overall Structure',
];
const WRITING_TOPICS = [
  'Subject-Verb Agreement-1', 'Subject-Verb Agreement-2', 'Verb Forms & Tenses', 'Modifiers',
  'Parallel Structures & Faulty Comparisons', 'Pronoun Antecedent', 'Plurals and Possessives',
  'Sentence Structure', 'Linking Clauses', 'Punctuation', 'Supplements', 'Transitions',
  'Rhetorical Synthesis', 'Command of Evidence : Quantitative',
];
const MATH_TOPICS = [
  'Linear Equation', 'Algebra', 'Functions & Polynomial', 'Quadratic Equations', 'Parabola',
  'Percentage, Proportions and Unit Conversions', 'Exponential Functions and Radical Function',
  'Statistics', 'Research Methodology', 'Geometry', 'Trigonometry',
];

// Picks the curated topic checklist for a given Subject dropdown value; subjects
// outside SAT/ACT Math/Reading/Writing-English (e.g. ACT Science, Other) fall
// back to the free-text textarea only.
function topicsForSubject(subject: string): string[] {
  if (subject.includes('Math')) return MATH_TOPICS;
  if (subject.includes('Reading')) return READING_TOPICS;
  if (subject.includes('Writing') || subject.includes('English')) return WRITING_TOPICS;
  return [];
}

const statusVariant = (status?: string): 'success' | 'danger' | 'default' | 'info' => {
  if (status === 'Completed') return 'success';
  // Covers both new ("No Show - Tutor"/"No Show - Student") and legacy ("No Show") values.
  if (status?.startsWith('No Show')) return 'danger';
  if (status === 'Scheduled') return 'info';
  return 'default';
};

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateLong = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

function to12h(time: string): { label: string; minutesFromMidnight: number } {
  const [h, m] = time.split(':').map(Number);
  const mins = h * 60 + m;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { label: `${h12}:${String(m).padStart(2, '0')} ${period}`, minutesFromMidnight: mins };
}

function formatTimeRange(startTime?: string, durationMinutes?: number): string {
  if (!startTime) return '';
  const start = to12h(startTime);
  if (!durationMinutes) return start.label;
  const endMins = (start.minutesFromMidnight + durationMinutes) % (24 * 60);
  const endH = Math.floor(endMins / 60);
  const endM = endMins % 60;
  const end = to12h(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
  return `${start.label} – ${end.label}`;
}

function toLines(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

// Table preview only — the full text is still shown in the title tooltip and in
// the session detail drawer when a row is clicked.
function truncateChars(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function StarRating({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
        >
          <Star size={size} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
        </button>
      ))}
    </div>
  );
}

function Row({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <tr className={last ? '' : 'border-b border-slate-100'}>
      <th className="w-32 sm:w-36 align-top text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 bg-slate-50 whitespace-nowrap">
        {label}
      </th>
      <td className="px-4 py-3 align-top text-slate-700">{children}</td>
    </tr>
  );
}

const emptyForm = {
  studentId: '', classDate: new Date().toISOString().split('T')[0], startTime: '', durationMinutes: '60', actualDurationMinutes: '',
  subject: SUBJECTS[0], status: 'Completed' as string, sessionType: 'Core Prep' as string, topic: '', homeworkTestIds: [] as string[], notes: '',
  understanding: 0, attendance: 'Present', engagement: 'High' as string, nextSessionGoal: '', nextSessionAt: '',
};

export function AttendancePage() {
  const { user, dbId } = useAuthStore();
  const navigate = useNavigate();

  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [entries, setEntries] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishedTests, setPublishedTests] = useState<DbTest[]>([]);
  const [hwSearch, setHwSearch] = useState('');
  const [hwSubFilter, setHwSubFilter] = useState<typeof HW_SUBFILTERS[number]>('HW');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [studentFilter, setStudentFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Session | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [studentNotes, setStudentNotes] = useState<Array<{ id: string; text: string; author: string; createdAt: string }>>([]);

  const openSession = (row: Session) => { setSelected(row); requestAnimationFrame(() => setDrawerVisible(true)); };
  const closeSession = () => { setDrawerVisible(false); setTimeout(() => setSelected(null), 200); };

  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadAll = () => {
    if (!dbId) { setLoading(false); return; }
    setLoading(true);
    api.getTutorAssignments({ tutorId: dbId })
      .then(async ({ assignments }) => {
        const studs = assignments.map(a => ({ id: a.student.id, name: a.student.name }));
        setStudents(studs);
        const lists = await Promise.all(
          studs.map(s =>
            api.getClassProgress(dbId, s.id)
              .then(r => r.entries.map(e => ({ ...e, studentId: s.id, studentName: s.name })))
              .catch(() => [] as Session[])
          )
        );
        const merged = lists.flat().sort((a, b) =>
          new Date(b.classDate).getTime() - new Date(a.classDate).getTime() ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setEntries(merged);
      })
      .finally(() => setLoading(false));
    api.getAllTests()
      .then(r => setPublishedTests((r.tests as DbTest[]).filter(t => t.status === 'PUBLISHED')))
      .catch(() => {});
  };

  useEffect(loadAll, [dbId]);

  useEffect(() => {
    if (!selected || !dbId) { setStudentNotes([]); return; }
    api.getNotes(dbId, selected.studentId).then(r => setStudentNotes(r.notes)).catch(() => setStudentNotes([]));
  }, [selected, dbId]);

  useEffect(() => { setPage(1); }, [dateFrom, dateTo, studentFilter, subjectFilter, statusFilter]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (dateFrom && e.classDate < dateFrom) return false;
      if (dateTo && e.classDate > dateTo) return false;
      if (studentFilter !== 'all' && e.studentId !== studentFilter) return false;
      if (subjectFilter !== 'all' && (e.subject ?? 'Other') !== subjectFilter) return false;
      if (statusFilter !== 'all' && (e.status ?? 'Completed') !== statusFilter) return false;
      return true;
    });
  }, [entries, dateFrom, dateTo, studentFilter, subjectFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const totalMinutes = filtered.reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
    const completedCount = filtered.filter(e => (e.status ?? 'Completed') === 'Completed').length;
    const uniqueStudents = new Set(filtered.map(e => e.studentId)).size;
    return {
      total: filtered.length,
      hoursLogged: Math.round((totalMinutes / 60) * 10) / 10,
      completionRate: filtered.length > 0 ? Math.round((completedCount / filtered.length) * 100) : 0,
      uniqueStudents,
    };
  }, [filtered]);

  const resetFilters = () => {
    setDateFrom(''); setDateTo(''); setStudentFilter('all'); setSubjectFilter('all'); setStatusFilter('all');
  };

  const openLog = () => {
    setForm({ ...emptyForm });
    setHwSearch('');
    setHwSubFilter('HW');
    setLogOpen(true);
  };

  const toggleHomeworkTest = (testId: string) => {
    setForm(f => ({
      ...f,
      homeworkTestIds: f.homeworkTestIds.includes(testId)
        ? f.homeworkTestIds.filter(id => id !== testId)
        : [...f.homeworkTestIds, testId],
    }));
  };

  const topicOptions = useMemo(() => topicsForSubject(form.subject), [form.subject]);
  const selectedTopicLines = useMemo(() => toLines(form.topic), [form.topic]);
  const isNoShow = form.status.startsWith('No Show');

  const toggleTopic = (topic: string) => {
    setForm(f => {
      const lines = toLines(f.topic);
      const next = lines.includes(topic) ? lines.filter(l => l !== topic) : [...lines, topic];
      return { ...f, topic: next.join('\n') };
    });
  };

  const homeworkOptions = useMemo(() => {
    return publishedTests
      .filter(t => (t.category ?? 'Other') === 'Practice Sheet')
      .filter(t => {
        if (hwSubFilter === 'All') return true;
        if (hwSubFilter === 'HW') return isHW(t);
        if (hwSubFilter === 'English') return isEnglish(t);
        if (hwSubFilter === 'Maths') return isMath(t);
        return true;
      })
      .filter(t => !hwSearch.trim() || t.title.toLowerCase().includes(hwSearch.trim().toLowerCase()));
  }, [publishedTests, hwSubFilter, hwSearch]);

  const handleSave = async () => {
    if (!dbId || !form.studentId || (!isNoShow && !form.topic.trim())) return;
    setSaving(true);
    try {
      const homeworkTitles = form.homeworkTestIds
        .map(id => publishedTests.find(t => t.id === id)?.title)
        .filter((t): t is string => Boolean(t));

      if (form.homeworkTestIds.length > 0) {
        await Promise.all(
          form.homeworkTestIds.map(testId => api.createTestAssignments({ testId, studentIds: [form.studentId] }))
        );
      }

      const body: ClassProgressInput = {
        // No topics are covered on a no-show — fall back to the status itself so the
        // session log still has something meaningful to show in the "Topic" column.
        topic: form.topic.trim() || (isNoShow ? form.status : ''),
        homework: homeworkTitles.join('\n') || undefined,
        notes: form.notes.trim() || undefined,
        classDate: form.classDate,
        author: user?.name ?? 'Tutor',
        startTime: form.startTime || undefined,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
        actualDurationMinutes: form.actualDurationMinutes ? Number(form.actualDurationMinutes) : undefined,
        subject: form.subject,
        status: form.status,
        sessionType: form.sessionType,
        understanding: form.understanding || undefined,
        attendance: form.attendance,
        engagement: form.engagement,
        nextSessionGoal: form.nextSessionGoal.trim() || undefined,
        nextSessionAt: form.nextSessionAt || undefined,
      };
      const { entry } = await api.addClassProgress(dbId, form.studentId, body);
      const studentName = students.find(s => s.id === form.studentId)?.name ?? 'Student';
      setEntries(prev => [{ ...entry, studentId: form.studentId, studentName }, ...prev]);
      toast.success(form.homeworkTestIds.length > 0 ? 'Session logged and homework assigned.' : 'Session logged.');
      setLogOpen(false);
    } catch {
      toast.error('Failed to log session.');
    } finally {
      setSaving(false);
    }
  };

  const sessionHistory = selected ? entries.filter(e => e.studentId === selected.studentId && e.id !== selected.id) : [];
  const studentSessionCount = selected ? entries.filter(e => e.studentId === selected.studentId).length : 0;
  const studentDaysTaught = selected ? new Set(entries.filter(e => e.studentId === selected.studentId).map(e => e.classDate)).size : 0;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-5 w-5 border-2 border-slate-300 border-t-blue-600 rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0"><ClipboardList size={18} /></div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Session Logs</h1>
            <p className="text-slate-400 text-sm">Track and manage all your tutoring sessions in one place.</p>
          </div>
        </div>
        <Button size="sm" icon={<PlusCircle size={14} />} onClick={openLog} disabled={students.length === 0}>
          Log a Session
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Sessions Logged" value={stats.total} icon={<ClipboardList size={16} />} color="blue" />
        <StatCard title="Hours Logged" value={stats.hoursLogged} icon={<Clock size={16} />} color="amber" />
        <StatCard title="Completion Rate" value={`${stats.completionRate}%`} icon={<CheckCircle2 size={16} />} color="emerald" />
        <StatCard title="Students Seen" value={stats.uniqueStudents} icon={<Users size={16} />} color="purple" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Calendar size={13} />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100" />
          <span>–</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
          <option value="all">All Students</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
          <option value="all">All Subjects</option>
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
          <option value="all">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 ml-auto">
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      {students.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 py-16 text-center">
          <UserIcon size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No students assigned yet</p>
          <p className="text-slate-400 text-sm mt-1">Once students are assigned to you, you can log sessions here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-2.5 text-xs text-slate-400 border-b border-slate-50">
            Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} sessions
          </div>
          {filtered.length === 0 ? (
            <p className="px-5 py-10 text-sm text-slate-400 text-center">No sessions match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                    <th className="px-5 py-2.5 font-medium">Date</th>
                    <th className="px-5 py-2.5 font-medium">Student</th>
                    <th className="px-5 py-2.5 font-medium">Subject</th>
                    <th className="px-5 py-2.5 font-medium">Type</th>
                    <th className="px-5 py-2.5 font-medium">Topic</th>
                    <th className="px-5 py-2.5 font-medium">Homework</th>
                    <th className="px-5 py-2.5 font-medium">Remarks</th>
                    <th className="px-5 py-2.5 font-medium">Duration</th>
                    <th className="px-5 py-2.5 font-medium">Actual</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 font-medium w-8" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(row => (
                    <tr key={row.id} onClick={() => openSession(row)}
                      className="border-b border-slate-50 last:border-0 hover:bg-blue-50/40 cursor-pointer transition-colors">
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">{fmtDate(row.classDate)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {row.studentName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-800">{row.studentName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {row.subject ? <Badge variant="info" size="sm">{row.subject}</Badge> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {row.sessionType ? <Badge variant="purple" size="sm">{row.sessionType}</Badge> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 max-w-[220px]">
                        {toLines(row.topic).length > 0 ? (
                          <span className="text-slate-600 truncate block" title={toLines(row.topic).join(', ')}>
                            {toLines(row.topic).join(', ')}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 max-w-[220px]">
                        {toLines(row.homework).length > 0 ? (
                          <span className="text-slate-600 block" title={toLines(row.homework).join(', ')}>
                            {truncateChars(toLines(row.homework).join(', '), 6)}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 max-w-[220px]">
                        {row.notes ? (
                          <span className="text-slate-600 truncate block" title={row.notes}>{row.notes}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><Clock size={12} />{row.durationMinutes ? `${row.durationMinutes} min` : '—'}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><Clock size={12} />{row.actualDurationMinutes ? `${row.actualDurationMinutes} min` : '—'}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={statusVariant(row.status)} size="sm">{row.status ?? 'Completed'}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300"><ChevronRight size={14} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-50">
              <p className="text-xs text-slate-400">Page {page} of {totalPages}</p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session Details slide-over */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeSession} />
          <div className={`relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col transition-transform duration-200 ease-out ${drawerVisible ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center"><ClipboardList size={15} /></div>
                <h2 className="text-base font-semibold text-slate-900">Session Details</h2>
              </div>
              <button onClick={closeSession} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm border-collapse">
                <tbody>
                  <Row label="Student">
                    <button onClick={() => navigate(`/student/${selected.studentId}`)} className="font-semibold text-blue-700 hover:underline">
                      {selected.studentName}
                    </button>
                  </Row>
                  <Row label="Session ID"><span className="text-slate-500">#{selected.id.slice(0, 8)}</span></Row>
                  <Row label="Date">{fmtDateLong(selected.classDate)}</Row>
                  <Row label="Time">{formatTimeRange(selected.startTime, selected.durationMinutes) || '—'}</Row>
                  <Row label="Actual Duration">{selected.actualDurationMinutes ? `${selected.actualDurationMinutes} min` : '—'}</Row>
                  <Row label="Subject">{selected.subject ?? '—'}</Row>
                  <Row label="Session Type">
                    {selected.sessionType ? <Badge variant="purple" size="sm">{selected.sessionType}</Badge> : '—'}
                  </Row>
                  <Row label="Status"><Badge variant={statusVariant(selected.status)} size="sm">{selected.status ?? 'Completed'}</Badge></Row>
                  <Row label="Attendance">
                    <Badge variant={selected.attendance === 'Absent' ? 'danger' : 'success'} size="sm">{selected.attendance ?? 'Present'}</Badge>
                  </Row>
                  <Row label="Understanding"><StarRating value={selected.understanding ?? 0} size={13} /></Row>
                  <Row label="Engagement">
                    <Badge variant={selected.engagement === 'Low' ? 'danger' : selected.engagement === 'Medium' ? 'warning' : 'success'} size="sm">
                      {selected.engagement ?? '—'}
                    </Badge>
                  </Row>
                  <Row label="Topics Covered">
                    {toLines(selected.topic).length === 0 ? (
                      <span className="text-slate-400">Not recorded.</span>
                    ) : (
                      <ul className="space-y-1">
                        {toLines(selected.topic).map((t, i) => (
                          <li key={i} className="flex gap-2"><span className="text-slate-300">•</span>{t}</li>
                        ))}
                      </ul>
                    )}
                  </Row>
                  <Row label="Homework Assigned">
                    {toLines(selected.homework).length === 0 ? (
                      <span className="text-slate-400">None assigned.</span>
                    ) : (
                      <ul className="space-y-1">
                        {toLines(selected.homework).map((t, i) => (
                          <li key={i} className="flex gap-2"><span className="text-slate-300">•</span>{t}</li>
                        ))}
                      </ul>
                    )}
                  </Row>
                  <Row label="Tutor Remarks">{selected.notes || <span className="text-slate-400">—</span>}</Row>
                  <Row label="Next Session Goal">{selected.nextSessionGoal || <span className="text-slate-400">—</span>}</Row>
                  <Row label="Next Session">
                    {selected.nextSessionAt
                      ? new Date(selected.nextSessionAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : <span className="text-slate-400">—</span>}
                  </Row>
                  <Row label="Logged By">{selected.author}</Row>
                  <Row label="Total Sessions"><span className="font-semibold text-slate-900">{studentSessionCount}</span> with this student</Row>
                  <Row label="Days Taught"><span className="font-semibold text-slate-900">{studentDaysTaught}</span> distinct days</Row>

                  <Row label="Tutor Notes">
                    {studentNotes.length === 0 ? (
                      <span className="text-slate-400">No notes for {selected.studentName} yet.</span>
                    ) : (
                      <table className="w-full text-xs border border-slate-100 rounded-lg overflow-hidden">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400">
                            <th className="text-left font-medium px-2 py-1.5 w-24">Author</th>
                            <th className="text-left font-medium px-2 py-1.5 w-24">Date</th>
                            <th className="text-left font-medium px-2 py-1.5">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentNotes.map(note => (
                            <tr key={note.id} className="border-t border-slate-100">
                              <td className="px-2 py-1.5 align-top whitespace-nowrap text-slate-600">{note.author}</td>
                              <td className="px-2 py-1.5 align-top whitespace-nowrap text-slate-400">{note.createdAt}</td>
                              <td className="px-2 py-1.5 align-top text-slate-700">{note.text}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Row>

                  <Row label="Other Sessions" last>
                    {sessionHistory.length === 0 ? (
                      <span className="text-slate-400">No other sessions logged for {selected.studentName}.</span>
                    ) : (
                      <table className="w-full text-xs border border-slate-100 rounded-lg overflow-hidden">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400">
                            <th className="text-left font-medium px-2 py-1.5">Date</th>
                            <th className="text-left font-medium px-2 py-1.5">Topic</th>
                            <th className="text-left font-medium px-2 py-1.5">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionHistory.map(h => (
                            <tr key={h.id} onClick={() => setSelected(h)}
                              className="border-t border-slate-100 cursor-pointer hover:bg-blue-50/40 transition-colors">
                              <td className="px-2 py-1.5 align-top whitespace-nowrap text-slate-500">{fmtDate(h.classDate)}</td>
                              <td className="px-2 py-1.5 align-top text-slate-700">{toLines(h.topic)[0] ?? 'Session'}</td>
                              <td className="px-2 py-1.5 align-top"><Badge variant={statusVariant(h.status)} size="sm">{h.status ?? 'Completed'}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Row>
                </tbody>
              </table>

              <div className="p-4">
                <Button variant="secondary" size="sm" className="w-full" onClick={() => navigate(`/student/${selected.studentId}`)}>
                  View Full Student Profile & Analytics
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Session Modal */}
      <Modal isOpen={logOpen} onClose={() => setLogOpen(false)} title="Log a Session" size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!form.studentId || (!isNoShow && !form.topic.trim()) || saving}>
              {saving ? 'Saving...' : 'Save Session'}
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Student</label>
              <select value={form.studentId} onChange={(e) => setForm(f => ({ ...f, studentId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option value="">Select student…</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
              <select value={form.subject} onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100">
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Session Type</label>
            <div className="flex flex-wrap gap-1.5">
              {SESSION_TYPES.map(t => (
                <button key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, sessionType: t, durationMinutes: String(SESSION_TYPE_DEFAULT_DURATION[t]) }))}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    form.sessionType === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
              <input type="date" value={form.classDate} onChange={(e) => setForm(f => ({ ...f, classDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Time</label>
              <input type="time" value={form.startTime} onChange={(e) => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Scheduled Duration (min)</label>
              <input type="number" min={0} value={form.durationMinutes} onChange={(e) => setForm(f => ({ ...f, durationMinutes: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Actual Duration (min)</label>
              <input type="number" min={0} value={form.actualDurationMinutes} onChange={(e) => setForm(f => ({ ...f, actualDurationMinutes: e.target.value }))}
                placeholder="How long the session actually ran"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map(s => (
                <button key={s} type="button"
                  onClick={() => setForm(f => ({
                    ...f, status: s,
                    // Keep attendance consistent with whichever side didn't show —
                    // it's hidden from the form for a no-show, so it can't be corrected by hand.
                    attendance: s === 'No Show - Student' ? 'Absent' : s === 'No Show - Tutor' ? 'Present' : f.attendance,
                  }))}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    form.status === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {isNoShow ? (
            // Nothing was taught on a no-show — swap the topics UI for a single
            // remarks box (e.g. why they missed it, any follow-up plan).
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
              <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Reason for the no-show, any follow-up plan..." rows={3} autoFocus
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" />
            </div>
          ) : (
            <>
              {topicOptions.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-600">Topics Covered</label>
                    {selectedTopicLines.length > 0 && (
                      <span className="text-xs font-semibold text-blue-600">{selectedTopicLines.length} selected</span>
                    )}
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto divide-y divide-slate-50">
                    {topicOptions.map(topic => {
                      const isSelected = selectedTopicLines.includes(topic);
                      return (
                        <label key={topic}
                          className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleTopic(topic)} className="sr-only" />
                          {isSelected ? <CheckSquare size={14} className="text-blue-600 flex-shrink-0" /> : <Square size={14} className="text-slate-300 flex-shrink-0" />}
                          <span className="text-sm text-slate-700 flex-1">{topic}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {topicOptions.length > 0 ? 'Topics Covered (one per line — checked items above are added here automatically)' : 'Topics Covered (one per line)'}
                </label>
                <textarea value={form.topic} onChange={(e) => setForm(f => ({ ...f, topic: e.target.value }))}
                  placeholder={'Linear equations in one variable\nWord problems using equations'} rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" autoFocus={topicOptions.length === 0} />
              </div>
            </>
          )}

          {!isNoShow && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-600">Homework Assigned (from Test Builder, optional)</label>
                  {form.homeworkTestIds.length > 0 && (
                    <span className="text-xs font-semibold text-blue-600">{form.homeworkTestIds.length} selected</span>
                  )}
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 border-b border-slate-200">
                    <div className="flex gap-1">
                      {HW_SUBFILTERS.map(f => (
                        <button key={f} type="button" onClick={() => setHwSubFilter(f)}
                          className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                            hwSubFilter === f ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}>
                          {f}
                        </button>
                      ))}
                    </div>
                    <div className="relative flex-1 min-w-[140px]">
                      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input type="text" value={hwSearch} onChange={(e) => setHwSearch(e.target.value)}
                        placeholder="Search worksheets…"
                        className="w-full pl-6 pr-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100" />
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
                    {homeworkOptions.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No published worksheets match.</p>
                    ) : homeworkOptions.map(t => {
                      const isSelected = form.homeworkTestIds.includes(t.id);
                      return (
                        <label key={t.id}
                          className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleHomeworkTest(t.id)} className="sr-only" />
                          {isSelected ? <CheckSquare size={14} className="text-blue-600 flex-shrink-0" /> : <Square size={14} className="text-slate-300 flex-shrink-0" />}
                          <span className="text-sm text-slate-700 truncate flex-1">{t.title}</span>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">{(t.sections as unknown[]).length} sections</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tutor Remarks (optional)</label>
                <textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Student showed good improvement..." rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" />
              </div>

              <div className="grid grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Understanding</label>
                  <StarRating value={form.understanding} onChange={(v) => setForm(f => ({ ...f, understanding: v }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Attendance</label>
                  <div className="flex gap-1.5">
                    {['Present', 'Absent'].map(a => (
                      <button key={a} type="button" onClick={() => setForm(f => ({ ...f, attendance: a }))}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          form.attendance === a ? (a === 'Absent' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white') : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Engagement</label>
                  <select value={form.engagement} onChange={(e) => setForm(f => ({ ...f, engagement: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100">
                    {ENGAGEMENTS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Next Session Goal (optional)</label>
              <input type="text" value={form.nextSessionGoal} onChange={(e) => setForm(f => ({ ...f, nextSessionGoal: e.target.value }))}
                placeholder="Finish Module 2 & start inequalities"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Next Session (optional)</label>
              <input type="datetime-local" value={form.nextSessionAt} onChange={(e) => setForm(f => ({ ...f, nextSessionAt: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
