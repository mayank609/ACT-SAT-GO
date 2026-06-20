import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Target, TrendingUp, Clock, Phone, School, Calendar,
  User2, Mail, Pencil, Trash2, CheckCircle, X, Save, MessageSquare, PlusCircle,
  AlertTriangle, Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, XCircle, Maximize2,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { StatCard } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import { api, type DbUser } from '../../lib/api';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';

// ─── Test Analysis types ──────────────────────────────────────────────────────

interface TaAnswer {
  key?: string;
  keys?: string[];
  value?: number;
}

interface TaQuestion {
  id: string;
  type: string;
  content: { text: string; explanation?: string | null };
  options: Record<string, string> | null;
  correctAnswer: TaAnswer;
  difficultyLevel: string;
  subject?: string | null;
  childQuestions?: TaQuestion[];
}

interface TaTestQuestion {
  id: string;
  questionId: string;
  orderIndex: number;
  question: TaQuestion;
}

interface TaSectionAttempt {
  id: string;
  sectionId: string;
  startedAt: string;
  completedAt: string | null;
  section: {
    id: string;
    name: string;
    durationMinutes: number;
    orderIndex: number;
    questions: TaTestQuestion[];
  };
}

interface TaAttemptAnswer {
  id: string;
  questionId: string;
  answerGiven: TaAnswer | null;
  timeSpentSeconds: number;
  isFlagged: boolean;
}

interface TaAttempt {
  id: string;
  testId: string;
  status: string;
  totalScore: number | null;
  startedAt: string;
  completedAt: string | null;
  test: { id: string; title: string; category?: string };
  sectionAttempts: TaSectionAttempt[];
  answers: TaAttemptAnswer[];
}

function taAnswersMatch(given: TaAnswer | null, correct: TaAnswer): boolean {
  if (!given || !correct) return false;
  if (correct.value !== undefined) {
    if (given.value === undefined) return false;
    return Number(given.value) === Number(correct.value) || String(given.value).trim() === String(correct.value).trim();
  }
  if (correct.keys) {
    if (!given.keys) return false;
    const gKeys = given.keys.map(k => String(k).toUpperCase().trim()).sort();
    const cKeys = correct.keys.map(k => String(k).toUpperCase().trim()).sort();
    return JSON.stringify(gKeys) === JSON.stringify(cKeys);
  }
  if (correct.key !== undefined) {
    if (given.key === undefined) return false;
    return String(given.key).toUpperCase().trim() === String(correct.key).toUpperCase().trim();
  }
  return false;
}

function taOptionsToDisplay(options: Record<string, string> | null): Array<{ id: string; text: string }> {
  if (!options) return [];
  return Object.entries(options).map(([k, v]) => ({ id: k.toLowerCase(), text: v }));
}

function taAnswerToDisplay(ans: TaAnswer | null): string | string[] | number | null {
  if (!ans) return null;
  if (ans.value !== undefined) return ans.value;
  if (ans.keys) return ans.keys.map((k) => k.toLowerCase());
  if (ans.key) return ans.key.toLowerCase();
  return null;
}

interface SectionAnalysis {
  name: string;
  category: string;
  correct: number;
  incorrect: number;
  omitted: number;
  total: number;
  unvisited: number;
  accuracy: number;
  timeTaken: string;
  bookmarked: number;
}

function computeTestAnalysis(attempt: TaAttempt): {
  sections: SectionAnalysis[];
  totalCorrect: number;
  totalQuestions: number;
  rwCorrect: number;
  rwTotal: number;
  mathCorrect: number;
  mathTotal: number;
  isSAT: boolean;
  finalScaledScore: number;
  rwScaled: number;
  mathScaled: number;
} {
  const answersMap = new Map(attempt.answers.map(a => [a.questionId, a]));
  const sortedSections = [...attempt.sectionAttempts].sort((a, b) => a.section.orderIndex - b.section.orderIndex);

  let totalCorrect = 0, totalQuestions = 0;
  let rwCorrect = 0, rwTotal = 0, mathCorrect = 0, mathTotal = 0;

  const sections: SectionAnalysis[] = sortedSections.map(sa => {
    // Flatten passage questions
    const flatQs: TaTestQuestion[] = [];
    sa.section.questions.forEach(tq => {
      const q = tq.question;
      const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
      if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
        q.childQuestions.forEach(cq => {
          flatQs.push({ id: cq.id, questionId: cq.id, orderIndex: tq.orderIndex, question: cq });
        });
      } else if (!(q as any).parentQuestionId) {
        // Skip child rows: already emitted via their passage parent above.
        flatQs.push(tq);
      }
    });

    let correct = 0, incorrect = 0, omitted = 0, unvisited = 0, bookmarked = 0;
    flatQs.forEach(tq => {
      const ans = answersMap.get(tq.questionId);
      if (!ans) { unvisited++; omitted++; return; }
      if (ans.isFlagged) bookmarked++;
      if (!ans.answerGiven) { omitted++; return; }
      if (taAnswersMatch(ans.answerGiven, tq.question.correctAnswer)) correct++;
      else incorrect++;
    });

    const total = flatQs.length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    // Time calculation
    let timeTaken = '—';
    if (sa.startedAt && sa.completedAt) {
      const mins = Math.round((new Date(sa.completedAt).getTime() - new Date(sa.startedAt).getTime()) / 60000);
      const secs = Math.round(((new Date(sa.completedAt).getTime() - new Date(sa.startedAt).getTime()) % 60000) / 1000);
      timeTaken = `${mins}:${secs.toString().padStart(2, '0')} Minutes Taken`;
    }

    // Category detection
    const isMath = /math/i.test(sa.section.name);
    const isRW = /reading|writing|rw/i.test(sa.section.name);
    const category = isMath ? 'Math' : isRW ? 'Reading and Writing' : sa.section.name;

    if (isMath) { mathCorrect += correct; mathTotal += total; }
    else if (isRW) { rwCorrect += correct; rwTotal += total; }

    totalCorrect += correct;
    totalQuestions += total;

    return { name: sa.section.name, category, correct, incorrect, omitted, total, unvisited, accuracy, timeTaken, bookmarked };
  });

  // Calculate final scaled score directly instead of raw score for SAT
  let rw1 = 0, rw2 = 0, math1 = 0, math2 = 0;
  let isSAT = false;

  sections.forEach((s) => {
    const isMath = /math/i.test(s.name);
    const isRW = /reading|writing|rw/i.test(s.name);
    if (isMath || isRW) isSAT = true;
    
    if (isMath) {
      if (/1|one/i.test(s.name)) math1 += s.correct;
      else if (/2|two/i.test(s.name)) math2 += s.correct;
      else math1 += s.correct; // Fallback
    } else if (isRW) {
      if (/1|one/i.test(s.name)) rw1 += s.correct;
      else if (/2|two/i.test(s.name)) rw2 += s.correct;
      else rw1 += s.correct; // Fallback
    }
  });

  let finalScaledScore = totalCorrect;
  let rwScaled = 0;
  let mathScaled = 0;
  if (isSAT) {
    rwScaled = 200;
    mathScaled = 200;

    if (rw1 >= 18) {
      rwScaled = 400 + Math.round(((rw1 + rw2) / 54) * 400 / 10) * 10;
    } else {
      rwScaled = 200 + Math.round(((rw1 + rw2) / 54) * 450 / 10) * 10;
    }
    
    if (math1 >= 14) {
      mathScaled = 420 + Math.round(((math1 + math2) / 44) * 380 / 10) * 10;
    } else {
      mathScaled = 200 + Math.round(((math1 + math2) / 44) * 450 / 10) * 10;
    }

    rwScaled = Math.min(800, Math.max(200, rwScaled));
    mathScaled = Math.min(800, Math.max(200, mathScaled));
    finalScaledScore = rwScaled + mathScaled;
  }

  return { sections, totalCorrect, totalQuestions, rwCorrect, rwTotal, mathCorrect, mathTotal, isSAT, finalScaledScore, rwScaled, mathScaled };
}

