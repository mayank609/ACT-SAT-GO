import { useState, useEffect, useRef } from 'react';
import { localDateTimeToISO, isoToLocalDateTimeInput, formatDate, formatDateTime } from '../../lib/utils';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { useUrlString, useUrlFlag } from '../../lib/urlState';
import { Plus, Upload, UserPlus, CheckCircle, AlertCircle, FileText, Download, Pencil, Trash2, Trash, Copy, KeyRound, Phone, School, User2, Loader2, ChevronLeft, BookOpen, Boxes, TrendingUp, CalendarClock, UserMinus, Eye } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { AttemptAnalysis, computeTestAnalysis, type TaAttempt } from '../../components/report/AttemptAnalysis';
import { TutorMultiSelect } from '../../components/common/TutorMultiSelect';
import { TrashModal } from '../../components/common/TrashModal';
import { StudentNameHover, StudentQuickIcons } from '../../components/admin/StudentQuickIcons';
import { api, type DbUser, type DbTestPackage } from '../../lib/api';
import { studentStatusFromDecision } from '../../lib/studentStatus';
import { practiceSubjectOf } from '../../lib/testCategorize';
import { parseCSV, exportToCsv } from '../../utils/exportCsv';
import { toLines } from '../../lib/sessionLog';

type MainViewTab = 'analysis' | 'test_analysis';

interface DbTest { id: string; title: string; status: string; category?: string; sections: unknown[] }

// stage badge helper removed as the student table was consolidated

