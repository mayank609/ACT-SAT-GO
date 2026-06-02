import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react';
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
  if (correct.value !== undefined) return given.value === correct.value
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

// ─── Question item component ────────────────────────────────────────────────

interface MistakeItemComponentProps {
  item: MistakeItem
  index: number
}

function MistakeItemComponent({ item, index }: MistakeItemComponentProps) {
  const [showExplanation, setShowExplanation] = useState(false)
  const q = item.question
  const options = dbOptionsToDisplay(q.options)
  const userAnswerDisplay = dbAnswerToDisplay(item.answerGiven)
  const correctAnswerDisplay = dbAnswerToDisplay(q.correctAnswer)

  const borderColor = item.status === 'unattempted' ? 'border-slate-200' : 'border-red-200'
  const bgColor = item.status === 'unattempted' ? 'bg-slate-50' : 'bg-red-50'
  const badgeBgColor = item.status === 'unattempted' ? 'bg-slate-400' : 'bg-red-500'

  if (item.parentQuestionText) {
    return (
      <div className={`border-2 rounded-xl overflow-hidden ${borderColor}`}>
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
            <div className={`px-3 md:px-4 py-3 flex items-start gap-2 md:gap-3 ${bgColor}`}>
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
                  <span className="text-xs text-slate-500 hidden sm:flex items-center gap-1"><Clock size={9} />{item.timeSpentSeconds}s</span>
                ) : null}
                <Badge variant={item.status === 'unattempted' ? 'default' : 'danger'} size="sm">
                  {item.status === 'unattempted' ? 'Unattempted' : 'Wrong'}
                </Badge>
              </div>
            </div>

            <div className="px-3 md:px-4 py-3 bg-white">
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
                      />
                    );
                  })}
                </div>
              )}
              <div className="text-xs text-slate-500 mb-3 p-2 bg-slate-50 rounded border border-slate-100">
                <strong className="text-slate-700">{item.testTitle}</strong> • {item.sectionName}
              </div>
              {q.content.explanation && (
                <div className="text-left">
                  <button onClick={() => setShowExplanation(!showExplanation)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                    {showExplanation ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    {showExplanation ? 'Hide' : 'Show'} Explanation
                  </button>
                </div>
              )}
              {showExplanation && q.content.explanation && (
                <div className="mt-3 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500 text-left">
                  <RichContentRenderer content={q.content.explanation} variant="explanation" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${borderColor}`}>
      <div className={`px-3 md:px-4 py-3 flex items-start gap-2 md:gap-3 ${bgColor}`}>
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
            <span className="text-xs text-slate-500 hidden sm:flex items-center gap-1"><Clock size={9} />{item.timeSpentSeconds}s</span>
          ) : null}
          <Badge variant={item.status === 'unattempted' ? 'default' : 'danger'} size="sm">
            {item.status === 'unattempted' ? 'Unattempted' : 'Wrong'}
          </Badge>
        </div>
      </div>

      <div className="px-3 md:px-4 py-3 bg-white">
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
        {q.content.explanation && (
          <div className="text-left">
            <button onClick={() => setShowExplanation(!showExplanation)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              {showExplanation ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {showExplanation ? 'Hide' : 'Show'} Explanation
            </button>
          </div>
        )}
        {showExplanation && q.content.explanation && (
          <div className="mt-3 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500 text-left">
            <RichContentRenderer content={q.content.explanation} variant="explanation" />
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }

    api.getStudentAttempts(dbId)
      .then(({ attempts: rawAttempts }) => {
        if (!Array.isArray(rawAttempts)) return;

        const submitted = (rawAttempts as any[]).filter(a => a?.status === 'SUBMITTED');
        
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
                  } else {
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

  const filtered = mistakes.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const wrongCount = mistakes.filter(m => m.status === 'wrong').length;
  const unattemptedCount = mistakes.filter(m => m.status === 'unattempted').length;

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
            { label: 'Total Mistakes', value: mistakes.length, color: 'text-blue-600', bg: 'bg-blue-50' },
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
          {/* Filter buttons */}
          <div className="flex gap-2">
            {[
              { value: 'all' as const, label: 'All Mistakes' },
              { value: 'wrong' as const, label: 'Wrong Only' },
              { value: 'unattempted' as const, label: 'Unattempted Only' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
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
