import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminLogin, isAuthed } from '../admin/api';

export function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Already signed in → skip straight to the dashboard.
  useEffect(() => {
    if (isAuthed()) navigate('/admin/leads', { replace: true });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      await adminLogin(username.trim(), password);
      navigate('/admin/leads', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-root">
      <div className="admin-login-wrap">
        <div className="admin-login-card">
          <div className="admin-logo">Score<span>π</span>Go</div>
          <h1>Admin Login</h1>
          <p className="admin-sub">Sign in to view consultation leads and enquiries.</p>

          <form onSubmit={handleSubmit}>
            {error && <div className="admin-error">{error}</div>}

            <div className="admin-field">
              <label htmlFor="admin-username">Username</label>
              <input
                id="admin-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </div>

            <div className="admin-field">
              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button className="admin-btn" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="admin-hint">
            Demo accounts: <strong>admin / admin123</strong>, <strong>priya / priya123</strong>,{' '}
            <strong>demo / demo123</strong>
          </p>

          <div style={{ textAlign: 'center' }}>
            <Link className="admin-back" to="/">← Back to website</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
