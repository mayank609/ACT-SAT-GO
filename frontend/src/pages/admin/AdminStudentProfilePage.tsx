import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Target, TrendingUp, Clock, Phone, School, Calendar,
  User2, Mail, Pencil, Trash2, CheckCircle, X, Save, MessageSquare, PlusCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { StatCard } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { api, type DbUser } from '../../lib/api';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';

interface Analytics {
  trend: Array<{ date: string; score: number; testTitle: string; attemptId: string }>;
  sectionStats: Array<{ sectionName: string; accuracy: number; timeAllocated: number; timeUsed: number }>;
  overallAccuracy: number;
  totalAttempts: number;
  latestScore: number;
  avgScore: number;
  cheatingLogs?: Array<{
    id: string;
    attemptId: string;
    testTitle: string;
    eventType: string;
    metadata: any;
    createdAt: string;
  }>;
}

interface Note { id: string; text: string; createdAt: string; author: string }
interface DbTest { id: string; title: string; status: string; sections: unknown[] }

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-slate-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800 font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export function AdminStudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [student, setStudent] = useState<DbUser | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [publishedTests, setPublishedTests] = useState<DbTest[]>([]);
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', parentPhone: '', dob: '', schoolName: '', grade: '', targetScore: '', tutorId: '' });
  const [editSaving, setEditSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getUser(id),
      api.getStudentAnalytics(id),
      api.getAllTests(),
      api.getUsersByRole('TUTOR'),
    ]).then(([u, a, t, tu]) => {
      const s = u.user;
      setStudent(s);
      setAnalytics(a as Analytics);
      setPublishedTests((t.tests as DbTest[]).filter((x) => x.status === 'PUBLISHED'));
      setTutors(tu.users ?? []);
      const parts = s.name.split(' ');
      setEditForm({
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        phone: s.phone || '',
        parentPhone: s.parentPhone || '',
        dob: s.dob || '',
        schoolName: s.schoolName || '',
        grade: s.grade || '',
        targetScore: s.targetScore ? String(s.targetScore) : '',
        tutorId: s.tutorId || '',
      });
    }).catch(() => toast.error('Failed to load student')).finally(() => setLoading(false));

    // Load notes without blocking page
    api.getNotes('admin', id).then((r) => setNotes(r.notes)).catch(() => {});
  }, [id]);

  const handleSaveEdit = async () => {
    if (!id) return;
    setEditSaving(true);
    try {
      const updated = await api.updateUser(id, {
        name: `${editForm.firstName} ${editForm.lastName}`.trim(),
        grade: editForm.grade || undefined,
        targetScore: editForm.targetScore ? Number(editForm.targetScore) : undefined,
        tutorId: editForm.tutorId || null,
        phone: editForm.phone || undefined,
        parentPhone: editForm.parentPhone || undefined,
        dob: editForm.dob || undefined,
        schoolName: editForm.schoolName || undefined,
      });
      setStudent(updated.user);
      setEditing(false);
      toast.success('Profile updated');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleteLoading(true);
    try {
      await api.deleteUser(id);
      toast.success('Student deleted');
      navigate('/students');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to delete');
      setDeleteLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !id) return;
    setNoteSaving(true);
    try {
      const { note } = await api.addNote('admin', id, noteText.trim(), 'Admin');
      setNotes((prev) => [note, ...prev]);
      setNoteText('');
      setNoteOpen(false);
      toast.success('Note saved');
    } catch {
      toast.error('Failed to save note');
    } finally {
      setNoteSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-sm">Loading student profile…</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-500">Student not found.</p>
        <button onClick={() => navigate('/students')} className="text-sm text-blue-600 hover:underline">Back to students</button>
      </div>
    );
  }

  const target = (student.targetScore as number | null) ?? 32;
  const avg = student.avgScore ?? 0;
  const gap = target - avg;
  const pct = Math.min(100, (avg / target) * 100);

  const sectionData = (analytics?.sectionStats ?? []).map((s) => ({
    name: s.sectionName,
    accuracy: s.accuracy,
    timeEfficiency: s.timeAllocated > 0 ? Math.round((s.timeUsed / s.timeAllocated) * 100) : 0,
  }));

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="space-y-5 pb-8">
      <Toaster position="bottom-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={() => navigate('/students')} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 self-start transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 truncate">{student.name}</h1>
          <p className="text-sm text-slate-400">{student.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button variant="secondary" size="sm" icon={<X size={13} />} onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" icon={<Save size={13} />} onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" icon={<MessageSquare size={13} />} onClick={() => setNoteOpen(true)}>Note</Button>
              <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(true)}>Edit</Button>
              <Button size="sm" icon={<BookOpen size={13} />} onClick={() => setAssignOpen(true)}>Assign Test</Button>
              <button onClick={() => setDeleteOpen(true)}
                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete student">
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left column: profile card ─────────────────────────────────── */}
        <div className="space-y-4">

          {/* Avatar + name */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-bold flex-shrink-0">
                {student.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{student.name}</p>
                <p className="text-xs text-slate-400 truncate">{student.email}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="info" size="sm">Student</Badge>
                  {student.grade && <Badge variant="default" size="sm">Gr. {student.grade}</Badge>}
                </div>
              </div>
            </div>

            {!editing ? (
              <div className="divide-y divide-slate-50">
                <InfoRow icon={<Mail size={13} />} label="Email" value={student.email} />
                <InfoRow icon={<Phone size={13} />} label="Student Phone" value={student.phone} />
                <InfoRow icon={<Phone size={13} />} label="Parent / Guardian" value={student.parentPhone} />
                <InfoRow icon={<Calendar size={13} />} label="Date of Birth"
                  value={student.dob ? new Date(student.dob).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null} />
                <InfoRow icon={<School size={13} />} label="School" value={student.schoolName} />
                <InfoRow icon={<User2 size={13} />} label="Tutor" value={student.tutorName || undefined} />
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>First Name</label>
                    <input className={inputCls} value={editForm.firstName} onChange={(e) => setEditForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" />
                  </div>
                  <div>
                    <label className={labelCls}>Last Name</label>
                    <input className={inputCls} value={editForm.lastName} onChange={(e) => setEditForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Student Phone</label>
                  <input type="tel" className={inputCls} value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="555-0100" />
                </div>
                <div>
                  <label className={labelCls}>Parent / Guardian Phone</label>
                  <input type="tel" className={inputCls} value={editForm.parentPhone} onChange={(e) => setEditForm(f => ({ ...f, parentPhone: e.target.value }))} placeholder="555-0101" />
                </div>
                <div>
                  <label className={labelCls}>Date of Birth</label>
                  <input type="date" className={inputCls} value={editForm.dob} onChange={(e) => setEditForm(f => ({ ...f, dob: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>School Name</label>
                  <input className={inputCls} value={editForm.schoolName} onChange={(e) => setEditForm(f => ({ ...f, schoolName: e.target.value }))} placeholder="Lincoln High School" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Grade</label>
                    <select className={inputCls} value={editForm.grade} onChange={(e) => setEditForm(f => ({ ...f, grade: e.target.value }))}>
                      <option value="">—</option>
                      {['9', '10', '11', '12'].map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Target Score</label>
                    <input type="number" min={1} max={36} className={inputCls} value={editForm.targetScore} onChange={(e) => setEditForm(f => ({ ...f, targetScore: e.target.value }))} placeholder="e.g. 32" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Assign Tutor</label>
                  <select className={inputCls} value={editForm.tutorId} onChange={(e) => setEditForm(f => ({ ...f, tutorId: e.target.value }))}>
                    <option value="">No tutor</option>
                    {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600">Progress to Target</p>
              <Badge variant={pct >= 85 ? 'success' : pct >= 65 ? 'warning' : 'danger'} size="sm">
                {pct >= 85 ? 'On Track' : pct >= 65 ? 'Improving' : 'Needs Help'}
              </Badge>
            </div>
            <div className="flex items-end justify-between text-sm font-bold mb-2">
              <span className="text-slate-900">{avg || '—'} <span className="text-xs text-slate-400 font-normal">current</span></span>
              <span className="text-blue-600">{target} <span className="text-xs text-slate-400 font-normal">target</span></span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pct >= 85 ? 'bg-emerald-500' : pct >= 65 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${pct}%` }} />
            </div>
            {avg > 0 && (
              <p className="text-xs text-slate-400 mt-2">
                {gap > 0 ? `${gap} points to go` : 'Target reached!'}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-slate-100">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
              <p className="text-sm font-semibold text-slate-700">Admin Notes</p>
              <button onClick={() => setNoteOpen(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                <PlusCircle size={12} /> Add
              </button>
            </div>
            {notes.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-400">No notes yet.</p>
            ) : (
              <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                {notes.map((note) => (
                  <div key={note.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-slate-600">{note.author}</p>
                      <p className="text-xs text-slate-400">{note.createdAt ? new Date(note.createdAt).toLocaleDateString() : ''}</p>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{note.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: analytics ───────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard title="Accuracy" value={analytics ? `${analytics.overallAccuracy}%` : '—'} icon={<TrendingUp size={15} />} />
            <StatCard title="Tests Taken" value={analytics?.totalAttempts ?? 0} subtitle="completed" icon={<Clock size={15} />} />
            <StatCard title="Avg Score" value={analytics?.avgScore ?? '—'} subtitle="out of 36" icon={<Target size={15} />} />
            <StatCard title="Latest Score" value={analytics?.latestScore ?? '—'} subtitle="ACT composite" icon={<BookOpen size={15} />} />
          </div>

          {/* Score trend */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <p className="font-medium text-slate-900 text-sm mb-0.5">Score Progress</p>
            <p className="text-xs text-slate-400 mb-4">Test-by-test improvement</p>
            {!analytics || analytics.trend.length === 0 ? (
              <div className="flex items-center justify-center h-36 text-slate-300 text-sm">No test data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={analytics.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                  <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 36]} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }}
                    formatter={(v, n, p) => [v, p.payload?.testTitle ?? n]} />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} name="Score" />
                  {target > 0 && (
                    <Line type="monotone" dataKey={() => target} stroke="#e2e8f0" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Target" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Section analysis */}
          {sectionData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="font-medium text-slate-900 text-sm mb-0.5">Section Analysis</p>
              <p className="text-xs text-slate-400 mb-4">Accuracy and time usage by section</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sectionData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="accuracy" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Accuracy %" barSize={22} />
                  <Bar dataKey="timeEfficiency" fill="#10b981" radius={[3, 3, 0, 0]} name="Time Used %" barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Test history */}
          <div className="bg-white rounded-xl border border-slate-100">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
              <p className="font-medium text-slate-900 text-sm">Test History</p>
              <Button size="sm" variant="secondary" icon={<BookOpen size={12} />} onClick={() => setAssignOpen(true)}>
                Assign Test
              </Button>
            </div>
            {!analytics || analytics.trend.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">No tests taken yet.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {analytics.trend.map((entry, i) => {
                  const pctBar = Math.round((entry.score / 36) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={13} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 font-medium truncate">{entry.testTitle}</p>
                        <p className="text-xs text-slate-400">{entry.date}</p>
                      </div>
                      <div className="text-right flex-shrink-0 mr-2">
                        <p className="text-base font-bold text-slate-900">{entry.score}</p>
                        <p className="text-xs text-slate-400">/ 36</p>
                      </div>
                      <div className="hidden sm:flex flex-col gap-1 w-20 flex-shrink-0">
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pctBar >= 80 ? 'bg-emerald-400' : pctBar >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${pctBar}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-400 text-right">{pctBar}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Security & Integrity Logs */}
          {analytics?.cheatingLogs && analytics.cheatingLogs.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 mt-4">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
                <p className="font-medium text-slate-900 text-sm flex items-center gap-1.5"><AlertTriangle size={14} className="text-red-500" /> Security & Integrity Logs</p>
              </div>
              <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                {analytics.cheatingLogs.map((log) => (
                  <div key={log.id} className="flex flex-col gap-1 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-red-600 font-medium flex items-center gap-1.5">{log.eventType}</p>
                      <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-slate-600">Test: {log.testTitle}</p>
                    {log.metadata && (
                      <pre className="mt-1 text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Test Modal */}
      <Modal isOpen={assignOpen} onClose={() => { setAssignOpen(false); setSelectedTestId(''); }}
        title="Assign Test" size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={!selectedTestId || assignLoading} onClick={async () => {
              if (!selectedTestId || !id) return;
              setAssignLoading(true);
              try {
                await api.createTestAssignments({ testId: selectedTestId, studentIds: [id] });
                const test = publishedTests.find((t) => t.id === selectedTestId);
                toast.success(`"${test?.title}" assigned`);
                setAssignOpen(false);
                setSelectedTestId('');
              } catch (e) {
                toast.error((e as Error).message || 'Failed to assign');
              } finally {
                setAssignLoading(false);
              }
            }}>{assignLoading ? 'Assigning…' : 'Assign'}</Button>
          </div>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Select a published test to assign to <strong>{student.name}</strong>.</p>
          {publishedTests.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No published tests available.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {publishedTests.map((test) => (
                <label key={test.id}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedTestId === test.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                  }`}>
                  <input type="radio" name="test" value={test.id} checked={selectedTestId === test.id}
                    onChange={() => setSelectedTestId(test.id)} className="mt-0.5 accent-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{test.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{(test.sections as unknown[]).length} sections</p>
                  </div>
                  {selectedTestId === test.id && <CheckCircle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />}
                </label>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Add Note Modal */}
      <Modal isOpen={noteOpen} onClose={() => { setNoteOpen(false); setNoteText(''); }} title="Add Note" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim() || noteSaving}>
              {noteSaving ? 'Saving…' : 'Save Note'}
            </Button>
          </div>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Note for <strong>{student.name}</strong> — visible to admins and tutors.</p>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
            placeholder="Observations, focus areas, progress notes…" rows={4}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            autoFocus />
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Student" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting…' : 'Yes, Delete'}
            </Button>
          </div>
        }>
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <strong>{student.name}</strong>? All their test attempts and assignments will be permanently removed.
        </p>
      </Modal>
    </div>
  );
}
