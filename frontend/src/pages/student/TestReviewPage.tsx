import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Loader2, Filter } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ─── DB types ─────────────────────────────────────────────────────────────────

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

// ─── Display helpers ──────────────────────────────────────────────────────────

function dbAnswerToDisplay(ans: DbAnswer | null): string | string[] | number | null {
  if (!ans) return null
  if (ans.value !== undefined) return ans.value
  if (ans.keys) return ans.keys.map((k) => k.toLowerCase())
  if (ans.key) return ans.key.toLowerCase()
  return null
}

function answersMatch(given: DbAnswer | null, correct: DbAnswer): boolean {
  if (!given) return false
  // Numeric
  if (correct.value !== undefined) return given.value === correct.value
  // MSQ — order-independent
  if (correct.keys) {
    return (
      JSON.stringify([...(given.keys ?? [])].sort()) ===
      JSON.stringify([...correct.keys].sort())
    )
  }
  // MCQ — case-insensitive
  if (correct.key) return given.key?.toUpperCase() === correct.key.toUpperCase()
  return false
}

function dbOptionsToDisplay(options: Record<string, string> | null): Array<{ id: string; text: string }> {
  if (!options) return []
  return Object.entries(options).map(([k, v]) => ({ id: k.toLowerCase(), text: v }))
}

// ─── Question review item ─────────────────────────────────────────────────────

interface ReviewItemProps {
  tq: DbTestQuestion
  index: number
  studentAnswer: DbAttemptAnswer | undefined
}

function QuestionReviewItem({ tq, index, studentAnswer }: ReviewItemProps) {
  const [showExplanation, setShowExplanation] = useState(false)
  const q = tq.question
  const correct = answersMatch(studentAnswer?.answerGiven ?? null, q.correctAnswer)
  const skipped = !studentAnswer?.answerGiven
  const options = dbOptionsToDisplay(q.options)
  const userAnswerDisplay = dbAnswerToDisplay(studentAnswer?.answerGiven ?? null)
  const correctAnswerDisplay = dbAnswerToDisplay(q.correctAnswer)

  const parentQuestionText = (q as any).parentQuestionText;

  if (parentQuestionText) {
    return (
      <div className={`border-2 rounded-xl overflow-hidden ${correct ? 'border-emerald-200' : skipped ? 'border-slate-200' : 'border-red-200'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 bg-white">
          {/* Left Panel: Passage */}
          <div className="p-4 bg-slate-50 text-left overflow-y-auto max-h-[400px]">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 border-b border-slate-200/60 pb-1 flex-shrink-0">Reading Passage</h4>
            <div className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed">
              <RichContentRenderer content={parentQuestionText} variant="question" className="prose-sm" />
            </div>
          </div>

          {/* Right Panel: Question */}
          <div className="flex flex-col">
            <div className={`px-3 md:px-4 py-3 flex items-start gap-2 md:gap-3 ${correct ? 'bg-emerald-50' : skipped ? 'bg-slate-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${correct ? 'bg-emerald-500' : skipped ? 'bg-slate-400' : 'bg-red-500'}`}>
                  {index + 1}
                </div>
                {correct ? <CheckCircle size={14} className="text-emerald-600" /> : <XCircle size={14} className={skipped ? 'text-slate-400' : 'text-red-500'} />}
              </div>
              <div className="text-sm text-slate-800 flex-1 leading-relaxed min-w-0 text-left font-medium">
                <RichContentRenderer content={q.content.text || `Question ${index + 1}`} variant="question" className="prose-sm" />
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {studentAnswer?.timeSpentSeconds ? (
                  <span className="text-xs text-slate-500 hidden sm:flex items-center gap-1"><Clock size={9} />{studentAnswer.timeSpentSeconds}s</span>
                ) : null}
                <Badge variant={correct ? 'success' : skipped ? 'default' : 'danger'} size="sm">
                  {correct ? 'Correct' : skipped ? 'Skip' : 'Wrong'}
                </Badge>
              </div>
            </div>

            <div className="px-3 md:px-4 py-3 bg-white flex-1 flex flex-col justify-between">
              <div>
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
                    <span className="text-slate-500">Your answer: <strong className={correct ? 'text-emerald-600' : 'text-red-500'}>{studentAnswer?.answerGiven?.value ?? '—'}</strong></span>
                    <span className="text-slate-500">Correct: <strong className="text-emerald-600">{q.correctAnswer.value}</strong></span>
                  </div>
                )}
              </div>
              <div>
                {q.content.explanation && (
                  <div className="text-left mt-2">
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
      </div>
    );
  }

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${correct ? 'border-emerald-200' : skipped ? 'border-slate-200' : 'border-red-200'}`}>
      <div className={`px-3 md:px-4 py-3 flex items-start gap-2 md:gap-3 ${correct ? 'bg-emerald-50' : skipped ? 'bg-slate-50' : 'bg-red-50'}`}>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${correct ? 'bg-emerald-500' : skipped ? 'bg-slate-400' : 'bg-red-500'}`}>
            {index + 1}
          </div>
          {correct ? <CheckCircle size={14} className="text-emerald-600" /> : <XCircle size={14} className={skipped ? 'text-slate-400' : 'text-red-500'} />}
        </div>
        <div className="text-sm text-slate-800 flex-1 leading-relaxed min-w-0 text-left">
          <RichContentRenderer content={q.content.text || `Question ${index + 1}`} variant="question" className="prose-sm" />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {studentAnswer?.timeSpentSeconds ? (
            <span className="text-xs text-slate-500 hidden sm:flex items-center gap-1"><Clock size={9} />{studentAnswer.timeSpentSeconds}s</span>
          ) : null}
          <Badge variant={correct ? 'success' : skipped ? 'default' : 'danger'} size="sm">
            {correct ? 'Correct' : skipped ? 'Skip' : 'Wrong'}
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
            <span className="text-slate-500">Your answer: <strong className={correct ? 'text-emerald-600' : 'text-red-500'}>{studentAnswer?.answerGiven?.value ?? '—'}</strong></span>
            <span className="text-slate-500">Correct: <strong className="text-emerald-600">{q.correctAnswer.value}</strong></span>
          </div>
        )}
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

