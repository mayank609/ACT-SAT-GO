import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Target, BarChart3, Trophy } from 'lucide-react';
import { useAuthStore, dbUserToAuthUser } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { StudentHero } from './StudentHero';
import logo from '../../assets/logo.png';

const REMEMBER_KEY = 'actsatgo:remembered_email';

const FEATURES = [
  { icon: Target,     title: 'Personalized Prep', desc: 'Practice that adapts to your strengths and weaknesses.' },
  { icon: BarChart3,  title: 'In-Depth Analytics', desc: 'Track your progress with detailed insights and performance reports.' },
  { icon: Trophy,     title: 'Proven Results',    desc: 'Trusted by thousands of students to achieve their dream scores.' },
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor" aria-hidden>
      <path d="M13.36 9.54c-.02-2.05 1.67-3.03 1.75-3.08-.95-1.4-2.44-1.59-2.97-1.61-1.26-.13-2.46.74-3.1.74-.64 0-1.63-.72-2.68-.7-1.38.02-2.65.8-3.36 2.04-1.43 2.49-.37 6.17 1.03 8.19.68.99 1.5 2.1 2.57 2.06 1.03-.04 1.42-.67 2.67-.67 1.24 0 1.6.67 2.69.65 1.11-.02 1.81-1.01 2.49-2 .78-1.15 1.11-2.26 1.13-2.32-.02-.01-2.17-.83-2.19-3.3M11.3 3.5c.57-.69.95-1.65.85-2.6-.82.03-1.81.54-2.39 1.23-.52.61-.98 1.59-.86 2.52.91.07 1.84-.46 2.4-1.15" />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();
  // The website's Free Demo Test signup links here with ?email=…&demo=1 so the
  // student lands with their email prefilled and a hint about what to do.
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get('email') ?? '';
  const fromDemoSignup = searchParams.get('demo') === '1';

  const [email, setEmail] = useState(() => prefillEmail || (localStorage.getItem(REMEMBER_KEY) ?? ''));
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(() => Boolean(localStorage.getItem(REMEMBER_KEY)));
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() =>
    fromDemoSignup ? 'Your free demo account is ready. Log in with the email and password you just created to start your demo test.' : ''
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      // 1. Authenticate against Supabase Auth.
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError || !data.user) {
        setError('Invalid email or password.');
        setLoading(false);
        return;
      }

      // Persist (or clear) the remembered email for next time.
      if (remember) localStorage.setItem(REMEMBER_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_KEY);

      // 2. Load the mirrored DB profile (role, relations). Its id == auth id.
      try {
        const { user: dbUser } = await api.getUser(data.user.id);
        setSession(dbUserToAuthUser(dbUser), dbUser.id);
        navigate('/dashboard');
      } catch {
        // Authenticated with Supabase but no matching DB profile exists.
        await supabase.auth.signOut();
        setError('Your account is not fully set up. Please contact your administrator.');
        setLoading(false);
      }
    } catch {
      setError('Unable to connect. Please try again.');
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setError('');
    setNotice('');
    setOauthLoading(provider);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (oauthError) {
        setError(`${provider === 'google' ? 'Google' : 'Apple'} sign-in isn't available yet. Please use your email and password.`);
        setOauthLoading(null);
      }
      // On success the browser is redirected to the provider, so no further work here.
    } catch {
      setError('Unable to start social sign-in. Please try again.');
      setOauthLoading(null);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Enter your email address above, then click “Forgot password?”.');
      document.getElementById('login-email')?.focus();
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (resetError) setError('Could not send a reset link. Please contact your administrator.');
    else setNotice('If an account exists for that email, a password reset link is on its way.');
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 flex flex-col items-center justify-center p-3 sm:p-4 gap-3">
      <div className="relative w-full max-w-6xl max-h-[calc(100vh-5rem)] grid grid-cols-1 lg:grid-cols-2 bg-white rounded-3xl shadow-2xl shadow-blue-900/10 overflow-hidden">

        {/* ── Left: marketing panel ─────────────────────────────────────────── */}
        <div className="relative hidden lg:flex flex-col p-8 xl:p-10 bg-gradient-to-br from-sky-50 via-blue-50 to-blue-100/70 overflow-hidden">
          {/* soft decorative blobs */}
          <div className="absolute -top-10 -left-10 w-56 h-56 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-24 -right-8 w-64 h-64 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />


          {/* headline */}
          <div className="relative mt-5">
            <h1 className="text-[2rem] xl:text-[2.4rem] font-extrabold leading-[1.05] tracking-tight">
              <span className="block text-[#15315c]">PREPARE TODAY.</span>
              <span className="block text-[#2f6dff]">PERFORM<br />TOMORROW.</span>
            </h1>
            <p className="mt-3 text-slate-500 text-[14px]">Smarter practice. Stronger concepts.</p>
            <div className="mt-1.5 inline-block relative">
              <span className="font-[Caveat] text-3xl xl:text-4xl font-bold text-[#15315c]">Higher Scores!</span>
              <svg className="absolute -bottom-2 left-0 w-full" height="10" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden>
                <path d="M2 6 C 50 1, 150 1, 198 5" stroke="#facc15" strokeWidth="4" fill="none" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* illustration: student at laptop with floating achievement cards */}
          <div className="relative flex-1 flex items-center justify-center my-2 min-h-0">
            <StudentHero className="w-full max-w-[330px] max-h-full h-auto" />
          </div>

          {/* feature cards */}
          <div className="relative grid grid-cols-3 gap-3 mt-auto">
            {FEATURES.map((f) => (
              <div key={f.title} className="text-center">
                <div className="w-10 h-10 mx-auto rounded-xl bg-white shadow-sm shadow-blue-900/5 flex items-center justify-center mb-2">
                  <f.icon size={18} className="text-[#2f6dff]" />
                </div>
                <p className="text-[12px] font-bold text-[#15315c] leading-tight">{f.title}</p>
                <p className="text-[10.5px] text-slate-500 leading-snug mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: login card ─────────────────────────────────────────────── */}
        <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center overflow-y-auto">
          {/* logo on mobile */}
          <img src={logo} alt="ScoreπGo" className="h-8 w-auto object-contain mb-6 lg:hidden" />

          <div className="mb-5">
            <h2 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 flex items-center gap-2">
              Welcome Back! <span className="text-2xl">👋</span>
            </h2>
            <p className="text-slate-500 mt-1 text-sm">Sign in to continue to your ScoreπGo dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3.5">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold text-slate-700 mb-1">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6dff]/30 focus:border-[#2f6dff] transition-all bg-slate-50/60 focus:bg-white"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-11 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6dff]/30 focus:border-[#2f6dff] transition-all bg-slate-50/60 focus:bg-white"
                  required
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember / Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#2f6dff] focus:ring-[#2f6dff]/30 accent-[#2f6dff]"
                />
                <span className="text-sm text-slate-600">Remember me</span>
              </label>
              <button type="button" onClick={handleForgotPassword} className="text-sm font-semibold text-[#2f6dff] hover:underline">
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <span className="text-red-500 text-xs mt-0.5">⚠</span>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            {notice && (
              <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-emerald-700 text-sm">{notice}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#2f6dff] hover:bg-[#2057df] text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-[#2f6dff]/25 transition-colors disabled:opacity-60"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>Sign In <ArrowRight size={17} /></>
              )}
            </button>
          </form>

          {/* divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">or continue with</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* social buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={oauthLoading !== null}
              className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              <GoogleIcon /> Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('apple')}
              disabled={oauthLoading !== null}
              className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-xl py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              <AppleIcon /> Continue with Apple
            </button>
          </div>

          <p className="text-sm text-slate-500 text-center mt-4">
            New to ScoreπGo?{' '}
            <button
              type="button"
              onClick={() => setNotice('Accounts are created by your administrator. Please contact them to get access.')}
              className="font-semibold text-[#2f6dff] hover:underline"
            >
              Create an account
            </button>
          </p>
        </div>
      </div>

      {/* bottom quote */}
      <p className="font-[Caveat] text-xl sm:text-2xl text-[#15315c]/80 text-center">
        <span className="text-[#facc15]">“</span>Small steps today, big results tomorrow.<span className="text-[#facc15]">”</span>
      </p>
    </div>
  );
}
