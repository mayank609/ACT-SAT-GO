import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Surface a clear console error in dev rather than a cryptic runtime failure.
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Authentication will not work until these are set in the frontend .env.'
  );
}

// Single browser client. persistSession keeps the user logged in across reloads
// (token is stored in localStorage and auto-refreshed before expiry).
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Returns a valid access token (JWT) for Authorization headers, or null.
// getSession() returns the cached session without verifying freshness — if the
// access_token has expired or is about to, we force a refresh so the backend
// proxy never receives a stale JWT.
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const nowSecs = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at ?? 0;

  // Refresh when within 60 seconds of expiry or already expired
  if (expiresAt < nowSecs + 60) {
    const { data } = await supabase.auth.refreshSession();
    return data.session?.access_token ?? null;
  }

  return session.access_token;
}
