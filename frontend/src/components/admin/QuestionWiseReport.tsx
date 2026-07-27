import { fmtSec } from '../../lib/utils';
import { satSectionScore } from '../../lib/analyticsData';
import { useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown,
  Maximize2, X, Clock, Calculator, Bookmark,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { RichContentRenderer } from './RichContentRenderer';
import { OptionRenderer } from './OptionRenderer';
import { DesmosCalculator } from '../calculator/DesmosCalculator';

// ─── Exported types ──────────────────────────────────────────────────────────

export interface TaAnswer {
  key?: string;
  keys?: string[];
  value?: number;
}

export interface TaQuestion {
  id: string;
  type: string;
  content: {
    text: string;
    explanation?: string | null;
    meta?: { domain?: string | null; subTopic?: string | null; isPassage?: boolean } | null;
  };
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
    durationMinutes: number;
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
  doubtStatus?: string | null;
}

export interface TaAttempt {
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

export interface SectionAnalysis {
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

// ─── Exported helpers ─────────────────────────────────────────────────────────

export function taAnswersMatch(given: TaAnswer | null, correct: TaAnswer): boolean {
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

export function taOptionsToDisplay(options: Record<string, string> | null): Array<{ id: string; text: string }> {
  if (!options) return [];
  return Object.entries(options).map(([k, v]) => ({ id: k.toLowerCase(), text: v }));
}

export function taAnswerToDisplay(ans: TaAnswer | null): string | string[] | number | null {
  if (!ans) return null;
  if (ans.value !== undefined) return ans.value;
  if (ans.keys) return ans.keys.map(k => k.toLowerCase());
  if (ans.key) return ans.key.toLowerCase();
  return null;
}

export function computeTestAnalysis(attempt: TaAttempt): {
  sections: SectionAnalysis[];
  totalCorrect: number; totalQuestions: number;
  rwCorrect: number; rwTotal: number;
  mathCorrect: number; mathTotal: number;
  isSAT: boolean;
  finalScaledScore: number; rwScaled: number; mathScaled: number;
  rw1Correct: number; rw1Total: number; rw2Correct: number; rw2Total: number;
  math1Correct: number; math1Total: number; math2Correct: number; math2Total: number;
} {
  const answersMap = new Map(attempt.answers.map(a => [a.questionId, a]));
  const sortedSections = [...attempt.sectionAttempts].sort((a, b) => a.section.orderIndex - b.section.orderIndex);

  const testTitle = (attempt.test.title ?? '').toLowerCase();
  const testCat   = (attempt.test.category ?? '').toLowerCase();
  const testIsMath = /\bmhw\b|math[\s-]hw|math\s*homework|\bmath\b|algebra|geometry|calc/.test(testTitle) || /math/i.test(testCat);
  const testIsRW   = /\brhw\b|reading[\s-]hw|writing[\s-]hw|english[\s-]hw|\breading\b|\bwriting\b|\benglish\b|verbal|grammar|\brw\b/.test(testTitle) || /rw|english/i.test(testCat);

  let totalCorrect = 0, totalQuestions = 0;
  let rwCorrect = 0, rwTotal = 0, mathCorrect = 0, mathTotal = 0;
  let mathGroupIdx = 0, rwGroupIdx = 0;
  let rw1Correct = 0, rw1Total = 0, rw2Correct = 0, rw2Total = 0;
  let math1Correct = 0, math1Total = 0, math2Correct = 0, math2Total = 0;

  const sections: SectionAnalysis[] = sortedSections.map(sa => {
    const flatQs: TaTestQuestion[] = [];
    sa.section.questions.forEach(tq => {
      const q = tq.question;
      const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
      if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
        q.childQuestions.forEach(cq => flatQs.push({ id: cq.id, questionId: cq.id, orderIndex: tq.orderIndex, question: cq }));
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
    totalCorrect += correct; totalQuestions += total;
    return { name: sa.section.name, category, correct, incorrect, omitted, total, unvisited, accuracy, timeTaken };
  });

  const isSAT = rwTotal > 0 || mathTotal > 0;
  const rwScaled = rwTotal > 0 ? satSectionScore(rw1Correct, rw2Correct, rwTotal, false) : 0;
  const mathScaled = mathTotal > 0 ? satSectionScore(math1Correct, math2Correct, mathTotal, true) : 0;
  const finalScaledScore = rwScaled + mathScaled;
  return { sections, totalCorrect, totalQuestions, rwCorrect, rwTotal, mathCorrect, mathTotal, isSAT, finalScaledScore, rwScaled, mathScaled, rw1Correct, rw1Total, rw2Correct, rw2Total, math1Correct, math1Total, math2Correct, math2Total };
}

// ─── Helper: flatten section questions ───────────────────────────────────────

type FlatQuestion = TaTestQuestion & { parentPassageText?: string };

function flattenSection(sa: TaSectionAttempt): FlatQuestion[] {
  return sa.section.questions.flatMap((tq) => {
    const q = tq.question;
    const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
    if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
      return q.childQuestions.map((cq) => ({ ...tq, id: cq.id, questionId: cq.id, question: cq, parentPassageText: q.content?.text }));
    }
    return [tq as FlatQuestion];
  });
}

// ─── Question display (shared between inline and fullscreen) ──────────────────

function QuestionDisplay({
  allQuestions, filteredQuestions, currentQuestionIdx, answersMap, showAnswerFeedback,
  setShowAnswerFeedback, setCurrentQuestionIdx, setShowQuestionNavigator, isFullscreen,
}: {
  allQuestions: FlatQuestion[];
  filteredQuestions: FlatQuestion[];
  currentQuestionIdx: number;
  answersMap: Map<string, TaAttemptAnswer>;
  showAnswerFeedback: boolean;
  setShowAnswerFeedback: (fn: (v: boolean) => boolean) => void;
  setCurrentQuestionIdx: (n: number) => void;
  setShowQuestionNavigator: (v: boolean) => void;
  isFullscreen: boolean;
}) {
  if (filteredQuestions.length === 0) {
    return (
      <div className={`flex items-center justify-center ${isFullscreen ? 'h-full' : 'py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200'}`}>
        <p className="text-slate-500 font-semibold text-sm">No questions match the filter</p>
      </div>
    );
  }

  const safeIdx = Math.min(currentQuestionIdx, Math.max(filteredQuestions.length - 1, 0));
  const currentTq = filteredQuestions[safeIdx];
  const hasPrev = safeIdx > 0;
  const hasNext = safeIdx < filteredQuestions.length - 1;
  const studentAnswer = answersMap.get(currentTq.questionId) ?? null;
  const correct = studentAnswer?.answerGiven ? taAnswersMatch(studentAnswer.answerGiven, currentTq.question.correctAnswer) : false;
  const skipped = !studentAnswer?.answerGiven;
  const options = taOptionsToDisplay(currentTq.question.options);
  const userAnswerDisplay = taAnswerToDisplay(studentAnswer?.answerGiven ?? null);
  const correctAnswerDisplay = taAnswerToDisplay(currentTq.question.correctAnswer);
  const globalNumber = allQuestions.findIndex(q => q.questionId === currentTq.questionId) + 1;

  const statusBadges = (
    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
      {studentAnswer?.timeSpentSeconds ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 border border-blue-300 rounded-full text-xs font-bold text-blue-800">
          <Clock size={12} strokeWidth={2.5} /> Time Spent: {fmtSec(studentAnswer.timeSpentSeconds)}
        </span>
      ) : null}
      {correct ? (
        <Badge variant="info" className="bg-blue-600 text-white border-none font-semibold">Correct</Badge>
      ) : skipped ? (
        <Badge variant="info" className="bg-blue-50 text-blue-600 border-none font-semibold">Skip</Badge>
      ) : (
        <Badge variant="info" className="bg-blue-200 text-blue-900 border-none font-semibold">Wrong</Badge>
      )}
      {studentAnswer?.doubtStatus === 'doubt' && (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-md bg-amber-400 text-white">Still Doubt</span>
      )}
      {studentAnswer?.doubtStatus === 'cleared' && (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-md bg-green-500 text-white">Cleared</span>
      )}
    </div>
  );

  const showAnswerToggle = (
    <div className="flex justify-start mb-2">
      <button onClick={() => setShowAnswerFeedback(v => !v)}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${showAnswerFeedback ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}>
        {showAnswerFeedback ? 'Hide Answer' : 'Show Answer'}
      </button>
    </div>
  );

  const optionsBlock = options.length > 0 && currentTq.question.type !== 'NUMERIC' ? (
    <div className={`space-y-2.5 ${isFullscreen ? '' : 'max-w-3xl'}`}>
      {options.map((opt) => {
        const isUserAnswer = Array.isArray(userAnswerDisplay) ? userAnswerDisplay.includes(opt.id) : userAnswerDisplay === opt.id;
        const isCorrectOption = Array.isArray(correctAnswerDisplay) ? correctAnswerDisplay.includes(opt.id) : correctAnswerDisplay === opt.id;
        return (
          <OptionRenderer key={opt.id} label={opt.id.toUpperCase()} text={opt.text}
            isSelected={isUserAnswer && !isCorrectOption} isCorrect={isCorrectOption}
            isIncorrect={isUserAnswer && !isCorrectOption}
            showFeedback={showAnswerFeedback} colorTheme="classic" />
        );
      })}
    </div>
  ) : currentTq.question.type === 'NUMERIC' ? (
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex flex-col gap-2 text-sm">
      <div><span className="text-slate-500 font-medium">Your answer: </span><span className={`font-bold ${correct ? 'text-emerald-600' : 'text-red-500'}`}>{studentAnswer?.answerGiven?.value ?? '—'}</span></div>
      <div><span className="text-slate-500 font-medium">Correct answer: </span><span className="font-bold text-emerald-600">{currentTq.question.correctAnswer.value}</span></div>
    </div>
  ) : null;

  const explanation = currentTq.question.content.explanation ? (
    <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100/80">
      <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">Explanation</h5>
      <div className="text-sm text-slate-700 leading-relaxed">
        <RichContentRenderer content={currentTq.question.content.explanation} variant="question" className="prose-sm" />
      </div>
    </div>
  ) : null;

  const navigation = (
    <div className={`flex items-center justify-between ${isFullscreen ? 'px-5 h-16 bg-[#fcfcfd] border-t border-slate-200 flex-shrink-0' : 'pt-2 gap-3'}`}>
      <button onClick={() => setCurrentQuestionIdx(safeIdx - 1)} disabled={!hasPrev}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${hasPrev ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
        <ChevronLeft size={16} /> Previous
      </button>
      {filteredQuestions.length > 0 && (
        <button onClick={() => setShowQuestionNavigator(true)}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all shadow-md cursor-pointer">
          Question {safeIdx + 1} of {filteredQuestions.length} <ChevronDown size={14} />
        </button>
      )}
      <button onClick={() => setCurrentQuestionIdx(safeIdx + 1)} disabled={!hasNext}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all flex-shrink-0 ${hasNext ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
        Next <ChevronRight size={16} />
      </button>
    </div>
  );

  if (isFullscreen) {
    if ((currentTq as any).parentPassageText) {
      return (
        <>
          <div className="flex h-full min-h-full divide-x divide-slate-200 overflow-hidden">
            <div className="w-1/2 overflow-y-auto p-8 bg-white h-full">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Reading Passage</p>
              <div className="prose prose-slate max-w-none text-slate-800 text-[15px] leading-relaxed">
                <RichContentRenderer content={(currentTq as any).parentPassageText || ''} variant="passage" />
              </div>
            </div>
            <div className="w-1/2 overflow-y-auto p-8 bg-white h-full flex flex-col gap-6 select-text">
              <div className="flex items-center justify-between border-b-2 border-dashed border-slate-200 pb-2.5">
                <span className="w-6 h-6 bg-slate-900 text-white text-xs font-bold flex items-center justify-center rounded">{globalNumber}</span>
                {statusBadges}
              </div>
              <div className="text-[15px] text-slate-900 leading-relaxed">
                <RichContentRenderer content={currentTq.question.content.text || ''} variant="question" />
              </div>
              {showAnswerToggle}
              {optionsBlock}
              {explanation}
            </div>
          </div>
          {navigation}
        </>
      );
    }
    return (
      <>
        <div className="overflow-y-auto flex-1 p-8 bg-white select-text min-h-0">
          <div className="max-w-3xl mx-auto flex flex-col gap-6">
            <div className="flex items-center justify-between border-b-2 border-dashed border-slate-200 pb-2.5">
              <span className="w-6 h-6 bg-slate-900 text-white text-xs font-bold flex items-center justify-center rounded">{globalNumber}</span>
              {statusBadges}
            </div>
            <div className="text-[16px] text-slate-900 leading-relaxed">
              <RichContentRenderer content={currentTq.question.content.text || ''} variant="question" />
            </div>
            {showAnswerToggle}
            {optionsBlock}
            {explanation}
          </div>
        </div>
        {navigation}
      </>
    );
  }

  // ── Inline (non-fullscreen) layout ──
  if ((currentTq as any).parentPassageText) {
    return (
      <>
        <div className="flex flex-col gap-4 h-[600px]">
          <div className="flex items-center justify-between text-sm flex-shrink-0">
            <div className="font-bold text-slate-700">Total: {allQuestions.length}</div>
            <div className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded">Q{safeIdx + 1} of {filteredQuestions.length}</div>
          </div>
          <div className="overflow-y-auto flex-1 border-2 rounded-lg bg-white" style={{ borderColor: correct ? '#BFDBFE' : skipped ? '#E2E8F0' : '#E0F2FE' }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 h-full">
              <div className="p-4 overflow-y-auto">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Passage</div>
                <RichContentRenderer content={(currentTq as any).parentPassageText || ''} variant="passage" className="prose-sm text-slate-700" />
              </div>
              <div className="flex flex-col p-4">
                <div className={`p-3 flex items-start gap-3 rounded-lg mb-3 ${correct ? 'bg-blue-50/55' : skipped ? 'bg-slate-50' : 'bg-sky-50/40'}`}>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${correct ? 'bg-blue-600' : skipped ? 'bg-slate-400' : 'bg-blue-400'}`}>{globalNumber}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Question</div>
                    <div className="text-sm text-slate-800 leading-relaxed font-medium">
                      <RichContentRenderer content={currentTq.question.content.text || 'Question'} variant="question" className="prose-sm" />
                    </div>
                  </div>
                  {statusBadges}
                </div>
                <div className="space-y-2 flex-1 overflow-y-auto">
                  {showAnswerToggle}
                  {optionsBlock}
                </div>
              </div>
            </div>
          </div>
          {navigation}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-[600px]">
      <div className="flex items-center justify-between text-sm flex-shrink-0">
        <div className="font-bold text-slate-700">
          Total: {allQuestions.length}
          {filteredQuestions.length !== allQuestions.length && (
            <span className="text-slate-500 font-medium ml-2">(Showing {filteredQuestions.length})</span>
          )}
        </div>
        <div className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded">Q{safeIdx + 1} of {filteredQuestions.length}</div>
      </div>
      <div className="overflow-y-auto flex-1 border-2 rounded-lg bg-white" style={{ borderColor: correct ? '#BFDBFE' : skipped ? '#E2E8F0' : '#E0F2FE' }}>
        <div className={`p-4 flex items-start gap-3 sticky top-0 z-10 ${correct ? 'bg-blue-50/55' : skipped ? 'bg-slate-50' : 'bg-sky-50/40'}`}>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${correct ? 'bg-blue-600' : skipped ? 'bg-slate-400' : 'bg-blue-400'}`}>{globalNumber}</div>
          </div>
          <div className="text-sm text-slate-800 flex-1 leading-relaxed text-left font-medium">
            <RichContentRenderer content={currentTq.question.content.text || 'Question'} variant="question" className="prose-sm" />
          </div>
          {statusBadges}
        </div>
        <div className="px-4 py-3 border-t border-slate-100">
          {showAnswerToggle}
          {optionsBlock}
        </div>
        {explanation && <div className="px-4 pb-4">{explanation}</div>}
      </div>
      {navigation}
    </div>
  );
}

// ─── Question Navigator popover ───────────────────────────────────────────────

function QuestionNavigator({
  sectionName, filteredQuestions, currentQuestionIdx, answersMap,
  isFullscreen, onClose, onSelect,
}: {
  sectionName: string;
  filteredQuestions: FlatQuestion[];
  currentQuestionIdx: number;
  answersMap: Map<string, TaAttemptAnswer>;
  isFullscreen: boolean;
  onClose: () => void;
  onSelect: (idx: number) => void;
}) {
  const navSafeIdx = Math.min(currentQuestionIdx, Math.max(filteredQuestions.length - 1, 0));

  // Tally for the stats row (Bluebook-style summary).
  const navStats = filteredQuestions.reduce(
    (acc, fq) => {
      const ans = answersMap.get(fq.questionId);
      if (!ans?.answerGiven) acc.unanswered++;
      else if (taAnswersMatch(ans.answerGiven, fq.question.correctAnswer)) acc.correct++;
      else acc.wrong++;
      return acc;
    },
    { correct: 0, wrong: 0, unanswered: 0 },
  );

  const grid = (
    <div className="space-y-4">
      <div className="text-center border-b border-slate-200 pb-3">
        <h3 className="text-base font-bold text-slate-900">{sectionName}</h3>
        <p className="text-xs text-slate-500 mt-0.5">Questions</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-1.5">
          <svg width="11" height="14" viewBox="0 0 14 18" fill="none"><path d="M7 0C3.13 0 0 3.13 0 7c0 5.25 7 11 7 11s7-5.75 7-11c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S5.62 4.5 7 4.5s2.5 1.12 2.5 2.5S8.38 9.5 7 9.5z" fill="#1b3d6e"/></svg>
          <span className="text-xs font-medium text-slate-600">Current</span>
        </div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-dashed border-slate-400 bg-white" /><span className="text-xs font-medium text-slate-600">Unanswered</span></div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 border-emerald-500 bg-white" /><span className="text-xs font-medium text-slate-600">Correct</span></div>
        <div className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 border-red-500 bg-white" /><span className="text-xs font-medium text-slate-600">Wrong</span></div>
        <div className="flex items-center gap-1.5"><Bookmark size={13} className="text-amber-500" fill="currentColor" /><span className="text-xs font-medium text-slate-600">Bookmarked</span></div>
      </div>

      {/* Question grid */}
      <div className="grid grid-cols-10 gap-2 max-h-72 overflow-y-auto px-1">
        {filteredQuestions.map((fq, idx) => {
          const ans = answersMap.get(fq.questionId);
          const isCorrect = ans?.answerGiven ? taAnswersMatch(ans.answerGiven, fq.question.correctAnswer) : false;
          const isOmitted = !ans?.answerGiven;
          const isFlagged = ans?.isFlagged ?? false;
          const isCurrent = idx === navSafeIdx;
          const cls = isCurrent
            ? 'bg-[#1b3d6e] text-white border border-[#1b3d6e]'
            : isOmitted
              ? 'bg-white border border-dashed border-slate-400 text-slate-600'
              : isCorrect
                ? 'bg-white border-2 border-emerald-500 text-emerald-700'
                : 'bg-white border-2 border-red-500 text-red-700';
          return (
            <div key={idx} className="flex flex-col items-center gap-0.5">
              <div className="h-3.5 flex items-end justify-center">
                {isCurrent && (
                  <svg width="9" height="12" viewBox="0 0 14 18" fill="none"><path d="M7 0C3.13 0 0 3.13 0 7c0 5.25 7 11 7 11s7-5.75 7-11c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S5.62 4.5 7 4.5s2.5 1.12 2.5 2.5S8.38 9.5 7 9.5z" fill="#1b3d6e"/></svg>
                )}
              </div>
              <button onClick={() => onSelect(idx)}
                className={`relative w-9 h-9 rounded text-xs font-bold transition-all flex items-center justify-center hover:shadow-sm ${cls}`}>
                {idx + 1}
                {isFlagged && !isCurrent && (
                  <span className="absolute -top-1 -right-1"><Bookmark size={9} className="text-amber-500" fill="currentColor" /></span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 border-t border-slate-200 pt-3 text-center">
        {[
          { label: 'Correct', value: navStats.correct, color: 'text-emerald-600' },
          { label: 'Wrong', value: navStats.wrong, color: 'text-red-500' },
          { label: 'Unanswered', value: navStats.unanswered, color: 'text-slate-500' },
          { label: 'Total', value: filteredQuestions.length, color: 'text-slate-400' },
        ].map(s => (
          <div key={s.label}>
            <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="absolute inset-0 z-[200]" onClick={onClose}>
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
          {grid}
        </div>
      </div>
    );
  }

  return (
    <Modal isOpen onClose={onClose} title="" size="md">
      {grid}
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface QuestionWiseReportProps {
  attempt: TaAttempt;
  defaultFilter?: string;
  defaultFullscreen?: boolean;
  onFullscreenClose?: () => void;
}

export function QuestionWiseReport({ attempt, defaultFilter = 'all', defaultFullscreen = false, onFullscreenClose }: QuestionWiseReportProps) {
  const [activeQuestionSectionIdx, setActiveQuestionSectionIdx] = useState(0);
  const [questionFilterBy, setQuestionFilterBy] = useState(defaultFilter);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  const [showQuestionNavigator, setShowQuestionNavigator] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(defaultFullscreen);
  const [showCalculator, setShowCalculator] = useState(false);

  const handleCloseFullscreen = () => {
    setFullscreenOpen(false);
    onFullscreenClose?.();
  };

  const analysis = computeTestAnalysis(attempt);
  const answersMap = new Map(attempt.answers.map(a => [a.questionId, a]));

  const activeSection = analysis.sections[activeQuestionSectionIdx];
  const sectionAttempt = attempt.sectionAttempts.find(sa => sa.section.name === activeSection?.name);
  const allQuestions: FlatQuestion[] = sectionAttempt ? flattenSection(sectionAttempt) : [];

  const filteredQuestions = allQuestions.filter(tq => {
    const ans = answersMap.get(tq.questionId);
    const isCorrect = ans?.answerGiven ? taAnswersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
    const isOmitted = !ans?.answerGiven;
    if (questionFilterBy === 'correct') return isCorrect;
    if (questionFilterBy === 'incorrect') return ans?.answerGiven && !isCorrect;
    if (questionFilterBy === 'omitted') return isOmitted;
    if (questionFilterBy === 'doubt') return ans?.doubtStatus === 'doubt';
    if (questionFilterBy === 'cleared') return ans?.doubtStatus === 'cleared';
    return true;
  });

  const changeSection = (idx: number, filter = 'all') => {
    setActiveQuestionSectionIdx(idx);
    setQuestionFilterBy(filter);
    setCurrentQuestionIdx(0);
  };

  // ── Tab bar ──────────────────────────────────────────────────────────────
  const tabBar = (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
      <div className="flex flex-wrap gap-2">
        {analysis.sections.map((sa, idx) => (
          <button key={idx} onClick={() => changeSection(idx)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${activeQuestionSectionIdx === idx ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
            {sa.category}
          </button>
        ))}
        <button onClick={() => { setQuestionFilterBy(f => f === 'doubt' ? 'all' : 'doubt'); setCurrentQuestionIdx(0); }}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${questionFilterBy === 'doubt' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
          Still Doubt
        </button>
        <button onClick={() => { setQuestionFilterBy(f => f === 'cleared' ? 'all' : 'cleared'); setCurrentQuestionIdx(0); }}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${questionFilterBy === 'cleared' ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
          Cleared
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter</span>
        <select value={questionFilterBy} onChange={e => { setQuestionFilterBy(e.target.value); setCurrentQuestionIdx(0); }}
          className="px-2.5 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All</option>
          <option value="correct">Correct</option>
          <option value="incorrect">Incorrect</option>
          <option value="omitted">Omitted</option>
        </select>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Inline card ── */}
      <div className="bg-white rounded-xl border-2 border-blue-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
            Question Wise Report
          </h4>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCalculator(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all font-semibold text-sm shadow-sm ${showCalculator ? 'bg-[#1b3d6e] text-white' : 'bg-blue-50 text-[#1b3d6e] hover:bg-blue-100'}`}>
              <Calculator size={16} /> Calculator
            </button>
            <button onClick={() => setFullscreenOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all font-semibold text-sm shadow-sm">
              <Maximize2 size={16} /> Fullscreen
            </button>
          </div>
        </div>
        {tabBar}
        <QuestionDisplay
          allQuestions={allQuestions} filteredQuestions={filteredQuestions}
          currentQuestionIdx={currentQuestionIdx} answersMap={answersMap}
          showAnswerFeedback={showAnswerFeedback} setShowAnswerFeedback={setShowAnswerFeedback}
          setCurrentQuestionIdx={setCurrentQuestionIdx} setShowQuestionNavigator={setShowQuestionNavigator}
          isFullscreen={false}
        />
      </div>

      {/* ── Non-fullscreen Question Navigator ── */}
      {showQuestionNavigator && !fullscreenOpen && activeSection && (
        <QuestionNavigator
          sectionName={activeSection.name} filteredQuestions={filteredQuestions}
          currentQuestionIdx={currentQuestionIdx} answersMap={answersMap}
          isFullscreen={false} onClose={() => setShowQuestionNavigator(false)}
          onSelect={idx => { setCurrentQuestionIdx(idx); setShowQuestionNavigator(false); }}
        />
      )}

      {/* ── Fullscreen overlay ── */}
      {fullscreenOpen && (
        <div className="fixed inset-0 bg-white z-[150] overflow-hidden flex flex-col font-sans select-none">
          {/* Header */}
          <header className="flex-shrink-0 bg-[#fcfcfd] border-b border-slate-200 px-5 h-16 flex items-center justify-between z-20">
            <div className="flex items-center gap-4 min-w-0">
              <span className="font-bold text-slate-800 text-sm hidden sm:inline">Reviewing:</span>
              <div className="flex flex-wrap gap-1 min-w-0">
                {analysis.sections.map((sa, idx) => (
                  <button key={idx} onClick={() => changeSection(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${activeQuestionSectionIdx === idx ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
                    {sa.category}
                  </button>
                ))}
                <button onClick={() => { setQuestionFilterBy(f => f === 'doubt' ? 'all' : 'doubt'); setCurrentQuestionIdx(0); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${questionFilterBy === 'doubt' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
                  Still Doubt
                </button>
                <button onClick={() => { setQuestionFilterBy(f => f === 'cleared' ? 'all' : 'cleared'); setCurrentQuestionIdx(0); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${questionFilterBy === 'cleared' ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
                  Cleared
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4 z-30">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">Filter</span>
                <select value={questionFilterBy} onChange={e => { setQuestionFilterBy(e.target.value); setCurrentQuestionIdx(0); }}
                  className="px-2.5 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">All Questions</option>
                  <option value="correct">Correct Only</option>
                  <option value="incorrect">Incorrect Only</option>
                  <option value="omitted">Omitted Only</option>
                </select>
              </div>
              <button onClick={() => setShowCalculator(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${showCalculator ? 'bg-[#1b3d6e] text-white' : 'bg-blue-50 text-[#1b3d6e] hover:bg-blue-100'}`}
                title="Desmos Calculator">
                <Calculator size={15} /> Calculator
              </button>
              <button onClick={handleCloseFullscreen} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-all" title="Close Fullscreen">
                <X size={20} />
              </button>
            </div>
          </header>

          {/* Main */}
          <div className="flex-1 overflow-hidden bg-white min-h-0 flex flex-col">
            <QuestionDisplay
              allQuestions={allQuestions} filteredQuestions={filteredQuestions}
              currentQuestionIdx={currentQuestionIdx} answersMap={answersMap}
              showAnswerFeedback={showAnswerFeedback} setShowAnswerFeedback={setShowAnswerFeedback}
              setCurrentQuestionIdx={setCurrentQuestionIdx} setShowQuestionNavigator={setShowQuestionNavigator}
              isFullscreen={true}
            />
          </div>

          {/* Fullscreen Question Navigator */}
          {showQuestionNavigator && activeSection && (
            <QuestionNavigator
              sectionName={activeSection.name} filteredQuestions={filteredQuestions}
              currentQuestionIdx={currentQuestionIdx} answersMap={answersMap}
              isFullscreen={true} onClose={() => setShowQuestionNavigator(false)}
              onSelect={idx => { setCurrentQuestionIdx(idx); setShowQuestionNavigator(false); }}
            />
          )}
        </div>
      )}

      {/* Shared draggable Desmos calculator (graphing + scientific) */}
      <DesmosCalculator open={showCalculator} onClose={() => setShowCalculator(false)} />
    </>
  );
}
