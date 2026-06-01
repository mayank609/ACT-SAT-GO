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
  const [questionFilter, setQuestionFilter] = useState<'all' | 'correct' | 'incorrect' | 'skipped' | 'marked'>('all');
  const [attempt, setAttempt] = useState<DbAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('');

  useEffect(() => {
    if (!attemptId) { setError('No attempt ID'); setLoading(false); return; }
    api.getAttempt(attemptId)
      .then(({ attempt: raw }) => setAttempt(raw as DbAttempt))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [attemptId]);

  useEffect(() => {
    if (!attempt) return;
    
    // Sort and retrieve active section data
    const sortedSections = [...attempt.sectionAttempts].sort((a, b) => a.section.orderIndex - b.section.orderIndex);
    const activeSecData = sortedSections[activeSection];
    if (!activeSecData) return;

    // Flatten passage questions if needed
    const flattenedQuestions: DbTestQuestion[] = [];
    activeSecData.section.questions.forEach((tq) => {
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

    const answersMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

    const filtered = flattenedQuestions.filter((tq) => {
      const ans = answersMap.get(tq.questionId);
      if (questionFilter === 'correct') return !!ans?.answerGiven && answersMatch(ans.answerGiven, tq.question.correctAnswer);
      if (questionFilter === 'incorrect') return !!ans?.answerGiven && !answersMatch(ans.answerGiven, tq.question.correctAnswer);
      if (questionFilter === 'skipped') return !ans?.answerGiven;
      if (questionFilter === 'marked') return ans?.isFlagged === true;
      return true;
    });

    if (filtered.length > 0) {
      const exists = filtered.some((q) => q.questionId === selectedQuestionId);
      if (!exists) {
        setSelectedQuestionId(filtered[0].questionId);
      }
    } else {
      setSelectedQuestionId('');
    }
  }, [activeSection, questionFilter, attempt, selectedQuestionId]);

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

  const filterCounts = { all: 0, correct: 0, incorrect: 0, skipped: 0, marked: 0 };
  activeSecData?.section.questions.forEach((tq) => {
    const ans = answersMap.get(tq.questionId);
    filterCounts.all++;
    if (ans?.isFlagged) filterCounts.marked++;
    if (!ans?.answerGiven) filterCounts.skipped++;
    else if (answersMatch(ans.answerGiven, tq.question.correctAnswer)) filterCounts.correct++;
    else filterCounts.incorrect++;
  });

  const filteredQuestions = activeSecData?.section.questions.filter((tq) => {
    const ans = answersMap.get(tq.questionId);
    if (questionFilter === 'correct') return !!ans?.answerGiven && answersMatch(ans.answerGiven, tq.question.correctAnswer);
    if (questionFilter === 'incorrect') return !!ans?.answerGiven && !answersMatch(ans.answerGiven, tq.question.correctAnswer);
    if (questionFilter === 'skipped') return !ans?.answerGiven;
    if (questionFilter === 'marked') return ans?.isFlagged === true;
    return true;
  }) ?? [];

  const filteredIds = new Set(filteredQuestions.map((q) => q.questionId));
  const selectedTq = activeSecData?.section.questions.find((q) => q.questionId === selectedQuestionId);
  const currentFilteredIndex = filteredQuestions.findIndex((q) => q.questionId === selectedQuestionId);
  const prevQuestion = currentFilteredIndex > 0 ? filteredQuestions[currentFilteredIndex - 1] : null;
  const nextQuestion = currentFilteredIndex >= 0 && currentFilteredIndex < filteredQuestions.length - 1 ? filteredQuestions[currentFilteredIndex + 1] : null;

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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel: Stats, Filters, and Navigator Grid */}
            <div className="lg:col-span-4 space-y-6">
              {/* Compact Section Stats */}
              {activeSectionStats && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Correct', value: activeSectionStats.correct, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Wrong', value: activeSectionStats.incorrect, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Skipped', value: activeSectionStats.skipped, color: 'text-slate-600', bg: 'bg-slate-50' },
                    { label: 'Accuracy', value: `${activeSectionStats.accuracy}%`, color: 'text-blue-600', bg: 'bg-blue-50' },
                  ].map((s) => (
                    <div key={s.label} className={`${s.bg} rounded-xl p-2.5 text-center border border-slate-100/50 shadow-sm`}>
                      <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Status Filter Stack */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                  <Filter size={12} className="text-slate-400" />
                  Filter By Status
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
                  {([
                    { key: 'all',       label: 'All Questions', color: 'blue',    count: filterCounts.all },
                    { key: 'correct',   label: 'Correct',       color: 'emerald', count: filterCounts.correct },
                    { key: 'incorrect', label: 'Wrong',         color: 'red',     count: filterCounts.incorrect },
                    { key: 'skipped',   label: 'Skipped',       color: 'slate',   count: filterCounts.skipped },
                    { key: 'marked',    label: 'Marked',        color: 'purple',  count: filterCounts.marked },
                  ] as const).map((f) => {
                    const isActive = questionFilter === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => setQuestionFilter(f.key)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-all ${
                          isActive
                            ? f.color === 'blue' ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : f.color === 'emerald' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : f.color === 'red' ? 'bg-red-500 text-white border-red-500 shadow-sm'
                              : f.color === 'slate' ? 'bg-slate-600 text-white border-slate-600 shadow-sm'
                              : 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : f.color === 'blue' ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              : f.color === 'emerald' ? 'bg-emerald-50/30 text-emerald-800 border-emerald-100 hover:bg-emerald-50/60'
                              : f.color === 'red' ? 'bg-red-50/30 text-red-800 border-red-100 hover:bg-red-50/60'
                              : f.color === 'slate' ? 'bg-slate-50/50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              : 'bg-purple-50/30 text-purple-800 border-purple-100 hover:bg-purple-50/60'
                        }`}
                      >
                        <span>{f.label}</span>
                        <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>{f.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Question Navigator Matrix */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
                  <span>Question Navigator</span>
                  <span className="text-slate-400 normal-case font-normal">{filteredQuestions.length} of {activeSecData?.section.questions.length} visible</span>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
                  {activeSecData?.section.questions.map((tq, idx) => {
                    const ans = answersMap.get(tq.questionId);
                    const isCorrect = ans?.answerGiven && answersMatch(ans.answerGiven, tq.question.correctAnswer);
                    const isWrong = ans?.answerGiven && !answersMatch(ans.answerGiven, tq.question.correctAnswer);
                    const isFlagged = ans?.isFlagged;
                    const isSelected = selectedQuestionId === tq.questionId;
                    const matchesFilter = filteredIds.has(tq.questionId);

                    return (
                      <button
                        key={tq.id}
                        onClick={() => setSelectedQuestionId(tq.questionId)}
                        className={`relative h-10 w-full rounded-lg text-sm font-semibold flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'ring-2 ring-offset-1 ring-blue-600 border-blue-600 scale-105 z-10 font-bold'
                            : ''
                        } ${
                          isCorrect
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80'
                            : isWrong
                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100/80'
                        } ${!matchesFilter ? 'opacity-30 grayscale-[30%] hover:opacity-80' : ''}`}
                      >
                        {idx + 1}
                        {isFlagged && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Panel: Selected Question Review details */}
            <div className="lg:col-span-8 space-y-4">
              {selectedTq ? (
                <>
                  <QuestionReviewItem
                    key={selectedTq.id}
                    tq={selectedTq}
                    index={activeSecData?.section.questions.findIndex((q) => q.questionId === selectedTq.questionId) ?? 0}
                    studentAnswer={answersMap.get(selectedTq.questionId)}
                  />

                  {/* Navigator Footer */}
                  <div className="flex justify-between items-center bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
                    <button
                      onClick={() => prevQuestion && setSelectedQuestionId(prevQuestion.questionId)}
                      disabled={!prevQuestion}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-all flex items-center gap-1.5"
                    >
                      ← Previous
                    </button>
                    <span className="text-xs text-slate-500 font-medium">
                      {filteredQuestions.length > 0 ? `${currentFilteredIndex + 1} of ${filteredQuestions.length} filtered` : '0 of 0'}
                    </span>
                    <button
                      onClick={() => nextQuestion && setSelectedQuestionId(nextQuestion.questionId)}
                      disabled={!nextQuestion}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 transition-all flex items-center gap-1.5"
                    >
                      Next →
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  No questions match the current filter.
                </div>
              )}
            </div>
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
