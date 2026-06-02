import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Loader2, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';

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
  subject?: string | null
  topic?: { name: string; parent?: { name: string } | null } | null
  childQuestions?: DbQuestion[]
}

export interface DbTestQuestion {
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

export interface DbAttempt {
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

// ─── Knowledge & Skills: SAT content domains (static blueprint) ────────────────

const KS_DOMAINS: Record<string, { name: string; pct: number; range: string }[]> = {
  'Reading and Writing': [
    { name: 'Information and Ideas', pct: 26, range: '12 - 14' },
    { name: 'Craft and Structure', pct: 28, range: '13 - 15' },
    { name: 'Expression of Ideas', pct: 20, range: '8 - 12' },
    { name: 'Standard English Conventions', pct: 26, range: '11 - 15' },
  ],
  'Math': [
    { name: 'Algebra', pct: 35, range: '13 - 15' },
    { name: 'Advanced Math', pct: 35, range: '13 - 15' },
    { name: 'Problem-Solving and Data Analysis', pct: 15, range: '5 - 7' },
    { name: 'Geometry and Trigonometry', pct: 15, range: '5 - 7' },
  ],
}
const ALL_DOMAIN_NAMES = Object.values(KS_DOMAINS).flat().map((d) => d.name)

// Keywords that map an arbitrary topic name onto one of the 8 SAT domains.
// Covers both proper domain names and the demo/seed topic taxonomy.
const DOMAIN_SYNONYMS: Record<string, string[]> = {
  'Information and Ideas': ['information and ideas', 'information', 'main idea', 'central idea', 'inference', 'evidence', 'command of evidence'],
  'Craft and Structure': ['craft and structure', 'craft', 'structure', 'vocabulary', 'words in context', 'text structure', 'cross-text'],
  'Expression of Ideas': ['expression of ideas', 'expression', 'rhetoric', 'rhetorical', 'transitions', 'synthesis'],
  'Standard English Conventions': ['standard english conventions', 'conventions', 'grammar', 'usage', 'punctuation', 'sentence structure', 'english'],
  'Algebra': ['algebra', 'linear'],
  'Advanced Math': ['advanced math', 'advanced', 'nonlinear', 'quadratic', 'function', 'exponential'],
  'Problem-Solving and Data Analysis': ['problem-solving and data analysis', 'problem solving', 'data analysis', 'data interpretation', 'statistics', 'ratio', 'rates', 'percent', 'probability', 'proportion'],
  'Geometry and Trigonometry': ['geometry and trigonometry', 'geometry', 'trigonometry', 'trig'],
}

function domainCandidates(q: DbQuestion): string[] {
  return [q.topic?.name, q.topic?.parent?.name, q.subject].filter(Boolean) as string[]
}

function rawDomainLabel(q: DbQuestion): string | null {
  return q.topic?.name ?? q.topic?.parent?.name ?? q.subject ?? null
}

function matchCanonicalDomain(q: DbQuestion): string | null {
  const cands = domainCandidates(q).map((c) => c.trim().toLowerCase())
  if (!cands.length) return null
  for (const [domain, syns] of Object.entries(DOMAIN_SYNONYMS)) {
    for (const c of cands) {
      if (syns.some((s) => c === s || c.includes(s) || s.includes(c))) return domain
    }
  }
  return null
}

function diffLabel(d: string | undefined): string {
  if (!d) return '—'
  const m: Record<string, string> = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' }
  return m[d.toUpperCase()] ?? d[0].toUpperCase() + d.slice(1).toLowerCase()
}

function modeDiff(diff: Record<string, number>): string {
  const entries = Object.entries(diff)
  if (!entries.length) return '—'
  entries.sort((a, b) => b[1] - a[1])
  return diffLabel(entries[0][0])
}

function formatAnswerKeys(ans: DbAnswer): string {
  if (ans.value !== undefined) return String(ans.value)
  if (ans.keys) return ans.keys.map((k) => k.toUpperCase()).join(', ')
  if (ans.key) return ans.key.toUpperCase()
  return '—'
}

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
  const [showCorrect, setShowCorrect] = useState(false);
  const [pageSize, setPageSize] = useState<'10' | '30' | 'all'>('10');
  const [sort, setSort] = useState<{ key: 'number' | 'section' | 'status' | 'domain'; dir: 'asc' | 'desc' }>({ key: 'number', dir: 'asc' });
  const [attempt, setAttempt] = useState<DbAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Flatten every question across sections into Questions-Overview rows
  const reviewRows = sections.flatMap((sa, secIdx) =>
    sa.section.questions.map((tq) => {
      const ans = answersMap.get(tq.questionId);
      const status: 'correct' | 'incorrect' | 'omitted' =
        !ans?.answerGiven ? 'omitted'
          : answersMatch(ans.answerGiven, tq.question.correctAnswer) ? 'correct' : 'incorrect';
      const canonical = matchCanonicalDomain(tq.question);
      const raw = rawDomainLabel(tq.question);
      return {
        tq, ans,
        sectionIdx: secIdx,
        sectionName: sa.section.name,
        status,
        canonicalDomain: canonical,
        displayDomain: canonical ?? raw ?? sa.section.name,
        correctText: formatAnswerKeys(tq.question.correctAnswer),
        difficulty: tq.question.difficultyLevel,
      };
    })
  ).map((r, i) => ({ ...r, number: i + 1 }));

  const totalCount = reviewRows.length;
  const correctCount = reviewRows.filter((r) => r.status === 'correct').length;
  const incorrectCount = totalCount - correctCount;

