import { fmtSec, formatDate } from '../../lib/utils';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import { api } from '../../lib/api';
import { AttemptAnalysis } from '../../components/report/AttemptAnalysis';
import { useAuthStore } from '../../store/useAuthStore';
import { formatNumericDisplay, numericEqual } from '../../lib/numericAnswer';

// ─── DB types ─────────────────────────────────────────────────────────────────

interface DbAnswer {
  key?: string
  keys?: string[]
  value?: number
  values?: number[]
  text?: string
  displayValues?: string[]
}

interface DbQuestion {
  id: string
  type: string
  content: { text: string; explanation?: string | null; meta?: { domain?: string; subTopic?: string; skill?: string } }
  options: Record<string, string> | null
  correctAnswer: DbAnswer
  difficultyLevel: string
  subject?: string | null
  topic?: { name: string; parent?: { name: string } | null } | null
  childQuestions?: DbQuestion[]
}

export interface DbTestQuestion {
  id: string
  questionId: string
  orderIndex: number
  question: DbQuestion
  parentPassageText?: string
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

export interface DbAttempt {
  id: string
  testId: string
  status: string
  totalScore: number | null
  startedAt: string
  completedAt: string | null
  test: { id: string; title: string; category?: string | null }
  sectionAttempts: DbSectionAttempt[]
  answers: DbAttemptAnswer[]
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function dbAnswerToDisplay(ans: DbAnswer | null): string | string[] | number | null {
  if (!ans) return null
  if (ans.value !== undefined) return ans.text ?? ans.displayValues?.[0] ?? formatNumericDisplay(ans.value)
  if (ans.keys) return ans.keys.map((k) => k.toLowerCase())
  if (ans.key) return ans.key.toLowerCase()
  return null
}

function answersMatch(given: DbAnswer | null, correct: DbAnswer): boolean {
  if (!given || !correct) return false
  // Numeric
  if (correct.value !== undefined) {
    if (Array.isArray(correct.values) && correct.values.length > 0) {
      return correct.values.some((v) => numericEqual(given.value, v));
    }
    return numericEqual(given.value, correct.value);
  }
  // MSQ — order-independent
  if (correct.keys) {
    if (!given.keys) return false;
    const gKeys = given.keys.map((k) => String(k).toUpperCase().trim()).sort()
    const cKeys = correct.keys.map((k) => String(k).toUpperCase().trim()).sort()
    return JSON.stringify(gKeys) === JSON.stringify(cKeys)
  }
  // MCQ — case-insensitive
  if (correct.key !== undefined) {
    if (given.key === undefined) return false;
    return String(given.key).toUpperCase().trim() === String(correct.key).toUpperCase().trim();
  }
  return false
}

function dbOptionsToDisplay(options: Record<string, string> | null): Array<{ id: string; text: string }> {
  if (!options) return []
  return Object.entries(options).map(([k, v]) => ({ id: k.toLowerCase(), text: v }))
}

// ─── Question review item ─────────────────────────────────────────────────────

// ─── Knowledge & Skills: SAT content domains (static blueprint) ────────────────

interface ReviewItemProps {
  tq: DbTestQuestion
  index: number
  studentAnswer: DbAttemptAnswer | undefined
}

export function QuestionReviewItem({ tq, index, studentAnswer }: ReviewItemProps) {
  const [showExplanation, setShowExplanation] = useState(false)
  const q = tq.question
  const correct = answersMatch(studentAnswer?.answerGiven ?? null, q.correctAnswer)
  const skipped = !studentAnswer?.answerGiven
  const options = dbOptionsToDisplay(q.options)
  const userAnswerDisplay = dbAnswerToDisplay(studentAnswer?.answerGiven ?? null)
  const correctAnswerDisplay = dbAnswerToDisplay(q.correctAnswer)

  const parentPassageText = (q as any).parentQuestionText || (tq as any).parentPassageText;
  const parentPassageExplanation = (tq as any).parentPassageExplanation || (q as any)?.parentQuestion?.content?.explanation;
  const explanationText = q.content?.explanation || parentPassageExplanation || (q as any)?.explanation || null;

  if (parentPassageText) {
    return (
      <div className={`border-2 rounded-xl overflow-hidden ${correct ? 'border-blue-300' : skipped ? 'border-slate-200' : 'border-blue-100'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 bg-white">
          {/* Left Panel: Passage */}
          <div className="p-4 bg-slate-50 text-left">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 border-b border-slate-200/60 pb-1 flex-shrink-0">Reading Passage</h4>
            <div className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed">
              <RichContentRenderer content={parentPassageText} variant="question" className="prose-sm" />
            </div>
          </div>

          {/* Right Panel: Question */}
          <div className="flex flex-col">
            <div className={`px-3 md:px-4 py-3 flex items-start gap-2 md:gap-3 ${correct ? 'bg-blue-50/55' : skipped ? 'bg-slate-50' : 'bg-sky-50/40'}`}>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${correct ? 'bg-blue-600' : skipped ? 'bg-slate-400' : 'bg-blue-400'}`}>
                  {index + 1}
                </div>
                {correct ? <CheckCircle size={14} className="text-blue-600" /> : <XCircle size={14} className={skipped ? 'text-slate-400' : 'text-blue-400'} />}
              </div>
              <div className="text-sm text-slate-800 flex-1 leading-relaxed min-w-0 text-left font-medium">
                <RichContentRenderer content={q.content.text || `Question ${index + 1}`} variant="question" className="prose-sm" />
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {studentAnswer?.timeSpentSeconds ? (
                  <span className="text-xs font-bold text-blue-600 hidden sm:flex items-center gap-1"><Clock size={9} />{fmtSec(studentAnswer.timeSpentSeconds)}</span>
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

            <div className="px-3 md:px-4 py-3 bg-white flex-1 flex flex-col justify-between">
              <div>
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
                          colorTheme="blue"
                        />
                      );
                    })}
                  </div>
                )}
                {q.type === 'NUMERIC' && (
                  <div className="flex gap-4 text-sm mb-3 text-left">
                    <span className="text-slate-500">Your answer: <strong className={correct ? 'text-blue-600' : 'text-blue-400'}>{studentAnswer?.answerGiven?.text ?? (studentAnswer?.answerGiven?.value !== undefined ? formatNumericDisplay(studentAnswer.answerGiven.value) : null) ?? '—'}</strong></span>
                    <span className="text-slate-500">Correct: <strong className="text-blue-600">{(q.correctAnswer.displayValues && q.correctAnswer.displayValues.length > 0 ? q.correctAnswer.displayValues.join(' or ') : (q.correctAnswer.value !== undefined ? formatNumericDisplay(q.correctAnswer.value) : ''))}</strong></span>
                  </div>
                )}
              </div>
              <div>
                {explanationText && (
                  <div className="text-left mt-2">
                    <button onClick={() => setShowExplanation(!showExplanation)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                      {showExplanation ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      {showExplanation ? 'Hide' : 'Show'} Explanation
                    </button>
                  </div>
                )}
                {showExplanation && explanationText && (
                  <div className="mt-3 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500 text-left">
                    <RichContentRenderer content={explanationText} variant="explanation" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${correct ? 'border-blue-300' : skipped ? 'border-slate-200' : 'border-blue-100'}`}>
      <div className={`px-3 md:px-4 py-3 flex items-start gap-2 md:gap-3 ${correct ? 'bg-blue-50/55' : skipped ? 'bg-slate-50' : 'bg-sky-50/40'}`}>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${correct ? 'bg-blue-600' : skipped ? 'bg-slate-400' : 'bg-blue-400'}`}>
            {index + 1}
          </div>
          {correct ? <CheckCircle size={14} className="text-blue-600" /> : <XCircle size={14} className={skipped ? 'text-slate-400' : 'text-blue-400'} />}
        </div>
        <div className="text-sm text-slate-800 flex-1 leading-relaxed min-w-0 text-left">
          <RichContentRenderer content={q.content.text || `Question ${index + 1}`} variant="question" className="prose-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {studentAnswer?.timeSpentSeconds ? (
            <span className="text-xs text-slate-500 hidden sm:flex items-center gap-1"><Clock size={9} />{fmtSec(studentAnswer.timeSpentSeconds)}</span>
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
                  colorTheme="blue"
                />
              );
            })}
          </div>
        )}
        {q.type === 'NUMERIC' && (
          <div className="flex gap-4 text-sm mb-3 text-left">
            <span className="text-slate-500">Your answer: <strong className={correct ? 'text-blue-600' : 'text-blue-400'}>{studentAnswer?.answerGiven?.text ?? (studentAnswer?.answerGiven?.value !== undefined ? formatNumericDisplay(studentAnswer.answerGiven.value) : null) ?? '—'}</strong></span>
            <span className="text-slate-500">Correct: <strong className="text-blue-600">{(q.correctAnswer.displayValues && q.correctAnswer.displayValues.length > 0 ? q.correctAnswer.displayValues.join(' or ') : (q.correctAnswer.value !== undefined ? formatNumericDisplay(q.correctAnswer.value) : ''))}</strong></span>
          </div>
        )}
        {explanationText && (
          <div className="text-left">
            <button onClick={() => setShowExplanation(!showExplanation)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              {showExplanation ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {showExplanation ? 'Hide' : 'Show'} Explanation
            </button>
          </div>
        )}
        {showExplanation && explanationText && (
          <div className="mt-3 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500 text-left">
            <RichContentRenderer content={explanationText} variant="explanation" />
          </div>
        )}
      </div>
    </div>
  )
}
// ─── Main page ────────────────────────────────────────────────────────────────

