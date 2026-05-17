const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Request failed')
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
  specialization?: string[]
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
    tutorId?: string
    specialization?: string[]
  }) => request<{ user: DbUser }>('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (userId: string, body: {
    name?: string
    grade?: string
    targetScore?: number
    specialization?: string[]
    tutorId?: string | null
    notifications?: Record<string, boolean>
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

  // Tests (admin)
  getAllTests: () => request<{ tests: unknown[] }>('/api/tests?all=true'),
  getPublishedTests: () => request<{ tests: unknown[] }>('/api/tests'),
  getAvailableTests: (studentId: string) =>
    request<{ tests: unknown[] }>(`/api/tests/available?studentId=${studentId}`),
  getTest: (testId: string) => request<{ test: unknown }>(`/api/tests/${testId}`),
  createTest: (body: Record<string, unknown>) =>
    request<{ test: { id: string } }>('/api/tests', { method: 'POST', body: JSON.stringify(body) }),
  updateTest: (testId: string, body: Record<string, unknown>) =>
    request<{ test: unknown }>(`/api/tests/${testId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTest: (testId: string) =>
    request<{ success: boolean }>(`/api/tests/${testId}`, { method: 'DELETE' }),

  // Attempts
  startAttempt: (testId: string, studentId: string) =>
    request<{ attemptId: string }>('/api/attempts', {
      method: 'POST',
      body: JSON.stringify({ testId, studentId }),
    }),
  getAttempt: (attemptId: string) => request<{ attempt: unknown }>(`/api/attempts/${attemptId}`),
  getStudentAttempts: (studentId: string) =>
    request<{ attempts: unknown[] }>(`/api/students/${studentId}/attempts`),

  // Test engine
  startSection: (attemptId: string, sectionId: string) =>
    request<{ sectionAttempt: unknown; endTime: number }>(
      `/api/attempts/${attemptId}/sections/${sectionId}/start`,
      { method: 'POST' }
    ),
  autosaveAnswer: (
    attemptId: string,
    body: { questionId: string; answerGiven: unknown; timeSpentSeconds: number; isFlagged?: boolean }
  ) =>
    request<{ success: boolean }>(`/api/attempts/${attemptId}/autosave`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
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
  getStudentAnalytics: (studentId: string) =>
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
      overallAccuracy: number
      totalAttempts: number
      latestScore: number
      avgScore: number
    }>(`/api/analytics/student/${studentId}`),

  // Questions (Question Bank)
  getQuestions: (params?: { type?: string; difficulty?: string; search?: string }) => {
    const qs = new URLSearchParams()
    if (params?.type) qs.set('type', params.type)
    if (params?.difficulty) qs.set('difficulty', params.difficulty)
    if (params?.search) qs.set('search', params.search)
    return request<{
      questions: Array<{
        id: string; type: string; content: { text: string; explanation?: string }
        options: Record<string, string> | null; correctAnswer: Record<string, unknown>
        difficultyLevel: string; topic: { id: string; name: string } | null
        createdAt: string; usedInTests: Array<{ testId: string; testTitle: string }>
      }>
    }>(`/api/questions${qs.toString() ? '?' + qs.toString() : ''}`)
  },
  deleteQuestion: (id: string) =>
    request<{ success: boolean }>(`/api/questions?id=${id}`, { method: 'DELETE' }),

  // Platform analytics (admin dashboard charts)
  getPlatformAnalytics: () =>
    request<{
      activityData: Array<{ date: string; attempts: number; completions: number }>
      scoreDistribution: Array<{ range: string; count: number }>
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
}
