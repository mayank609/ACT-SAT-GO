import { useEffect, useState } from 'react';
import {
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Loader2, AlertCircle, HelpCircle,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { RichContentRenderer } from '../admin/RichContentRenderer';
import { OptionRenderer } from '../admin/OptionRenderer';
import { api } from '../../lib/api';
import { useSkillCategories, getSkillForTest } from '../../hooks/useSkillCategories';
import { formatNumericDisplay, numericEqual } from '../../lib/numericAnswer';
import { fmtSec, formatDate } from '../../lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DbAnswer {
  key?: string;
  keys?: string[];
  value?: number;
  values?: number[];
  text?: string;
  displayValues?: string[];
}

export interface DbQuestion {
  id: string;
  type: string;
  content: { text: string; explanation?: string | null };
  options: Record<string, string> | null;
  correctAnswer: DbAnswer;
  difficultyLevel: string;
  subject?: string;
  childQuestions?: DbQuestion[];
}

export interface DbTestQuestion {
  id: string;
  questionId: string;
  orderIndex: number;
  question: DbQuestion;
}

export interface DbSectionAttempt {
  id: string;
  sectionId: string;
  startedAt: string;
  completedAt: string | null;
  section: {
    id: string;
    name: string;
    questions: DbTestQuestion[];
  };
}

export interface DbAttemptAnswer {
  id: string;
  questionId: string;
  answerGiven: DbAnswer | null;
  timeSpentSeconds: number;
  isFlagged: boolean;
  doubtStatus?: 'doubt' | 'cleared' | null;
}

export interface DbAttempt {
  id: string;
  testId: string;
  status: string;
  totalScore: number | null;
  startedAt: string;
  completedAt: string | null;
  test: { id: string; title: string; category?: string };
  sectionAttempts: DbSectionAttempt[];
  answers: DbAttemptAnswer[];
}

export type DoubtStatus = 'doubt' | 'cleared' | null;

export interface MistakeItem {
  attemptId: string;
  testId: string;
  testTitle: string;
  sectionName: string;
  questionId: string;
  question: DbQuestion;
  answerGiven: DbAnswer | null;
  timeSpentSeconds: number;
  status: 'wrong' | 'unattempted';
  orderIndex: number;
  parentQuestionText?: string;
  parentPassageExplanation?: string | null;
  doubtStatus?: DoubtStatus;
}

/** Summary row from the attempts list (only the fields the scope picker needs). */
interface AttemptSummary {
  id: string;
  status: string;
  totalScore: number | null;
  startedAt: string;
  completedAt: string | null;
  test?: { title?: string };
}

type StatusFilter = 'all' | 'wrong' | 'unattempted';
type SubjectFilter = 'all' | 'math' | 'english';
type TestScope = 'all' | 'latest' | 'last2' | 'last5' | 'custom';

// ─── Helper functions ──────────────────────────────────────────────────────

export function dbAnswerToDisplay(ans: DbAnswer | null): string | string[] | number | null {
  if (!ans) return null;
  if (ans.value !== undefined) return ans.text ?? ans.displayValues?.[0] ?? formatNumericDisplay(ans.value);
  if (ans.keys) return ans.keys.map((k) => k.toLowerCase());
  if (ans.key) return ans.key.toLowerCase();
  return null;
}

export function answersMatch(given: DbAnswer | null, correct: DbAnswer): boolean {
  if (!given) return false;
  if (correct.value !== undefined) {
    if (Array.isArray(correct.values) && correct.values.length > 0) {
      return correct.values.some((v) => numericEqual(given.value, v));
    }
    return numericEqual(given.value, correct.value);
  }
  if (correct.keys) {
    return (
      JSON.stringify([...(given.keys ?? [])].sort()) ===
      JSON.stringify([...correct.keys].sort())
    );
  }
  if (correct.key) return given.key?.toUpperCase() === correct.key.toUpperCase();
  return false;
}

export function dbOptionsToDisplay(options: Record<string, string> | null): Array<{ id: string; text: string }> {
  if (!options) return [];
  return Object.entries(options).map(([k, v]) => ({ id: k.toLowerCase(), text: v }));
}

