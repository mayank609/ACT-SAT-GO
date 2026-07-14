import { fmtSec } from '../../lib/utils';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Loader2, AlertCircle, HelpCircle } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DbAnswer {
  key?: string
  keys?: string[]
  value?: number
}

interface DbQuestion {
  id: string
  type: string
  content: { text: string; explanation?: string | null }
  options: Record<string, string> | null
  correctAnswer: DbAnswer
  difficultyLevel: string
  subject?: string
  childQuestions?: DbQuestion[]
}

interface DbTestQuestion {
  id: string
  questionId: string
  orderIndex: number
  question: DbQuestion
}

interface DbSectionAttempt {
  id: string
  sectionId: string
  startedAt: string
  completedAt: string | null
  section: {
    id: string
    name: string
    durationMinutes: number
    orderIndex: number
    questions: DbTestQuestion[]
  }
}

interface DbAttemptAnswer {
  id: string
  questionId: string
  answerGiven: DbAnswer | null
  timeSpentSeconds: number
  isFlagged: boolean
  doubtStatus?: 'doubt' | 'cleared' | null
}

interface DbAttempt {
  id: string
  testId: string
  status: string
  totalScore: number | null
  startedAt: string
  completedAt: string | null
  test: { id: string; title: string }
  sectionAttempts: DbSectionAttempt[]
  answers: DbAttemptAnswer[]
}

interface MistakeItem {
  questionId: string
  question: DbQuestion
  sectionName: string
  testTitle: string
  testId: string
  attemptId: string
  answerGiven: DbAnswer | null
  timeSpentSeconds: number
  status: 'wrong' | 'unattempted'
  orderIndex: number
  parentQuestionText?: string
  doubtStatus?: 'doubt' | 'cleared' | null
}

// ─── Helper functions ──────────────────────────────────────────────────────

function dbAnswerToDisplay(ans: DbAnswer | null): string | string[] | number | null {
  if (!ans) return null
  if (ans.value !== undefined) return ans.value
  if (ans.keys) return ans.keys.map((k) => k.toLowerCase())
  if (ans.key) return ans.key.toLowerCase()
  return null
}

function answersMatch(given: DbAnswer | null, correct: DbAnswer): boolean {
  if (!given) return false
  if (correct.value !== undefined) return Math.abs(Number(given.value) - Number(correct.value)) <= 1e-9 + 1e-6 * Math.abs(Number(correct.value))
  if (correct.keys) {
    return (
      JSON.stringify([...(given.keys ?? [])].sort()) ===
      JSON.stringify([...correct.keys].sort())
    )
  }
  if (correct.key) return given.key?.toUpperCase() === correct.key.toUpperCase()
  return false
}

function dbOptionsToDisplay(options: Record<string, string> | null): Array<{ id: string; text: string }> {
  if (!options) return []
  return Object.entries(options).map(([k, v]) => ({ id: k.toLowerCase(), text: v }))
}

