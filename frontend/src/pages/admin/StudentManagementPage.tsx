import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, UserPlus, CheckCircle, AlertCircle, FileText, Download, Pencil, Trash2, Copy, KeyRound, Phone, School, User2, BarChart2, LayoutList, X, TrendingUp, Filter, Loader2, ClipboardList } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { api, type DbUser } from '../../lib/api';
import { parseCSV, exportToCsv } from '../../utils/exportCsv';
import toast from 'react-hot-toast';

type AnalyticsTab = 'mistake' | 'parallel' | 'skill';
type MainViewTab = 'analysis' | 'test_analysis';

// ── Test Analysis types ──────────────────────────────────────────────────────

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
  test: { id: string; title: string };
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
    const flatQs: TaTestQuestion[] = [];
    sa.section.questions.forEach(tq => {
      const q = tq.question;
      const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
      if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
        q.childQuestions.forEach(cq => {
          flatQs.push({ id: cq.id, questionId: cq.id, orderIndex: tq.orderIndex, question: cq });
        });
      } else {
        flatQs.push(tq);
      }
    });

    let correct = 0, incorrect = 0, omitted = 0, unvisited = 0;
    flatQs.forEach(tq => {
      const ans = answersMap.get(tq.questionId);
      if (!ans) { unvisited++; omitted++; return; }
      if (!ans.answerGiven) { omitted++; return; }
      if (taAnswersMatch(ans.answerGiven, tq.question.correctAnswer)) correct++;
      else incorrect++;
    });

    const total = flatQs.length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    let timeTaken = '—';
    if (sa.startedAt && sa.completedAt) {
      const mins = Math.round((new Date(sa.completedAt).getTime() - new Date(sa.startedAt).getTime()) / 60000);
      const secs = Math.round(((new Date(sa.completedAt).getTime() - new Date(sa.startedAt).getTime()) % 60000) / 1000);
      timeTaken = `${mins}:${secs.toString().padStart(2, '0')} Minutes Taken`;
    }

    const isMath = /math/i.test(sa.section.name);
    const isRW = /reading|writing|rw/i.test(sa.section.name);
    const category = isMath ? 'Math' : isRW ? 'Reading and Writing' : sa.section.name;

    if (isMath) { mathCorrect += correct; mathTotal += total; }
    else if (isRW) { rwCorrect += correct; rwTotal += total; }

    totalCorrect += correct;
    totalQuestions += total;

    return { name: sa.section.name, category, correct, incorrect, omitted, total, unvisited, accuracy, timeTaken };
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

type AnalyticsData = {
  trend: Array<{ date: string; score: number; testTitle: string; attemptId: string }>;
  sectionStats: Array<{ sectionId: string; sectionName: string; totalQuestions: number; correct: number; incorrect: number; skipped: number; accuracy: number; timeAllocated: number; timeUsed: number }>;
  questionPacingStats: Array<{ questionIndex: number; sectionName: string; timeSpentSeconds: number; status: 'correct' | 'incorrect' | 'skipped'; difficulty: string; topicName: string }>;
  overallAccuracy: number;
  totalAttempts: number;
  latestScore: number;
  avgScore: number;
};

// stage badge helper removed as the student table was consolidated

