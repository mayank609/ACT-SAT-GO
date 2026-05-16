import { useState } from 'react';
import { User, Bell, Globe, Lock, ChevronRight, Check } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { useAuthStore } from '../../store/useAuthStore';

type TabKey = 'profile' | 'notifications' | 'platform' | 'security';

export function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const [tab, setTab] = useState<TabKey>('profile');
  const [saved, setSaved] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [notifPrefs, setNotifPrefs] = useState({
    testCompleted: true,
    newAssignment: true,
    studentAlert: true,
    weeklyReport: false,
    systemAlerts: true,
    emailDigest: false,
  });
  const [platformSettings, setPlatformSettings] = useState({
    scoringScale: 'ACT',
    defaultTestDuration: '60',
    tabSwitchLimit: '3',
    autosaveInterval: '30',
    allowResumeTests: true,
    showResultsImmediately: true,
    requireAgreement: true,
    enforceFullscreen: false,
  });

  const isSuperAdmin = user?.role === 'super_admin';

  const handleSave = () => {
    updateUser({ name: profileForm.name, email: profileForm.email });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; superAdminOnly?: boolean }[] = [
    { key: 'profile', label: 'Profile', icon: <User size={15} /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
    { key: 'platform', label: 'Platform', icon: <Globe size={15} />, superAdminOnly: true },
    { key: 'security', label: 'Security', icon: <Lock size={15} /> },
  ];

  const visibleTabs = tabs.filter((t) => !t.superAdminOnly || isSuperAdmin);

  return (
    <div className="space-y-4 md:space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your account and platform preferences</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Sidebar nav */}
        <div className="md:w-48 flex-shrink-0">
          <Card padding="sm">
            <nav className="space-y-0.5">
              {visibleTabs.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.key ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}>
                  <span className="flex items-center gap-2">{t.icon} {t.label}</span>
                  <ChevronRight size={14} className={tab === t.key ? 'text-blue-400' : 'text-slate-300'} />
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Profile */}
          {tab === 'profile' && (
            <Card>
              <h2 className="font-semibold text-slate-900 mb-5">Profile Information</h2>
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-bold flex-shrink-0">
                  {user?.name?.charAt(0) ?? 'U'}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{user?.name}</p>
                  <p className="text-sm text-slate-500">{user?.email}</p>
                  <Button variant="ghost" size="sm" className="mt-1 px-0 text-blue-600 hover:text-blue-700">Change photo</Button>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <input value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <input type="email" value={profileForm.email} onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <input disabled value={user?.role?.replace('_', ' ')}
                    className="w-full sm:w-48 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500 capitalize" />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSave} icon={saved ? <Check size={13} /> : undefined} variant={saved ? 'success' : 'primary'}>
                    {saved ? 'Saved!' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Notifications */}
          {tab === 'notifications' && (
            <Card>
              <h2 className="font-semibold text-slate-900 mb-5">Notification Preferences</h2>
              <div className="space-y-1">
                {[
                  { key: 'testCompleted' as const, label: 'Test Completed', desc: 'When a student submits a test' },
                  { key: 'newAssignment' as const, label: 'New Assignment', desc: 'When a test is assigned to you or your students' },
                  { key: 'studentAlert' as const, label: 'Student Alerts', desc: 'Low performance or inactivity warnings' },
                  { key: 'weeklyReport' as const, label: 'Weekly Report', desc: 'Weekly performance summary email' },
                  { key: 'systemAlerts' as const, label: 'System Alerts', desc: 'Platform maintenance and updates' },
                  { key: 'emailDigest' as const, label: 'Email Digest', desc: 'Daily summary of platform activity' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-3.5 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifPrefs((p) => ({ ...p, [item.key]: !p[item.key] }))}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifPrefs[item.key] ? 'bg-blue-600' : 'bg-slate-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${notifPrefs[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <Button size="sm" onClick={handleSave} variant={saved ? 'success' : 'primary'}>
                  {saved ? 'Saved!' : 'Save Preferences'}
                </Button>
              </div>
            </Card>
          )}

          {/* Platform settings (super admin only) */}
          {tab === 'platform' && isSuperAdmin && (
            <div className="space-y-4">
              <Card>
                <h2 className="font-semibold text-slate-900 mb-5">Test Delivery Settings</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Default Scoring Scale</label>
                      <select value={platformSettings.scoringScale} onChange={(e) => setPlatformSettings((p) => ({ ...p, scoringScale: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="ACT">ACT (1–36)</option>
                        <option value="SAT">SAT (400–1600)</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Default Section Duration (min)</label>
                      <input type="number" value={platformSettings.defaultTestDuration}
                        onChange={(e) => setPlatformSettings((p) => ({ ...p, defaultTestDuration: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tab Switch Alert Threshold</label>
                      <input type="number" value={platformSettings.tabSwitchLimit}
                        onChange={(e) => setPlatformSettings((p) => ({ ...p, tabSwitchLimit: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Autosave Interval (sec)</label>
                      <input type="number" value={platformSettings.autosaveInterval}
                        onChange={(e) => setPlatformSettings((p) => ({ ...p, autosaveInterval: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    {[
                      { key: 'allowResumeTests' as const, label: 'Allow Test Resume', desc: 'Students can resume interrupted tests' },
                      { key: 'showResultsImmediately' as const, label: 'Show Results Immediately', desc: 'Default: show results after submission' },
                      { key: 'requireAgreement' as const, label: 'Require Academic Agreement', desc: 'Students must agree before starting each test' },
                      { key: 'enforceFullscreen' as const, label: 'Enforce Fullscreen Mode', desc: 'Require fullscreen during test; warn if exited' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.label}</p>
                          <p className="text-xs text-slate-500">{item.desc}</p>
                        </div>
                        <button onClick={() => setPlatformSettings((p) => ({ ...p, [item.key]: !p[item.key] }))}
                          className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${platformSettings[item.key] ? 'bg-blue-600' : 'bg-slate-200'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${platformSettings[item.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleSave} variant={saved ? 'success' : 'primary'}>
                      {saved ? 'Saved!' : 'Save Settings'}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Security */}
          {tab === 'security' && (
            <Card>
              <h2 className="font-semibold text-slate-900 mb-5">Security</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                  <input type="password" value={profileForm.currentPassword}
                    onChange={(e) => setProfileForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter current password" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                  <input type="password" value={profileForm.newPassword}
                    onChange={(e) => setProfileForm((f) => ({ ...f, newPassword: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min. 8 characters" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                  <input type="password" value={profileForm.confirmPassword}
                    onChange={(e) => setProfileForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Repeat new password" />
                </div>
                {profileForm.newPassword && profileForm.confirmPassword && profileForm.newPassword !== profileForm.confirmPassword && (
                  <p className="text-xs text-red-600">Passwords do not match</p>
                )}
                <div className="flex justify-end">
                  <Button size="sm" disabled={!profileForm.currentPassword || !profileForm.newPassword || profileForm.newPassword !== profileForm.confirmPassword}
                    onClick={handleSave} variant={saved ? 'success' : 'primary'}>
                    {saved ? 'Password Updated!' : 'Update Password'}
                  </Button>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Active Sessions</h3>
                  {[
                    { device: 'Chrome on macOS', location: 'Current session', time: 'Active now', current: true },
                    { device: 'Safari on iPhone', location: 'Mobile', time: '2 days ago', current: false },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{s.device}</p>
                        <p className="text-xs text-slate-500">{s.location} · {s.time}</p>
                      </div>
                      {!s.current && (
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 text-xs">Revoke</Button>
                      )}
                      {s.current && <Badge variant="success" size="sm">This device</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
