import { useState, useEffect } from 'react';
import { Users, Shield, Settings, Activity, Plus, Trash2, Server, Database, Zap, Check, X } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { api } from '../../lib/api';
import type { DbUser } from '../../lib/api';
import type { Role } from '../../types';

type TabKey = 'overview' | 'users' | 'permissions' | 'system';

const roleColors: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  tutor: 'bg-emerald-100 text-emerald-700',
  student: 'bg-amber-100 text-amber-700',
};

const PERMISSIONS: { permission: string; super_admin: boolean; admin: boolean; tutor: boolean; student: boolean }[] = [
  { permission: 'Create Tests', super_admin: true, admin: true, tutor: false, student: false },
  { permission: 'Edit Tests', super_admin: true, admin: true, tutor: false, student: false },
  { permission: 'Delete Tests', super_admin: true, admin: false, tutor: false, student: false },
  { permission: 'Assign Tests', super_admin: true, admin: true, tutor: false, student: false },
  { permission: 'View All Students', super_admin: true, admin: true, tutor: false, student: false },
  { permission: 'View Assigned Students', super_admin: true, admin: true, tutor: true, student: false },
  { permission: 'Manage Tutors', super_admin: true, admin: true, tutor: false, student: false },
  { permission: 'View Reports', super_admin: true, admin: true, tutor: true, student: false },
  { permission: 'Export Reports', super_admin: true, admin: true, tutor: false, student: false },
  { permission: 'Take Tests', super_admin: false, admin: false, tutor: false, student: true },
  { permission: 'View Own Results', super_admin: false, admin: false, tutor: false, student: true },
  { permission: 'Manage Users', super_admin: true, admin: false, tutor: false, student: false },
  { permission: 'Platform Settings', super_admin: true, admin: false, tutor: false, student: false },
  { permission: 'System Monitoring', super_admin: true, admin: true, tutor: false, student: false },
];