export function getSubject(item: MistakeItem): 'math' | 'english' | 'other' {
  const subject = (item.question.subject || '').toLowerCase();
  if (subject.includes('math')) return 'math';
  if (subject.includes('english') || subject.includes('reading') || subject.includes('writing')) return 'english';

  const secName = (item.sectionName || '').toLowerCase();
  if (secName.includes('math') || secName.includes('calc')) return 'math';
  if (secName.includes('english') || secName.includes('reading') || secName.includes('writing') || secName.includes('verbal') || secName.includes('grammar')) return 'english';

  const testTitle = (item.testTitle || '').toLowerCase();
  if (testTitle.includes('math')) return 'math';
  if (testTitle.includes('english') || testTitle.includes('reading') || testTitle.includes('writing')) return 'english';

  return 'other';
}

/**
 * Flattens a fully-loaded attempt into its wrong + unattempted questions.
 * Passage parents are expanded into their child questions (carrying the passage
 * text and a fallback explanation); child rows that also appear at the top level
 * are skipped so each question is emitted once.
 */
export function extractMistakes(attempt: DbAttempt): MistakeItem[] {
  const out: MistakeItem[] = [];
  const answersMap = new Map((attempt.answers ?? []).map((a) => [a.questionId, a]));

  (attempt.sectionAttempts ?? []).forEach((sa) => {
    const section = sa.section;
    const flattened: Array<DbTestQuestion & { parentQuestionText?: string; parentPassageExplanation?: string | null }> = [];

    (section.questions ?? []).forEach((tq) => {
      const q = tq.question;
      const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);

      if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
        q.childQuestions.forEach((cq) => {
          flattened.push({
            id: cq.id,
            questionId: cq.id,
            orderIndex: tq.orderIndex,
            question: {
              ...cq,
              content: {
                ...cq.content,
                explanation: cq.content?.explanation || q.content?.explanation || (q as any)?.explanation || undefined,
              },
            },
            parentQuestionText: q.content.text,
            parentPassageExplanation: q.content?.explanation,
          });
        });
      } else if (!(q as any).parentQuestionId) {
        flattened.push(tq);
      }
    });

    flattened.forEach((tq) => {
      const ans = answersMap.get(tq.questionId);
      const isUnattempted = !ans || !ans.answerGiven;
      const isWrong = !!ans && !!ans.answerGiven && !answersMatch(ans.answerGiven, tq.question.correctAnswer);

      if (isWrong || isUnattempted) {
        out.push({
          questionId: tq.questionId,
          question: tq.question,
          sectionName: section.name,
          testTitle: attempt.test?.title ?? 'Unknown Test',
          testId: attempt.testId,
          attemptId: attempt.id,
          answerGiven: ans?.answerGiven ?? null,
          timeSpentSeconds: ans?.timeSpentSeconds ?? 0,
          status: isUnattempted ? 'unattempted' : 'wrong',
          orderIndex: tq.orderIndex,
          parentQuestionText: tq.parentQuestionText,
          parentPassageExplanation: tq.parentPassageExplanation || (tq.question as any)?.parentQuestion?.content?.explanation,
          doubtStatus: ans?.doubtStatus ?? null,
        });
      }
    });
  });

  return out;
}

// ─── Mistake card ───────────────────────────────────────────────────────────

export interface MistakeCardProps {
  item: MistakeItem;
  index: number;
  canEditDoubt: boolean;
  onDoubtStatusChange: (questionId: string, nextStatus: DoubtStatus) => void;
}

