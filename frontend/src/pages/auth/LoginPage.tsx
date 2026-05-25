import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, BookOpen, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import { Button } from '../../components/common/Button';
import type { DbUser } from '../../lib/api';
import type { Role, User } from '../../types';


function dbUserToAuthUser(u: DbUser): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as Role,
    assignedTutorId: u.tutorId ?? undefined,
    assignedStudentIds: u.studentIds ?? [],
  };
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, setDbId } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Demo quick-access users loaded from the real DB
  const [demoUsers, setDemoUsers] = useState<DbUser[]>([]);

  useEffect(() => {
    // Load a handful of real users for quick-demo buttons (super_admin, admin, tutors, students)
    Promise.all([
      api.getUsersByRole('SUPER_ADMIN'),
      api.getUsersByRole('ADMIN'),
      api.getUsersByRole('TUTOR'),
      api.getUsersByRole('STUDENT'),
    ]).then(([superAdmins, admins, tutors, students]) => {
      const picks: DbUser[] = [
        ...(superAdmins.users ?? []).slice(0, 1),
        ...(admins.users ?? []).slice(0, 1),
        ...(tutors.users ?? []).slice(0, 1),
        ...(students.users ?? []).slice(0, 1),
      ];
      setDemoUsers(picks);
    }).catch(() => {
      // silently ignore — demo buttons just won't show
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Look up user by email from the real DB
      const { users: allUsers } = await api.getUsersByRole();
      const found = allUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

      if (!found) {
        setError('No account found with that email address.');
        setLoading(false);
        return;
      }

      // Demo platform: any non-empty password is accepted (no real auth backend yet)
      if (!password.trim()) {
        setError('Please enter a password.');
        setLoading(false);
        return;
      }

      login(dbUserToAuthUser(found), 'session-token');
      setDbId(found.id);
      navigate('/dashboard');
    } catch {
      setError('Unable to connect. Please try again.');
      setLoading(false);
    }
  };

  const handleDemoLogin = (u: DbUser) => {
    login(dbUserToAuthUser(u), 'session-token');
    setDbId(u.id);
    navigate('/dashboard');
  };

  const roleColor = (role: string) => {
    if (role === 'super_admin') return 'bg-purple-600 hover:bg-purple-700';
    if (role === 'admin') return 'bg-blue-600 hover:bg-blue-700';
    if (role === 'tutor') return 'bg-emerald-600 hover:bg-emerald-700';
    return 'bg-amber-600 hover:bg-amber-700';
  };

  const roleLabel = (u: DbUser) => {
    const base = u.role
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    return `${base}: ${u.name}`;
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

          {/* Quick demo access */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1 whitespace-nowrap">
                <ShieldCheck size={12} /> Quick demo access
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {demoUsers.length === 0 ? (
              <div className="flex justify-center py-3">
                <Loader2 size={16} className="animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {demoUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleDemoLogin(u)}
                    className={`${roleColor(u.role)} text-white text-xs font-medium py-2 px-3 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 truncate`}
                  >
                    <span className="w-2 h-2 bg-white/50 rounded-full flex-shrink-0" />
                    <span className="truncate">{roleLabel(u)}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-2 text-center">
              Use any password with your email to sign in
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
