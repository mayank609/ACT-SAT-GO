import { create } from 'zustand'
import { api } from '../lib/api'

interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

interface NotificationState {
  notifications: Notification[]
  loading: boolean
  userId: string | null
  setUserId: (id: string | null) => void
  fetchNotifications: () => Promise<void>
  markRead: (id: string) => Promise<void>
  dismissLocal: (id: string) => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  loading: false,
  userId: null,

  setUserId: (id) => set({ userId: id }),

  fetchNotifications: async () => {
    const { userId } = get()
    if (!userId) return
    set({ loading: true })
    try {
      const data = await api.getNotifications(userId)
      set({ notifications: data.notifications, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  markRead: async (id) => {
    await api.markNotificationRead(id)
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }))
  },

  dismissLocal: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
}))
