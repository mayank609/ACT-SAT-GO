import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, PlusCircle, X, RotateCcw, Star, Clock, ChevronLeft, ChevronRight,
  Calendar, User as UserIcon, BookOpen, History as HistoryIcon, MessageSquare, TrendingUp,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { api, type ClassProgressEntry, type ClassProgressInput } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface Session extends ClassProgressEntry {
  studentId: string;
  studentName: string;
}

const SUBJECTS = ['SAT Math', 'SAT Reading', 'SAT Writing', 'ACT Math', 'ACT English', 'ACT Reading', 'ACT Science', 'Other'];
const STATUSES = ['Completed', 'No Show', 'Cancelled', 'Scheduled'] as const;
const ENGAGEMENTS = ['High', 'Medium', 'Low'] as const;
const PAGE_SIZE = 10;

const statusVariant = (status?: string): 'success' | 'danger' | 'default' | 'info' => {
  if (status === 'Completed') return 'success';
  if (status === 'No Show') return 'danger';
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

const emptyForm = {
  studentId: '', classDate: new Date().toISOString().split('T')[0], startTime: '', durationMinutes: '60',
  subject: SUBJECTS[0], status: 'Completed' as string, topic: '', homework: '', notes: '',
  understanding: 0, attendance: 'Present', engagement: 'High' as string, nextSessionGoal: '', nextSessionAt: '',
};

export function AttendancePage() {
  const { user, dbId } = useAuthStore();
  const navigate = useNavigate();

  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [entries, setEntries] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [studentFilter, setStudentFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Session | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'info' | 'progress' | 'notes' | 'history'>('info');
  const [studentNotes, setStudentNotes] = useState<Array<{ id: string; text: string; author: string; createdAt: string }>>([]);

  const openSession = (row: Session) => { setSelected(row); setDrawerTab('info'); requestAnimationFrame(() => setDrawerVisible(true)); };
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

  const resetFilters = () => {
    setDateFrom(''); setDateTo(''); setStudentFilter('all'); setSubjectFilter('all'); setStatusFilter('all');
  };

  const openLog = () => {
    setForm({ ...emptyForm, studentId: students[0]?.id ?? '' });
    setLogOpen(true);
  };

  const handleSave = async () => {
    if (!dbId || !form.studentId || !form.topic.trim()) return;
    setSaving(true);
    try {
      const body: ClassProgressInput = {
        topic: form.topic.trim(),
        homework: form.homework.trim() || undefined,
        notes: form.notes.trim() || undefined,
        classDate: form.classDate,
        author: user?.name ?? 'Tutor',
        startTime: form.startTime || undefined,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : undefined,
        subject: form.subject,
        status: form.status,
        understanding: form.understanding || undefined,
        attendance: form.attendance,
        engagement: form.engagement,
        nextSessionGoal: form.nextSessionGoal.trim() || undefined,
        nextSessionAt: form.nextSessionAt || undefined,
      };
      const { entry } = await api.addClassProgress(dbId, form.studentId, body);
      const studentName = students.find(s => s.id === form.studentId)?.name ?? 'Student';
      setEntries(prev => [{ ...entry, studentId: form.studentId, studentName }, ...prev]);
      toast.success('Session logged.');
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
                    <th className="px-5 py-2.5 font-medium">Duration</th>
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
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1"><Clock size={12} />{row.durationMinutes ? `${row.durationMinutes} min` : '—'}</span>
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

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant={statusVariant(selected.status)} size="sm">{selected.status ?? 'Completed'}</Badge>
                <span className="text-xs text-slate-400">Session ID: #{selected.id.slice(0, 8)}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0">
                  {selected.studentName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <button onClick={() => navigate(`/student/${selected.studentId}`)} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">
                    {selected.studentName}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3">
                <div>
                  <p className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={11} /> Date</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{fmtDateLong(selected.classDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 flex items-center gap-1"><Clock size={11} /> Time</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">
                    {formatTimeRange(selected.startTime, selected.durationMinutes) || '—'}
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 border-b border-slate-100">
                {[
                  { id: 'info', label: 'Session Info', icon: <BookOpen size={13} /> },
                  { id: 'progress', label: 'Progress', icon: <TrendingUp size={13} /> },
                  { id: 'notes', label: 'Notes', icon: <MessageSquare size={13} /> },
                  { id: 'history', label: 'History', icon: <HistoryIcon size={13} /> },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDrawerTab(tab.id as typeof drawerTab)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                      drawerTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {drawerTab === 'info' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Topics Covered</p>
                    {toLines(selected.topic).length === 0 ? (
                      <p className="text-sm text-slate-400">Not recorded.</p>
                    ) : (
                      <ul className="space-y-1">
                        {toLines(selected.topic).map((t, i) => (
                          <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-slate-300">•</span>{t}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Homework Assigned</p>
                    {toLines(selected.homework).length === 0 ? (
                      <p className="text-sm text-slate-400">None assigned.</p>
                    ) : (
                      <ul className="space-y-1">
                        {toLines(selected.homework).map((t, i) => (
                          <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-slate-300">•</span>{t}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {selected.notes && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tutor Remarks</p>
                      <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3">{selected.notes}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-slate-400 mb-1">Understanding</p>
                      <div className="flex justify-center"><StarRating value={selected.understanding ?? 0} size={12} /></div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-slate-400 mb-1">Attendance</p>
                      <Badge variant={selected.attendance === 'Absent' ? 'danger' : 'success'} size="sm">{selected.attendance ?? 'Present'}</Badge>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-slate-400 mb-1">Engagement</p>
                      <Badge variant={selected.engagement === 'Low' ? 'danger' : selected.engagement === 'Medium' ? 'warning' : 'success'} size="sm">
                        {selected.engagement ?? '—'}
                      </Badge>
                    </div>
                  </div>

                  {(selected.nextSessionGoal || selected.nextSessionAt) && (
                    <div className="grid grid-cols-2 gap-3">
                      {selected.nextSessionGoal && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-[10px] text-blue-400 uppercase font-semibold mb-1">Next Session Goal</p>
                          <p className="text-sm text-blue-900">{selected.nextSessionGoal}</p>
                        </div>
                      )}
                      {selected.nextSessionAt && (
                        <div className="bg-emerald-50 rounded-lg p-3">
                          <p className="text-[10px] text-emerald-500 uppercase font-semibold mb-1">Next Session</p>
                          <p className="text-sm text-emerald-900">
                            {new Date(selected.nextSessionAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-slate-400">Logged by {selected.author}</p>
                </div>
              )}

              {drawerTab === 'progress' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-slate-900">{studentSessionCount}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Total Sessions</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-slate-900">{studentDaysTaught}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Days Taught</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => navigate(`/student/${selected.studentId}`)}>
                    View Full Student Profile & Analytics
                  </Button>
                </div>
              )}

              {drawerTab === 'notes' && (
                <div className="space-y-2">
                  {studentNotes.length === 0 ? (
                    <p className="text-sm text-slate-400">No tutor notes for {selected.studentName} yet.</p>
                  ) : (
                    studentNotes.map(note => (
                      <div key={note.id} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-slate-600">{note.author}</p>
                          <p className="text-xs text-slate-400">{note.createdAt}</p>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{note.text}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {drawerTab === 'history' && (
                <div className="space-y-2">
                  {sessionHistory.length === 0 ? (
                    <p className="text-sm text-slate-400">No other sessions logged for {selected.studentName}.</p>
                  ) : (
                    sessionHistory.map(h => (
                      <div key={h.id} onClick={() => { setSelected(h); setDrawerTab('info'); }}
                        className="bg-slate-50 hover:bg-slate-100 rounded-lg p-3 cursor-pointer transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-800">{toLines(h.topic)[0] ?? 'Session'}</p>
                          <Badge variant={statusVariant(h.status)} size="sm">{h.status ?? 'Completed'}</Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{fmtDate(h.classDate)}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Log Session Modal */}
      <Modal isOpen={logOpen} onClose={() => setLogOpen(false)} title="Log a Session" size="lg"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!form.studentId || !form.topic.trim() || saving}>
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

          <div className="grid grid-cols-3 gap-3">
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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Duration (min)</label>
              <input type="number" min={0} value={form.durationMinutes} onChange={(e) => setForm(f => ({ ...f, durationMinutes: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map(s => (
                <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    form.status === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Topics Covered (one per line)</label>
            <textarea value={form.topic} onChange={(e) => setForm(f => ({ ...f, topic: e.target.value }))}
              placeholder={'Linear equations in one variable\nWord problems using equations'} rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" autoFocus />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Homework Assigned (one per line, optional)</label>
            <textarea value={form.homework} onChange={(e) => setForm(f => ({ ...f, homework: e.target.value }))}
              placeholder={'Workbook: Module 2A (Q11-Q20)\nReview mistakes and write doubts'} rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" />
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
