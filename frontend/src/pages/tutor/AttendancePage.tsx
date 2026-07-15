import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, PlusCircle, Users, Loader2, ClipboardCheck } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { StatCard } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';

interface AttendanceEntry {
  id: string;
  studentId: string;
  studentName: string;
  topic: string;
  homework: string;
  notes: string;
  classDate: string;
  author: string;
  createdAt: string;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function AttendancePage() {
  const { user, dbId } = useAuthStore();
  const navigate = useNavigate();

  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentFilter, setStudentFilter] = useState('all');

  const [logOpen, setLogOpen] = useState(false);
  const [logStudentId, setLogStudentId] = useState('');
  const [logTopic, setLogTopic] = useState('');
  const [logHomework, setLogHomework] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.getTutorAssignments({ tutorId: dbId })
      .then(async ({ assignments }) => {
        const studs = assignments.map(a => ({ id: a.student.id, name: a.student.name }));
        if (cancelled) return;
        setStudents(studs);
        const lists = await Promise.all(
          studs.map(s =>
            api.getClassProgress(dbId, s.id)
              .then(r => r.entries.map(e => ({ ...e, homework: e.homework ?? '', studentId: s.id, studentName: s.name })))
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

  const daysTaught = useMemo(() => new Set(entries.map(e => e.classDate)).size, [entries]);
  const studentsCovered = useMemo(() => new Set(entries.map(e => e.studentId)).size, [entries]);
  const visible = studentFilter === 'all' ? entries : entries.filter(e => e.studentId === studentFilter);

  const openLog = (studentId?: string) => {
    setLogStudentId(studentId ?? students[0]?.id ?? '');
    setLogTopic('');
    setLogHomework('');
    setLogNotes('');
    setLogDate(new Date().toISOString().split('T')[0]);
    setLogOpen(true);
  };

  const handleSave = async () => {
    if (!dbId || !logStudentId || !logTopic.trim()) return;
    setSaving(true);
    try {
      const { entry } = await api.addClassProgress(dbId, logStudentId, {
        topic: logTopic.trim(),
        homework: logHomework.trim() || undefined,
        notes: logNotes.trim() || undefined,
        classDate: logDate,
        author: user?.name ?? 'Tutor',
      });
      const studentName = students.find(s => s.id === logStudentId)?.name ?? 'Student';
      setEntries(prev => [{ ...entry, homework: entry.homework ?? '', studentId: logStudentId, studentName }, ...prev]);
      toast.success('Class logged.');
      setLogOpen(false);
    } catch {
      toast.error('Failed to log class.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={20} className="animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Attendance</h1>
          <p className="text-slate-400 text-sm">Log what each student covered today and assign homework.</p>
        </div>
        <Button size="sm" icon={<PlusCircle size={14} />} onClick={() => openLog()} disabled={students.length === 0}>
          Log Today's Class
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard title="Days Taught" value={daysTaught} icon={<CalendarCheck size={16} />} color="blue" />
        <StatCard title="Sessions Logged" value={entries.length} icon={<ClipboardCheck size={16} />} color="emerald" />
        <StatCard title="Students Covered" value={studentsCovered} icon={<Users size={16} />} color="purple" />
      </div>

      {students.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 py-16 text-center">
          <Users size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No students assigned yet</p>
          <p className="text-slate-400 text-sm mt-1">Once students are assigned to you, you can log sessions here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-50 flex-wrap">
            <p className="font-medium text-slate-900 text-sm">Session History</p>
            <select
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All students</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {visible.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">No classes logged yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {visible.map((entry) => (
                <div key={entry.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/student/${entry.studentId}`)}
                        className="text-sm font-semibold text-blue-700 hover:underline"
                      >
                        {entry.studentName}
                      </button>
                      <span className="text-sm text-slate-800">— {entry.topic}</span>
                    </div>
                    <p className="text-xs text-slate-400 flex-shrink-0">{fmtDate(entry.classDate)}</p>
                  </div>
                  {entry.homework && (
                    <p className="text-sm text-amber-700 bg-amber-50 rounded-md px-2 py-1 inline-block mt-1">
                      <span className="font-medium">Homework:</span> {entry.homework}
                    </p>
                  )}
                  {entry.notes && <p className="text-sm text-slate-600 leading-relaxed mt-1">{entry.notes}</p>}
                  <p className="text-xs text-slate-400 mt-1">{entry.author}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log Session Modal */}
      <Modal isOpen={logOpen} onClose={() => setLogOpen(false)} title="Log Today's Class" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!logStudentId || !logTopic.trim() || saving}>
              {saving ? 'Saving...' : 'Save Entry'}
            </Button>
          </div>
        }>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Student</label>
            <select
              value={logStudentId}
              onChange={(e) => setLogStudentId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Class Date</label>
            <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">What was studied today</label>
            <input type="text" value={logTopic} onChange={(e) => setLogTopic(e.target.value)}
              placeholder="e.g. Command of Evidence, Linear Equations..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100"
              autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Homework Assigned (optional)</label>
            <input type="text" value={logHomework} onChange={(e) => setLogHomework(e.target.value)}
              placeholder="e.g. 20 practice problems, pg 45-50..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
            <textarea value={logNotes} onChange={(e) => setLogNotes(e.target.value)}
              placeholder="Strengths, focus areas..." rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