export function TestReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();
  const isTutorOrAdmin = user?.role === 'tutor' || user?.role === 'admin' || user?.role === 'super_admin';
  const [allAttempts, setAllAttempts] = useState<Array<{ id: string; test: { title: string }; completedAt: string | null }>>([]);

  // Load all submitted attempts so student can switch tests from the dropdown
  useEffect(() => {
    if (!dbId || isTutorOrAdmin) return;
    api.getStudentAttempts(dbId)
      .then(r => {
        const submitted = ((r.attempts as any[]) ?? []).filter(a => a.status === 'SUBMITTED');
        setAllAttempts(submitted);
      })
      .catch(() => {});
  }, [dbId, isTutorOrAdmin]);

  if (!attemptId) return (
    <div className="text-center py-16">
      <p className="text-red-500 font-medium">No attempt ID</p>
      <button onClick={() => navigate(-1)} className="mt-3 text-sm text-blue-600 hover:underline">Go back</button>
    </div>
  );

  // The analysis itself is the same component the admin and tutor portals use,
  // so all three accounts see one screen; only this header and footer differ.
  return (
    <AttemptAnalysis
      attemptId={attemptId}
      header={(attempt) => (
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-shrink-0 mt-1 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Test Review</p>
            {!isTutorOrAdmin && allAttempts.length > 0 ? (
              <select
                value={attemptId}
                onChange={e => navigate(`/test-review/${e.target.value}`)}
                className="mt-1 w-full max-w-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-bold text-base px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: '30px' }}
              >
                {allAttempts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.test.title}{a.completedAt ? ` — ${formatDate(a.completedAt)}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 mt-0.5 truncate">{attempt.test.title}</h1>
            )}
            {attempt.completedAt && (
              <p className="text-slate-400 text-xs mt-1">
                Completed {formatDate(attempt.completedAt)}
              </p>
            )}
          </div>
        </div>
      )}
      footer={
        <div className="flex flex-wrap gap-3 justify-end">
          {isTutorOrAdmin ? (
            <>
              <Button variant="secondary" onClick={() => navigate(-1)}>Back to Student</Button>
              <Button variant="secondary" onClick={() => navigate('/dashboard')}>Dashboard</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => navigate('/dashboard')}>Dashboard</Button>
              <Button variant="secondary" onClick={() => navigate('/my-tests')}>My Tests</Button>
            </>
          )}
        </div>
      }
    />
  );
}