function getSubject(item: MistakeItem): 'math' | 'english' | 'other' {
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

// ─── Question item component ────────────────────────────────────────────────

interface MistakeItemComponentProps {
  item: MistakeItem
  index: number
}

function MistakeItemComponent({ item, index }: MistakeItemComponentProps) {
  const [showExplanation, setShowExplanation] = useState(false)
  const [doubtStatus, setDoubtStatus] = useState<'doubt' | 'cleared' | null>(item.doubtStatus ?? null)
  const [savingDoubt, setSavingDoubt] = useState(false)

  const q = item.question
  const options = dbOptionsToDisplay(q.options)
  const userAnswerDisplay = dbAnswerToDisplay(item.answerGiven)
  const correctAnswerDisplay = dbAnswerToDisplay(q.correctAnswer)

  const handleSetDoubt = async (next: 'doubt' | 'cleared') => {
    const prev = doubtStatus
    setDoubtStatus(next)
    setSavingDoubt(true)
    try {
      await api.setDoubtStatus(item.attemptId, q.id, next)
    } catch (err) {
      console.error('Failed to set doubt status', err)
      setDoubtStatus(prev)
    } finally {
      setSavingDoubt(false)
    }
  }

  const badgeBgColor = 'bg-slate-600'

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

          {/* Right Panel: Question */}
          <div className="flex flex-col">
            <div className="px-3 md:px-4 py-3 flex items-start gap-2 md:gap-3 bg-white">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${badgeBgColor}`}>
                  {index + 1}
                </div>
                <XCircle size={14} className={item.status === 'unattempted' ? 'text-slate-400' : 'text-red-500'} />
              </div>
              <div className="text-sm text-slate-800 flex-1 leading-relaxed min-w-0 text-left font-medium">
                <RichContentRenderer content={q.content.text || `Question ${index + 1}`} variant="question" className="prose-sm" />
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {item.timeSpentSeconds ? (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[11px] font-bold">
                    <Clock size={11} className="text-blue-600" />
                    <span>{fmtSec(item.timeSpentSeconds)}</span>
                  </span>
                ) : null}
                <Badge variant={item.status === 'unattempted' ? 'default' : 'danger'} size="sm">
                  {item.status === 'unattempted' ? 'Unattempted' : 'Wrong'}
                </Badge>
              </div>
            </div>

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
              <div className="text-xs text-slate-500 mb-3 p-2 bg-slate-50 rounded border border-slate-100">
                <strong className="text-slate-700">{item.testTitle}</strong> • {item.sectionName}
              </div>
              
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
                <button
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                >
                  {showExplanation ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>Explanation & Doubt Help</span>
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
                <div className="mt-3 space-y-3">
                  {q.content.explanation ? (
                    <div className="p-3 bg-blue-50/50 rounded-lg border-l-4 border-blue-500 text-left text-xs leading-relaxed text-slate-800">
                      <RichContentRenderer content={q.content.explanation} variant="explanation" className="prose-xs" />
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic text-left">No explanation available for this question.</div>
                  )}

                  {/* Doubt CTAs */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
                    <p className="text-[11px] font-medium text-slate-500 text-left">
                      {doubtStatus === 'cleared'
                        ? 'Great — glad this one is cleared!'
                        : doubtStatus === 'doubt'
                        ? "Saved to My Doubts. We'll keep it handy for revision."
                        : 'Is your doubt cleared after reading the explanation?'}
                    </p>
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        onClick={() => handleSetDoubt('doubt')}
                        disabled={savingDoubt}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
                          doubtStatus === 'doubt'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                        }`}
                      >
                        <HelpCircle size={10} /> Still Doubt
                      </button>
                      <button
                        onClick={() => handleSetDoubt('cleared')}
                        disabled={savingDoubt}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
                          doubtStatus === 'cleared'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        <CheckCircle size={10} /> Cleared
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="px-3 md:px-4 py-3 flex items-start gap-2 md:gap-3 bg-white">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${badgeBgColor}`}>
            {index + 1}
          </div>
          <XCircle size={14} className={item.status === 'unattempted' ? 'text-slate-400' : 'text-red-500'} />
        </div>
        <div className="text-sm text-slate-800 flex-1 leading-relaxed min-w-0 text-left">
          <RichContentRenderer content={q.content.text || `Question ${index + 1}`} variant="question" className="prose-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {item.timeSpentSeconds ? (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[11px] font-semibold">
              <Clock size={11} className="text-amber-600" />
              <span>{fmtSec(item.timeSpentSeconds)}</span>
            </span>
          ) : null}
          <Badge variant={item.status === 'unattempted' ? 'default' : 'danger'} size="sm">
            {item.status === 'unattempted' ? 'Unattempted' : 'Wrong'}
          </Badge>
        </div>
      </div>

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
            <span className="text-slate-500">Your answer: <strong className={item.status === 'wrong' ? 'text-red-500' : 'text-slate-500'}>{item.answerGiven?.value ?? '—'}</strong></span>
            <span className="text-slate-500">Correct: <strong className="text-emerald-600">{q.correctAnswer.value}</strong></span>
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
            <span>Explanation & Doubt Help</span>
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
          <div className="mt-3 space-y-3">
            {q.content.explanation ? (
              <div className="p-3 bg-blue-50/50 rounded-lg border-l-4 border-blue-500 text-left text-xs leading-relaxed text-slate-800">
                <RichContentRenderer content={q.content.explanation} variant="explanation" className="prose-xs" />
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic text-left">No explanation available for this question.</div>
            )}

            {/* Doubt CTAs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
              <p className="text-[11px] font-medium text-slate-500 text-left">
                {doubtStatus === 'cleared'
                  ? 'Great — glad this one is cleared!'
                  : doubtStatus === 'doubt'
                  ? "Saved to My Doubts. We'll keep it handy for revision."
                  : 'Is your doubt cleared after reading the explanation?'}
              </p>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  onClick={() => handleSetDoubt('doubt')}
                  disabled={savingDoubt}
                  className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
                    doubtStatus === 'doubt'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  <HelpCircle size={10} /> Still Doubt
                </button>
                <button
                  onClick={() => handleSetDoubt('cleared')}
                  disabled={savingDoubt}
                  className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
                    doubtStatus === 'cleared'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle size={10} /> Cleared
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MistakesPage() {
  const navigate = useNavigate();
  const { dbId } = useAuthStore();

  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'wrong' | 'unattempted'>('all');
  const [subjectFilter, setSubjectFilter] = useState<'all' | 'math' | 'english'>('all');
  const [testScope, setTestScope] = useState<'all' | 'latest' | 'last2' | 'custom'>('all');
  const [selectedAttemptIds, setSelectedAttemptIds] = useState<string[]>([]);
  const [submittedAttempts, setSubmittedAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }

    api.getStudentAttempts(dbId)
      .then(({ attempts: rawAttempts }) => {
        if (!Array.isArray(rawAttempts)) return;

        const submitted = (rawAttempts as any[]).filter(a => a?.status === 'SUBMITTED');
        setSubmittedAttempts(submitted);
        
        // Fetch full details for each attempt
        Promise.all(submitted.map(a => api.getAttempt(a.id).catch(() => null)))
          .then((fullAttempts) => {
            // Extract mistakes from all attempts
            const allMistakes: MistakeItem[] = [];

            fullAttempts.forEach((fullData) => {
              if (!fullData) return;
              const attempt = fullData.attempt as DbAttempt;

              const answersMap = new Map((attempt.answers ?? []).map((a: DbAttemptAnswer) => [a.questionId, a]));

              const sections = attempt.sectionAttempts ?? [];
              sections.forEach((sa: DbSectionAttempt) => {
                const section = sa.section;
                const flattenedQuestions: DbTestQuestion[] = [];

                (section.questions ?? []).forEach((tq: DbTestQuestion) => {
                  const q = tq.question;
                  const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
                  
                  if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
                    q.childQuestions.forEach((cq: DbQuestion) => {
                      flattenedQuestions.push({
                        id: cq.id,
                        questionId: cq.id,
                        orderIndex: tq.orderIndex,
                        question: {
                          ...cq,
                          parentQuestionText: q.content.text,
                        } as any,
                      });
                    });
                  } else if (!(q as any).parentQuestionId) {
                    // Skip child rows: already emitted via their passage parent above.
                    flattenedQuestions.push(tq);
                  }
                });

                // For each question, check if it's wrong or unattempted
                flattenedQuestions.forEach((tq: DbTestQuestion) => {
                  const ans = answersMap.get(tq.questionId);
                  const isUnattempted = !ans || !ans.answerGiven;
                  const isWrong = ans && ans.answerGiven && !answersMatch(ans.answerGiven, tq.question.correctAnswer);

                  if (isWrong || isUnattempted) {
                    allMistakes.push({
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
                      parentQuestionText: (tq.question as any).parentQuestionText,
                      doubtStatus: ans?.doubtStatus ?? null,
                    });
                  }
                });
              });
            });

            setMistakes(allMistakes);
          })
          .catch((e: Error) => setError(e.message))
          .finally(() => setLoading(false));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dbId]);

  // 1. Filter by test scope
  const mistakesForScope = mistakes.filter(m => {
    if (testScope === 'all') return true;
    if (testScope === 'latest') {
      return m.attemptId === submittedAttempts[0]?.id;
    }
    if (testScope === 'last2') {
      const activeIds = submittedAttempts.slice(0, 2).map(a => a.id);
      return activeIds.includes(m.attemptId);
    }
    if (testScope === 'custom') {
      return selectedAttemptIds.includes(m.attemptId);
    }
    return true;
  });

  // 2. Filter by subject
  const mistakesForSubject = mistakesForScope.filter(m => {
    if (subjectFilter === 'all') return true;
    return getSubject(m) === subjectFilter;
  });

  const totalCount = mistakesForSubject.length;
  const wrongCount = mistakesForSubject.filter(m => m.status === 'wrong').length;
  const unattemptedCount = mistakesForSubject.filter(m => m.status === 'unattempted').length;

  // 3. Finally, filter by mistake status (wrong vs unattempted)
  const filtered = mistakesForSubject.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60 gap-2 text-slate-400 text-sm">
        <Loader2 size={18} className="animate-spin" /> Loading mistakes…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="Go back"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Review Mistakes</h1>
          <p className="text-slate-400 text-sm mt-0.5">Wrong and unattempted questions from all tests</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {mistakes.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Mistakes', value: totalCount, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Wrong', value: wrongCount, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Unattempted', value: unattemptedCount, color: 'text-slate-600', bg: 'bg-slate-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-100 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {mistakes.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
          <p className="text-slate-600 font-medium">Perfect! No mistakes found</p>
          <p className="text-slate-400 text-sm mt-1">All your answers were correct</p>
        </div>
      ) : (
        <>
          {/* Filters Bar */}
          <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              {/* Status Filter */}
              <div className="flex flex-wrap items-center gap-1.5 flex-1">
                <span className="text-xs font-semibold text-slate-500 mr-1 uppercase tracking-wider">Status:</span>
                {[
                  { value: 'all' as const, label: 'All Mistakes' },
                  { value: 'wrong' as const, label: 'Wrong Only' },
                  { value: 'unattempted' as const, label: 'Unattempted Only' },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      filter === f.value
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Subject Filter */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 mr-1 uppercase tracking-wider">Subject:</span>
                {[
                  { value: 'all' as const, label: 'All Subjects' },
                  { value: 'math' as const, label: 'Maths' },
                  { value: 'english' as const, label: 'English' },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setSubjectFilter(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      subjectFilter === f.value
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Scope Filter */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200/60 pt-3">
              <span className="text-xs font-semibold text-slate-500 mr-1 uppercase tracking-wider">Tests:</span>
              {[
                { value: 'all' as const, label: 'All Tests' },
                { value: 'latest' as const, label: 'Latest Test' },
                { value: 'last2' as const, label: 'Last 2 Tests' },
                { value: 'custom' as const, label: 'Custom Selection...' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setTestScope(f.value);
                    if (f.value === 'custom' && selectedAttemptIds.length === 0 && submittedAttempts.length > 0) {
                      setSelectedAttemptIds([submittedAttempts[0].id]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    testScope === f.value
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Custom Picker Checkbox List */}
            {testScope === 'custom' && submittedAttempts.length > 0 && (
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 max-h-40 overflow-y-auto animate-fade-in">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Tests to Include:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {submittedAttempts.map((attempt) => {
                    const isChecked = selectedAttemptIds.includes(attempt.id);
                    const formattedDate = attempt.completedAt
                      ? new Date(attempt.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : new Date(attempt.startedAt).toLocaleDateString();
                    return (
                      <label
                        key={attempt.id}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-blue-50/50 border-blue-200 text-blue-700'
                            : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedAttemptIds((prev) =>
                              prev.includes(attempt.id)
                                ? prev.filter((id) => id !== attempt.id)
                                : [...prev, attempt.id]
                            );
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate text-slate-800">{attempt.test?.title ?? 'Unknown Test'}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{formattedDate} · Score: {attempt.totalScore ?? '—'}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Questions list */}
          <div className="space-y-4">
            {filtered.map((item, idx) => (
              <MistakeItemComponent key={`${item.attemptId}-${item.questionId}`} item={item} index={idx} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
              <p className="text-slate-600 font-medium">No {filter} mistakes</p>
              <p className="text-slate-400 text-sm mt-1">Try selecting a different filter</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