export function SuperAdminDashboard() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [users, setUsers] = useState<DbUser[]>([]);
  const [tests, setTests] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState<string>('all');
  const [permissions, setPermissions] = useState(PERMISSIONS);
  const [showAddUser, setShowAddUser] = useState(false);
  const [deleteUser, setDeleteUser] = useState<DbUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', role: 'student' as string });

  useEffect(() => {
    Promise.all([
      api.getUsersByRole().then((r) => setUsers(r.users)),
      api.getAllTests().then((r) => setTests(r.tests)),
    ]).finally(() => setLoading(false));
  }, []);

  const roleCounts = { all: users.length, super_admin: 0, admin: 0, tutor: 0, student: 0 } as Record<string, number>;
  users.forEach((u) => { roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1; });

  const filteredUsers = userFilter === 'all' ? users : users.filter((u) => u.role === userFilter);

  const handleAddUser = async () => {
    if (!addForm.name || !addForm.email) return;
    setSaving(true);
    try {
      const res = await api.createUser({ name: addForm.name, email: addForm.email, role: addForm.role });
      setUsers((prev) => [...prev, res.user]);
      setAddForm({ name: '', email: '', role: 'student' });
      setShowAddUser(false);
    } catch {
      // keep modal open on error
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setSaving(true);
    try {
      await api.deleteUser(deleteUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
      setDeleteUser(null);
    } catch {
      // keep modal open on error
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (idx: number, role: string) => {
    if (role === 'super_admin') return;
    setPermissions((prev) => prev.map((p, i) => i === idx ? { ...p, [role]: !p[role as keyof typeof p] } : p));
  };

  const publishedTests = (tests as Array<{ status?: string }>).filter((t) => t.status === 'published');

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Activity size={14} /> },
    { key: 'users', label: 'User Management', icon: <Users size={14} /> },
    { key: 'permissions', label: 'Roles & Permissions', icon: <Shield size={14} /> },
    { key: 'system', label: 'System', icon: <Settings size={14} /> },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Super Admin Console</h1>
          <p className="text-slate-500 text-sm mt-0.5">Full platform control and configuration</p>
        </div>
        <Badge variant="purple" className="self-start sm:self-auto">Super Admin</Badge>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 md:px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap flex-shrink-0 ${
              tab === t.key ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatCard title="Total Users" value={loading ? '…' : users.length} subtitle={`${roleCounts['student'] ?? 0} students`} icon={<Users size={20} />} color="blue" />
            <StatCard title="Published Tests" value={loading ? '…' : publishedTests.length} subtitle={`${tests.length} total`} icon={<Activity size={20} />} color="emerald" />
            <StatCard title="Tutors" value={loading ? '…' : roleCounts['tutor'] ?? 0} subtitle="active tutors" icon={<Shield size={20} />} color="purple" />
            <StatCard title="Admins" value={loading ? '…' : (roleCounts['admin'] ?? 0) + (roleCounts['super_admin'] ?? 0)} subtitle="platform admins" icon={<Zap size={20} />} color="amber" />
          </div>
          <Card>
            <h3 className="font-semibold text-slate-900 mb-4">Users by Role</h3>
            {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
              <div className="space-y-3">
                {(['super_admin', 'admin', 'tutor', 'student'] as const).map((role) => {
                  const count = roleCounts[role] ?? 0;
                  return (
                    <div key={role} className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleColors[role]}`}>{role.replace('_', ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: users.length ? `${(count / users.length) * 100}%` : '0%' }} />
                        </div>
                        <span className="text-sm font-medium text-slate-700 w-6 text-right">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* User Management */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-1 overflow-x-auto">
              {(['all', 'super_admin', 'admin', 'tutor', 'student'] as const).map((r) => (
                <button key={r} onClick={() => setUserFilter(r)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                    userFilter === r ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {r === 'all' ? 'All' : r.replace('_', ' ')} ({roleCounts[r] ?? 0})
                </button>
              ))}
            </div>
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setShowAddUser(true)}>Add User</Button>
          </div>
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Name', 'Email', 'Role', 'Tests Done', 'Avg Score', 'Created', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">Loading users…</td></tr>
                  ) : filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${roleColors[u.role] ?? 'bg-slate-100 text-slate-600'}`}>
                            {u.name.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-900 truncate max-w-32">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-40">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleColors[u.role] ?? 'bg-slate-100 text-slate-600'}`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{u.testsAttempted ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{u.avgScore != null ? u.avgScore : '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        {u.role !== 'super_admin' && (
                          <button onClick={() => setDeleteUser(u)} className="p-1 text-slate-400 hover:text-red-600 rounded"><Trash2 size={13} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Permissions */}
      {tab === 'permissions' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
            <Shield size={16} className="flex-shrink-0 mt-0.5" />
            <p>Changes to permissions take effect immediately. Super Admin permissions cannot be modified.</p>
          </div>
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Permission</th>
                    {(['super_admin', 'admin', 'tutor', 'student'] as const).map((r) => (
                      <th key={r} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full ${roleColors[r]}`}>{r.replace('_', ' ')}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {permissions.map((p, i) => (
                    <tr key={p.permission} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{p.permission}</td>
                      {(['super_admin', 'admin', 'tutor', 'student'] as const).map((role) => (
                        <td key={role} className="px-4 py-3 text-center">
                          <button onClick={() => togglePermission(i, role)} disabled={role === 'super_admin'}
                            className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto transition-colors ${
                              p[role]
                                ? role === 'super_admin' ? 'bg-purple-500 text-white cursor-default' : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : role === 'super_admin' ? 'bg-slate-100 cursor-default' : 'bg-slate-100 hover:bg-red-100 text-slate-400'
                            }`}>
                            {p[role] ? <Check size={11} /> : <X size={11} />}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* System */}
      {tab === 'system' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {[
              { label: 'API Server', uptime: '99.9%', icon: <Server size={16} /> },
              { label: 'Database', uptime: '99.99%', icon: <Database size={16} /> },
              { label: 'Test Delivery', uptime: '99.8%', icon: <Zap size={16} /> },
            ].map((s) => (
              <Card key={s.label} padding="sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">{s.icon}</div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{s.label}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-xs text-emerald-600">Operational · {s.uptime}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card>
            <h3 className="font-semibold text-slate-900 mb-4">Platform Configuration</h3>
            <div className="space-y-4">
              {[
                { label: 'Default Test Duration Warning', desc: 'Minutes before timer end to show warning', value: '5' },
                { label: 'Max Tab Switches Allowed', desc: 'Attempts flagged above this count', value: '3' },
                { label: 'Autosave Interval (seconds)', desc: 'Frequency of automatic answer saves', value: '30' },
                { label: 'Session Timeout (minutes)', desc: 'Inactivity before auto-logout', value: '60' },
              ].map((cfg) => (
                <div key={cfg.label} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{cfg.label}</p>
                    <p className="text-xs text-slate-500">{cfg.desc}</p>
                  </div>
                  <input type="number" defaultValue={cfg.value}
                    className="w-full sm:w-24 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-right" />
                </div>
              ))}
              <div className="flex justify-end">
                <Button size="sm">Save Configuration</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Add User Modal */}
      <Modal isOpen={showAddUser} onClose={() => setShowAddUser(false)} title="Add New User"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAddUser(false)}>Cancel</Button>
            <Button size="sm" icon={<Plus size={13} />} onClick={handleAddUser} disabled={saving}>
              {saving ? 'Creating…' : 'Create User'}
            </Button>
          </div>
        }>
        <div className="space-y-3">
          {[
            { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Full name' },
            { label: 'Email Address', key: 'email', type: 'email', placeholder: 'user@example.com' },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
              <input type={f.type} value={addForm[f.key as 'name' | 'email']}
                onChange={(e) => setAddForm((p) => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={f.placeholder} />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select value={addForm.role} onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="student">Student</option>
              <option value="tutor">Tutor</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteUser} onClose={() => setDeleteUser(null)} title="Remove User" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleDeleteUser} disabled={saving}>Remove</Button>
          </div>
        }>
        <p className="text-sm text-slate-600">Remove <strong>{deleteUser?.name}</strong> from the platform view? Their data in the database will remain.</p>
      </Modal>
    </div>
  );
}
