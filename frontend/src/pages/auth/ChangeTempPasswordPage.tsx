import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { NewPasswordForm } from '../../components/auth/NewPasswordForm';

// Shown instead of the portal while the account still uses the temporary
// password an admin or coordinator gave out.
export function ChangeTempPasswordPage() {
  const { user, updateUser, logout } = useAuthStore();
  return (
    <NewPasswordForm
      title="Change your password"
      subtitle={`Welcome${user?.name ? `, ${user.name}` : ''}. You signed in with a temporary password. Please choose your own password to continue.`}
      submitLabel="Save and continue"
      onSubmit={async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return error.message || 'Could not change the password. Please try again.';
        if (user) {
          try { await api.updateUser(user.id, { passwordChanged: true }); }
          catch { return 'Your password was saved, but the portal could not confirm it. Please try again.'; }
        }
        updateUser({ mustChangePassword: false });
        return null;
      }}
      footer={
        <button type="button" onClick={() => { logout(); window.location.assign('/login'); }}
          className="w-full text-sm text-slate-500 hover:text-slate-700">Log out</button>
      }
    />
  );
}
