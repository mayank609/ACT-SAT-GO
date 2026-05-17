import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, BookOpen, ShieldCheck } from 'lucide-react';
import { useAuthStore, MOCK_USERS } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import { Button } from '../../components/common/Button';
import type { Role } from '../../types';

const ROLE_TO_DB: Record<Role, string> = {
  super_admin: 'SUPER_ADMIN',
  admin: 'ADMIN',
  tutor: 'TUTOR',
  student: 'STUDENT',
};

// Seeded emails — used to resolve DB IDs for demo logins
const ROLE_SEEDED_EMAIL: Partial<Record<Role, string>> = {
  admin: 'admin@actsat.com',
  tutor: 'emily.rodriguez@actsat.com',
  student: 'alex.thompson@student.com',
};

const DEMO_CREDENTIALS: { role: Role; email: string; label: string; color: string }[] = [
  { role: 'admin', email: 'admin@testplatform.com', label: 'Admin', color: 'bg-blue-600' },
  { role: 'tutor', email: 'tutor@testplatform.com', label: 'Tutor', color: 'bg-emerald-600' },
  { role: 'student', email: 'student@testplatform.com', label: 'Student (Alex)', color: 'bg-amber-600' },
  { role: 'student', email: 'student2@testplatform.com', label: 'Student (Morgan)', color: 'bg-orange-500' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { login, setDbId } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    const user = Object.values(MOCK_USERS).find((u) => u.email === email);
    if (!user || password !== 'demo123') {
      setError('Invalid credentials. Use demo123 as password.');
      setLoading(false);
      return;
    }
    login(user, 'mock-jwt-token');
    resolveDbId(user.role);
    navigate('/dashboard');
  };

  const resolveDbId = async (role: Role, preferEmail?: string) => {
    try {
      const dbRole = ROLE_TO_DB[role];
      const { users } = await api.getUsersByRole(dbRole);
      if (users.length === 0) return;
      // Prefer the seeded email match for consistent demo experience
      const seedEmail = preferEmail ?? ROLE_SEEDED_EMAIL[role];
      const match = seedEmail ? users.find((u) => u.email === seedEmail) : null;
      setDbId((match ?? users[0]).id);
    } catch {
      // non-fatal
    }
  };

  const handleDemoLogin = (role: Role, preferEmail?: string) => {
    login(MOCK_USERS[role], 'mock-jwt-token');
    resolveDbId(role, preferEmail);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background blobs — pointer-events-none so they never overflow layout */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
        <div className="absolute top-10 left-4 sm:top-20 sm:left-20 w-40 h-40 sm:w-64 sm:h-64 bg-blue-500 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-4 sm:bottom-20 sm:right-20 w-56 h-56 sm:w-96 sm:h-96 bg-purple-500 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Left panel — desktop only */}
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
            {/* Mobile logo */}
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
                <button type="button" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Forgot?</button>
              </div>
              <div className="relative">
                <input
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

          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1 whitespace-nowrap">
                <ShieldCheck size={12} /> Quick demo access
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_CREDENTIALS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => handleDemoLogin(d.role, d.email === 'student2@testplatform.com' ? 'morgan.davis@student.com' : undefined)}
                  className={`${d.color} text-white text-xs font-medium py-2 px-3 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2`}
                >
                  <span className="w-2 h-2 bg-white/50 rounded-full flex-shrink-0" />
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              Password for email login: <code className="bg-slate-100 px-1.5 py-0.5 rounded">demo123</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
