import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Users, ClipboardCheck, Loader2, Search, Clock } from 'lucide-react';
import { StatCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { api } from '../../lib/api';

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

function toLines(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

const statusVariant = (status?: string): 'success' | 'danger' | 'default' | 'info' => {
  if (status === 'Completed') return 'success';
  if (status === 'No Show') return 'danger';
  if (status === 'Scheduled') return 'info';
  return 'default';
};

interface TutorStat {
  tutorId: string;
  tutorName: string;
  daysTaught: number;
  sessions: number;
  studentsCovered: number;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function AdminAttendancePage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tutorFilter, setTutorFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getTutorAssignments()
      .then(async ({ assignments }) => {
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
    return () => { cancelled = true; };
  }, []);

  const tutorStats: TutorStat[] = useMemo(() => {
    const byTutor = new Map<string, AttendanceEntry[]>();
    for (const e of entries) {
      if (!byTutor.has(e.tutorId)) byTutor.set(e.tutorId, []);
      byTutor.get(e.tutorId)!.push(e);
    }
    return Array.from(byTutor.entries()).map(([tutorId, list]) => ({
      tutorId,
      tutorName: list[0].tutorName,
      daysTaught: new Set(list.map(e => e.classDate)).size,
      sessions: list.length,
      studentsCovered: new Set(list.map(e => e.studentId)).size,
    })).sort((a, b) => b.daysTaught - a.daysTaught);
  }, [entries]);

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
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Attendance</h1>
        <p className="text-slate-400 text-sm">Track how much every tutor is teaching and what's being covered.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Tutors Active" value={tutorStats.length} icon={<Users size={16} />} color="blue" />
        <StatCard title="Sessions Logged" value={entries.length} icon={<ClipboardCheck size={16} />} color="emerald" />
        <StatCard title="Students Covered" value={new Set(entries.map(e => e.studentId)).size} icon={<CalendarCheck size={16} />} color="purple" />
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
