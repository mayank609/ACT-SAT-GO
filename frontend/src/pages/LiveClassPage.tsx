import { useEffect, useMemo, useState } from 'react';
import { Video, Loader2, PhoneOff, LogOut, Play } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { api, type LiveClass } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/common/Button';

function since(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} h ${mins % 60} min ago`;
}

/**
 * Live Class (admin, tutor and student). A tutor, or an admin, starts a class
 * with a student; the student sees it here with a Join button. The class runs
 * in 100ms's meeting screen inside the portal: video, audio, mute, screen
 * share, chat, recording and whiteboard.
 */
export function LiveClassPage() {
  const { user, dbId } = useAuthStore();
  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [configured, setConfigured] = useState(true);
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [inClass, setInClass] = useState<LiveClass | null>(null);

  // Who a class can be started with: tutor -> their students; admin -> every tutor-student pair.
  const [pairs, setPairs] = useState<{ tutorId: string; tutorName: string; studentId: string; studentName: string }[]>([]);
  const [studentId, setStudentId] = useState('');
  const [tutorId, setTutorId] = useState('');
  const [starting, setStarting] = useState(false);

  const load = () =>
    api.getLiveClasses()
      .then((r) => { setConfigured(r.configured); setClasses(r.classes); })
      .catch(() => {})
      .finally(() => setLoading(false));

  // Students watch for their tutor starting a class.
  useEffect(() => {
    load();
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (isStudent || !user) return;
    if (user.role === 'tutor' && !dbId) return;
    api.getTutorAssignments(user.role === 'tutor' ? { tutorId: dbId! } : undefined)
      .then((r) => setPairs(r.assignments.map((a) => ({ tutorId: a.tutorId, tutorName: a.tutor.name, studentId: a.studentId, studentName: a.student.name }))))
      .catch(() => {});
  }, [isStudent, user, dbId]);

  const students = useMemo(() => {
    const m = new Map<string, string>();
    pairs.forEach((p) => m.set(p.studentId, p.studentName));
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [pairs]);
  const tutorsOfStudent = pairs.filter((p) => p.studentId === studentId);

  useEffect(() => { setTutorId(tutorsOfStudent[0]?.tutorId ?? ''); }, [studentId]);

  const start = async () => {
    if (!studentId) return;
    setStarting(true);
    try {
      const { class: cls } = await api.startLiveClass(studentId, isAdmin ? tutorId || undefined : undefined);
      setClasses((cs) => [...cs, cls]);
      setInClass(cls);
      setStudentId('');
    } catch (e) {
      toast.error((e as Error).message || 'Could not start the class');
    } finally {
      setStarting(false);
    }
  };

  const end = async (cls: LiveClass) => {
    if (!window.confirm(`End the class with ${cls.studentName} for everyone?`)) return;
    try {
      await api.endLiveClass(cls.roomId);
      setClasses((cs) => cs.filter((c) => c.roomId !== cls.roomId));
      setInClass(null);
      toast.success('Class ended');
    } catch (e) {
      toast.error((e as Error).message || 'Could not end the class');
    }
  };

  if (inClass) {
    return (
      <div className="fixed inset-0 z-[300] flex flex-col bg-slate-950">
        <div className="flex items-center justify-between gap-3 px-4 py-2 text-white">
          <p className="text-sm font-semibold truncate">
            Live class · {isStudent ? inClass.tutorName : inClass.studentName}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setInClass(null)}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">
              <LogOut size={14} /> Leave
            </button>
            {inClass.canEnd && (
              <button type="button" onClick={() => end(inClass)}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold hover:bg-red-700">
                <PhoneOff size={14} /> End class for everyone
              </button>
            )}
          </div>
        </div>
        <iframe
          title="Live class"
          src={inClass.joinUrl}
          allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-read; clipboard-write; screen-wake-lock"
          className="flex-1 w-full border-0"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Toaster position="top-right" />

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Video size={20} className="text-blue-600" />
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Live Class</h1>
        </div>
        <p className="text-sm text-slate-500">
          {isStudent
            ? 'When your tutor starts a class, it appears here. Click Join to enter.'
            : 'Start a live class with a student. They see a Join button on their Live Class page.'}
        </p>
      </div>

      {!configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Live classes are not switched on yet. The 100ms keys still need to be added on the server.
        </div>
      )}

      {configured && !isStudent && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">Start a class</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Student</label>
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option value="">Select student…</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {isAdmin && studentId && (
              <div className="min-w-[200px] flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Tutor</label>
                <select value={tutorId} onChange={(e) => setTutorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100">
                  {tutorsOfStudent.map((p) => <option key={p.tutorId} value={p.tutorId}>{p.tutorName}</option>)}
                </select>
              </div>
            )}
            <Button icon={starting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              onClick={start} disabled={!studentId || starting}>
              {starting ? 'Starting…' : 'Start class'}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">Live now</p>
        {loading ? (
          <div className="flex items-center justify-center h-24 gap-2 text-slate-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : classes.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            {isStudent ? 'No live class right now.' : 'No classes are running.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {classes.map((c) => (
              <li key={c.roomId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    {isStudent ? `Class with ${c.tutorName}` : `${c.tutorName} with ${c.studentName}`}
                  </p>
                  <p className="text-xs text-slate-500">Started {since(c.startedAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" icon={<Video size={14} />} onClick={() => setInClass(c)}>Join</Button>
                  {c.canEnd && (
                    <Button size="sm" variant="secondary" icon={<PhoneOff size={14} />} onClick={() => end(c)}>End</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
