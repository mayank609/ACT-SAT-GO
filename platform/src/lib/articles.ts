// Articles — rules for the /api/articles routes. Who-can-do-what lives in
// lib/studentSharing.ts (same as flashcards).
//
// Pipeline for each assigned student:
//   ASSIGNED ──(student submits summary)──▶ SUBMITTED ──(tutor approves)──▶ APPROVED
//                                              │
//                                              └─(tutor requests revision)─▶ NEEDS_REVISION ──(resubmit)──▶ SUBMITTED
//
// While SUBMITTED (not reviewed yet) the student may resubmit freely. Every
// submission gets AI feedback (lib/articleFeedback.ts).

export const STATUS = {
  ASSIGNED: 'ASSIGNED',
  SUBMITTED: 'SUBMITTED',
  NEEDS_REVISION: 'NEEDS_REVISION',
  APPROVED: 'APPROVED',
} as const
export type AssignmentStatus = (typeof STATUS)[keyof typeof STATUS]

export const LIMITS = {
  title: 160,
  topic: 120,
  subject: 60,
  body: 60_000,
  sourceUrl: 500,
  summary: 10_000,
  feedback: 2_000,
  instructions: 2_000,
  minSummaryWords: { min: 10, max: 500, default: 50 },
}

/** A summary is rejected when at least this share of it is copied word-for-word. */
export const MAX_COPIED_RATIO = 0.5
/** Run length (in words) that counts as copied text. */
const SHINGLE = 6

export interface ArticleInput {
  title: string
  topic: string | null
  subject: string | null
  body: string
  sourceUrl: string | null
  instructions: string | null
  minSummaryWords: number
}

export function parseArticleInput(raw: unknown): { error: string } | { value: ArticleInput } {
  const b = (raw ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const title = str(b.title)
  const topic = str(b.topic) || null
  const subject = str(b.subject) || null
  const body = typeof b.body === 'string' ? b.body.replace(/\r\n/g, '\n').trim() : ''
  const sourceUrl = str(b.sourceUrl) || null
  const instructions = typeof b.instructions === 'string' ? b.instructions.replace(/\r\n/g, '\n').trim() || null : null
  const min = b.minSummaryWords === undefined || b.minSummaryWords === null || b.minSummaryWords === ''
    ? LIMITS.minSummaryWords.default
    : Number(b.minSummaryWords)

  if (!title) return { error: 'Title is required' }
  if (title.length > LIMITS.title) return { error: `Title must be at most ${LIMITS.title} characters` }
  if (topic && topic.length > LIMITS.topic) return { error: `Topic must be at most ${LIMITS.topic} characters` }
  if (subject && subject.length > LIMITS.subject) return { error: `Subject must be at most ${LIMITS.subject} characters` }
  if (!body) return { error: 'The article text is required' }
  if (body.length > LIMITS.body) return { error: `The article must be at most ${LIMITS.body.toLocaleString()} characters` }
  if (sourceUrl) {
    if (sourceUrl.length > LIMITS.sourceUrl) return { error: 'Source link is too long' }
    try {
      const u = new URL(sourceUrl)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad protocol')
    } catch {
      return { error: 'Source link must be a full web address starting with https://' }
    }
  }
  if (instructions && instructions.length > LIMITS.instructions) {
    return { error: `Instructions must be at most ${LIMITS.instructions.toLocaleString()} characters` }
  }
  if (!Number.isInteger(min) || min < LIMITS.minSummaryWords.min || min > LIMITS.minSummaryWords.max) {
    return { error: `Minimum summary length must be between ${LIMITS.minSummaryWords.min} and ${LIMITS.minSummaryWords.max} words` }
  }
  return { value: { title, topic, subject, body, sourceUrl, instructions, minSummaryWords: min } }
}

/** Optional due date: undefined = not provided, null = clear it. */
export function parseDueAt(v: unknown): { error: string } | { value: Date | null | undefined } {
  if (v === undefined) return { value: undefined }
  if (v === null || v === '') return { value: null }
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return { error: 'Due date is not a valid date' }
  return { value: d }
}

const tokens = (text: string) =>
  text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? []

export function wordCount(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length
}

export function readingMinutes(body: string): number {
  return Math.max(1, Math.round(wordCount(body) / 200))
}

/**
 * Share (0–1) of the summary's words that sit inside a run of ≥ SHINGLE words
 * copied verbatim (case/punctuation-insensitive) from the article.
 */
export function copiedRatio(summary: string, article: string): number {
  const s = tokens(summary)
  if (s.length < SHINGLE) return 0
  const a = tokens(article)
  const grams = new Set<string>()
  for (let i = 0; i + SHINGLE <= a.length; i++) grams.add(a.slice(i, i + SHINGLE).join(' '))
  const copied = new Uint8Array(s.length)
  for (let i = 0; i + SHINGLE <= s.length; i++) {
    if (grams.has(s.slice(i, i + SHINGLE).join(' '))) copied.fill(1, i, i + SHINGLE)
  }
  const n = copied.reduce((acc, x) => acc + x, 0)
  return Math.round((n / s.length) * 100) / 100
}
