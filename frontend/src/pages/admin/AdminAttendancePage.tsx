import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Users, ClipboardCheck, Loader2, Search } from 'lucide-react';
import { StatCard } from '../../components/common/Card';
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
}

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

  const visible = useMemo(() => {
    let list = entries;
    if (tutorFilter !== 'all') list = list.filter(e => e.tutorId === tutorFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e => e.studentName.toLowerCase().includes(q) || e.topic.toLowerCase().includes(q) || e.tutorName.toLowerCase().includes(q));
    }
    return list;
  }, [entries, tutorFilter, search]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={20} className="animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Attendance</h1>
        <p className="text-slate-400 text-sm">Track how much every tutor is teaching and what's being covered.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard title="Tutors Active" value={tutorStats.length} icon={<Users size={16} />} color="blue" />
        <StatCard title="Sessions Logged" value={entries.length} icon={<ClipboardCheck size={16} />} color="emerald" />
        <StatCard title="Students Covered" value={new Set(entries.map(e => e.studentId)).size} icon={<CalendarCheck size={16} />} color="purple" />
      </div>

      {/* Tutor teaching activity */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="px-5 py-3.5 border-b border-slate-50">
          <p className="font-medium text-slate-900 text-sm">Tutor Teaching Activity</p>
          <p className="text-xs text-slate-400 mt-0.5">Distinct days each tutor has logged a class</p>
        </div>
        {tutorStats.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No attendance logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-2.5 font-medium">Tutor</th>
                  <th className="px-5 py-2.5 font-medium text-center">Days Taught</th>
                  <th className="px-5 py-2.5 font-medium text-center">Sessions</th>
                  <th className="px-5 py-2.5 font-medium text-center">Students Covered</th>
                </tr>
              </thead>
              <tbody>
                {tutorStats.map(t => (
                  <tr
                    key={t.tutorId}
                    onClick={() => setTutorFilter(tutorFilter === t.tutorId ? 'all' : t.tutorId)}
                    className={`border-b border-slate-50 last:border-0 cursor-pointer transition-colors ${tutorFilter === t.tutorId ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-5 py-3 font-medium text-slate-800">{t.tutorName}</td>
                    <td className="px-5 py-3 text-center font-semibold text-blue-700">{t.daysTaught}</td>
                    <td className="px-5 py-3 text-center text-slate-600">{t.sessions}</td>
                    <td className="px-5 py-3 text-center text-slate-600">{t.studentsCovered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full log history */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-50 flex-wrap">
          <p className="font-medium text-slate-900 text-sm">
            Session History {tutorFilter !== 'all' && <span className="text-blue-600">— {tutorStats.find(t => t.tutorId === tutorFilter)?.tutorName}</span>}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {tutorFilter !== 'all' && (
              <button onClick={() => setTutorFilter('all')} className="text-xs text-blue-600 hover:underline">Clear filter</button>
            )}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student, topic, tutor…"
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 w-56"
              />
            </div>
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">No matching sessions.</p>
        ) : (
          <div className="divide-y divide-slate-50 max-h-[32rem] overflow-y-auto">
            {visible.map((entry) => (
              <div key={entry.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => navigate(`/student/${entry.studentId}`)} className="text-sm font-semibold text-blue-700 hover:underline">
                      {entry.studentName}
                    </button>
                    <span className="text-sm text-slate-800">— {entry.topic}</span>
                    <span className="text-xs text-slate-400">taught by {entry.tutorName}</span>
                  </div>
                  <p className="text-xs text-slate-400 flex-shrink-0">{fmtDate(entry.classDate)}</p>
                </div>
                {entry.homework && (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-md px-2 py-1 inline-block mt-1">
                    <span className="font-medium">Homework:</span> {entry.homework}
                  </p>
                )}
                {entry.notes && <p className="text-sm text-slate-600 leading-relaxed mt-1">{entry.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