// Test Builder tags homework as subCategory "{Subject}-Homework" (e.g. "Math-Homework"),
// which does NOT contain the substring "hw" — match on "homework" instead.
const isHW = (test: any): boolean => {
  const t = (test.title ?? '').toLowerCase();
  const sub = (test.subCategory ?? '').toLowerCase();
  return sub.includes('homework') || t.includes('homework') || t.includes(' hw') || t.endsWith('hw') || /\bhw\b/.test(t);
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

/**
 * Students list and test reports, shared by admin (every student) and tutor
 * (assigned students only). The screen is the same; only the data scope and
 * a few tutor-only side effects differ.
 */
export function StudentManagementPage() {
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();
  const isTutor = user?.role === 'tutor';
  const analysisCacheKey = isTutor ? 'tutorAnalysisCache_v4' : 'adminAnalysisCache_v4';

  // ── Main view state ───────────────────────────────────────────────────────
  // Kept in the URL so the browser Back button steps back through screens.
  const [mainViewParam, setMainView] = useUrlString('view', 'analysis');
  const mainView = mainViewParam as MainViewTab;

  // ── Existing state ────────────────────────────────────────────────────────
  const [students, setStudents] = useState<DbUser[]>([]);
  const [tutors, setTutors] = useState<DbUser[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageSearch, setManageSearch] = useState('');
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<DbUser | null>(null);
  const [deleteStudentLoading, setDeleteStudentLoading] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [csvError, setCsvError] = useState('');
  const [csvSuccess, setCsvSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', targetDate: '', tutorIds: [] as string[], phone: '', parentPhone: '', dob: '', schoolName: '', board: '', timezone: 'Asia/Kolkata', firstClassDate: '', programVariant: '', mockVariant: '', accommodation: false, stage: '', onboarded: false, manualDiagTotal: '', manualDiagRW: '', manualDiagMath: '' });
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<DbUser | null>(null);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [newPasswordResult, setNewPasswordResult] = useState<{ name: string; email: string; password: string } | null>(null);
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
    diagnosticCount: number;
    sectionalTests: number;
    hwCount: number;
    hwRW: number;
    hwMath: number;
    cwCount: number;
    practiceSheets: number;
    practiceRW: number;
    practiceMath: number;
    totalAssessments: number;
    lastTestName: string | null;
    lastSubmittedAt: string | null;
    scaledScoreTotal: number | null;
    scaledScoreEnglish: number | null;
    scaledScoreMath: number | null;
    rawScoreTotal: number | null;
    rawScoreEnglish: number | null;
    rawScoreMath: number | null;
    diagnosticDecision: 'keep' | 'leave' | null;
    attempts: Array<{ id: string; testTitle: string; status: string; totalScore: number | null; startedAt: string; completedAt: string | null }>;
  }>>([]);
  const [analysisSearchTerm, setAnalysisSearchTerm] = useState('');
  const [analysisSortBy, setAnalysisSortBy] = useState<'name' | 'diagnostics' | 'attempts'>('name');

  // Diagnostic Total / RW / Math for the name hover card: computed score first,
  // else the manually entered one (marked M), else a dash.
  const diagScores = (row: { studentId: string; scaledScoreTotal: number | null; scaledScoreEnglish: number | null; scaledScoreMath: number | null }) => {
    const st = students.find((x) => x.id === row.studentId);
    const pick = (computed: number | null, manual: number | null | undefined) =>
      computed != null ? computed
        : manual != null ? <span title="Manually entered score" className="text-violet-700">{manual}<sup className="text-[9px] ml-0.5">M</sup></span>
        : '—';
    return [
      { label: 'Total', value: pick(row.scaledScoreTotal, st?.manualDiagTotal) },
      { label: 'RW', value: pick(row.scaledScoreEnglish, st?.manualDiagRW) },
      { label: 'Math', value: pick(row.scaledScoreMath, st?.manualDiagMath) },
    ];
  };
  const [activityFilter, setActivityFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');

  // ── Detailed Test Analysis state ─────────────────────────────────────────
  const [selectedStudentId, setSelectedStudentId] = useUrlString('student');
  const [studentAttempts, setStudentAttempts] = useState<Array<{ id: string; status: string; totalScore: number | null; completedAt: string | null; startedAt: string; test: { title: string } }>>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useUrlString('attempt');

  // ── Mock Test Report (per-student list of all attempts, plus assigned-but-not-yet-completed) ──
  const [reportRows, setReportRows] = useState<Array<{
    id: string; title: string; category?: string; subCategory?: string; startedAt: string; completedAt: string | null;
    rwM1: number; rwM2: number; mathM1: number; mathM2: number;
    rwM1T: number; rwM2T: number; mathM1T: number; mathM2T: number;
    totalRaw: number; totalRawT: number; rwSS: number; mathSS: number; totalSS: number; isSAT: boolean; isMockTest: boolean; isAnalysed: boolean;
    /** True for an assigned test the student hasn't submitted yet — the row has no scores. */
    isPending?: boolean;
    pendingStatus?: string;
    dueDate?: string | null;
    assignmentId?: string;
    testId?: string;
    submittedAttemptId?: string;
    latestAttemptId?: string;
  }>>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFilter, setReportFilter] = useState<'all' | 'mock' | 'diagnostic' | 'hw_math' | 'hw_reading' | 'hw_writing' | 'practice_math' | 'practice_reading' | 'practice_writing'>('all');
  const [reportViewMode, setReportViewMode] = useState<'completed' | 'assigned'>('completed');
  const [rescheduleTarget, setRescheduleTarget] = useState<{ assignmentId: string; title: string } | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<{ id: string; assignmentId: string; title: string } | null>(null);
  const [unassignLoading, setUnassignLoading] = useState(false);

  // ?timegrid belongs to the attempt analysis; clear it when switching attempts.
  const [, setShowTimeGrid] = useUrlFlag('timegrid');

  const [publishedTests, setPublishedTests] = useState<DbTest[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState<string | null>(null);
  const [assignSelectedTestIds, setAssignSelectedTestIds] = useState<string[]>([]);
  const [assignFilter, setAssignFilter] = useState('All');
  const [assignSubFilter, setAssignSubFilter] = useState<'All' | 'HW' | 'English' | 'Maths'>('All');
  const [assignSearch, setAssignSearch] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  // Assign modal can target individual tests or whole packages.
  const [assignMode, setAssignMode] = useState<'tests' | 'packages'>('tests');
  const [assignSelectedPackageIds, setAssignSelectedPackageIds] = useState<string[]>([]);
  const [packages, setPackages] = useState<DbTestPackage[]>([]);

  useEffect(() => {
    if (mainView !== 'test_analysis' || !selectedStudentId) {
      setStudentAttempts([]);
      setSelectedAttemptId('', { replace: true });
     
      return;
    }
    api.getStudentAttempts(selectedStudentId)
      .then((r) => {
        const submitted = ((r.attempts as any[]) ?? []).filter((a) => a.status === 'SUBMITTED');
        setStudentAttempts(submitted);
      })
      .catch(() => {
        setStudentAttempts([]);
      });
  }, [mainView, selectedStudentId]);


  // Build the Mock Test Report: fetch every attempt's detail (derive module raw
  // scores + estimated scaled scores) AND every assignment that isn't completed
  // yet, so admins see the full assigned-vs-completed picture, not just what's
  // been submitted.
  useEffect(() => {
    if (mainView !== 'test_analysis' || !selectedStudentId) {
      setReportRows([]);
      return;
    }
    let cancelled = false;
    setReportLoading(true);

    // Fetch in batches of 6 to avoid overwhelming the server
    const fetchBatched = async (): Promise<(TaAttempt | null)[]> => {
      const results: (TaAttempt | null)[] = [];
      const BATCH = 6;
      for (let i = 0; i < studentAttempts.length; i += BATCH) {
        if (cancelled) break;
        const batch = studentAttempts.slice(i, i + BATCH);
        const batchResults = await Promise.all(
          batch.map((a) => api.getAttempt(a.id).then((r) => r.attempt as TaAttempt).catch(() => null))
        );
        results.push(...batchResults);
      }
      return results;
    };

    Promise.all([
      studentAttempts.length ? fetchBatched() : Promise.resolve([] as (TaAttempt | null)[]),
      api.getAssignedTests(selectedStudentId).then((r) => (r.assignedTests as any[]) ?? []).catch(() => [] as any[]),
    ]).then(([attempts, assignedTests]) => {
      if (cancelled) return;
      // Assignments the student has already submitted are already represented
      // by an attempt row above — only add the ones still outstanding.
      const pendingRows = assignedTests
        .filter((a) => a.status !== 'Completed')
        .map((a) => ({
          id: `pending-${a.assignmentId}`,
          title: a.title,
          category: a.category ?? undefined,
          subCategory: a.subCategory ?? undefined,
          startedAt: '', completedAt: null,
          rwM1: 0, rwM2: 0, mathM1: 0, mathM2: 0,
          rwM1T: 0, rwM2T: 0, mathM1T: 0, mathM2T: 0,
          totalRaw: 0, totalRawT: a.totalQuestions ?? 0,
          rwSS: 0, mathSS: 0, totalSS: 0, isSAT: false, isMockTest: false, isAnalysed: false,
          isPending: true,
          pendingStatus: a.status as string,
          dueDate: a.dueDate ?? null,
          assignmentId: a.assignmentId as string,
          testId: a.testId as string,
          submittedAttemptId: a.submittedAttemptId as string | undefined,
          latestAttemptId: a.latestAttemptId as string | undefined,
        }));
      const rows = attempts
        .filter((a): a is TaAttempt => !!a)
        .map((att) => {
          try {
            const an = computeTestAnalysis(att);
            const totalFlatQs = an.totalQuestions;
            const reviewedCount = att.answers.filter((a) => a.doubtStatus === 'doubt' || a.doubtStatus === 'cleared').length;
            const isAnalysed = totalFlatQs > 0 && reviewedCount >= totalFlatQs;
            return {
              id: att.id, title: att.test.title, category: att.test.category ?? undefined, subCategory: (att.test as any).subCategory ?? undefined,
              startedAt: att.startedAt, completedAt: att.completedAt,
              rwM1: an.rw1Correct, rwM2: an.rw2Correct, mathM1: an.math1Correct, mathM2: an.math2Correct,
              rwM1T: an.rw1Total, rwM2T: an.rw2Total, mathM1T: an.math1Total, mathM2T: an.math2Total,
              totalRaw: an.totalCorrect, totalRawT: an.totalQuestions,
              rwSS: an.rwScaled, mathSS: an.mathScaled, totalSS: an.finalScaledScore, isSAT: an.isSAT,
              // Scaled score applies to Diagnostic/Mock/Sectional — only Practice Sheet shows a raw count.
              isMockTest: !(['Practice Sheet'].includes(att.test.category ?? '') || /practice\s*sheet/i.test(att.test.title ?? '')),
              isAnalysed,
            };
          } catch (err) {
            console.error(`[TestAnalysis] Error computing analysis for attempt ${att.id}:`, err);
            // Fallback: show totalScore instead of recomputed values
            return {
              id: att.id, title: att.test.title, category: att.test.category ?? undefined, subCategory: (att.test as any).subCategory ?? undefined,
              startedAt: att.startedAt, completedAt: att.completedAt,
              rwM1: 0, rwM2: 0, mathM1: 0, mathM2: 0,
              rwM1T: 0, rwM2T: 0, mathM1T: 0, mathM2T: 0,
              totalRaw: att.totalScore ?? 0, totalRawT: 0,
              rwSS: 0, mathSS: 0, totalSS: att.totalScore ?? 0, isSAT: false, isMockTest: true, isAnalysed: false,
            };
          }
        });
      console.log(`[TestAnalysis] Computed ${rows.length} test reports, ${pendingRows.length} pending`);
      setReportRows([...rows, ...pendingRows]);
    }).finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [mainView, selectedStudentId, studentAttempts]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const reload = () => {
    if (isTutor && !dbId) return;
    Promise.all([
      (isTutor
        ? api.getTutorAssignments({ tutorId: dbId! }).then((r) => setStudents(r.assignments.map((a) => a.student as DbUser)))
        : api.getUsersByRole('STUDENT').then((r) => setStudents(r.users ?? []))),
      api.getUsersByRole('TUTOR').then((r) => setTutors(r.users ?? [])),
    ]);
  };
  useEffect(() => { reload(); }, [dbId, isTutor]);
  useEffect(() => {
    api.getPublishedTests().then((r) => setPublishedTests((r.tests as DbTest[]).filter((t) => t.status === 'PUBLISHED'))).catch(() => {});
    api.getTestPackages().then((r) => setPackages(r.packages)).catch(() => {});
  }, []);

  // Load comprehensive analysis data
  const loadComprehensiveAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const subjectOf = (a: any): 'rw' | 'math' | 'other' => {
        const t = (a.test?.title ?? '').toLowerCase();
        if (/math|algebra|geometry|calc/.test(t)) return 'math';
        if (/reading|writing|english|verbal|grammar|\brw\b|r&w/.test(t)) return 'rw';
        return 'other';
      };

      const allStudentData = await Promise.all(
        students.map(async (student) => {
          try {
            // Fetch attempts list + analytics in parallel (was sequential before)
            const [attemptsResp, analyticsResp] = await Promise.all([
              api.getStudentAttempts(student.id) as Promise<any>,
              api.getStudentAnalytics(student.id),
            ]);

            const studentAttempts = (attemptsResp?.attempts ?? []).filter((a: any) => a.status === 'SUBMITTED');

            let diagnosticsEnglish: number | null = null;
            let diagnosticsMath: number | null = null;
            let lastTestName: string | null = null;
            let lastSubmittedAt: string | null = null;
            let rawScoreTotal: number | null = null;
            let rawScoreEnglish: number | null = null;
            let rawScoreMath: number | null = null;

            if (analyticsResp.latestScore !== undefined) {
              rawScoreTotal = analyticsResp.latestScore;
            }

            if (analyticsResp.trend?.length > 0) {
              const latestTrend = analyticsResp.trend[analyticsResp.trend.length - 1];
              lastTestName = latestTrend.testTitle;
              lastSubmittedAt = latestTrend.date;
            }

            if (analyticsResp.sectionStats?.length > 0) {
              const engSections = analyticsResp.sectionStats.filter((s: any) => /reading|writing|rw|english/i.test(s.sectionName));
              const mathSections = analyticsResp.sectionStats.filter((s: any) => /math/i.test(s.sectionName));
              if (engSections.length > 0) {
                rawScoreEnglish = engSections.reduce((sum: number, s: any) => sum + (s.correct || 0), 0);
              }
              if (mathSections.length > 0) {
                rawScoreMath = mathSections.reduce((sum: number, s: any) => sum + (s.correct || 0), 0);
              }
            }

            // Total Assessment counts: tests the student has COMPLETED (submitted),
            // each test counted once even if retaken. Type comes from the Test
            // Builder category / sub-category, falling back to the title.
            const typeOf = (a: any): 'mock' | 'sectional' | 'hw' | 'practice' | 'other' => {
              const cat = (a.test?.category ?? '').toLowerCase();
              const t = (a.test?.title ?? '').toLowerCase();
              if (isHW(a.test ?? {})) return 'hw';
              if (cat === 'mock' || (!cat && t.includes('mock'))) return 'mock';
              if (cat === 'sectional' || (!cat && t.includes('sectional'))) return 'sectional';
              if (cat === 'practice sheet' || (!cat && t.includes('practice'))) return 'practice';
              return 'other';
            };
            const subjOf = (a: any): 'rw' | 'math' | 'other' =>
              isMath(a.test ?? {}) ? 'math' : isEnglish(a.test ?? {}) ? 'rw' : subjectOf(a);
            const completed = (type: string, subj?: 'rw' | 'math') =>
              new Set(studentAttempts
                .filter((a: any) => typeOf(a) === type && (!subj || subjOf(a) === subj))
                .map((a: any) => a.testId ?? a.test?.id)).size;

            // Find the student's genuine diagnostic attempt specifically (NOT mock or practice tests)
            const diagAttempt = studentAttempts
              .filter((a: any) => {
                const cat = (a.test?.category ?? '').toLowerCase();
                const t = (a.test?.title ?? '').toLowerCase();
                return a.isDiagnostic === true || cat === 'diagnostic' || cat.includes('diagnostic') || t.includes('diagnostic');
              })
              .sort((a: any, b: any) =>
                new Date(b.submittedAt ?? b.completedAt ?? b.startedAt ?? 0).getTime() -
                new Date(a.submittedAt ?? a.completedAt ?? a.startedAt ?? 0).getTime()
              )[0];

            let scaledScoreTotal: number | null = null;
            let scaledScoreEnglish: number | null = null;
            let scaledScoreMath: number | null = null;

            if (diagAttempt) {
              try {
                const fullAttempt = (await api.getAttempt(diagAttempt.id)) as any;
                if (fullAttempt?.attempt) {
                  const analysis = computeTestAnalysis(fullAttempt.attempt);
                  if (analysis.finalScaledScore > 0) {
                    scaledScoreTotal = analysis.finalScaledScore;
                    scaledScoreEnglish = analysis.rwScaled || null;
                    scaledScoreMath = analysis.mathScaled || null;
                  }
                  diagnosticsEnglish = (analysis.rw1Correct || 0) + (analysis.rw2Correct || 0);
                  diagnosticsMath = (analysis.math1Correct || 0) + (analysis.math2Correct || 0);
                } else if (diagAttempt.totalScore != null) {
                  scaledScoreTotal = diagAttempt.totalScore;
                }
              } catch {
                if (diagAttempt.totalScore != null) {
                  scaledScoreTotal = diagAttempt.totalScore;
                }
              }
            }

            return {
              studentId: student.id,
              studentName: student.name,
              studentEmail: student.email,
              targetDate: student.targetDate || null,
              diagnosticsEnglish,
              diagnosticsMath,
              mockTests: completed('mock'),
              diagnosticCount: studentAttempts.filter((a: any) => (a.test?.title ?? '').toLowerCase().includes('diagnostic')).length,
              sectionalTests: completed('sectional'),
              hwCount: completed('hw'),
              hwRW: completed('hw', 'rw'),
              hwMath: completed('hw', 'math'),
              cwCount: studentAttempts.filter((a: any) => { const t = (a.test?.title ?? '').toLowerCase(); return t.includes('classwork') || t.includes('cw'); }).length,
              practiceSheets: completed('practice'),
              practiceRW: completed('practice', 'rw'),
              practiceMath: completed('practice', 'math'),
              totalAssessments: studentAttempts.length,
              lastTestName,
              lastSubmittedAt,
              scaledScoreTotal,
              scaledScoreEnglish,
              scaledScoreMath,
              rawScoreTotal,
              rawScoreEnglish,
              rawScoreMath,
              diagnosticDecision: student.diagnosticDecision || null,
              attempts: studentAttempts.slice(0, 10),
            };
          } catch {
            return {
              studentId: student.id,
              studentName: student.name,
              studentEmail: student.email,
              targetDate: student.targetDate || null,
              diagnosticsEnglish: null, diagnosticsMath: null,
              mockTests: 0, diagnosticCount: 0, sectionalTests: 0,
              hwCount: 0, hwRW: 0, hwMath: 0, cwCount: 0,
              practiceSheets: 0, practiceRW: 0, practiceMath: 0,
              totalAssessments: 0,
              lastTestName: null, lastSubmittedAt: null,
              scaledScoreTotal: null, scaledScoreEnglish: null, scaledScoreMath: null,
              rawScoreTotal: null, rawScoreEnglish: null, rawScoreMath: null,
              diagnosticDecision: student.diagnosticDecision || null,
              attempts: [],
            };
          }
        })
      );

      setStudentAnalysisData(allStudentData);
      try {
        sessionStorage.setItem(analysisCacheKey, JSON.stringify({ data: allStudentData, ts: Date.now() }));
      } catch {}
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Load comprehensive analysis when on analysis view and students are ready.
  // On back-navigation the component remounts with empty state — restore from
  // sessionStorage first (valid for 5 min) to avoid re-fetching everything.
  useEffect(() => {
    if (mainView !== 'analysis' || students.length === 0 || studentAnalysisData.length > 0) return;
    try {
      const cached = JSON.parse(sessionStorage.getItem(analysisCacheKey) ?? 'null');
      if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
        setStudentAnalysisData(cached.data);
        return;
      }
    } catch {}
    loadComprehensiveAnalysis();
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
      { name: 'John Doe', email: 'john@school.edu', grade: '11', targetScore: '1400', tutorId: '', phone: '555-0100', parentPhone: '555-0101', dob: '2008-03-15', schoolName: 'Lincoln High School' },
      { name: 'Jane Smith', email: 'jane@school.edu', grade: '10', targetScore: '1300', tutorId: '', phone: '555-0200', parentPhone: '555-0201', dob: '2009-07-22', schoolName: 'Washington Academy' },
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
          targetDate: addForm.targetDate || undefined,
          tutorIds: addForm.tutorIds,
          phone: addForm.phone || undefined,
          parentPhone: addForm.parentPhone || undefined,
          dob: addForm.dob || undefined,
          schoolName: addForm.schoolName || undefined,
          board: addForm.board || undefined,
          timezone: addForm.timezone || undefined,
          firstClassDate: addForm.firstClassDate || undefined,
          programVariant: addForm.programVariant || undefined,
          mockVariant: addForm.mockVariant || undefined,
          accommodation: addForm.accommodation,
          stage: addForm.stage ? Number(addForm.stage) : undefined,
          onboarded: addForm.onboarded,
          manualDiagTotal: addForm.manualDiagTotal ? Number(addForm.manualDiagTotal) : null,
          manualDiagRW: addForm.manualDiagRW ? Number(addForm.manualDiagRW) : null,
          manualDiagMath: addForm.manualDiagMath ? Number(addForm.manualDiagMath) : null,
        });
        setShowAddModal(false); setIsEditing(false); setEditingStudentId(null);
        setAddForm({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', targetDate: '', tutorIds: [], phone: '', parentPhone: '', dob: '', schoolName: '', board: '', timezone: 'Asia/Kolkata', firstClassDate: '', programVariant: '', mockVariant: '', accommodation: false, stage: '', onboarded: false, manualDiagTotal: '', manualDiagRW: '', manualDiagMath: '' });
        reload();
      } else {
        const res = await api.createUser({
          name: fullName, email: addForm.email, role: 'STUDENT',
          grade: addForm.grade || undefined,
          targetScore: addForm.targetScore ? Number(addForm.targetScore) : undefined,
          targetDate: addForm.targetDate || undefined,
          tutorIds: addForm.tutorIds.length > 0 ? addForm.tutorIds : (isTutor && dbId ? [dbId] : []),
          phone: addForm.phone || undefined,
          parentPhone: addForm.parentPhone || undefined,
          dob: addForm.dob || undefined,
          schoolName: addForm.schoolName || undefined,
          board: addForm.board || undefined,
          timezone: addForm.timezone || undefined,
          firstClassDate: addForm.firstClassDate || undefined,
          programVariant: addForm.programVariant || undefined,
          mockVariant: addForm.mockVariant || undefined,
          accommodation: addForm.accommodation,
          stage: addForm.stage ? Number(addForm.stage) : undefined,
          onboarded: addForm.onboarded,
          manualDiagTotal: addForm.manualDiagTotal ? Number(addForm.manualDiagTotal) : null,
          manualDiagRW: addForm.manualDiagRW ? Number(addForm.manualDiagRW) : null,
          manualDiagMath: addForm.manualDiagMath ? Number(addForm.manualDiagMath) : null,
        });
        setShowAddModal(false);
        setAddForm({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', targetDate: '', tutorIds: [], phone: '', parentPhone: '', dob: '', schoolName: '', board: '', timezone: 'Asia/Kolkata', firstClassDate: '', programVariant: '', mockVariant: '', accommodation: false, stage: '', onboarded: false, manualDiagTotal: '', manualDiagRW: '', manualDiagMath: '' });
        reload();
        if (res.tempPassword) setCreatedPassword({ name: fullName, email: addForm.email, password: res.tempPassword });
      }
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAddLoading(false);
    }
  };

  // Open the Add/Edit form pre-filled for an existing student.
  const startEditStudent = (student: DbUser) => {
    const parts = student.name.split(' ');
    setAddForm({
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email: student.email,
      grade: student.grade || '',
      targetScore: student.targetScore ? String(student.targetScore) : '',
      tutorIds: student.tutors?.length ? student.tutors.map((t) => t.id) : (student.tutorId ? [student.tutorId] : []),
      phone: student.phone || '',
      parentPhone: student.parentPhone || '',
      dob: student.dob || '',
      schoolName: student.schoolName || '',
      targetDate: student.targetDate || '',
      board: student.board || '',
      timezone: student.timezone || 'Asia/Kolkata',
      firstClassDate: student.firstClassDate || '',
      programVariant: student.programVariant || '',
      mockVariant: student.mockVariant || '',
      accommodation: student.accommodation ?? false,
      stage: student.stage != null ? String(student.stage) : '',
      onboarded: student.onboarded ?? false,
      manualDiagTotal: student.manualDiagTotal != null ? String(student.manualDiagTotal) : '',
      manualDiagRW: student.manualDiagRW != null ? String(student.manualDiagRW) : '',
      manualDiagMath: student.manualDiagMath != null ? String(student.manualDiagMath) : '',
    });
    setIsEditing(true);
    setEditingStudentId(student.id);
    setShowManageModal(false);
    setShowAddModal(true);
  };

  const handleDeleteStudent = async () => {
    if (!confirmDeleteStudent) return;
    setDeleteStudentLoading(true);
    try {
      await api.deleteUser(confirmDeleteStudent.id);
      setConfirmDeleteStudent(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to move to trash');
    } finally {
      setDeleteStudentLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordTarget) return;
    setResetPasswordLoading(true);
    try {
      const r = await api.resetUserPassword(resetPasswordTarget.id);
      setNewPasswordResult({ name: resetPasswordTarget.name, email: resetPasswordTarget.email, password: r.tempPassword });
      setResetPasswordTarget(null);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to reset password');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget) return;
    setRescheduleLoading(true);
    try {
      const newDueAt = localDateTimeToISO(rescheduleValue);
      const r = await api.rescheduleTestAssignment(rescheduleTarget.assignmentId, newDueAt);
      setReportRows((rows) => rows.map((row) =>
        row.assignmentId === rescheduleTarget.assignmentId ? { ...row, dueDate: r.assignment.dueAt } : row
      ));
      toast.success('Deadline updated');
      setRescheduleTarget(null);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update deadline');
    } finally {
      setRescheduleLoading(false);
    }
  };

  const handleUnassign = async () => {
    if (!unassignTarget) return;
    setUnassignLoading(true);
    try {
      await api.unassignTest(unassignTarget.assignmentId);
      setReportRows((rows) => rows.filter((row) => row.id !== unassignTarget.id));
      toast.success('Test unassigned');
      setUnassignTarget(null);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to unassign test');
    } finally {
      setUnassignLoading(false);
    }
  };

  const handleTableUpdateDecision = (studentId: string, value: 'keep' | 'leave') => {
    const currentDecision =
      studentAnalysisData.find(s => s.studentId === studentId)?.diagnosticDecision ??
      students.find(s => s.id === studentId)?.diagnosticDecision ??
      null;
    const isCurrentlySelected = currentDecision === value;
    const nextValue = isCurrentlySelected ? null : value;

    api.updateUser(studentId, { diagnosticDecision: nextValue })
      .then(({ user }) => {
        setStudentAnalysisData(prev =>
          prev.map(s =>
            s.studentId === studentId
              ? { ...s, diagnosticDecision: user.diagnosticDecision ?? null }
              : s
          )
        );
        setStudents(prev =>
          prev.map(s =>
            s.id === studentId
              ? { ...s, diagnosticDecision: user.diagnosticDecision ?? null }
              : s
          )
        );

        if (user.diagnosticDecision === 'keep') {
          toast.success(`Student marked Active`);
        } else if (user.diagnosticDecision === 'leave') {
          toast.success(`Student marked Inactive`);
        } else {
          toast.success(`Student status reset to Pending`);
        }
      })
      .catch((err) => {
        console.error('Failed to update student decision', err);
        toast.error('Failed to update student decision');
      });
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  // display variables cleaned up as student list was consolidated

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {mainView === 'analysis' && (
        <>
      {/* ── Stat chips + Header actions ── */}
      {(() => {
        const activeCount = students.filter(s => s.diagnosticDecision === 'keep').length;
        const inactiveCount = students.filter(s => s.diagnosticDecision === 'leave').length;
        const pendingCount = students.filter(s => !s.diagnosticDecision).length;
        return (
          <div className="flex flex-wrap items-center gap-2">
            {/* Total Students chip */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-sm">
              <span className="font-bold text-blue-600">
                {activityFilter === 'active' ? activeCount : activityFilter === 'inactive' ? inactiveCount : activityFilter === 'pending' ? pendingCount : students.length}
              </span>
              <span className="text-slate-600 font-medium">Total Students</span>
              <span className="text-blue-200 mx-0.5">|</span>
              <button
                onClick={() => setActivityFilter(f => f === 'active' ? 'all' : 'active')}
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${activityFilter === 'active' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
              >{activeCount} Active</button>
              <button
                onClick={() => setActivityFilter(f => f === 'inactive' ? 'all' : 'inactive')}
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${activityFilter === 'inactive' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}
              >{inactiveCount} Inactive</button>
              <button
                onClick={() => setActivityFilter(f => f === 'pending' ? 'all' : 'pending')}
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${activityFilter === 'pending' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
              >{pendingCount} Pending</button>
            </div>

            {/* With Tutors chip */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-sm">
              <span className="font-bold text-emerald-600">{students.filter(s => (s.tutors?.length ?? 0) > 0 || s.tutorId).length}</span>
              <span className="text-slate-600 font-medium">With Tutors</span>
            </div>

            {/* Action buttons */}
            <Button variant="secondary" size="sm" icon={<Upload size={13} />} onClick={() => setShowBulkModal(true)}>Bulk Upload</Button>
            <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={() => { setManageSearch(''); setShowManageModal(true); }}>Manage Students</Button>
          </div>
        );
      })()}

      {/* ── COMPREHENSIVE ANALYSIS VIEW ── */}
      <div className="space-y-5">


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
          <div className="overflow-auto max-h-[36rem]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-20">
                <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
                  <th className="px-4 py-2 text-left text-[15px] font-bold text-blue-950 whitespace-nowrap sticky left-0 bg-blue-50 bg-none z-30" rowSpan={2}>Name</th>
                  <th className="px-4 py-2 text-center text-[15px] font-bold text-blue-950 whitespace-nowrap border-l border-blue-200" colSpan={6}>Total Assessment</th>
                  <th className="px-4 py-2 text-center text-[15px] font-bold text-blue-950 whitespace-nowrap border-l border-blue-200" rowSpan={2}>Test Report</th>
                  <th className="px-4 py-2 text-center text-[15px] font-bold text-blue-950 whitespace-nowrap" rowSpan={2}>Performance</th>
                  <th className="px-4 py-2 text-center text-[15px] font-bold text-blue-950 whitespace-nowrap" rowSpan={2}>Actions</th>
                </tr>
                <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                  <th className="px-3 py-1.5 text-center text-[13px] font-semibold text-blue-800 whitespace-nowrap border-l border-blue-200">Mock</th>
                  <th className="px-3 py-1.5 text-center text-[13px] font-semibold text-blue-800 whitespace-nowrap">Sectional</th>
                  <th className="px-3 py-1.5 text-center text-[13px] font-semibold text-blue-800 whitespace-nowrap border-l border-blue-100">HW R&amp;W</th>
                  <th className="px-3 py-1.5 text-center text-[13px] font-semibold text-blue-800 whitespace-nowrap">HW Math</th>
                  <th className="px-3 py-1.5 text-center text-[13px] font-semibold text-blue-800 whitespace-nowrap border-l border-blue-100">Practice R&amp;W</th>
                  <th className="px-3 py-1.5 text-center text-[13px] font-semibold text-blue-800 whitespace-nowrap">Practice Math</th>
                </tr>
              </thead>
              <tbody>
                {analysisLoading ? (
                  <tr><td colSpan={10} className="py-8 text-center text-slate-400">Loading...</td></tr>
                ) : studentAnalysisData.length === 0 ? (
                  <tr><td colSpan={10} className="py-8 text-center text-slate-400">No students found</td></tr>
                ) : studentAnalysisData
                    .filter((s) => {
                       if (activityFilter !== 'all') {
                         const status = studentStatusFromDecision(s.diagnosticDecision);
                         if (status !== activityFilter) return false;
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
                      <tr key={row.studentId} className={`group/row border-b border-slate-100 hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                        <td className={`px-4 py-3 sticky left-0 transition-colors z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} group-hover/row:bg-blue-50`}>
                          <div className="flex items-center justify-between gap-3 min-w-[230px]">
                          <StudentNameHover
                            name={row.studentName}
                            targetDate={row.targetDate}
                            scores={diagScores(row)}
                          >
                          <button
                            type="button"
                            onClick={() => navigate(isTutor ? `/student/${row.studentId}` : `/students/${row.studentId}`)}
                            className="flex items-center gap-2 text-left group"
                            title="View student details"
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {row.studentName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-slate-900 text-sm group-hover:text-blue-700 group-hover:underline">{row.studentName}</p>
                              </div>
                            </div>
                          </button>
                          </StudentNameHover>
                          <StudentQuickIcons
                            studentId={row.studentId}
                            name={row.studentName}
                            email={row.studentEmail}
                            student={students.find((s) => s.id === row.studentId)}
                          />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-slate-600 border-l border-blue-100">
                          {row.mockTests || '—'}
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-slate-600">
                          {row.sectionalTests || '—'}
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-slate-600 border-l border-blue-100">
                          {row.hwRW || '—'}
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-slate-600">
                          {row.hwMath || '—'}
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-slate-600 border-l border-blue-100">
                          {row.practiceRW || '—'}
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-slate-600">
                          {row.practiceMath || '—'}
                        </td>
                        <td className="px-4 py-3 text-center border-l border-blue-100">
                          <button
                            onClick={() => {
                              setSelectedStudentId(row.studentId);
                              setSelectedAttemptId('');
                              setShowTimeGrid(false);
                              setReportFilter('all');
                              setMainView('test_analysis');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            View
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => navigate(`/analytics?studentId=${row.studentId}`)} className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
                            View
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => { setAssignStudentId(row.studentId); setAssignOpen(true); setAssignFilter('All'); setAssignSearch(''); setAssignSelectedTestIds([]); }}
                              className="px-2.5 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                            >
                              Assign
                            </button>
                            <button
                              onClick={() => {
                                setSelectedStudentId(row.studentId);
                                setSelectedAttemptId('');
                                setShowTimeGrid(false);
                                setReportFilter('all');
                                setReportViewMode('assigned');
                                setMainView('test_analysis');
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200 whitespace-nowrap flex items-center gap-1"
                              title="View assigned homework and tests"
                            >
                              <CalendarClock size={12} /> Assigned
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
          {/* Back navigation */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setMainView('analysis'); setSelectedStudentId(''); setSelectedAttemptId(''); setShowTimeGrid(false); }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              <ChevronLeft size={15} /> Back to Students
            </button>
            {selectedAttemptId && (
              <button
                onClick={() => { setSelectedAttemptId(''); setShowTimeGrid(false); }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                <ChevronLeft size={15} /> Back to Test Report
              </button>
            )}
          </div>

          {/* Content Pane */}
          {!selectedAttemptId ? (
            (() => {
              const studentName = students.find((s) => s.id === selectedStudentId)?.name ?? 'Student';
              const downloadReport = () => {
                const head = ['#', 'Test Name', 'Started At', 'Completed At', 'RW1', 'RW2', 'M1', 'M2', 'Total', 'RW SS', 'Math SS', 'Total SS', 'Analysis'];
                // Each test can cover different modules with different question counts, so
                // show each cell's own "correct/total" rather than a shared column denominator
                // — and "—" (not 0) for a module this particular test doesn't cover.
                const lines = reportRows.map((r, i) => r.isPending ? [
                  i + 1, r.title,
                  '', r.dueDate ? `Due ${formatDate(r.dueDate)}` : '',
                  '—', '—', '—', '—', '—', '-', '-', '-',
                  r.pendingStatus ?? 'Not Started',
                ] : [
                  i + 1, r.title,
                  r.startedAt ? formatDateTime(r.startedAt) : '',
                  r.completedAt ? formatDateTime(r.completedAt) : '',
                  r.rwM1T > 0 ? `${r.rwM1}/${r.rwM1T}` : '—',
                  r.rwM2T > 0 ? `${r.rwM2}/${r.rwM2T}` : '—',
                  r.mathM1T > 0 ? `${r.mathM1}/${r.mathM1T}` : '—',
                  r.mathM2T > 0 ? `${r.mathM2}/${r.mathM2T}` : '—',
                  r.totalRawT > 0 ? `${r.totalRaw}/${r.totalRawT}` : '—',
                  (r.isMockTest && r.rwM1T + r.rwM2T > 0) ? r.rwSS : '-',
                  (r.isMockTest && r.mathM1T + r.mathM2T > 0) ? r.mathSS : '-',
                  (r.isMockTest && r.rwM1T + r.rwM2T > 0 && r.mathM1T + r.mathM2T > 0) ? r.totalSS : '-',
                  r.isAnalysed ? 'Analysed' : 'Unanalysed',
                ]);
                const csv = [head, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = `${studentName.replace(/\s+/g, '_')}_Test_Report.csv`;
                link.click();
                URL.revokeObjectURL(url);
              };
              // Match on the category/subCategory the Test Builder actually tags tests
              // with (category "Practice Sheet", subCategory "{Subject}-{AssignmentType}"
              // e.g. "Math-Homework") rather than sniffing the free-text title, so a
              // Practice Sheet correctly lands in its subject's HW/Practice filter even if
              // the title itself doesn't happen to mention the subject. Title-sniffing is
              // kept only as a fallback for tests with no category set at all.
              const filterMatches = (row: { title: string; category?: string }, f: typeof reportFilter) => {
                if (f === 'all') return true;
                const cat = (row.category ?? '').trim();
                const t = row.title.toLowerCase();
                if (f === 'mock') return cat ? cat === 'Mock' : t.includes('mock');
                if (f === 'diagnostic') return cat ? cat === 'Diagnostic' : t.includes('diagnostic');
                const isPracticeSheet = cat
                  ? cat === 'Practice Sheet'
                  : (isHW(row) || t.includes('practice'));
                if (!isPracticeSheet) return false;
                const subj = practiceSubjectOf(row);
                const hw = isHW(row);
                if (f === 'hw_math') return hw && subj === 'math';
                if (f === 'hw_reading') return hw && subj === 'reading';
                if (f === 'hw_writing') return hw && subj === 'writing';
                if (f === 'practice_math') return !hw && subj === 'math';
                if (f === 'practice_reading') return !hw && subj === 'reading';
                if (f === 'practice_writing') return !hw && subj === 'writing';
                return false;
              };
              const filterLabels: { key: typeof reportFilter; label: string }[] = [
                { key: 'all', label: 'All' },
                { key: 'mock', label: 'Mock' },
                { key: 'diagnostic', label: 'Diag' },
                { key: 'hw_math', label: 'Math HW' },
                { key: 'hw_reading', label: 'Reading HW' },
                { key: 'hw_writing', label: 'Writing HW' },
                { key: 'practice_math', label: 'Math Practice' },
                { key: 'practice_reading', label: 'Reading Prac' },
                { key: 'practice_writing', label: 'Writing Practice' },
              ];
              const viewRows = reportRows.filter(r => reportViewMode === 'assigned' ? !!r.isPending : !r.isPending);
              const completedCount = reportRows.filter(r => !r.isPending).length;
              const assignedCount = reportRows.filter(r => !!r.isPending).length;
              const filteredRows = viewRows.filter(r => filterMatches(r, reportFilter));

              const formatProgressDate = (iso: string | null) => {
                if (!iso) return '—';
                const d = new Date(iso);
                if (isNaN(d.getTime())) return '—';
                const day = d.getDate();
                const month = d.toLocaleString('en-US', { month: 'short' });
                const year = d.toLocaleString('en-US', { year: '2-digit' });
                const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                return `${day} ${month}, ${year}, ${time}`;
              };

              return (
                <Card padding="none">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-4 flex-wrap">
                      <h2 className="text-lg font-bold text-blue-900">Assessment Summary</h2>
                      {/* Completed / Assigned toggle — governs which rows the filter tabs and table below draw from. */}
                      <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                        {(['completed', 'assigned'] as const).map((mode) => {
                          const active = reportViewMode === mode;
                          const count = mode === 'completed' ? completedCount : assignedCount;
                          return (
                            <button
                              key={mode}
                              onClick={() => { setReportViewMode(mode); setReportFilter('all'); }}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                              {mode === 'completed' ? 'Completed' : 'Assigned'}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-start">
                      <select
                        value={selectedAttemptId}
                        onChange={e => { setSelectedAttemptId(e.target.value); setShowTimeGrid(false); }}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[220px] max-w-[300px]"
                      >
                        <option value="">Search attempt…</option>
                        {studentAttempts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.test.title} — {a.completedAt ? formatDate(a.completedAt) : formatDate(a.startedAt)}
                          </option>
                        ))}
                      </select>
                      <button onClick={downloadReport} disabled={reportRows.length === 0}
                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap">
                        Download Report
                      </button>
                    </div>
                  </div>
                  {/* Filter tabs */}
                  <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100 flex-wrap">
                    {filterLabels.map(({ key, label }) => {
                      const count = key === 'all' ? viewRows.length : viewRows.filter(r => filterMatches(r, key)).length;
                      const active = reportFilter === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setReportFilter(key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${active ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          {label}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-blue-500 text-white' : 'bg-slate-300 text-slate-600'}`}>{count}</span>
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
                    <p className="py-12 text-center text-slate-400 text-sm">
                      {viewRows.length === 0
                        ? (reportViewMode === 'assigned' ? 'Nothing currently assigned and outstanding.' : 'No completed tests yet.')
                        : `No ${filterLabels.find(f => f.key === reportFilter)?.label} tests found.`}
                    </p>
                  ) : reportViewMode === 'assigned' ? (
                    // Assigned view: none of the score columns apply to a test that hasn't
                    // been attempted yet, so this gets its own, simpler set of headings
                    // instead of borrowing the Completed table's score columns.
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-l-4 border-l-blue-600 border border-slate-200">
                        <thead>
                          <tr className="bg-gradient-to-r from-blue-50 to-blue-100/40 border-b-2 border-blue-100 text-blue-800">
                            <th className="px-4 py-3.5 text-left font-bold whitespace-nowrap border-r border-slate-200">#</th>
                            <th className="px-4 py-3.5 text-left font-bold whitespace-nowrap border-r border-slate-200">Test Name</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">Due Date</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">Status</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((r, i) => {
                            const statusStyle = r.pendingStatus === 'In Progress' ? 'bg-blue-100 text-blue-700'
                              : r.pendingStatus === 'Expired' ? 'bg-red-100 text-red-600'
                              : 'bg-amber-100 text-amber-700';
                            return (
                              <tr key={r.id} className={`border-b border-slate-200 ${i % 2 === 1 ? 'bg-slate-50/70' : ''}`}>
                                <td className="px-4 py-4 text-slate-500 whitespace-nowrap border-r border-slate-100">{i + 1}</td>
                                <td className="px-4 py-4 font-semibold text-slate-700 whitespace-nowrap border-r border-slate-100">
                                  <button
                                    onClick={() => navigate(`/test-instructions/${r.testId}?preview=true`)}
                                    className="text-left font-semibold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1.5 group"
                                    title="Open / Preview this test"
                                  >
                                    <span>{r.title}</span>
                                    <Eye size={13} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                </td>
                                <td className="px-4 py-4 text-center text-xs text-slate-500 whitespace-nowrap border-r border-slate-100">
                                  {r.dueDate ? formatDate(r.dueDate) : 'No due date'}
                                </td>
                                <td className="px-4 py-4 text-center whitespace-nowrap border-r border-slate-100">
                                  <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${statusStyle}`}>
                                    {(r.pendingStatus ?? 'Not Started').toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => navigate(`/test-instructions/${r.testId}?preview=true`)}
                                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                                      title="Open and preview test questions"
                                    >
                                      <Eye size={12} /> Open
                                    </button>
                                    {r.submittedAttemptId && (
                                      <button
                                        onClick={() => navigate(`/test-review/${r.submittedAttemptId}`)}
                                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                                        title="Review student attempt"
                                      >
                                        Review
                                      </button>
                                    )}
                                    {r.assignmentId && (
                                      <>
                                        <button
                                          onClick={() => { setRescheduleTarget({ assignmentId: r.assignmentId!, title: r.title }); setRescheduleValue(isoToLocalDateTimeInput(r.dueDate)); }}
                                          className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                                          title="Change deadline"
                                        >
                                          <CalendarClock size={12} /> Reschedule
                                        </button>
                                        <button
                                          onClick={() => setUnassignTarget({ id: r.id, assignmentId: r.assignmentId!, title: r.title })}
                                          className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                                          title="Unassign this test"
                                        >
                                          <UserMinus size={12} /> Unassign
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-l-4 border-l-blue-600 border border-slate-200">
                        <thead>
                          <tr className="bg-gradient-to-r from-blue-50 to-blue-100/40 border-b-2 border-blue-100 text-blue-800">
                            <th className="px-4 py-3.5 text-left font-bold whitespace-nowrap border-r border-slate-200">#</th>
                            <th className="px-4 py-3.5 text-left font-bold whitespace-nowrap border-r border-slate-200">Test Name</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">Started At</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">Completed At</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">RW1</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">RW2</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">M1</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">M2</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">Total</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">RW SS</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">Math SS</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap border-r border-slate-200">Total SS</th>
                            <th className="px-4 py-3.5 text-center font-bold whitespace-nowrap">Analysis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((r, i) => {
                            const analysed = r.isAnalysed;
                            return (
                              <tr key={r.id} onClick={() => { setSelectedAttemptId(r.id); setShowTimeGrid(false); }}
                                className={`border-b border-slate-200 hover:bg-blue-50/60 cursor-pointer transition-colors ${i % 2 === 1 ? 'bg-slate-50/70' : ''}`}>
                                <td className="px-4 py-4 text-slate-500 whitespace-nowrap border-r border-slate-100">{i + 1}</td>
                                <td className="px-4 py-4 font-semibold text-blue-700 hover:underline whitespace-nowrap border-r border-slate-100">{r.title}</td>
                                <td className="px-4 py-4 text-center text-xs text-slate-500 whitespace-nowrap border-r border-slate-100">{formatProgressDate(r.startedAt)}</td>
                                <td className="px-4 py-4 text-center text-xs text-slate-500 whitespace-nowrap border-r border-slate-100">{formatProgressDate(r.completedAt)}</td>
                                {/* A module not covered by this test (e.g. Math1/Math2 on an
                                    RW-only Sectional) has total=0 — show "—", not a fake 0/0. */}
                                <td className="px-4 py-4 text-center text-blue-700 font-medium whitespace-nowrap border-r border-slate-100">{r.rwM1T > 0 ? `${r.rwM1}/${r.rwM1T}` : '—'}</td>
                                <td className="px-4 py-4 text-center text-blue-700 font-medium whitespace-nowrap border-r border-slate-100">{r.rwM2T > 0 ? `${r.rwM2}/${r.rwM2T}` : '—'}</td>
                                <td className="px-4 py-4 text-center text-blue-700 font-medium whitespace-nowrap border-r border-slate-100">{r.mathM1T > 0 ? `${r.mathM1}/${r.mathM1T}` : '—'}</td>
                                <td className="px-4 py-4 text-center text-blue-700 font-medium whitespace-nowrap border-r border-slate-100">{r.mathM2T > 0 ? `${r.mathM2}/${r.mathM2T}` : '—'}</td>
                                <td className="px-4 py-4 text-center font-bold text-slate-900 whitespace-nowrap border-r border-slate-100">{r.totalRawT > 0 ? `${r.totalRaw}/${r.totalRawT}` : '—'}</td>
                                <td className="px-4 py-4 text-center text-slate-600 whitespace-nowrap border-r border-slate-100">{(r.isMockTest && r.rwM1T + r.rwM2T > 0) ? r.rwSS : '—'}</td>
                                <td className="px-4 py-4 text-center text-slate-600 whitespace-nowrap border-r border-slate-100">{(r.isMockTest && r.mathM1T + r.mathM2T > 0) ? r.mathSS : '—'}</td>
                                <td className="px-4 py-4 text-center font-semibold text-slate-800 whitespace-nowrap border-r border-slate-100">{(r.isMockTest && r.rwM1T + r.rwM2T > 0 && r.mathM1T + r.mathM2T > 0) ? r.totalSS : '—'}</td>
                                <td className="px-4 py-4 text-center whitespace-nowrap">
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
          ) : (
            <AttemptAnalysis attemptId={selectedAttemptId} />
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Board</label>
                  <select value={addForm.board} onChange={(e) => setAddForm(f => ({ ...f, board: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">—</option>
                    {['CBSE', 'ICSE', 'IB', 'IGCSE', 'State Board', 'Other'].map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Timezone</label>
                  <input value={addForm.timezone} onChange={(e) => setAddForm(f => ({ ...f, timezone: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Asia/Kolkata" />
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Grade</label>
                <select value={addForm.grade} onChange={(e) => setAddForm(f => ({ ...f, grade: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">—</option>
                  {['9', '10', '11', '12'].map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Target Score</label>
                <input type="number" min={1} max={1600} value={addForm.targetScore} onChange={(e) => setAddForm(f => ({ ...f, targetScore: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 1400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assign Tutor(s)</label>
                <TutorMultiSelect
                  options={tutors.map((t) => ({ id: t.id, name: t.name }))}
                  value={addForm.tutorIds}
                  onChange={(ids) => setAddForm(f => ({ ...f, tutorIds: ids }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Target Test Date</label>
                <input type="date" value={addForm.targetDate} onChange={(e) => setAddForm(f => ({ ...f, targetDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Program & Enrollment */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              <Boxes size={12} /> Program &amp; Enrollment
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Program Variant</label>
                <select value={addForm.programVariant} onChange={(e) => setAddForm(f => ({ ...f, programVariant: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">—</option>
                  {['Flagship', 'Premium', 'Standard', 'Self-Paced'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mock Variant</label>
                <select value={addForm.mockVariant} onChange={(e) => setAddForm(f => ({ ...f, mockVariant: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">—</option>
                  {['Full Mocks', 'Sectional Mocks', 'No Mocks'].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">First Class Started On</label>
                <input type="date" value={addForm.firstClassDate} onChange={(e) => setAddForm(f => ({ ...f, firstClassDate: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Stage</label>
                <select value={addForm.stage} onChange={(e) => setAddForm(f => ({ ...f, stage: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">—</option>
                  {['1', '2', '3', '4', '5', '6'].map((s) => <option key={s} value={s}>Stage {s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Accommodation</label>
                <select value={addForm.accommodation ? 'yes' : 'no'} onChange={(e) => setAddForm(f => ({ ...f, accommodation: e.target.value === 'yes' }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={addForm.onboarded} onChange={(e) => setAddForm(f => ({ ...f, onboarded: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600" />
                  <span className="text-sm text-slate-700">Onboarded</span>
                </label>
              </div>
            </div>
          </div>

          {/* Manual Diagnostic Score */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              <TrendingUp size={12} /> Diagnostic Score (Manual)
            </div>
            <p className="text-[11px] text-slate-400 mb-2">For students who took a diagnostic elsewhere — scores will appear in the analysis table.</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Total (400–1600)</label>
                <input type="number" min={400} max={1600} step={10} value={addForm.manualDiagTotal}
                  onChange={(e) => setAddForm(f => ({ ...f, manualDiagTotal: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 1200" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">RW (200–800)</label>
                <input type="number" min={200} max={800} step={10} value={addForm.manualDiagRW}
                  onChange={(e) => setAddForm(f => ({ ...f, manualDiagRW: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Math (200–800)</label>
                <input type="number" min={200} max={800} step={10} value={addForm.manualDiagMath}
                  onChange={(e) => setAddForm(f => ({ ...f, manualDiagMath: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 600" />
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

      {/* ── Manage Students Modal (edit / delete) ── */}
      <Modal isOpen={showManageModal} onClose={() => { setShowManageModal(false); setManageSearch(''); }} title="Manage Students" size="md">
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by name or email…"
              value={manageSearch}
              onChange={(e) => setManageSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button size="sm" variant="secondary" icon={<Trash size={13} />} onClick={() => setShowTrashModal(true)}>Trash</Button>
            <Button
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => {
                setIsEditing(false);
                setEditingStudentId(null);
                setAddForm({ firstName: '', lastName: '', email: '', grade: '', targetScore: '', targetDate: '', tutorIds: [], phone: '', parentPhone: '', dob: '', schoolName: '', board: '', timezone: 'Asia/Kolkata', firstClassDate: '', programVariant: '', mockVariant: '', accommodation: false, stage: '', onboarded: false, manualDiagTotal: '', manualDiagRW: '', manualDiagMath: '' });
                setShowManageModal(false);
                setShowAddModal(true);
              }}
            >
              Add Student
            </Button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
            {students.filter((s) =>
              manageSearch
                ? s.name.toLowerCase().includes(manageSearch.toLowerCase()) || s.email.toLowerCase().includes(manageSearch.toLowerCase())
                : true
            ).length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">No students found</p>
            ) : (
              students
                .filter((s) =>
                  manageSearch
                    ? s.name.toLowerCase().includes(manageSearch.toLowerCase()) || s.email.toLowerCase().includes(manageSearch.toLowerCase())
                    : true
                )
                .map((student) => (
                  <div key={student.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-sm truncate">{student.name}</p>
                    </div>
                    <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/50 flex-shrink-0">
                      <button
                        onClick={() => handleTableUpdateDecision(student.id, 'keep')}
                        className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all ${
                          student.diagnosticDecision === 'keep'
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                        }`}
                        title="Mark student Active (kept after diagnostic)"
                      >
                        Active
                      </button>
                      <button
                        onClick={() => handleTableUpdateDecision(student.id, 'leave')}
                        className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all ${
                          student.diagnosticDecision === 'leave'
                            ? 'bg-rose-500 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                        }`}
                        title="Mark student Inactive (left / not kept)"
                      >
                        Inactive
                      </button>
                    </div>
                    <button
                      onClick={() => startEditStudent(student)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setResetPasswordTarget(student)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Reset Password"
                    >
                      <KeyRound size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteStudent(student)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal — moves to Trash, not a permanent delete. */}
      <Modal isOpen={!!confirmDeleteStudent} onClose={() => setConfirmDeleteStudent(null)} title="Move Student to Trash" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteStudent(null)}>Cancel</Button>
            <Button size="sm" onClick={handleDeleteStudent} disabled={deleteStudentLoading}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600">
              {deleteStudentLoading ? 'Moving…' : 'Move to Trash'}
            </Button>
          </div>
        }>
        {confirmDeleteStudent && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{confirmDeleteStudent.name}</span> will be moved to Trash and hidden from
              active lists. Nothing is erased — you can restore them or delete them permanently from the Trash at any time.
            </p>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm flex-shrink-0">
                {confirmDeleteStudent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-red-900">{confirmDeleteStudent.name}</p>
                <p className="text-xs text-red-600">{confirmDeleteStudent.email}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <TrashModal isOpen={showTrashModal} onClose={() => setShowTrashModal(false)} role="STUDENT" entityLabel="Student" onChanged={reload} />

      {/* ── Temp Password Modal — backdrop click disabled so a stray click can't lose
           a password that's never shown again (it's never stored in plaintext). ── */}
      <Modal isOpen={!!createdPassword} onClose={() => { setCreatedPassword(null); setCopiedPassword(false); }} title="Student Created" size="sm"
        closeOnBackdrop={false}
        footer={<Button size="sm" onClick={() => { setCreatedPassword(null); setCopiedPassword(false); }}>Done, I've saved this</Button>}>
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
              <p className="text-xs text-slate-500 mt-2">
                Copy this now — it won't be shown again. If it's lost, use "Reset Password" on this student later to generate a new one.
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Reset Password confirm ── */}
      <Modal isOpen={!!resetPasswordTarget} onClose={() => setResetPasswordTarget(null)} title="Reset Password" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setResetPasswordTarget(null)}>Cancel</Button>
            <Button size="sm" onClick={handleResetPassword} disabled={resetPasswordLoading}>
              {resetPasswordLoading ? 'Generating…' : 'Generate New Password'}
            </Button>
          </div>
        }>
        {resetPasswordTarget && (
          <p className="text-sm text-slate-600">
            This immediately replaces <span className="font-semibold text-slate-900">{resetPasswordTarget.name}</span>'s current
            password with a new one-time password — their old password stops working right away.
          </p>
        )}
      </Modal>

      {/* ── New Password result — same "can't lose it" treatment as the creation popup ── */}
      <Modal isOpen={!!newPasswordResult} onClose={() => { setNewPasswordResult(null); setCopiedPassword(false); }} title="New Password Generated" size="sm"
        closeOnBackdrop={false}
        footer={<Button size="sm" onClick={() => { setNewPasswordResult(null); setCopiedPassword(false); }}>Done, I've saved this</Button>}>
        {newPasswordResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-900">{newPasswordResult.name}</p>
                <p className="text-xs text-emerald-700 truncate">{newPasswordResult.email}</p>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                <KeyRound size={12} /> New Temporary Password
              </div>
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <code className="flex-1 text-base font-mono font-bold text-amber-900 tracking-widest select-all">{newPasswordResult.password}</code>
                <button onClick={() => { navigator.clipboard.writeText(newPasswordResult.password); setCopiedPassword(true); setTimeout(() => setCopiedPassword(false), 2000); }}
                  className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors flex-shrink-0" title="Copy password">
                  {copiedPassword ? <CheckCircle size={15} className="text-emerald-600" /> : <Copy size={15} />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">Copy this now — it won't be shown again. Share it with the student.</p>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Reschedule assignment ── */}
      <Modal isOpen={!!rescheduleTarget} onClose={() => setRescheduleTarget(null)} title="Change Deadline" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRescheduleTarget(null)}>Cancel</Button>
            <Button size="sm" onClick={handleReschedule} disabled={rescheduleLoading}>
              {rescheduleLoading ? 'Saving…' : 'Save Deadline'}
            </Button>
          </div>
        }>
        {rescheduleTarget && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">New due date for <span className="font-semibold text-slate-900">{rescheduleTarget.title}</span>:</p>
            <input type="datetime-local" value={rescheduleValue} onChange={(e) => setRescheduleValue(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-slate-400">Leave blank to remove the deadline entirely.</p>
          </div>
        )}
      </Modal>

      {/* ── Unassign confirm ── */}
      <Modal isOpen={!!unassignTarget} onClose={() => setUnassignTarget(null)} title="Unassign Test" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setUnassignTarget(null)}>Cancel</Button>
            <Button size="sm" onClick={handleUnassign} disabled={unassignLoading}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600">
              {unassignLoading ? 'Removing…' : 'Unassign'}
            </Button>
          </div>
        }>
        {unassignTarget && (
          <p className="text-sm text-slate-600">
            Remove <span className="font-semibold text-slate-900">{unassignTarget.title}</span> from this student's assigned tests?
            They'll no longer see it as pending. This doesn't affect any test they've already completed.
          </p>
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

      {/* ── Assign Test Modal ── */}
      {(() => {
        const assignStudent = students.find((s) => s.id === assignStudentId);
        const categories = ['All', ...Array.from(new Set(publishedTests.map((t) => t.category ?? 'Other')))];
        const filtered = publishedTests
          .filter((t) => assignFilter === 'All' || (t.category ?? 'Other') === assignFilter)
          .filter((t) => {
            if (assignFilter !== 'Practice Sheet' || assignSubFilter === 'All') return true;
            if (assignSubFilter === 'HW') return isHW(t);
            if (assignSubFilter === 'English') return isEnglish(t);
            if (assignSubFilter === 'Maths') return isMath(t);
            return true;
          })
          .filter((t) => !assignSearch.trim() || t.title.toLowerCase().includes(assignSearch.trim().toLowerCase()));
        return (
          <Modal
            isOpen={assignOpen}
            onClose={() => { setAssignOpen(false); setAssignStudentId(null); setAssignSelectedTestIds([]); setAssignSelectedPackageIds([]); setAssignMode('tests'); setAssignFilter('All'); setAssignSubFilter('All'); setAssignSearch(''); }}
            title="Assign Tests"
            size="md"
            footer={
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" size="sm" onClick={() => { setAssignOpen(false); setAssignStudentId(null); setAssignSelectedTestIds([]); setAssignSelectedPackageIds([]); setAssignMode('tests'); setAssignFilter('All'); setAssignSubFilter('All'); setAssignSearch(''); }}>Cancel</Button>
                <Button
                  size="sm"
                  icon={assignMode === 'packages' ? <Boxes size={13} /> : <BookOpen size={13} />}
                  disabled={(assignMode === 'tests' ? assignSelectedTestIds.length === 0 : assignSelectedPackageIds.length === 0) || assignLoading}
                  onClick={async () => {
                    if (!assignStudentId) return;
                    setAssignLoading(true);
                    try {
                      if (assignMode === 'packages') {
                        if (assignSelectedPackageIds.length === 0) return;
                        const results = await Promise.all(
                          assignSelectedPackageIds.map((packageId) =>
                            api.assignTestPackage(packageId, { studentIds: [assignStudentId] })
                          )
                        );
                        const totalTests = results.reduce((a, r) => a + (r.tests ?? 0), 0);
                        toast.success(
                          assignSelectedPackageIds.length > 1
                            ? `${assignSelectedPackageIds.length} packages (${totalTests} tests) assigned`
                            : `Package assigned (${totalTests} test${totalTests !== 1 ? 's' : ''})`
                        );
                      } else {
                        if (assignSelectedTestIds.length === 0) return;
                        await Promise.all(
                          assignSelectedTestIds.map((testId) =>
                            api.createTestAssignments({ testId, studentIds: [assignStudentId] })
                          )
                        );
                        const titles = assignSelectedTestIds
                          .map((id) => publishedTests.find((t) => t.id === id)?.title)
                          .filter((t): t is string => Boolean(t));

                        if (isTutor && dbId && titles.length > 0) {
                          try {
                            const today = new Date().toISOString().split('T')[0];
                            const { entries: existing } = await api.getClassProgress(dbId, assignStudentId);
                            const todayEntry = existing.find((e) => e.classDate === today);
                            if (todayEntry) {
                              const existingLines = toLines(todayEntry.homework);
                              const combined = Array.from(new Set([...existingLines, ...titles])).join('\n');
                              await api.updateClassProgress(dbId, assignStudentId, todayEntry.id, { homework: combined });
                            } else {
                              await api.addClassProgress(dbId, assignStudentId, {
                                topic: 'Homework Assigned',
                                homework: titles.join('\n'),
                                classDate: today,
                                author: user?.name ?? 'Tutor',
                                status: 'Completed',
                                subject: 'Other',
                              });
                            }
                          } catch (e) {
                            console.error('Failed to log homework progress:', e);
                          }
                        }

                        toast.success(
                          titles.length > 1
                            ? `${titles.length} tests assigned successfully`
                            : `"${titles[0]}" assigned successfully`
                        );
                      }
                      setAssignOpen(false);
                      setAssignStudentId(null);
                      setAssignSelectedTestIds([]);
                      setAssignSelectedPackageIds([]);
                      setAssignMode('tests');
                      setAssignFilter('All');
                      setAssignSubFilter('All');
                      setAssignSearch('');
                    } catch {
                      toast.error(assignMode === 'packages' ? 'Failed to assign package' : 'Failed to assign tests');
                    } finally {
                      setAssignLoading(false);
                    }
                  }}
                >
                  {assignLoading ? 'Assigning…' : 'Assign'}
                </Button>
              </div>
            }
          >
            <div className="space-y-3">
              {/* Tests | Packages toggle */}
              <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
                <button
                  onClick={() => setAssignMode('tests')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${assignMode === 'tests' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <BookOpen size={13} /> Tests
                </button>
                <button
                  onClick={() => setAssignMode('packages')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${assignMode === 'packages' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Boxes size={13} /> Packages <span className="text-[10px] text-slate-400">({packages.length})</span>
                </button>
              </div>

              <p className="text-sm text-slate-500">
                {assignMode === 'packages' ? (
                  <>Select one or more packages to assign to <strong>{assignStudent?.name ?? '…'}</strong>. Every test in each package is assigned.</>
                ) : (
                  <>Select one or more published tests to assign to <strong>{assignStudent?.name ?? '…'}</strong>.</>
                )}
              </p>

              {assignMode === 'packages' ? (
                packages.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">No packages yet. Create one from Test Builder → Packages.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {packages.map((pkg) => {
                      const isSel = assignSelectedPackageIds.includes(pkg.id);
                      const testCount = pkg.items.length;
                      return (
                        <label
                          key={pkg.id}
                          className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${isSel ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={(e) => {
                              if (e.target.checked) setAssignSelectedPackageIds((prev) => [...prev, pkg.id]);
                              else setAssignSelectedPackageIds((prev) => prev.filter((id) => id !== pkg.id));
                            }}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate flex items-center gap-1.5"><Boxes size={13} className="text-indigo-500 flex-shrink-0" /> {pkg.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{testCount} test{testCount !== 1 ? 's' : ''}{pkg.description ? ` · ${pkg.description}` : ''}</p>
                          </div>
                          {isSel && <CheckCircle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />}
                        </label>
                      );
                    })}
                  </div>
                )
              ) : (
              publishedTests.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">No published tests available.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setAssignFilter(cat); setAssignSubFilter('All'); }}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                          assignFilter === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                        <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${assignFilter === cat ? 'bg-blue-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
                          {cat === 'All' ? publishedTests.length : publishedTests.filter((t) => (t.category ?? 'Other') === cat).length}
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
                    onChange={(e) => { setAssignSearch(e.target.value); }}
                    placeholder="Search tests by name…"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center">No tests found.</p>
                    ) : filtered.map((test) => {
                      const isSelected = assignSelectedTestIds.includes(test.id);
                      return (
                        <label
                          key={test.id}
                          className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignSelectedTestIds((prev) => [...prev, test.id]);
                              } else {
                                setAssignSelectedTestIds((prev) => prev.filter((id) => id !== test.id));
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
              )
              )}
            </div>
          </Modal>
        );
      })()}

      <Toaster position="top-right" />

    </div>
  );
}
