import { getAccessToken, supabase } from './supabase'

const BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:3000')

// Authorization header from the current Supabase session (for non-JSON
// requests like FormData uploads that bypass request()).
async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Short-lived GET cache ────────────────────────────────────────────────────
// Several pages load the same read-mostly data (assigned tests, a student's
// attempts, full attempt payloads for analytics, test definitions…), so moving
// between Dashboard → My Tests → Analytics → Mistakes refetched identical,
// expensive payloads every time — and a page that mounts two consumers fired
// duplicate requests in parallel. cachedGet() dedupes in-flight requests and
// reuses a response for a short TTL.
//
// Safety rules:
//  - Any non-GET request through this client (or an upload/delete) clears the
//    whole cache, so the app never shows its own writes stale.
//  - The raw response text is cached and re-parsed for every caller, so callers
//    can never mutate each other's objects.
//  - Failed requests are never cached.
type CacheEntry = { text: Promise<string>; expiresAt: number }
const getCache = new Map<string, CacheEntry>()
const GET_CACHE_MAX = 200

export function clearApiCache() {
  getCache.clear()
}

/** Drop cached GETs whose path starts with `prefix` (for explicit "Refresh" buttons). */
export function invalidateApiCache(prefix: string) {
  for (const key of [...getCache.keys()]) if (key.startsWith(prefix)) getCache.delete(key)
}

async function cachedGet<T>(path: string, ttlMs: number, timeoutMs?: number): Promise<T> {
  const now = Date.now()
  const hit = getCache.get(path)
  if (hit && hit.expiresAt > now) {
    return JSON.parse(await hit.text) as T
  }
  if (getCache.size >= GET_CACHE_MAX) {
    for (const [k, v] of getCache) if (v.expiresAt <= now) getCache.delete(k)
    if (getCache.size >= GET_CACHE_MAX) getCache.delete(getCache.keys().next().value as string)
  }
  const text = requestText(path, undefined, timeoutMs)
  const entry: CacheEntry = { text, expiresAt: now + ttlMs }
  getCache.set(path, entry)
  try {
    return JSON.parse(await text) as T
  } catch (err) {
    // Don't keep failures around (only evict if a newer entry hasn't replaced it).
    if (getCache.get(path) === entry) getCache.delete(path)
    throw err
  }
}

/**
 * POST a batch of test-player events. Bypasses request() on purpose: it runs
 * every few seconds during a test and must not clear the GET cache, and it
 * uses keepalive so the final batch survives the tab closing.
 */
