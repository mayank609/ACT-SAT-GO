// Visit-level time analytics.
//
// The test player logs an append-only stream of events (AttemptEvent). This
// module rebuilds *visits* from it: one continuous stretch with a question on
// screen, from ENTER to the next LEAVE. A question can have many visits, and
// each visit records the answers chosen during it and the result when the
// student left. It is pure (no I/O), so it can be re-run on old attempts.

export type EventType =
  | 'ENTER' | 'LEAVE' | 'ANSWER' | 'CLEAR' | 'FLAG' | 'UNFLAG'
  | 'HIDDEN' | 'VISIBLE' | 'IDLE' | 'ACTIVE' | 'HEARTBEAT'
  | 'SUBMIT' | 'MODULE_END' | 'TIME_UP'

export const EVENT_TYPES: ReadonlySet<string> = new Set<EventType>([
  'ENTER', 'LEAVE', 'ANSWER', 'CLEAR', 'FLAG', 'UNFLAG', 'HIDDEN', 'VISIBLE',
  'IDLE', 'ACTIVE', 'HEARTBEAT', 'SUBMIT', 'MODULE_END', 'TIME_UP',
])

export interface TrackedEvent {
  seq: number
  type: EventType | string
  questionId: string | null
  /** ms since the attempt started */
  t: number
  choice?: unknown
}

export type Result = 'correct' | 'incorrect' | 'unanswered'

/** Grades a choice for one question. Must return 'unanswered' for empty choices. */
export type Grader = (questionId: string, choice: unknown) => Result

export interface AnswerMark {
  t: number
  choice: unknown
  result: Result
  /** result before this change */
  from: Result
}

export interface Visit {
  questionId: string
  visitNo: number
  start: number
  end: number
  activeMs: number
  /** periods inside the visit when the tab was hidden or the student idle */
  pauses: { start: number; end: number }[]
  entryChoice: unknown
  entryResult: Result
  exitChoice: unknown
  exitResult: Result
  answers: AnswerMark[]
  /** the visit in which the finally-submitted answer was given */
  isFinal: boolean
  /** very short click-through with no answer change */
  glance: boolean
  /** flagged for review when the student left */
  flagged: boolean
}

export function isEmptyChoice(choice: unknown): boolean {
  if (choice === null || choice === undefined || choice === '') return true
  if (Array.isArray(choice)) return choice.length === 0
  if (typeof choice === 'object') {
    const c = choice as { key?: unknown; keys?: unknown[]; value?: unknown }
    if ('key' in c) return c.key === null || c.key === undefined || c.key === ''
    if ('keys' in c) return !Array.isArray(c.keys) || c.keys.length === 0
    if ('value' in c) return c.value === null || c.value === undefined || c.value === ''
    // passage answers: { childId: answer | null }
    return Object.values(choice as Record<string, unknown>).every(isEmptyChoice)
  }
  return false
}

/** Silence longer than this (heartbeats are every 10 s) means the player stopped. */
const RESUME_GAP_MS = 15_000

const sameChoice = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function buildVisits(
  events: TrackedEvent[],
  grade: Grader,
  opt: { minVisitMs?: number } = {},
): Visit[] {
  const minVisitMs = opt.minVisitMs ?? 1500
  const ev = [...events].sort((a, b) => a.seq - b.seq)
  const g = (q: string, choice: unknown): Result =>
    isEmptyChoice(choice) ? 'unanswered' : grade(q, choice)

  const visits: Visit[] = []
  const visitCount: Record<string, number> = {}
  const answerNow: Record<string, unknown> = {}
  const flagNow: Record<string, boolean> = {}
  let open: (Omit<Visit, 'end' | 'activeMs' | 'exitChoice' | 'exitResult' | 'isFinal' | 'glance' | 'flagged'>) | null = null
  let pausedAt: number | null = null
  let lastT = 0

  const close = (t: number) => {
    if (!open) return
    const end = Math.max(t, open.start)
    if (pausedAt !== null) {
      if (end > pausedAt) open.pauses.push({ start: pausedAt, end })
      pausedAt = null
    }
    const pausedMs = open.pauses.reduce((s, p) => s + (p.end - p.start), 0)
    const activeMs = Math.max(0, end - open.start - pausedMs)
    const exitChoice = answerNow[open.questionId] ?? null
    visits.push({
      ...open,
      end,
      activeMs,
      exitChoice,
      exitResult: g(open.questionId, exitChoice),
      isFinal: false,
      glance: activeMs < minVisitMs && open.answers.length === 0,
      flagged: !!flagNow[open.questionId],
    })
    open = null
  }

  for (const e of ev) {
    // t is monotonic per tracker segment; never let a late/odd event move time backwards
    const t = Math.max(lastT, Number.isFinite(e.t) ? e.t : lastT)
    const prevT = lastT
    lastT = t
    const q = e.questionId
    switch (e.type) {
      case 'ENTER': {
        if (!q) break
        if (open) {
          // The page went away (tab closed / refreshed: a trailing HIDDEN with no
          // VISIBLE) or went silent past a heartbeat (crash): the open visit ended
          // then, and this ENTER — even for the same question — is a new visit.
          const interrupted = pausedAt !== null || t - prevT > RESUME_GAP_MS
          if (!interrupted && open.questionId === q) break // duplicate ENTER for the visit already open
          if (pausedAt !== null) {
            const endAt = pausedAt
            pausedAt = null
            close(endAt)
          } else {
            close(interrupted ? prevT : t) // defensive: a LEAVE was lost
          }
        }
        visitCount[q] = (visitCount[q] || 0) + 1
        const entryChoice: unknown = answerNow[q] ?? null
        open = {
          questionId: q, visitNo: visitCount[q], start: t, pauses: [],
          entryChoice, entryResult: g(q, entryChoice), answers: [],
        }
        break
      }
      case 'LEAVE':
        if (open && (!q || open.questionId === q)) close(t)
        break
      case 'ANSWER':
      case 'CLEAR': {
        if (!q) break
        const choice = e.type === 'CLEAR' ? null : (e.choice ?? null)
        const prev = answerNow[q] ?? null
        if (sameChoice(prev, choice)) break // re-click of the same option
        answerNow[q] = choice
        if (open && open.questionId === q) {
          open.answers.push({ t, choice, result: g(q, choice), from: g(q, prev) })
        }
        break
      }
      case 'FLAG': if (q) flagNow[q] = true; break
      case 'UNFLAG': if (q) flagNow[q] = false; break
      case 'HIDDEN':
      case 'IDLE':
        if (open && pausedAt === null) pausedAt = t
        break
      case 'VISIBLE':
      case 'ACTIVE':
        if (open && pausedAt !== null) {
          open.pauses.push({ start: pausedAt, end: t })
          pausedAt = null
        }
        break
      case 'SUBMIT':
      case 'MODULE_END':
      case 'TIME_UP':
        close(t)
        break
      default:
        break // HEARTBEAT etc. only advance lastT
    }
  }
  close(lastT) // crash / tab closed: the last heartbeat bounds the loss

  // Mark the visit in which the FINAL answer was given.
  const lastAnswerVisit: Record<string, number> = {}
  visits.forEach((v, i) => { if (v.answers.length) lastAnswerVisit[v.questionId] = i })
  visits.forEach((v, i) => { v.isFinal = lastAnswerVisit[v.questionId] === i })
  return visits
}

