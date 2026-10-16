import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useAuthStore, dbUserToAuthUser } from '../../store/useAuthStore';

// Google / Apple sign-in returns here. The session is read from the URL, then
// matched to the portal account with the same email (same Supabase user id).
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    let finished = false;
    const finish = async (userId: string) => {
      if (finished) return;
      finished = true;
      try {
        const { user } = await api.getUser(userId);
        setSession(dbUserToAuthUser(user), user.id);
        navigate('/dashboard', { replace: true });
      } catch {
        // Signed in with Google/Apple, but no portal account uses that email.
        await supabase.auth.signOut();
        navigate('/login?error=no-account', { replace: true });
      }
    };
    if (/error=/.test(window.location.hash + window.location.search)) {
      navigate('/login?error=oauth', { replace: true });
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session.user.id);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) finish(data.session.user.id); });
    const t = setTimeout(() => { if (!finished) navigate('/login?error=oauth', { replace: true }); }, 10000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, [navigate, setSession]);

  return <div className="flex items-center justify-center h-screen text-slate-400"><Loader2 size={24} className="animate-spin" /></div>;
}
