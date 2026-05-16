import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Role } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

// Mock users for demo
export const MOCK_USERS: Record<Role, User> = {
  super_admin: {
    id: 'sa-1',
    name: 'Sarah Johnson',
    email: 'super@testplatform.com',
    role: 'super_admin',
  },
  admin: {
    id: 'admin-1',
    name: 'Michael Chen',
    email: 'admin@testplatform.com',
    role: 'admin',
  },
  tutor: {
    id: 'tutor-1',
    name: 'Dr. Emily Rodriguez',
    email: 'tutor@testplatform.com',
    role: 'tutor',
    assignedStudentIds: ['s-1', 's-2', 's-3', 's-4'],
  },
  student: {
    id: 's-1',
    name: 'Alex Thompson',
    email: 'student@testplatform.com',
    role: 'student',
    assignedTutorId: 'tutor-1',
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    { name: 'auth-storage' }
  )
);
