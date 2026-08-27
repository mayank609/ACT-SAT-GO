import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Clock, Target, BookOpen, MessageSquare, PlusCircle, AlertTriangle, GraduationCap, BookOpenCheck } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { StatCard } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { api, type DbUser } from '../../lib/api';
import { isHW, isEnglish, isMath } from '../../lib/testCategorize';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';
import { formatDate } from '../../lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';

interface Note {
  id: string;
  text: string;
  createdAt: string;
  author: string;
}

interface ClassProgressEntry {
  id: string;
  topic: string;
  homework?: string;
  notes: string;
  classDate: string;
  author: string;
  createdAt: string;
}

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

interface DbTest { id: string; title: string; status: string; category?: string; subCategory?: string; sections: unknown[] }

export function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();

  const [student, setStudent] = useState<DbUser | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [publishedTests, setPublishedTests] = useState<DbTest[]>([]);
  const [loading, setLoading] = useState(true);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [assignFilter, setAssignFilter] = useState('All');
  const [assignSubFilter, setAssignSubFilter] = useState<'All' | 'HW' | 'English' | 'Maths'>('All');
  const [assignSearch, setAssignSearch] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);

  const [progressEntries, setProgressEntries] = useState<ClassProgressEntry[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getUser(id).then((r) => setStudent(r.user)),
      api.getStudentAnalytics(id).then((r) => setAnalytics(r)),
      api.getAllTests().then((r) => setPublishedTests(
        (r.tests as DbTest[]).filter((t) => t.status === 'PUBLISHED')
      )),
    ]).finally(() => setLoading(false));
  }, [id]);

  // Load persisted notes once tutorId (dbId) is available
  useEffect(() => {
    if (!dbId || !id) return;
    api.getNotes(dbId, id)
      .then((r) => setNotes(r.notes))
      .catch(() => {});
    api.getClassProgress(dbId, id)
      .then((r) => setProgressEntries(r.entries))
      .catch(() => {});
  }, [dbId, id]);

  const handleAddNote = async () => {
    if (!noteText.trim() || !dbId || !id) return;
    setNoteSaving(true);
    try {
      const { note } = await api.addNote(dbId, id, noteText.trim(), user?.name ?? 'Tutor');
      setNotes((prev) => [note, ...prev]);
      setNoteText('');
      setNoteOpen(false);
      toast.success('Note saved.');
    } catch {
      toast.error('Failed to save note.');
    } finally {
      setNoteSaving(false);
    }
  };

  const openAssignHomework = () => {
    setAssignFilter('Practice Sheet');
    setAssignSubFilter('HW');
    setAssignOpen(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-slate-400 text-sm">Loading...</div></div>;
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-3">
        <p className="text-slate-500">Student not found.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">Go back</button>
      </div>
    );
  }

  const target = (student.targetScore as number | null) ?? 32;
  const gap = target - (student.avgScore ?? 0);
  const pct = Math.min(100, ((student.avgScore ?? 0) / target) * 100);

  const sectionData = (analytics?.sectionStats ?? []).map((s) => ({
    name: s.sectionName,
    accuracy: s.accuracy,
    timeEfficiency: s.timeAllocated > 0 ? Math.round((s.timeUsed / s.timeAllocated) * 100) : 0,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 self-start transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 truncate">{student.name}</h1>
          <p className="text-slate-400 text-sm">{student.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<MessageSquare size={13} />} onClick={() => setNoteOpen(true)}>
            Add Note
          </Button>
          <Button variant="secondary" size="sm" icon={<GraduationCap size={13} />} onClick={openAssignHomework}>
            Assign Homework
          </Button>
          <Button size="sm" icon={<BookOpen size={13} />} onClick={() => setAssignOpen(true)}>
            Assign Test
          </Button>
        </div>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold flex-shrink-0">
            {student.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: 'Current Score', value: student.avgScore ?? '—', color: 'text-slate-900' },
              { label: 'Target Score', value: target, color: 'text-blue-600' },
              { label: 'Gap', value: gap > 0 ? `+${gap}` : String(gap), color: gap > 0 ? 'text-amber-600' : 'text-emerald-600' },
              { label: 'Tests Done', value: student.testsAttempted ?? 0, color: 'text-slate-900' },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 rounded-lg p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Progress to target</span>
            <Badge variant={pct >= 85 ? 'success' : pct >= 70 ? 'warning' : 'danger'} size="sm">
              {pct >= 85 ? 'On Track' : pct >= 70 ? 'Progressing' : 'Needs Help'}
            </Badge>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${pct >= 85 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Overall Accuracy" value={analytics ? `${analytics.overallAccuracy}%` : '—'} icon={<TrendingUp size={16} />} trend={{ value: 5, positive: true }} />
        <StatCard title="Tests Taken" value={analytics?.totalAttempts ?? 0} subtitle="submitted" icon={<Clock size={16} />} />
        <StatCard title="Avg Score" value={analytics?.avgScore ?? '—'} subtitle={analytics?.trend.some(d => d.score > 36) ? "submitted tests (SAT)" : "submitted tests (ACT)"} icon={<Target size={16} />} />
        <StatCard title="Latest Score" value={analytics?.latestScore ?? '—'} subtitle={analytics?.trend.some(d => d.score > 36) ? "SAT composite" : "ACT composite"} icon={<BookOpen size={16} />} />
      </div>

      {analytics && analytics.trend.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
            <p className="font-medium text-slate-900 text-sm mb-1">Score Progress</p>
            <p className="text-xs text-slate-400 mb-4">Test-by-test improvement</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={analytics.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                <YAxis domain={analytics.trend.some(d => d.score > 36) ? [400, 1600] : [0, 36]} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }}
                  formatter={(v, n, p) => [v, p.payload?.testTitle ?? n]} />
                <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} name="Score" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {sectionData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <p className="font-medium text-slate-900 text-sm mb-1">Section Analysis</p>
              <p className="text-xs text-slate-400 mb-4">Accuracy by section</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sectionData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', boxShadow: 'none' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="accuracy" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Accuracy %" barSize={20} />
                  <Bar dataKey="timeEfficiency" fill="#10b981" radius={[3, 3, 0, 0]} name="Time Used %" barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Test history */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="px-5 py-3.5 border-b border-slate-50">
          <p className="font-medium text-slate-900 text-sm">Test History</p>
          <p className="text-xs text-slate-400 mt-0.5">Click any test to view full review</p>
        </div>
        {!analytics || analytics.trend.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">No tests taken yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {analytics.trend.map((entry, i) => (
              <div key={i}
                onClick={() => navigate(`/test-review/${entry.attemptId}`)}
                className="flex items-center gap-3 px-5 py-3 hover:bg-blue-50/40 transition-colors cursor-pointer group">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={13} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 group-hover:text-blue-700 transition-colors truncate">{entry.testTitle}</p>
                  <p className="text-xs text-slate-400">{entry.date}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-semibold text-slate-900">{entry.score}</p>
                  <p className="text-xs text-slate-400">/ 36</p>
                </div>
                <div className="hidden sm:block w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(entry.score / 36) * 100}%` }} />
                </div>
                <ArrowLeft size={13} className="text-slate-300 group-hover:text-blue-500 rotate-180 transition-colors flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security & Integrity Logs */}
      {analytics?.cheatingLogs && analytics.cheatingLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100">
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

      {/* Attendance & Homework Log */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <div>
            <p className="font-medium text-slate-900 text-sm">Attendance & Homework Log</p>
            <p className="text-xs text-slate-400 mt-0.5">Sessions taught and homework assigned — logged from the Attendance page</p>
          </div>
          <span className="text-xs text-slate-400 flex-shrink-0">
            {new Set(progressEntries.map((e) => e.classDate)).size} day{new Set(progressEntries.map((e) => e.classDate)).size !== 1 ? 's' : ''} taught
          </span>
        </div>
        {progressEntries.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">No sessions logged yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {progressEntries.map((entry) => (
              <div key={entry.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-slate-900">{entry.topic}</p>
                  <p className="text-xs text-slate-400 flex-shrink-0">
                    {formatDate(entry.classDate)}
                  </p>
                </div>
                {entry.homework && (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-md px-2 py-1 inline-flex items-center gap-1.5 mt-1">
                    <BookOpenCheck size={12} /> <span className="font-medium">Homework:</span> {entry.homework}
                  </p>
                )}
                {entry.notes && <p className="text-sm text-slate-600 leading-relaxed mt-1">{entry.notes}</p>}
                <p className="text-xs text-slate-400 mt-1">{entry.author}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tutor Notes */}
      <div className="bg-white rounded-xl border border-slate-100">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
          <p className="font-medium text-slate-900 text-sm">Tutor Notes</p>
          <button onClick={() => setNoteOpen(true)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
            <PlusCircle size={12} /> Add note
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">No notes yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {notes.map((note) => (
              <div key={note.id} className="px-5 py-3.5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-slate-600">{note.author}</p>
                  <p className="text-xs text-slate-400">{note.createdAt}</p>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{note.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Test Modal */}
      <Modal isOpen={assignOpen} onClose={() => { setAssignOpen(false); setSelectedTestIds([]); setAssignFilter('All'); setAssignSubFilter('All'); setAssignSearch(''); }}
        title="Assign Tests" size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => { setAssignOpen(false); setSelectedTestIds([]); setAssignFilter('All'); setAssignSubFilter('All'); setAssignSearch(''); }}>Cancel</Button>
            <Button size="sm" disabled={selectedTestIds.length === 0 || assignLoading} onClick={async () => {
              if (selectedTestIds.length === 0 || !id) return;
              setAssignLoading(true);
              try {
                await Promise.all(
                  selectedTestIds.map((testId) =>
                    api.createTestAssignments({ testId, studentIds: [id] })
                  )
                );
                const titles = selectedTestIds
                  .map((tId) => publishedTests.find((t) => t.id === tId)?.title)
                  .filter(Boolean);
                toast.success(
                  titles.length > 1
                    ? `${titles.length} tests assigned successfully.`
                    : `"${titles[0]}" assigned successfully.`
                );
                setAssignOpen(false);
                setSelectedTestIds([]);
                setAssignFilter('All');
                setAssignSubFilter('All');
                setAssignSearch('');
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : 'Failed to assign tests.');
              } finally {
                setAssignLoading(false);
              }
            }}>{assignLoading ? 'Assigning...' : 'Assign'}</Button>
          </div>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Select one or more published tests to assign to <strong>{student.name}</strong>.</p>
          {publishedTests.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No published tests available.</p>
          ) : (() => {
            const categories = ['All', ...Array.from(new Set(publishedTests.map(t => t.category ?? 'Other')))];
            const filtered = publishedTests
              .filter(t => assignFilter === 'All' || (t.category ?? 'Other') === assignFilter)
              .filter((t) => {
                if (assignFilter !== 'Practice Sheet' || assignSubFilter === 'All') return true;
                if (assignSubFilter === 'HW') return isHW(t);
                if (assignSubFilter === 'English') return isEnglish(t);
                if (assignSubFilter === 'Maths') return isMath(t);
                return true;
              })
              .filter(t => !assignSearch.trim() || t.title.toLowerCase().includes(assignSearch.trim().toLowerCase()));
            return (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setAssignFilter(cat); setAssignSubFilter('All'); }}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        assignFilter === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                      <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${assignFilter === cat ? 'bg-blue-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
                        {cat === 'All' ? publishedTests.length : publishedTests.filter(t => (t.category ?? 'Other') === cat).length}
                      </span>
                    </button>
                  ))}
                </div>

                {assignFilter === 'Practice Sheet' && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
                    {(['All', 'HW', 'English', 'Maths'] as const).map((sub) => {
                      const count = publishedTests
                        .filter((t) => (t.category ?? 'Other') === 'Practice Sheet')
                        .filter((t) => {
                          if (sub === 'All') return true;
                          if (sub === 'HW') return isHW(t);
                          if (sub === 'English') return isEnglish(t);
                          if (sub === 'Maths') return isMath(t);
                          return true;
                        }).length;

                      return (
                        <button
                          key={sub}
                          onClick={() => setAssignSubFilter(sub)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                            assignSubFilter === sub ? 'bg-blue-500 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                          }`}
                        >
                          {sub}
                          <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full ${assignSubFilter === sub ? 'bg-blue-400 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <input
                  type="text"
                  value={assignSearch}
                  onChange={e => { setAssignSearch(e.target.value); }}
                  placeholder="Search tests by name…"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center">No tests found.</p>
                  ) : filtered.map((test) => {
                    const isSelected = selectedTestIds.includes(test.id);
                    return (
                      <label key={test.id}
                        className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                        }`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTestIds((prev) => [...prev, test.id]);
                            } else {
                              setSelectedTestIds((prev) => prev.filter((tId) => tId !== test.id));
                            }
                          }}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{test.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{(test.sections as unknown[]).length} sections</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      </Modal>

      {/* Add Note Modal */}
      <Modal isOpen={noteOpen} onClose={() => { setNoteOpen(false); setNoteText(''); }} title="Add Tutor Note" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim() || noteSaving}>
              {noteSaving ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Note for <strong>{student.name}</strong> — visible only to tutors and admins.</p>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
            placeholder="Observations, focus areas, session notes..." rows={5}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
            autoFocus />
          <p className="text-xs text-slate-400">{noteText.length}/500</p>
        </div>
      </Modal>
    </div>
  );
}
