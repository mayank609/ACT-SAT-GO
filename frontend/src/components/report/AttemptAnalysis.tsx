import { useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useUrlFlag } from '../../lib/urlState';
import { CheckCircle, Loader2, ChevronLeft, ChevronRight, XCircle, Maximize2, X, ChevronDown, ChevronUp, Info, Bookmark } from 'lucide-react';
import { Badge } from '../common/Badge';
import { Card } from '../common/Card';
import { Modal } from '../common/Modal';
import { RichContentRenderer } from '../admin/RichContentRenderer';
import { OptionRenderer } from '../admin/OptionRenderer';
import { ExplanationDoubtBar } from '../admin/ExplanationDoubtBar';
import { QuestionVisitTimes } from './QuestionVisitTimes';
import { AttemptTimeAnalyticsGrid } from '../dashboard/AttemptTimeAnalyticsGrid';
import { type QuestionTimeStat } from '../dashboard/QuestionTimeChart';
import { api } from '../../lib/api';
import { satSectionScore } from '../../lib/analyticsData';
import { SAT_CONTENT, ALL_DOMAIN_NAMES } from '../../data/satDomains';
import { formatNumericDisplay, numericEqual } from '../../lib/numericAnswer';

// ── Test Analysis types ──────────────────────────────────────────────────────

export interface TaAnswer {
  key?: string;
  keys?: string[];
  value?: number;
  values?: number[];
  text?: string;
  displayValues?: string[];
}

export interface TaQuestion {
  id: string;
  type: string;
  content: { text: string; explanation?: string | null; meta?: { domain?: string | null; subTopic?: string | null; isPassage?: boolean } | null };
  options: Record<string, string> | null;
  correctAnswer: TaAnswer;
  difficultyLevel: string;
  subject?: string | null;
  topic?: { name: string; parent?: { name: string } | null } | null;
  childQuestions?: TaQuestion[];
}

export interface TaTestQuestion {
  id: string;
  questionId: string;
  orderIndex: number;
  question: TaQuestion;
}

export interface TaSectionAttempt {
  id: string;
  sectionId: string;
  startedAt: string;
  completedAt: string | null;
  section: {
    id: string;
    name: string;
    orderIndex: number;
    questions: TaTestQuestion[];
  };
}

export interface TaAttemptAnswer {
  id: string;
  questionId: string;
  answerGiven: TaAnswer | null;
  timeSpentSeconds: number;
  isFlagged: boolean;
  doubtStatus: 'doubt' | 'cleared' | null;
}

export interface TaAttempt {
  id: string;
  testId: string;
  status: string;
  totalScore: number | null;
  startedAt: string;
  completedAt: string | null;
  test: { id: string; title: string; category?: string; subCategory?: string };
  sectionAttempts: TaSectionAttempt[];
  answers: TaAttemptAnswer[];
}