export function StudentManagementPage() {
  const navigate = useNavigate();

  // ── Main view state ───────────────────────────────────────────────────────
  const [mainView, setMainView] = useState<MainViewTab>('analysis');

  // ── Existing state ────────────────────────────────────────────────────────
  const [students, setStudents] = useState<DbUser[]>([]);
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [csvError, setCsvError] = useState('');
  const [csvSuccess, setCsvSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', tutorId: '', phone: '', parentPhone: '', dob: '', schoolName: '' });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // ── New state ─────────────────────────────────────────────────────────────
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('mistake');
  const [analyticsStudentId, setAnalyticsStudentId] = useState('');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsView, setAnalyticsView] = useState<'table' | 'chart'>('table');
  const [analyticsSubject, setAnalyticsSubject] = useState('');
  const [analyticsAttempts, setAnalyticsAttempts] = useState<Array<{ id: string; status: string; totalScore: number | null; completedAt: string | null; startedAt: string; test: { title: string } }>>([]);
  const [analyticsAttemptId, setAnalyticsAttemptId] = useState('');

  // ── Comprehensive Analysis state ──────────────────────────────────────────
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [studentAnalysisData, setStudentAnalysisData] = useState<Array<{
    studentId: string;
    studentName: string;
    studentEmail: string;
    targetDate: string | null;
    diagnosticsEnglish: number | null;
    diagnosticsMath: number | null;
    mockTests: number;
    sectionalTests: number;
    hwCount: number;
    cwCount: number;
    practiceSheets: number;
    totalAssessments: number;
    lastTestName: string | null;
    lastSubmittedAt: string | null;
    scaledScoreTotal: number | null;
    scaledScoreEnglish: number | null;
    scaledScoreMath: number | null;
    rawScoreTotal: number | null;
    rawScoreEnglish: number | null;
    rawScoreMath: number | null;
    attempts: Array<{ id: string; testTitle: string; status: string; totalScore: number | null; startedAt: string; completedAt: string | null }>;
  }>>([]);
  const [analysisSearchTerm, setAnalysisSearchTerm] = useState('');
  const [analysisSortBy, setAnalysisSortBy] = useState<'name' | 'diagnostics' | 'attempts'>('name');

  // ── Detailed Test Analysis state ─────────────────────────────────────────
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentAttempts, setStudentAttempts] = useState<Array<{ id: string; status: string; totalScore: number | null; completedAt: string | null; startedAt: string; test: { title: string } }>>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState('');
  const [testAnalysisLoading, setTestAnalysisLoading] = useState(false);
  const [testAnalysisAttempt, setTestAnalysisAttempt] = useState<TaAttempt | null>(null);
  const [testAnalysisStatus, setTestAnalysisStatus] = useState<Record<string, 'submitted' | 'not_submitted'>>({});

  useEffect(() => {
    if (mainView !== 'test_analysis' || !selectedStudentId) {
      setStudentAttempts([]);
      setSelectedAttemptId('');
      setTestAnalysisAttempt(null);
      return;
    }
    api.getStudentAttempts(selectedStudentId)
      .then((r) => {
        const submitted = ((r.attempts as any[]) ?? []).filter((a) => a.status === 'SUBMITTED');
        setStudentAttempts(submitted);
        if (submitted.length > 0) {
          setSelectedAttemptId(submitted[0].id);
        } else {
          setSelectedAttemptId('');
          setTestAnalysisAttempt(null);
        }
      })
      .catch(() => {
        setStudentAttempts([]);
        setSelectedAttemptId('');
        setTestAnalysisAttempt(null);
      });
  }, [mainView, selectedStudentId]);

  useEffect(() => {
    if (mainView !== 'test_analysis' || !selectedAttemptId) {
      setTestAnalysisAttempt(null);
      return;
    }
    setTestAnalysisLoading(true);
    api.getAttempt(selectedAttemptId)
      .then((r) => {
        setTestAnalysisAttempt(r.attempt as TaAttempt);
      })
      .catch(() => {
        setTestAnalysisAttempt(null);
      })
      .finally(() => {
        setTestAnalysisLoading(false);
      });
  }, [mainView, selectedAttemptId]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const reload = () => {
    Promise.all([
      api.getUsersByRole('STUDENT').then((r) => setStudents(r.users ?? [])),
      api.getUsersByRole('TUTOR').then((r) => setTutors(r.users ?? [])),
    ]);
  };
  useEffect(() => { reload(); }, []);

  // Load the selected student's list of completed tests
  useEffect(() => {
    if (!analyticsStudentId) { setAnalyticsAttempts([]); setAnalyticsAttemptId(''); return; }
    api.getStudentAttempts(analyticsStudentId)
      .then((r) => {
        const submitted = ((r.attempts as any[]) ?? []).filter((a) => a.status === 'SUBMITTED');
        setAnalyticsAttempts(submitted);
        setAnalyticsAttemptId(submitted[0]?.id ?? '');
      })
      .catch(() => { setAnalyticsAttempts([]); setAnalyticsAttemptId(''); });
  }, [analyticsStudentId]);

  // Load analytics for the selected student + test
  useEffect(() => {
    if (!analyticsStudentId) { setAnalyticsData(null); return; }
    setAnalyticsLoading(true);
    api.getStudentAnalytics(analyticsStudentId, analyticsAttemptId || undefined)
      .then((r) => setAnalyticsData(r as AnalyticsData))
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, [analyticsStudentId, analyticsAttemptId]);

  // Load comprehensive analysis data
  const loadComprehensiveAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const allStudentData: typeof studentAnalysisData = [];
      
      for (const student of students) {
        try {
          const attempts = (await api.getStudentAttempts(student.id)) as any;
          const studentAttempts = attempts?.attempts?.filter((a: any) => a.status === 'SUBMITTED') || [];
          
          let diagnosticsEnglish = null;
          let diagnosticsMath = null;
          let lastTestName = null;
          let lastSubmittedAt = null;
          let scaledScoreTotal = null;
          let scaledScoreEnglish = null;
          let scaledScoreMath = null;
          let rawScoreTotal = null;
          let rawScoreEnglish = null;
          let rawScoreMath = null;
          
          // Find diagnostics test and latest test
          if (studentAttempts.length > 0) {
            const sortedAttempts = [...studentAttempts].sort((a: any, b: any) => 
              new Date(b.completedAt || b.startedAt).getTime() - new Date(a.completedAt || a.startedAt).getTime()
            );
            
            const latestAttempt = sortedAttempts[0];
            lastTestName = latestAttempt?.test?.title || null;
            lastSubmittedAt = latestAttempt?.completedAt || latestAttempt?.startedAt || null;
            scaledScoreTotal = latestAttempt?.totalScore || null;
            rawScoreTotal = latestAttempt?.totalScore || null;
            
            // Look for diagnostics test
            const diagnosticsAttempt = studentAttempts.find((a: any) => 
              a.test?.title?.toLowerCase().includes('diagnostic')
            );
            if (diagnosticsAttempt) {
              try {
                const analysis = computeTestAnalysis(diagnosticsAttempt);
                diagnosticsEnglish = analysis.rwScaled;
                diagnosticsMath = analysis.mathScaled;
                scaledScoreTotal = analysis.finalScaledScore;
                scaledScoreEnglish = analysis.rwScaled;
                scaledScoreMath = analysis.mathScaled;
              } catch (e) {
                console.error("Error computing analysis for diagnosticsAttempt:", e);
                diagnosticsEnglish = diagnosticsAttempt.totalScore;
                diagnosticsMath = diagnosticsAttempt.totalScore;
                scaledScoreTotal = diagnosticsAttempt.totalScore;
                scaledScoreEnglish = diagnosticsAttempt.totalScore;
                scaledScoreMath = diagnosticsAttempt.totalScore;
              }
            }
          }
          
          // Count assessment types
          const mockCount = studentAttempts.filter((a: any) => a.test?.title?.toLowerCase().includes('mock')).length;
          const sectionalCount = studentAttempts.filter((a: any) => a.test?.title?.toLowerCase().includes('sectional')).length;
          const hwCount = studentAttempts.filter((a: any) => a.test?.title?.toLowerCase().includes('homework') || a.test?.title?.toLowerCase().includes('hw')).length;
          const cwCount = studentAttempts.filter((a: any) => a.test?.title?.toLowerCase().includes('classwork') || a.test?.title?.toLowerCase().includes('cw')).length;
          const practiceCount = studentAttempts.filter((a: any) => a.test?.title?.toLowerCase().includes('practice')).length;
          const totalAssessments = mockCount + sectionalCount + hwCount + cwCount + practiceCount;
          
          allStudentData.push({
            studentId: student.id,
            studentName: student.name,
            studentEmail: student.email,
            targetDate: student.targetScore ? new Date().toISOString().split('T')[0] : null,
            diagnosticsEnglish,
            diagnosticsMath,
            mockTests: mockCount,
            sectionalTests: sectionalCount,
            hwCount,
            cwCount,
            practiceSheets: practiceCount,
            totalAssessments,
            lastTestName,
            lastSubmittedAt,
            scaledScoreTotal,
            scaledScoreEnglish,
            scaledScoreMath,
            rawScoreTotal,
            rawScoreEnglish,
            rawScoreMath,
            attempts: studentAttempts.slice(0, 10),
          });
        } catch (err) {
          console.error(`Error loading analysis for student ${student.id}:`, err);
        }
      }
      
      setStudentAnalysisData(allStudentData);
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Load comprehensive analysis when switching to analysis view
  useEffect(() => {
    if (mainView === 'analysis' && studentAnalysisData.length === 0) {
      loadComprehensiveAnalysis();
    }
  }, [mainView]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFileDrop = (file: File) => {
    setCsvError(''); setCsvSuccess(false);
    if (!file.name.match(/\.(csv|txt)$/i)) { setCsvError('Please upload a .csv file'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (!rows.length) { setCsvError('File is empty or invalid'); return; }
      const headers = Object.keys(rows[0]).map((h) => h.toLowerCase());
      const missing = ['name', 'email'].filter((c) => !headers.includes(c));
      if (missing.length) { setCsvError(`Missing columns: ${missing.join(', ')}`); return; }
      setCsvPreview(rows.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleCsvUpload = async () => {
    if (!csvPreview.length) return;
    setAddLoading(true);
    let created = 0;
    for (const row of csvPreview) {
      try {
        await api.createUser({
          name: row.name ?? row.Name ?? '',
          email: row.email ?? row.Email ?? '',
          role: 'STUDENT',
          grade: row.grade ?? row.Grade ?? undefined,
          targetScore: (row.targetScore ?? row['Target Score']) ? Number(row.targetScore ?? row['Target Score']) : undefined,
          tutorId: row.tutorId ?? undefined,
          phone: row.phone ?? row.Phone ?? undefined,
          parentPhone: row.parentPhone ?? row['Parent Phone'] ?? undefined,
          dob: row.dob ?? row.DOB ?? row['Date of Birth'] ?? undefined,
          schoolName: row.schoolName ?? row['School Name'] ?? row.school ?? undefined,
        });
        created++;
      } catch { /* skip invalid rows */ }
    }
    setAddLoading(false);
    if (created > 0) {
      setCsvSuccess(true);
      setTimeout(() => { setCsvSuccess(false); setShowBulkModal(false); setCsvPreview([]); reload(); }, 1500);
    }
  };

  const downloadTemplate = () => {
    exportToCsv([
      { name: 'John Doe', email: 'john@school.edu', grade: '11', targetScore: '32', tutorId: '', phone: '555-0100', parentPhone: '555-0101', dob: '2008-03-15', schoolName: 'Lincoln High School' },
      { name: 'Jane Smith', email: 'jane@school.edu', grade: '10', targetScore: '30', tutorId: '', phone: '555-0200', parentPhone: '555-0201', dob: '2009-07-22', schoolName: 'Washington Academy' },
    ], 'student_upload_template.csv');
  };

  const handleAddStudent = async () => {
    if (!addForm.email) return;
    setAddError(''); setAddLoading(true);
    const fullName = `${addForm.firstName} ${addForm.lastName}`.trim() || addForm.email.split('@')[0];
    try {
      if (isEditing && editingStudentId) {
        await api.updateUser(editingStudentId, {
          name: fullName,
          grade: addForm.grade || undefined,
          targetScore: addForm.targetScore ? Number(addForm.targetScore) : undefined,
          tutorId: addForm.tutorId || undefined,
          phone: addForm.phone || undefined,
          parentPhone: addForm.parentPhone || undefined,
          dob: addForm.dob || undefined,
          schoolName: addForm.schoolName || undefined,
        });
        setShowAddModal(false); setIsEditing(false); setEditingStudentId(null);
        setAddForm({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', tutorId: '', phone: '', parentPhone: '', dob: '', schoolName: '' });
        reload();
      } else {
        const res = await api.createUser({
          name: fullName, email: addForm.email, role: 'STUDENT',
          grade: addForm.grade || undefined,
          targetScore: addForm.targetScore ? Number(addForm.targetScore) : undefined,
          tutorId: addForm.tutorId || undefined,
          phone: addForm.phone || undefined,
          parentPhone: addForm.parentPhone || undefined,
          dob: addForm.dob || undefined,
          schoolName: addForm.schoolName || undefined,
        });
        setShowAddModal(false);
        setAddForm({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', tutorId: '', phone: '', parentPhone: '', dob: '', schoolName: '' });
        reload();
        if (res.tempPassword) setCreatedPassword({ name: fullName, email: addForm.email, password: res.tempPassword });
      }
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAddLoading(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  // display variables cleaned up as student list was consolidated

  // ── Analytics computed data ───────────────────────────────────────────────
  const qStats = analyticsData?.questionPacingStats ?? [];
  const filteredQStats = analyticsSubject
    ? qStats.filter(q => q.sectionName.toLowerCase().includes(analyticsSubject.toLowerCase()))
    : qStats;

  const topicMap: Record<string, { total: number; correct: number }> = {};
  filteredQStats.forEach(q => {
    const key = q.topicName || 'Unknown';
    if (!topicMap[key]) topicMap[key] = { total: 0, correct: 0 };
    topicMap[key].total++;
    if (q.status === 'correct') topicMap[key].correct++;
  });
  const rawTopicStats = Object.entries(topicMap).map(([topic, { total, correct }]) => ({
    topic, total, correct, accuracy: total > 0 ? (correct / total) * 100 : 0,
  }));

  const topicStats = analyticsTab === 'mistake'
    ? rawTopicStats.filter(t => t.accuracy < 70).sort((a, b) => a.accuracy - b.accuracy)
    : analyticsTab === 'parallel'
    ? (analyticsData?.sectionStats ?? []).map(s => ({ topic: s.sectionName, total: s.totalQuestions, correct: s.correct, accuracy: s.accuracy }))
    : rawTopicStats.sort((a, b) => a.topic.localeCompare(b.topic));

  const totalQ = filteredQStats.length;
  const correctQ = filteredQStats.filter(q => q.status === 'correct').length;
  const accuracyPct = totalQ > 0 ? (correctQ / totalQ) * 100 : 0;

  const analyticsSubjects = [...new Set(qStats.map(q => q.sectionName).filter(Boolean))];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── View Switcher ── */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        <button
          onClick={() => setMainView('analysis')}
          className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px flex items-center gap-1.5 ${mainView === 'analysis' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <TrendingUp size={14} /> Comprehensive Analysis
        </button>
        <button
          onClick={() => setMainView('test_analysis')}
          className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px flex items-center gap-1.5 ${mainView === 'test_analysis' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <ClipboardList size={14} /> Detailed Test Analysis
        </button>
      </div>

      {mainView === 'analysis' && (
        <>
      {/* ── Student Management Header (moved from Management tab) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-sm text-slate-500 mt-0.5">Total Students: <span className="font-semibold text-slate-700">{students.length}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" icon={<Upload size={13} />} onClick={() => setShowBulkModal(true)}>Bulk Upload</Button>
          <Button size="sm" icon={<Plus size={13} />} onClick={() => { setIsEditing(false); setEditingStudentId(null); setAddForm({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', tutorId: '', phone: '', parentPhone: '', dob: '', schoolName: '' }); setShowAddModal(true); }}>Add Student</Button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Students', value: students.length, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'With Tutors', value: students.filter(s => s.tutorId).length, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Avg Score', value: students.filter(s => s.avgScore != null).length ? (students.reduce((a, s) => a + (s.avgScore ?? 0), 0) / students.filter(s => s.avgScore != null).length).toFixed(1) : '—', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Tests Done', value: students.reduce((a, s) => a + (s.testsAttempted || 0), 0), color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3 flex items-center gap-3`}>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-600 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── COMPREHENSIVE ANALYSIS VIEW ── */}
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-slate-900">Student Analysis Dashboard</h2>
            <p className="text-sm text-slate-500 mt-0.5">Detailed performance metrics for all students</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => loadComprehensiveAnalysis()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Filter size={14} /> Refresh Data
            </button>
          </div>
        </div>

        {/* Search Filter */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by name or email…"
            value={analysisSearchTerm}
            onChange={(e) => setAnalysisSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={analysisSortBy}
            onChange={(e) => setAnalysisSortBy(e.target.value as any)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Sort by Name</option>
            <option value="diagnostics">Sort by Diagnostics</option>
            <option value="attempts">Sort by Attempts</option>
          </select>
        </div>

        {/* Analysis Table */}
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                  <th className="px-4 py-3 text-left font-semibold text-blue-900 whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-center font-semibold text-blue-900 whitespace-nowrap">Target Date</th>
                  <th className="px-4 py-3 text-center font-semibold text-blue-900 whitespace-nowrap border-l border-blue-200">Diagnostic Score</th>
                  <th className="px-4 py-3 text-center font-semibold text-blue-900 whitespace-nowrap">English</th>
                  <th className="px-4 py-3 text-center font-semibold text-blue-900 whitespace-nowrap">Math</th>
                  <th className="px-4 py-3 text-center font-semibold text-blue-900 whitespace-nowrap border-l border-blue-200">Total Assessment</th>
                  <th className="px-4 py-3 text-center font-semibold text-blue-900 whitespace-nowrap">Test Report</th>
                  <th className="px-4 py-3 text-center font-semibold text-blue-900 whitespace-nowrap">Performance</th>
                  <th className="px-4 py-3 text-center font-semibold text-blue-900 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {analysisLoading ? (
                  <tr><td colSpan={9} className="py-8 text-center text-slate-400">Loading...</td></tr>
                ) : studentAnalysisData.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-slate-400">No students found</td></tr>
                ) : studentAnalysisData
                    .filter((s) =>
                      analysisSearchTerm
                        ? s.studentName.toLowerCase().includes(analysisSearchTerm.toLowerCase()) ||
                          s.studentEmail.toLowerCase().includes(analysisSearchTerm.toLowerCase())
                        : true
                    )
                    .sort((a, b) => {
                      if (analysisSortBy === 'name') return a.studentName.localeCompare(b.studentName);
                      if (analysisSortBy === 'diagnostics') return (b.diagnosticsEnglish || 0) - (a.diagnosticsEnglish || 0);
                      if (analysisSortBy === 'attempts') return b.attempts.length - a.attempts.length;
                      return 0;
                    })
                    .map((row, idx) => (
                      <tr key={row.studentId} className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {row.studentName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 text-sm">{row.studentName}</p>
                              <p className="text-xs text-slate-400 truncate">{row.studentEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600 whitespace-nowrap">
                          {row.targetDate ? new Date(row.targetDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-blue-900 border-l border-blue-100">
                          {row.scaledScoreTotal ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-semibold text-blue-700">
                          {row.diagnosticsEnglish ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-semibold text-blue-700">
                          {row.diagnosticsMath ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-bold text-emerald-700 border-l border-blue-100">
                          {row.totalAssessments ?? 0}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              setSelectedStudentId(row.studentId);
                              if (row.attempts && row.attempts.length > 0) {
                                setSelectedAttemptId(row.attempts[0].id);
                              } else {
                                setSelectedAttemptId('');
                              }
                              setMainView('test_analysis');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            View
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => navigate(`/students/${row.studentId}`)} className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
                            View
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => navigate(`/students/${row.studentId}`)}
                              className="px-2.5 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => {
                                const student = students.find(s => s.id === row.studentId);
                                if (!student) return;
                                const parts = student.name.split(' ');
                                setAddForm({
                                  firstName: parts[0] || '',
                                  lastName: parts.slice(1).join(' ') || '',
                                  email: student.email,
                                  grade: student.grade || '',
                                  targetScore: student.targetScore ? String(student.targetScore) : '',
                                  tutorId: student.tutorId || '',
                                  phone: student.phone || '',
                                  parentPhone: student.parentPhone || '',
                                  dob: student.dob || '',
                                  schoolName: student.schoolName || ''
                                });
                                setIsEditing(true);
                                setEditingStudentId(student.id);
                                setShowAddModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={async () => {
                                const student = students.find(s => s.id === row.studentId);
                                if (!student) return;
                                if (confirm(`Delete ${student.name}?`)) {
                                  await api.deleteUser(student.id).catch(() => {});
                                  reload();
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

        </>
      )}

      {mainView === 'test_analysis' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">Detailed Test Analysis</h1>
              <p className="text-sm text-slate-500 mt-0.5">Select a student and a test to view performance breakdown</p>
            </div>
          </div>

          {/* Selector Card */}
          <Card padding="md">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Select Student</label>
                <SearchableSelect
                  options={students.map(s => ({ id: s.id, label: s.name, searchText: s.name }))}
                  value={selectedStudentId}
                  onChange={e => {
                    setSelectedStudentId(e);
                    setSelectedAttemptId('');
                    setTestAnalysisAttempt(null);
                  }}
                  placeholder="Choose student..."
                  minWidth="min-w-[200px]"
                />
              </div>

              {selectedStudentId && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Select Attempt / Test</label>
                  {studentAttempts.length === 0 ? (
                    <span className="text-sm text-slate-400 py-2">No completed tests found</span>
                  ) : (
                    <select
                      value={selectedAttemptId}
                      onChange={e => setSelectedAttemptId(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[240px]"
                    >
                      <option value="">Choose an attempt...</option>
                      {studentAttempts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.test.title} ({a.totalScore ?? '—'} pts) - {a.completedAt ? new Date(a.completedAt).toLocaleDateString() : new Date(a.startedAt).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Score Summary beside the dropdown */}
              {selectedStudentId && selectedAttemptId && (() => {
                const selectedAttempt = studentAttempts.find(a => a.id === selectedAttemptId);
                if (!selectedAttempt) return null;
                try {
                  const analysis = computeTestAnalysis(selectedAttempt as any);
                  if (!analysis.isSAT) return null;
                  return (
                    <div className="flex items-center gap-2 ml-auto">
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Total</span>
                        <span className="text-sm font-extrabold text-blue-700">{analysis.finalScaledScore}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">R&W</span>
                        <span className="text-sm font-extrabold text-emerald-700">{analysis.rwScaled}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Math</span>
                        <span className="text-sm font-extrabold text-amber-700">{analysis.mathScaled}</span>
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}
            </div>
          </Card>

          {/* Content Pane */}
          {!selectedStudentId ? (
            <Card padding="lg">
              <div className="py-12 text-center">
                <User2 size={40} className="mx-auto text-slate-300 mb-3 animate-pulse" />
                <p className="text-slate-500 text-sm font-medium">Please select a student above</p>
                <p className="text-slate-400 text-xs mt-1">Detailed performance metrics and section scores will appear here</p>
              </div>
            </Card>
          ) : !selectedAttemptId ? (
            <Card padding="lg">
              <div className="py-12 text-center">
                <FileText size={40} className="mx-auto text-slate-300 mb-3 animate-pulse" />
                <p className="text-slate-500 text-sm font-medium">Please select a test attempt above</p>
                <p className="text-slate-400 text-xs mt-1">This student has {studentAttempts.length} completed attempts</p>
              </div>
            </Card>
          ) : testAnalysisLoading ? (
            <Card padding="lg">
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 size={24} className="animate-spin text-blue-500" />
                <span className="text-sm font-medium">Loading test analysis...</span>
              </div>
            </Card>
          ) : testAnalysisAttempt ? (() => {
            const analysis = computeTestAnalysis(testAnalysisAttempt);
            const completedDate = testAnalysisAttempt.completedAt
              ? new Date(testAnalysisAttempt.completedAt).toLocaleDateString('en-US', {
                  day: '2-digit', month: '2-digit', year: 'numeric'
                }) + ', ' + new Date(testAnalysisAttempt.completedAt).toLocaleTimeString('en-US', {
                  hour: '2-digit', minute: '2-digit'
                })
              : '—';
            const status = testAnalysisStatus[selectedAttemptId] ?? 'not_submitted';

            return (
              <div className="space-y-4">
                {/* Header Card */}
                <div className="bg-white rounded-xl border border-slate-200 py-3 px-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-semibold text-base border border-blue-100">
                        {students.find(s => s.id === selectedStudentId)?.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                        <CheckCircle size={8} className="text-white" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900">{testAnalysisAttempt.test.title}</h3>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Student: <span className="font-semibold text-slate-700">{students.find(s => s.id === selectedStudentId)?.name}</span></p>
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
                        setTestAnalysisStatus(prev => ({
                          ...prev,
                          [selectedAttemptId]: status === 'submitted' ? 'not_submitted' : 'submitted'
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

                {/* Overall Score */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-wider">Overall Score</h4>
                  <div className={`grid grid-cols-1 ${analysis.isSAT ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-0 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm`}>
                    {analysis.isSAT && (
                      <div className="py-3 px-4 border-b sm:border-b-0 sm:border-r border-slate-200 bg-blue-50/50">
                        <p className="text-2xl font-bold text-blue-700">
                          {analysis.finalScaledScore} <span className="text-xs text-slate-400 font-normal">/ 1600</span>
                        </p>
                        <p className="text-xs text-blue-600 mt-0.5 font-bold">Estimated Scaled Score</p>
                      </div>
                    )}
                    <div className="py-3 px-4 border-b sm:border-b-0 sm:border-r border-slate-200">
                      <p className="text-2xl font-bold text-blue-600">
                        {analysis.totalCorrect} / {analysis.totalQuestions}
                      </p>
                      <p className="text-xs text-blue-500 mt-0.5 font-medium">Total Questions</p>
                    </div>
                    <div className="py-3 px-4 border-b sm:border-b-0 sm:border-r border-slate-200">
                      <p className="text-2xl font-bold text-slate-800">
                        {analysis.rwCorrect} / {analysis.rwTotal}
                        {analysis.isSAT && <span className="text-xs text-slate-400 font-normal ml-1.5">({analysis.rwScaled} pts)</span>}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">Reading and Writing</p>
                    </div>
                    <div className="py-3 px-4">
                      <p className="text-2xl font-bold text-slate-800">
                        {analysis.mathCorrect} / {analysis.mathTotal}
                        {analysis.isSAT && <span className="text-xs text-slate-400 font-normal ml-1.5">({analysis.mathScaled} pts)</span>}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">Math</p>
                    </div>
                  </div>
                </div>

                {/* Section Overview */}
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
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-emerald-700 font-semibold">{sec.correct} Correct</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            <span className="text-red-600 font-semibold">{sec.incorrect} Incorrect</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                            <span>{sec.omitted} Omitted</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-200"></span>
                            <span>{sec.unvisited} Unvisited</span>
                          </div>
                          <div className="text-slate-300 font-light">|</div>
                          <div className="font-semibold text-slate-800">{sec.total} Questions</div>
                          <div className="text-slate-300 font-light">|</div>
                          <div className="font-bold text-blue-600">{sec.accuracy.toFixed(2)}% Accuracy</div>
                          <div className="text-slate-300 font-light">|</div>
                          <div className="text-slate-500 italic">{sec.timeTaken}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })() : (
            <Card padding="md"><div className="py-8 text-center text-slate-400 text-sm">Failed to load test data</div></Card>
          )}
        {/* ── Select Analytics Section (moved here from Management tab) ── */}
        <div className="space-y-4 mt-8 pt-6 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">Select Analytics</h2>
          </div>

          {/* Analytics Tabs */}
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'mistake',  label: 'Mistake Analytics' },
              { key: 'parallel', label: 'Parallel Analysis' },
              { key: 'skill',    label: 'Skill Analysis' },
            ] as { key: AnalyticsTab; label: string }[]).map(t => (
              <button
                key={t.key}
                onClick={() => setAnalyticsTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${analyticsTab === t.key ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Selected Filters</span>

            <SearchableSelect
              options={students.map(s => ({ id: s.id, label: s.name, searchText: s.name }))}
              value={analyticsStudentId}
              onChange={e => { setAnalyticsStudentId(e); setAnalyticsSubject(''); }}
              placeholder="Select student"
              minWidth="min-w-[140px]"
            />

            {analyticsData && analyticsSubjects.length > 0 && (
              <SearchableSelect
                options={[
                  { id: '', label: 'All Subjects', searchText: 'all' },
                  ...analyticsSubjects.map(s => ({ id: s, label: s, searchText: s }))
                ]}
                value={analyticsSubject}
                onChange={setAnalyticsSubject}
                placeholder="Select subject"
                minWidth="min-w-[140px]"
              />
            )}

            {analyticsSubject && (
              <button onClick={() => setAnalyticsSubject('')} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium hover:bg-blue-100">
                {analyticsSubject} <X size={11} />
              </button>
            )}
          </div>

          {/* No student selected state */}
          {!analyticsStudentId && (
            <Card padding="md">
              <div className="py-8 text-center">
                <BarChart2 size={32} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm font-medium">Select a student above to view their analytics</p>
                <p className="text-slate-400 text-xs mt-1">Mistake, Parallel, and Skill analysis will appear here</p>
              </div>
            </Card>
          )}

          {/* Analytics content */}
          {analyticsStudentId && (
            <>
              {analyticsAttempts.length > 0 ? (
                <Card padding="none">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Tests</h3>
                    <span className="text-xs text-slate-400">Click a test to view its analytics</span>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                    {analyticsAttempts.map((a, idx) => {
                      const isActive = a.id === analyticsAttemptId;
                      return (
                        <button
                          key={a.id}
                          onClick={() => { setAnalyticsAttemptId(a.id); setAnalyticsSubject(''); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
                        >
                          <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold truncate ${isActive ? 'text-blue-700' : 'text-slate-800'}`}>{a.test.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {a.completedAt
                                ? new Date(a.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : new Date(a.startedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {(() => {
                              try {
                                const analysis = computeTestAnalysis(a as any);
                                if (analysis.isSAT) {
                                  return (
                                    <>
                                      <span className={`text-base font-bold ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>{analysis.finalScaledScore}</span>
                                      <span className="block text-[9px] text-slate-400 leading-none">R&W: {analysis.rwScaled} • M: {analysis.mathScaled}</span>
                                    </>
                                  );
                                }
                              } catch (e) {}
                              return (
                                <>
                                  <span className={`text-base font-bold ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>{a.totalScore ?? '—'}</span>
                                  <span className="block text-[10px] text-slate-400 uppercase tracking-wide leading-none">score</span>
                                </>
                              );
                            })()}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              ) : !analyticsLoading && (
                <Card padding="md"><div className="py-6 text-center text-slate-400 text-sm">This student hasn't completed any tests yet.</div></Card>
              )}

              {/* Stat Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-100 mb-2">Total Questions</p>
                  <p className="text-4xl font-bold">{analyticsLoading ? '—' : totalQ}</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100 mb-2">Correct Questions</p>
                  <p className="text-4xl font-bold">{analyticsLoading ? '—' : correctQ}</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 p-5 text-white shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-100 mb-2">Accuracy</p>
                  <p className="text-4xl font-bold">{analyticsLoading ? '—' : `${accuracyPct.toFixed(2)}%`}</p>
                </div>
              </div>

              {/* Table / Chart toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAnalyticsView('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${analyticsView === 'table' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                >
                  <LayoutList size={13} /> Table View
                </button>
                <button
                  onClick={() => setAnalyticsView('chart')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${analyticsView === 'chart' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                >
                  <BarChart2 size={13} /> Chart View
                </button>
              </div>

              {analyticsLoading ? (
                <Card padding="md"><div className="py-8 text-center text-slate-400 text-sm">Loading analytics…</div></Card>
              ) : topicStats.length === 0 ? (
                <Card padding="md"><div className="py-8 text-center text-slate-400 text-sm">No data for this filter</div></Card>
              ) : analyticsView === 'table' ? (
                <Card padding="none">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-10">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Topic</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Total Questions</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Correct Questions</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topicStats.map((t, i) => (
                        <tr key={t.topic} className={`border-b border-slate-100 hover:bg-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                          <td className="px-4 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{t.topic}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{t.total}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{t.correct}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-semibold ${t.accuracy >= 80 ? 'text-emerald-600' : t.accuracy >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                              {t.accuracy.toFixed(2)} %
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              ) : (
                <Card padding="md">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={topicStats} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
                      <XAxis dataKey="topic" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                      <Tooltip formatter={(v) => [typeof v === 'number' ? `${v.toFixed(1)}%` : '', 'Accuracy']} />
                      <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                        {topicStats.map((t, i) => (
                          <Cell key={i} fill={t.accuracy >= 80 ? '#10b981' : t.accuracy >= 60 ? '#f59e0b' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </>
          )}
        </div>
        </div>
      )}

      {/* ── Add / Edit Student Modal ── */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setAddError(''); setIsEditing(false); setEditingStudentId(null); }} title={isEditing ? 'Edit Student Details' : 'Add New Student'} size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowAddModal(false); setIsEditing(false); setEditingStudentId(null); }}>Cancel</Button>
            <Button size="sm" icon={isEditing ? <Pencil size={13} /> : <UserPlus size={13} />} onClick={handleAddStudent} disabled={addLoading}>
              {addLoading ? 'Saving…' : (isEditing ? 'Save Changes' : 'Create Student')}
            </Button>
          </div>
        }>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {addError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{addError}</p>}

          {/* Personal Info */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              <User2 size={12} /> Personal Information
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
                  <input value={addForm.firstName} onChange={(e) => setAddForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="First name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
                  <input value={addForm.lastName} onChange={(e) => setAddForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Last name" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email Address *</label>
                <input type="email" value={addForm.email} onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))} disabled={isEditing}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400" placeholder="student@example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
                  <input type="date" value={addForm.dob} onChange={(e) => setAddForm(f => ({ ...f, dob: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">School Name</label>
                  <input value={addForm.schoolName} onChange={(e) => setAddForm(f => ({ ...f, schoolName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Lincoln High School" />
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              <Phone size={12} /> Contact Details
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Student Phone</label>
                <input type="tel" value={addForm.phone} onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="555-0100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Parent / Guardian Phone</label>
                <input type="tel" value={addForm.parentPhone} onChange={(e) => setAddForm(f => ({ ...f, parentPhone: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="555-0101" />
              </div>
            </div>
          </div>

          {/* Academic */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              <School size={12} /> Academic Info
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Grade</label>
                <select value={addForm.grade} onChange={(e) => setAddForm(f => ({ ...f, grade: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">—</option>
                  {['9', '10', '11', '12'].map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Target ACT Score</label>
                <input type="number" min={1} max={36} value={addForm.targetScore} onChange={(e) => setAddForm(f => ({ ...f, targetScore: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 32" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assign Tutor</label>
                <select value={addForm.tutorId} onChange={(e) => setAddForm(f => ({ ...f, tutorId: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">No tutor</option>
                  {tutors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {!isEditing && (
            <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
              A temporary password will be generated and shown to you after creation. Share it with the student for first login.
            </p>
          )}
        </div>
      </Modal>

      {/* ── Temp Password Modal ── */}
      <Modal isOpen={!!createdPassword} onClose={() => { setCreatedPassword(null); setCopiedPassword(false); }} title="Student Created" size="sm"
        footer={<Button size="sm" onClick={() => { setCreatedPassword(null); setCopiedPassword(false); }}>Done</Button>}>
        {createdPassword && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-900">{createdPassword.name}</p>
                <p className="text-xs text-emerald-700 truncate">{createdPassword.email}</p>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                <KeyRound size={12} /> Temporary Password
              </div>
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <code className="flex-1 text-base font-mono font-bold text-amber-900 tracking-widest select-all">{createdPassword.password}</code>
                <button onClick={() => { navigator.clipboard.writeText(createdPassword.password); setCopiedPassword(true); setTimeout(() => setCopiedPassword(false), 2000); }}
                  className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors flex-shrink-0" title="Copy password">
                  {copiedPassword ? <CheckCircle size={15} className="text-emerald-600" /> : <Copy size={15} />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">Share this with the student. They should change it after first login.</p>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Bulk Upload Modal ── */}
      <Modal isOpen={showBulkModal} onClose={() => { setShowBulkModal(false); setCsvPreview([]); setCsvError(''); }} title="Bulk Upload Students" size="md">
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${csvError ? 'border-red-300 bg-red-50' : csvPreview.length ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-blue-400'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileDrop(f); }}>
            <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileDrop(f); }} />
            {csvError ? (
              <><AlertCircle size={28} className="text-red-400 mx-auto mb-2" /><p className="text-sm font-medium text-red-700">{csvError}</p></>
            ) : csvPreview.length ? (
              <><CheckCircle size={28} className="text-emerald-500 mx-auto mb-2" /><p className="text-sm font-medium text-emerald-700">{csvPreview.length}+ rows detected</p></>
            ) : (
              <><Upload size={28} className="text-slate-400 mx-auto mb-2" /><p className="text-sm font-medium text-slate-700">Drop CSV file here</p></>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileText size={12} />
            <span>Required columns: <code className="bg-slate-100 px-1 rounded">name</code>, <code className="bg-slate-100 px-1 rounded">email</code></span>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={downloadTemplate} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              <Download size={12} /> Download template
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setShowBulkModal(false); setCsvPreview([]); setCsvError(''); }}>Cancel</Button>
              <Button size="sm" icon={csvSuccess ? <CheckCircle size={13} /> : <Upload size={13} />}
                disabled={!csvPreview.length || !!csvError} onClick={handleCsvUpload}
                variant={csvSuccess ? 'success' : 'primary'}>
                {csvSuccess ? 'Uploaded!' : `Upload${csvPreview.length ? ` (${csvPreview.length}+ rows)` : ''}`}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
}
