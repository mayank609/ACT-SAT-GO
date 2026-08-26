import { fmtSec } from '../../lib/utils';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2, Info, Bookmark, AlertCircle, Maximize2, X, HelpCircle, Calculator } from 'lucide-react';
import { DesmosCalculator } from '../../components/calculator/DesmosCalculator';
import { useState, useEffect } from 'react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import { api } from '../../lib/api';
import { satSectionScore } from '../../lib/analyticsData';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/common/Modal';
import { SAT_CONTENT, ALL_DOMAIN_NAMES, SUBDOMAINS_BY_DOMAIN } from '../../data/satDomains';
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
  'Geometry': ['geometry and trigonometry', 'geometry', 'trigonometry', 'trig'],
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


// ── Explanation + Doubt panel for the fullscreen review ──────────────────────
function FsExplanationPanel({ tq, studentAnswer, attemptId }: {
  tq: DbTestQuestion;
  studentAnswer: DbAttemptAnswer | undefined;
  attemptId: string;
}) {
  const [open, setOpen] = useState(false);
  const [doubtStatus, setDoubtStatus] = useState<'doubt' | 'cleared' | null>(studentAnswer?.doubtStatus ?? null);
  const [saving, setSaving] = useState(false);

  const q = tq.question;
  // Doubt CTAs only make sense for skipped or wrong questions (anything not correct).
  const correct = answersMatch(studentAnswer?.answerGiven ?? null, q.correctAnswer);
  const domainLabel = rawDomainLabel(q) ?? matchCanonicalDomain(q) ?? 'General';
  const subTopicLabel = q.content.meta?.subTopic ?? null;
  const skillLabel = q.content.meta?.skill ?? null;

  const handleDoubt = async (next: 'doubt' | 'cleared') => {
    const prev = doubtStatus;
    setDoubtStatus(next);
    setSaving(true);
    try {
      await api.setDoubtStatus(attemptId, q.id, next);
    } catch {
      setDoubtStatus(prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-slate-200 mt-6">
      {/* Toggle row */}
      <div className="flex items-center justify-between py-3">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          Explanation
        </button>
        {doubtStatus === 'doubt' && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">
            <HelpCircle size={12} /> Marked as doubt
          </span>
        )}
        {doubtStatus === 'cleared' && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
            <CheckCircle size={12} /> Cleared
          </span>
        )}
      </div>

      {open && (
        <div className="space-y-4 pb-6">
          {/* Domain / Topic grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
            <div>
              <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider block">Domain</span>
              <span className="text-slate-800 font-bold">{domainLabel}</span>
            </div>
            {subTopicLabel && (
              <div>
                <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider block">Subdomain</span>
                <span className="text-slate-800 font-bold">{subTopicLabel}</span>
              </div>
            )}
            {skillLabel && (
              <div>
                <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider block">Skill</span>
                <span className="text-slate-800 font-bold">{skillLabel}</span>
              </div>
            )}
          </div>

          {/* Explanation text */}
          {q.content.explanation ? (
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 text-slate-800 text-sm leading-relaxed">
              <RichContentRenderer content={q.content.explanation} variant="explanation" />
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No explanation available for this question.</p>
          )}

          {/* Still Doubt / Cleared — only for skipped or wrong questions */}
          {!correct && (
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <p className="text-sm font-medium text-slate-600">
                {doubtStatus === 'cleared'
                  ? 'Great — glad this one is cleared!'
                  : doubtStatus === 'doubt'
                  ? "Saved to My Doubts. We'll keep it handy for revision."
                  : 'After reading the explanation, is your doubt cleared?'}
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleDoubt('doubt')}
                  disabled={saving}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                    doubtStatus === 'doubt'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                  }`}
                >
                  <HelpCircle size={13} /> Still Doubt
                </button>
                <button
                  onClick={() => handleDoubt('cleared')}
                  disabled={saving}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                    doubtStatus === 'cleared'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle size={13} /> Cleared
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
          <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 font-bold flex items-center gap-1">
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

              {options.length > 0 && q.type !== 'NUMERIC' ? (
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
                        {studentAnswer?.answerGiven?.text ?? (studentAnswer?.answerGiven?.value !== undefined ? formatNumericDisplay(studentAnswer.answerGiven.value) : null) ?? '—'}
                      </span>
                    </div>
                    {showAnswer && (
                      <div className="text-sm">
                        <span className="text-slate-500 font-medium">Correct answer: </span>
                        <span className="font-bold text-blue-600">
                          {(q.correctAnswer.displayValues && q.correctAnswer.displayValues.length > 0 ? q.correctAnswer.displayValues.join(' or ') : (q.correctAnswer.value !== undefined ? formatNumericDisplay(q.correctAnswer.value) : ''))}
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

            {options.length > 0 && q.type !== 'NUMERIC' ? (
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
                      {studentAnswer?.answerGiven?.text ?? (studentAnswer?.answerGiven?.value !== undefined ? formatNumericDisplay(studentAnswer.answerGiven.value) : null) ?? '—'}
                    </span>
                  </div>
                  {showAnswer && (
                    <div className="text-sm">
                      <span className="text-slate-500 font-medium">Correct answer: </span>
                      <span className="font-bold text-blue-600">
                        {(q.correctAnswer.displayValues && q.correctAnswer.displayValues.length > 0 ? q.correctAnswer.displayValues.join(' or ') : (q.correctAnswer.value !== undefined ? formatNumericDisplay(q.correctAnswer.value) : ''))}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div>
                <span className="text-slate-400 font-semibold text-xs uppercase tracking-wider block">Domain</span>
                <span className="text-slate-800 font-bold">{domainLabel}</span>
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

            {/* Doubt CTAs — only for skipped or wrong questions */}
            {!correct && (
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
  const { user, dbId } = useAuthStore();
  const isTutorOrAdmin = user?.role === 'tutor' || user?.role === 'admin' || user?.role === 'super_admin';
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [filterBy, setFilterBy] = useState<string>('all');
  const [timeAnalyticsOpen, setTimeAnalyticsOpen] = useState(false);
  const [questionNavigatorOpen, setQuestionNavigatorOpen] = useState(false);
  const [fullscreenReportOpen, setFullscreenReportOpen] = useState(false);
  const [showFullscreenQuestionNavigator, setShowFullscreenQuestionNavigator] = useState(false);
  const [knowledgeSkillsOpen, setKnowledgeSkillsOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [attempt, setAttempt] = useState<DbAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allAttempts, setAllAttempts] = useState<Array<{ id: string; test: { title: string }; completedAt: string | null }>>([]);

  useEffect(() => {
    if (!attemptId) { setError('No attempt ID'); setLoading(false); return; }
    api.getAttempt(attemptId)
      .then(({ attempt: raw }) => setAttempt(raw as DbAttempt))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [attemptId]);

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
    const addedIds = new Set<string>();

    sa.section.questions.forEach((tq) => {
      const q = tq.question;
      const isPassage = q.type === 'PASSAGE' || (q.content && (q.content as any).meta?.isPassage === true);
      if (isPassage && q.childQuestions && q.childQuestions.length > 0) {
        q.childQuestions.forEach((cq) => {
          if (!addedIds.has(cq.id)) {
            addedIds.add(cq.id);
            flattenedQuestions.push({
              id: cq.id,
              questionId: cq.id,
              orderIndex: tq.orderIndex,
              question: {
                ...cq,
                subject: cq.subject || q.subject,
                topic: cq.topic || q.topic,
                content: {
                  ...cq.content,
                  meta: {
                    domain: cq.content?.meta?.domain || q.content?.meta?.domain,
                    subTopic: cq.content?.meta?.subTopic || q.content?.meta?.subTopic,
                    skill: cq.content?.meta?.skill || q.content?.meta?.skill,
                    isPassage: (cq.content?.meta as any)?.isPassage || (q.content?.meta as any)?.isPassage,
                  } as any
                }
              } as any,
              parentPassageText: q.content.text,
            });
          }
        });
      } else {
        const parent = (q as any).parentQuestion;
        if (!addedIds.has(q.id)) {
          addedIds.add(q.id);
          if (parent) {
            flattenedQuestions.push({
              id: q.id,
              questionId: q.id,
              orderIndex: tq.orderIndex,
              question: {
                ...q,
                subject: q.subject || parent.subject,
                topic: q.topic || parent.topic,
                content: {
                  ...q.content,
                  meta: {
                    domain: q.content?.meta?.domain || parent.content?.meta?.domain,
                    subTopic: q.content?.meta?.subTopic || parent.content?.meta?.subTopic,
                    skill: q.content?.meta?.skill || parent.content?.meta?.skill,
                    isPassage: (q.content?.meta as any)?.isPassage || (parent.content?.meta as any)?.isPassage,
                  } as any
                }
              } as any,
              parentPassageText: parent.content?.text,
            });
          } else {
            flattenedQuestions.push(tq);
          }
        }
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
  const rawScore = attempt.totalScore ?? totalCorrect;

  // Subject raw totals (used by the non-SAT branch of the score card)
  const rwSecs = sectionStats.filter((s) => /reading|writing|rw/i.test(s.name));
  const mathSecs = sectionStats.filter((s) => /math/i.test(s.name));
  const rwCorrect = rwSecs.reduce((a, s) => a + s.correct, 0);
  const rwTotal = rwSecs.reduce((a, s) => a + s.total, 0);
  const mathCorrect = mathSecs.reduce((a, s) => a + s.correct, 0);
  const mathTotal = mathSecs.reduce((a, s) => a + s.total, 0);

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

  // Scaled scores apply to Diagnostic, Mock Test and Sectional attempts —
  // only Practice Sheet tests show the raw count instead.
  const isPracticeSheet = (attempt.test.category ?? '').trim() === 'Practice Sheet' || /practice\s*sheet/i.test(attempt.test.title ?? '');
  const showScaled = isSAT && !isPracticeSheet;

  // rwScaled/mathScaled stay 0 (never a real scaled value, which floors at 200) when that
  // subject has no sections in this test — e.g. a Math-only Sectional test — so the score
  // card below can tell "not applicable" apart from a genuine low score.
  let finalScaledScore = rawScore;
  let rwScaled = 0;
  let mathScaled = 0;
  if (rwTotal > 0) rwScaled = satSectionScore(rw1, rw2, rwTotal, false);
  if (mathTotal > 0) mathScaled = satSectionScore(math1, math2, mathTotal, true);
  if (isSAT) finalScaledScore = rwScaled + mathScaled;

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


  // Precompute pacing stats per section for the Time Analysis modal
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
      {/* ── Header: back + test selector + completed date ────────────────────── */}
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
                  {a.test.title}{a.completedAt ? ` — ${new Date(a.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <h1 className="text-xl font-bold text-slate-900 mt-0.5 truncate">{attempt.test.title}</h1>
          )}
          {attempt.completedAt && (
            <p className="text-slate-400 text-xs mt-1">
              Completed {new Date(attempt.completedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* ── Score Card (with performance gauge) ──────────────────────────────── */}
      {(() => {
        // Sectional tests only have sections for one subject — rwTotal/mathTotal is 0 for
        // the one they don't cover, so hide that box instead of showing a fake 200 floor.
        const showRW = rwTotal > 0;
        const showMath = mathTotal > 0;
        return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex items-stretch divide-x divide-slate-200 min-w-[720px]">
          {/* Total Score — gradient panel */}
          <div className="px-8 py-6 shrink-0 text-center bg-gradient-to-br from-[#1b3d6e] to-[#2563eb] rounded-tl-xl rounded-bl-xl flex flex-col justify-center">
            <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Total Score</p>
            <p className="text-6xl font-black text-white leading-none tabular-nums mt-1.5">
              {showScaled ? (showRW && showMath ? finalScaledScore : (showRW ? rwScaled : mathScaled)) : (isSAT ? totalCorrect : rawScore)}
            </p>
            {showScaled ? (
              <p className="text-xs text-blue-300 mt-2.5 border-b border-blue-400/40 pb-0.5 w-fit mx-auto">
                {showRW && showMath ? '400 – 1600' : '200 – 800'}
              </p>
            ) : (
              <p className="text-xs text-blue-300 mt-2">out of {totalQ}</p>
            )}
          </div>
          {/* Reading & Writing */}
          {showRW && (
          <div className="w-36 py-6 shrink-0 text-center flex flex-col justify-center">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">Reading &amp; Writing</p>
            <p className="text-5xl font-black text-blue-900 leading-none tabular-nums mt-2">
              {showScaled ? rwScaled : `${rwCorrect}/${rwTotal}`}
            </p>
            {showScaled ? (
              <p className="text-xs text-slate-400 mt-2 border-b border-slate-200 pb-0.5 w-fit mx-auto">200 – 800</p>
            ) : (
              <p className="text-xs text-slate-400 mt-2">out of {rwTotal}</p>
            )}
          </div>
          )}
          {/* Math */}
          {showMath && (
          <div className="w-36 py-6 shrink-0 text-center flex flex-col justify-center">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight">Math</p>
            <p className="text-5xl font-black text-blue-900 leading-none tabular-nums mt-2">
              {showScaled ? mathScaled : `${mathCorrect}/${mathTotal}`}
            </p>
            {showScaled ? (
              <p className="text-xs text-slate-400 mt-2 border-b border-slate-200 pb-0.5 w-fit mx-auto">200 – 800</p>
            ) : (
              <p className="text-xs text-slate-400 mt-2">out of {mathTotal}</p>
            )}
          </div>
          )}
          {/* Score Range Bar — Mock/Diagnostic SAT only (both subjects present) */}
          {(showScaled && showRW && showMath) && (() => {
            const score = finalScaledScore;
            const pct = Math.min(100, Math.max(0, ((score - 400) / 1200) * 100));
            return (
              <div className="flex-1 px-8 py-6 flex flex-col justify-center gap-2.5 min-w-0">
                <div className="flex justify-between text-xs text-slate-500 font-medium">
                  <span>400</span><span>800</span><span>1200</span><span>1600</span>
                </div>
                <div className="relative h-3 rounded-full" style={{ background: 'linear-gradient(to right, #ef4444 0%, #ef4444 33.33%, #f59e0b 33.33%, #f59e0b 66.67%, #22c55e 66.67%, #22c55e 100%)' }}>
                  <div className="absolute w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md" style={{ left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)' }} />
                </div>
                <div className="flex">
                  <div className="flex-1 text-center">
                    <p className="text-[10px] font-semibold text-slate-600">Below Average</p>
                    <p className="text-[10px] text-slate-400">(400 – 800)</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[10px] font-semibold text-slate-600">Average</p>
                    <p className="text-[10px] text-slate-400">(800 – 1200)</p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[10px] font-semibold text-slate-600">Above Average</p>
                    <p className="text-[10px] text-slate-400">(1200 - 1600)</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
        );
      })()}

      {/* ── KNOWLEDGE AND SKILLS ─────────────────────────────────────────────── */}
      {(() => {
        const activeGroups = Object.keys(KS_DOMAINS) as Array<keyof typeof KS_DOMAINS>;

        return (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setKnowledgeSkillsOpen(!knowledgeSkillsOpen)}
              className="w-full text-left flex items-center justify-between gap-2 px-5 md:px-7 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Knowledge and Skills</h2>
                <span className="flex items-center gap-1 text-blue-600 text-sm font-semibold"><Info size={15} /> New!</span>
              </div>
              <div className="text-slate-600">
                {knowledgeSkillsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </button>

            {knowledgeSkillsOpen && (
              <div className={`grid grid-cols-1 ${activeGroups.length > 1 ? 'lg:grid-cols-2' : ''} gap-10 px-5 md:px-7 pb-6 pt-4 border-t border-slate-100`}>
                {activeGroups.map((group) => (
                  <div key={group}>
                    <h3 className="text-lg font-bold text-slate-900 mb-5">{group}</h3>
                    <div className="space-y-5">
                      {KS_DOMAINS[group].map((d) => {
                        const stat = domainStats[d.name];
                        // Every domain shows the same number of blocks (R&W and Math match),
                        // filled proportionally to accuracy and colored by performance band.
                        const SEGMENTS = 16;
                        const accuracy = stat.total > 0 ? stat.correct / stat.total : 0;
                        const filled = stat.total > 0 ? Math.round(accuracy * SEGMENTS) : 0;
                        const barColor = stat.total === 0 ? 'bg-slate-300'
                          : accuracy >= 0.8 ? 'bg-emerald-500'
                          : accuracy >= 0.5 ? 'bg-amber-400'
                          : 'bg-red-400';
                        return (
                          <div key={d.name}>
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-slate-900">{d.name}</p>
                              {stat.total > 0 && (
                                <span className={`text-xs font-bold ${
                                  accuracy >= 0.8 ? 'text-emerald-600' : accuracy >= 0.5 ? 'text-amber-600' : 'text-red-500'
                                }`}>{Math.round(accuracy * 100)}%</span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mb-2.5">({d.pct}% of test section, {d.range} questions)</p>
                            <div className="flex gap-1">
                              {Array.from({ length: SEGMENTS }).map((_, i) => (
                                <div key={i} className={`h-2.5 flex-1 rounded-[2px] ${i < filled ? barColor : 'bg-slate-200'}`} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

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
              Time Analysis
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
        title="Time Analysis"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500 leading-relaxed">
            Review how much time you spent per question on average, broken down by correctness. This helps identify pacing issues.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-gradient-to-r from-blue-50 to-blue-100/40 border-b border-blue-100 text-blue-800 font-semibold">
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
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setQuestionNavigatorOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-5">
              {/* Title */}
              <div className="text-center pb-3 border-b border-slate-100 relative">
                <h3 className="text-base font-bold text-slate-800 tracking-tight pr-6 pl-6">{getSectionModuleLabel(sections[activeSectionIdx]?.section.name ?? '')}</h3>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5 tracking-wide">Questions</p>
                <button
                  onClick={() => setQuestionNavigatorOpen(false)}
                  className="absolute right-0 top-0 p-1 rounded-lg text-slate-400 hover:bg-slate-50 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Status Legend */}
              <div className="flex items-center justify-center gap-5 px-4 py-2.5 bg-[#f8fafc] rounded-xl border border-slate-100/50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1]" />
                  <span className="text-xs font-semibold text-slate-500">Unanswered</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  <span className="text-xs font-semibold text-slate-500">Correct</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                  <span className="text-xs font-semibold text-slate-500">Wrong</span>
                </div>
              </div>

              {/* Question Grid */}
              {(() => {
                const activeSection = sections[activeSectionIdx];
                const activeQuestions = activeSection?.section.questions ?? [];
                
                // Get the current question in filtered list to find the active one
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

                return (
                  <div className="flex justify-center max-h-[50vh] overflow-y-auto">
                    <div className="grid grid-cols-9 gap-3 p-1.5 justify-center justify-items-center">
                      {activeQuestions.map((tq, idx) => {
                        const ans = answersMap.get(tq.questionId);
                        const isCorrect = ans?.answerGiven ? answersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
                        const isOmitted = !ans?.answerGiven;
                        const isFlagged = ans?.isFlagged ?? false;
                        const isCurrent = currentTq && tq.questionId === currentTq.questionId;
                        const globalNum = idx + 1;
                        
                        let bgColor = 'bg-slate-100';
                        let textColor = 'text-slate-700';
                        
                        if (isCurrent) {
                          bgColor = 'bg-blue-600';
                          textColor = 'text-white';
                        } else if (isCorrect) {
                          bgColor = 'bg-emerald-100';
                          textColor = 'text-emerald-800';
                        } else if (!isOmitted) {
                          // Wrong answer
                          bgColor = 'bg-red-100';
                          textColor = 'text-red-800';
                        }

                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              const idxInFiltered = filteredQuestions.findIndex((q) => q.questionId === tq.questionId);
                              if (idxInFiltered !== -1) {
                                setCurrentQuestionIdx(idxInFiltered);
                              } else {
                                setFilterBy('all');
                                const idxInActive = activeQuestions.findIndex((q) => q.questionId === tq.questionId);
                                setCurrentQuestionIdx(idxInActive);
                              }
                              setQuestionNavigatorOpen(false);
                            }}
                            className={`relative w-10 h-10 md:w-11 md:h-11 rounded-full font-bold text-sm transition-all flex items-center justify-center hover:shadow-md hover:scale-105 ${bgColor} ${textColor}`}
                            title={`Q${globalNum} — ${isOmitted ? 'Unanswered' : isCorrect ? 'Correct' : 'Wrong'}${isFlagged ? ' (Bookmarked)' : ''}`}
                          >
                            {globalNum}
                            {isFlagged && (
                              <Bookmark
                                size={11}
                                className="absolute -top-1 -right-1 text-amber-500 drop-shadow-sm"
                                fill="currentColor"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Question Report Modal - Test-like Interface */}
      {fullscreenReportOpen && createPortal(
        <div
          className="fixed inset-0 bg-white z-[100] overflow-hidden flex flex-col font-sans"
        >
          {/* ── TOP HEADER BAR ───────────────────────────────────────────────── */}
          <header className="flex-shrink-0 bg-[#fcfcfd] border-b border-slate-200 px-4 h-14 flex items-center justify-between gap-3 z-20">
            {/* Left: Section tabs with short labels + Calculator if Math */}
            <div className="flex items-center gap-4 min-w-0">
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

              {/math/i.test(sections[activeSectionIdx]?.section.name ?? '') && (
                <button
                  onClick={() => setShowCalculator((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    showCalculator ? 'bg-[#1b3d6e] text-white border-[#1b3d6e]' : 'bg-blue-50 text-[#1b3d6e] border-blue-200 hover:bg-blue-100'
                  }`}
                  title="Desmos Calculator"
                >
                  <Calculator size={15} /> Calculator
                </button>
              )}
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
                                  className={`p-3 rounded-lg border transition-all ${
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
                                    <div className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
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
                        <FsExplanationPanel key={currentTq.questionId} tq={currentTq} studentAnswer={studentAnswer ?? undefined} attemptId={attemptId!} />
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
                                className={`p-3 rounded-lg border transition-all ${
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
                                  <div className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
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
                      <FsExplanationPanel key={currentTq.questionId} tq={currentTq} studentAnswer={studentAnswer ?? undefined} attemptId={attemptId!} />
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
          const currentTq = fsFiltered[safeIdx];

          return (
            <div
              className="absolute inset-0 z-60"
              onClick={() => setShowFullscreenQuestionNavigator(false)}
            >
              <div
                className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5 border border-slate-100"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Title */}
                <div className="text-center pb-3 border-b border-slate-100 relative">
                  <h3 className="text-base font-bold text-slate-800 tracking-tight pr-6 pl-6">{getSectionModuleLabel(activeSection?.section.name || '')}</h3>
                  <p className="text-[11px] font-medium text-slate-400 mt-0.5 tracking-wide">Questions</p>
                  <button
                    onClick={() => setShowFullscreenQuestionNavigator(false)}
                    className="absolute right-0 top-0 p-1 rounded-lg text-slate-400 hover:bg-slate-50 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-5 px-4 py-2.5 bg-[#f8fafc] rounded-xl border border-slate-100/50">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1]" />
                    <span className="text-xs font-semibold text-slate-500">Unanswered</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                    <span className="text-xs font-semibold text-slate-500">Correct</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                    <span className="text-xs font-semibold text-slate-500">Wrong</span>
                  </div>
                </div>

                {/* Question Grid */}
                <div className="flex justify-center">
                  <div className="grid grid-cols-9 gap-3 p-1.5 justify-center justify-items-center">
                    {activeQuestions.map((tq, idx) => {
                      const ans = answersMap.get(tq.questionId);
                      const isCorrect = ans?.answerGiven ? answersMatch(ans.answerGiven, tq.question.correctAnswer) : false;
                      const isOmitted = !ans?.answerGiven;
                      const isFlagged = ans?.isFlagged ?? false;
                      const isCurrent = currentTq && tq.questionId === currentTq.questionId;
                      const globalNum = idx + 1;
                      
                      let bgColor = 'bg-slate-100';
                      let textColor = 'text-slate-700';
                      
                      if (isCurrent) {
                        bgColor = 'bg-blue-600';
                        textColor = 'text-white';
                      } else if (isCorrect) {
                        bgColor = 'bg-emerald-100';
                        textColor = 'text-emerald-800';
                      } else if (!isOmitted) {
                        bgColor = 'bg-red-100';
                        textColor = 'text-red-800';
                      }

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            const idxInFiltered = fsFiltered.findIndex((q) => q.questionId === tq.questionId);
                            if (idxInFiltered !== -1) {
                              setCurrentQuestionIdx(idxInFiltered);
                            } else {
                              setFilterBy('all');
                              const idxInActive = activeQuestions.findIndex((q) => q.questionId === tq.questionId);
                              setCurrentQuestionIdx(idxInActive);
                            }
                            setShowFullscreenQuestionNavigator(false);
                          }}
                          className={`relative w-10 h-10 md:w-11 md:h-11 rounded-full font-bold text-sm transition-all flex items-center justify-center hover:shadow-md hover:scale-105 ${bgColor} ${textColor}`}
                          title={`Q${globalNum} — ${isOmitted ? 'Unanswered' : isCorrect ? 'Correct' : 'Wrong'}${isFlagged ? ' (Bookmarked)' : ''}`}
                        >
                          {globalNum}
                          {isFlagged && (
                            <Bookmark
                              size={11}
                              className="absolute -top-1 -right-1 text-amber-500 drop-shadow-sm"
                              fill="currentColor"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>,
      document.body
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
            <Button variant="secondary" onClick={() => navigate('/my-tests')}>My Assignments</Button>
          </>
        )}
      </div>

      <DesmosCalculator open={showCalculator} onClose={() => setShowCalculator(false)} />
    </div>
  );
}