  // Per-domain performance for Knowledge & Skills
  const domainStats: Record<string, { correct: number; total: number; diff: Record<string, number> }> = {};
  ALL_DOMAIN_NAMES.forEach((n) => { domainStats[n] = { correct: 0, total: 0, diff: {} }; });
  reviewRows.forEach((r) => {
    if (r.canonicalDomain && domainStats[r.canonicalDomain]) {
      const d = domainStats[r.canonicalDomain];
      d.total++;
      if (r.status === 'correct') d.correct++;
      d.diff[r.difficulty] = (d.diff[r.difficulty] ?? 0) + 1;
    }
  });

  // Sort + paginate table rows
  const dir = sort.dir === 'asc' ? 1 : -1;
  const sortedRows = [...reviewRows].sort((a, b) => {
    let av: string | number, bv: string | number;
    switch (sort.key) {
      case 'section': av = a.sectionName; bv = b.sectionName; break;
      case 'status':  av = a.status; bv = b.status; break;
      case 'domain':  av = a.displayDomain; bv = b.displayDomain; break;
      default:        av = a.number; bv = b.number;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return a.number - b.number;
  });
  const visibleRows = pageSize === 'all' ? sortedRows : sortedRows.slice(0, Number(pageSize));

  const toggleSort = (key: typeof sort.key) =>
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  const statusStyle: Record<string, string> = {
    correct: 'text-emerald-600', incorrect: 'text-red-600', omitted: 'text-red-500',
  };
  const statusLabel: Record<string, string> = {
    correct: 'Correct', incorrect: 'Incorrect', omitted: 'Omitted',
  };

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

      {/* ── KNOWLEDGE AND SKILLS ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-7">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-2xl font-bold text-slate-900">Knowledge and Skills</h2>
          <span className="flex items-center gap-1 text-blue-600 text-sm font-semibold"><Info size={15} /> New!</span>
        </div>
        <p className="text-slate-500 text-sm mb-7">View your performance across the 8 content domains measured on the SAT.</p>

        {(Object.keys(KS_DOMAINS) as Array<keyof typeof KS_DOMAINS>).map((group) => (
          <div key={group} className="mb-7 last:mb-0">
            <h3 className="text-lg font-bold text-slate-900 mb-5">{group}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-7">
              {KS_DOMAINS[group].map((d) => {
                const stat = domainStats[d.name];
                const segs = stat.total > 0 ? stat.total : 8;
                return (
                  <div key={d.name}>
                    <p className="font-bold text-slate-900">{d.name}</p>
                    <p className="text-sm text-slate-500 mb-2.5">({d.pct}% of test section, {d.range} questions)</p>
                    <div className="flex gap-1 mb-2">
                      {Array.from({ length: segs }).map((_, i) => (
                        <div key={i} className={`h-2.5 flex-1 rounded-[2px] ${i < stat.correct ? 'bg-[#1b3d6e]' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <p className="text-sm text-slate-600">
                      Difficulty level:{' '}
                      <span className="text-blue-600 font-semibold border-b border-dotted border-blue-400">{modeDiff(stat.diff)}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── QUESTIONS OVERVIEW ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Questions Overview</h2>
        <p className="text-slate-500 text-sm mb-5">Review your results for each question from this practice test.</p>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Questions', value: totalCount },
            { label: 'Correct Answers', value: correctCount },
            { label: 'Incorrect Answers', value: incorrectCount },
          ].map((s) => (
            <div key={s.label} className="bg-blue-50 rounded-2xl py-6 text-center">
              <p className="text-4xl font-bold text-slate-900">{s.value}</p>
              <p className="text-slate-700 font-semibold mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Toggle + page size */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <button onClick={() => setShowCorrect((v) => !v)} className="flex items-center gap-2 select-none">
            <span className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${showCorrect ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}>
              <span className="w-4 h-4 rounded-full bg-white shadow" />
            </span>
            <span className="text-sm font-medium text-slate-700">Show Correct Answers</span>
          </button>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            View:
            {(['10', '30', 'all'] as const).map((p) => (
              <button key={p} onClick={() => setPageSize(p)}
                className={pageSize === p ? 'font-bold text-slate-900' : 'text-blue-600 hover:underline'}>
                {p === 'all' ? 'All' : p}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-700 text-white">
              <tr>
                {([
                  { key: 'number', label: 'Question', sortable: true },
                  { key: 'section', label: 'Section', sortable: true },
                  { key: null, label: 'Correct Answer', sortable: false },
                  { key: 'status', label: 'Your Answer', sortable: true },
                  { key: null, label: 'Actions', sortable: false },
                  { key: 'domain', label: 'Domain', sortable: true },
                ] as const).map((col) => (
                  <th key={col.label} className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                    {col.sortable ? (
                      <button onClick={() => toggleSort(col.key as typeof sort.key)} className="inline-flex items-center gap-1">
                        {col.label}
                        <span className="text-white/60">{sort.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : '⬍'}</span>
                      </button>
                    ) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => (
                <tr key={r.tq.id} className={`border-t border-slate-100 ${i % 2 ? 'bg-slate-50/40' : 'bg-white'}`}>
                  <td className="px-4 py-3 text-slate-700">{r.number}</td>
                  <td className="px-4 py-3 text-slate-700">{r.sectionName}</td>
                  <td className="px-4 py-3 bg-slate-50/70 font-medium text-slate-700">{showCorrect ? r.correctText : ''}</td>
                  <td className={`px-4 py-3 font-medium ${statusStyle[r.status]}`}>{statusLabel[r.status]}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/test-review/${attempt.id}/section/${r.sectionIdx}?q=${r.tq.questionId}`)}
                      className="text-blue-600 hover:underline font-medium">Review</button>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.displayDomain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageSize !== 'all' && totalCount > Number(pageSize) && (
          <p className="text-xs text-slate-400 mt-2">Showing {visibleRows.length} of {totalCount} questions — use the View options above to see more.</p>
        )}
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
