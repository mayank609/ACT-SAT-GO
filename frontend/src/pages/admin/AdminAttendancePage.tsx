import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search, Clock, Pencil, Trash2, X, Save, PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { LogSessionModal, type SavedSessionEntry } from '../../components/common/LogSessionModal';
import { api } from '../../lib/api';
import { SUBJECTS, SESSION_TYPES, STATUSES, statusVariant, toLines, type DbTest } from '../../lib/sessionLog';
import { useAuthStore } from '../../store/useAuthStore';

interface AttendanceEntry {
  id: string;
  tutorId: string;
  tutorName: string;
  studentId: string;
  studentName: string;
  topic: string;
  homework: string;
  notes: string;
  classDate: string;
  author: string;
  createdAt: string;
  subject?: string;
  sessionType?: string;
  durationMinutes?: number;
  actualDurationMinutes?: number;
  status?: string;
}

interface TutorStat {
  tutorId: string;
  tutorName: string;
  daysTaught: number;
  sessions: number;
  studentsCovered: number;
  totalMinutesTaught: number;
  amount: number | null;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtHours = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
const fmtAmount = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function AdminAttendancePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [tutorRates, setTutorRates] = useState<Map<string, number>>(new Map());
  const [tutorList, setTutorList] = useState<{ id: string; name: string }[]>([]);
  const [tutorStudentsMap, setTutorStudentsMap] = useState<Map<string, { id: string; name: string }[]>>(new Map());
  const [publishedTests, setPublishedTests] = useState<DbTest[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tutorFilter, setTutorFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const [editEntry, setEditEntry] = useState<AttendanceEntry | null>(null);
  const [editForm, setEditForm] = useState({
    subject: '', sessionType: '', topic: '', homework: '', notes: '',
    durationMinutes: '', actualDurationMinutes: '', status: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [deleteEntry, setDeleteEntry] = useState<AttendanceEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openEdit = (entry: AttendanceEntry) => {
    setEditEntry(entry);
    setEditForm({
      subject: entry.subject ?? '',
      sessionType: entry.sessionType ?? '',
      topic: entry.topic ?? '',
      homework: entry.homework ?? '',
      notes: entry.notes ?? '',
      durationMinutes: entry.durationMinutes != null ? String(entry.durationMinutes) : '',
      actualDurationMinutes: entry.actualDurationMinutes != null ? String(entry.actualDurationMinutes) : '',
      status: entry.status ?? '',
    });
  };

  const saveEdit = async () => {
    if (!editEntry) return;
    setEditSaving(true);
    try {
      const { entry: updated } = await api.updateClassProgress(editEntry.tutorId, editEntry.studentId, editEntry.id, {
        subject: editForm.subject || undefined,
        sessionType: editForm.sessionType || undefined,
        topic: editForm.topic,
        homework: editForm.homework,
        notes: editForm.notes,
        durationMinutes: editForm.durationMinutes ? Number(editForm.durationMinutes) : undefined,
        actualDurationMinutes: editForm.actualDurationMinutes ? Number(editForm.actualDurationMinutes) : undefined,
        status: editForm.status || undefined,
      });
      setEntries(list => list.map(e => (e.id === editEntry.id ? { ...e, ...updated } : e)));
      toast.success('Session log updated');
      setEditEntry(null);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update session log');
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteEntry) return;
    setDeleting(true);
    try {
      await api.deleteClassProgress(deleteEntry.tutorId, deleteEntry.studentId, deleteEntry.id);
      setEntries(list => list.filter(e => e.id !== deleteEntry.id));
      toast.success('Session log deleted');
      setDeleteEntry(null);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to delete session log');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    api.getUsersByRole('TUTOR')
      .then(({ users }) => setTutorRates(new Map(users.filter(u => u.hourlyRate != null).map(u => [u.id, u.hourlyRate as number]))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getTutorAssignments()
      .then(async ({ assignments }) => {
        if (cancelled) return;
        // Every tutor-student pair, independent of whether any session has been
        // logged for it yet — this is what lets an admin pick "who" to log for.
        const studentsByTutor = new Map<string, { id: string; name: string }[]>();
        const tutorsById = new Map<string, string>();
        for (const a of assignments) {
          tutorsById.set(a.tutorId, a.tutor.name);
          const list = studentsByTutor.get(a.tutorId) ?? [];
          list.push({ id: a.studentId, name: a.student.name });
          studentsByTutor.set(a.tutorId, list);
        }
        setTutorStudentsMap(studentsByTutor);
        setTutorList(Array.from(tutorsById.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));

        const lists = await Promise.all(
          assignments.map(a =>
            api.getClassProgress(a.tutorId, a.studentId)
              .then(r => r.entries.map(e => ({
                ...e,
                homework: e.homework ?? '',
                tutorId: a.tutorId,
                tutorName: a.tutor.name,
                studentId: a.studentId,
                studentName: a.student.name,
              })))
              .catch(() => [] as AttendanceEntry[])
          )
        );
        if (cancelled) return;
        const merged = lists.flat().sort((a, b) =>
          new Date(b.classDate).getTime() - new Date(a.classDate).getTime() ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setEntries(merged);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    api.getAllTests()
      .then(r => setPublishedTests((r.tests as DbTest[]).filter(t => t.status === 'PUBLISHED')))
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleSessionSaved = (saved: SavedSessionEntry) => {
    setEntries(prev => [saved, ...prev]);
  };

  const tutorStats: TutorStat[] = useMemo(() => {
    const byTutor = new Map<string, AttendanceEntry[]>();
    for (const e of entries) {
      if (!byTutor.has(e.tutorId)) byTutor.set(e.tutorId, []);
      byTutor.get(e.tutorId)!.push(e);
    }
    return Array.from(byTutor.entries()).map(([tutorId, list]) => {
      // Actual time taught, falling back to the scheduled duration for sessions
      // where the tutor never logged an actual duration.
      const totalMinutesTaught = list.reduce((sum, e) => sum + (e.actualDurationMinutes ?? e.durationMinutes ?? 0), 0);
      const rate = tutorRates.get(tutorId);
      return {
        tutorId,
        tutorName: list[0].tutorName,
        daysTaught: new Set(list.map(e => e.classDate)).size,
        sessions: list.length,
        studentsCovered: new Set(list.map(e => e.studentId)).size,
        totalMinutesTaught,
        amount: rate != null ? (totalMinutesTaught / 60) * rate : null,
      };
    }).sort((a, b) => b.daysTaught - a.daysTaught);
  }, [entries, tutorRates]);

  const studentOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const e of entries) byId.set(e.studentId, e.studentName);
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  const visible = useMemo(() => {
    let list = entries;
    if (tutorFilter !== 'all') list = list.filter(e => e.tutorId === tutorFilter);
    if (studentFilter !== 'all') list = list.filter(e => e.studentId === studentFilter);
    if (dateFrom) list = list.filter(e => e.classDate >= dateFrom);
    if (dateTo) list = list.filter(e => e.classDate <= dateTo);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e =>
        e.studentName.toLowerCase().includes(q) ||
        e.tutorName.toLowerCase().includes(q) ||
        e.topic.toLowerCase().includes(q) ||
        e.homework.toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q) ||
        (e.subject ?? '').toLowerCase().includes(q) ||
        (e.sessionType ?? '').toLowerCase().includes(q) ||
        (e.status ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [entries, tutorFilter, studentFilter, dateFrom, dateTo, search]);

  const hasActiveFilters = tutorFilter !== 'all' || studentFilter !== 'all' || !!dateFrom || !!dateTo || !!search;
  const clearFilters = () => { setTutorFilter('all'); setStudentFilter('all'); setDateFrom(''); setDateTo(''); setSearch(''); };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={20} className="animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Attendance</h1>
          <p className="text-slate-400 text-sm">Track how much every tutor is teaching and what's being covered.</p>
        </div>
        <Button size="sm" icon={<PlusCircle size={14} />} onClick={() => setLogOpen(true)} disabled={tutorList.length === 0}>
          Log a Session
        </Button>
      </div>

      {/* Tutor teaching activity */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="px-4 py-2.5 border-b border-slate-100">
          <p className="font-medium text-slate-900 text-sm">Tutor Teaching Activity</p>
          <p className="text-xs text-slate-400">Distinct days each tutor has logged a class</p>
        </div>
        {tutorStats.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">No attendance logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2 font-semibold">Tutor</th>
                  <th className="px-4 py-2 font-semibold text-center">Days Taught</th>
                  <th className="px-4 py-2 font-semibold text-center">Sessions</th>
                  <th className="px-4 py-2 font-semibold text-center">Students Covered</th>
                  <th className="px-4 py-2 font-semibold text-center">Time Taught</th>
                  <th className="px-4 py-2 font-semibold text-center">Amount</th>
                </tr>
              </thead>
              <tbody>
                {tutorStats.map(t => (
                  <tr
                    key={t.tutorId}
                    onClick={() => setTutorFilter(tutorFilter === t.tutorId ? 'all' : t.tutorId)}
                    className={`border-b border-slate-50 last:border-0 cursor-pointer transition-colors ${tutorFilter === t.tutorId ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-4 py-2 font-medium text-slate-800">{t.tutorName}</td>
                    <td className="px-4 py-2 text-center font-semibold text-blue-700">{t.daysTaught}</td>
                    <td className="px-4 py-2 text-center text-slate-600">{t.sessions}</td>
                    <td className="px-4 py-2 text-center text-slate-600">{t.studentsCovered}</td>
                    <td className="px-4 py-2 text-center text-slate-600">{t.totalMinutesTaught > 0 ? fmtHours(t.totalMinutesTaught) : '—'}</td>
                    <td className="px-4 py-2 text-center font-semibold text-emerald-700">
                      {t.amount != null ? fmtAmount(t.amount) : <span title="No hourly rate set for this tutor" className="text-slate-300 font-normal">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full log history */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="px-4 py-2.5 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <p className="font-medium text-slate-900 text-sm">
              Session History <span className="text-slate-400 font-normal">({visible.length})</span>
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline">Clear all filters</button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 text-slate-700 bg-white"
            >
              <option value="all">All Students</option>
              {studentOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={tutorFilter}
              onChange={(e) => setTutorFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 text-slate-700 bg-white"
            >
              <option value="all">All Tutors</option>
              {tutorStats.map(t => <option key={t.tutorId} value={t.tutorId}>{t.tutorName}</option>)}
            </select>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
              <span>–</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student, tutor, subject, topic, homework, remarks…"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">No matching sessions.</p>
        ) : (
          <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2 font-semibold">Date</th>
                  <th className="px-4 py-2 font-semibold">Student</th>
                  <th className="px-4 py-2 font-semibold">Tutor</th>
                  <th className="px-4 py-2 font-semibold">Subject</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 font-semibold">Topic</th>
                  <th className="px-4 py-2 font-semibold">Homework</th>
                  <th className="px-4 py-2 font-semibold">Remarks</th>
                  <th className="px-4 py-2 font-semibold">Duration</th>
                  <th className="px-4 py-2 font-semibold">Actual</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-50 last:border-0 hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{fmtDate(entry.classDate)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <button onClick={() => navigate(`/student/${entry.studentId}`)} className="font-medium text-blue-700 hover:underline">
                        {entry.studentName}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{entry.tutorName}</td>
                    <td className="px-4 py-2.5">
                      {entry.subject ? <Badge variant="info" size="sm">{entry.subject}</Badge> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {entry.sessionType ? <Badge variant="purple" size="sm">{entry.sessionType}</Badge> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 max-w-[180px]">
                      {toLines(entry.topic).length > 0 ? (
                        <span className="text-slate-600 truncate block" title={toLines(entry.topic).join(', ')}>
                          {toLines(entry.topic).join(', ')}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 max-w-[180px]">
                      {toLines(entry.homework).length > 0 ? (
                        <span className="text-slate-600 truncate block" title={toLines(entry.homework).join(', ')}>
                          {toLines(entry.homework).join(', ')}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 max-w-[180px]">
                      {entry.notes ? (
                        <span className="text-slate-600 truncate block" title={entry.notes}>{entry.notes}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><Clock size={12} />{entry.durationMinutes ? `${entry.durationMinutes} min` : '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><Clock size={12} />{entry.actualDurationMinutes ? `${entry.actualDurationMinutes} min` : '—'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={statusVariant(entry.status)} size="sm">{entry.status ?? 'Completed'}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(entry)} title="Edit session log"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteEntry(entry)} title="Delete session log"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit session log */}
      <Modal
        isOpen={!!editEntry}
        onClose={() => setEditEntry(null)}
        title={editEntry ? `Edit Session — ${editEntry.studentName}` : ''}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={() => setEditEntry(null)}>Cancel</Button>
            <Button size="sm" icon={<Save size={14} />} loading={editSaving} onClick={saveEdit}>Save Changes</Button>
          </div>
        }
      >
        {editEntry && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                <select value={editForm.subject} onChange={(e) => setEditForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">—</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Session Type</label>
                <select value={editForm.sessionType} onChange={(e) => setEditForm(f => ({ ...f, sessionType: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">—</option>
                  {SESSION_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Topic (one per line)</label>
              <textarea value={editForm.topic} onChange={(e) => setEditForm(f => ({ ...f, topic: e.target.value }))} rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Homework (one per line)</label>
              <textarea value={editForm.homework} onChange={(e) => setEditForm(f => ({ ...f, homework: e.target.value }))} rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
              <textarea value={editForm.notes} onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Duration (min)</label>
                <input type="number" min={0} value={editForm.durationMinutes} onChange={(e) => setEditForm(f => ({ ...f, durationMinutes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Actual (min)</label>
                <input type="number" min={0} value={editForm.actualDurationMinutes} onChange={(e) => setEditForm(f => ({ ...f, actualDurationMinutes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">—</option>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteEntry}
        onClose={() => setDeleteEntry(null)}
        title="Delete Session Log"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteEntry(null)}>Cancel</Button>
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} loading={deleting} onClick={confirmDelete}>Delete</Button>
          </div>
        }
      >
        {deleteEntry && (
          <p className="text-sm text-slate-600">
            Delete the session logged for <span className="font-semibold text-slate-900">{deleteEntry.studentName}</span> by{' '}
            <span className="font-semibold text-slate-900">{deleteEntry.tutorName}</span> on {fmtDate(deleteEntry.classDate)}? This can't be undone.
          </p>
        )}
      </Modal>

      {/* Log a session on a tutor's behalf */}
      <LogSessionModal
        isOpen={logOpen}
        onClose={() => setLogOpen(false)}
        authorName={user?.name ?? 'Admin'}
        tutors={tutorList}
        studentsByTutor={tutorStudentsMap}
        publishedTests={publishedTests}
        onSaved={handleSessionSaved}
      />
    </div>
  );
}