export function MistakeCard({ item, index, canEditDoubt, onDoubtStatusChange }: MistakeCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const [savingDoubt, setSavingDoubt] = useState(false);

  const q = item.question;
  const options = dbOptionsToDisplay(q.options);
  const userAnswerDisplay = dbAnswerToDisplay(item.answerGiven);
  const correctAnswerDisplay = dbAnswerToDisplay(q.correctAnswer);
  const doubtStatus = item.doubtStatus ?? null;
  const explanation = q.content.explanation || item.parentPassageExplanation;

  // Optimistic update: reflect the new status immediately, roll back on failure.
  const handleSetDoubt = async (next: 'doubt' | 'cleared') => {
    const prev = doubtStatus;
    onDoubtStatusChange(q.id, next);
    setSavingDoubt(true);
    try {
      await api.setDoubtStatus(item.attemptId, q.id, next);
    } catch (err) {
      console.error('Failed to set doubt status', err);
      onDoubtStatusChange(q.id, prev);
    } finally {
      setSavingDoubt(false);
    }
  };

  const header = (
    <div className="px-3 md:px-4 py-3 flex items-center gap-2 md:gap-3 bg-white">
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-slate-600">
          {index + 1}
        </div>
        <XCircle size={14} className={item.status === 'unattempted' ? 'text-slate-400' : 'text-red-500'} />
      </div>
      <div className={`text-sm text-slate-800 flex-1 leading-relaxed min-w-0 text-left ${item.parentQuestionText ? 'font-medium' : ''}`}>
        <RichContentRenderer content={q.content.text || `Question ${index + 1}`} variant="question" className="prose-sm" />
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {item.timeSpentSeconds ? (
          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-[11px] font-semibold">
            <Clock size={11} className="text-blue-600" />
            <span>{fmtSec(item.timeSpentSeconds)}</span>
          </span>
        ) : null}
        <Badge variant={item.status === 'unattempted' ? 'default' : 'danger'} size="sm">
          {item.status === 'unattempted' ? 'Unattempted' : 'Wrong'}
        </Badge>
      </div>
    </div>
  );

  const body = (
    <div className="px-3 md:px-4 py-3 bg-white">
      {options.length > 0 && q.type !== 'NUMERIC' && (
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
              />
            );
          })}
        </div>
      )}
      {q.type === 'NUMERIC' && (
        <div className="flex gap-4 text-sm mb-3 text-left">
          <span className="text-slate-500">Answer given: <strong className={item.status === 'wrong' ? 'text-red-500' : 'text-slate-500'}>{item.answerGiven?.text ?? (item.answerGiven?.value !== undefined ? formatNumericDisplay(item.answerGiven.value) : null) ?? '—'}</strong></span>
          <span className="text-slate-500">Correct: <strong className="text-emerald-600">{(q.correctAnswer.displayValues && q.correctAnswer.displayValues.length > 0 ? q.correctAnswer.displayValues.join(' or ') : (q.correctAnswer.value !== undefined ? formatNumericDisplay(q.correctAnswer.value) : ''))}</strong></span>
        </div>
      )}
      <div className="text-xs text-slate-500 mb-3 p-2 bg-slate-50 rounded border border-slate-100">
        <strong className="text-slate-700">{item.testTitle}</strong> • {item.sectionName}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors"
        >
          {showExplanation ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>Explanation & Doubt Status</span>
        </button>

        {/* Doubt Status Pill */}
        {doubtStatus === 'doubt' && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <HelpCircle size={10} /> Marked as Doubt
          </span>
        )}
        {doubtStatus === 'cleared' && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle size={10} /> Cleared
          </span>
        )}
      </div>

      {showExplanation && (
        <div className="mt-3 space-y-3 border-t border-slate-50 pt-3">
          {explanation ? (
            <div className="p-3 bg-blue-50/50 rounded-lg border-l-4 border-blue-500 text-left text-xs leading-relaxed text-slate-800">
              <RichContentRenderer content={explanation} variant="explanation" className="prose-xs" />
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic text-left">No explanation available for this question.</div>
          )}

          {/* Doubt Resolution Actions */}
          {canEditDoubt && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
              <p className="text-[11px] font-medium text-slate-500 text-left">
                {doubtStatus === 'cleared'
                  ? 'Doubt cleared. This question has been revised.'
                  : doubtStatus === 'doubt'
                    ? 'Marked as a doubt. It is saved under Doubts for revision.'
                    : 'Mark this question as cleared once you have revised it.'}
              </p>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  onClick={() => handleSetDoubt('doubt')}
                  disabled={savingDoubt}
                  className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded border transition-colors disabled:opacity-50 ${doubtStatus === 'doubt'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  <HelpCircle size={10} /> Keep Doubt
                </button>
                <button
                  onClick={() => handleSetDoubt('cleared')}
                  disabled={savingDoubt}
                  className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded border transition-colors disabled:opacity-50 ${doubtStatus === 'cleared'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle size={10} /> Mark Cleared
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (item.parentQuestionText) {
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 bg-white">
          {/* Left Panel: Passage */}
          <div className="p-4 bg-slate-50 text-left overflow-y-auto max-h-[400px]">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 border-b border-slate-200/60 pb-1 flex-shrink-0">Reading Passage</h4>
            <div className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed">
              <RichContentRenderer content={item.parentQuestionText} variant="question" className="prose-sm" />
            </div>
          </div>

          {/* Right Panel: Question & Answers */}
          <div className="flex flex-col">
            {header}
            {body}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {header}
      {body}
    </div>
  );
}

// ─── Shared view ─────────────────────────────────────────────────────────────

const pillClass = (active: boolean, activeColor = 'bg-blue-600 border-blue-600') =>
  `px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${active
    ? `${activeColor} text-white shadow-sm`
    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
  }`;

export interface MistakesViewProps {
  /** The student whose submitted attempts are scanned for mistakes. */
  studentId: string | null | undefined;
  /** Whether the viewer may change a question's doubt status. */
  canEditDoubt?: boolean;
}

export function MistakesView({ studentId, canEditDoubt = false }: MistakesViewProps) {
  const { skills } = useSkillCategories();
  const activeSkills = skills.filter(s => s.active).sort((a, b) => a.order - b.order);

  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>('all');
  const [testTypeFilter, setTestTypeFilter] = useState<string>('all');
  const [testScope, setTestScope] = useState<TestScope>('all');
  const [selectedAttemptIds, setSelectedAttemptIds] = useState<string[]>([]);
  const [submittedAttempts, setSubmittedAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load every submitted attempt for the student and flatten it into mistakes.
  useEffect(() => {
    if (!studentId) {
      setMistakes([]);
      setSubmittedAttempts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setMistakes([]);
    setFilter('all');
    setSubjectFilter('all');
    setTestTypeFilter('all');
    setTestScope('all');
    setSelectedAttemptIds([]);

    const run = async () => {
      try {
        const { attempts: rawAttempts } = await api.getStudentAttempts(studentId);
        if (cancelled) return;
        if (!Array.isArray(rawAttempts)) {
          setSubmittedAttempts([]);
          return;
        }

        const submitted = (rawAttempts as AttemptSummary[]).filter(a => a?.status === 'SUBMITTED');
        setSubmittedAttempts(submitted);
        if (submitted.length === 0) return;

        const fullAttempts = await Promise.all(submitted.map(a => api.getAttempt(a.id).catch(() => null)));
        if (cancelled) return;

        const all: MistakeItem[] = [];
        fullAttempts.forEach((fullData) => {
          if (!fullData) return;
          all.push(...extractMistakes(fullData.attempt as unknown as DbAttempt));
        });
        setMistakes(all);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load mistakes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [studentId]);

  const handleDoubtStatusChange = (questionId: string, nextStatus: DoubtStatus) => {
    setMistakes(prev => prev.map(m => (m.questionId === questionId ? { ...m, doubtStatus: nextStatus } : m)));
  };

  // 1. Filter by test scope
  const mistakesForScope = mistakes.filter(m => {
    if (testScope === 'all') return true;
    if (testScope === 'latest') return m.attemptId === submittedAttempts[0]?.id;
    if (testScope === 'last2') return submittedAttempts.slice(0, 2).some(a => a.id === m.attemptId);
    if (testScope === 'last5') return submittedAttempts.slice(0, 5).some(a => a.id === m.attemptId);
    if (testScope === 'custom') return selectedAttemptIds.includes(m.attemptId);
    return true;
  });

  // 2. Filter by test type (driven by Skills Management)
  const mistakesForTestType = mistakesForScope.filter(m => {
    if (testTypeFilter === 'all') return true;
    return getSkillForTest(m.testTitle, skills) === testTypeFilter;
  });

  // 3. Filter by subject
  const mistakesForSubject = mistakesForTestType.filter(m => {
    if (subjectFilter === 'all') return true;
    return getSubject(m) === subjectFilter;
  });

  const totalCount = mistakesForSubject.length;
  const wrongCount = mistakesForSubject.filter(m => m.status === 'wrong').length;
  const unattemptedCount = mistakesForSubject.filter(m => m.status === 'unattempted').length;

  // 4. Filter by status (wrong vs unattempted)
  const filteredMistakes = mistakesForSubject.filter(m => filter === 'all' || m.status === filter);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-3 text-slate-400 text-sm bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <Loader2 size={24} className="animate-spin text-blue-500" />
        <span className="font-medium">Retrieving attempts and mapping mistakes…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
        <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (mistakes.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
        <p className="text-slate-800 font-bold text-base">Perfect record! No mistakes found</p>
        <p className="text-slate-400 text-xs mt-1">Every question in the submitted attempts was answered correctly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Mistakes', value: totalCount, color: 'text-blue-600' },
          { label: 'Wrong Answers', value: wrongCount, color: 'text-red-600' },
          { label: 'Unattempted', value: unattemptedCount, color: 'text-slate-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white border rounded-2xl p-4 text-center shadow-sm">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters Board */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        {/* Test Type Filter — driven by Skills Management page */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 mr-1.5 uppercase tracking-wide">Test Type:</span>
          <button onClick={() => setTestTypeFilter('all')} className={pillClass(testTypeFilter === 'all', 'bg-indigo-600 border-indigo-600')}>
            All
          </button>
          {activeSkills.map((skill) => (
            <button
              key={skill.id}
              onClick={() => setTestTypeFilter(skill.value)}
              className={pillClass(testTypeFilter === skill.value, 'bg-indigo-600 border-indigo-600')}
            >
              {skill.label}
            </button>
          ))}
          {activeSkills.length === 0 && (
            <span className="text-xs text-slate-400 italic">No test types configured.</span>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between border-t border-slate-50 pt-3">
          {/* Status filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 mr-1.5 uppercase tracking-wide">Status:</span>
            {([
              { value: 'all', label: 'All' },
              { value: 'wrong', label: 'Wrong Only' },
              { value: 'unattempted', label: 'Unattempted' },
            ] as Array<{ value: StatusFilter; label: string }>).map((f) => (
              <button key={f.value} onClick={() => setFilter(f.value)} className={pillClass(filter === f.value)}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Subject Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 mr-1.5 uppercase tracking-wide">Subject:</span>
            {([
              { value: 'all', label: 'All Subjects' },
              { value: 'math', label: 'Maths' },
              { value: 'english', label: 'English' },
            ] as Array<{ value: SubjectFilter; label: string }>).map((f) => (
              <button key={f.value} onClick={() => setSubjectFilter(f.value)} className={pillClass(subjectFilter === f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scope filter */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-50 pt-3">
          <span className="text-xs font-bold text-slate-400 mr-1.5 uppercase tracking-wide">Test Range:</span>
          {([
            { value: 'all', label: 'All Tests' },
            { value: 'latest', label: 'Latest Test' },
            { value: 'last2', label: 'Last 2 Tests' },
            { value: 'last5', label: 'Last 5 Tests' },
            { value: 'custom', label: 'Select Specific...' },
          ] as Array<{ value: TestScope; label: string }>).map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setTestScope(f.value);
                if (f.value === 'custom' && selectedAttemptIds.length === 0 && submittedAttempts.length > 0) {
                  setSelectedAttemptIds([submittedAttempts[0].id]);
                }
              }}
              className={pillClass(testScope === f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Custom Test Selection Multi-Picker */}
        {testScope === 'custom' && submittedAttempts.length > 0 && (
          <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 space-y-2 max-h-40 overflow-y-auto animate-fadeIn mt-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Check tests to include:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {submittedAttempts.map((attempt) => {
                const isChecked = selectedAttemptIds.includes(attempt.id);
                const formattedDate = formatDate(attempt.completedAt ?? attempt.startedAt);
                return (
                  <label
                    key={attempt.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer select-none transition-all ${isChecked
                      ? 'bg-blue-50/40 border-blue-200 text-blue-700 font-semibold'
                      : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedAttemptIds((prev) =>
                          prev.includes(attempt.id) ? prev.filter((id) => id !== attempt.id) : [...prev, attempt.id]
                        );
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-slate-800">{attempt.test?.title ?? 'Unknown Test'}</p>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5">{formattedDate} · Score: {attempt.totalScore ?? '—'}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Questions Listing */}
      <div className="space-y-4">
        {filteredMistakes.map((item, idx) => (
          <MistakeCard
            key={`${item.attemptId}-${item.questionId}`}
            item={item}
            index={idx}
            canEditDoubt={canEditDoubt}
            onDoubtStatusChange={handleDoubtStatusChange}
          />
        ))}
      </div>

      {filteredMistakes.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
          <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
          <p className="text-slate-800 font-bold text-sm">No mistake questions match these filters</p>
          <p className="text-slate-400 text-xs mt-1">Try switching filters or selecting other tests.</p>
        </div>
      )}
    </div>
  );
}
