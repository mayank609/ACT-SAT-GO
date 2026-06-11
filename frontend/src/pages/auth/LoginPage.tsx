import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, BookOpen } from 'lucide-react';
import { useAuthStore, dbUserToAuthUser } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/common/Button';

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
        <div className="absolute top-10 left-4 sm:top-20 sm:left-20 w-40 h-40 sm:w-64 sm:h-64 bg-blue-500 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-4 sm:bottom-20 sm:right-20 w-56 h-56 sm:w-96 sm:h-96 bg-purple-500 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Left panel */}
        <div className="hidden lg:flex flex-col bg-gradient-to-br from-blue-600 to-blue-800 p-10 text-white">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <BookOpen size={22} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-xl">ACT·SAT·GO</span>
              <span className="block text-blue-200 text-xs">Test Preparation Platform</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-4 leading-tight">
            Prepare smarter,<br />score higher.
          </h2>
          <p className="text-blue-200 text-base mb-10">
            Advanced analytics, adaptive testing, and personalized insights to maximize your test performance.
          </p>
          <div className="space-y-4 mt-auto">
            {[
              { icon: '📊', title: 'Deep Analytics', desc: 'Question-level time tracking and accuracy breakdown' },
              { icon: '🎯', title: 'Adaptive Practice', desc: 'Tests tailored to your weak areas' },
              { icon: '📈', title: 'Progress Tracking', desc: 'Monitor improvement across every attempt' },
            ].map((f) => (
              <div key={f.title} className="flex gap-3 items-start bg-white/10 rounded-xl p-4">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p className="font-semibold text-sm">{f.title}</p>
                  <p className="text-blue-200 text-xs">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-5 lg:hidden">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <BookOpen size={16} className="text-white" />
              </div>
              <span className="font-bold text-slate-900">ACT·SAT·GO</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-slate-500 mt-1 text-sm">Sign in to continue to your dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Password</label>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-2.5 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <span className="text-red-500 text-xs mt-0.5">⚠</span>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full py-2.5 justify-center text-sm">
              Sign In
            </Button>
          </form>

          <p className="text-[11px] text-slate-400 text-center mt-6">
            Accounts are created by your administrator. Contact them if you can't sign in.
          </p>
        </div>
      </div>
    </div>
  );
}
