import { useEffect, useState } from 'react';
import { CalendarCheck, Loader2, BookOpenCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';

interface AttendanceEntry {
  id: string;
  tutorName: string;
  topic: string;
  homework: string;
  notes: string;
  classDate: string;
  createdAt: string;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

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
    <div className="space-y-5 max-w-3xl mx-auto">
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
        <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-50">
          {entries.map((entry) => (
            <div key={entry.id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                <p className="text-sm font-semibold text-slate-900">{entry.topic}</p>
                <p className="text-xs text-slate-400 flex-shrink-0">{fmtDate(entry.classDate)}</p>
              </div>
              {entry.homework && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-md px-2 py-1 inline-flex items-center gap-1.5 mt-1">
                  <BookOpenCheck size={12} /> <span className="font-medium">Homework:</span> {entry.homework}
                </p>
              )}
              {entry.notes && <p className="text-sm text-slate-600 leading-relaxed mt-1">{entry.notes}</p>}
              <p className="text-xs text-slate-400 mt-1.5">with {entry.tutorName}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
