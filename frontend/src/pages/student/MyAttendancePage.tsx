import { useEffect, useState } from 'react';
import { CalendarCheck, Loader2, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { Badge } from '../../components/common/Badge';

interface AttendanceEntry {
  id: string;
  tutorName: string;
  topic: string;
  homework: string;
  notes: string;
  classDate: string;
  createdAt: string;
  subject?: string;
  sessionType?: string;
  durationMinutes?: number;
  actualDurationMinutes?: number;
  status?: string;
}

import { formatDate } from '../../lib/utils';

const fmtDate = (d: string) => formatDate(d);

function toLines(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

const statusVariant = (status?: string): 'success' | 'danger' | 'default' | 'info' => {
  if (status === 'Completed') return 'success';
  if (status === 'No Show') return 'danger';
  if (status === 'Scheduled') return 'info';
  return 'default';
};

export function MyAttendancePage() {
  const { dbId } = useAuthStore();
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.getTutorAssignments({ studentId: dbId })
      .then(async ({ assignments }) => {
        const lists = await Promise.all(
          assignments.map(a =>
            api.getClassProgress(a.tutorId, dbId)
              .then(r => r.entries.map(e => ({ ...e, homework: e.homework ?? '', tutorName: a.tutor.name })))
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
  }, [dbId]);

  const daysTaught = new Set(entries.map(e => e.classDate)).size;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={20} className="animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Classes</h1>
        <p className="text-slate-400 text-sm">{entries.length} session{entries.length !== 1 ? 's' : ''} across {daysTaught} day{daysTaught !== 1 ? 's' : ''}</p>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 py-16 text-center">
          <CalendarCheck size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No classes logged yet</p>
          <p className="text-slate-400 text-sm mt-1">Your tutor's session notes and homework will show up here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Tutor</th>
                  <th className="px-5 py-2.5 font-medium">Subject</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 font-medium">Topic</th>
                  <th className="px-5 py-2.5 font-medium">Homework</th>
                  <th className="px-5 py-2.5 font-medium">Remarks</th>
                  <th className="px-5 py-2.5 font-medium">Duration</th>
                  <th className="px-5 py-2.5 font-medium">Actual</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-50 last:border-0 hover:bg-blue-50/40 transition-colors">
                    <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">{fmtDate(entry.classDate)}</td>
                    <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">{entry.tutorName}</td>
                    <td className="px-5 py-3.5">
                      {entry.subject ? <Badge variant="info" size="sm">{entry.subject}</Badge> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {entry.sessionType ? <Badge variant="purple" size="sm">{entry.sessionType}</Badge> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      {toLines(entry.topic).length > 0 ? (
                        <span className="text-slate-600 truncate block" title={toLines(entry.topic).join(', ')}>
                          {toLines(entry.topic).join(', ')}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      {toLines(entry.homework).length > 0 ? (
                        <span className="text-slate-600 truncate block" title={toLines(entry.homework).join(', ')}>
                          {toLines(entry.homework).join(', ')}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      {entry.notes ? (
                        <span className="text-slate-600 truncate block" title={entry.notes}>{entry.notes}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><Clock size={12} />{entry.durationMinutes ? `${entry.durationMinutes} min` : '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><Clock size={12} />{entry.actualDurationMinutes ? `${entry.actualDurationMinutes} min` : '—'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={statusVariant(entry.status)} size="sm">{entry.status ?? 'Completed'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
