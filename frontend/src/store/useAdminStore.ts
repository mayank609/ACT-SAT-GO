import { create } from 'zustand'
import { api } from '../lib/api'

export interface ApiTest {
  id: string
  title: string
  description?: string
  status: string // 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' (DB uppercase)
  createdAt: string
  sections: Array<{
    id: string
    name: string
    durationMinutes: number
    orderIndex: number
    _count?: { questions: number }
  }>
  _count?: { attempts: number }
}

interface AdminState {
  tests: ApiTest[]
  loading: boolean
  error: string | null
  fetchTests: () => Promise<void>
  deleteTest: (id: string) => Promise<void>
  updateTestStatus: (testId: string, status: string) => Promise<void>
  notifyStudents: (studentDbIds: string[], testTitle: string) => Promise<void>
}

export const useAdminStore = create<AdminState>((set) => ({
  tests: [],
  loading: false,
  error: null,

  fetchTests: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api.getAllTests()
      set({ tests: data.tests as ApiTest[], loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  deleteTest: async (id) => {
    await api.deleteTest(id)
    set((s) => ({ tests: s.tests.filter((t) => t.id !== id) }))
  },

  updateTestStatus: async (testId, status) => {
    // status from frontend is lowercase: 'draft'|'published'|'archived'
    await api.updateTest(testId, { status })
    const data = await api.getAllTests()
    set({ tests: data.tests as ApiTest[] })
  },

  notifyStudents: async (studentDbIds, testTitle) => {
    await Promise.all(
      studentDbIds.map((userId) =>
        api.createNotification({
          userId,
          type: 'assignment',
          title: 'New Test Assigned',
          body: `"${testTitle}" has been assigned to you. Start when ready.`,
        })
      )
    )
  },
}))
