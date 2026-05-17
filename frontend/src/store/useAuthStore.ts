import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Role } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  dbId: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setDbId: (id: string | null) => void;
}

// Mock users for demo — names match seeded DB users for display consistency
export const MOCK_USERS: Record<Role, User> = {
  super_admin: {
    id: 'sa-1',
    name: 'Admin User',
    email: 'admin@actsat.com',
    role: 'super_admin',
  },
  admin: {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@actsat.com',
    role: 'admin',
  },
  tutor: {
    id: 'tutor-1',
    name: 'Emily Rodriguez',
    email: 'emily.rodriguez@actsat.com',
    role: 'tutor',
    assignedStudentIds: [],
  },
  student: {
    id: 's-1',
    name: 'Alex Thompson',
    email: 'alex.thompson@student.com',
    role: 'student',
    assignedTutorId: 'tutor-1',
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      dbId: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, dbId: null, isAuthenticated: false }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      setDbId: (id) => set({ dbId: id }),
    }),
    { name: 'auth-storage' }
  )
);
