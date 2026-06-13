import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2, Info, Bookmark, AlertCircle, Maximize2, X, HelpCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/common/Modal';
import { SAT_CONTENT, ALL_DOMAIN_NAMES, ALL_SUBDOMAIN_NAMES, SUBDOMAINS_BY_DOMAIN } from '../../data/satDomains';

// ─── DB types ─────────────────────────────────────────────────────────────────

interface DbAnswer {
  key?: string
  keys?: string[]
  value?: number
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
  if (!given || !correct) return false
  // Numeric
  if (correct.value !== undefined) {
    if (given.value === undefined) return false;
    return Number(given.value) === Number(correct.value) || String(given.value).trim() === String(correct.value).trim();
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

// Domain/subdomain blueprint comes from the shared source of truth so it stays
// in sync with what the Test Builder tags questions with.
const KS_DOMAINS = SAT_CONTENT

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

// Keywords that map a topic name onto a specific subdomain. Matched only within
// the question's already-resolved domain, so generic words stay unambiguous.
const SUBDOMAIN_SYNONYMS: Record<string, string[]> = {
  'Command of Evidence': ['command of evidence', 'evidence'],
  'Inferences': ['inference'],
  'Central Ideas and Details': ['central idea', 'central ideas and details', 'main idea', 'details'],
  'Words in Context': ['words in context', 'word in context', 'vocabulary'],
  'Text Structure and Purpose': ['text structure', 'purpose'],
  'Cross-Text Connections': ['cross-text', 'cross text'],
  'Rhetorical Synthesis': ['rhetorical synthesis', 'synthesis'],
  'Transitions': ['transition'],
  'Boundaries': ['boundaries', 'punctuation'],
  'Form, Structure, and Sense': ['form, structure, and sense', 'form structure and sense', 'agreement', 'verb', 'tense'],
  'Linear equations in one variable': ['linear equations in one variable', 'linear equation in one variable'],
  'Linear functions': ['linear function'],
  'Linear equations in two variables': ['linear equations in two variables', 'linear equation in two variables'],
  'Systems of two linear equations in two variables': ['systems of two linear equations', 'system of two linear equations', 'systems of linear equations'],
  'Linear inequalities in one or two variables': ['linear inequalit', 'inequalit'],
  'Nonlinear functions': ['nonlinear function'],
  'Nonlinear equations in one variable': ['nonlinear equation'],
  'Systems of equations in two variables': ['systems of equations', 'system of equations'],
  'Equivalent expressions': ['equivalent expression'],
  'Ratios, rates, proportional relationships, and units': ['ratio', 'rates', 'proportional', 'proportion'],
  'Percentages': ['percent'],
  'One-variable data: Distributions and measures of center and spread': ['one-variable data', 'distribution', 'measures of center', 'spread', 'median', 'mean', 'mode'],
  'Two-variable data: Models and scatterplots': ['two-variable data', 'scatterplot', 'scatter plot'],
  'Probability and conditional probability': ['probability'],
  'Inference from sample statistics and margin of error': ['margin of error', 'sample statistics'],
  'Evaluating statistical claims: Observational studies and experiments': ['statistical claim', 'observational stud', 'experiment'],
  'Area and volume': ['area', 'volume'],
  'Lines, angles, and triangles': ['lines, angles', 'angle'],
  'Right triangles and trigonometry': ['right triangle', 'trigonometry', 'trig'],
  'Circles': ['circle'],
}

function domainCandidates(q: DbQuestion): string[] {
  // meta.domain is the exact canonical name tagged in the Test Builder; prefer it.
  return [q.content?.meta?.domain, q.topic?.name, q.topic?.parent?.name, q.subject].filter(Boolean) as string[]
}

function rawDomainLabel(q: DbQuestion): string | null {
  return q.content?.meta?.domain ?? q.topic?.name ?? q.topic?.parent?.name ?? q.subject ?? null
}

function matchCanonicalDomain(q: DbQuestion): string | null {
  const cands = domainCandidates(q).map((c) => c.trim().toLowerCase())
  if (!cands.length) return null
  // Direct hit: a candidate that already equals a canonical domain name.
  const direct = ALL_DOMAIN_NAMES.find((d) => cands.includes(d.toLowerCase()))
  if (direct) return direct
  for (const [domain, syns] of Object.entries(DOMAIN_SYNONYMS)) {
    for (const c of cands) {
      if (syns.some((s) => c === s || c.includes(s) || s.includes(c))) return domain
    }
  }
  return null
}

// Resolve a question to a subdomain, searched only within its own domain so a
// generic candidate (e.g. "function") can't leak across domains.
function matchCanonicalSubdomain(q: DbQuestion, domain: string | null): string | null {
  if (!domain) return null
  const subs = SUBDOMAINS_BY_DOMAIN[domain]
  if (!subs) return null
  // The subdomain tagged in the Test Builder (meta.subTopic) takes priority.
  const tagged = q.content?.meta?.subTopic?.trim()
  if (tagged) {
    const exact = subs.find((s) => s.toLowerCase() === tagged.toLowerCase())
    if (exact) return exact
  }
  const cands = [q.content?.meta?.subTopic, ...domainCandidates(q)].filter(Boolean).map((c) => (c as string).trim().toLowerCase())
  if (!cands.length) return null
  for (const sub of subs) {
    const syns = SUBDOMAIN_SYNONYMS[sub] ?? [sub.toLowerCase()]
    for (const c of cands) {
      if (syns.some((s) => c === s || c.includes(s) || s.includes(c))) return sub
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
      <div className={`border-2 rounded-xl overflow-hidden ${correct ? 'border-blue-300' : skipped ? 'border-slate-200' : 'border-blue-100'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 bg-white">
          {/* Left Panel: Passage */}
          <div className="p-4 bg-slate-50 text-left">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 border-b border-slate-200/60 pb-1 flex-shrink-0">Reading Passage</h4>
            <div className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed">
              <RichContentRenderer content={parentQuestionText} variant="question" className="prose-sm" />
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
                  <span className="text-xs text-slate-500 hidden sm:flex items-center gap-1"><Clock size={9} />{studentAnswer.timeSpentSeconds}s</span>
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
                          colorTheme="blue"
                        />
                      );
                    })}
                  </div>
                )}
                {q.type === 'NUMERIC' && (
                  <div className="flex gap-4 text-sm mb-3 text-left">
                    <span className="text-slate-500">Your answer: <strong className={correct ? 'text-blue-600' : 'text-blue-400'}>{studentAnswer?.answerGiven?.value ?? '—'}</strong></span>
                    <span className="text-slate-500">Correct: <strong className="text-blue-600">{q.correctAnswer.value}</strong></span>
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
            <span className="text-xs text-slate-500 hidden sm:flex items-center gap-1"><Clock size={9} />{studentAnswer.timeSpentSeconds}s</span>
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
                  colorTheme="blue"
                />
              );
            })}
          </div>
        )}
        {q.type === 'NUMERIC' && (
          <div className="flex gap-4 text-sm mb-3 text-left">
            <span className="text-slate-500">Your answer: <strong className={correct ? 'text-blue-600' : 'text-blue-400'}>{studentAnswer?.answerGiven?.value ?? '—'}</strong></span>
            <span className="text-slate-500">Correct: <strong className="text-blue-600">{q.correctAnswer.value}</strong></span>
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

// ─── Display helpers for pacing and coaching ──────────────────────────────────

function getSectionModuleLabel(name: string): string {
  const isMath = /math/i.test(name);
  const isRW = /reading|writing|rw/i.test(name);
  if (!isMath && !isRW) return name;
  const isModule2 = /2|two/i.test(name);
  const moduleNum = isModule2 ? 2 : 1;
  const sectionNum = isMath ? 2 : 1;
  const subjectName = isMath ? 'Math' : 'Reading and Writing';
  return `Section ${sectionNum}, Module ${moduleNum}: ${subjectName}`;
}

function formatSeconds(sec: number | undefined): string {
  if (sec === undefined || sec === null) return '0 Seconds';
  if (sec < 60) return `${sec} Seconds`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m} Minute${m > 1 ? 's' : ''}`;
}


export function QuestionDetailedReviewCard({ tq, localIndex, studentAnswer, attemptId }: {
  tq: DbTestQuestion;
  localIndex: number;
  studentAnswer: DbAttemptAnswer | undefined;
  attemptId: string;
}) {
  const [showAnswer, setShowAnswer] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(studentAnswer?.isFlagged ?? false);
  const [doubtStatus, setDoubtStatus] = useState<'doubt' | 'cleared' | null>(studentAnswer?.doubtStatus ?? null);
  const [savingDoubt, setSavingDoubt] = useState(false);

  const q = tq.question;
  const correct = answersMatch(studentAnswer?.answerGiven ?? null, q.correctAnswer);
  const skipped = !studentAnswer?.answerGiven;
  const status: 'correct' | 'incorrect' | 'omitted' = skipped ? 'omitted' : correct ? 'correct' : 'incorrect';
  
  const options = dbOptionsToDisplay(q.options);
  const userAnswerDisplay = dbAnswerToDisplay(studentAnswer?.answerGiven ?? null);
  const correctAnswerDisplay = dbAnswerToDisplay(q.correctAnswer);
  const parentPassageText = (tq as any).parentPassageText;
  
  const domainLabel = rawDomainLabel(q) ?? matchCanonicalDomain(q) ?? 'General';
  const topicLabel = q.topic?.name ?? 'General Review';
  const subTopicLabel = q.content.meta?.subTopic ?? null;
  const skillLabel = q.content.meta?.skill ?? null;

  const handleToggleBookmark = async () => {
    const nextState = !isBookmarked;
    setIsBookmarked(nextState);
    try {
      await api.autosaveAnswer(attemptId, {
        questionId: q.id,
        isFlagged: nextState,
      });
    } catch (err) {
      console.error('Failed to toggle bookmark', err);
    }
  };

  const handleSetDoubt = async (next: 'doubt' | 'cleared') => {
    const prev = doubtStatus;
    setDoubtStatus(next);
    setSavingDoubt(true);
    try {
      await api.setDoubtStatus(attemptId, q.id, next);
    } catch (err) {
      console.error('Failed to set doubt status', err);
      setDoubtStatus(prev); // revert on failure
    } finally {
      setSavingDoubt(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow min-h-[520px] flex flex-col justify-between">
      <div className="flex-1 flex flex-col">
        {/* Top Metadata Row */}
        <div className="bg-slate-50/70 px-6 py-4 flex flex-wrap items-center justify-between border-b border-slate-100 gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Question Local Index */}
          <div className="w-8 h-8 rounded-lg bg-blue-800 text-white font-bold flex items-center justify-center text-sm shadow-sm">
            {localIndex}
          </div>
          {/* MCQ / Numeric Badge */}
          <Badge variant="default" className="bg-slate-200 text-slate-700 hover:bg-slate-200 border-none font-semibold">
            {q.type === 'MCQ' ? 'MCQ' : q.type === 'NUMERIC' ? 'Numeric' : q.type}
          </Badge>
          {/* Correct / Incorrect / Omitted Badge */}
          {status === 'correct' ? (
            <Badge variant="info" className="bg-blue-600 text-white font-semibold border-none">
              Correct
            </Badge>
          ) : status === 'omitted' ? (
            <Badge variant="info" className="bg-blue-50 text-blue-600 font-semibold border-none">
              Omitted
            </Badge>
          ) : (
            <Badge variant="info" className="bg-blue-200 text-blue-900 font-semibold border-none">
              Incorrect
            </Badge>
          )}
          {/* Time spent */}
          <Badge variant="outline" className="border-slate-300 text-slate-600 bg-white font-medium flex items-center gap-1">
            <Clock size={12} />
            {formatSeconds(studentAnswer?.timeSpentSeconds)}
          </Badge>
          {/* Difficulty badge */}
          <Badge variant="outline" className="border-slate-300 text-slate-600 bg-white font-medium">
            Difficulty Level - {q.difficultyLevel.toUpperCase() === 'EASY' ? '1' : q.difficultyLevel.toUpperCase() === 'MEDIUM' ? '2' : '3'}
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${skipped ? 'bg-blue-200' : 'bg-blue-600'}`} />
            {skipped ? 'Skipped' : 'Answered'}
          </span>
          <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Visited
          </span>
          <button 
            onClick={handleToggleBookmark} 
            className={`p-1.5 rounded-lg border transition-colors ${
              isBookmarked 
                ? 'border-blue-200 bg-blue-50 text-blue-600' 
                : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title={isBookmarked ? 'Bookmarked' : 'Bookmark Question'}
          >
            <Bookmark size={16} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Card Content Area */}
      {parentPassageText ? (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100/80">
          {/* Left Column: Passage */}
          <div className="p-6 overflow-y-auto h-[520px] space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Passage</div>
            <div className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
              <RichContentRenderer content={parentPassageText} variant="question" className="prose-sm" />
            </div>
          </div>

          {/* Right Column: Question + Options */}
          <div className="p-6 overflow-y-auto h-[520px] space-y-6">
            {/* Question Prompt */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question</div>
              <div className="text-slate-800 font-medium text-base">
                <RichContentRenderer content={q.content.text || `Question ${localIndex}`} variant="question" className="prose-sm" />
              </div>
            </div>

            {/* Options / Answer Input Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Options</span>
                <button
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-md shadow-sm transition-colors"
                >
                  {showAnswer ? 'Hide Answer' : 'Show Answer'}
                </button>
              </div>

              {options.length > 0 ? (
                <div className="space-y-2">
                  {options.map((opt) => {
                    const isUserAnswer = Array.isArray(userAnswerDisplay) ? userAnswerDisplay.includes(opt.id) : userAnswerDisplay === opt.id;
                    const isCorrectOption = Array.isArray(correctAnswerDisplay) ? correctAnswerDisplay.includes(opt.id) : correctAnswerDisplay === opt.id;
                    return (
                      <OptionRenderer
                        key={opt.id}
                        label={opt.id.toUpperCase()}
                        text={opt.text}
                        isSelected={isUserAnswer}
                        isCorrect={isCorrectOption}
                        isIncorrect={isUserAnswer && !isCorrectOption}
                        showFeedback={showAnswer}
                        colorTheme="blue"
                      />
                    );
                  })}
                </div>
              ) : (
                q.type === 'NUMERIC' && (
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex flex-col gap-2">
                    <div className="text-sm">
                      <span className="text-slate-500 font-medium">Your answer: </span>
                      <span className={`font-bold ${showAnswer ? (correct ? 'text-blue-600' : 'text-blue-400') : 'text-slate-800'}`}>
                        {studentAnswer?.answerGiven?.value ?? '—'}
                      </span>
                    </div>
                    {showAnswer && (
                      <div className="text-sm">
                        <span className="text-slate-500 font-medium">Correct answer: </span>
                        <span className="font-bold text-blue-600">
                          {q.correctAnswer.value}
                        </span>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Standard layout (without passage) */
        <div className="p-6 space-y-6 overflow-y-auto h-[520px]">
          {/* Question Prompt */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question</div>
            <div className="text-slate-800 font-medium text-base">
              <RichContentRenderer content={q.content.text || `Question ${localIndex}`} variant="question" className="prose-sm" />
            </div>
          </div>

          {/* Options / Answer Input Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Options</span>
              <button
                onClick={() => setShowAnswer(!showAnswer)}
                className="text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-md shadow-sm transition-colors"
              >
                {showAnswer ? 'Hide Answer' : 'Show Answer'}
              </button>
            </div>

            {options.length > 0 ? (
              <div className="space-y-2">
                {options.map((opt) => {
                  const isUserAnswer = Array.isArray(userAnswerDisplay) ? userAnswerDisplay.includes(opt.id) : userAnswerDisplay === opt.id;
                  const isCorrectOption = Array.isArray(correctAnswerDisplay) ? correctAnswerDisplay.includes(opt.id) : correctAnswerDisplay === opt.id;
                  return (
                    <OptionRenderer
                      key={opt.id}
                      label={opt.id.toUpperCase()}
                      text={opt.text}
                      isSelected={isUserAnswer}
                      isCorrect={isCorrectOption}
                      isIncorrect={isUserAnswer && !isCorrectOption}
                      showFeedback={showAnswer}
                      colorTheme="blue"
                    />
                  );
                })}
              </div>
            ) : (
              q.type === 'NUMERIC' && (
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 flex flex-col gap-2">
                  <div className="text-sm">
                    <span className="text-slate-500 font-medium">Your answer: </span>
                    <span className={`font-bold ${showAnswer ? (correct ? 'text-blue-600' : 'text-blue-400') : 'text-slate-800'}`}>
                      {studentAnswer?.answerGiven?.value ?? '—'}
                    </span>
                  </div>
                  {showAnswer && (
                    <div className="text-sm">
                      <span className="text-slate-500 font-medium">Correct answer: </span>
                      <span className="font-bold text-blue-600">
                        {q.correctAnswer.value}
                      </span>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}
      </div>

      {/* Expandable Analysis Footer */}
      <div className="border-t border-slate-100 bg-slate-50/50">
        <div className="px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            {showAnalysis ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span>Explanation</span>
            {status === 'correct' ? (
              <CheckCircle size={16} className="text-blue-600" />
            ) : status === 'incorrect' ? (
              <AlertCircle size={16} className="text-blue-400" />
            ) : (
              <AlertCircle size={16} className="text-blue-300" />
            )}
          </button>

          {/* Doubt status pill — visible once a choice has been made */}
          {doubtStatus === 'doubt' && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md">
              <HelpCircle size={14} /> Marked as doubt
            </span>
          )}
          {doubtStatus === 'cleared' && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md">
              <CheckCircle size={14} /> Cleared
            </span>
          )}
        </div>

        {showAnalysis && (
          <div className="px-6 pb-6 pt-2 space-y-4 border-t border-slate-100/60 bg-white">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div>
                <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider block">Domain</span>
                <span className="text-slate-800 font-bold">{domainLabel}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider block">Topic</span>
                <span className="text-slate-800 font-bold">{topicLabel}</span>
              </div>
              {subTopicLabel && (
                <div>
                  <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider block">Subdomain</span>
                  <span className="text-slate-800 font-bold">{subTopicLabel}</span>
                </div>
              )}
              {skillLabel && (
                <div>
                  <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider block">Skill</span>
                  <span className="text-slate-800 font-bold">{skillLabel}</span>
                </div>
              )}
            </div>


            {q.content.explanation ? (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Explanation</span>
                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 text-slate-800 text-sm leading-relaxed">
                  <RichContentRenderer content={q.content.explanation} variant="explanation" />
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500 italic">No explanation available for this question.</div>
            )}

            {/* Doubt CTAs — after reading the explanation, did it clear the doubt? */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <p className="text-sm font-medium text-slate-600">
                {doubtStatus === 'cleared'
                  ? 'Great — glad this one is cleared!'
                  : doubtStatus === 'doubt'
                  ? "Saved to My Doubts. We'll keep it handy for revision."
                  : 'After reading the explanation, is your doubt cleared?'}
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleSetDoubt('doubt')}
                  disabled={savingDoubt}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                    doubtStatus === 'doubt'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  <HelpCircle size={14} /> Still Doubt
                </button>
                <button
                  onClick={() => handleSetDoubt('cleared')}
                  disabled={savingDoubt}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                    doubtStatus === 'cleared'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle size={14} /> Cleared
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TestReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isTutorOrAdmin = user?.role === 'tutor' || user?.role === 'admin' || user?.role === 'super_admin';
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [filterBy, setFilterBy] = useState<string>('all');
  const [timeAnalyticsOpen, setTimeAnalyticsOpen] = useState(false);
  const [questionNavigatorOpen, setQuestionNavigatorOpen] = useState(false);
  const [fullscreenReportOpen, setFullscreenReportOpen] = useState(false);
  const [showFullscreenQuestionNavigator, setShowFullscreenQuestionNavigator] = useState(false);
  const [knowledgeSkillsOpen, setKnowledgeSkillsOpen] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
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

  // Lock scroll on both html and body when fullscreen review is open
  useEffect(() => {
    if (fullscreenReportOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [fullscreenReportOpen]);

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
            } as any,
            parentPassageText: q.content.text,
          });
        });
      } else if (!(q as any).parentQuestionId) {
        // Skip child rows: already emitted via their passage parent above.
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

  // Calculate final scaled score directly instead of raw score for SAT
  let rw1 = 0, rw2 = 0, math1 = 0, math2 = 0;
  let isSAT = false;

  sectionStats.forEach((s) => {
    const isMath = /math/i.test(s.name);
    const isRW = /reading|writing|rw/i.test(s.name);
    if (isMath || isRW) isSAT = true;
    
    if (isMath) {
      if (/1|one/i.test(s.name)) math1 += s.correct;
      else if (/2|two/i.test(s.name)) math2 += s.correct;
      else math1 += s.correct; // Fallback
    } else if (isRW) {
      if (/1|one/i.test(s.name)) rw1 += s.correct;
      else if (/2|two/i.test(s.name)) rw2 += s.correct;
      else rw1 += s.correct; // Fallback
    }
  });

  let finalScaledScore = rawScore;
  let rwScaled = 200;
  let mathScaled = 200;
  if (isSAT) {
    if (rw1 >= 18) {
      rwScaled = 400 + Math.round(((rw1 + rw2) / 54) * 400 / 10) * 10;
    } else {
      rwScaled = 200 + Math.round(((rw1 + rw2) / 54) * 450 / 10) * 10;
    }

    if (math1 >= 14) {
      mathScaled = 420 + Math.round(((math1 + math2) / 44) * 380 / 10) * 10;
    } else {
      mathScaled = 200 + Math.round(((math1 + math2) / 44) * 450 / 10) * 10;
    }

    rwScaled = Math.min(800, Math.max(200, rwScaled));
    mathScaled = Math.min(800, Math.max(200, mathScaled));
    finalScaledScore = rwScaled + mathScaled;
  }

  // Total questions per module (denominators for the score breakdown)
  let rwDen1 = 0, rwDen2 = 0, mathDen1 = 0, mathDen2 = 0;
  sectionStats.forEach((s) => {
    const isMathSec = /math/i.test(s.name);
    const isRWSec = /reading|writing|rw/i.test(s.name);
    if (isMathSec) {
      if (/1|one/i.test(s.name)) mathDen1 = s.total;
      else if (/2|two/i.test(s.name)) mathDen2 = s.total;
      else mathDen1 = s.total;
    } else if (isRWSec) {
      if (/1|one/i.test(s.name)) rwDen1 = s.total;
      else if (/2|two/i.test(s.name)) rwDen2 = s.total;
      else rwDen1 = s.total;
    }
  });

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
        canonicalSubdomain: matchCanonicalSubdomain(tq.question, canonical),
        displayDomain: canonical ?? raw ?? sa.section.name,
        correctText: formatAnswerKeys(tq.question.correctAnswer),
        difficulty: tq.question.difficultyLevel,
      };
    })
  ).map((r, i) => ({ ...r, number: i + 1 }));

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

  // Per-subdomain performance, drilled down beneath each domain
  const subStats: Record<string, { correct: number; total: number }> = {};
  ALL_SUBDOMAIN_NAMES.forEach((n) => { subStats[n] = { correct: 0, total: 0 }; });
  reviewRows.forEach((r) => {
    if (r.canonicalSubdomain && subStats[r.canonicalSubdomain]) {
      const s = subStats[r.canonicalSubdomain];
      s.total++;
      if (r.status === 'correct') s.correct++;
    }
  });

  // Precompute pacing stats per section for the View Time Analytics modal
  const pacingStats = sections.map((sa) => {
    let correctCount = 0, incorrectCount = 0, omittedCount = 0;
    let correctTime = 0, incorrectTime = 0, omittedTime = 0, totalTime = 0;
    
    sa.section.questions.forEach((tq) => {
      const ans = answersMap.get(tq.questionId);
      const time = ans?.timeSpentSeconds ?? 0;
      totalTime += time;
      
      if (!ans || !ans.answerGiven) {
        omittedCount++;
        omittedTime += time;
      } else if (answersMatch(ans.answerGiven, tq.question.correctAnswer)) {
        correctCount++;
        correctTime += time;
      } else {
        incorrectCount++;
        incorrectTime += time;
      }
    });
    
    const totalQ = sa.section.questions.length;
    
    return {
      name: sa.section.name,
      totalQuestions: totalQ,
      totalTime,
      avgTime: totalQ > 0 ? Math.round(totalTime / totalQ) : 0,
      avgTimeCorrect: correctCount > 0 ? Math.round(correctTime / correctCount) : 0,
      avgTimeIncorrect: incorrectCount > 0 ? Math.round(incorrectTime / incorrectCount) : 0,
      avgTimeOmitted: omittedCount > 0 ? Math.round(omittedTime / omittedCount) : 0,
    };
  });

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

      {/* Score summary — admin-style marks table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {isSAT ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-3 py-3 text-left font-semibold">Test Name</th>
                  <th className="px-3 py-3 text-center font-semibold">Started At</th>
                  <th className="px-3 py-3 text-center font-semibold">Completed At</th>
                  <th className="px-3 py-3 text-center font-semibold">
                    RW MD1<span className="text-slate-400 font-normal">/{rwDen1}</span>
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    RW MD2<span className="text-slate-400 font-normal">/{rwDen2}</span>
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Math MD1<span className="text-slate-400 font-normal">/{mathDen1}</span>
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Math MD2<span className="text-slate-400 font-normal">/{mathDen2}</span>
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Total<span className="text-slate-400 font-normal">/{totalQ}</span>
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">RW SS</th>
                  <th className="px-3 py-3 text-center font-semibold">Math SS</th>
                  <th className="px-3 py-3 text-center font-semibold">Total SS</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-50">
                  <td className="px-3 py-3 font-semibold text-purple-700">{attempt.test.title}</td>
                  <td className="px-3 py-3 text-center text-xs text-slate-500">
                    {attempt.startedAt ? new Date(attempt.startedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-slate-500">
                    {attempt.completedAt ? new Date(attempt.completedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-3 text-center text-purple-700 font-medium">{rw1}</td>
                  <td className="px-3 py-3 text-center text-purple-700 font-medium">{rw2}</td>
                  <td className="px-3 py-3 text-center text-purple-700 font-medium">{math1}</td>
                  <td className="px-3 py-3 text-center text-purple-700 font-medium">{math2}</td>
                  <td className="px-3 py-3 text-center font-bold text-slate-900">{totalCorrect}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{rwScaled}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{mathScaled}</td>
                  <td className="px-3 py-3 text-center font-semibold text-slate-800">{finalScaledScore}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-3 py-3 text-left font-semibold">Test Name</th>
                  <th className="px-3 py-3 text-center font-semibold">Started At</th>
                  <th className="px-3 py-3 text-center font-semibold">Completed At</th>
                  {sectionStats.map((s) => (
                    <th key={s.name} className="px-3 py-3 text-center font-semibold">
                      {s.name}<span className="text-slate-400 font-normal">/{s.total}</span>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-semibold">
                    Total<span className="text-slate-400 font-normal">/{totalQ}</span>
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-50">
                  <td className="px-3 py-3 font-semibold text-purple-700">{attempt.test.title}</td>
                  <td className="px-3 py-3 text-center text-xs text-slate-500">
                    {attempt.startedAt ? new Date(attempt.startedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-slate-500">
                    {attempt.completedAt ? new Date(attempt.completedAt).toLocaleString() : '—'}
                  </td>
                  {sectionStats.map((s) => (
                    <td key={s.name} className="px-3 py-3 text-center text-purple-700 font-medium">{s.correct}</td>
                  ))}
                  <td className="px-3 py-3 text-center font-bold text-slate-900">{totalCorrect}</td>
                  <td className="px-3 py-3 text-center text-slate-600">{overallAccuracy}%</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── KNOWLEDGE AND SKILLS ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-7">
        <button
          onClick={() => setKnowledgeSkillsOpen(!knowledgeSkillsOpen)}
          className="w-full text-left flex items-center justify-between hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">Knowledge and Skills</h2>
            <span className="flex items-center gap-1 text-blue-600 text-sm font-semibold"><Info size={15} /> New!</span>
          </div>
          <div className="text-slate-600">
            {knowledgeSkillsOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </div>
        </button>

        {knowledgeSkillsOpen && (
          <>
            <p className="text-slate-500 text-sm mb-7 mt-3">View your performance across the 8 content domains — and their subdomains — measured on the SAT.</p>

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
                        {d.subs.length > 0 && (
                          <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                            {d.subs.map((sub) => {
                              const s = subStats[sub] ?? { correct: 0, total: 0 };
                              const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : null;
                              return (
                                <li key={sub} className="flex items-center justify-between gap-3 text-xs">
                                  <span className={s.total > 0 ? 'text-slate-700' : 'text-slate-400'}>{sub}</span>
                                  <span className={`font-semibold tabular-nums whitespace-nowrap ${s.total > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                                    {s.total > 0 ? `${s.correct}/${s.total} · ${pct}%` : '—'}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── QUESTION WISE REPORT ───────────────────────────────────────────────── */}
      <div id="question-report-anchor" className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900">Question wise report</h2>
          <button
            onClick={() => setFullscreenReportOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all font-semibold text-sm shadow-sm"
            title="View in fullscreen"
          >
            <Maximize2 size={18} />
            Fullscreen
          </button>
        </div>

        {/* Tabs & Filters bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 px-6 py-4 gap-4">
          <div className="flex flex-wrap gap-2">
            {sections.map((sa, idx) => (
              <button
                key={sa.id}
                onClick={() => {
                  setActiveSectionIdx(idx);
                  setFilterBy('all');
                  setCurrentQuestionIdx(0);
                }}
                className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
                  activeSectionIdx === idx
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {getSectionModuleLabel(sa.section.name)}
              </button>
            ))}
            <button
              onClick={() => setTimeAnalyticsOpen(true)}
              className="px-4 py-2.5 rounded-lg text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Clock size={12} />
              View Time Analytics
            </button>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filter By</span>
            <select
              value={filterBy}
              onChange={(e) => { setFilterBy(e.target.value); setCurrentQuestionIdx(0); }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="all">All</option>
              <option value="correct">Correct</option>
              <option value="incorrect">Incorrect</option>
              <option value="omitted">Omitted</option>
              <option value="flagged">Bookmarked</option>
            </select>
          </div>
        </div>

        {/* Card Content Area */}
        <div className="px-6 py-4">
          {/* Single Question View with Previous/Next Navigation */}
        {(() => {
          const activeSection = sections[activeSectionIdx];
          const activeQuestions = activeSection?.section.questions ?? [];
          const filteredQuestions = activeQuestions.filter((tq) => {
            const ans = answersMap.get(tq.questionId);
            const isCorrect = ans?.answerGiven ? answersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
            const isOmitted = !ans?.answerGiven;
            const isFlagged = ans?.isFlagged ?? false;
            
            if (filterBy === 'correct') return isCorrect;
            if (filterBy === 'incorrect') return ans?.answerGiven && !isCorrect;
            if (filterBy === 'omitted') return isOmitted;
            if (filterBy === 'flagged') return isFlagged;
            return true;
          });

          const safeIdx = Math.min(currentQuestionIdx, Math.max(filteredQuestions.length - 1, 0));
          const currentTq = filteredQuestions[safeIdx];
          const hasPrev = safeIdx > 0;
          const hasNext = safeIdx < filteredQuestions.length - 1;

          return (
            <div className="space-y-4">
              {/* Question counter & info */}
              <div className="flex items-center justify-between pb-2">
                <div className="text-xs font-bold text-slate-600">
                  Total Questions: {activeQuestions.length}
                  {filterBy !== 'all' && (
                    <span className="text-slate-500 font-medium ml-2">
                      (Showing {filteredQuestions.length} matching filter)
                    </span>
                  )}
                </div>
                {filteredQuestions.length > 0 && (
                  <div className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg">
                    Question {safeIdx + 1} of {filteredQuestions.length}
                  </div>
                )}
              </div>

              {/* Current Question Card */}
              {filteredQuestions.length > 0 && currentTq ? (
                <>
                  <QuestionDetailedReviewCard
                    key={currentTq.id}
                    tq={currentTq}
                    localIndex={activeQuestions.findIndex(q => q.questionId === currentTq.questionId) + 1}
                    studentAnswer={answersMap.get(currentTq.questionId)}
                    attemptId={attempt.id}
                  />

                  {/* Navigation Bar with Previous, Question Navigator, and Next */}
                  <div className="flex items-center justify-between gap-3 mt-6 pt-6 border-t border-slate-200">
                    <button
                      onClick={() => { setCurrentQuestionIdx(safeIdx - 1); }}
                      disabled={!hasPrev}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${
                        hasPrev
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <ChevronLeft size={18} />
                      Previous
                    </button>

                    <button
                      onClick={() => setQuestionNavigatorOpen(true)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all shadow-lg"
                    >
                      Question {safeIdx + 1} of {filteredQuestions.length}
                      <ChevronDown size={18} />
                    </button>

                    <button
                      onClick={() => { setCurrentQuestionIdx(safeIdx + 1); }}
                      disabled={!hasNext}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${
                        hasNext
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Next
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                  <p className="text-slate-500 font-semibold">No questions match the active filter.</p>
                </div>
              )}
            </div>
          );
        })()}
        </div>
      </div>

      {/* Pacing Modal */}
      <Modal
        isOpen={timeAnalyticsOpen}
        onClose={() => setTimeAnalyticsOpen(false)}
        title="Time Pacing Analytics"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 leading-relaxed">
            Review how much time you spent per question on average, broken down by correctness. This helps identify pacing issues.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="px-4 py-3">Section / Module</th>
                  <th className="px-4 py-3 text-center">Questions</th>
                  <th className="px-4 py-3 text-center">Total Time</th>
                  <th className="px-4 py-3 text-center font-bold">Avg/Q</th>
                  <th className="px-4 py-3 text-center text-green-700">Correct</th>
                  <th className="px-4 py-3 text-center text-red-700">Incorrect</th>
                  <th className="px-4 py-3 text-center text-amber-700">Skipped</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 bg-white">
                {pacingStats.map((stat, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{getSectionModuleLabel(stat.name)}</td>
                    <td className="px-4 py-3 text-center font-medium">{stat.totalQuestions}</td>
                    <td className="px-4 py-3 text-center">{formatSeconds(stat.totalTime)}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900">{stat.avgTime}s</td>
                    <td className="px-4 py-3 text-center text-green-600 font-bold bg-green-50/20">{stat.avgTimeCorrect}s</td>
                    <td className="px-4 py-3 text-center text-red-600 font-bold bg-red-50/20">{stat.avgTimeIncorrect}s</td>
                    <td className="px-4 py-3 text-center text-amber-600 font-bold bg-amber-50/20">{stat.avgTimeOmitted}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setTimeAnalyticsOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* Question Navigator Modal */}
      {questionNavigatorOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-2xl">
            <div className="space-y-6 p-6">
              {/* Title */}
              <div className="text-center border-b border-slate-200 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg md:text-xl font-bold text-slate-900">{getSectionModuleLabel(sections[activeSectionIdx]?.section.name ?? '')}</h3>
                  <button
                    onClick={() => setQuestionNavigatorOpen(false)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-sm text-slate-500 mt-1">Questions</p>
              </div>

              {/* Status Legend */}
              <div className="flex flex-wrap items-center justify-center gap-6 px-4 py-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-300" />
                  <span className="text-xs font-semibold text-slate-600">Unanswered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-600">Correct</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-red-500" />
                  <span className="text-xs font-semibold text-slate-600">Wrong</span>
                </div>
              </div>

              {/* Question Grid */}
              {(() => {
                const activeSection = sections[activeSectionIdx];
                const activeQuestions = activeSection?.section.questions ?? [];
                
                return (
                  <div className="flex justify-center max-h-[50vh] overflow-y-auto">
                    <div className="grid grid-cols-9 gap-2 md:gap-3">
                      {activeQuestions.map((tq, idx) => {
                        const ans = answersMap.get(tq.questionId);
                        const isCorrect = ans?.answerGiven ? answersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
                        const isOmitted = !ans?.answerGiven;
                        const globalNum = idx + 1;
                        
                        const bgColor = isOmitted
                          ? 'bg-slate-200'
                          : isCorrect
                          ? 'bg-emerald-100 border-emerald-500'
                          : 'bg-red-100 border-red-500';
                        
                        const textColor = isOmitted
                          ? 'text-slate-600'
                          : isCorrect
                          ? 'text-emerald-700'
                          : 'text-red-700';

                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              const filteredIdx = activeQuestions.findIndex((q) => q.questionId === tq.questionId);
                              setCurrentQuestionIdx(filteredIdx);
                              setQuestionNavigatorOpen(false);
                            }}
                            className={`w-10 h-10 md:w-11 md:h-11 rounded-lg font-bold text-sm transition-all flex items-center justify-center border-2 ${bgColor} ${textColor} hover:shadow-md hover:scale-105`}
                            title={`Q${globalNum} — ${isOmitted ? 'Unanswered' : isCorrect ? 'Correct' : 'Wrong'}`}
                          >
                            {globalNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Bottom Section - Question Counter */}
              <div className="border-t border-slate-200 pt-4 text-center">
                {(() => {
                  const activeSection = sections[activeSectionIdx];
                  const activeQuestions = activeSection?.section.questions ?? [];
                  const safeIdx = Math.min(currentQuestionIdx, Math.max(activeQuestions.length - 1, 0));
                  return (
                    <button
                      onClick={() => setQuestionNavigatorOpen(false)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition-all"
                    >
                      Question {safeIdx + 1} of {activeQuestions.length}
                      <ChevronDown size={16} />
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Question Report Modal - Test-like Interface */}
      {fullscreenReportOpen && (
        <div
          className="fixed bg-white z-50 overflow-hidden flex flex-col font-sans"
          style={{ top: 0, left: 0, right: 0, bottom: 0, height: '100dvh' }}
        >
          {/* ── TOP HEADER BAR ───────────────────────────────────────────────── */}
          <header className="flex-shrink-0 bg-[#fcfcfd] border-b border-slate-200 px-4 h-14 flex items-center justify-between gap-3 z-20">
            {/* Left: Section tabs with short labels */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-slate-800 text-xs whitespace-nowrap hidden md:inline">Reviewing:</span>
              <div className="flex gap-1 flex-wrap">
                {sections.map((sa, idx) => {
                  const n = sa.section.name;
                  const isMath = /math/i.test(n);
                  const isMod2 = /2|two/i.test(n);
                  const shortLabel = isMath
                    ? `Math Mod ${isMod2 ? 2 : 1}`
                    : `RW Mod ${isMod2 ? 2 : 1}`;
                  return (
                    <button
                      key={sa.id}
                      onClick={() => { setActiveSectionIdx(idx); setFilterBy('all'); setCurrentQuestionIdx(0); }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                        activeSectionIdx === idx
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Filter and close */}
            <div className="flex items-center gap-3 flex-shrink-0 z-30">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">Filter</span>
                <select
                  value={filterBy}
                  onChange={(e) => { setFilterBy(e.target.value); setCurrentQuestionIdx(0); }}
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
                onClick={() => setFullscreenReportOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-all cursor-pointer"
                title="Close Fullscreen"
              >
                <X size={20} />
              </button>
            </div>
          </header>

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden bg-white">
            {(() => {
              const activeSection = sections[activeSectionIdx];
              const activeQuestions = activeSection?.section.questions ?? [];
              const filteredQuestions = activeQuestions.filter((tq) => {
                const ans = answersMap.get(tq.questionId);
                const isCorrect = ans?.answerGiven ? answersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
                const isOmitted = !ans?.answerGiven;
                const isFlagged = ans?.isFlagged ?? false;
                
                if (filterBy === 'correct') return isCorrect;
                if (filterBy === 'incorrect') return ans?.answerGiven && !isCorrect;
                if (filterBy === 'omitted') return isOmitted;
                if (filterBy === 'flagged') return isFlagged;
                return true;
              });

              const safeIdx = Math.min(currentQuestionIdx, Math.max(filteredQuestions.length - 1, 0));
              const currentTq = filteredQuestions[safeIdx];
              const studentAnswer = currentTq ? answersMap.get(currentTq.questionId) : null;
              const answerDisplay = studentAnswer ? dbAnswerToDisplay(studentAnswer.answerGiven) : null;
              const correctAnswerDisplay = currentTq ? dbAnswerToDisplay(currentTq.question.correctAnswer) : null;

              if (filteredQuestions.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center h-full p-8">
                    <p className="text-slate-500 font-semibold text-sm">No questions match the filter in this section</p>
                  </div>
                );
              }

              if (!currentTq) {
                return (
                  <div className="flex flex-col items-center justify-center h-full p-8">
                    <p className="text-slate-500 font-semibold text-sm">Loading question...</p>
                  </div>
                );
              }

              // Check if it's a passage question
              const isPassageQuestion = currentTq.question.type === 'PASSAGE' || 
                (currentTq.question.content && (currentTq.question.content as any).meta?.isPassage === true);
              
              // Get passage text for child questions (has priority) or passage questions themselves
              const passageText = (currentTq as any).parentPassageText || (isPassageQuestion ? currentTq.question.content?.text : null);

              return (
                <div className="flex h-full min-h-full">
                  {passageText ? (
                    // Split layout for passage questions
                    <>
                      {/* Left: Passage */}
                      <div className="w-1/2 overflow-y-auto p-8 bg-white h-full border-r border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Reading Passage</p>
                        <div className="prose prose-slate max-w-none text-slate-800 text-[15px] leading-relaxed">
                          <RichContentRenderer content={passageText} variant="passage" />
                        </div>
                      </div>
                      {/* Right: Question */}
                      <div className="w-1/2 overflow-y-auto p-8 bg-white h-full flex flex-col">
                        <div className="flex items-center justify-between border-b-2 border-dashed border-slate-200 pb-2.5 mb-5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-slate-900 text-white text-xs font-bold flex items-center justify-center rounded">{activeQuestions.findIndex(q => q.questionId === currentTq.questionId) + 1}</span>
                          </div>
                        </div>
                        <div className="text-[15px] text-slate-800 leading-relaxed mb-6 font-medium">
                          <RichContentRenderer content={currentTq.question.content?.text || 'Question'} variant="question" className="prose-sm" />
                        </div>
                        {/* Options */}
                        {currentTq.question.options && (
                          <div className="space-y-2 flex-1 overflow-y-auto">
                            {Object.entries(currentTq.question.options).map(([optId, optText]) => {
                              const isSelected = Array.isArray(answerDisplay) 
                                ? answerDisplay.includes(optId.toLowerCase())
                                : answerDisplay === optId.toLowerCase();
                              const isCorrectOption = Array.isArray(correctAnswerDisplay)
                                ? correctAnswerDisplay.includes(optId.toLowerCase())
                                : correctAnswerDisplay === optId.toLowerCase();
                              const isIncorrect = isSelected && !isCorrectOption;
                              
                              return (
                                <div
                                  key={optId}
                                  className={`p-3 rounded-lg border-2 transition-all ${
                                    isCorrectOption
                                      ? 'border-emerald-500 bg-emerald-50'
                                      : isIncorrect
                                      ? 'border-red-500 bg-red-50'
                                      : isSelected
                                      ? 'border-blue-600 bg-blue-50'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                                      isCorrectOption
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : isIncorrect
                                        ? 'bg-red-500 border-red-500 text-white'
                                        : isSelected
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'border-slate-400 text-slate-600'
                                    }`}>
                                      {optId.toUpperCase()}
                                    </div>
                                    <div className="flex-1 text-sm text-slate-700 pt-0.5">
                                      <RichContentRenderer content={optText} variant="option" />
                                    </div>
                                    {isCorrectOption && (
                                      <div className="flex-shrink-0 text-emerald-600 font-bold text-xs">✓ Correct</div>
                                    )}
                                    {isIncorrect && (
                                      <div className="flex-shrink-0 text-red-600 font-bold text-xs">✗ Wrong</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {currentTq.question.type === 'NUMERIC' && (
                          <div className="flex gap-4 text-sm mt-4">
                            <span className="text-slate-600">Your answer: <strong className="text-blue-600">{answerDisplay ?? '—'}</strong></span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    // Regular layout for single questions
                    <div className="w-full overflow-y-auto p-8 flex flex-col">
                      <div className="flex items-center justify-between border-b-2 border-dashed border-slate-200 pb-2.5 mb-5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-slate-900 text-white text-xs font-bold flex items-center justify-center rounded">{activeQuestions.findIndex(q => q.questionId === currentTq.questionId) + 1}</span>
                        </div>
                      </div>
                      <div className="text-[16px] text-slate-800 leading-relaxed mb-8 font-normal">
                        <RichContentRenderer content={currentTq.question.content?.text || 'Question'} variant="question" />
                      </div>
                      {/* Options */}
                      {currentTq.question.options && (
                        <div className="space-y-2.5 flex-1 max-w-3xl">
                          {Object.entries(currentTq.question.options).map(([optId, optText]) => {
                            const isSelected = Array.isArray(answerDisplay)
                              ? answerDisplay.includes(optId.toLowerCase())
                              : answerDisplay === optId.toLowerCase();
                            const isCorrectOption = Array.isArray(correctAnswerDisplay)
                              ? correctAnswerDisplay.includes(optId.toLowerCase())
                              : correctAnswerDisplay === optId.toLowerCase();
                            const isIncorrect = isSelected && !isCorrectOption;
                            
                            return (
                              <div
                                key={optId}
                                className={`p-3 rounded-lg border-2 transition-all ${
                                  isCorrectOption
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : isIncorrect
                                    ? 'border-red-500 bg-red-50'
                                    : isSelected
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-slate-300 bg-white hover:border-slate-400'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                                    isCorrectOption
                                      ? 'bg-emerald-500 border-emerald-500 text-white'
                                      : isIncorrect
                                      ? 'bg-red-500 border-red-500 text-white'
                                      : isSelected
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'border-slate-400 text-slate-600'
                                  }`}>
                                    {optId.toUpperCase()}
                                  </div>
                                  <div className="flex-1 text-sm text-slate-700 pt-0.5">
                                    <RichContentRenderer content={optText} variant="option" />
                                  </div>
                                  {isCorrectOption && (
                                    <div className="flex-shrink-0 text-emerald-600 font-bold text-xs">✓ Correct</div>
                                  )}
                                  {isIncorrect && (
                                    <div className="flex-shrink-0 text-red-600 font-bold text-xs">✗ Wrong</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {currentTq.question.type === 'NUMERIC' && (
                        <div className="flex gap-4 text-sm mt-4">
                          <span className="text-slate-600">Your answer: <strong className="text-blue-600">{answerDisplay ?? '—'}</strong></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Navigation Footer */}
          {(() => {
            const activeSection = sections[activeSectionIdx];
            const activeQuestions = activeSection?.section.questions ?? [];
            const fsFiltered = activeQuestions.filter((tq) => {
              const ans = answersMap.get(tq.questionId);
              const isCorrect = ans?.answerGiven ? answersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
              const isOmitted = !ans?.answerGiven;
              const isFlagged = ans?.isFlagged ?? false;
              if (filterBy === 'correct') return isCorrect;
              if (filterBy === 'incorrect') return ans?.answerGiven && !isCorrect;
              if (filterBy === 'omitted') return isOmitted;
              if (filterBy === 'flagged') return isFlagged;
              return true;
            });
            const safeIdx = Math.min(currentQuestionIdx, Math.max(fsFiltered.length - 1, 0));
            return (
              <div className="flex-shrink-0 bg-[#fcfcfd] border-t border-slate-200 px-5 h-16 flex items-center justify-between gap-3">
                {/* Previous */}
                <button
                  onClick={() => setCurrentQuestionIdx(Math.max(0, safeIdx - 1))}
                  disabled={safeIdx === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={16} /> Previous
                </button>

                {/* Center: navigator pill + filter */}
                <button
                  onClick={() => setShowFullscreenQuestionNavigator(true)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all cursor-pointer shadow-md"
                >
                  Question {safeIdx + 1} of {fsFiltered.length}
                  <ChevronDown size={16} />
                </button>

                {/* Next */}
                <button
                  onClick={() => setCurrentQuestionIdx(Math.min(fsFiltered.length - 1, safeIdx + 1))}
                  disabled={safeIdx >= fsFiltered.length - 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            );
          })()}

        {/* Question Navigator — inline overlay inside fullscreen so it renders above z-50 */}
        {showFullscreenQuestionNavigator && (() => {
          const activeSection = sections[activeSectionIdx];
          const activeQuestions = activeSection?.section.questions ?? [];
          const navFiltered = activeQuestions.filter((tq) => {
            const ans = answersMap.get(tq.questionId);
            const isCorrect = ans?.answerGiven ? answersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
            const isOmitted = !ans?.answerGiven;
            const isFlagged = ans?.isFlagged ?? false;
            if (filterBy === 'correct') return isCorrect;
            if (filterBy === 'incorrect') return ans?.answerGiven && !isCorrect;
            if (filterBy === 'omitted') return isOmitted;
            if (filterBy === 'flagged') return isFlagged;
            return true;
          });
          const safeIdx = Math.min(currentQuestionIdx, Math.max(navFiltered.length - 1, 0));

          return (
            <div
              className="absolute inset-0 z-60 flex items-center justify-center bg-black/40"
              onClick={() => setShowFullscreenQuestionNavigator(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center border-b border-slate-200 pb-4">
                  <h3 className="text-lg font-bold text-slate-900">{getSectionModuleLabel(activeSection?.section.name || '')}</h3>
                  <p className="text-sm text-slate-500 mt-1">Questions</p>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center gap-5 px-4 py-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-slate-300" /><span className="text-xs font-semibold text-slate-600">Unanswered</span></div>
                  <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-emerald-500" /><span className="text-xs font-semibold text-slate-600">Correct</span></div>
                  <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-red-500" /><span className="text-xs font-semibold text-slate-600">Wrong</span></div>
                  <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full border-2 border-blue-600 bg-blue-50" /><span className="text-xs font-semibold text-slate-600">Current</span></div>
                </div>

                {/* Question Grid */}
                <div className="flex justify-center">
                  <div className="grid grid-cols-9 gap-3 max-h-72 overflow-y-auto p-1">
                    {navFiltered.map((fq, idx) => {
                      const ans = answersMap.get(fq.questionId);
                      const isCorrect = ans?.answerGiven ? answersMatch(ans.answerGiven, fq.question.correctAnswer) : false;
                      const isOmitted = !ans?.answerGiven;
                      const isCurrent = idx === safeIdx;
                      let bgColor = isOmitted ? 'bg-slate-200 border-slate-300' : isCorrect ? 'bg-emerald-100 border-emerald-500' : 'bg-red-100 border-red-500';
                      let textColor = isOmitted ? 'text-slate-600' : isCorrect ? 'text-emerald-700' : 'text-red-700';
                      if (isCurrent) { bgColor = 'bg-blue-600 border-blue-700'; textColor = 'text-white font-bold ring-2 ring-blue-300'; }
                      return (
                        <button
                          key={idx}
                          onClick={() => { setCurrentQuestionIdx(idx); setShowFullscreenQuestionNavigator(false); }}
                          className={`w-11 h-11 rounded-xl font-bold text-sm transition-all flex items-center justify-center border-2 ${bgColor} ${textColor} hover:shadow-md hover:scale-105`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 text-center">
                  <button
                    onClick={() => setShowFullscreenQuestionNavigator(false)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-900 text-white font-semibold text-sm hover:bg-gray-800 transition-all"
                  >
                    Question {safeIdx + 1} of {navFiltered.length} <ChevronDown size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      )}

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
