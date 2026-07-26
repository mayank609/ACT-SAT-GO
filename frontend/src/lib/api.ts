import { getAccessToken, supabase } from './supabase'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Authorization header from the current Supabase session (for non-JSON
// requests like FormData uploads that bypass request()).
async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
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
  return res.json()
}

export interface DbUser {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  tutorId?: string | null
  tutorName?: string | null
  studentIds?: string[]
  studentCount?: number
  testsAttempted?: number
  avgScore?: number | null
  lastActive?: string | null
  grade?: string | null
  targetScore?: number | null
  targetDate?: string | null
  specialization?: string[]
  phone?: string | null
  parentPhone?: string | null
  dob?: string | null
  schoolName?: string | null
  board?: string | null
  timezone?: string | null
  firstClassDate?: string | null
  programVariant?: string | null
  mockVariant?: string | null
  accommodation?: boolean | null
  stage?: number | null
  onboarded?: boolean | null
  diagnosticDecision?: 'keep' | 'leave' | null
  manualDiagTotal?: number | null
  manualDiagRW?: number | null
  manualDiagMath?: number | null
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
  subject?: string
  status?: string
  sessionType?: string
  understanding?: number
  attendance?: string
  engagement?: string
  nextSessionGoal?: string
  nextSessionAt?: string
}

export interface ClassProgressInput {
  topic: string
  homework?: string
  notes?: string
  classDate?: string
  author: string
  startTime?: string
  durationMinutes?: number
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

export const api = {
  // Users
  getUsersByRole: (role?: string) =>
    request<{ users: DbUser[] }>(`/api/users${role ? '?role=' + role : ''}`),
  getUser: (userId: string) => request<{ user: DbUser }>(`/api/users/${userId}`),
  createUser: (body: {
    name: string
    email: string
    role: string
    grade?: string
    targetScore?: number
    targetDate?: string
    tutorId?: string
    specialization?: string[]
    phone?: string
    parentPhone?: string
    dob?: string
    schoolName?: string
    board?: string
    timezone?: string
    firstClassDate?: string
    programVariant?: string
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
    grade?: string
    targetScore?: number
    targetDate?: string
    specialization?: string[]
    tutorId?: string | null
    notifications?: Record<string, boolean>
    phone?: string
    parentPhone?: string
    dob?: string
    schoolName?: string
    board?: string
    timezone?: string
    firstClassDate?: string
    programVariant?: string
    mockVariant?: string
    accommodation?: boolean
    stage?: number
    onboarded?: boolean
    diagnosticDecision?: 'keep' | 'leave' | null
    manualDiagTotal?: number | null
    manualDiagRW?: number | null
    manualDiagMath?: number | null
  }) => request<{ user: DbUser }>(`/api/users/${userId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (userId: string) =>
    request<{ success: boolean }>(`/api/users/${userId}`, { method: 'DELETE' }),

  // Tutor assignments
  getTutorAssignments: (params?: { tutorId?: string; studentId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.tutorId) qs.set('tutorId', params.tutorId)
    if (params?.studentId) qs.set('studentId', params.studentId)
    return request<{ assignments: Array<{ id: string; tutorId: string; studentId: string; tutor: DbUser; student: DbUser }> }>(
      `/api/tutor-assignments${qs.toString() ? '?' + qs.toString() : ''}`
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
  getTest: (testId: string) => request<{ test: unknown }>(`/api/tests/${testId}`),
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
  getAttempt: (attemptId: string) => request<{ attempt: unknown }>(`/api/attempts/${attemptId}`),
  getStudentAttempts: (studentId: string) =>
    request<{ attempts: unknown[] }>(`/api/students/${studentId}/attempts`),
  getAssignedTests: (studentId: string) =>
    request<{ assignedTests: unknown[] }>(`/api/students/${studentId}/assigned-tests`),

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
        testId: string; testTitle: string; sectionName: string
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
    request<{ entries: ClassProgressEntry[] }>(
      `/api/class-progress?tutorId=${tutorId}&studentId=${studentId}`
    ),
  addClassProgress: (tutorId: string, studentId: string, body: ClassProgressInput) =>
    request<{ entry: ClassProgressEntry }>('/api/class-progress', {
      method: 'POST',
      body: JSON.stringify({ tutorId, studentId, ...body }),
    }),
  deleteClassProgress: (tutorId: string, studentId: string, entryId: string) =>
    request<{ success: boolean }>(`/api/class-progress?tutorId=${tutorId}&studentId=${studentId}&entryId=${entryId}`, {
      method: 'DELETE',
    }),

  // Platform-wide settings (e.g. the "Next SAT Date" shown in admin/tutor sidebars)
  getSettings: () => request<{ nextSatDate: string | null }>('/api/settings'),
  updateSettings: (body: { nextSatDate: string | null }) =>
    request<{ nextSatDate: string | null }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteImage: async (path: string) => {
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
}