export async function postAttemptEvents(attemptId: string, events: unknown[], token?: string | null): Promise<boolean> {
  try {
    const body = JSON.stringify({ events })
    // With a token passed in, fetch() is called synchronously (no await before
    // it) — required when the page is unloading, where an awaited token lookup
    // would never get to send the request.
    const auth = token !== undefined
      ? (token ? { Authorization: `Bearer ${token}` } : {})
      : await authHeaders()
    const res = await fetch(`${BASE}/api/attempts/${attemptId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body,
      // keepalive lets the last batch survive the tab closing, but browsers
      // reject keepalive bodies over 64 KB — only use it for small batches.
      keepalive: body.length < 60_000,
    })
    // 4xx other than auth/rate errors will never succeed — drop rather than retry forever.
    return res.ok || (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429)
  } catch {
    return false
  }
}

export type TaResult = 'correct' | 'incorrect' | 'unanswered'
export interface TaVisit {
  questionId: string
  visitNo: number
  start: number
  end: number
  activeMs: number
  pauses: { start: number; end: number }[]
  entryChoice: unknown
  entryResult: TaResult
  exitChoice: unknown
  exitResult: TaResult
  answers: { t: number; choice: unknown; result: TaResult; from: TaResult }[]
  isFinal: boolean
  glance: boolean
  flagged: boolean
}
export interface TaSummary {
  questionId: string
  visits: number
  totalMs: number
  firstVisitMs: number
  pattern: string
  change: 'none' | 'wrong_to_right' | 'right_to_wrong' | 'wrong_to_wrong'
  finalResult: TaResult
  answeredInVisit: number | null
  flaggedAtEnd: boolean
}
export interface TaMetrics {
  rightToWrong: number
  wrongToRight: number
  revisits: number
  revisitsImproved: number
  timeSinks: number
  firstPassCorrect: number
  firstPassAnswered: number
  skipAndReturn: number
  glances: number
  pausedMs: number
  unfinishedFlags: number
}
export interface TaSection {
  sectionId: string
  name: string
  orderIndex: number
  questionIds: string[]
  offsetMs: number
  endMs: number
  avgMs: number
  visits: TaVisit[]
  summary: TaSummary[]
  metrics: TaMetrics
}
export interface TimeAnalyticsResponse {
  hasEvents: boolean
  sections: TaSection[]
}

const SHORT_TTL = 30_000
const LONG_TTL = 5 * 60_000

async function request<T>(path: string, options?: RequestInit, timeoutMs?: number): Promise<T> {
  return JSON.parse(await requestText(path, options, timeoutMs)) as T
}

/**
 * With `timeoutMs`, a request that gets no answer in time fails with status 504
 * instead of waiting forever (callers show their fallback and can retry).
 */
async function requestText(path: string, options?: RequestInit, timeoutMs?: number): Promise<string> {
  if (timeoutMs && typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    try {
      return await requestText(path, { ...options, signal: AbortSignal.timeout(timeoutMs) })
    } catch (err) {
      if ((err as Error)?.name !== 'TimeoutError') throw err
      const e = new Error('The server took too long to respond') as Error & { status?: number }
      e.status = 504
      throw e
    }
  }

  const method = (options?.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') clearApiCache()

  const buildHeaders = (token: string | null): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> | undefined),
  })

  const token = await getAccessToken()
  let res = await fetch(`${BASE}${path}`, { ...options, headers: buildHeaders(token) })

  // On 401, force a session refresh and retry once — handles stale cached tokens.
  if (res.status === 401) {
    const { data } = await supabase.auth.refreshSession()
    const freshToken = data.session?.access_token ?? null
    res = await fetch(`${BASE}${path}`, { ...options, headers: buildHeaders(freshToken) })
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    const message = err.error ?? 'Request failed'
    const e = new Error(message) as Error & { status?: number }
    e.status = res.status
    throw e
  }
  return res.text()
}

export interface DbUser {
  id: string
  name: string
  email: string
  role: string
  /** True for free-demo-test accounts created from the website (permissions.accountType = 'DEMO'). */
  isDemo?: boolean
  /** Profile picture as a small image data URL, or null. */
  avatar?: string | null
  createdAt: string
  /** Set when an admin has soft-deleted this user; null/undefined means active. */
  deletedAt?: string | null
  tutorId?: string | null
  tutorName?: string | null
  tutors?: { id: string; name: string }[]
  studentIds?: string[]
  studentCount?: number
  testsAttempted?: number
  avgScore?: number | null
  lastActive?: string | null
  grade?: string | null
  targetScore?: number | null
  targetDate?: string | null
  specialization?: string[]
  /** Tutor compensation rate. Only ever present in the response for an admin/super-admin caller. */
  hourlyRate?: number | null
  /** Tutor may create student accounts (set by an admin). */
  canAddStudents?: boolean
  /** Tutor account flagged as a coordinator: may add tutors and students. */
  coordinator?: boolean
  /** Account still uses a temporary password (only meaningful for the signed-in user). */
  mustChangePassword?: boolean
  phone?: string | null
  parentPhone?: string | null
  dob?: string | null
  schoolName?: string | null
  board?: string | null
  timezone?: string | null
  firstClassDate?: string | null
  programVariant?: string | null
  /** Exam track: 'SAT' | 'ACT' | 'CUSTOM' (null = not set, treated as SAT) */
  track?: string | null
  /** Name of the custom exam when track is CUSTOM, e.g. "IELTS" */
  customExam?: string | null
  mockVariant?: string | null
  accommodation?: boolean | null
  stage?: number | null
  onboarded?: boolean | null
  diagnosticDecision?: 'keep' | 'leave' | null
  manualDiagTotal?: number | null
  manualDiagRW?: number | null
  manualDiagMath?: number | null
  salarySettlements?: Array<{
    id: string
    amount: number
    paidAt: string
    note?: string
    settledBy?: string
    sessionIds?: string[]
    hours?: number
  }>
  paidSessionIds?: string[]
}

export interface ClassProgressEntry {
  id: string
  topic: string
  homework: string
  notes: string
  classDate: string
  author: string
  createdAt: string
  startTime?: string
  durationMinutes?: number
  actualDurationMinutes?: number
  subject?: string
  status?: string
  sessionType?: string
  understanding?: number
  attendance?: string
  engagement?: string
  nextSessionGoal?: string
  nextSessionAt?: string
}

export interface LiveClass {
  roomId: string
  studentId: string
  studentName: string
  tutorId: string
  tutorName: string
  startedAt: string
  joinUrl: string
  canEnd: boolean
}

export interface ClassProgressInput {
  topic: string
  homework?: string
  notes?: string
  classDate?: string
  author: string
  startTime?: string
  durationMinutes?: number
  actualDurationMinutes?: number
  subject?: string
  status?: string
  sessionType?: string
  understanding?: number
  attendance?: string
  engagement?: string
  nextSessionGoal?: string
  nextSessionAt?: string
}

export interface DbTestPackageItem {
  id: string
  packageId: string
  testId: string
  orderIndex: number
  test: {
    id: string
    title: string
    status: string
    category?: string | null
    subCategory?: string | null
    sections: Array<{ id: string; durationMinutes: number; _count?: { questions: number } }>
  }
}

export interface DbTestPackage {
  id: string
  title: string
  description: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  items: DbTestPackageItem[]
}


// ── Flashcards ───────────────────────────────────────────────────────────────
export interface FlashcardCard { id: string; front: string; back: string; hint?: string | null; example?: string | null }
export interface FlashcardShareInfo {
  studentId: string
  studentName: string
  sharedAt: string
  viewedAt: string | null
  lastStudiedAt: string | null
  knownCount: number
  /** Cards flipped or marked at least once */
  seenCount: number
}
/** A deck as listed for a tutor/admin (with sharing + progress). */
export interface FlashcardDeckSummary {
  id: string
  title: string
  topic: string
  description: string | null
  subject: string | null
  createdAt: string
  updatedAt: string
  createdById: string
  createdByName: string
  cardCount: number
  shares: FlashcardShareInfo[]
}
/** A deck as listed for a student (with their own progress). */
export interface StudentFlashcardDeck {
  id: string
  title: string
  topic: string
  description: string | null
  subject: string | null
  updatedAt: string
  createdByName: string
  cardCount: number
  sharedAt: string
  viewedAt: string | null
  lastStudiedAt: string | null
  knownCount: number
  /** Cards flipped or marked at least once */
  seenCount: number
}
export interface FlashcardDeckDetail {
  id: string
  title: string
  topic: string
  description: string | null
  subject: string | null
  createdAt: string
  updatedAt: string
  createdById: string
  createdByName: string
  cards: FlashcardCard[]
  canEdit: boolean
  /** Manager view only */
  shares?: FlashcardShareInfo[]
  /** Student view only */
  knownCardIds?: string[]
  seenCardIds?: string[]
}
export interface FlashcardDeckInput {
  title: string
  topic: string
  description?: string
  subject?: string
  cards: Array<{ id?: string; front: string; back: string; hint?: string; example?: string }>
  studentIds?: string[]
}

// ── Articles ─────────────────────────────────────────────────────────────────
export type ArticleStatus = 'ASSIGNED' | 'SUBMITTED' | 'NEEDS_REVISION' | 'APPROVED'
/** Claude's feedback on one submitted summary. "pending" = not generated yet. */
export interface ArticleAiFeedback {
  status: 'ready' | 'pending'
  score?: number
  strengths?: string[]
  improvements?: string[]
  comment?: string
  generatedAt?: string
  lastAttemptAt?: string
  /** Tutors/admins only: why the last attempt failed */
  error?: string
}
export interface ArticleSubmissionRecord {
  n: number
  summary: string
  wordCount: number
  copiedRatio: number | null
  submittedAt: string
  ai: ArticleAiFeedback | null
}
/** One student's assignment as a tutor/admin sees it. */
export interface ArticleAssignmentInfo {
  studentId: string
  studentName: string
  status: ArticleStatus
  assignedAt: string
  dueAt: string | null
  openedAt: string | null
  submittedAt: string | null
  reviewedAt: string | null
  summaryWordCount: number
  copiedRatio: number | null
  /** List view: latest submission's AI score / status */
  aiScore?: number | null
  aiStatus?: 'ready' | 'pending' | null
  /** Detail view only — null until the student submits. */
  summary?: string | null
  submissionCount?: number
  feedback?: string | null
  reviewedByName?: string | null
  aiFeedback?: ArticleAiFeedback | null
  /** Every submission, newest first */
  submissions?: ArticleSubmissionRecord[]
}
export interface ArticleSummary {
  id: string
  title: string
  topic: string | null
  subject: string | null
  sourceUrl: string | null
  minSummaryWords: number
  readMinutes: number
  createdAt: string
  updatedAt: string
  createdById: string
  createdByName: string
  assignments: ArticleAssignmentInfo[]
}
export interface StudentArticle {
  id: string
  title: string
  topic: string | null
  subject: string | null
  readMinutes: number
  minSummaryWords: number
  createdByName: string
  status: ArticleStatus
  assignedAt: string
  dueAt: string | null
  openedAt: string | null
  submittedAt: string | null
  reviewedAt: string | null
  summaryWordCount: number
  hasFeedback: boolean
  aiScore?: number | null
  aiStatus?: 'ready' | 'pending' | null
}
export interface MyArticleAssignment {
  status: ArticleStatus
  assignedAt: string
  dueAt: string | null
  openedAt: string
  summary: string | null
  summaryWordCount: number
  submittedAt: string | null
  submissionCount: number
  feedback: string | null
  reviewedAt: string | null
  reviewedByName: string | null
  aiFeedback: ArticleAiFeedback | null
  /** Every submission, newest first */
  submissions: ArticleSubmissionRecord[]
}
export interface ArticleDetail {
  id: string
  title: string
  topic: string | null
  subject: string | null
  body: string
  sourceUrl: string | null
  instructions: string | null
  minSummaryWords: number
  createdAt: string
  updatedAt: string
  createdById: string
  createdByName: string
  readMinutes: number
  maxCopiedRatio: number
  canEdit: boolean
  /** Manager view only */
  assignments?: ArticleAssignmentInfo[]
  /** Student view only */
  assignment?: MyArticleAssignment
}
export interface ArticleInput {
  title: string
  topic?: string
  subject?: string
  body: string
  sourceUrl?: string
  instructions?: string
  minSummaryWords?: number
  dueAt?: string | null
  studentIds?: string[]
}

// ── Protected study materials (view-only PDFs) ───────────────────────────────
export interface MaterialShareInfo {
  userId: string
  name: string
  role: 'STUDENT' | 'TUTOR' | string
  sharedAt: string
  viewedAt: string | null
  lastPage: number | null
}
/** A material the user uploaded (or, for admins, any material). */
export interface ManagedMaterial {
  id: string
  title: string
  description: string | null
  subject: string | null
  fileName: string
  fileSize: number
  pageCount: number
  createdAt: string
  updatedAt: string
  createdById: string
  createdByName: string
  createdByAdmin: boolean
  shares: MaterialShareInfo[]
}
/** A material someone shared with the user. */
export interface SharedMaterial {
  id: string
  title: string
  description: string | null
  subject: string | null
  pageCount: number
  updatedAt: string
  createdByName: string
  sharedAt: string
  viewedAt: string | null
  lastPage: number | null
  canDownload: boolean
}
export interface MaterialDetail {
  id: string
  title: string
  description: string | null
  subject: string | null
  /** Only for users who may download it */
  fileName?: string
  fileSize: number
  pageCount: number
  pageSizes: Array<[number, number]>
  createdById: string
  createdByName: string
  createdAt: string
  updatedAt: string
  canManage: boolean
  canDownload: boolean
  lastPage: number | null
  watermark: string
  /** Manager view only */
  sharedWith?: string[]
}

// ── ASG Library ──────────────────────────────────────────────────────────────
export interface LibraryAssignee {
  id: string
  name: string | null
  email: string
  role: string
}
export interface LibraryDocument {
  id: string
  title: string
  description: string | null
  fileName: string
  sizeBytes: number
  createdAt: string
  updatedAt: string
  /** Admin listing only. */
  uploadedByName?: string | null
  assignees?: LibraryAssignee[]
  /** Student/tutor listing only: when it was assigned to them. */
  assignedAt?: string
}

export interface PtmReport {
  id: string;
  ptmDate: string;
  targetTestDate: string | null;
  prepStatus: string;
  mocksCompleted: number;
  remarks: string;
  createdAt: string;
  createdBy: string;
}

export interface PtmStudent {
  id: string;
  name: string;
  email: string;
  targetDate: string | null;
  mocksCompleted: number;
  reports: PtmReport[];
}

export const api = {
  // Users
  getUsersByRole: (role?: string, opts?: { deleted?: boolean }) => {
    const qs = new URLSearchParams()
    if (role) qs.set('role', role)
    if (opts?.deleted) qs.set('deleted', 'true')
    return request<{ users: DbUser[] }>(`/api/users${qs.toString() ? '?' + qs.toString() : ''}`)
  },
  getUser: (userId: string) => request<{ user: DbUser }>(`/api/users/${userId}`),
  createUser: (body: {
    name: string
    email: string
    role: string
    grade?: string
    targetScore?: number
    targetDate?: string
    tutorId?: string
    tutorIds?: string[]
    specialization?: string[]
    /** Tutor compensation rate — only applied when role is 'TUTOR'. */
    hourlyRate?: number | null
    coordinator?: boolean
    canAddStudents?: boolean
    phone?: string
    parentPhone?: string
    dob?: string
    schoolName?: string
    board?: string
    timezone?: string
    firstClassDate?: string
    programVariant?: string
    track?: string | null
    customExam?: string | null
    mockVariant?: string
    accommodation?: boolean
    stage?: number
    onboarded?: boolean
    manualDiagTotal?: number | null
    manualDiagRW?: number | null
    manualDiagMath?: number | null
  }) => request<{ user: DbUser; tempPassword?: string; warning?: string }>('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (userId: string, body: {
    name?: string
    email?: string
    role?: string
    grade?: string
    targetScore?: number
    targetDate?: string
    specialization?: string[]
    tutorId?: string | null
    tutorIds?: string[]
    /** Tutor compensation rate — silently ignored server-side unless the caller is an admin. */
    avatar?: string | null
    hourlyRate?: number | null
    canAddStudents?: boolean
    /** The signed-in user set their own password; clears the temporary-password flag. */
    passwordChanged?: boolean
    notifications?: Record<string, boolean>
    phone?: string
    parentPhone?: string
    dob?: string
    schoolName?: string
    board?: string
    timezone?: string
    firstClassDate?: string
    programVariant?: string
    track?: string | null
    customExam?: string | null
    mockVariant?: string
    accommodation?: boolean
    stage?: number
    onboarded?: boolean
    diagnosticDecision?: 'keep' | 'leave' | null
    manualDiagTotal?: number | null
    manualDiagRW?: number | null
    manualDiagMath?: number | null
    salarySettlements?: Array<{
      id: string
      amount: number
      paidAt: string
      note?: string
      settledBy?: string
      sessionIds?: string[]
      hours?: number
    }>
    paidSessionIds?: string[]
  }) => request<{ user: DbUser }>(`/api/users/${userId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  /** Soft-deletes by default (reversible via restoreUser). Pass { permanent: true } to erase for good. */
  deleteUser: (userId: string, opts?: { permanent?: boolean }) =>
    request<{ success: boolean }>(`/api/users/${userId}${opts?.permanent ? '?permanent=true' : ''}`, { method: 'DELETE' }),
  restoreUser: (userId: string) =>
    request<{ user: { id: string; deletedAt: null } }>(`/api/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ restore: true }) }),
  /** Generates and sets a brand-new temporary password — the only way to recover access if the original creation popup was lost, since the original is never stored in plaintext. */
  resetUserPassword: (userId: string) =>
    request<{ tempPassword: string }>(`/api/users/${userId}/reset-password`, { method: 'POST' }),

  // Tutor assignments
  getTutorAssignments: (params?: { tutorId?: string; studentId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.tutorId) qs.set('tutorId', params.tutorId)
    if (params?.studentId) qs.set('studentId', params.studentId)
    return cachedGet<{ assignments: Array<{ id: string; tutorId: string; studentId: string; tutor: DbUser; student: DbUser }> }>(
      `/api/tutor-assignments${qs.toString() ? '?' + qs.toString() : ''}`,
      SHORT_TTL,
    )
  },
  createTutorAssignment: (tutorId: string, studentId: string) =>
    request<{ assignment: unknown }>('/api/tutor-assignments', {
      method: 'POST',
      body: JSON.stringify({ tutorId, studentId }),
    }),
  deleteTutorAssignment: (tutorId: string, studentId: string) =>
    request<{ success: boolean }>(`/api/tutor-assignments?tutorId=${tutorId}&studentId=${studentId}`, { method: 'DELETE' }),

  // Test assignments
  getTestAssignments: (testId: string) =>
    request<{ assignments: Array<{ id: string; testId: string; studentId: string; studentName: string; studentEmail: string; dueAt: string | null; availableFrom: string | null; availableUntil: string | null; maxAttempts: number; isActive: boolean; createdAt: string }> }>(`/api/test-assignments?testId=${testId}`),
  createTestAssignments: (body: { testId: string; studentIds: string[]; dueAt?: string | null; availableFrom?: string | null; availableUntil?: string | null; maxAttempts?: number }) =>
    request<{ created: number; skipped: number }>('/api/test-assignments', { method: 'POST', body: JSON.stringify(body) }),
  deleteTestAssignment: (testId: string, studentId: string) =>
    request<{ success: boolean }>(`/api/test-assignments?testId=${testId}&studentId=${studentId}`, { method: 'DELETE' }),
  /** Reschedules a single assignment's due date. */
  rescheduleTestAssignment: (assignmentId: string, dueAt: string | null) =>
    request<{ assignment: { id: string; dueAt: string | null } }>(`/api/test-assignments/${assignmentId}`, { method: 'PATCH', body: JSON.stringify({ dueAt }) }),
  /** Unassigns a test by assignment id — removes the assignment, not any attempt already made against it. */
  unassignTest: (assignmentId: string) =>
    request<{ success: boolean }>(`/api/test-assignments/${assignmentId}`, { method: 'DELETE' }),

  // Tests (admin)
  getAllTests: (params?: { category?: string; subCategory?: string }) => {
    const qs = new URLSearchParams({ all: 'true' });
    if (params?.category) qs.set('category', params.category);
    if (params?.subCategory) qs.set('subCategory', params.subCategory);
    return request<{ tests: unknown[] }>(`/api/tests?${qs.toString()}`);
  },
  getPublishedTests: (params?: { category?: string; subCategory?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.subCategory) qs.set('subCategory', params.subCategory);
    return request<{ tests: unknown[] }>(`/api/tests${qs.toString() ? '?' + qs.toString() : ''}`);
  },
  getAvailableTests: (studentId: string) =>
    request<{ tests: unknown[] }>(`/api/tests/available?studentId=${studentId}`),
  getTest: (testId: string) => cachedGet<{ test: unknown }>(`/api/tests/${testId}`, SHORT_TTL),
  createTest: (body: Record<string, unknown>) =>
    request<{ test: { id: string } }>('/api/tests', { method: 'POST', body: JSON.stringify(body) }),
  updateTest: (testId: string, body: Record<string, unknown>) =>
    request<{ test: unknown }>(`/api/tests/${testId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTest: (testId: string) =>
    request<{ success: boolean }>(`/api/tests/${testId}`, { method: 'DELETE' }),
  cloneTest: (testId: string) =>
    request<{ test: { id: string } }>(`/api/tests/${testId}/clone`, { method: 'POST', body: '{}' }),

  // Test packages (bundles of tests)
  getTestPackages: () =>
    request<{ packages: DbTestPackage[] }>('/api/test-packages'),
  createTestPackage: (body: { title: string; description?: string | null; testIds: string[]; createdById: string }) =>
    request<{ package: DbTestPackage }>('/api/test-packages', { method: 'POST', body: JSON.stringify(body) }),
  updateTestPackage: (packageId: string, body: { title?: string; description?: string | null; testIds?: string[] }) =>
    request<{ package: DbTestPackage }>(`/api/test-packages/${packageId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTestPackage: (packageId: string) =>
    request<{ success: boolean }>(`/api/test-packages/${packageId}`, { method: 'DELETE' }),
  assignTestPackage: (packageId: string, body: { studentIds: string[]; dueAt?: string | null; availableFrom?: string | null; availableUntil?: string | null; maxAttempts?: number }) =>
    request<{ created: number; skipped: number; tests: number; students: number }>(`/api/test-packages/${packageId}/assign`, { method: 'POST', body: JSON.stringify(body) }),

  // Attempts
  startAttempt: (testId: string, studentId: string) =>
    request<{ attemptId: string }>('/api/attempts', {
      method: 'POST',
      body: JSON.stringify({ testId, studentId }),
    }),
  getAttempt: (attemptId: string) => cachedGet<{ attempt: unknown }>(`/api/attempts/${attemptId}`, SHORT_TTL),
  /** Always hits the network — for resuming an in-progress attempt, where stale data is never acceptable. */
  getAttemptFresh: (attemptId: string) => request<{ attempt: unknown }>(`/api/attempts/${attemptId}`),
  getStudentAttempts: (studentId: string) =>
    cachedGet<{ attempts: unknown[]; /** true once each question carries topic tags + passage children (no per-attempt enrich needed). */ taxonomy?: boolean }>(`/api/students/${studentId}/attempts`, SHORT_TTL),
  /** Everything the admin Students analysis table needs, for every student in scope, in one request. */
  getStudentsAnalysisSummary: () =>
    request<{ students: Record<string, {
      attempts: unknown[]
      latestScore: number
      lastTrend: { testTitle: string; date: string } | null
      sectionStats: Array<{ sectionName: string; correct: number; incorrect: number; skipped: number; totalQuestions: number }>
    }> }>('/api/students/analysis-summary'),
  /** Light list: each attempt's test (title/category/subCategory/section names), score and dates — no questions or answers. */
  getStudentAttemptSummaries: (studentId: string) =>
    cachedGet<{ attempts: unknown[] }>(`/api/students/${studentId}/attempts?summary=1`, SHORT_TTL),
  getAssignedTests: (studentId: string) =>
    cachedGet<{ assignedTests: unknown[] }>(`/api/students/${studentId}/assigned-tests`, SHORT_TTL),

  // Test engine
  startSection: (attemptId: string, sectionId: string) =>
    request<{ sectionAttempt: unknown; endTime: number }>(
      `/api/attempts/${attemptId}/sections/${sectionId}/start`,
      { method: 'POST' }
    ),
  autosaveAnswer: (
    attemptId: string,
    body: {
      questionId?: string
      answerGiven?: unknown
      timeSpentSeconds?: number
      isFlagged?: boolean
      attemptState?: unknown
    }
  ) =>
    request<{ success: boolean }>(`/api/attempts/${attemptId}/autosave`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  // Mark a reviewed question as still-a-doubt or cleared. Persists durably on
  // the AttemptAnswer DB row (NOT Redis) so the "My Doubts" page can list them
  // long after the attempt's Redis cache has expired.
  setDoubtStatus: (attemptId: string, questionId: string, doubtStatus: 'doubt' | 'cleared' | null) =>
    request<{ success: boolean }>(`/api/attempts/${attemptId}/doubt`, {
      method: 'POST',
      body: JSON.stringify({ questionId, doubtStatus }),
    }),
  getAutosaveState: (attemptId: string) =>
    request<{ state: unknown; answers: Record<string, unknown> }>(`/api/attempts/${attemptId}/autosave`),
  getSectionTimer: (attemptId: string, sectionId: string) =>
    request<{ remainingSeconds: number; expired: boolean }>(`/api/attempts/${attemptId}/sections/${sectionId}/timer`),
  submitSection: (attemptId: string, sectionId: string) =>
    request<{ success: boolean }>(
      `/api/attempts/${attemptId}/sections/${sectionId}/submit`,
      { method: 'POST' }
    ),
  // Flashcards
  getFlashcardDecks: () =>
    request<{ decks: FlashcardDeckSummary[] | StudentFlashcardDeck[] }>('/api/flashcards'),
  getFlashcardDeck: (deckId: string) =>
    request<{ deck: FlashcardDeckDetail }>(`/api/flashcards/${deckId}`),
  createFlashcardDeck: (body: FlashcardDeckInput) =>
    request<{ id: string; sharedWith: number }>('/api/flashcards', { method: 'POST', body: JSON.stringify(body) }),
  updateFlashcardDeck: (deckId: string, body: FlashcardDeckInput) =>
    request<{ id: string }>(`/api/flashcards/${deckId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteFlashcardDeck: (deckId: string) =>
    request<{ success: boolean }>(`/api/flashcards/${deckId}`, { method: 'DELETE' }),
  setFlashcardShares: (deckId: string, studentIds: string[]) =>
    request<{ added: number; removed: number; total: number }>(`/api/flashcards/${deckId}/shares`, {
      method: 'PUT', body: JSON.stringify({ studentIds }),
    }),
  saveFlashcardProgress: (deckId: string, knownCardIds: string[], seenCardIds?: string[]) =>
    request<{ knownCount: number; seenCount: number; cardCount: number }>(`/api/flashcards/${deckId}/progress`, {
      method: 'PUT', body: JSON.stringify({ knownCardIds, seenCardIds }),
    }),

  // Articles
  getArticles: () =>
    request<{ articles: ArticleSummary[] | StudentArticle[] }>('/api/articles'),
  getArticle: (articleId: string) =>
    request<{ article: ArticleDetail }>(`/api/articles/${articleId}`),
  createArticle: (body: ArticleInput) =>
    request<{ id: string; assignedTo: number }>('/api/articles', { method: 'POST', body: JSON.stringify(body) }),
  updateArticle: (articleId: string, body: ArticleInput) =>
    request<{ id: string }>(`/api/articles/${articleId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteArticle: (articleId: string) =>
    request<{ success: boolean }>(`/api/articles/${articleId}`, { method: 'DELETE' }),
  setArticleAssignments: (articleId: string, studentIds: string[], dueAt?: string | null) =>
    request<{ added: number; removed: number; total: number }>(`/api/articles/${articleId}/assignments`, {
      method: 'PUT', body: JSON.stringify({ studentIds, dueAt }),
    }),
  saveArticleSummary: (articleId: string, summary: string, submit: boolean) =>
    request<{ status: ArticleStatus; summaryWordCount: number; copiedRatio?: number; aiFeedback?: ArticleAiFeedback | null }>(`/api/articles/${articleId}/summary`, {
      method: 'PUT', body: JSON.stringify({ summary, submit }),
    }),
  /** Retry Claude's feedback on the latest submission (studentId: tutors/admins only). */
  requestArticleFeedback: (articleId: string, studentId?: string) =>
    request<{ aiFeedback: ArticleAiFeedback | null }>(`/api/articles/${articleId}/feedback`, {
      method: 'POST', body: JSON.stringify({ studentId }),
    }),
  reviewArticleSummary: (articleId: string, studentId: string, decision: 'approve' | 'revise', feedback?: string) =>
    request<{ status: ArticleStatus }>(`/api/articles/${articleId}/review`, {
      method: 'PUT', body: JSON.stringify({ studentId, decision, feedback }),
    }),

  // Protected study materials
  getMaterials: () =>
    request<{ shared: SharedMaterial[]; mine: ManagedMaterial[] }>('/api/materials'),
  getMaterial: (materialId: string) =>
    request<{ material: MaterialDetail }>(`/api/materials/${materialId}`),
  /** Multipart upload with progress (0–1). */
  uploadMaterial: async (
    input: { file: File; title: string; description?: string; subject?: string; recipientIds: string[] },
    onProgress?: (fraction: number) => void,
  ) => {
    clearApiCache()
    const form = new FormData()
    form.append('file', input.file)
    form.append('title', input.title)
    if (input.description) form.append('description', input.description)
    if (input.subject) form.append('subject', input.subject)
    form.append('recipientIds', JSON.stringify(input.recipientIds))
    const headers = await authHeaders()
    return new Promise<{ id: string; pageCount: number; sharedWith: number }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${BASE}/api/materials`)
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total) }
      xhr.onload = () => {
        let body: { error?: string } & Record<string, unknown> = {}
        try { body = JSON.parse(xhr.responseText) } catch { /* non-JSON error page */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(body as unknown as { id: string; pageCount: number; sharedWith: number })
        else reject(new Error(body.error || (xhr.status === 413 ? 'The PDF is too large' : 'Upload failed')))
      }
      xhr.onerror = () => reject(new Error('Upload failed — check your connection'))
      xhr.send(form)
    })
  },
  updateMaterial: (materialId: string, body: { title: string; description?: string; subject?: string }) =>
    request<{ id: string }>(`/api/materials/${materialId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteMaterial: (materialId: string) =>
    request<{ success: boolean }>(`/api/materials/${materialId}`, { method: 'DELETE' }),
  setMaterialShares: (materialId: string, recipientIds: string[]) =>
    request<{ added: number; removed: number; total: number }>(`/api/materials/${materialId}/shares`, {
      method: 'PUT', body: JSON.stringify({ recipientIds }),
    }),
  saveMaterialProgress: (materialId: string, page: number) =>
    request<{ saved: boolean }>(`/api/materials/${materialId}/progress`, { method: 'PUT', body: JSON.stringify({ page }) }),
  /** One watermarked page image (auth header required, so it is fetched as a blob). */
  getMaterialPage: async (materialId: string, page: number, width: number, signal?: AbortSignal) => {
    const res = await fetch(`${BASE}/api/materials/${materialId}/pages/${page}?w=${width}`, { headers: await authHeaders(), signal })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not load the page')
    return res.blob()
  },
  /** The original PDF — only allowed for its uploader and admins. */
  downloadMaterial: async (materialId: string, fileName: string) => {
    const res = await fetch(`${BASE}/api/materials/${materialId}/file`, { headers: await authHeaders() })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Download failed')
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  },

  // Visit-level time analytics (see lib/questionTimeTracker.ts)
  getAttemptEventState: (attemptId: string) =>
    // The player sends no events until this answers, so don't wait long.
    request<{ lastSeq: number; lastT: number; serverElapsedMs: number }>(`/api/attempts/${attemptId}/events`, undefined, 10_000),
  getTimeAnalytics: (attemptId: string) =>
    cachedGet<TimeAnalyticsResponse>(`/api/attempts/${attemptId}/time-analytics`, LONG_TTL, 60_000),
  logCheatingEvent: (
    attemptId: string,
    eventType: string,
    metadata?: Record<string, unknown>
  ) =>
    request<{ success: boolean }>(`/api/attempts/${attemptId}/cheat-log`, {
      method: 'POST',
      body: JSON.stringify({ eventType, metadata }),
    }),

  // Analytics
  getStudentAnalytics: (studentId: string, attemptId?: string) =>
    request<{
      trend: Array<{ date: string; score: number; testTitle: string; attemptId: string }>
      sectionStats: Array<{
        sectionId: string
        sectionName: string
        totalQuestions: number
        correct: number
        incorrect: number
        skipped: number
        accuracy: number
        timeAllocated: number
        timeUsed: number
      }>
      questionPacingStats: Array<{
        questionIndex: number
        sectionName: string
        timeSpentSeconds: number
        status: 'correct' | 'incorrect' | 'skipped'
        difficulty: string
        topicName: string
      }>
      overallAccuracy: number
      totalAttempts: number
      latestScore: number
      avgScore: number
      cheatingLogs?: Array<{
        id: string
        attemptId: string
        testTitle: string
        eventType: string
        metadata: any
        createdAt: string
      }>
    }>(`/api/analytics/student/${studentId}${attemptId ? '?attemptId=' + attemptId : ''}`),

  // Questions (Question Bank)
  getQuestions: (params?: { type?: string; difficulty?: string; search?: string; subject?: string }) => {
    const qs = new URLSearchParams()
    if (params?.type) qs.set('type', params.type)
    if (params?.difficulty) qs.set('difficulty', params.difficulty)
    if (params?.search) qs.set('search', params.search)
    if (params?.subject) qs.set('subject', params.subject)
    return request<{
      questions: Array<{
        id: string; type: string; content: { text: string; explanation?: string }
        options: Record<string, string> | null; correctAnswer: Record<string, unknown>
        difficultyLevel: string; topic: { id: string; name: string } | null
        referenceId: string | null; subject: string | null;
        createdAt: string; usedInTests: Array<{ testId: string; testTitle: string }>
      }>
    }>(`/api/questions${qs.toString() ? '?' + qs.toString() : ''}`)
  },
  createQuestion: (body: {
    type: string
    text: string
    options?: Array<{ id: string; text: string }>
    correctAnswer: string | string[] | number
    difficulty: string
    topic?: string
    subject?: string
    referenceId?: string
    explanation?: string
    marks?: number
    marksNegative?: number
  }) => request<{ question: unknown }>('/api/questions', { method: 'POST', body: JSON.stringify(body) }),
  deleteQuestion: (id: string) =>
    request<{ success: boolean }>(`/api/questions?id=${id}`, { method: 'DELETE' }),

  // Platform analytics (admin dashboard charts)
  getPlatformAnalytics: () =>
    request<{
      activityData: Array<{ date: string; attempts: number; completions: number }>
      scoreDistribution: Array<{ range: string; count: number }>
      scoreDistributionACT: Array<{ range: string; count: number }>
      scoreDistributionSAT: Array<{ range: string; count: number }>
      hasSAT: boolean
      hasACT: boolean
      avgScoreImprovement: number | null
      subjectStrength: { rw: number | null; math: number | null }
      overallAccuracy: number | null
      openDoubtsCount: number
      dailyScoreTrend: Array<{ date: string; avgSAT: number | null; avgACT: number | null }>
      recentActivity: Array<{ id: string; text: string; timestamp: string }>
      questionsAttemptedThisWeek: number
      avgStudyHoursThisWeek: number | null
    }>('/api/analytics/platform'),

  // Attempts (for monitoring & assignments)
  getAttempts: (params?: { status?: string; studentId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.studentId) qs.set('studentId', params.studentId)
    return request<{
      attempts: Array<{
        id: string; studentId: string; studentName: string
        testId: string; testTitle: string; isRawScored: boolean; sectionName: string
        sectionIndex: number; totalSections: number; tabSwitches: number
        answersCount: number; startedAt: string; completedAt: string | null
        status: string; progress: number; timeRemaining: number; totalScore: number | null
      }>
    }>(`/api/attempts${qs.toString() ? '?' + qs.toString() : ''}`)
  },

  // Notifications
  getNotifications: (userId: string) =>
    request<{
      notifications: Array<{
        id: string
        userId: string
        type: string
        title: string
        body: string
        read: boolean
        createdAt: string
      }>
    }>(`/api/notifications?userId=${userId}`),
  createNotification: (body: { userId: string; type: string; title: string; body: string }) =>
    request<{ notification: unknown }>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  markNotificationRead: (notifId: string) =>
    request<{ success: boolean }>(`/api/notifications/${notifId}`, { method: 'PATCH' }),

  // Dynamic RBAC permissions matrix
  getPermissions: () =>
    request<{
      permissions: Array<{
        permission: string
        label: string
        category: 'view' | 'edit' | 'analytics' | 'monitoring' | 'assignment' | 'admin'
        super_admin: boolean
        admin: boolean
        tutor: boolean
        student: boolean
      }>
    }>('/api/permissions'),
  updatePermissions: (
    permissions: Array<{
      permission: string
      label: string
      category: 'view' | 'edit' | 'analytics' | 'monitoring' | 'assignment' | 'admin'
      super_admin: boolean
      admin: boolean
      tutor: boolean
      student: boolean
    }>
  ) =>
    request<{ success: boolean; permissions: any[] }>('/api/permissions', {
      method: 'POST',
      body: JSON.stringify({ permissions }),
    }),

  // Image Upload & Delete Support
  uploadImage: async (file: File, context = 'questions') => {
    clearApiCache()
    const formData = new FormData()
    formData.append('file', file)
    formData.append('context', context)
    const res = await fetch(`${BASE}/api/images/upload`, {
      method: 'POST',
      headers: { ...(await authHeaders()) },
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error ?? 'Upload failed')
    }
    return res.json() as Promise<{ url: string; path: string; fileName: string; size: number }>
  },

  // Tutor Notes
  getNotes: (tutorId: string, studentId: string) =>
    request<{ notes: Array<{ id: string; text: string; author: string; createdAt: string }> }>(
      `/api/notes?tutorId=${tutorId}&studentId=${studentId}`
    ),
  addNote: (tutorId: string, studentId: string, text: string, author: string) =>
    request<{ note: { id: string; text: string; author: string; createdAt: string } }>('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ tutorId, studentId, text, author }),
    }),
  deleteNote: (tutorId: string, studentId: string, noteId: string) =>
    request<{ success: boolean }>(`/api/notes?tutorId=${tutorId}&studentId=${studentId}&noteId=${noteId}`, {
      method: 'DELETE',
    }),

  // Class Progress / Attendance (per-student session log a tutor keeps)
  getClassProgress: (tutorId: string, studentId: string) =>
    cachedGet<{ entries: ClassProgressEntry[] }>(
      `/api/class-progress?tutorId=${tutorId}&studentId=${studentId}`,
      SHORT_TTL,
    ),
  /** Session logs for many pairs in one request: admins get all pairs (or narrow by tutorId/studentId), tutors/students their own. Keyed "tutorId:studentId". */
  getClassProgressBatch: (params?: { tutorId?: string; studentId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.tutorId) qs.set('tutorId', params.tutorId)
    if (params?.studentId) qs.set('studentId', params.studentId)
    return cachedGet<{ entries: Record<string, ClassProgressEntry[]> }>(
      `/api/class-progress/batch${qs.toString() ? '?' + qs.toString() : ''}`,
      SHORT_TTL,
    )
  },
  addClassProgress: (tutorId: string, studentId: string, body: ClassProgressInput) =>
    request<{ entry: ClassProgressEntry }>('/api/class-progress', {
      method: 'POST',
      body: JSON.stringify({ tutorId, studentId, ...body }),
    }),
  deleteClassProgress: (tutorId: string, studentId: string, entryId: string) =>
    request<{ success: boolean }>(`/api/class-progress?tutorId=${tutorId}&studentId=${studentId}&entryId=${entryId}`, {
      method: 'DELETE',
    }),
  updateClassProgress: (tutorId: string, studentId: string, entryId: string, body: Partial<ClassProgressInput>) =>
    request<{ entry: ClassProgressEntry }>('/api/class-progress', {
      method: 'PATCH',
      body: JSON.stringify({ tutorId, studentId, entryId, ...body }),
    }),

  // Live classes (100ms): one room per class; each caller gets their own join link.
  getLiveClasses: () => request<{ configured: boolean; classes: LiveClass[] }>('/api/live-class'),
  startLiveClass: (studentId: string, tutorId?: string) =>
    request<{ class: LiveClass }>('/api/live-class', { method: 'POST', body: JSON.stringify({ studentId, tutorId }) }),
  endLiveClass: (roomId: string) =>
    request<{ success: boolean }>(`/api/live-class?roomId=${encodeURIComponent(roomId)}`, { method: 'DELETE' }),

  // Upcoming official SAT test dates (read from College Board by the server).
  getSatDates: () => cachedGet<{ dates: string[]; source: string }>('/api/sat-dates', LONG_TTL),

  // PTM reports: admins write; tutors read their students'; students read their own.
  getPtmReports: (studentId?: string) =>
    request<{ students: PtmStudent[] }>(`/api/ptm-reports${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`),
  addPtmReport: (body: { studentId: string; ptmDate: string; targetTestDate?: string; prepStatus: string; remarks?: string }) =>
    request<{ report: PtmReport; reports: PtmReport[] }>('/api/ptm-reports', { method: 'POST', body: JSON.stringify(body) }),

  // Platform-wide settings (e.g. the "Next SAT Date" shown in admin/tutor sidebars,
  // and the full official test-date calendar shown in the super admin console)
  getSettings: () => cachedGet<{ nextSatDate: string | null; satTestDates: string[] }>('/api/settings', LONG_TTL),
  updateSettings: (body: { nextSatDate?: string | null; satTestDates?: string[] }) =>
    request<{ nextSatDate?: string | null; satTestDates?: string[] }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // Per-student "last mock / last homework / last tutoring session" — drives the
  // super admin dashboard's attention list and target-date list.
  getStudentActivity: () =>
    request<{ activity: Array<{ studentId: string; lastMockDate: string | null; lastHwDate: string | null; lastSessionDate: string | null }> }>('/api/analytics/student-activity'),

  // Shared Domain → Subdomain → Skill taxonomy overrides — visible to every admin/
  // super-admin, not just whoever added them (previously stored per-browser).
  getTaxonomy: () => cachedGet<{ subdomainsByDomain: Record<string, string[]>; skillsMap: Record<string, string[]> }>('/api/taxonomy', LONG_TTL),
  updateTaxonomy: (body: { subdomainsByDomain?: Record<string, string[]>; skillsMap?: Record<string, string[]> }) =>
    request<{ subdomainsByDomain?: Record<string, string[]>; skillsMap?: Record<string, string[]> }>('/api/taxonomy', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // ASG Library — admin uploads PDFs and assigns them; students/tutors read assigned ones.
  getLibrary: () => request<{ documents: LibraryDocument[] }>('/api/library'),
  uploadLibraryDocument: async (file: File, meta: { title: string; description?: string }) => {
    const { path, token } = await request<{ path: string; token: string }>('/api/library/upload-url', {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, sizeBytes: file.size }),
    })
    // Straight to the private Storage bucket with the one-time signed URL (no 10MB server limit).
    const { error } = await supabase.storage.from('library').uploadToSignedUrl(path, token, file, {
      contentType: 'application/pdf',
    })
    if (error) throw new Error(error.message || 'Upload failed')
    return request<{ document: LibraryDocument }>('/api/library', {
      method: 'POST',
      body: JSON.stringify({ title: meta.title, description: meta.description ?? null, path, fileName: file.name }),
    })
  },
  updateLibraryDocument: (documentId: string, body: { title?: string; description?: string | null }) =>
    request<{ document: LibraryDocument }>(`/api/library/${documentId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteLibraryDocument: (documentId: string) =>
    request<{ success: boolean }>(`/api/library/${documentId}`, { method: 'DELETE' }),
  setLibraryAssignees: (documentId: string, userIds: string[]) =>
    request<{ assignees: LibraryAssignee[] }>(`/api/library/${documentId}/assignments`, {
      method: 'PUT',
      body: JSON.stringify({ userIds }),
    }),
  /** The PDF bytes for the in-app viewer (access is checked on the server). */
  getLibraryFile: async (documentId: string): Promise<ArrayBuffer> => {
    const res = await fetch(`${BASE}/api/library/${documentId}/file`, { headers: { ...(await authHeaders()) } })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error ?? 'Could not open the document')
    }
    return res.arrayBuffer()
  },

  deleteImage: async (path: string) => {
    clearApiCache()
    const res = await fetch(`${BASE}/api/images/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ path }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error ?? 'Delete failed')
    }
    return res.json() as Promise<{ success: boolean; wasDeleted: boolean }>
  },

  // Free Demo Test — configuration & leads (admin) 
  getFreeTestConfig: () =>
    request<{
      config: FreeTestConfig
      activeTestDetails: Record<string, any>
      availableTests: Array<{
        id: string
        title: string
        category?: string
        subCategory?: string
        description?: string
        sections: Array<{ id: string; name: string; durationMinutes: number; _count?: { questions: number } }>
      }>
    }>('/api/free-tests'),

  updateFreeTestConfig: (body: Partial<FreeTestConfig>) =>
    request<{ success: boolean; config: FreeTestConfig }>('/api/free-tests', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getFreeTestLeads: () =>
    request<{ leads: FreeTestLead[]; summary?: FreeTestLeadSummary }>('/api/free-tests/leads'),

  updateFreeTestLead: (leadId: string, body: { leadStatus?: string; notes?: string }) =>
    request<{ success: boolean; lead: FreeTestLead }>('/api/free-tests/leads', {
      method: 'PATCH',
      body: JSON.stringify({ leadId, ...body }),
    }),

  deleteFreeTestLead: (leadId: string) =>
    request<{ success: boolean; message: string; accountRevoked?: boolean }>(`/api/free-tests/leads?leadId=${encodeURIComponent(leadId)}`, {
      method: 'DELETE',
    }),

  /** (Re)assign the demo test to a lead's portal account. Omit testId to use the configured default. */
  assignDemoTestToLead: (leadId: string, testId?: string) =>
    request<{ success: boolean; assignmentId: string; test: { id: string; title: string } }>('/api/free-tests/leads/assign', {
      method: 'POST',
      body: JSON.stringify({ leadId, ...(testId ? { testId } : {}) }),
    }),
}

export interface FreeTestLeadSummary {
  total: number
  registered: number
  inProgress: number
  completed: number
  enrolled: number
  completionRate: number
  conversionRate: number
  avgPercentage: number | null
}

export interface FreeTestConfig {
  activeTestId: string | null
  examTests: {
    SAT?: string | null
    ACT?: string | null
    AP?: string | null
    GENERAL?: string | null
  }
  bannerTitle: string
  bannerSubtitle: string
  instructions: string
  activeOnWebsite: boolean
}

export interface FreeTestLead {
  id: string
  name: string
  email: string
  phone: string
  exam: string
  grade?: string
  school?: string
  targetScore?: string
  /** Demo test assigned to this lead's portal account ('' if none yet). */
  testId: string
  testTitle: string
  /** Derived live from the account's TestAttempt. */
  status: 'Registered' | 'In-Progress' | 'Completed' | 'Abandoned'
  leadStatus: 'New' | 'Contacted' | 'Follow-Up' | 'Enrolled' | 'Archived'
  registeredAt: string
  startedAt?: string | null
  completedAt?: string | null
  totalScore?: number | null
  maxScore?: number | null
  percentage?: number | null
  notes?: string
  /** Portal account id (Supabase auth id === DB user id). */
  userId?: string | null
  accountCreated?: boolean
  assignmentId?: string | null
  /** Latest attempt — link to /test-review/:attemptId for the full report. */
  attemptId?: string | null
  source?: string
}