function taAnswersMatch(given: TaAnswer | null, correct: TaAnswer): boolean {
  if (!given || !correct) return false;
  if (correct.value !== undefined) {
    if (Array.isArray(correct.values) && correct.values.length > 0) {
      return correct.values.some((v) => numericEqual(given.value, v));
    }
    return numericEqual(given.value, correct.value);
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

// ── Knowledge & Skills helpers ───────────────────────────────────────────────

const KS_DOMAINS = SAT_CONTENT;

const KS_DOMAIN_SYNONYMS: Record<string, string[]> = {
  'Information and Ideas': ['information and ideas', 'information', 'main idea', 'central idea', 'inference', 'evidence', 'command of evidence'],
  'Craft and Structure': ['craft and structure', 'craft', 'structure', 'vocabulary', 'words in context', 'text structure', 'cross-text'],
  'Expression of Ideas': ['expression of ideas', 'expression', 'rhetoric', 'rhetorical', 'transitions', 'synthesis'],
  'Standard English Conventions': ['standard english conventions', 'conventions', 'grammar', 'usage', 'punctuation', 'sentence structure', 'english'],
  'Algebra': ['algebra', 'linear'],
  'Advanced Math': ['advanced math', 'advanced', 'nonlinear', 'quadratic', 'function', 'exponential'],
  'Problem-Solving and Data Analysis': ['problem-solving and data analysis', 'problem solving', 'data analysis', 'data interpretation', 'statistics', 'ratio', 'rates', 'percent', 'probability', 'proportion'],
  'Geometry': ['geometry and trigonometry', 'geometry', 'trigonometry', 'trig'],
};

function ksDomainCandidates(q: TaQuestion): string[] {
  return [q.content?.meta?.domain, q.topic?.name, q.topic?.parent?.name, q.subject].filter(Boolean) as string[];
}

function ksMatchDomain(q: TaQuestion): string | null {
  const cands = ksDomainCandidates(q).map((c) => c.trim().toLowerCase());
  if (!cands.length) return null;
  const direct = ALL_DOMAIN_NAMES.find((d) => cands.includes(d.toLowerCase()));
  if (direct) return direct;
  for (const [domain, syns] of Object.entries(KS_DOMAIN_SYNONYMS)) {
    for (const c of cands) {
      if (syns.some((s) => c === s || c.includes(s) || s.includes(c))) return domain;
    }
  }
  return null;
}

function mergeQuestionMeta(cqMeta: any, qMeta: any) {
  return {
    domain: cqMeta?.domain || qMeta?.domain || null,
    subTopic: cqMeta?.subTopic || qMeta?.subTopic || null,
    skill: cqMeta?.skill || qMeta?.skill || null,
    isPassage: cqMeta?.isPassage || qMeta?.isPassage || null,
  };
}

function taOptionsToDisplay(options: Record<string, string> | null): Array<{ id: string; text: string }> {
  if (!options) return [];
  return Object.entries(options).map(([k, v]) => ({ id: k.toLowerCase(), text: v }));
}

function taAnswerToDisplay(ans: TaAnswer | null): string | string[] | number | null {
  if (!ans) return null;
  if (ans.value !== undefined) return ans.text ?? ans.displayValues?.[0] ?? formatNumericDisplay(ans.value);
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

export function computeTestAnalysis(attempt: TaAttempt): {
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

  // Derive subject from test title/category as a fallback when section name is generic.
  // Test Builder tags homework tests via subCategory "{Subject}-Homework" (e.g.
  // "Reading-Homework") — titles like "R-4 Command of Evidence" don't spell out
  // "reading" anywhere, so subCategory must be checked too or these silently
  // fall through unclassified (correct/total never added to any RW/Math bucket).
  const testTitle = (attempt.test.title ?? '').toLowerCase();
  const testCat   = (attempt.test.category ?? '').toLowerCase();
  const testSub   = (attempt.test.subCategory ?? '').toLowerCase();
  const testIsMath = /\bmhw\b|math[\s-]hw|math\s*homework|\bmath\b|algebra|geometry|calc/.test(testTitle) || /math/i.test(testCat) || testSub.includes('math') || testSub.includes('quant');
  const testIsRW   = /\brhw\b|reading[\s-]hw|writing[\s-]hw|english[\s-]hw|\breading\b|\bwriting\b|\benglish\b|verbal|grammar|\brw\b/.test(testTitle) || /rw|english/i.test(testCat) || testSub.includes('rw') || testSub.includes('english') || testSub.includes('reading') || testSub.includes('writing');

  let totalCorrect = 0, totalQuestions = 0;
  let rwCorrect = 0, rwTotal = 0, mathCorrect = 0, mathTotal = 0;
  // Module breakdown — assigned by position within each subject group (orderIndex order),
  // not by "1"/"2" in section names, so any naming convention works.
  let mathGroupIdx = 0, rwGroupIdx = 0;
  let rw1Correct = 0, rw1Total = 0, rw2Correct = 0, rw2Total = 0;
  let math1Correct = 0, math1Total = 0, math2Correct = 0, math2Total = 0;

  const sections: SectionAnalysis[] = sortedSections.map(sa => {
    const flatQs: TaTestQuestion[] = [];
    const addedIds = new Set<string>();
    sa.section.questions.forEach(tq => {
      const q = tq.question;
      const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
      if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
        q.childQuestions.forEach(cq => {
          if (!addedIds.has(cq.id)) {
            addedIds.add(cq.id);
            flatQs.push({
              id: cq.id,
              questionId: cq.id,
              orderIndex: tq.orderIndex,
              question: {
                ...cq,
                content: {
                  ...cq.content,
                  explanation: cq.content?.explanation || q.content?.explanation || (q as any)?.explanation || undefined,
                }
              }
            });
          }
        });
      } else {
        const parent = (q as any).parentQuestion;
        if (!addedIds.has(q.id)) {
          addedIds.add(q.id);
          if (parent) {
            flatQs.push({
              id: q.id,
              questionId: q.id,
              orderIndex: tq.orderIndex,
              question: {
                ...q,
                subject: q.subject || parent.subject,
                topic: q.topic || parent.topic,
                content: {
                  ...q.content,
                  meta: mergeQuestionMeta(q.content?.meta, parent.content?.meta) as any
                }
              } as any
            });
          } else {
            flatQs.push(tq);
          }
        }
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

    // Time on this module = sum of its questions' time (the same numbers Time
    // Analytics uses). Section start/end stamps are not per-module, so they are
    // only a fallback for old attempts with no per-question time.
    let timeTaken = '—';
    let sectionSecs = flatQs.reduce((sum, tq) => sum + (answersMap.get(tq.questionId)?.timeSpentSeconds ?? 0), 0);
    if (sectionSecs <= 0 && sa.startedAt && sa.completedAt) {
      sectionSecs = (new Date(sa.completedAt).getTime() - new Date(sa.startedAt).getTime()) / 1000;
    }
    if (sectionSecs > 0) {
      const whole = Math.round(sectionSecs);
      timeTaken = `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, '0')} Minutes Taken`;
    }

    // Classify by section name first; fall back to test title when section name is generic
    const sectionIsMath = /math/i.test(sa.section.name);
    const sectionIsRW   = /reading|writing|rw|english/i.test(sa.section.name);
    const isMath = sectionIsMath || (!sectionIsRW && testIsMath);
    const isRW   = sectionIsRW   || (!sectionIsMath && testIsRW);
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

    return { name: sa.section.name, category, correct, incorrect, omitted, total, unvisited, accuracy, timeTaken, bookmarked };
  });

  const isSAT = rwTotal > 0 || mathTotal > 0;

  // rwScaled/mathScaled stay 0 (never a real scaled value, which floors at 200) when that
  // subject has no sections in this test — e.g. a Math-only Sectional test — so callers can
  // tell "not applicable" apart from a genuine low score.
  let finalScaledScore = totalCorrect;
  let rwScaled = 0;
  let mathScaled = 0;
  if (rwTotal > 0) rwScaled = satSectionScore(rw1Correct, rw2Correct, rw1Total + rw2Total, false);
  if (mathTotal > 0) mathScaled = satSectionScore(math1Correct, math2Correct, math1Total + math2Total, true);
  if (isSAT) finalScaledScore = rwScaled + mathScaled;

  return {
    sections, totalCorrect, totalQuestions, rwCorrect, rwTotal, mathCorrect, mathTotal,
    isSAT, finalScaledScore, rwScaled, mathScaled,
    rw1Correct, rw1Total, rw2Correct, rw2Total,
    math1Correct, math1Total, math2Correct, math2Total,
  };
}

// Build a student-portal-style label, e.g. "Section 1, Module 1: Reading and Writing".
export function getSectionModuleLabel(name: string): string {
  const isMath = /math/i.test(name);
  const isRW = /reading|writing|rw|english/i.test(name);
  if (!isMath && !isRW) return name;
  const isModule2 = /2|two/i.test(name);
  const moduleNum = isModule2 ? 2 : 1;
  const sectionNum = isMath ? 2 : 1;
  const subjectName = isMath ? 'Math' : 'Reading and Writing';
  return `Section ${sectionNum}, Module ${moduleNum}: ${subjectName}`;
}

/** Short tab label for a module: "RW Module 1", "Math Module 2". */
export function getSectionTabLabel(name: string): string {
  const isMath = /math/i.test(name);
  const isRW = /reading|writing|rw|english/i.test(name);
  if (!isMath && !isRW) return name;
  return `${isMath ? 'Math' : 'RW'} Module ${/2|two/i.test(name) ? 2 : 1}`;
}


/**
 * The single-attempt test analysis (Score Card, Knowledge and Skills, Section
 * Overview, Question Wise Report with Time Analytics, navigator and fullscreen
 * review). One component for every portal, so admin, tutor and student see the
 * same screen; the server decides whose attempts each account may open.
 */
export function AttemptAnalysis({ attemptId, header, footer }: {
  attemptId: string;
  /** Rendered above the score card once the attempt has loaded. */
  header?: (attempt: TaAttempt) => ReactNode;
  footer?: ReactNode;
}) {
  const [testAnalysisLoading, setTestAnalysisLoading] = useState(true);
  const [testAnalysisAttempt, setTestAnalysisAttempt] = useState<TaAttempt | null>(null);

  // Still Doubt / Cleared saved from the Question Wise Report: reflect it locally
  // so the filters and badges update without reloading the attempt.
  const handleDoubtChange = (questionId: string, status: 'doubt' | 'cleared' | null) => {
    setTestAnalysisAttempt((prev) => {
      if (!prev) return prev;
      const exists = prev.answers.some((a) => a.questionId === questionId);
      const answers = exists
        ? prev.answers.map((a) => (a.questionId === questionId ? { ...a, doubtStatus: status } : a))
        : [...prev.answers, { id: `local-${questionId}`, questionId, answerGiven: null, timeSpentSeconds: 0, isFlagged: false, doubtStatus: status }];
      return { ...prev, answers };
    });
  };

  // ── Question Wise Report state ───────────────────────────────────────────
  const [activeQuestionSectionIdx, setActiveQuestionSectionIdx] = useState(0);
  const [questionFilterBy, setQuestionFilterBy] = useState('all');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [fullscreenQuestionReportOpen, setFullscreenQuestionReportOpen] = useState(false);
  // Lock page scroll while the fullscreen question-wise review is open so the
  // page behind it can never peek through below the overlay.
  useEffect(() => {
    if (!fullscreenQuestionReportOpen) return;
    const { overflow: bodyOverflow } = document.body.style;
    const { overflow: htmlOverflow } = document.documentElement.style;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, [fullscreenQuestionReportOpen]);
  const [knowledgeSkillsOpen, setKnowledgeSkillsOpen] = useState(false);
  // Question Wise Report: true shows "View Time Analytics" (all modules' charts) instead of a module's questions.
  const [showTimeGrid, setShowTimeGrid] = useUrlFlag('timegrid');
  const [showQuestionNavigator, setShowQuestionNavigator] = useState(false);
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  // Show Answer applies to one question only: moving to another question,
  // module, filter or attempt hides the answer again.
  useEffect(() => { setShowAnswerFeedback(false); }, [currentQuestionIdx, activeQuestionSectionIdx, questionFilterBy, attemptId, fullscreenQuestionReportOpen]);

  useEffect(() => {
    let cancelled = false;
    setTestAnalysisLoading(true);
    setActiveQuestionSectionIdx(0);
    setQuestionFilterBy('all');
    setCurrentQuestionIdx(0);
    api.getAttempt(attemptId)
      .then((r) => { if (!cancelled) setTestAnalysisAttempt(r.attempt as TaAttempt); })
      .catch(() => { if (!cancelled) setTestAnalysisAttempt(null); })
      .finally(() => { if (!cancelled) setTestAnalysisLoading(false); });
    return () => { cancelled = true; };
  }, [attemptId]);

  return (
    <>
      <div className="space-y-5">
      {testAnalysisAttempt && !testAnalysisLoading && header?.(testAnalysisAttempt)}
          {testAnalysisLoading ? (
            <Card padding="lg">
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 size={24} className="animate-spin text-blue-500" />
                <span className="text-sm font-medium">Loading test analysis...</span>
              </div>
            </Card>
          ) : testAnalysisAttempt ? (() => {
            const analysis = computeTestAnalysis(testAnalysisAttempt);
            // Scaled score applies to Diagnostic/Mock/Sectional — only Practice Sheet shows a raw count.
            const isPracticeSheet = ['Practice Sheet'].includes(testAnalysisAttempt.test.category ?? '') || /practice\s*sheet/i.test(testAnalysisAttempt.test.title ?? '');
            const showScaled = analysis.isSAT && !isPracticeSheet;

            // Sectional tests only have sections for one subject — rwTotal/mathTotal is 0
            // for the one they don't cover, so hide that box instead of showing a fake 0.
            const showRW = analysis.rwTotal > 0;
            const showMath = analysis.mathTotal > 0;
            return (
              <div className="space-y-4">
                {/* ── Score Card ── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-stretch divide-x divide-slate-200">
                    {/* Total Score — slightly larger */}
                    <div className="px-8 py-6 shrink-0 text-center bg-gradient-to-br from-[#1b3d6e] to-[#2563eb] rounded-tl-xl rounded-bl-xl flex flex-col justify-center">
                      <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Total Score</p>
                      <p className="text-6xl font-black text-white leading-none tabular-nums mt-1.5">
                        {showScaled ? (showRW && showMath ? analysis.finalScaledScore : (showRW ? analysis.rwScaled : analysis.mathScaled)) : analysis.totalCorrect}
                      </p>
                      {showScaled ? (
                        <p className="text-xs text-blue-300 mt-2.5 border-b border-blue-400/40 pb-0.5 w-fit mx-auto">
                          {showRW && showMath ? '400 – 1600' : '200 – 800'}
                        </p>
                      ) : (
                        <p className="text-xs text-blue-300 mt-2">out of {analysis.totalQuestions}</p>
                      )}
                    </div>
                    {/* Reading & Writing — fixed width */}
                    {showRW && (
                    <div className="w-36 py-6 shrink-0 text-center flex flex-col justify-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">Reading &amp; Writing</p>
                      <p className="text-5xl font-black text-blue-900 leading-none tabular-nums mt-2">
                        {showScaled ? analysis.rwScaled : `${analysis.rwCorrect}/${analysis.rwTotal}`}
                      </p>
                      {showScaled ? (
                        <p className="text-xs text-slate-400 mt-2 border-b border-slate-200 pb-0.5 w-fit mx-auto">200 – 800</p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-2">out of {analysis.rwTotal}</p>
                      )}
                    </div>
                    )}
                    {/* Math — same fixed width as R&W */}
                    {showMath && (
                    <div className="w-36 py-6 shrink-0 text-center flex flex-col justify-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">Math</p>
                      <p className="text-5xl font-black text-blue-900 leading-none tabular-nums mt-2">
                        {showScaled ? analysis.mathScaled : `${analysis.mathCorrect}/${analysis.mathTotal}`}
                      </p>
                      {showScaled ? (
                        <p className="text-xs text-slate-400 mt-2 border-b border-slate-200 pb-0.5 w-fit mx-auto">200 – 800</p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-2">out of {analysis.mathTotal}</p>
                      )}
                    </div>
                    )}
                    {/* Score Range Bar — Mock/Diagnostic SAT only */}
                    {(showScaled && showRW && showMath) && (() => {
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
                              <p className="text-[10px] text-slate-400">(1200 - 1600)</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* ── Knowledge and Skills ── */}
                {analysis.isSAT && (() => {
                  const answersMap = new Map(testAnalysisAttempt.answers.map((a) => [a.questionId, a]));
                  const domainStats: Record<string, { correct: number; total: number; diff: Record<string, number> }> = {};
                  ALL_DOMAIN_NAMES.forEach((n) => { domainStats[n] = { correct: 0, total: 0, diff: {} }; });

                  testAnalysisAttempt.sectionAttempts.forEach((sa) => {
                    const flattenedQuestions: TaQuestion[] = [];
                    const addedIds = new Set<string>();

                    sa.section.questions.forEach((tq) => {
                      const q = tq.question;
                      const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
                      if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
                        q.childQuestions.forEach((cq) => {
                          if (!addedIds.has(cq.id)) {
                            addedIds.add(cq.id);
                            flattenedQuestions.push({
                              ...cq,
                              subject: cq.subject || q.subject,
                              topic: cq.topic || q.topic,
                              content: {
                                ...cq.content,
                                meta: mergeQuestionMeta(cq.content?.meta, q.content?.meta) as any
                              }
                            });
                          }
                        });
                      } else {
                        const parent = (q as any).parentQuestion;
                        if (!addedIds.has(q.id)) {
                          addedIds.add(q.id);
                          if (parent) {
                            flattenedQuestions.push({
                              ...q,
                              subject: q.subject || parent.subject,
                              topic: q.topic || parent.topic,
                              content: {
                                ...q.content,
                                meta: mergeQuestionMeta(q.content?.meta, parent.content?.meta) as any
                              }
                            });
                          } else {
                            flattenedQuestions.push(q);
                          }
                        }
                      }
                    });

                    flattenedQuestions.forEach((cq) => {
                      const domain = ksMatchDomain(cq);
                      const ans = answersMap.get(cq.id);
                      const correct = !!ans?.answerGiven && taAnswersMatch(ans.answerGiven, cq.correctAnswer);
                      if (domain && domainStats[domain]) {
                        domainStats[domain].total++;
                        if (correct) domainStats[domain].correct++;
                        domainStats[domain].diff[cq.difficultyLevel] = (domainStats[domain].diff[cq.difficultyLevel] ?? 0) + 1;
                      }
                    });
                  });

                  const activeGroups = Object.keys(KS_DOMAINS) as Array<keyof typeof KS_DOMAINS>;

                  return (
                    <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <button
                        onClick={() => setKnowledgeSkillsOpen(!knowledgeSkillsOpen)}
                        className="w-full text-left flex items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900">Knowledge and Skills</h4>
                          <span className="flex items-center gap-1 text-blue-600 text-xs font-semibold"><Info size={13} /> New!</span>
                        </div>
                        <div className="text-slate-500">
                          {knowledgeSkillsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </button>

                      {knowledgeSkillsOpen && (
                        <div className={`grid grid-cols-1 ${activeGroups.length > 1 ? 'lg:grid-cols-2' : ''} gap-10 px-5 pb-5 pt-4 border-t border-slate-100`}>
                          {activeGroups.map((group) => (
                            <div key={group}>
                              <h5 className="text-sm font-bold text-slate-800 mb-4">{group}</h5>
                              <div className="space-y-4">
                                {KS_DOMAINS[group].map((d) => {
                                  const stat = domainStats[d.name] ?? { correct: 0, total: 0, diff: {} };
                                  // Every domain shows the same number of blocks (R&W and Math match),
                                  // filled proportionally to accuracy and colored by performance band.
                                  const SEGMENTS = 16;
                                  const accuracy = stat.total > 0 ? stat.correct / stat.total : 0;
                                  const filled = stat.total > 0 ? Math.round(accuracy * SEGMENTS) : 0;
                                  const barColor = stat.total === 0 ? 'bg-slate-300'
                                    : accuracy >= 0.8 ? 'bg-emerald-500'
                                    : accuracy >= 0.5 ? 'bg-amber-400'
                                    : 'bg-red-400';
                                  return (
                                    <div key={d.name}>
                                      <div className="flex items-center justify-between">
                                        <p className="font-bold text-slate-900 text-xs">{d.name}</p>
                                        {stat.total > 0 && (
                                          <span className={`text-[11px] font-bold ${
                                            accuracy >= 0.8 ? 'text-emerald-600' : accuracy >= 0.5 ? 'text-amber-600' : 'text-red-500'
                                          }`}>{Math.round(accuracy * 100)}%</span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-400 mb-2">({d.pct}% of test section, {d.range} questions)</p>
                                      <div className="flex gap-0.5">
                                        {Array.from({ length: SEGMENTS }).map((_, i) => (
                                          <div key={i} className={`h-2 flex-1 rounded-[2px] ${i < filled ? barColor : 'bg-slate-200'}`} />
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

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
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            <span className="text-slate-500 font-semibold">{sec.bookmarked} Bookmarked</span>
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
                            setShowTimeGrid(false);
                            setQuestionFilterBy('all');
                            setCurrentQuestionIdx(0);
                          }}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                            activeQuestionSectionIdx === idx && !showTimeGrid
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {getSectionTabLabel(sa.name)}
                        </button>
                      ))}
                      <button
                        onClick={() => { setQuestionFilterBy(questionFilterBy === 'doubt' ? 'all' : 'doubt'); setCurrentQuestionIdx(0); }}
                        disabled={showTimeGrid}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                          showTimeGrid
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : questionFilterBy === 'doubt'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        Still Doubt
                      </button>
                      <button
                        onClick={() => { setQuestionFilterBy(questionFilterBy === 'cleared' ? 'all' : 'cleared'); setCurrentQuestionIdx(0); }}
                        disabled={showTimeGrid}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                          showTimeGrid
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : questionFilterBy === 'cleared'
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        Cleared
                      </button>
                      <button
                        onClick={() => setShowTimeGrid(true)}
                        className="px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm bg-amber-400 text-slate-900 hover:bg-amber-300"
                      >
                        View Time Analytics
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
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
                        <option value="flagged">Bookmarked</option>
                      </select>
                    </div>
                  </div>

                  {/* Question display */}
                  {showTimeGrid ? (() => {
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
                        return { name: sa.section.name, sectionId: sa.section.id as string, stats };
                      });
                    return (
                      <AttemptTimeAnalyticsGrid
                        attemptId={testAnalysisAttempt.id}
                        modules={sectionStats.map((sec: any) => ({ sectionId: sec.sectionId, title: getSectionModuleLabel(sec.name), stats: sec.stats }))}
                        onQuestionClick={(sectionId, qi) => {
                          const name = sectionStats.find((sec: any) => sec.sectionId === sectionId)?.name;
                          const idx = analysis.sections.findIndex((sa) => sa.name === name);
                          if (idx < 0) return;
                          setActiveQuestionSectionIdx(idx);
                          setQuestionFilterBy('all');
                          setCurrentQuestionIdx(qi);
                          setShowTimeGrid(false);
                        }}
                      />
                    );
                  })() : (() => {
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
                        return q.childQuestions.map((cq) => ({
                          ...tq,
                          id: cq.id,
                          questionId: cq.id,
                          question: {
                            ...cq,
                            subject: cq.subject || q.subject,
                            topic: cq.topic || q.topic,
                            content: {
                              ...cq.content,
                              meta: mergeQuestionMeta(cq.content?.meta, q.content?.meta) as any
                            }
                          } as any,
                          parentPassageText: q.content?.text
                        }));
                      }
                      const parent = (q as any).parentQuestion;
                      if (parent) {
                        return [{
                          ...tq,
                          id: q.id,
                          questionId: q.id,
                          question: {
                            ...q,
                            subject: q.subject || parent.subject,
                            topic: q.topic || parent.topic,
                            content: {
                              ...q.content,
                              meta: mergeQuestionMeta(q.content?.meta, parent.content?.meta) as any
                            }
                          } as any,
                          parentPassageText: parent.content?.text
                        }];
                      }
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
                      if (questionFilterBy === 'flagged') return ans?.isFlagged;
                      if (questionFilterBy === 'doubt') return ans?.doubtStatus === 'doubt';
                      if (questionFilterBy === 'cleared') return ans?.doubtStatus === 'cleared';
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
                    const explText = (currentTq.question.content?.explanation || (currentTq as any).parentPassageExplanation || (currentTq.question as any)?.parentQuestion?.content?.explanation) as string | null | undefined;

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
                                  <div className="flex-1" />
                                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                    {testAnalysisAttempt && (
                                      <QuestionVisitTimes attemptId={testAnalysisAttempt.id} questionId={currentTq.questionId} fallbackSeconds={studentAnswer?.timeSpentSeconds ?? 0} />
                                    )}
                                    {correct ? (
                                      <Badge variant="info" className="bg-blue-600 text-white border-none font-semibold">Correct</Badge>
                                    ) : skipped ? (
                                      <Badge variant="info" className="bg-blue-50 text-blue-600 border-none font-semibold">Skip</Badge>
                                    ) : (
                                      <Badge variant="info" className="bg-blue-200 text-blue-900 border-none font-semibold">Wrong</Badge>
                                    )}
                                    {studentAnswer?.isFlagged && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-md bg-amber-100 text-amber-700 border border-amber-200"><Bookmark size={10} fill="currentColor" /> Bookmarked</span>
                                    )}
                                    {studentAnswer?.doubtStatus === 'doubt' && (
                                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-md bg-amber-400 text-white">Still Doubt</span>
                                    )}
                                    {studentAnswer?.doubtStatus === 'cleared' && (
                                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-md bg-green-500 text-white">Cleared</span>
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-2 flex-1 overflow-y-auto">
                                  {/* Question text sits below the header, not inside it (same as Math) */}
                                  <div className="text-sm text-slate-800 leading-relaxed text-left font-medium mb-3">
                                    <RichContentRenderer content={currentTq.question.content.text || `Question`} variant="question" className="prose-sm" />
                                  </div>
                                  <div className="flex justify-start mb-2">
                                    <button onClick={() => setShowAnswerFeedback(v => !v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${showAnswerFeedback ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                                      {showAnswerFeedback ? 'Hide Answer' : 'Show Answer'}
                                    </button>
                                  </div>
                                  {options.length > 0 && currentTq.question.type !== 'NUMERIC' && (
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
                                            showFeedback={showAnswerFeedback}
                                            colorTheme="blue"
                                          />
                                        );
                                      })}
                                    </div>
                                  )}
                                  {currentTq.question.type === 'NUMERIC' && (
                                    <div className="flex gap-4 text-sm">
                                      <span className="text-slate-500">Your answer: <strong className={!showAnswerFeedback ? 'text-slate-900' : correct ? 'text-blue-600' : 'text-blue-400'}>{studentAnswer?.answerGiven?.text ?? (studentAnswer?.answerGiven?.value !== undefined ? formatNumericDisplay(studentAnswer.answerGiven.value) : null) ?? '—'}</strong></span>
                                      {showAnswerFeedback && (<span className="text-slate-500">Correct: <strong className="text-blue-600">{(currentTq.question.correctAnswer.displayValues && currentTq.question.correctAnswer.displayValues.length > 0 ? currentTq.question.correctAnswer.displayValues.join(' or ') : (currentTq.question.correctAnswer.value !== undefined ? formatNumericDisplay(currentTq.question.correctAnswer.value) : ''))}</strong></span>)}
                                    </div>
                                  )}
                                  {/* Explanation dropdown + Still Doubt / Cleared */}
                                  {testAnalysisAttempt && (
                                    <ExplanationDoubtBar
                                      attemptId={testAnalysisAttempt.id}
                                      questionId={currentTq.questionId}
                                      explanation={explText}
                                      doubtStatus={studentAnswer?.doubtStatus ?? null}
                                      onDoubtChange={handleDoubtChange}
                                    />
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
                                <div className="flex-1" />
                                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                  {testAnalysisAttempt && (
                                    <QuestionVisitTimes attemptId={testAnalysisAttempt.id} questionId={currentTq.questionId} fallbackSeconds={studentAnswer?.timeSpentSeconds ?? 0} />
                                  )}
                                  {correct ? (
                                    <Badge variant="info" className="bg-blue-600 text-white border-none font-semibold">Correct</Badge>
                                  ) : skipped ? (
                                    <Badge variant="info" className="bg-blue-50 text-blue-600 border-none font-semibold">Skip</Badge>
                                  ) : (
                                    <Badge variant="info" className="bg-blue-200 text-blue-900 border-none font-semibold">Wrong</Badge>
                                  )}
                                  {studentAnswer?.isFlagged && (
                                    <Badge variant="info" className="bg-amber-100 text-amber-700 border border-amber-200 font-semibold flex items-center gap-1"><Bookmark size={10} fill="currentColor" /> Bookmarked</Badge>
                                  )}
                                  {studentAnswer?.doubtStatus === 'doubt' && (
                                    <Badge variant="info" className="bg-amber-100 text-amber-700 border-none font-semibold">Still Doubt</Badge>
                                  )}
                                  {studentAnswer?.doubtStatus === 'cleared' && (
                                    <Badge variant="info" className="bg-green-100 text-green-700 border-none font-semibold">Cleared</Badge>
                                  )}
                                </div>
                              </div>

                              <div className="px-4 py-3 border-t border-slate-100">
                                {/* Question text sits below the header, not inside it */}
                                <div className="text-sm text-slate-800 leading-relaxed text-left font-medium mb-3">
                                  <RichContentRenderer content={currentTq.question.content.text || `Question`} variant="question" className="prose-sm" />
                                </div>
                                <div className="flex justify-start mb-2">
                                  <button onClick={() => setShowAnswerFeedback(v => !v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${showAnswerFeedback ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                                    {showAnswerFeedback ? 'Hide Answer' : 'Show Answer'}
                                  </button>
                                </div>
                                {options.length > 0 && currentTq.question.type !== 'NUMERIC' && (
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
                                          showFeedback={showAnswerFeedback}
                                          colorTheme="blue"
                                        />
                                      );
                                    })}
                                  </div>
                                )}
                                {currentTq.question.type === 'NUMERIC' && (
                                  <div className="flex gap-4 text-sm mb-3 text-left">
                                    <span className="text-slate-500">Your answer: <strong className={!showAnswerFeedback ? 'text-slate-900' : correct ? 'text-blue-600' : 'text-blue-400'}>{studentAnswer?.answerGiven?.text ?? (studentAnswer?.answerGiven?.value !== undefined ? formatNumericDisplay(studentAnswer.answerGiven.value) : null) ?? '—'}</strong></span>
                                    {showAnswerFeedback && (<span className="text-slate-500">Correct: <strong className="text-blue-600">{(currentTq.question.correctAnswer.displayValues && currentTq.question.correctAnswer.displayValues.length > 0 ? currentTq.question.correctAnswer.displayValues.join(' or ') : (currentTq.question.correctAnswer.value !== undefined ? formatNumericDisplay(currentTq.question.correctAnswer.value) : ''))}</strong></span>)}
                                  </div>
                                )}
                                {/* Explanation dropdown + Still Doubt / Cleared */}
                                {testAnalysisAttempt && (
                                  <ExplanationDoubtBar
                                    attemptId={testAnalysisAttempt.id}
                                    questionId={currentTq.questionId}
                                    explanation={explText}
                                    doubtStatus={studentAnswer?.doubtStatus ?? null}
                                    onDoubtChange={handleDoubtChange}
                                  />
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
      {footer}
      </div>

      {/* ── Question Navigator Modal ── */}
      {showQuestionNavigator && (() => {
        const analysis = computeTestAnalysis(testAnalysisAttempt!);
        const navSection = testAnalysisAttempt!.sectionAttempts.find(
          (sa) => sa.section.name === analysis.sections[activeQuestionSectionIdx]?.name
        );
        if (!navSection) return null;
        const navAnswersMap = new Map(testAnalysisAttempt!.answers.map((a) => [a.questionId, a]));
        const navAllQ = navSection.section.questions.flatMap((tq) => {
          const q = tq.question;
          const isP = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
          if (isP && q.childQuestions?.length) return q.childQuestions.map((cq) => ({ ...tq, id: cq.id, questionId: cq.id, question: cq }));
          return [tq];
        });
        const navFiltered = navAllQ.filter((tq) => {
          const ans = navAnswersMap.get(tq.questionId);
          const isCorrect = ans?.answerGiven ? taAnswersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
          const isOmitted = !ans?.answerGiven;
          if (questionFilterBy === 'correct') return isCorrect;
          if (questionFilterBy === 'incorrect') return ans?.answerGiven && !isCorrect;
          if (questionFilterBy === 'omitted') return isOmitted;
          if (questionFilterBy === 'flagged') return ans?.isFlagged;
          return true;
        });
        const navSafeIdx = Math.min(currentQuestionIdx, Math.max(navFiltered.length - 1, 0));
        const currentTq = navFiltered[navSafeIdx];

        return (
          <Modal isOpen={showQuestionNavigator} onClose={() => setShowQuestionNavigator(false)} title="" size="md">
            <div className="space-y-5 p-1">
              {/* Title */}
              <div className="text-center pb-3 border-b border-slate-100 relative">
                <h3 className="text-base font-bold text-slate-800 tracking-tight pr-6 pl-6">{getSectionModuleLabel(analysis.sections[activeQuestionSectionIdx]?.name ?? '')}</h3>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5 tracking-wide">Questions</p>
                <button
                  onClick={() => setShowQuestionNavigator(false)}
                  className="absolute right-0 top-0 p-1 rounded-lg text-slate-400 hover:bg-slate-50 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Status Legend */}
              <div className="flex items-center justify-center gap-5 px-4 py-2.5 bg-[#f8fafc] rounded-xl border border-slate-100/50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1]" />
                  <span className="text-xs font-semibold text-slate-500">Unanswered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  <span className="text-xs font-semibold text-slate-500">Correct</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                  <span className="text-xs font-semibold text-slate-500">Wrong</span>
                </div>
              </div>

              {/* Question Grid */}
              <div className="flex justify-center max-h-[50vh] overflow-y-auto">
                <div className="grid grid-cols-9 gap-3 p-1.5 justify-center justify-items-center">
                  {navAllQ.map((fq, idx) => {
                    const ans = navAnswersMap.get(fq.questionId);
                    const isCorrect = ans?.answerGiven ? taAnswersMatch(ans.answerGiven, fq.question.correctAnswer) : false;
                    const isOmitted = !ans?.answerGiven;
                    const isCurrent = currentTq && fq.questionId === currentTq.questionId;
                    const globalNum = idx + 1;

                    let bgColor = 'bg-slate-100';
                    let textColor = 'text-slate-700';

                    if (isCurrent) {
                      bgColor = 'bg-blue-600';
                      textColor = 'text-white';
                    } else if (isCorrect) {
                      bgColor = 'bg-emerald-100';
                      textColor = 'text-emerald-800';
                    } else if (!isOmitted) {
                      bgColor = 'bg-red-100';
                      textColor = 'text-red-800';
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          const idxInFiltered = navFiltered.findIndex((q) => q.questionId === fq.questionId);
                          if (idxInFiltered !== -1) {
                            setCurrentQuestionIdx(idxInFiltered);
                          } else {
                            setQuestionFilterBy('all');
                            const idxInActive = navAllQ.findIndex((q) => q.questionId === fq.questionId);
                            setCurrentQuestionIdx(idxInActive);
                          }
                          setShowQuestionNavigator(false);
                        }}
                        className={`w-10 h-10 md:w-11 md:h-11 rounded-full font-bold text-sm transition-all flex items-center justify-center hover:shadow-md hover:scale-105 ${bgColor} ${textColor}`}
                        title={`Q${globalNum} — ${isOmitted ? 'Unanswered' : isCorrect ? 'Correct' : 'Wrong'}`}
                      >
                        {globalNum}
                      </button>
                    );
                  })}
                </div>
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
            return q.childQuestions.map((cq) => ({
              ...tq,
              id: cq.id,
              questionId: cq.id,
              question: {
                ...cq,
                content: {
                  ...cq.content,
                  explanation: cq.content?.explanation || q.content?.explanation || (q as any)?.explanation || undefined,
                }
              },
              parentPassageText: q.content?.text,
              parentPassageExplanation: q.content?.explanation,
            }));
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
          if (questionFilterBy === 'flagged') return ans?.isFlagged;
          return true;
        });

        const safeIdx = Math.min(currentQuestionIdx, Math.max(filteredQuestions.length - 1, 0));
        const currentTq = filteredQuestions[safeIdx];

        const studentAnswer = currentTq ? answersMap.get(currentTq.questionId) : null;
        const correct = studentAnswer?.answerGiven ? taAnswersMatch(studentAnswer.answerGiven, currentTq.question.correctAnswer) : false;
        const options = currentTq ? taOptionsToDisplay(currentTq.question.options) : [];
        const userAnswerDisplay = studentAnswer ? taAnswerToDisplay(studentAnswer.answerGiven) : null;
        const correctAnswerDisplay = currentTq ? taAnswerToDisplay(currentTq.question.correctAnswer) : null;
        const explText = currentTq ? (currentTq.question.content?.explanation || (currentTq as any)?.parentPassageExplanation || (currentTq.question as any)?.parentQuestion?.content?.explanation) : null;

        return createPortal(
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
                      {getSectionTabLabel(sa.name)}
                    </button>
                  ))}
                </div>
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
                    <option value="flagged">Bookmarked Only</option>
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
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-slate-900 text-white text-xs font-bold flex items-center justify-center rounded">
                          {allQuestions.findIndex(q => q.questionId === currentTq.questionId) + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {studentAnswer?.isFlagged && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-700">
                            <Bookmark size={11} fill="currentColor" /> Bookmarked
                          </span>
                        )}
                        <QuestionVisitTimes attemptId={testAnalysisAttempt.id} questionId={currentTq.questionId} fallbackSeconds={studentAnswer?.timeSpentSeconds ?? 0} />
                      </div>
                    </div>

                    {/* Question text */}
                    <div className="text-[15px] text-slate-900 leading-relaxed font-normal">
                      <RichContentRenderer content={currentTq.question.content.text || ''} variant="question" />
                    </div>

                    {/* Options / Answer Input */}
                    <div className="flex justify-start mb-2">
                      <button onClick={() => setShowAnswerFeedback(v => !v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${showAnswerFeedback ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                        {showAnswerFeedback ? 'Hide Answer' : 'Show Answer'}
                      </button>
                    </div>
                    {options.length > 0 && currentTq.question.type !== 'NUMERIC' ? (
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
                              showFeedback={showAnswerFeedback}
                              colorTheme="classic"
                            />
                          );
                        })}
                      </div>
                    ) : (
                      currentTq.question.type === 'NUMERIC' && (
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex flex-col gap-2">
                          <div className="text-sm">
                            <span className="text-slate-500 font-medium">Your answer: </span>
                            <span className={`font-bold ${!showAnswerFeedback ? 'text-slate-900' : correct ? 'text-emerald-600' : 'text-red-500'}`}>
                              {studentAnswer?.answerGiven?.text ?? (studentAnswer?.answerGiven?.value !== undefined ? formatNumericDisplay(studentAnswer.answerGiven.value) : null) ?? '—'}
                            </span>
                          </div>
                          {showAnswerFeedback && (
                          <div className="text-sm">
                            <span className="text-slate-500 font-medium">Correct answer: </span>
                            <span className="font-bold text-emerald-600">
                              {(currentTq.question.correctAnswer.displayValues && currentTq.question.correctAnswer.displayValues.length > 0 ? currentTq.question.correctAnswer.displayValues.join(' or ') : (currentTq.question.correctAnswer.value !== undefined ? formatNumericDisplay(currentTq.question.correctAnswer.value) : ''))}
                            </span>
                          </div>
                          )}
                        </div>
                      )
                    )}

                    {/* Explanation dropdown + Still Doubt / Cleared (same bar as the inline report) */}
                    {testAnalysisAttempt && currentTq && (
                      <div className="select-text">
                        <ExplanationDoubtBar
                          attemptId={testAnalysisAttempt.id}
                          questionId={currentTq.questionId}
                          explanation={explText}
                          doubtStatus={studentAnswer?.doubtStatus ?? null}
                          onDoubtChange={handleDoubtChange}
                        />
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
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-slate-900 text-white text-xs font-bold flex items-center justify-center rounded">
                          {allQuestions.findIndex(q => q.questionId === currentTq.questionId) + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {studentAnswer?.isFlagged && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-700">
                            <Bookmark size={11} fill="currentColor" /> Bookmarked
                          </span>
                        )}
                        <QuestionVisitTimes attemptId={testAnalysisAttempt.id} questionId={currentTq.questionId} fallbackSeconds={studentAnswer?.timeSpentSeconds ?? 0} />
                      </div>
                    </div>

                    {/* Question text */}
                    <div className="text-[16px] text-slate-900 leading-relaxed font-normal">
                      <RichContentRenderer content={currentTq.question.content.text || ''} variant="question" />
                    </div>

                    {/* Options / Answer Input */}
                    <div className="flex justify-start mb-2">
                      <button onClick={() => setShowAnswerFeedback(v => !v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${showAnswerFeedback ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
                        {showAnswerFeedback ? 'Hide Answer' : 'Show Answer'}
                      </button>
                    </div>
                    {options.length > 0 && currentTq.question.type !== 'NUMERIC' ? (
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
                              showFeedback={showAnswerFeedback}
                              colorTheme="classic"
                            />
                          );
                        })}
                      </div>
                    ) : (
                      currentTq.question.type === 'NUMERIC' && (
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex flex-col gap-2">
                          <div className="text-sm">
                            <span className="text-slate-500 font-medium">Your answer: </span>
                            <span className={`font-bold ${!showAnswerFeedback ? 'text-slate-900' : correct ? 'text-emerald-600' : 'text-red-500'}`}>
                              {studentAnswer?.answerGiven?.text ?? (studentAnswer?.answerGiven?.value !== undefined ? formatNumericDisplay(studentAnswer.answerGiven.value) : null) ?? '—'}
                            </span>
                          </div>
                          {showAnswerFeedback && (
                          <div className="text-sm">
                            <span className="text-slate-500 font-medium">Correct answer: </span>
                            <span className="font-bold text-emerald-600">
                              {(currentTq.question.correctAnswer.displayValues && currentTq.question.correctAnswer.displayValues.length > 0 ? currentTq.question.correctAnswer.displayValues.join(' or ') : (currentTq.question.correctAnswer.value !== undefined ? formatNumericDisplay(currentTq.question.correctAnswer.value) : ''))}
                            </span>
                          </div>
                          )}
                        </div>
                      )
                    )}

                    {/* Explanation dropdown + Still Doubt / Cleared (same bar as the inline report) */}
                    {testAnalysisAttempt && currentTq && (
                      <div className="select-text">
                        <ExplanationDoubtBar
                          attemptId={testAnalysisAttempt.id}
                          questionId={currentTq.questionId}
                          explanation={explText}
                          doubtStatus={studentAnswer?.doubtStatus ?? null}
                          onDoubtChange={handleDoubtChange}
                        />
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

            {/* Question Navigator — inline overlay so it renders above z-[150] */}
            {showQuestionNavigator && (() => {
              const navAnswersMap = new Map(testAnalysisAttempt!.answers.map((a) => [a.questionId, a]));
              const navSection = testAnalysisAttempt!.sectionAttempts.find(
                (sa) => sa.section.name === analysis.sections[activeQuestionSectionIdx]?.name
              );
              if (!navSection) return null;
              const navAllQ = navSection.section.questions.flatMap((tq) => {
                const q = tq.question;
                const isP = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
                if (isP && q.childQuestions?.length) return q.childQuestions.map((cq) => ({ ...tq, id: cq.id, questionId: cq.id, question: cq }));
                return [tq];
              });
              const navFiltered = navAllQ.filter((tq) => {
                const ans = navAnswersMap.get(tq.questionId);
                const isCorrect = ans?.answerGiven ? taAnswersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
                const isOmitted = !ans?.answerGiven;
                if (questionFilterBy === 'correct') return isCorrect;
                if (questionFilterBy === 'incorrect') return ans?.answerGiven && !isCorrect;
                if (questionFilterBy === 'omitted') return isOmitted;
                if (questionFilterBy === 'flagged') return ans?.isFlagged;
                return true;
              });
              const navSafeIdx = Math.min(currentQuestionIdx, Math.max(navFiltered.length - 1, 0));
              const currentTq = navFiltered[navSafeIdx];
              return (
                <div
                  className="absolute inset-0 z-[200]"
                  onClick={() => setShowQuestionNavigator(false)}
                >
                  <div
                    className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 border border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Title */}
                    <div className="text-center pb-3 border-b border-slate-100 relative">
                      <h3 className="text-base font-bold text-slate-800 tracking-tight pr-6 pl-6">{getSectionModuleLabel(analysis.sections[activeQuestionSectionIdx]?.name ?? '')}</h3>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5 tracking-wide">Questions</p>
                      <button
                        onClick={() => setShowQuestionNavigator(false)}
                        className="absolute right-0 top-0 p-1 rounded-lg text-slate-400 hover:bg-slate-50 transition-all"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-5 px-4 py-2.5 bg-[#f8fafc] rounded-xl border border-slate-100/50">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1]" />
                        <span className="text-xs font-semibold text-slate-500">Unanswered</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                        <span className="text-xs font-semibold text-slate-500">Correct</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                        <span className="text-xs font-semibold text-slate-500">Wrong</span>
                      </div>
                    </div>

                    {/* Question Grid */}
                    <div className="flex justify-center">
                      <div className="grid grid-cols-9 gap-3 p-1.5 justify-center justify-items-center">
                        {navAllQ.map((fq, idx) => {
                          const ans = navAnswersMap.get(fq.questionId);
                          const isCorrect = ans?.answerGiven ? taAnswersMatch(ans.answerGiven, fq.question.correctAnswer) : false;
                          const isOmitted = !ans?.answerGiven;
                          const isCurrent = currentTq && fq.questionId === currentTq.questionId;
                          const globalNum = idx + 1;
                          
                          let bgColor = 'bg-slate-100';
                          let textColor = 'text-slate-700';

                          if (isCurrent) {
                            bgColor = 'bg-blue-600';
                            textColor = 'text-white';
                          } else if (isCorrect) {
                            bgColor = 'bg-emerald-100';
                            textColor = 'text-emerald-800';
                          } else if (!isOmitted) {
                            bgColor = 'bg-red-100';
                            textColor = 'text-red-800';
                          }

                          const isFlagged = ans?.isFlagged ?? false;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                const idxInFiltered = navFiltered.findIndex((q) => q.questionId === fq.questionId);
                                if (idxInFiltered !== -1) {
                                  setCurrentQuestionIdx(idxInFiltered);
                                } else {
                                  setQuestionFilterBy('all');
                                  const idxInActive = navAllQ.findIndex((q) => q.questionId === fq.questionId);
                                  setCurrentQuestionIdx(idxInActive);
                                }
                                setShowQuestionNavigator(false);
                              }}
                              className={`relative w-10 h-10 md:w-11 md:h-11 rounded-full font-bold text-sm transition-all flex items-center justify-center hover:shadow-md hover:scale-105 ${bgColor} ${textColor}`}
                              title={`Q${globalNum} — ${isOmitted ? 'Unanswered' : isCorrect ? 'Correct' : 'Wrong'}${isFlagged ? ' (Bookmarked)' : ''}`}
                            >
                              {globalNum}
                              {isFlagged && (
                                <Bookmark size={10} className="absolute -top-1 -right-1 text-amber-500 drop-shadow-sm" fill="currentColor" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>,
          document.body
        );
      })()}
    </>
  );
}
