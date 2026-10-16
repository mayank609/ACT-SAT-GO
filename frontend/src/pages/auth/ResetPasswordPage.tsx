import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { NewPasswordForm } from '../../components/auth/NewPasswordForm';

// Landing page for the "Forgot password?" email link. Supabase signs the user
// in from the link (detectSessionInUrl), then they choose a new password.
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [state, setState] = useState<'checking' | 'ready' | 'invalid'>('checking');

  useEffect(() => {
    // An expired or reused link comes back with an error in the URL hash.
    if (/error_code=|error=/.test(window.location.hash)) { setState('invalid'); return; }
    let done = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        done = true; setState('ready');
      }
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) { done = true; setState('ready'); } });
    const t = setTimeout(() => { if (!done) setState('invalid'); }, 6000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  if (state === 'checking') {
    return <div className="flex items-center justify-center h-screen text-slate-400"><Loader2 size={24} className="animate-spin" /></div>;
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-blue-900/10 p-8 space-y-4 text-center">
          <h1 className="text-xl font-bold text-slate-900">This reset link has expired</h1>
          <p className="text-sm text-slate-500">Reset links work once and only for a short time. Ask for a new one from the login page.</p>
          <button onClick={() => navigate('/login', { replace: true })}
            className="w-full py-3 rounded-xl bg-[#2f6dff] hover:bg-blue-700 text-white font-semibold">Back to login</button>
        </div>
      </div>
    );
  }

  return (
    <NewPasswordForm
      title="Set a new password"
      subtitle="Choose a new password for your ACT SAT GO account."
      submitLabel="Save new password"
      onSubmit={async (password) => {
        const { data, error } = await supabase.auth.updateUser({ password });
        if (error) return error.message || 'Could not change the password. Please try again.';
        // A reset also replaces any temporary password from an admin.
        if (data.user) await api.updateUser(data.user.id, { passwordChanged: true }).catch(() => {});
        logout();
        navigate('/login?reset=1', { replace: true });
        return null;
      }}
    />
  );
}
