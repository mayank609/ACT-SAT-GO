import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, User2, TrendingUp, Filter, Loader2, ClipboardList, Clock, ChevronLeft, ChevronRight, XCircle, Maximize2, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import { QuestionTimeChart, type QuestionTimeStat } from '../../components/dashboard/QuestionTimeChart';
import { api, type DbUser } from '../../lib/api';
import { studentStatusFromDecision, STUDENT_STATUS_LABEL, STUDENT_STATUS_BADGE } from '../../lib/studentStatus';
import { useAuthStore } from '../../store/useAuthStore';
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
  test: { id: string; title: string; category?: string };
  sectionAttempts: TaSectionAttempt[];
  answers: TaAttemptAnswer[];
}

function taAnswersMatch(given: TaAnswer | null, correct: TaAnswer): boolean {
  if (!given || !correct) return false;
  if (correct.value !== undefined) {
    if (given.value === undefined) return false;
    return Math.abs(Number(given.value) - Number(correct.value)) <= 1e-9 + 1e-6 * Math.abs(Number(correct.value));
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

const formatTargetDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const cleanStr = dateStr.includes('T') ? dateStr : dateStr.replace(/-/g, '/');
  const date = new Date(cleanStr);
  return isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function MyStudentsPage() {
  const navigate = useNavigate();
  const { dbId } = useAuthStore();

  // ── Main view state ───────────────────────────────────────────────────────
  const [mainView, setMainView] = useState<MainViewTab>('analysis');

  // ── Existing state ────────────────────────────────────────────────────────
  const [students, setStudents] = useState<DbUser[]>([]);


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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');

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
    totalRaw: number; totalRawT: number; rwSS: number; mathSS: number; totalSS: number; isSAT: boolean; isMockTest: boolean;
  }>>([]);
  const [reportLoading, setReportLoading] = useState(false);

  // ── Question Wise Report state ───────────────────────────────────────────
  const [activeQuestionSectionIdx, setActiveQuestionSectionIdx] = useState(0);
  const [questionFilterBy, setQuestionFilterBy] = useState('all');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [fullscreenQuestionReportOpen, setFullscreenQuestionReportOpen] = useState(false);
  const [showFullscreenPalette, setShowFullscreenPalette] = useState(false);
  const [showQuestionNavigator, setShowQuestionNavigator] = useState(false);
  const [timeChartOpen, setTimeChartOpen] = useState(false);
  const [timeChartSectionIdx, setTimeChartSectionIdx] = useState(0);

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
          const an = computeTestAnalysis(att);
          let rwM1 = 0, rwM2 = 0, mathM1 = 0, mathM2 = 0;
          let rwM1T = 0, rwM2T = 0, mathM1T = 0, mathM2T = 0;
          for (const s of an.sections) {
            const isMath = /math/i.test(s.name);
            const isRW = /read|writing|rw/i.test(s.name);
            const isM2 = /2|two/i.test(s.name);
            if (isMath) { if (isM2) { mathM2 += s.correct; mathM2T += s.total; } else { mathM1 += s.correct; mathM1T += s.total; } }
            else if (isRW) { if (isM2) { rwM2 += s.correct; rwM2T += s.total; } else { rwM1 += s.correct; rwM1T += s.total; } }
          }
          return {
            id: att.id, title: att.test.title, startedAt: att.startedAt, completedAt: att.completedAt,
            rwM1, rwM2, mathM1, mathM2, rwM1T, rwM2T, mathM1T, mathM2T,
            totalRaw: an.totalCorrect, totalRawT: an.totalQuestions,
            rwSS: an.rwScaled, mathSS: an.mathScaled, totalSS: an.finalScaledScore, isSAT: an.isSAT, isMockTest: ['Mock Test', 'Diagnostic'].includes(att.test.category ?? '') || /mock|diagnostic/i.test(att.test.title ?? ''),
          };
        });
      setReportRows(rows);
    }).finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [mainView, selectedStudentId, studentAttempts]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const reload = () => {
    if (!dbId) return;
    api.getTutorAssignments({ tutorId: dbId })
      .then((r) => setStudents(r.assignments.map((a) => a.student as DbUser)))
      .catch(() => {});
  };
  useEffect(() => { reload(); }, [dbId]);

  // Load comprehensive analysis data
  const loadComprehensiveAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const allStudentData: typeof studentAnalysisData = [];
      
      for (const student of students) {
        try {
          const attempts = (await api.getStudentAttempts(student.id)) as any;
          const studentAttempts = attempts?.attempts?.filter((a: any) => a.status === 'SUBMITTED') || [];
          
          // Fetch analytics from backend for accurate scores
          const analytics = await api.getStudentAnalytics(student.id);
          console.log(`[TutorAnalysis] ${student.name}: latestScore=${analytics.latestScore}, sectionStats=${analytics.sectionStats.length}`);
          
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
          
          // Use backend analytics data
          if (analytics.latestScore !== undefined) {
            scaledScoreTotal = analytics.latestScore;
            rawScoreTotal = analytics.latestScore;
            scaledScoreEnglish = analytics.latestScore;
            scaledScoreMath = analytics.latestScore;
          }
          
          // Get last test info from trend and get latest attempt for scaled score calculation
          let latestAttempt = null;
          if (analytics.trend && analytics.trend.length > 0) {
            const latestTrend = analytics.trend[analytics.trend.length - 1];
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
                console.log(`[TutorAnalysis] Scaled scores for ${student.name}: total=${scaledScoreTotal}, rw=${scaledScoreEnglish}, math=${scaledScoreMath}`);
              }
            } catch (err) {
              console.log(`[TutorAnalysis] Could not fetch attempt for scaled score calculation: ${err}`);
            }
          }
          
          // Get section-wise scores from analytics
          if (analytics.sectionStats && analytics.sectionStats.length > 0) {
            const sections = analytics.sectionStats;
            console.log(`[TutorAnalysis] Sections for ${student.name}:`, sections.map((s: any) => ({ name: s.sectionName, correct: s.correct, total: s.totalQuestions })));
            
            // Find ALL English sections and sum them up
            const engSections = sections.filter((s: any) => /reading|writing|rw|english/i.test(s.sectionName));
            if (engSections.length > 0) {
              diagnosticsEnglish = engSections.reduce((sum: number, s: any) => sum + (s.correct || 0), 0);
              rawScoreEnglish = diagnosticsEnglish;
              // Only update scaledScoreEnglish if it wasn't set from the full attempt analysis
              if (scaledScoreEnglish === analytics.latestScore) {
                scaledScoreEnglish = diagnosticsEnglish;
              }
              console.log(`[TutorAnalysis] English for ${student.name}: ${diagnosticsEnglish} (from ${engSections.length} sections)`);
            }
            
            // Find ALL Math sections and sum them up
            const mathSections = sections.filter((s: any) => /math/i.test(s.sectionName));
            if (mathSections.length > 0) {
              diagnosticsMath = mathSections.reduce((sum: number, s: any) => sum + (s.correct || 0), 0);
              rawScoreMath = diagnosticsMath;
              // Only update scaledScoreMath if it wasn't set from the full attempt analysis
              if (scaledScoreMath === analytics.latestScore) {
                scaledScoreMath = diagnosticsMath;
              }
              console.log(`[TutorAnalysis] Math for ${student.name}: ${diagnosticsMath} (from ${mathSections.length} sections)`);
            }
          }
          
          // Fallback if no section data
          if (diagnosticsEnglish === null && analytics.latestScore !== undefined) {
            diagnosticsEnglish = Math.round(analytics.latestScore / 2);
          }
          if (diagnosticsMath === null && analytics.latestScore !== undefined) {
            diagnosticsMath = Math.round(analytics.latestScore / 2);
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

  // Load comprehensive analysis when switching to analysis view or when students are loaded
  useEffect(() => {
    if (mainView === 'analysis' && students.length > 0 && studentAnalysisData.length === 0) {
      loadComprehensiveAnalysis();
    }
  }, [mainView, students.length]);

  // ── Derived data ──────────────────────────────────────────────────────────
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
      {/* ── My Students Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">My Students</h1>
          <p className="text-sm text-slate-500 mt-0.5">My Students: <span className="font-semibold text-slate-700">{students.length}</span></p>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'My Students', value: students.length, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'With Assignments', value: students.filter(s => s.tutorId).length, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
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
            <p className="text-sm text-slate-500 mt-0.5">Detailed performance metrics for your students</p>
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

        {/* Status filter */}
        {(() => {
          const activeCount = students.filter(s => s.diagnosticDecision === 'keep').length;
          const inactiveCount = students.filter(s => s.diagnosticDecision === 'leave').length;
          const pendingCount = students.filter(s => !s.diagnosticDecision).length;
          const chip = (key: 'all' | 'active' | 'inactive' | 'pending', label: string, on: string, off: string) => (
            <button
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${statusFilter === key ? on : off}`}
            >
              {label}
            </button>
          );
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {chip('all', `All ${students.length}`, 'bg-blue-600 text-white', 'bg-blue-50 text-blue-700 hover:bg-blue-100')}
              {chip('active', `${activeCount} Active`, 'bg-emerald-500 text-white', 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200')}
              {chip('inactive', `${inactiveCount} Inactive`, 'bg-rose-500 text-white', 'bg-rose-100 text-rose-700 hover:bg-rose-200')}
              {chip('pending', `${pendingCount} Pending`, 'bg-amber-500 text-white', 'bg-amber-100 text-amber-700 hover:bg-amber-200')}
            </div>
          );
        })()}

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
                </tr>
              </thead>
              <tbody>
                {analysisLoading ? (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-400">Loading...</td></tr>
                ) : studentAnalysisData.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-slate-400">No students found</td></tr>
                ) : studentAnalysisData
                    .filter((s) => {
                      if (statusFilter !== 'all') {
                        const decision = students.find(st => st.id === s.studentId)?.diagnosticDecision;
                        if (studentStatusFromDecision(decision) !== statusFilter) return false;
                      }
                      return analysisSearchTerm
                        ? s.studentName.toLowerCase().includes(analysisSearchTerm.toLowerCase()) ||
                          s.studentEmail.toLowerCase().includes(analysisSearchTerm.toLowerCase())
                        : true;
                    })
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
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-slate-900 text-sm">{row.studentName}</p>
                                {(() => {
                                  const status = studentStatusFromDecision(students.find(st => st.id === row.studentId)?.diagnosticDecision);
                                  return (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${STUDENT_STATUS_BADGE[status]}`}>
                                      {STUDENT_STATUS_LABEL[status]}
                                    </span>
                                  );
                                })()}
                              </div>
                              <p className="text-xs text-slate-400 truncate">{row.studentEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600 whitespace-nowrap">
                          {formatTargetDate(row.targetDate)}
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
                  const isMockTest = ['Mock Test', 'Diagnostic'].includes((selectedAttempt as any).test?.category ?? '') || /mock|diagnostic/i.test((selectedAttempt as any).test?.title ?? '');
                  if (!analysis.isSAT) return null;
                  if (!isMockTest) {
                    return (
                      <div className="flex items-center gap-2 ml-auto">
                        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Score</span>
                          <span className="text-sm font-extrabold text-slate-700">{analysis.totalCorrect}/{analysis.totalQuestions}</span>
                        </div>
                        {analysis.rwTotal > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">R&amp;W</span>
                            <span className="text-sm font-extrabold text-emerald-700">{analysis.rwCorrect}/{analysis.rwTotal}</span>
                          </div>
                        )}
                        {analysis.mathTotal > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Math</span>
                            <span className="text-sm font-extrabold text-amber-700">{analysis.mathCorrect}/{analysis.mathTotal}</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-2 ml-auto">
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Total</span>
                        <span className="text-sm font-extrabold text-blue-700">{analysis.finalScaledScore}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">R&amp;W</span>
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
                const head = ['#', 'Test Name', 'Started At', 'Completed At', `RW1/${den.rwM1}`, `RW2/${den.rwM2}`, `M1/${den.mathM1}`, `M2/${den.mathM2}`, `Total/${den.total}`, 'RW SS', 'Math SS', 'Total SS', 'Analysis'];
                const lines = reportRows.map((r, i) => [
                  i + 1, r.title,
                  r.startedAt ? new Date(r.startedAt).toLocaleString() : '',
                  r.completedAt ? new Date(r.completedAt).toLocaleString() : '',
                  r.rwM1, r.rwM2, r.mathM1, r.mathM2, r.totalRaw,
                  (r.isSAT && r.isMockTest) ? r.rwSS : '-', (r.isSAT && r.isMockTest) ? r.mathSS : '-', (r.isSAT && r.isMockTest) ? r.totalSS : '-',
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
              return (
                <Card padding="none">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">Total Session : <span className="text-slate-900 font-bold">{reportRows.length}</span></p>
                      <h2 className="text-lg font-bold text-blue-900 mt-0.5">{studentName}<span className="text-slate-500 font-medium text-sm ml-2">Test Report</span></h2>
                    </div>
                    <button onClick={downloadReport} disabled={reportRows.length === 0}
                      className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors self-start">
                      Download Report
                    </button>
                  </div>
                  {reportLoading ? (
                    <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                      <Loader2 size={20} className="animate-spin text-blue-500" />
                      <span className="text-sm">Loading report…</span>
                    </div>
                  ) : reportRows.length === 0 ? (
                    <p className="py-12 text-center text-slate-400 text-sm">No completed tests found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <th className="px-3 py-3 text-left font-semibold">#</th>
                            <th className="px-3 py-3 text-left font-semibold">Test Name</th>
                            <th className="px-3 py-3 text-center font-semibold">Started At</th>
                            <th className="px-3 py-3 text-center font-semibold">Completed At</th>
                            <th className="px-3 py-3 text-center font-semibold">RW1<span className="text-slate-400 font-normal">/{den.rwM1}</span></th>
                            <th className="px-3 py-3 text-center font-semibold">RW2<span className="text-slate-400 font-normal">/{den.rwM2}</span></th>
                            <th className="px-3 py-3 text-center font-semibold">M1<span className="text-slate-400 font-normal">/{den.mathM1}</span></th>
                            <th className="px-3 py-3 text-center font-semibold">M2<span className="text-slate-400 font-normal">/{den.mathM2}</span></th>
                            <th className="px-3 py-3 text-center font-semibold">Total<span className="text-slate-400 font-normal">/{den.total}</span></th>
                            <th className="px-3 py-3 text-center font-semibold">RW SS</th>
                            <th className="px-3 py-3 text-center font-semibold">Math SS</th>
                            <th className="px-3 py-3 text-center font-semibold">Total SS</th>
                            <th className="px-3 py-3 text-center font-semibold">Analysis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportRows.map((r, i) => {
                            const analysed = testAnalysisStatus[r.id] === 'submitted';
                            return (
                              <tr key={r.id} onClick={() => setSelectedAttemptId(r.id)}
                                className="border-b border-slate-50 hover:bg-blue-50/50 cursor-pointer transition-colors">
                                <td className="px-3 py-3 text-slate-500">{i + 1}</td>
                                <td className="px-3 py-3 font-semibold text-blue-700 hover:underline">{r.title}</td>
                                <td className="px-3 py-3 text-center text-xs text-slate-500">{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</td>
                                <td className="px-3 py-3 text-center text-xs text-slate-500">{r.completedAt ? new Date(r.completedAt).toLocaleString() : '—'}</td>
                                <td className="px-3 py-3 text-center text-blue-700 font-medium">{r.rwM1}</td>
                                <td className="px-3 py-3 text-center text-blue-700 font-medium">{r.rwM2}</td>
                                <td className="px-3 py-3 text-center text-blue-700 font-medium">{r.mathM1}</td>
                                <td className="px-3 py-3 text-center text-blue-700 font-medium">{r.mathM2}</td>
                                <td className="px-3 py-3 text-center font-bold text-slate-900">{r.totalRaw}</td>
                                <td className="px-3 py-3 text-center text-slate-600">{(r.isSAT && r.isMockTest) ? r.rwSS : '—'}</td>
                                <td className="px-3 py-3 text-center text-slate-600">{(r.isSAT && r.isMockTest) ? r.mathSS : '—'}</td>
                                <td className="px-3 py-3 text-center font-semibold text-slate-800">{(r.isSAT && r.isMockTest) ? r.totalSS : '—'}</td>
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
            const isMockTest = ['Mock Test', 'Diagnostic'].includes(testAnalysisAttempt.test.category ?? '') || /mock|diagnostic/i.test(testAnalysisAttempt.test.title ?? '');
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

                {/* Score Card */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex divide-x divide-slate-200">
                    <div className="px-6 py-5 shrink-0 text-center bg-gradient-to-br from-[#1b3d6e] to-[#2563eb] rounded-tl-xl rounded-bl-xl">
                      <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Total Score</p>
                      <p className="text-5xl font-black text-white leading-none tabular-nums mt-1">
                        {(analysis.isSAT && isMockTest) ? analysis.finalScaledScore : analysis.totalCorrect}
                      </p>
                      {(analysis.isSAT && isMockTest) ? (
                        <p className="text-xs text-blue-300 mt-2 border-b border-blue-400/40 pb-0.5 w-fit mx-auto">400 - 1600</p>
                      ) : (
                        <p className="text-xs text-blue-300 mt-2">out of {analysis.totalQuestions}</p>
                      )}
                    </div>
                    <div className="px-6 py-5 shrink-0">
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Reading &amp; Writing</p>
                      <p className="text-5xl font-black text-slate-900 leading-none tabular-nums mt-1">
                        {(analysis.isSAT && isMockTest) ? analysis.rwScaled : `${analysis.rwCorrect}/${analysis.rwTotal}`}
                      </p>
                    </div>
                    <div className="px-6 py-5 shrink-0">
                      <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Math</p>
                      <p className="text-5xl font-black text-slate-900 leading-none tabular-nums mt-1">
                        {(analysis.isSAT && isMockTest) ? analysis.mathScaled : `${analysis.mathCorrect}/${analysis.mathTotal}`}
                      </p>
                    </div>
                    {(analysis.isSAT && isMockTest) && (() => {
                      const score = analysis.finalScaledScore;
                      const pct = Math.min(100, Math.max(0, ((score - 400) / 1200) * 100));
                      return (
                        <div className="flex-1 px-8 py-5 flex flex-col justify-center gap-2.5 min-w-0">
                          <div className="flex justify-between text-xs text-slate-500 font-medium">
                            <span>400</span><span>800</span><span>1200</span><span>1600</span>
                          </div>
                          <div className="relative h-3 rounded-full" style={{ background: 'linear-gradient(to right, #ef4444 0%, #ef4444 33.33%, #f59e0b 33.33%, #f59e0b 66.67%, #22c55e 66.67%, #22c55e 100%)' }}>
                            <div className="absolute w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md" style={{ left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)' }} />
                          </div>
                          <div className="flex">
                            <div className="flex-1 text-center">
                              <p className="text-[10px] font-semibold text-slate-600">Below Average</p>
                              <p className="text-[10px] text-slate-400">(400 - 800)</p>
                            </div>
                            <div className="flex-1 text-center">
                              <p className="text-[10px] font-semibold text-slate-600">Average</p>
                              <p className="text-[10px] text-slate-400">(800 - 1200)</p>
                            </div>
                            <div className="flex-1 text-center">
                              <p className="text-[10px] font-semibold text-slate-600">Above Average</p>
                              <p className="text-[10px] text-slate-400">(1200 - 1600)</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
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
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span className="text-amber-700 font-semibold">{sec.bookmarked} Bookmarked</span>
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
                      // Skip child rows: already emitted via their passage parent above.
                      return (q as any).parentQuestionId ? [] : [tq];
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

                {/* ── Time Spent Per Question ── */}
                {(() => {
                  const answersMap = new Map(testAnalysisAttempt.answers.map((a: any) => [a.questionId, a]));
                  const sectionStats = testAnalysisAttempt.sectionAttempts
                    .slice()
                    .sort((a: any, b: any) => a.section.orderIndex - b.section.orderIndex)
                    .map((sa: any) => {
                      const allQs = sa.section.questions.flatMap((tq: any) => {
                        const q = tq.question;
                        const isPassage = q.type === 'PASSAGE' || q.content?.meta?.isPassage === true;
                        if (isPassage && q.childQuestions?.length > 0) {
                          return q.childQuestions.map((cq: any) => ({ ...tq, questionId: cq.id, question: cq }));
                        }
                        return [tq];
                      });
                      const stats: QuestionTimeStat[] = allQs.map((tq: any, idx: number) => {
                        const ans = answersMap.get(tq.questionId) as any;
                        const correct = !!ans?.answerGiven && taAnswersMatch(ans.answerGiven, tq.question.correctAnswer);
                        const skipped = !ans?.answerGiven;
                        return {
                          questionIndex: idx + 1,
                          sectionName: sa.section.name,
                          timeSpentSeconds: ans?.timeSpentSeconds ?? 0,
                          status: (skipped ? 'skipped' : correct ? 'correct' : 'incorrect') as 'correct' | 'incorrect' | 'skipped',
                          difficulty: tq.question.difficultyLevel ?? 'MEDIUM',
                          topicName: tq.question.topic?.name ?? tq.question.subject ?? '',
                        };
                      });
                      return { name: sa.section.name, stats };
                    });
                  return (
                    <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
                      <button
                        onClick={() => setTimeChartOpen(!timeChartOpen)}
                        className="w-full text-left flex items-center justify-between hover:opacity-80 transition-opacity"
                      >
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900">Time Spent Per Question</h4>
                          <span className="text-xs text-slate-400 font-medium">section-wise breakdown</span>
                        </div>
                        <div className="text-slate-500">
                          {timeChartOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </button>
                      {timeChartOpen && (
                        <>
                          <div className="flex flex-wrap gap-2 mt-4 mb-5 border-b border-slate-100 pb-4">
                            {sectionStats.map((sec: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => setTimeChartSectionIdx(idx)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  timeChartSectionIdx === idx ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {sec.name}
                              </button>
                            ))}
                          </div>
                          {sectionStats[timeChartSectionIdx] && (
                            <QuestionTimeChart stats={sectionStats[timeChartSectionIdx].stats} />
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })() : (
            <Card padding="md"><div className="py-8 text-center text-slate-400 text-sm">Failed to load test data</div></Card>
          )}
        </div>
      )}

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
          // Skip child rows: already emitted via their passage parent above.
          return (q as any).parentQuestionId ? [] : [tq];
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
          // Skip child rows: already emitted via their passage parent above.
          return (q as any).parentQuestionId ? [] : [tq];
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
                Review Mode - Tutor Portal
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

            {/* Practice Banner */}
            <div className="flex-shrink-0 bg-[#1e2150] text-white text-center text-[12px] font-semibold tracking-wide py-1.5 z-10 select-none">
              THIS IS A PRACTICE TEST REVIEW
            </div>

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
              {/* Left: student name */}
              <p className="text-sm font-bold text-slate-800 truncate max-w-[28%] select-text">
                Reviewing: {students.find(s => s.id === selectedStudentId)?.name || 'Student'}
              </p>

              {/* Center: question navigator pill */}
              {filteredQuestions.length > 0 && (
                <button
                  onClick={() => setShowFullscreenPalette(true)}
                  className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-md cursor-pointer"
                >
                  Question {safeIdx + 1} of {filteredQuestions.length}
                  <ChevronUp size={14} />
                </button>
              )}

              {/* Right: navigation buttons */}
              <div className="flex items-center gap-2">
                <button
                  disabled={!hasPrev}
                  onClick={() => setCurrentQuestionIdx(safeIdx - 1)}
                  className={`px-5 py-2 text-xs font-bold rounded-full transition-colors cursor-pointer ${
                    hasPrev
                      ? 'text-blue-600 hover:bg-blue-50'
                      : 'text-slate-300 cursor-not-allowed'
                  }`}
                >
                  Back
                </button>
                <button
                  disabled={!hasNext}
                  onClick={() => setCurrentQuestionIdx(safeIdx + 1)}
                  className={`px-7 py-2 text-xs font-bold text-white rounded-full transition-colors cursor-pointer ${
                    hasNext
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  Next
                </button>
              </div>
            </footer>

            {/* Question Palette Modal overlay */}
            {showFullscreenPalette && (
              <div className="absolute inset-0 z-[200]" onClick={() => setShowFullscreenPalette(false)}>
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200" onClick={(e) => e.stopPropagation()}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 text-center flex-1">
                      {activeSection.name}
                    </h3>
                    <button onClick={() => setShowFullscreenPalette(false)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-slate-500 cursor-pointer">
                      <X size={18} />
                    </button>
                  </div>
                  
                  {/* Legend */}
                  <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-center gap-4 flex-wrap bg-slate-50 select-none">
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                      <div className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-500" />
                      Correct
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                      <div className="w-3.5 h-3.5 rounded bg-red-100 border border-red-500" />
                      Incorrect
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                      <div className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300" />
                      Omitted
                    </div>
                  </div>

                  {/* Grid */}
                  <div className="p-6 max-h-72 overflow-y-auto flex justify-center">
                    <div className="grid grid-cols-6 gap-3">
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
                              setShowFullscreenPalette(false);
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
                </div>
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}