// ─── Existing types ────────────────────────────────────────────────────────────

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
interface DbTest { id: string; title: string; status: string; category?: string; sections: unknown[] }

const isHW = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('hw') || t.includes('homework') || t.includes(' hw') || t.endsWith('hw') || /\bhw\b/.test(t);
};

const isEnglish = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('rw') || sub.includes('english') || sub.includes('reading') || sub.includes('writing') ||
         /reading|writing|english|verbal|grammar|\brw\b/.test(t);
};

const isMath = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('math') || sub.includes('quant') ||
         /math|algebra|geometry|calc/.test(t);
};

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
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [assignFilter, setAssignFilter] = useState('All');
  const [assignSubFilter, setAssignSubFilter] = useState<'All' | 'HW' | 'English' | 'Maths'>('All');
  const [assignSearch, setAssignSearch] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Test Analysis state
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [expandedAttempt, setExpandedAttempt] = useState<TaAttempt | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<Record<string, 'submitted' | 'not_submitted'>>({});

  // Question Wise Report state
  const [activeQuestionSectionIdx, setActiveQuestionSectionIdx] = useState(0);
  const [questionFilterBy, setQuestionFilterBy] = useState('all');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [fullscreenQuestionReportOpen, setFullscreenQuestionReportOpen] = useState(false);
  const [showFullscreenPalette, setShowFullscreenPalette] = useState(false);
  const [showQuestionNavigator, setShowQuestionNavigator] = useState(false);

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
              <Button size="sm" icon={<BookOpen size={13} />} onClick={() => { setAssignOpen(true); setAssignFilter('All'); setAssignSearch(''); setSelectedTestIds([]); }}>Assign Test</Button>
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
                    <SearchableSelect
                      options={[
                        { id: '', label: '—', searchText: 'none' },
                        ...['9', '10', '11', '12'].map(g => ({ id: g, label: `Grade ${g}`, searchText: g }))
                      ]}
                      value={editForm.grade}
                      onChange={(value) => setEditForm(f => ({ ...f, grade: value }))}
                      placeholder="Select grade"
                      minWidth="min-w-[100px]"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Target Score</label>
                    <input type="number" min={1} max={36} className={inputCls} value={editForm.targetScore} onChange={(e) => setEditForm(f => ({ ...f, targetScore: e.target.value }))} placeholder="e.g. 32" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Assign Tutor</label>
                  <SearchableSelect
                    options={[
                      { id: '', label: 'No tutor', searchText: 'no' },
                      ...tutors.map(t => ({ id: t.id, label: t.name, searchText: t.name }))
                    ]}
                    value={editForm.tutorId}
                    onChange={(value) => setEditForm(f => ({ ...f, tutorId: value }))}
                    placeholder="Select tutor"
                    minWidth="min-w-[150px]"
                  />
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
          {(() => {
            const isSATStudent = analytics?.trend.some(d => d.score > 36) ?? false;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard title="Accuracy" value={analytics ? `${analytics.overallAccuracy}%` : '—'} icon={<TrendingUp size={15} />} />
                <StatCard title="Tests Taken" value={analytics?.totalAttempts ?? 0} subtitle="completed" icon={<Clock size={15} />} />
                <StatCard title="Avg Score" value={analytics?.avgScore ?? '—'} subtitle={isSATStudent ? "out of 1600" : "out of 36"} icon={<Target size={15} />} />
                <StatCard title="Latest Score" value={analytics?.latestScore ?? '—'} subtitle={isSATStudent ? "SAT composite" : "ACT composite"} icon={<BookOpen size={15} />} />
              </div>
            );
          })()}

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
                  <YAxis domain={analytics.trend.some(d => d.score > 36) ? [400, 1600] : [0, 36]} tick={{ fontSize: 10, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
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
              <Button size="sm" variant="secondary" icon={<BookOpen size={12} />} onClick={() => { setAssignOpen(true); setAssignFilter('All'); setAssignSearch(''); setSelectedTestIds([]); }}>
                Assign Test
              </Button>
            </div>
            {!analytics || analytics.trend.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-400">No tests taken yet.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {analytics.trend.map((entry, i) => {
                  const pctBar = Math.round((entry.score / 36) * 100);
                  const isExpanded = expandedAttemptId === entry.attemptId;
                  return (
                    <div key={i}>
                      <div
                        className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                        }`}
                        onClick={async () => {
                          if (isExpanded) {
                            setExpandedAttemptId(null);
                            setExpandedAttempt(null);
                            return;
                          }
                          setExpandedAttemptId(entry.attemptId);
                          setExpandedLoading(true);
                          try {
                            const { attempt } = await api.getAttempt(entry.attemptId);
                            setExpandedAttempt(attempt as TaAttempt);
                          } catch {
                            toast.error('Failed to load test analysis');
                            setExpandedAttemptId(null);
                          } finally {
                            setExpandedLoading(false);
                          }
                        }}
                      >
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
                        <div className="flex-shrink-0 ml-1">
                          {isExpanded ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-slate-400" />}
                        </div>
                      </div>

                      {/* ─── EXPANDED TEST ANALYSIS PANEL ─── */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/40">
                          {expandedLoading ? (
                            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
                              <Loader2 size={18} className="animate-spin" />
                              <span className="text-sm">Loading test analysis…</span>
                            </div>
                          ) : expandedAttempt ? (() => {
                            const analysis = computeTestAnalysis(expandedAttempt);
                            const isMockTest = ['Mock Test', 'Diagnostic'].includes(expandedAttempt.test.category ?? '') || /mock|diagnostic/i.test(expandedAttempt.test.title ?? '');
                            const completedDate = expandedAttempt.completedAt
                              ? new Date(expandedAttempt.completedAt).toLocaleDateString('en-US', {
                                  day: '2-digit', month: '2-digit', year: 'numeric'
                                }) + ', ' + new Date(expandedAttempt.completedAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit', minute: '2-digit'
                                })
                              : '—';
                            const status = analysisStatus[entry.attemptId] ?? 'not_submitted';

                            return (
                              <div className="p-4 space-y-4">
                                {/* ── Header: Student + Test info + Buttons ── */}
                                <div className="bg-white rounded-xl border border-slate-200 py-3 px-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="relative flex-shrink-0">
                                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                        <User2 size={24} />
                                      </div>
                                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                                        <CheckCircle size={8} className="text-white" />
                                      </div>
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-sm font-bold text-slate-900">{expandedAttempt.test.title}</h3>
                                      </div>
                                      <p className="text-[11px] text-slate-500 mt-0.5">{expandedAttempt.test.title}</p>
                                      <p className="text-[11px] text-slate-400 mt-0.5">Completed on {completedDate}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toast.success('Reset functionality coming soon'); }}
                                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm"
                                    >
                                      Reset
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAnalysisStatus(prev => ({
                                          ...prev,
                                          [entry.attemptId]: status === 'submitted' ? 'not_submitted' : 'submitted'
                                        }));
                                        toast.success(status === 'submitted' ? 'Marked as not submitted' : 'Marked as submitted');
                                      }}
                                      className={`px-3 py-1.5 text-xs font-semibold text-white rounded-md transition-colors shadow-sm ${
                                        status === 'submitted'
                                          ? 'bg-emerald-600 hover:bg-emerald-700'
                                          : 'bg-blue-800 hover:bg-blue-900'
                                      }`}
                                    >
                                      {status === 'submitted' ? 'Analysis Submitted' : 'Analysis not Submitted'}
                                    </button>
                                  </div>
                                </div>

                                {/* Score Card */}
                                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                                  <div className="flex items-stretch divide-x divide-slate-200">
                                    {/* Total Score — slightly larger */}
                                    <div className="px-8 py-6 shrink-0 text-center bg-gradient-to-br from-[#1b3d6e] to-[#2563eb] rounded-tl-xl rounded-bl-xl flex flex-col justify-center">
                                      <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Total Score</p>
                                      <p className="text-6xl font-black text-white leading-none tabular-nums mt-1.5">
                                        {(analysis.isSAT && isMockTest) ? analysis.finalScaledScore : analysis.totalCorrect}
                                      </p>
                                      {(analysis.isSAT && isMockTest) ? (
                                        <p className="text-xs text-blue-300 mt-2.5 border-b border-blue-400/40 pb-0.5 w-fit mx-auto">400 – 1600</p>
                                      ) : (
                                        <p className="text-xs text-blue-300 mt-2">out of {analysis.totalQuestions}</p>
                                      )}
                                    </div>
                                    {/* Reading & Writing — fixed width */}
                                    <div className="w-36 py-6 shrink-0 text-center flex flex-col justify-center">
                                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">Reading &amp; Writing</p>
                                      <p className="text-5xl font-black text-slate-900 leading-none tabular-nums mt-2">
                                        {(analysis.isSAT && isMockTest) ? analysis.rwScaled : `${analysis.rwCorrect}/${analysis.rwTotal}`}
                                      </p>
                                      {(analysis.isSAT && isMockTest) && (
                                        <p className="text-xs text-slate-400 mt-2 border-b border-slate-200 pb-0.5 w-fit mx-auto">200 – 800</p>
                                      )}
                                    </div>
                                    {/* Math — same fixed width as R&W */}
                                    <div className="w-36 py-6 shrink-0 text-center flex flex-col justify-center">
                                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">Math</p>
                                      <p className="text-5xl font-black text-slate-900 leading-none tabular-nums mt-2">
                                        {(analysis.isSAT && isMockTest) ? analysis.mathScaled : `${analysis.mathCorrect}/${analysis.mathTotal}`}
                                      </p>
                                      {(analysis.isSAT && isMockTest) && (
                                        <p className="text-xs text-slate-400 mt-2 border-b border-slate-200 pb-0.5 w-fit mx-auto">200 – 800</p>
                                      )}
                                    </div>
                                    {(analysis.isSAT && isMockTest) && (() => {
                                      const score = analysis.finalScaledScore;
                                      const pct = Math.min(100, Math.max(0, ((score - 400) / 1200) * 100));
                                      return (
                                        <div className="flex-1 px-8 py-6 flex flex-col justify-center gap-2.5 min-w-0">
                                          <div className="flex justify-between text-xs text-slate-500 font-medium">
                                            <span>400</span><span>800</span><span>1200</span><span>1600</span>
                                          </div>
                                          <div className="relative h-3 rounded-full" style={{ background: 'linear-gradient(to right, #ef4444 0%, #ef4444 33.33%, #f59e0b 33.33%, #f59e0b 66.67%, #22c55e 66.67%, #22c55e 100%)' }}>
                                            <div className="absolute w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md" style={{ left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)' }} />
                                          </div>
                                          <div className="flex">
                                            <div className="flex-1 text-center">
                                              <p className="text-[10px] font-semibold text-slate-600">Below Average</p>
                                              <p className="text-[10px] text-slate-400">(400 – 800)</p>
                                            </div>
                                            <div className="flex-1 text-center">
                                              <p className="text-[10px] font-semibold text-slate-600">Average</p>
                                              <p className="text-[10px] text-slate-400">(800 – 1200)</p>
                                            </div>
                                            <div className="flex-1 text-center">
                                              <p className="text-[10px] font-semibold text-slate-600">Above Average</p>
                                              <p className="text-[10px] text-slate-400">(1200 – 1600)</p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>

                                {/* ── Section Overview ── */}
                                <div>
                                  <h4 className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-wider">Section Overview</h4>
                                  <div className="space-y-2">
                                    {analysis.sections.map((sec, si) => (
                                      <div key={si} className="bg-white rounded-xl border border-slate-200 py-3 px-4 shadow-sm hover:border-blue-100 transition-colors">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                          <h5 className="text-xs font-bold text-blue-800">{sec.name}</h5>
                                          <span className="text-[9px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                            {sec.category}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
                                          <span className="text-emerald-600 font-semibold">{sec.correct} Correct</span>
                                          <span className="text-red-500 font-semibold">{sec.incorrect} Incorrect</span>
                                          <span>{sec.omitted} Omitted</span>
                                          <span>{sec.total} Total Questions</span>
                                          <span>{sec.unvisited} Unvisited</span>
                                          <span className="text-amber-700 font-semibold">{sec.bookmarked} Bookmarked</span>
                                          <span className="text-blue-600 font-bold">{sec.accuracy.toFixed(2)}% Accuracy</span>
                                          <span className="italic">{sec.timeTaken}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* ── Question Wise Report ── */}
                                <div className="mt-8 bg-white rounded-xl border-2 border-blue-200 p-4">
                                  <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                                      Question Wise Report
                                    </h4>
                                    <button
                                      onClick={() => setFullscreenQuestionReportOpen(true)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors border border-slate-200 cursor-pointer"
                                      title="Open report in fullscreen review mode"
                                    >
                                      <Maximize2 size={13} />
                                      Fullscreen
                                    </button>
                                  </div>
                                  
                                  {/* Section tabs & filter */}
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
                                    <div className="flex flex-wrap gap-2">
                                      {analysis.sections.map((sa, idx) => (
                                        <button
                                          key={idx}
                                          onClick={() => {
                                            setActiveQuestionSectionIdx(idx);
                                            setQuestionFilterBy('all');
                                            setCurrentQuestionIdx(0);
                                          }}
                                          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                                            activeQuestionSectionIdx === idx
                                              ? 'bg-blue-600 text-white'
                                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                          }`}
                                        >
                                          {sa.category}
                                        </button>
                                      ))}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter</span>
                                      <select
                                        value={questionFilterBy}
                                        onChange={(e) => { setQuestionFilterBy(e.target.value); setCurrentQuestionIdx(0); }}
                                        className="px-2.5 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="all">All</option>
                                        <option value="correct">Correct</option>
                                        <option value="incorrect">Incorrect</option>
                                        <option value="omitted">Omitted</option>
                                      </select>
                                    </div>
                                  </div>

                                  {/* Question display */}
                                  {(() => {
                                    const activeSection = analysis.sections[activeQuestionSectionIdx];
                                    if (!activeSection) return <div className="text-sm text-slate-500">No section selected</div>;

                                    const sectionAttempt = expandedAttempt?.sectionAttempts.find(
                                      (sa) => sa.section.name === activeSection.name
                                    );
                                    if (!sectionAttempt) return <div className="text-sm text-slate-500">No questions available for this section</div>;

                                    // Flatten passage parents into their child questions so every
                                    // answerable sub-question is shown (mirrors computeTestAnalysis).
                                    const allQuestions = sectionAttempt.section.questions.flatMap((tq) => {
                                      const q = tq.question;
                                      const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
                                      if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
                                        return q.childQuestions.map((cq) => ({ ...tq, id: cq.id, questionId: cq.id, question: cq, parentPassageText: q.content?.text }));
                                      }
                                      // Skip child rows: already emitted via their passage parent above.
                                      return (q as any).parentQuestionId ? [] : [tq];
                                    });
                                    const answersMap = new Map(expandedAttempt?.answers.map((a) => [a.questionId, a]) ?? []);

                                    const filteredQuestions = allQuestions.filter((tq) => {
                                      const ans = answersMap.get(tq.questionId);
                                      const isCorrect = ans?.answerGiven ? taAnswersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
                                      const isOmitted = !ans?.answerGiven;

                                      if (questionFilterBy === 'correct') return isCorrect;
                                      if (questionFilterBy === 'incorrect') return ans?.answerGiven && !isCorrect;
                                      if (questionFilterBy === 'omitted') return isOmitted;
                                      return true;
                                    });

                                    if (filteredQuestions.length === 0) {
                                      return (
                                        <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                                          <p className="text-slate-500 font-semibold text-sm">No questions match the filter</p>
                                        </div>
                                      );
                                    }

                                    const safeIdx = Math.min(currentQuestionIdx, Math.max(filteredQuestions.length - 1, 0));
                                    const currentTq = filteredQuestions[safeIdx];
                                    const hasPrev = safeIdx > 0;
                                    const hasNext = safeIdx < filteredQuestions.length - 1;

                                    const studentAnswer = answersMap.get(currentTq.questionId);
                                    const correct = studentAnswer?.answerGiven ? taAnswersMatch(studentAnswer.answerGiven, currentTq.question.correctAnswer) : false;
                                    const skipped = !studentAnswer?.answerGiven;
                                    const options = taOptionsToDisplay(currentTq.question.options);
                                    const userAnswerDisplay = taAnswerToDisplay(studentAnswer?.answerGiven ?? null);
                                    const correctAnswerDisplay = taAnswerToDisplay(currentTq.question.correctAnswer);

                                    return (
                                      <div className="flex flex-col gap-4 h-[600px]">
                                        {/* Counter */}
                                        <div className="flex items-center justify-between text-sm flex-shrink-0">
                                          <div className="font-bold text-slate-700">
                                            Total: {allQuestions.length}
                                            {questionFilterBy !== 'all' && (
                                              <span className="text-slate-500 font-medium ml-2">
                                                (Showing {filteredQuestions.length})
                                              </span>
                                            )}
                                          </div>
                                          <div className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
                                            Q{safeIdx + 1} of {filteredQuestions.length}
                                          </div>
                                        </div>

                                        {/* Scrollable Question Card Container */}
                                        <div className="overflow-y-auto flex-1 border-2 rounded-lg bg-white" style={{ borderColor: correct ? '#BFDBFE' : skipped ? '#E2E8F0' : '#E0F2FE' }}>
                                          <div className={`p-4 flex items-start gap-3 sticky top-0 z-10 ${correct ? 'bg-blue-50/55' : skipped ? 'bg-slate-50' : 'bg-sky-50/40'}`}>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${correct ? 'bg-blue-600' : skipped ? 'bg-slate-400' : 'bg-blue-400'}`}>
                                                {allQuestions.findIndex(q => q.questionId === currentTq.questionId) + 1}
                                              </div>
                                              {correct ? <CheckCircle size={14} className="text-blue-600" /> : <XCircle size={14} className={skipped ? 'text-slate-400' : 'text-blue-400'} />}
                                            </div>
                                            <div className="text-sm text-slate-800 flex-1 leading-relaxed text-left font-medium">
                                              <RichContentRenderer content={currentTq.question.content.text || `Question`} variant="question" className="prose-sm" />
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                              {studentAnswer?.timeSpentSeconds ? (
                                                <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={9} />{studentAnswer.timeSpentSeconds}s</span>
                                              ) : null}
                                              {correct ? (
                                                <Badge variant="info" className="bg-blue-600 text-white border-none font-semibold">Correct</Badge>
                                              ) : skipped ? (
                                                <Badge variant="info" className="bg-blue-50 text-blue-600 border-none font-semibold">Skip</Badge>
                                              ) : (
                                                <Badge variant="info" className="bg-blue-200 text-blue-900 border-none font-semibold">Wrong</Badge>
                                              )}
                                            </div>
                                          </div>

                                          <div className="px-4 py-3 border-t border-slate-100">
                                            {options.length > 0 && (
                                              <div className="space-y-2 mb-3 text-left">
                                                {options.map((opt) => {
                                                  const isUserAnswer = Array.isArray(userAnswerDisplay) ? userAnswerDisplay.includes(opt.id) : userAnswerDisplay === opt.id;
                                                  const isCorrectOption = Array.isArray(correctAnswerDisplay) ? correctAnswerDisplay.includes(opt.id) : correctAnswerDisplay === opt.id;
                                                  return (
                                                    <OptionRenderer
                                                      key={opt.id}
                                                      label={opt.id.toUpperCase()}
                                                      text={opt.text}
                                                      isSelected={isUserAnswer && !isCorrectOption}
                                                      isCorrect={isCorrectOption}
                                                      isIncorrect={isUserAnswer && !isCorrectOption}
                                                      showFeedback={true}
                                                      colorTheme="blue"
                                                    />
                                                  );
                                                })}
                                              </div>
                                            )}
                                            {currentTq.question.type === 'NUMERIC' && (
                                              <div className="flex gap-4 text-sm mb-3 text-left">
                                                <span className="text-slate-500">Your answer: <strong className={correct ? 'text-blue-600' : 'text-blue-400'}>{studentAnswer?.answerGiven?.value ?? '—'}</strong></span>
                                                <span className="text-slate-500">Correct: <strong className="text-blue-600">{currentTq.question.correctAnswer.value}</strong></span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Navigation - Fixed at bottom */}
                                        <div className="flex items-center justify-between pt-2 flex-shrink-0 gap-3">
                                          <button
                                            onClick={() => setCurrentQuestionIdx(safeIdx - 1)}
                                            disabled={!hasPrev}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${
                                              hasPrev
                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            }`}
                                          >
                                            <ChevronLeft size={16} />
                                            Previous
                                          </button>

                                          {/* Question Navigator Pill */}
                                          {filteredQuestions.length > 0 && (
                                            <button
                                              onClick={() => setShowQuestionNavigator(true)}
                                              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all shadow-lg cursor-pointer text-xs"
                                            >
                                              Question {safeIdx + 1} of {filteredQuestions.length}
                                              <ChevronDown size={14} />
                                            </button>
                                          )}

                                          <button
                                            onClick={() => setCurrentQuestionIdx(safeIdx + 1)}
                                            disabled={!hasNext}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${
                                              hasNext
                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            }`}
                                          >
                                            Next
                                            <ChevronRight size={16} />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })() : (
                            <div className="py-8 text-center text-slate-400 text-sm">Failed to load test data</div>
                          )}
                        </div>
                      )}
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
                    ? `${titles.length} tests assigned successfully`
                    : `"${titles[0]}" assigned successfully`
                );
                setAssignOpen(false);
                setSelectedTestIds([]);
                setAssignFilter('All');
                setAssignSubFilter('All');
                setAssignSearch('');
              } catch (e) {
                toast.error((e as Error).message || 'Failed to assign tests');
              } finally {
                setAssignLoading(false);
              }
            }}>{assignLoading ? 'Assigning…' : 'Assign'}</Button>
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
                        {isSelected && <CheckCircle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />}
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

      {/* ── Question Navigator Modal ── */}
      {showQuestionNavigator && expandedAttempt && (() => {
        const analysis = computeTestAnalysis(expandedAttempt);
        const activeSection = analysis.sections[activeQuestionSectionIdx];
        if (!activeSection) return null;

        const sectionAttempt = expandedAttempt.sectionAttempts.find(
          (sa) => sa.section.name === activeSection.name
        );
        if (!sectionAttempt) return null;

        const allQuestions = sectionAttempt.section.questions.flatMap((tq) => {
          const q = tq.question;
          const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
          if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
            return q.childQuestions.map((cq) => ({ ...tq, id: cq.id, questionId: cq.id, question: cq, parentPassageText: q.content?.text }));
          }
          // Skip child rows: already emitted via their passage parent above.
          return (q as any).parentQuestionId ? [] : [tq];
        });
        const answersMap = new Map(expandedAttempt.answers.map((a) => [a.questionId, a]));

        const filteredQuestions = allQuestions.filter((tq) => {
          const ans = answersMap.get(tq.questionId);
          const isCorrect = ans?.answerGiven ? taAnswersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
          const isOmitted = !ans?.answerGiven;
          if (questionFilterBy === 'correct') return isCorrect;
          if (questionFilterBy === 'incorrect') return ans?.answerGiven && !isCorrect;
          if (questionFilterBy === 'omitted') return isOmitted;
          return true;
        });

        const safeIdx = Math.min(currentQuestionIdx, Math.max(filteredQuestions.length - 1, 0));

        return (
          <Modal isOpen={showQuestionNavigator} onClose={() => setShowQuestionNavigator(false)} title="" size="md">
            <div className="space-y-6">
              <div className="text-center border-b border-slate-200 pb-4">
                <h3 className="text-lg md:text-xl font-bold text-slate-900">{activeSection.name}</h3>
                <p className="text-sm text-slate-500 mt-1">Questions</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-6 px-4 py-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-300" />
                  <span className="text-xs font-semibold text-slate-600">Unanswered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-600">Correct</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-red-500" />
                  <span className="text-xs font-semibold text-slate-600">Wrong</span>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-3 max-h-72 overflow-y-auto p-1">
                  {filteredQuestions.map((fq, idx) => {
                    const ans = answersMap.get(fq.questionId);
                    const isCorrect = ans?.answerGiven ? taAnswersMatch(ans.answerGiven, fq.question.correctAnswer) : false;
                    const isOmitted = !ans?.answerGiven;
                    const isCurrent = idx === safeIdx;
                    let bgColor = isOmitted ? 'bg-slate-200 border-slate-300' : isCorrect ? 'bg-emerald-100 border-emerald-500' : 'bg-red-100 border-red-500';
                    let textColor = isOmitted ? 'text-slate-600' : isCorrect ? 'text-emerald-700' : 'text-red-700';
                    if (isCurrent) { bgColor = 'bg-blue-600 border-blue-700'; textColor = 'text-white font-bold ring-2 ring-blue-300'; }
                    return (
                      <button
                        key={idx}
                        onClick={() => { setCurrentQuestionIdx(idx); setShowQuestionNavigator(false); }}
                        className={`w-11 h-11 rounded-xl font-bold text-sm transition-all flex items-center justify-center border-2 ${bgColor} ${textColor} hover:shadow-md hover:scale-105 cursor-pointer`}
                        title={`Q${idx + 1} — ${isOmitted ? 'Omitted' : isCorrect ? 'Correct' : 'Incorrect'}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4 text-center">
                <button
                  onClick={() => setShowQuestionNavigator(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all cursor-pointer"
                >
                  Question {safeIdx + 1} of {filteredQuestions.length}
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ── Fullscreen Question Wise Report review mode ── */}
      {fullscreenQuestionReportOpen && expandedAttempt && (() => {
        const analysis = computeTestAnalysis(expandedAttempt);
        const activeSection = analysis.sections[activeQuestionSectionIdx];
        if (!activeSection) return null;

        const sectionAttempt = expandedAttempt.sectionAttempts.find(
          (sa) => sa.section.name === activeSection.name
        );
        if (!sectionAttempt) return null;

        const allQuestions = sectionAttempt.section.questions.flatMap((tq) => {
          const q = tq.question;
          const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
          if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
            return q.childQuestions.map((cq) => ({ ...tq, id: cq.id, questionId: cq.id, question: cq, parentPassageText: q.content?.text }));
          }
          // Skip child rows: already emitted via their passage parent above.
          return (q as any).parentQuestionId ? [] : [tq];
        });
        const answersMap = new Map(expandedAttempt.answers.map((a) => [a.questionId, a]));

        const filteredQuestions = allQuestions.filter((tq) => {
          const ans = answersMap.get(tq.questionId);
          const isCorrect = ans?.answerGiven ? taAnswersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
          const isOmitted = !ans?.answerGiven;
          if (questionFilterBy === 'correct') return isCorrect;
          if (questionFilterBy === 'incorrect') return ans?.answerGiven && !isCorrect;
          if (questionFilterBy === 'omitted') return isOmitted;
          return true;
        });

        const safeIdx = Math.min(currentQuestionIdx, Math.max(filteredQuestions.length - 1, 0));
        const currentTq = filteredQuestions[safeIdx];
        const hasPrev = safeIdx > 0;
        const hasNext = safeIdx < filteredQuestions.length - 1;

        const studentAnswer = currentTq ? answersMap.get(currentTq.questionId) : null;
        const correct = studentAnswer?.answerGiven ? taAnswersMatch(studentAnswer.answerGiven, currentTq.question.correctAnswer) : false;
        const skipped = !studentAnswer?.answerGiven;
        const options = currentTq ? taOptionsToDisplay(currentTq.question.options) : [];
        const userAnswerDisplay = studentAnswer ? taAnswerToDisplay(studentAnswer.answerGiven) : null;
        const correctAnswerDisplay = currentTq ? taAnswerToDisplay(currentTq.question.correctAnswer) : null;

        return (
          <div className="fixed inset-0 bg-white z-[150] overflow-hidden flex flex-col font-sans select-none">
            <header className="flex-shrink-0 bg-[#fcfcfd] border-b border-slate-200 px-5 h-16 flex items-center justify-between z-20">
              <div className="flex items-center gap-4 min-w-0">
                <span className="font-bold text-slate-800 text-sm hidden sm:inline">Reviewing:</span>
                <div className="flex flex-wrap gap-1 min-w-0">
                  {analysis.sections.map((sa, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setActiveQuestionSectionIdx(idx); setQuestionFilterBy('all'); setCurrentQuestionIdx(0); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${activeQuestionSectionIdx === idx ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                    >
                      {sa.category}
                    </button>
                  ))}
                </div>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold text-slate-700 select-none">
                Review Mode - Admin Portal
              </div>
              <div className="flex items-center gap-4 z-30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">Filter</span>
                  <select
                    value={questionFilterBy}
                    onChange={(e) => { setQuestionFilterBy(e.target.value); setCurrentQuestionIdx(0); }}
                    className="px-2.5 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Questions</option>
                    <option value="correct">Correct Only</option>
                    <option value="incorrect">Incorrect Only</option>
                    <option value="omitted">Omitted Only</option>
                  </select>
                </div>
                <button
                  onClick={() => setFullscreenQuestionReportOpen(false)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-all cursor-pointer"
                  title="Close Fullscreen"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className="flex-shrink-0 bg-[#1e2150] text-white text-center text-[12px] font-semibold tracking-wide py-1.5 z-10 select-none">
              THIS IS A PRACTICE TEST REVIEW
            </div>

            <div className="flex-1 overflow-hidden bg-white min-h-0">
              {filteredQuestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8">
                  <p className="text-slate-500 font-semibold text-sm">No questions match the filter in this section</p>
                </div>
              ) : !currentTq ? (
                <div className="flex flex-col items-center justify-center h-full p-8">
                  <p className="text-slate-500 font-semibold text-sm">Loading question...</p>
                </div>
              ) : (currentTq as any).parentPassageText ? (
                <div className="flex h-full min-h-full divide-x divide-slate-200">
                  <div className="w-1/2 overflow-y-auto p-8 bg-white h-full">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Reading Passage</p>
                    <div className="prose prose-slate max-w-none text-slate-800 text-[15px] leading-relaxed">
                      <RichContentRenderer content={(currentTq as any).parentPassageText || ''} variant="passage" />
                    </div>
                  </div>
                  <div className="w-1/2 overflow-y-auto p-8 bg-white h-full flex flex-col gap-6 select-text">
                    <div className="flex items-center justify-between border-b-2 border-dashed border-slate-200 pb-2.5">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 text-white text-sm font-bold flex items-center justify-center rounded ${correct ? 'bg-emerald-600' : skipped ? 'bg-slate-400' : 'bg-red-600'}`}>
                          {allQuestions.findIndex(q => q.questionId === currentTq.questionId) + 1}
                        </span>
                        <span className={`text-sm font-bold ${correct ? 'text-emerald-700' : skipped ? 'text-slate-600' : 'text-red-700'}`}>
                          {correct ? 'Correct' : skipped ? 'Omitted' : 'Incorrect'}
                        </span>
                      </div>
                      {studentAnswer?.timeSpentSeconds ? (
                        <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={12} />Time Spent: {studentAnswer.timeSpentSeconds}s</span>
                      ) : null}
                    </div>
                    <div className="text-[15px] text-slate-900 leading-relaxed font-normal">
                      <RichContentRenderer content={currentTq.question.content.text || ''} variant="question" />
                    </div>
                    {options.length > 0 ? (
                      <div className="space-y-2.5">
                        {options.map((opt) => {
                          const isUserAnswer = Array.isArray(userAnswerDisplay) ? userAnswerDisplay.includes(opt.id) : userAnswerDisplay === opt.id;
                          const isCorrectOption = Array.isArray(correctAnswerDisplay) ? correctAnswerDisplay.includes(opt.id) : correctAnswerDisplay === opt.id;
                          return (
                            <OptionRenderer key={opt.id} label={opt.id.toUpperCase()} text={opt.text} isSelected={isUserAnswer && !isCorrectOption} isCorrect={isCorrectOption} isIncorrect={isUserAnswer && !isCorrectOption} showFeedback={true} colorTheme="blue" />
                          );
                        })}
                      </div>
                    ) : (
                      currentTq.question.type === 'NUMERIC' && (
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex flex-col gap-2">
                          <div className="text-sm"><span className="text-slate-500 font-medium">Your answer: </span><span className={`font-bold ${correct ? 'text-emerald-600' : 'text-red-500'}`}>{studentAnswer?.answerGiven?.value ?? '—'}</span></div>
                          <div className="text-sm"><span className="text-slate-500 font-medium">Correct answer: </span><span className="font-bold text-emerald-600">{currentTq.question.correctAnswer.value}</span></div>
                        </div>
                      )
                    )}
                    {currentTq.question.content.explanation && (
                      <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100/80">
                        <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">Explanation</h5>
                        <div className="text-sm text-slate-700 leading-relaxed">
                          <RichContentRenderer content={currentTq.question.content.explanation} variant="question" className="prose-sm" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="overflow-y-auto h-full p-8 bg-white select-text">
                  <div className="max-w-3xl mx-auto flex flex-col gap-6">
                    <div className="flex items-center justify-between border-b-2 border-dashed border-slate-200 pb-2.5">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 text-white text-sm font-bold flex items-center justify-center rounded ${correct ? 'bg-emerald-600' : skipped ? 'bg-slate-400' : 'bg-red-600'}`}>
                          {allQuestions.findIndex(q => q.questionId === currentTq.questionId) + 1}
                        </span>
                        <span className={`text-sm font-bold ${correct ? 'text-emerald-700' : skipped ? 'text-slate-600' : 'text-red-700'}`}>
                          {correct ? 'Correct' : skipped ? 'Omitted' : 'Incorrect'}
                        </span>
                      </div>
                      {studentAnswer?.timeSpentSeconds ? (
                        <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={12} />Time Spent: {studentAnswer.timeSpentSeconds}s</span>
                      ) : null}
                    </div>
                    <div className="text-[16px] text-slate-900 leading-relaxed font-normal">
                      <RichContentRenderer content={currentTq.question.content.text || ''} variant="question" />
                    </div>
                    {options.length > 0 ? (
                      <div className="space-y-2.5">
                        {options.map((opt) => {
                          const isUserAnswer = Array.isArray(userAnswerDisplay) ? userAnswerDisplay.includes(opt.id) : userAnswerDisplay === opt.id;
                          const isCorrectOption = Array.isArray(correctAnswerDisplay) ? correctAnswerDisplay.includes(opt.id) : correctAnswerDisplay === opt.id;
                          return (
                            <OptionRenderer key={opt.id} label={opt.id.toUpperCase()} text={opt.text} isSelected={isUserAnswer && !isCorrectOption} isCorrect={isCorrectOption} isIncorrect={isUserAnswer && !isCorrectOption} showFeedback={true} colorTheme="blue" />
                          );
                        })}
                      </div>
                    ) : (
                      currentTq.question.type === 'NUMERIC' && (
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex flex-col gap-2">
                          <div className="text-sm"><span className="text-slate-500 font-medium">Your answer: </span><span className={`font-bold ${correct ? 'text-emerald-600' : 'text-red-500'}`}>{studentAnswer?.answerGiven?.value ?? '—'}</span></div>
                          <div className="text-sm"><span className="text-slate-500 font-medium">Correct answer: </span><span className="font-bold text-emerald-600">{currentTq.question.correctAnswer.value}</span></div>
                        </div>
                      )
                    )}
                    {currentTq.question.content.explanation && (
                      <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100/80">
                        <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">Explanation</h5>
                        <div className="text-sm text-slate-700 leading-relaxed">
                          <RichContentRenderer content={currentTq.question.content.explanation} variant="question" className="prose-sm" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <footer className="flex-shrink-0 bg-[#fcfcfd] border-t border-slate-200 px-5 h-16 flex items-center justify-between z-20">
              <p className="text-sm font-bold text-slate-800 truncate max-w-[28%] select-text">
                Reviewing: {student.name}
              </p>
              {filteredQuestions.length > 0 && (
                <button
                  onClick={() => setShowFullscreenPalette(true)}
                  className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-md cursor-pointer"
                >
                  Question {safeIdx + 1} of {filteredQuestions.length}
                  <ChevronUp size={14} />
                </button>
              )}
              <div className="flex items-center gap-2">
                <button
                  disabled={!hasPrev}
                  onClick={() => setCurrentQuestionIdx(safeIdx - 1)}
                  className={`px-5 py-2 text-xs font-bold rounded-full transition-colors cursor-pointer ${hasPrev ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-300 cursor-not-allowed'}`}
                >
                  Back
                </button>
                <button
                  disabled={!hasNext}
                  onClick={() => setCurrentQuestionIdx(safeIdx + 1)}
                  className={`px-7 py-2 text-xs font-bold text-white rounded-full transition-colors cursor-pointer ${hasNext ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed'}`}
                >
                  Next
                </button>
              </div>
            </footer>

            {showFullscreenPalette && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center">
                <div className="absolute inset-0 bg-black/40" onClick={() => setShowFullscreenPalette(false)} />
                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden z-10 border border-slate-200">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 text-center flex-1">{activeSection.name}</h3>
                    <button onClick={() => setShowFullscreenPalette(false)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-slate-500 cursor-pointer">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-center gap-4 flex-wrap bg-slate-50 select-none">
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold"><div className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-500" />Correct</div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold"><div className="w-3.5 h-3.5 rounded bg-red-100 border border-red-500" />Incorrect</div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold"><div className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300" />Omitted</div>
                  </div>
                  <div className="p-6 max-h-72 overflow-y-auto flex justify-center">
                    <div className="grid grid-cols-6 gap-3">
                      {filteredQuestions.map((fq, idx) => {
                        const ans = answersMap.get(fq.questionId);
                        const isCorrect = ans?.answerGiven ? taAnswersMatch(ans.answerGiven, fq.question.correctAnswer) : false;
                        const isOmitted = !ans?.answerGiven;
                        const isCurrent = idx === safeIdx;
                        let bgColor = isOmitted ? 'bg-slate-200 border-slate-300' : isCorrect ? 'bg-emerald-100 border-emerald-500' : 'bg-red-100 border-red-500';
                        let textColor = isOmitted ? 'text-slate-600' : isCorrect ? 'text-emerald-700' : 'text-red-700';
                        if (isCurrent) { bgColor = 'bg-blue-600 border-blue-700'; textColor = 'text-white font-bold ring-2 ring-blue-300'; }
                        return (
                          <button
                            key={idx}
                            onClick={() => { setCurrentQuestionIdx(idx); setShowFullscreenPalette(false); }}
                            className={`w-11 h-11 rounded-xl font-bold text-sm transition-all flex items-center justify-center border-2 ${bgColor} ${textColor} hover:shadow-md hover:scale-105 cursor-pointer`}
                            title={`Q${idx + 1} — ${isOmitted ? 'Omitted' : isCorrect ? 'Correct' : 'Incorrect'}`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