export type ChangeType = 'none' | 'wrong_to_right' | 'right_to_wrong' | 'wrong_to_wrong'

export interface QuestionSummary {
  questionId: string
  visits: number
  totalMs: number
  firstVisitMs: number
  /** R = right, W = wrong, – = cleared, joined with → */
  pattern: string
  change: ChangeType
  finalResult: Result
  answeredInVisit: number | null
  flaggedAtEnd: boolean
}

export function summarise(visits: Visit[], questionIds: string[]): QuestionSummary[] {
  const short: Record<Result, string> = { correct: 'R', incorrect: 'W', unanswered: '–' }
  return questionIds.map((q) => {
    const vs = visits.filter((v) => v.questionId === q)
    const answers = vs.flatMap((v) => v.answers)
    const pattern = answers.map((a) => short[a.result]).join('→') || '–'
    const final: Result = vs.length ? vs[vs.length - 1].exitResult : 'unanswered'
    let change: ChangeType = 'none'
    const graded = answers.filter((a) => a.result !== 'unanswered')
    if (graded.length > 1) {
      const first = graded[0].result
      const last = graded[graded.length - 1].result
      change = first === 'incorrect' && last === 'correct' ? 'wrong_to_right'
        : first === 'correct' && last !== 'correct' ? 'right_to_wrong' : 'wrong_to_wrong'
      if (first === 'correct' && last === 'correct') change = 'none'
    }
    const finalIdx = vs.findIndex((v) => v.isFinal)
    return {
      questionId: q,
      visits: vs.length,
      totalMs: vs.reduce((s, v) => s + v.activeMs, 0),
      firstVisitMs: vs[0]?.activeMs ?? 0,
      pattern,
      change,
      finalResult: final,
      answeredInVisit: finalIdx >= 0 ? finalIdx + 1 : null,
      flaggedAtEnd: vs.length ? vs[vs.length - 1].flagged : false,
    }
  })
}

export interface InsightMetrics {
  rightToWrong: number
  wrongToRight: number
  /** revisits that improved the result / revisits total */
  revisits: number
  revisitsImproved: number
  /** visits longer than 2× the average that ended incorrect */
  timeSinks: number
  firstPassCorrect: number
  firstPassAnswered: number
  skipAndReturn: number
  glances: number
  pausedMs: number
  unfinishedFlags: number
}

const RANK: Record<Result, number> = { unanswered: 0, incorrect: 1, correct: 2 }

export function insights(visits: Visit[], summary: QuestionSummary[], avgMs: number): InsightMetrics {
  const byQ = new Map<string, Visit[]>()
  visits.forEach((v) => byQ.set(v.questionId, [...(byQ.get(v.questionId) ?? []), v]))
  let firstPassCorrect = 0
  let firstPassAnswered = 0
  let skipAndReturn = 0
  for (const vs of byQ.values()) {
    const first = vs[0]
    if (first.answers.length || first.exitResult !== 'unanswered') {
      firstPassAnswered++
      if (first.exitResult === 'correct') firstPassCorrect++
    } else if (vs.slice(1).some((v) => v.exitResult !== 'unanswered')) {
      skipAndReturn++
    }
  }
  const revisitList = visits.filter((v) => v.visitNo > 1 && !v.glance)
  return {
    rightToWrong: summary.filter((s) => s.change === 'right_to_wrong').length,
    wrongToRight: summary.filter((s) => s.change === 'wrong_to_right').length,
    revisits: revisitList.length,
    revisitsImproved: revisitList.filter((v) => RANK[v.exitResult] > RANK[v.entryResult]).length,
    timeSinks: avgMs > 0 ? visits.filter((v) => v.activeMs > 2 * avgMs && v.exitResult === 'incorrect').length : 0,
    firstPassCorrect,
    firstPassAnswered,
    skipAndReturn,
    glances: visits.filter((v) => v.glance).length,
    pausedMs: visits.reduce((s, v) => s + v.pauses.reduce((p, x) => p + (x.end - x.start), 0), 0),
    unfinishedFlags: summary.filter((s) => s.flaggedAtEnd).length,
  }
}
