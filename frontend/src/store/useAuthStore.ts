import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Role } from '../types';
import { supabase } from '../lib/supabase';
import { api, type DbUser } from '../lib/api';

// Maps a database user row to the in-app User shape.
export function dbUserToAuthUser(u: DbUser): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as Role,
    assignedTutorId: u.tutorId ?? undefined,
    assignedStudentIds: u.studentIds ?? [],
    targetDate: u.targetDate ?? null,
  };
}

interface AuthState {
  user: User | null;
  dbId: string | null;
  isAuthenticated: boolean;
  // True until the initial Supabase session check completes on app load.
  bootstrapping: boolean;
  setSession: (user: User, dbId: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  setDbId: (id: string | null) => void;
  initAuth: () => Promise<void>;
}

// Guard so the onAuthStateChange listener is only ever attached once.
let authListenerAttached = false;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      dbId: null,
      isAuthenticated: false,
      bootstrapping: true,

      setSession: (user, dbId) => set({ user, dbId, isAuthenticated: true }),

      logout: () => {
        // Clear local state immediately; revoke the Supabase session in the
        // background (callers navigate away synchronously).
        set({ user: null, dbId: null, isAuthenticated: false });
        supabase.auth.signOut().catch(() => {});
      },

      updateUser: (updates) =>
        set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),

      setDbId: (id) => set({ dbId: id }),

      // Reconcile persisted state with the real Supabase session. Source of
      // truth is the session: if there's no valid session, the user is logged
      // out regardless of what was persisted in localStorage.
      initAuth: async () => {
        // Attach the session listener once (handles refresh + sign-out across tabs).
        if (!authListenerAttached) {
          authListenerAttached = true;
          supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
              set({ user: null, dbId: null, isAuthenticated: false });
            }
            // Keep isAuthenticated in sync when the token is silently refreshed
            if (event === 'TOKEN_REFRESHED' && session) {
              set({ isAuthenticated: true });
            }
          });
        }

        try {
          const { data } = await supabase.auth.getSession();
          const session = data.session;
          if (!session) {
            set({ user: null, dbId: null, isAuthenticated: false, bootstrapping: false });
            return;
          }

          // The DB user id equals the Supabase auth user id (set at creation).
          const existing = get().user;
          if (existing && existing.id === session.user.id) {
            set({ isAuthenticated: true, bootstrapping: false });
            // Refresh role/relations in the background without blocking paint.
            api.getUser(session.user.id)
              .then(({ user }) => set({ user: dbUserToAuthUser(user), dbId: user.id }))
              .catch(() => {});
            return;
          }

          const { user: dbUser } = await api.getUser(session.user.id);
          set({
            user: dbUserToAuthUser(dbUser),
            dbId: dbUser.id,
            isAuthenticated: true,
            bootstrapping: false,
          });
        } catch {
          // Session exists but we couldn't resolve the DB profile — treat as
          // logged out to avoid a half-authenticated state.
          set({ user: null, dbId: null, isAuthenticated: false, bootstrapping: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      // Don't persist bootstrapping; it must start true on every load.
      partialize: (state) => ({
        user: state.user,
        dbId: state.dbId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
