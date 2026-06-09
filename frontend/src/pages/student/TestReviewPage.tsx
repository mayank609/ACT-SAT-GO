import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2, Info, Bookmark, AlertCircle, Maximize2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { ScoreCalculator } from '../../components/calculator/ScoreCalculator';
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
  content: { text: string; explanation?: string | null; meta?: { subTopic?: string; skill?: string } }
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

// Resolve a question to a subdomain, searched only within its own domain so a
// generic candidate (e.g. "function") can't leak across domains.
function matchCanonicalSubdomain(q: DbQuestion, domain: string | null): string | null {
  if (!domain) return null
  const subs = SUBDOMAINS_BY_DOMAIN[domain]
  if (!subs) return null
  const cands = domainCandidates(q).map((c) => c.trim().toLowerCase())
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

function getAiCoachingTip(topic: string, _difficulty: string, correct: boolean, timeSpent: number): string {
  const timeLimit = 75; // SAT recommended avg is ~75s for RW, ~84s for Math
  const pacingStatus = timeSpent > timeLimit ? 'slow' : 'good';
  
  const tips: Record<string, string[]> = {
    algebra: [
      "Isolate variables first before performing operations. Substitution with simple values can help verify results.",
      "Check linear equation signs and constants. A common pitfall is forgetting to distribute negative signs."
    ],
    advanced_math: [
      "For quadratics, recall the quadratic formula and vertex form. Factoring quickly saves time.",
      "Identify the relationships between graph translations and algebraic manipulations."
    ],
    geometry: [
      "Always sketch the figure if not provided. Recall key trigonometric ratios (SOHCAHTOA) and theorem rules.",
      "Watch for units conversions and reference angles in circle theorems."
    ],
    ideas: [
      "Identify the central claim of the passage first. Avoid options that introduce outside details not in the text.",
      "Rely only on direct evidence. If an option requires a multi-step assumption, it is likely incorrect."
    ],
    structure: [
      "Examine how paragraphs connect and the function of sentences in context. Look for structural transition words.",
      "Pay attention to tone and author perspective when analyzing cross-texts."
    ],
    conventions: [
      "Focus on subject-verb agreement and punctuation rules (commas, semicolons, dashes). Look for independent clauses.",
      "Ensure modifiers are placed adjacent to the nouns they describe to avoid dangling modifiers."
    ]
  };

  let key = 'algebra';
  const tLower = topic.toLowerCase();
  if (tLower.includes('algebra')) key = 'algebra';
  else if (tLower.includes('math') || tLower.includes('quadratic') || tLower.includes('function')) key = 'advanced_math';
  else if (tLower.includes('geometry') || tLower.includes('trig')) key = 'geometry';
  else if (tLower.includes('ideas') || tLower.includes('information') || tLower.includes('evidence')) key = 'ideas';
  else if (tLower.includes('structure') || tLower.includes('craft') || tLower.includes('vocabulary')) key = 'structure';
  else if (tLower.includes('conventions') || tLower.includes('grammar') || tLower.includes('punctuation') || tLower.includes('sentence')) key = 'conventions';

  const defaultTips = tips[key] || tips['algebra'];
  const tipText = defaultTips[correct ? 0 : 1] || defaultTips[0];
  
  const pacingText = pacingStatus === 'slow' 
    ? `You spent ${timeSpent}s here, which is above the optimal pacing. Try to eliminate wrong choices faster.`
    : `Great pacing! You spent ${timeSpent}s, leaving you buffer time for harder questions.`;
    
  return `[AI Recommendation] ${tipText} ${pacingText}`;
}

export function QuestionDetailedReviewCard({ tq, localIndex, studentAnswer, attemptId }: {
  tq: DbTestQuestion;
  localIndex: number;
  studentAnswer: DbAttemptAnswer | undefined;
  attemptId: string;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showAiTip, setShowAiTip] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(studentAnswer?.isFlagged ?? false);

  const q = tq.question;
  const correct = answersMatch(studentAnswer?.answerGiven ?? null, q.correctAnswer);
  const skipped = !studentAnswer?.answerGiven;
  const status: 'correct' | 'incorrect' | 'omitted' = skipped ? 'omitted' : correct ? 'correct' : 'incorrect';
  
  const options = dbOptionsToDisplay(q.options);
  const userAnswerDisplay = dbAnswerToDisplay(studentAnswer?.answerGiven ?? null);
  const correctAnswerDisplay = dbAnswerToDisplay(q.correctAnswer);
  const parentQuestionText = (q as any).parentQuestionText;
  
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
      {parentQuestionText ? (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100/80">
          {/* Left Column: Passage */}
          <div className="p-6 overflow-y-auto h-[520px] space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Passage</div>
            <div className="prose prose-slate max-w-none text-slate-800 text-sm leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
              <RichContentRenderer content={parentQuestionText} variant="question" className="prose-sm" />
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
          
          <button
            onClick={() => {
              setShowAnalysis(true);
              setShowAiTip(!showAiTip);
            }}
            className="text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-md shadow-sm transition-colors"
          >
            Analyze
          </button>
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

            {showAiTip && (
              <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100 text-sm text-blue-950 font-medium">
                {getAiCoachingTip(topicLabel, q.difficultyLevel, correct, studentAnswer?.timeSpentSeconds ?? 0)}
              </div>
            )}

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
  if (isSAT) {
    let rwScaled = 200;
    let mathScaled = 200;

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

      {/* Score summary */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-4 md:p-6 text-white">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          <div className="col-span-2 sm:col-span-1 text-center bg-white/10 rounded-xl p-3 md:p-4">
            <p className="text-3xl md:text-5xl font-bold">{isSAT ? finalScaledScore : rawScore}</p>
            <p className="text-blue-200 text-xs mt-1">{isSAT ? 'Scaled Score' : 'Score'}</p>
            <p className="text-blue-300 text-xs">{isSAT ? '(estimated)' : '(raw points)'}</p>
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
        <p className="text-slate-500 text-sm mb-7">View your performance across the 8 content domains — and their subdomains — measured on the SAT.</p>

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
      </div>

      {/* ── QUESTION WISE REPORT ───────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div id="question-report-anchor" className="flex items-center justify-between">
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
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-3 gap-4">
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
            <div className="space-y-6">
              {/* Question counter & info */}
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-slate-700">
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
                  <div className="flex items-center justify-between gap-3 px-2 py-3 bg-slate-50 rounded-b-xl border border-t-0 border-slate-200 shadow-sm">
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
      <Modal
        isOpen={questionNavigatorOpen}
        onClose={() => setQuestionNavigatorOpen(false)}
        title=""
        size="md"
      >
        <div className="space-y-6">
          {/* Title */}
          <div className="text-center border-b border-slate-200 pb-4">
            <h3 className="text-lg md:text-xl font-bold text-slate-900">{getSectionModuleLabel(sections[activeSectionIdx]?.section.name ?? '')}</h3>
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
              <div className="flex justify-center">
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
      </Modal>

      {/* Fullscreen Question Report Modal */}
      {fullscreenReportOpen && (
        <div className="fixed inset-0 bg-white z-50 overflow-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Question wise report</h2>
            <button
              onClick={() => setFullscreenReportOpen(false)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-all"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
            {/* Tabs & Filters bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-3 gap-4">
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

            {/* Single Question View */}
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
                <div className="space-y-6">
                  {/* Question counter & info */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-700">
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
                      <div className="flex items-center justify-between gap-3 px-2 py-3 bg-slate-50 rounded-b-xl border border-t-0 border-slate-200 shadow-sm">
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
      )}

      {/* Score Calculator */}
      <div className="mt-8">
        <ScoreCalculator rw1={rw1} rw2={rw2} math1={math1} math2={math2} isAdaptive={true} />
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
