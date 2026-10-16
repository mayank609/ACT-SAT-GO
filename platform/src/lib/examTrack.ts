// A student's exam track. Most students prepare for the SAT or ACT; "CUSTOM"
// students prepare for anything else (IELTS, school exams, AP…) and are given
// tests the Test Builder tags with category "Custom" and the exam's name as
// the sub-category. Custom tests are scored on raw marks, never SAT/ACT scales.
// Stored in User.permissions as `track` and `customExam`. Students created
// before tracks existed have none and keep behaving as before.

export const TRACKS = ['SAT', 'ACT', 'CUSTOM'] as const
export type Track = (typeof TRACKS)[number]

export const CUSTOM_CATEGORY = 'Custom'
export const CUSTOM_EXAM_MAX = 60

/** True for tests built for a custom exam (Test.category "Custom"). */
export const isCustomTest = (test: { category?: string | null }) =>
  (test.category ?? '').trim().toLowerCase() === CUSTOM_CATEGORY.toLowerCase()

/**
 * Validates a track update. `undefined` means "not provided"; a custom track
 * needs an exam name. Returns the fields to merge into permissions.
 */
export function parseTrack(
  track: unknown,
  customExam: unknown,
): { error: string } | { value: { track?: Track; customExam?: string | null } } {
  if (track === undefined && customExam === undefined) return { value: {} }
  if (track === null || track === '') return { value: { track: undefined, customExam: null } }
  const t = String(track ?? '').toUpperCase()
  if (!TRACKS.includes(t as Track)) return { error: 'Exam track must be SAT, ACT or Custom' }
  if (t !== 'CUSTOM') return { value: { track: t as Track, customExam: null } }
  const name = typeof customExam === 'string' ? customExam.trim() : ''
  if (!name) return { error: 'Enter the name of the exam this student is preparing for' }
  if (name.length > CUSTOM_EXAM_MAX) return { error: `Exam name must be at most ${CUSTOM_EXAM_MAX} characters` }
  return { value: { track: 'CUSTOM', customExam: name } }
}

/** Target score rules per track (custom targets are a percentage). */
export function targetScoreError(score: number, track: string | null | undefined): string | null {
  if (Number.isNaN(score)) return 'Target score must be a number'
  if (track === 'CUSTOM') return score >= 1 && score <= 100 ? null : 'Target score for a custom exam is a percentage between 1 and 100'
  if (track === 'SAT') return score >= 400 && score <= 1600 ? null : 'Target score must be a valid SAT score between 400 and 1600'
  if (track === 'ACT') return score >= 1 && score <= 36 ? null : 'Target score must be a valid ACT score between 1 and 36'
  // No track set: accept either a valid ACT (1–36) or SAT (400–1600) score.
  return (score >= 1 && score <= 36) || (score >= 400 && score <= 1600)
    ? null
    : 'Target score must be a valid ACT score (1–36) or SAT score (400–1600)'
}
