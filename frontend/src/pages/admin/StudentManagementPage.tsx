import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, UserPlus, CheckCircle, AlertCircle, FileText, Download, Pencil, Trash2, Copy, KeyRound, Phone, School, User2, TrendingUp, Filter, Loader2, ClipboardList, Clock, ChevronLeft, ChevronRight, XCircle, Maximize2, X, ChevronDown } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import { api, type DbUser } from '../../lib/api';
import { parseCSV, exportToCsv } from '../../utils/exportCsv';
import toast from 'react-hot-toast';

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
  rw1Correct: number; rw1Total: number;
  rw2Correct: number; rw2Total: number;
  math1Correct: number; math1Total: number;
  math2Correct: number; math2Total: number;
} {
  const answersMap = new Map(attempt.answers.map(a => [a.questionId, a]));
  const sortedSections = [...attempt.sectionAttempts].sort((a, b) => a.section.orderIndex - b.section.orderIndex);

  let totalCorrect = 0, totalQuestions = 0;
  let rwCorrect = 0, rwTotal = 0, mathCorrect = 0, mathTotal = 0;
  // Module breakdown — assigned by position within each subject group (orderIndex order),
  // not by "1"/"2" in section names, so any naming convention works.
  let mathGroupIdx = 0, rwGroupIdx = 0;
  let rw1Correct = 0, rw1Total = 0, rw2Correct = 0, rw2Total = 0;
  let math1Correct = 0, math1Total = 0, math2Correct = 0, math2Total = 0;

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
      const ms = new Date(sa.completedAt).getTime() - new Date(sa.startedAt).getTime();
      const mins = Math.floor(ms / 60000);
      const secs = Math.round((ms % 60000) / 1000);
      timeTaken = `${mins}:${secs.toString().padStart(2, '0')} Minutes Taken`;
    }

    const isMath = /math/i.test(sa.section.name);
    const isRW = /reading|writing|rw|english/i.test(sa.section.name);
    const category = isMath ? 'Math' : isRW ? 'Reading and Writing' : sa.section.name;

    if (isMath) {
      mathCorrect += correct; mathTotal += total;
      if (mathGroupIdx === 0) { math1Correct += correct; math1Total += total; }
      else { math2Correct += correct; math2Total += total; }
      mathGroupIdx++;
    } else if (isRW) {
      rwCorrect += correct; rwTotal += total;
      if (rwGroupIdx === 0) { rw1Correct += correct; rw1Total += total; }
      else { rw2Correct += correct; rw2Total += total; }
      rwGroupIdx++;
    }

    totalCorrect += correct;
    totalQuestions += total;

    return { name: sa.section.name, category, correct, incorrect, omitted, total, unvisited, accuracy, timeTaken };
  });

  const isSAT = rwTotal > 0 || mathTotal > 0;

  let finalScaledScore = totalCorrect;
  let rwScaled = 0;
  let mathScaled = 0;
  if (isSAT) {
    const rwActualTotal = rw1Total + rw2Total || 54;
    const mathActualTotal = math1Total + math2Total || 44;

    if (rw1Correct >= 18) {
      rwScaled = 400 + Math.round(((rw1Correct + rw2Correct) / rwActualTotal) * 400 / 10) * 10;
    } else {
      rwScaled = 200 + Math.round(((rw1Correct + rw2Correct) / rwActualTotal) * 450 / 10) * 10;
    }

    if (math1Correct >= 14) {
      mathScaled = 420 + Math.round(((math1Correct + math2Correct) / mathActualTotal) * 380 / 10) * 10;
    } else {
      mathScaled = 200 + Math.round(((math1Correct + math2Correct) / mathActualTotal) * 450 / 10) * 10;
    }

    rwScaled = Math.min(800, Math.max(200, rwScaled));
    mathScaled = Math.min(800, Math.max(200, mathScaled));
    finalScaledScore = rwScaled + mathScaled;
  }

  return {
    sections, totalCorrect, totalQuestions, rwCorrect, rwTotal, mathCorrect, mathTotal,
    isSAT, finalScaledScore, rwScaled, mathScaled,
    rw1Correct, rw1Total, rw2Correct, rw2Total,
    math1Correct, math1Total, math2Correct, math2Total,
  };
}

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

  // ── Mock Test Report (per-student list of all attempts) ─────────────────────
  const [reportRows, setReportRows] = useState<Array<{
    id: string; title: string; startedAt: string; completedAt: string | null;
    rwM1: number; rwM2: number; mathM1: number; mathM2: number;
    rwM1T: number; rwM2T: number; mathM1T: number; mathM2T: number;
    totalRaw: number; totalRawT: number; rwSS: number; mathSS: number; totalSS: number; isSAT: boolean;
  }>>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFilter, setReportFilter] = useState<'all' | 'mock' | 'diagnostic' | 'hw' | 'cw' | 'practice'>('all');

  // ── Question Wise Report state ───────────────────────────────────────────
  const [activeQuestionSectionIdx, setActiveQuestionSectionIdx] = useState(0);
  const [questionFilterBy, setQuestionFilterBy] = useState('all');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [fullscreenQuestionReportOpen, setFullscreenQuestionReportOpen] = useState(false);
  const [showQuestionNavigator, setShowQuestionNavigator] = useState(false);

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
        // Land on the report list (no attempt pre-selected) so the table shows first.
        setSelectedAttemptId('');
        setTestAnalysisAttempt(null);
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

  // Build the Mock Test Report: fetch every attempt's detail and derive module
  // raw scores + estimated scaled scores for the list table.
  useEffect(() => {
    if (mainView !== 'test_analysis' || !selectedStudentId || studentAttempts.length === 0) {
      setReportRows([]);
      return;
    }
    let cancelled = false;
    setReportLoading(true);
    Promise.all(
      studentAttempts.map((a) => api.getAttempt(a.id).then((r) => r.attempt as TaAttempt).catch(() => null))
    ).then((attempts) => {
      if (cancelled) return;
      const rows = attempts
        .filter((a): a is TaAttempt => !!a)
        .map((att) => {
          try {
            const an = computeTestAnalysis(att);
            return {
              id: att.id, title: att.test.title, startedAt: att.startedAt, completedAt: att.completedAt,
              rwM1: an.rw1Correct, rwM2: an.rw2Correct, mathM1: an.math1Correct, mathM2: an.math2Correct,
              rwM1T: an.rw1Total, rwM2T: an.rw2Total, mathM1T: an.math1Total, mathM2T: an.math2Total,
              totalRaw: an.totalCorrect, totalRawT: an.totalQuestions,
              rwSS: an.rwScaled, mathSS: an.mathScaled, totalSS: an.finalScaledScore, isSAT: an.isSAT,
            };
          } catch (err) {
            console.error(`[TestAnalysis] Error computing analysis for attempt ${att.id}:`, err);
            // Fallback: show totalScore instead of recomputed values
            return {
              id: att.id, title: att.test.title, startedAt: att.startedAt, completedAt: att.completedAt,
              rwM1: 0, rwM2: 0, mathM1: 0, mathM2: 0,
              rwM1T: 0, rwM2T: 0, mathM1T: 0, mathM2T: 0,
              totalRaw: att.totalScore ?? 0, totalRawT: 0,
              rwSS: 0, mathSS: 0, totalSS: att.totalScore ?? 0, isSAT: false,
            };
          }
        });
      console.log(`[TestAnalysis] Computed ${rows.length} test reports`);
      setReportRows(rows);
    }).finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [mainView, selectedStudentId, studentAttempts]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const reload = () => {
    Promise.all([
      api.getUsersByRole('STUDENT').then((r) => setStudents(r.users ?? [])),
      api.getUsersByRole('TUTOR').then((r) => setTutors(r.users ?? [])),
    ]);
  };
  useEffect(() => { reload(); }, []);

  // Load comprehensive analysis data
  const loadComprehensiveAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const allStudentData: typeof studentAnalysisData = [];
      
      for (const student of students) {
        try {
          // Get attempts list for test type counting and details
          const attemptsResp = (await api.getStudentAttempts(student.id)) as any;
          const studentAttempts = attemptsResp?.attempts?.filter((a: any) => a.status === 'SUBMITTED') || [];
          console.log(`[Analysis] Student ${student.id} has ${studentAttempts.length} submitted attempts`);
          
          // Get analytics from backend - this has pre-computed scores and stats
          const analyticsResp = await api.getStudentAnalytics(student.id);
          console.log(`[Analysis] Analytics for ${student.id}:`, { trend: analyticsResp.trend.length, latestScore: analyticsResp.latestScore, avgScore: analyticsResp.avgScore, sectionStats: analyticsResp.sectionStats.length });
          
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
          
          // Extract scores from backend analytics
          if (analyticsResp.latestScore !== undefined) {
            rawScoreTotal = analyticsResp.latestScore;
            scaledScoreTotal = analyticsResp.latestScore;
            scaledScoreEnglish = analyticsResp.latestScore;
            scaledScoreMath = analyticsResp.latestScore;
          }
          
          // Get last test info from trend and get latest attempt for scaled score calculation
          let latestAttempt = null;
          if (analyticsResp.trend && analyticsResp.trend.length > 0) {
            const latestTrend = analyticsResp.trend[analyticsResp.trend.length - 1];
            lastTestName = latestTrend.testTitle;
            lastSubmittedAt = latestTrend.date;
            
            // Fetch the latest attempt to calculate scaled scores
            try {
              latestAttempt = (await api.getAttempt(latestTrend.attemptId)) as any;
              if (latestAttempt?.attempt) {
                const analysis = computeTestAnalysis(latestAttempt.attempt);
                scaledScoreTotal = analysis.finalScaledScore;
                scaledScoreEnglish = analysis.rwScaled;
                scaledScoreMath = analysis.mathScaled;
                console.log(`[Analysis] Scaled scores for ${student.id}: total=${scaledScoreTotal}, rw=${scaledScoreEnglish}, math=${scaledScoreMath}`);
              }
            } catch (err) {
              console.log(`[Analysis] Could not fetch attempt for scaled score calculation: ${err}`);
            }
          }
          
          // Try to get section-wise breakdown if multiple sections exist
          if (analyticsResp.sectionStats && analyticsResp.sectionStats.length > 0) {
            const sections = analyticsResp.sectionStats;
            console.log(`[Analysis] Section stats for ${student.id}:`, sections.map((s: any) => ({ name: s.sectionName, correct: s.correct, total: s.totalQuestions, accuracy: s.accuracy })));
            
            // Find ALL English sections and Math sections (sum them up if multiple)
            const engSections = sections.filter((s: any) => /reading|writing|rw|english/i.test(s.sectionName));
            const mathSections = sections.filter((s: any) => /math/i.test(s.sectionName));
            
            if (engSections.length > 0) {
              diagnosticsEnglish = engSections.reduce((sum: number, s: any) => sum + (s.correct || 0), 0);
              rawScoreEnglish = diagnosticsEnglish;
              // Only update scaledScoreEnglish if it wasn't set from the full attempt analysis
              if (scaledScoreEnglish === analyticsResp.latestScore) {
                scaledScoreEnglish = diagnosticsEnglish;
              }
              console.log(`[Analysis] English for ${student.id}: ${diagnosticsEnglish} (from ${engSections.length} sections)`);
            }
            
            if (mathSections.length > 0) {
              diagnosticsMath = mathSections.reduce((sum: number, s: any) => sum + (s.correct || 0), 0);
              rawScoreMath = diagnosticsMath;
              // Only update scaledScoreMath if it wasn't set from the full attempt analysis
              if (scaledScoreMath === analyticsResp.latestScore) {
                scaledScoreMath = diagnosticsMath;
              }
              console.log(`[Analysis] Math for ${student.id}: ${diagnosticsMath} (from ${mathSections.length} sections)`);
            }
          }
          
          // If no section data, use overall score
          if (diagnosticsEnglish === null && analyticsResp.latestScore !== undefined) {
            diagnosticsEnglish = Math.round(analyticsResp.latestScore / 2);
          }
          if (diagnosticsMath === null && analyticsResp.latestScore !== undefined) {
            diagnosticsMath = Math.round(analyticsResp.latestScore / 2);
          }
          
          // Count assessment types by test title from actual attempts list
          const mockCount = studentAttempts.filter((a: any) => a.test?.title?.toLowerCase().includes('mock')).length;
          const sectionalCount = studentAttempts.filter((a: any) => a.test?.title?.toLowerCase().includes('sectional')).length;
          const hwCount = studentAttempts.filter((a: any) => a.test?.title?.toLowerCase().includes('homework') || a.test?.title?.toLowerCase().includes('hw')).length;
          const cwCount = studentAttempts.filter((a: any) => a.test?.title?.toLowerCase().includes('classwork') || a.test?.title?.toLowerCase().includes('cw')).length;
          const practiceCount = studentAttempts.filter((a: any) => a.test?.title?.toLowerCase().includes('practice')).length;
          const totalAssessments = studentAttempts.length;  // Total submitted attempts
          
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
          // Still add student entry even if analytics fails, with null scores
          allStudentData.push({
            studentId: student.id,
            studentName: student.name,
            studentEmail: student.email,
            targetDate: null,
            diagnosticsEnglish: null,
            diagnosticsMath: null,
            mockTests: 0,
            sectionalTests: 0,
            hwCount: 0,
            cwCount: 0,
            practiceSheets: 0,
            totalAssessments: 0,
            lastTestName: null,
            lastSubmittedAt: null,
            scaledScoreTotal: null,
            scaledScoreEnglish: null,
            scaledScoreMath: null,
            rawScoreTotal: null,
            rawScoreEnglish: null,
            rawScoreMath: null,
            attempts: [],
          });
        }
      }
      
      setStudentAnalysisData(allStudentData);
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Load comprehensive analysis when on analysis view and students are ready
  useEffect(() => {
    if (mainView === 'analysis' && students.length > 0 && studentAnalysisData.length === 0) {
      loadComprehensiveAnalysis();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainView, students.length]);

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
                              setSelectedAttemptId('');
                              setReportFilter('all');
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
                    setReportFilter('all');
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
            (() => {
              const studentName = students.find((s) => s.id === selectedStudentId)?.name ?? 'Student';
              const dRaw = reportRows.reduce((d, r) => ({
                rwM1: Math.max(d.rwM1, r.rwM1T), rwM2: Math.max(d.rwM2, r.rwM2T),
                mathM1: Math.max(d.mathM1, r.mathM1T), mathM2: Math.max(d.mathM2, r.mathM2T),
                total: Math.max(d.total, r.totalRawT),
              }), { rwM1: 0, rwM2: 0, mathM1: 0, mathM2: 0, total: 0 });
              const den = { rwM1: dRaw.rwM1 || 27, rwM2: dRaw.rwM2 || 27, mathM1: dRaw.mathM1 || 22, mathM2: dRaw.mathM2 || 22, total: dRaw.total || 98 };
              const downloadReport = () => {
                const head = ['#', 'Test Name', 'Started At', 'Completed At', `RW MD1/${den.rwM1}`, `RW MD2/${den.rwM2}`, `Math MD1/${den.mathM1}`, `Math MD2/${den.mathM2}`, `Total/${den.total}`, 'RW SS', 'Math SS', 'Total SS', 'Analysis'];
                const lines = reportRows.map((r, i) => [
                  i + 1, r.title,
                  r.startedAt ? new Date(r.startedAt).toLocaleString() : '',
                  r.completedAt ? new Date(r.completedAt).toLocaleString() : '',
                  r.rwM1, r.rwM2, r.mathM1, r.mathM2, r.totalRaw,
                  r.isSAT ? r.rwSS : '-', r.isSAT ? r.mathSS : '-', r.isSAT ? r.totalSS : '-',
                  testAnalysisStatus[r.id] === 'submitted' ? 'Analysed' : 'Unanalysed',
                ]);
                const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = `${studentName.replace(/\s+/g, '_')}_Test_Report.csv`;
                link.click();
                URL.revokeObjectURL(url);
              };
              const filterMatches = (title: string, f: typeof reportFilter) => {
                const t = title.toLowerCase();
                if (f === 'all') return true;
                if (f === 'mock') return t.includes('mock');
                if (f === 'diagnostic') return t.includes('diagnostic');
                if (f === 'hw') return t.includes('homework') || t.includes(' hw') || t.endsWith('hw') || /\bhw\b/.test(t);
                if (f === 'cw') return t.includes('classwork') || t.includes(' cw') || t.endsWith('cw') || /\bcw\b/.test(t);
                if (f === 'practice') return t.includes('practice');
                return true;
              };
              const filterLabels: { key: typeof reportFilter; label: string }[] = [
                { key: 'all', label: 'All' },
                { key: 'mock', label: 'Mock' },
                { key: 'diagnostic', label: 'Diagnostic' },
                { key: 'hw', label: 'HW' },
                { key: 'cw', label: 'CW' },
                { key: 'practice', label: 'Practice' },
              ];
              const filteredRows = reportRows.filter(r => filterMatches(r.title, reportFilter));

              return (
                <Card padding="none">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">Total Session : <span className="text-slate-900 font-bold">{filteredRows.length}</span></p>
                      <h2 className="text-lg font-bold text-purple-800 mt-0.5">{studentName}<span className="text-slate-500 font-medium text-sm ml-2">Test Report</span></h2>
                    </div>
                    <button onClick={downloadReport} disabled={reportRows.length === 0}
                      className="px-4 py-2 text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 rounded-lg transition-colors self-start">
                      Download Report
                    </button>
                  </div>
                  {/* Filter tabs */}
                  <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100 flex-wrap">
                    {filterLabels.map(({ key, label }) => {
                      const count = key === 'all' ? reportRows.length : reportRows.filter(r => filterMatches(r.title, key)).length;
                      const active = reportFilter === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setReportFilter(key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${active ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          {label}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-purple-500 text-white' : 'bg-slate-300 text-slate-600'}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                  {reportLoading ? (
                    <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                      <Loader2 size={20} className="animate-spin text-blue-500" />
                      <span className="text-sm">Loading report…</span>
                    </div>
                  ) : filteredRows.length === 0 ? (
                    <p className="py-12 text-center text-slate-400 text-sm">{reportRows.length === 0 ? 'No completed tests found.' : `No ${filterLabels.find(f => f.key === reportFilter)?.label} tests found.`}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <th className="px-3 py-3 text-left font-semibold">#</th>
                            <th className="px-3 py-3 text-left font-semibold">Test Name</th>
                            <th className="px-3 py-3 text-center font-semibold">Started At</th>
                            <th className="px-3 py-3 text-center font-semibold">Completed At</th>
                            <th className="px-3 py-3 text-center font-semibold">RW MD1<span className="text-slate-400 font-normal">/{den.rwM1}</span></th>
                            <th className="px-3 py-3 text-center font-semibold">RW MD2<span className="text-slate-400 font-normal">/{den.rwM2}</span></th>
                            <th className="px-3 py-3 text-center font-semibold">Math MD1<span className="text-slate-400 font-normal">/{den.mathM1}</span></th>
                            <th className="px-3 py-3 text-center font-semibold">Math MD2<span className="text-slate-400 font-normal">/{den.mathM2}</span></th>
                            <th className="px-3 py-3 text-center font-semibold">Total<span className="text-slate-400 font-normal">/{den.total}</span></th>
                            <th className="px-3 py-3 text-center font-semibold">RW SS</th>
                            <th className="px-3 py-3 text-center font-semibold">Math SS</th>
                            <th className="px-3 py-3 text-center font-semibold">Total SS</th>
                            <th className="px-3 py-3 text-center font-semibold">Analysis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((r, i) => {
                            const analysed = testAnalysisStatus[r.id] === 'submitted';
                            return (
                              <tr key={r.id} onClick={() => setSelectedAttemptId(r.id)}
                                className="border-b border-slate-50 hover:bg-blue-50/50 cursor-pointer transition-colors">
                                <td className="px-3 py-3 text-slate-500">{i + 1}</td>
                                <td className="px-3 py-3 font-semibold text-purple-700 hover:underline">{r.title}</td>
                                <td className="px-3 py-3 text-center text-xs text-slate-500">{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</td>
                                <td className="px-3 py-3 text-center text-xs text-slate-500">{r.completedAt ? new Date(r.completedAt).toLocaleString() : '—'}</td>
                                <td className="px-3 py-3 text-center text-purple-700 font-medium">{r.rwM1}</td>
                                <td className="px-3 py-3 text-center text-purple-700 font-medium">{r.rwM2}</td>
                                <td className="px-3 py-3 text-center text-purple-700 font-medium">{r.mathM1}</td>
                                <td className="px-3 py-3 text-center text-purple-700 font-medium">{r.mathM2}</td>
                                <td className="px-3 py-3 text-center font-bold text-slate-900">{r.totalRaw}</td>
                                <td className="px-3 py-3 text-center text-slate-600">{r.isSAT ? r.rwSS : '—'}</td>
                                <td className="px-3 py-3 text-center text-slate-600">{r.isSAT ? r.mathSS : '—'}</td>
                                <td className="px-3 py-3 text-center font-semibold text-slate-800">{r.isSAT ? r.totalSS : '—'}</td>
                                <td className="px-3 py-3 text-center">
                                  <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${analysed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                    {analysed ? 'ANALYSED' : 'UNANALYSED'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              );
            })()
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
                {/* Back to report list */}
                <button
                  onClick={() => setSelectedAttemptId('')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  <ChevronLeft size={15} /> Back to Test Report
                </button>
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
                      <p className="text-2xl font-bold text-emerald-700">
                        {analysis.isSAT
                          ? <>{analysis.rwScaled} <span className="text-xs text-slate-400 font-normal">/ 800</span></>
                          : <>{analysis.rwCorrect} / {analysis.rwTotal}</>}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Reading and Writing
                        {analysis.isSAT && <span className="text-slate-400 font-normal"> · {analysis.rwCorrect}/{analysis.rwTotal} correct</span>}
                      </p>
                    </div>
                    <div className="py-3 px-4">
                      <p className="text-2xl font-bold text-amber-700">
                        {analysis.isSAT
                          ? <>{analysis.mathScaled} <span className="text-xs text-slate-400 font-normal">/ 800</span></>
                          : <>{analysis.mathCorrect} / {analysis.mathTotal}</>}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Math
                        {analysis.isSAT && <span className="text-slate-400 font-normal"> · {analysis.mathCorrect}/{analysis.mathTotal} correct</span>}
                      </p>
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

                {/* ── Question Wise Report ── */}
                <div className="mt-8 bg-white rounded-xl border-2 border-blue-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                      Question Wise Report
                    </h4>
                    <button
                      onClick={() => setFullscreenQuestionReportOpen(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all font-semibold text-sm shadow-sm"
                      title="View in fullscreen"
                    >
                      <Maximize2 size={16} />
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

                    const sectionAttempt = testAnalysisAttempt?.sectionAttempts.find(
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
                      return [tq];
                    });
                    const answersMap = new Map(testAnalysisAttempt?.answers.map((a) => [a.questionId, a]) ?? []);

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
                          {(currentTq as any).parentPassageText ? (
                            // Side-by-side layout for passage questions
                            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 h-full">
                              {/* Left: Passage */}
                              <div className="p-4 overflow-y-auto">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Passage</div>
                                <RichContentRenderer content={(currentTq as any).parentPassageText || ''} variant="passage" className="prose-sm text-slate-700" />
                              </div>
                              {/* Right: Question + Options */}
                              <div className="flex flex-col p-4">
                                <div className={`p-3 flex items-start gap-3 rounded-lg mb-3 ${correct ? 'bg-blue-50/55' : skipped ? 'bg-slate-50' : 'bg-sky-50/40'}`}>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${correct ? 'bg-blue-600' : skipped ? 'bg-slate-400' : 'bg-blue-400'}`}>
                                      {allQuestions.findIndex(q => q.questionId === currentTq.questionId) + 1}
                                    </div>
                                    {correct ? <CheckCircle size={14} className="text-blue-600" /> : <XCircle size={14} className={skipped ? 'text-slate-400' : 'text-blue-400'} />}
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Question</div>
                                    <div className="text-sm text-slate-800 leading-relaxed font-medium">
                                      <RichContentRenderer content={currentTq.question.content.text || `Question`} variant="question" className="prose-sm" />
                                    </div>
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
                                <div className="space-y-2 flex-1 overflow-y-auto">
                                  {options.length > 0 && (
                                    <div className="space-y-2 max-w-3xl">
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
                                    <div className="flex gap-4 text-sm">
                                      <span className="text-slate-500">Your answer: <strong className={correct ? 'text-blue-600' : 'text-blue-400'}>{studentAnswer?.answerGiven?.value ?? '—'}</strong></span>
                                      <span className="text-slate-500">Correct: <strong className="text-blue-600">{currentTq.question.correctAnswer.value}</strong></span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Regular single question layout
                            <>
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
                                  <div className="space-y-2 mb-3 text-left max-w-3xl">
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
                            </>
                          )}
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
            <Card padding="md"><div className="py-8 text-center text-slate-400 text-sm">Failed to load test data</div></Card>
          )}
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

      {/* ── Question Navigator Modal ── */}
      {showQuestionNavigator && testAnalysisAttempt && (() => {
        const analysis = computeTestAnalysis(testAnalysisAttempt);
        const activeSection = analysis.sections[activeQuestionSectionIdx];
        if (!activeSection) return null;

        const sectionAttempt = testAnalysisAttempt.sectionAttempts.find(
          (sa) => sa.section.name === activeSection.name
        );
        if (!sectionAttempt) return null;

        const allQuestions = sectionAttempt.section.questions.flatMap((tq) => {
          const q = tq.question;
          const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
          if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
            return q.childQuestions.map((cq) => ({ ...tq, id: cq.id, questionId: cq.id, question: cq, parentPassageText: q.content?.text }));
          }
          return [tq];
        });
        const answersMap = new Map(testAnalysisAttempt.answers.map((a) => [a.questionId, a]));

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
              {/* Title */}
              <div className="text-center border-b border-slate-200 pb-4">
                <h3 className="text-lg md:text-xl font-bold text-slate-900">{activeSection.name}</h3>
                <p className="text-sm text-slate-500 mt-1">Questions</p>
              </div>

              {/* Status Legend */}
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

              {/* Question Grid */}
              <div className="flex justify-center">
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-3 max-h-72 overflow-y-auto p-1">
                  {filteredQuestions.map((fq, idx) => {
                    const ans = answersMap.get(fq.questionId);
                    const isCorrect = ans?.answerGiven ? taAnswersMatch(ans.answerGiven, fq.question.correctAnswer) : false;
                    const isOmitted = !ans?.answerGiven;
                    const isCurrent = idx === safeIdx;

                    let bgColor = isOmitted ? 'bg-slate-200 border-slate-300' : isCorrect ? 'bg-emerald-100 border-emerald-500' : 'bg-red-100 border-red-500';
                    let textColor = isOmitted ? 'text-slate-600' : isCorrect ? 'text-emerald-700' : 'text-red-700';

                    if (isCurrent) {
                      bgColor = 'bg-blue-600 border-blue-700';
                      textColor = 'text-white font-bold ring-2 ring-blue-300';
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentQuestionIdx(idx);
                          setShowQuestionNavigator(false);
                        }}
                        className={`w-11 h-11 rounded-xl font-bold text-sm transition-all flex items-center justify-center border-2 ${bgColor} ${textColor} hover:shadow-md hover:scale-105 cursor-pointer`}
                        title={`Q${idx + 1} — ${isOmitted ? 'Omitted' : isCorrect ? 'Correct' : 'Incorrect'}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Section - Question Counter */}
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
      {fullscreenQuestionReportOpen && testAnalysisAttempt && (() => {
        const analysis = computeTestAnalysis(testAnalysisAttempt);
        const activeSection = analysis.sections[activeQuestionSectionIdx];
        if (!activeSection) return null;

        const sectionAttempt = testAnalysisAttempt.sectionAttempts.find(
          (sa) => sa.section.name === activeSection.name
        );
        if (!sectionAttempt) return null;

        const allQuestions = sectionAttempt.section.questions.flatMap((tq) => {
          const q = tq.question;
          const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
          if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
            return q.childQuestions.map((cq) => ({ ...tq, id: cq.id, questionId: cq.id, question: cq, parentPassageText: q.content?.text }));
          }
          return [tq];
        });
        const answersMap = new Map(testAnalysisAttempt.answers.map((a) => [a.questionId, a]));

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

        const studentAnswer = currentTq ? answersMap.get(currentTq.questionId) : null;
        const correct = studentAnswer?.answerGiven ? taAnswersMatch(studentAnswer.answerGiven, currentTq.question.correctAnswer) : false;
        const skipped = !studentAnswer?.answerGiven;
        const options = currentTq ? taOptionsToDisplay(currentTq.question.options) : [];
        const userAnswerDisplay = studentAnswer ? taAnswerToDisplay(studentAnswer.answerGiven) : null;
        const correctAnswerDisplay = currentTq ? taAnswerToDisplay(currentTq.question.correctAnswer) : null;

        return (
          <div className="fixed inset-0 bg-white z-[150] overflow-hidden flex flex-col font-sans select-none">
            {/* Top Header Bar */}
            <header className="flex-shrink-0 bg-[#fcfcfd] border-b border-slate-200 px-5 h-16 flex items-center justify-between z-20">
              {/* Left: Section Selection tabs */}
              <div className="flex items-center gap-4 min-w-0">
                <span className="font-bold text-slate-800 text-sm hidden sm:inline">Reviewing:</span>
                <div className="flex flex-wrap gap-1 min-w-0">
                  {analysis.sections.map((sa, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveQuestionSectionIdx(idx);
                        setQuestionFilterBy('all');
                        setCurrentQuestionIdx(0);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                        activeQuestionSectionIdx === idx
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {sa.category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Center Info Banner */}
              <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold text-slate-700 select-none">
                Review Mode - Admin Portal
              </div>

              {/* Right tools and exit */}
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

            {/* Main Area */}
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
                /* Split Passage Layout */
                <div className="flex h-full min-h-full divide-x divide-slate-200">
                  {/* Left Column: Passage */}
                  <div className="w-1/2 overflow-y-auto p-8 bg-white h-full">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Reading Passage</p>
                    <div className="prose prose-slate max-w-none text-slate-800 text-[15px] leading-relaxed">
                      <RichContentRenderer content={(currentTq as any).parentPassageText || ''} variant="passage" />
                    </div>
                  </div>

                  {/* Right Column: Question + Options + Explanation */}
                  <div className="w-1/2 overflow-y-auto p-8 bg-white h-full flex flex-col gap-6 select-text">
                    {/* Status header */}
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
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock size={12} />
                          Time Spent: {studentAnswer.timeSpentSeconds}s
                        </span>
                      ) : null}
                    </div>

                    {/* Question text */}
                    <div className="text-[15px] text-slate-900 leading-relaxed font-normal">
                      <RichContentRenderer content={currentTq.question.content.text || ''} variant="question" />
                    </div>

                    {/* Options / Answer Input */}
                    {options.length > 0 ? (
                      <div className="space-y-2.5">
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
                    ) : (
                      currentTq.question.type === 'NUMERIC' && (
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex flex-col gap-2">
                          <div className="text-sm">
                            <span className="text-slate-500 font-medium">Your answer: </span>
                            <span className={`font-bold ${correct ? 'text-emerald-600' : 'text-red-500'}`}>
                              {studentAnswer?.answerGiven?.value ?? '—'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-slate-500 font-medium">Correct answer: </span>
                            <span className="font-bold text-emerald-600">
                              {currentTq.question.correctAnswer.value}
                            </span>
                          </div>
                        </div>
                      )
                    )}

                    {/* Explanation */}
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
                /* Standard Single Column Layout */
                <div className="overflow-y-auto h-full p-8 bg-white select-text">
                  <div className="max-w-3xl mx-auto flex flex-col gap-6">
                    {/* Status header */}
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
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock size={12} />
                          Time Spent: {studentAnswer.timeSpentSeconds}s
                        </span>
                      ) : null}
                    </div>

                    {/* Question text */}
                    <div className="text-[16px] text-slate-900 leading-relaxed font-normal">
                      <RichContentRenderer content={currentTq.question.content.text || ''} variant="question" />
                    </div>

                    {/* Options / Answer Input */}
                    {options.length > 0 ? (
                      <div className="space-y-2.5">
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
                    ) : (
                      currentTq.question.type === 'NUMERIC' && (
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex flex-col gap-2">
                          <div className="text-sm">
                            <span className="text-slate-500 font-medium">Your answer: </span>
                            <span className={`font-bold ${correct ? 'text-emerald-600' : 'text-red-500'}`}>
                              {studentAnswer?.answerGiven?.value ?? '—'}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-slate-500 font-medium">Correct answer: </span>
                            <span className="font-bold text-emerald-600">
                              {currentTq.question.correctAnswer.value}
                            </span>
                          </div>
                        </div>
                      )
                    )}

                    {/* Explanation */}
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

            {/* Bottom Footer Bar */}
            <footer className="flex-shrink-0 bg-[#fcfcfd] border-t border-slate-200 px-5 h-16 flex items-center justify-between z-20">

              {/* Previous */}
              <button
                onClick={() => setCurrentQuestionIdx(Math.max(0, safeIdx - 1))}
                disabled={safeIdx === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} /> Previous
              </button>

              {/* Center: question navigator pill */}
              {filteredQuestions.length > 0 && (
                <button
                  onClick={() => setShowQuestionNavigator(true)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all cursor-pointer shadow-md"
                >
                  Question {safeIdx + 1} of {filteredQuestions.length}
                  <ChevronDown size={16} />
                </button>
              )}

              {/* Next */}
              <button
                onClick={() => setCurrentQuestionIdx(Math.min(filteredQuestions.length - 1, safeIdx + 1))}
                disabled={safeIdx >= filteredQuestions.length - 1}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Next <ChevronRight size={16} />
              </button>

            </footer>

          </div>
        );
      })()}

    </div>
  );
}
