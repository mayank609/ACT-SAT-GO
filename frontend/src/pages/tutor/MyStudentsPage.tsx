import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, FileText, User2, TrendingUp, Filter, Loader2, ClipboardList, Clock, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import { api, type DbUser } from '../../lib/api';
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

  // ── Detailed Test Analysis state ─────────────────────────────────────────
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentAttempts, setStudentAttempts] = useState<Array<{ id: string; status: string; totalScore: number | null; completedAt: string | null; startedAt: string; test: { title: string } }>>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState('');
  const [testAnalysisLoading, setTestAnalysisLoading] = useState(false);
  const [testAnalysisAttempt, setTestAnalysisAttempt] = useState<TaAttempt | null>(null);
  const [testAnalysisStatus, setTestAnalysisStatus] = useState<Record<string, 'submitted' | 'not_submitted'>>({});

  // ── Question Wise Report state ───────────────────────────────────────────
  const [activeQuestionSectionIdx, setActiveQuestionSectionIdx] = useState(0);
  const [questionFilterBy, setQuestionFilterBy] = useState('all');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);;

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
            const diagnosticsAttemptBasic = studentAttempts.find((a: any) => 
              a.test?.title?.toLowerCase().includes('diagnostic')
            );
            if (diagnosticsAttemptBasic) {
              try {
                // Fetch full attempt data for analysis
                const fullAttemptResp = await api.getAttempt(diagnosticsAttemptBasic.id);
                const diagnosticsAttempt = fullAttemptResp.attempt as TaAttempt;
                const analysis = computeTestAnalysis(diagnosticsAttempt);
                diagnosticsEnglish = analysis.rwScaled;
                diagnosticsMath = analysis.mathScaled;
                scaledScoreTotal = analysis.finalScaledScore;
                scaledScoreEnglish = analysis.rwScaled;
                scaledScoreMath = analysis.mathScaled;
              } catch (e) {
                console.error("Error computing analysis for diagnosticsAttempt:", e);
                diagnosticsEnglish = diagnosticsAttemptBasic.totalScore;
                diagnosticsMath = diagnosticsAttemptBasic.totalScore;
                scaledScoreTotal = diagnosticsAttemptBasic.totalScore;
                scaledScoreEnglish = diagnosticsAttemptBasic.totalScore;
                scaledScoreMath = diagnosticsAttemptBasic.totalScore;
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
                  <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                    Question Wise Report
                  </h4>
                  
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

                    const allQuestions = sectionAttempt.section.questions;
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
                        <div className="flex items-center justify-between pt-2 flex-shrink-0">
                          <button
                            onClick={() => setCurrentQuestionIdx(safeIdx - 1)}
                            disabled={!hasPrev}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                              hasPrev
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <ChevronLeft size={16} />
                            Previous
                          </button>

                          <button
                            onClick={() => setCurrentQuestionIdx(safeIdx + 1)}
                            disabled={!hasNext}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
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

    </div>
  );
}
