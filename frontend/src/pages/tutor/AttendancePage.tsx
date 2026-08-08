import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, PlusCircle, X, RotateCcw, Clock, ChevronLeft, ChevronRight,
  Calendar, User as UserIcon, Users, CheckCircle2,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { StatCard } from '../../components/common/Card';
import { StarRating } from '../../components/common/StarRating';
import { LogSessionModal, type SavedSessionEntry } from '../../components/common/LogSessionModal';
import { api, type ClassProgressEntry } from '../../lib/api';
import { SUBJECTS, STATUSES, statusVariant, toLines, sortSessionEntries, type DbTest } from '../../lib/sessionLog';
import { useAuthStore } from '../../store/useAuthStore';

interface Session extends ClassProgressEntry {
  studentId: string;
  studentName: string;
}

const PAGE_SIZE = 10;

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

// Table preview only — the full text is still shown in the title tooltip and in
// the session detail drawer when a row is clicked.
function truncateChars(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
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

export function AttendancePage() {
  const { user, dbId } = useAuthStore();
  const navigate = useNavigate();

  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [entries, setEntries] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishedTests, setPublishedTests] = useState<DbTest[]>([]);

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
        setEntries(sortSessionEntries(lists.flat()));
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

  const openLog = () => setLogOpen(true);

  const tutorStudentsMap = useMemo(() => (dbId ? new Map([[dbId, students]]) : new Map()), [dbId, students]);

  const handleSessionSaved = (saved: SavedSessionEntry) => {
    setEntries(prev => sortSessionEntries([saved, ...prev]));
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

      <LogSessionModal
        isOpen={logOpen}
        onClose={() => setLogOpen(false)}
        authorName={user?.name ?? 'Tutor'}
        fixedTutorId={dbId ?? undefined}
        studentsByTutor={tutorStudentsMap}
        publishedTests={publishedTests}
        onSaved={handleSessionSaved}
      />
    </div>
  );
}