export function TestReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isTutorOrAdmin = user?.role === 'tutor' || user?.role === 'admin' || user?.role === 'super_admin';
  const [activeSection, setActiveSection] = useState(0);
  const [attempt, setAttempt] = useState<DbAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questionFilter, setQuestionFilter] = useState<'all' | 'correct' | 'incorrect' | 'skipped'>('all');

  useEffect(() => {
    if (!attemptId) { setError('No attempt ID'); setLoading(false); return; }
    api.getAttempt(attemptId)
      .then(({ attempt: raw }) => setAttempt(raw as DbAttempt))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <Loader2 size={24} className="text-blue-500 animate-spin" />
    </div>
  );

  if (error || !attempt) return (
    <div className="text-center py-16">
      <p className="text-red-500 font-medium">{error ?? 'Attempt not found'}</p>
      <button onClick={() => navigate(-1)} className="mt-3 text-sm text-blue-600 hover:underline">Go back</button>
    </div>
  );

  // Build answer lookup map
  const answersMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  // Sort sections by orderIndex and flatten passage questions
  const rawSections = [...attempt.sectionAttempts].sort((a, b) => a.section.orderIndex - b.section.orderIndex);
  const sections = rawSections.map((sa) => {
    const flattenedQuestions: DbTestQuestion[] = [];
    sa.section.questions.forEach((tq) => {
      const q = tq.question;
      const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
      if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
        q.childQuestions.forEach((cq) => {
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

    return {
      ...sa,
      section: {
        ...sa.section,
        questions: flattenedQuestions,
      },
    };
  });

  // Compute section analytics
  const sectionStats = sections.map((sa) => {
    let correct = 0, incorrect = 0, skipped = 0;
    sa.section.questions.forEach((tq) => {
      const ans = answersMap.get(tq.questionId)
      if (!ans || !ans.answerGiven) { skipped++; return; }
      if (answersMatch(ans.answerGiven, tq.question.correctAnswer)) correct++;
      else incorrect++;
    });
    const total = sa.section.questions.length;
    return { name: sa.section.name, correct, incorrect, skipped, total, accuracy: total > 0 ? Math.round(correct / total * 100) : 0 };
  });

  const totalQ = sectionStats.reduce((a, s) => a + s.total, 0);
  const totalCorrect = sectionStats.reduce((a, s) => a + s.correct, 0);
  const overallAccuracy = totalQ > 0 ? Math.round(totalCorrect / totalQ * 100) : 0;
  const rawScore = attempt.totalScore ?? totalCorrect;

  const activeSecData = sections[activeSection];
  const activeSectionStats = sectionStats[activeSection];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 flex-shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-slate-900 truncate">Test Review: {attempt.test.title}</h1>
          <p className="text-sm text-slate-500">
            {attempt.status === 'SUBMITTED' || attempt.status === 'EVALUATED' ? 'Completed' : attempt.status}
            {attempt.completedAt ? ` · ${new Date(attempt.completedAt).toLocaleDateString()}` : ''}
          </p>
        </div>
      </div>

      {/* Score summary */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-4 md:p-6 text-white">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="col-span-2 sm:col-span-1 text-center bg-white/10 rounded-xl p-3 md:p-4">
            <p className="text-3xl md:text-5xl font-bold">{rawScore}</p>
            <p className="text-blue-200 text-xs mt-1">Score</p>
            <p className="text-blue-300 text-xs">(raw points)</p>
          </div>
          {sectionStats.map((sec) => (
            <div key={sec.name} className="text-center bg-white/10 rounded-xl p-3">
              <p className="text-2xl md:text-3xl font-bold">{sec.accuracy}%</p>
              <p className="text-blue-200 text-xs mt-1 truncate">{sec.name}</p>
              <p className="text-blue-300 text-xs">{sec.correct}/{sec.total}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-blue-500/50 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg md:text-xl font-bold">{overallAccuracy}%</p>
            <p className="text-blue-300 text-xs">Accuracy</p>
          </div>
          <div>
            <p className="text-lg md:text-xl font-bold">{totalCorrect}/{totalQ}</p>
            <p className="text-blue-300 text-xs">Correct</p>
          </div>
          <div>
            <p className="text-lg md:text-xl font-bold">
              {attempt.completedAt && attempt.startedAt
                ? `${Math.round((new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime()) / 60000)}m`
                : '—'}
            </p>
            <p className="text-blue-300 text-xs">Time Used</p>
          </div>
        </div>
      </div>

      {/* Section bar chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Section Breakdown</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sectionStats} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="correct" fill="#10b981" radius={[4, 4, 0, 0]} name="Correct" barSize={20} />
            <Bar dataKey="incorrect" fill="#ef4444" radius={[4, 4, 0, 0]} name="Wrong" barSize={20} />
            <Bar dataKey="skipped" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Skipped" barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Section tabs + question review */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="border-b border-slate-200 flex overflow-x-auto">
          {sections.map((sa, idx) => (
            <button key={sa.sectionId} onClick={() => setActiveSection(idx)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all ${
                activeSection === idx ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {sa.section.name}
              <span className={`ml-1.5 text-xs ${activeSection === idx ? 'text-blue-400' : 'text-slate-400'}`}>
                {sectionStats[idx]?.correct}/{sectionStats[idx]?.total}
              </span>
            </button>
          ))}
        </div>

        <div className="p-4 md:p-6">
          {/* Section stats */}
          {activeSectionStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 mb-5">
              {[
                { label: 'Correct', value: activeSectionStats.correct, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Wrong', value: activeSectionStats.incorrect, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Skipped', value: activeSectionStats.skipped, color: 'text-slate-600', bg: 'bg-slate-50' },
                { label: 'Accuracy', value: `${activeSectionStats.accuracy}%`, color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Question Status Filter */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mr-1">
              <Filter size={13} className="text-slate-400" />
              Filter:
            </div>
            {[
              { key: 'all' as const, label: 'All Questions', color: 'blue' },
              { key: 'correct' as const, label: 'Correct', color: 'emerald' },
              { key: 'incorrect' as const, label: 'Incorrect', color: 'red' },
              { key: 'skipped' as const, label: 'Skipped', color: 'slate' },
            ].map((f) => {
              const isActive = questionFilter === f.key;
              const count = f.key === 'all'
                ? activeSecData?.section.questions.length ?? 0
                : (activeSecData?.section.questions.filter((tq) => {
                    const ans = answersMap.get(tq.questionId);
                    const isCorrect = ans?.answerGiven ? answersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
                    const isSkipped = !ans?.answerGiven;
                    if (f.key === 'correct') return isCorrect;
                    if (f.key === 'incorrect') return !isCorrect && !isSkipped;
                    return isSkipped; // skipped
                  }).length ?? 0);
              return (
                <button
                  key={f.key}
                  onClick={() => setQuestionFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                    isActive
                      ? f.color === 'blue' ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : f.color === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : f.color === 'red' ? 'bg-red-500 text-white border-red-500 shadow-sm'
                        : 'bg-slate-600 text-white border-slate-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Questions */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {activeSecData?.section.questions
              .map((tq, idx) => ({ tq, idx, answer: answersMap.get(tq.questionId) }))
              .filter(({ tq, answer }) => {
                if (questionFilter === 'all') return true;
                const isCorrect = answer?.answerGiven ? answersMatch(answer.answerGiven, tq.question.correctAnswer) : false;
                const isSkipped = !answer?.answerGiven;
                if (questionFilter === 'correct') return isCorrect;
                if (questionFilter === 'incorrect') return !isCorrect && !isSkipped;
                return isSkipped; // skipped
              })
              .map(({ tq, idx, answer }) => (
                <QuestionReviewItem
                  key={tq.id}
                  tq={tq}
                  index={idx}
                  studentAnswer={answer}
                />
              ))}
            {activeSecData?.section.questions.length ? (
              activeSecData.section.questions
                .filter((tq) => {
                  if (questionFilter === 'all') return true;
                  const ans = answersMap.get(tq.questionId);
                  const isCorrect = ans?.answerGiven ? answersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
                  const isSkipped = !ans?.answerGiven;
                  if (questionFilter === 'correct') return isCorrect;
                  if (questionFilter === 'incorrect') return !isCorrect && !isSkipped;
                  return isSkipped;
                }).length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                    No {questionFilter} questions in this section.
                  </div>
                )
            ) : null}
          </div>
        </div>
      </div>

      {/* Actions */}
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
            <Button variant="secondary" onClick={() => navigate('/my-progress')}>View Progress</Button>
          </>
        )}
      </div>
    </div>
  );
}
