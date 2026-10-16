import { useState } from 'react';
import { Eye, EyeOff, Lock, Loader2 } from 'lucide-react';
import logo from '../../assets/logo.png';

// Full-screen card that asks for a new password twice. Used by the
// password-reset link page and by the first-login "change your temporary
// password" screen.
export function NewPasswordForm({ title, subtitle, submitLabel, onSubmit, footer }: {
  title: string;
  subtitle: string;
  submitLabel: string;
  onSubmit: (password: string) => Promise<string | null>;
  footer?: React.ReactNode;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setSaving(true);
    const err = await onSubmit(password);
    setSaving(false);
    if (err) setError(err);
  };

  const input = 'w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-blue-900/10 p-8 space-y-5">
        <img src={logo} alt="ACT SAT GO" className="h-10 w-auto" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>
        {[['New password', password, setPassword], ['Confirm new password', confirm, setConfirm]].map(([label, value, setValue], i) => (
          <label key={i} className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">{label as string}</span>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type={show ? 'text' : 'password'} autoComplete="new-password" required value={value as string}
                onChange={(e) => (setValue as (v: string) => void)(e.target.value)} className={input} />
              {i === 0 && (
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
          </label>
        ))}
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <button type="submit" disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#2f6dff] hover:bg-blue-700 text-white font-semibold disabled:opacity-60">
          {saving && <Loader2 size={16} className="animate-spin" />}{submitLabel}
        </button>
        {footer}
      </form>
    </div>
  );
}
