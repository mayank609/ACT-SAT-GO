import { useState } from 'react';
import { Users, Shield, Settings, Activity, Plus, Trash2, Edit, Check, X, Server, Database, Zap } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card, StatCard } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { MOCK_STUDENTS, MOCK_TUTORS, MOCK_TESTS, MOCK_ATTEMPTS } from '../../data/mockData';
import type { Role } from '../../types';

type TabKey = 'overview' | 'users' | 'permissions' | 'system';

interface MockUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'inactive';
  lastLogin: string;
  createdAt: string;
}

const ALL_USERS: MockUser[] = [
  { id: 'sa-1', name: 'Sarah Johnson', email: 'super@testplatform.com', role: 'super_admin', status: 'active', lastLogin: '2 min ago', createdAt: '2024-01-01' },
  { id: 'admin-1', name: 'Michael Chen', email: 'admin@testplatform.com', role: 'admin', status: 'active', lastLogin: '1 hr ago', createdAt: '2024-01-05' },
  ...MOCK_TUTORS.map((t, i) => ({
    id: t.id, name: t.name, email: t.email, role: 'tutor' as Role,
    status: 'active' as const, lastLogin: `${i + 1}d ago`, createdAt: '2024-01-10',
  })),
  ...MOCK_STUDENTS.map((s, i) => ({
    id: s.id, name: s.name, email: s.email, role: 'student' as Role,
    status: (i % 5 === 4 ? 'inactive' : 'active') as 'active' | 'inactive',
    lastLogin: `${i + 1}d ago`, createdAt: '2024-02-01',
  })),
];

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

const roleColors: Record<Role, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  tutor: 'bg-emerald-100 text-emerald-700',
  student: 'bg-amber-100 text-amber-700',
};

const ACTIVITY_LOG = [
  { time: '2 min ago', actor: 'Michael Chen', action: 'created test', target: 'ACT Practice #5', type: 'create' },
  { time: '15 min ago', actor: 'Dr. Emily Rodriguez', action: 'viewed student', target: 'Alex Thompson', type: 'view' },
  { time: '32 min ago', actor: 'Alex Thompson', action: 'completed test', target: 'ACT Full #1 (score: 28)', type: 'test' },
  { time: '1 hr ago', actor: 'Michael Chen', action: 'assigned test', target: '3 students', type: 'assign' },
  { time: '2 hr ago', actor: 'Sarah Johnson', action: 'added tutor', target: 'Priya Patel', type: 'create' },
  { time: '3 hr ago', actor: 'System', action: 'auto-submitted test', target: 'Jamie Rivera (time expired)', type: 'system' },
];

export function SuperAdminDashboard() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [users, setUsers] = useState(ALL_USERS);
  const [userFilter, setUserFilter] = useState<Role | 'all'>('all');
  const [permissions, setPermissions] = useState(PERMISSIONS);
  const [showAddUser, setShowAddUser] = useState(false);
  const [deleteUser, setDeleteUser] = useState<MockUser | null>(null);
  const [addForm, setAddForm] = useState({ name: '', email: '', role: 'student' as Role, password: '' });

  const filteredUsers = userFilter === 'all' ? users : users.filter((u) => u.role === userFilter);

  const roleCounts = { all: users.length, super_admin: 0, admin: 0, tutor: 0, student: 0 };
  users.forEach((u) => { roleCounts[u.role]++; });

  const handleAddUser = () => {
    if (!addForm.name || !addForm.email) return;
    setUsers((prev) => [...prev, {
      id: `u-${Date.now()}`, name: addForm.name, email: addForm.email,
      role: addForm.role, status: 'active', lastLogin: 'Never', createdAt: new Date().toISOString().slice(0, 10),
    }]);
    setAddForm({ name: '', email: '', role: 'student', password: '' });
    setShowAddUser(false);
  };

  const togglePermission = (idx: number, role: keyof typeof permissions[0]) => {
    if (role === 'permission' || role === 'super_admin') return;
    setPermissions((prev) => prev.map((p, i) => i === idx ? { ...p, [role]: !p[role as keyof typeof p] } : p));
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Activity size={14} /> },
    { key: 'users', label: 'User Management', icon: <Users size={14} /> },
    { key: 'permissions', label: 'Roles & Permissions', icon: <Shield size={14} /> },
    { key: 'system', label: 'System', icon: <Settings size={14} /> },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Super Admin Console</h1>
          <p className="text-slate-500 text-sm mt-0.5">Full platform control and configuration</p>
        </div>
        <Badge variant="purple" className="self-start sm:self-auto">Super Admin</Badge>
      </div>

      {/* Tabs */}
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

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <StatCard title="Total Users" value={users.length} subtitle={`${roleCounts.student} students`} icon={<Users size={20} />} color="blue" trend={{ value: 12, positive: true }} />
            <StatCard title="Active Tests" value={MOCK_TESTS.filter((t) => t.status === 'published').length} subtitle={`${MOCK_TESTS.length} total`} icon={<Activity size={20} />} color="emerald" />
            <StatCard title="Total Attempts" value={MOCK_ATTEMPTS.length} subtitle="All time" icon={<Zap size={20} />} color="purple" trend={{ value: 8, positive: true }} />
            <StatCard title="Active Tutors" value={MOCK_TUTORS.length} subtitle={`${roleCounts.student} students total`} icon={<Shield size={20} />} color="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Role distribution */}
            <Card>
              <h3 className="font-semibold text-slate-900 mb-4">Users by Role</h3>
              <div className="space-y-3">
                {(['super_admin', 'admin', 'tutor', 'student'] as Role[]).map((role) => (
                  <div key={role} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleColors[role]}`}>
                        {role.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(roleCounts[role] / users.length) * 100}%` }} />
                      </div>
                      <span className="text-sm font-medium text-slate-700 w-6 text-right">{roleCounts[role]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Activity log */}
            <div className="lg:col-span-2">
              <Card>
                <h3 className="font-semibold text-slate-900 mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {ACTIVITY_LOG.map((log, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        log.type === 'create' ? 'bg-emerald-100 text-emerald-700' :
                        log.type === 'test' ? 'bg-blue-100 text-blue-700' :
                        log.type === 'system' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {log.actor.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700">
                          <span className="font-medium">{log.actor}</span>{' '}
                          <span className="text-slate-500">{log.action}</span>{' '}
                          <span className="font-medium text-slate-700">{log.target}</span>
                        </p>
                        <p className="text-xs text-slate-400">{log.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* User management tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-1 overflow-x-auto">
              {(['all', 'super_admin', 'admin', 'tutor', 'student'] as const).map((r) => (
                <button key={r} onClick={() => setUserFilter(r)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                    userFilter === r ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {r === 'all' ? 'All' : r.replace('_', ' ')} ({roleCounts[r]})
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
                    {['Name', 'Email', 'Role', 'Status', 'Last Login', 'Created', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${roleColors[u.role]}`}>
                            {u.name.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-900 truncate max-w-32">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-40">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleColors[u.role]}`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.status === 'active' ? 'success' : 'default'} size="sm">{u.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{u.lastLogin}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{u.createdAt}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button className="p-1 text-slate-400 hover:text-blue-600 rounded"><Edit size={13} /></button>
                          {u.role !== 'super_admin' && (
                            <button onClick={() => setDeleteUser(u)} className="p-1 text-slate-400 hover:text-red-600 rounded"><Trash2 size={13} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Permissions tab */}
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
                          <button
                            onClick={() => togglePermission(i, role)}
                            disabled={role === 'super_admin'}
                            className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto transition-colors ${
                              p[role]
                                ? role === 'super_admin' ? 'bg-purple-500 text-white cursor-default' : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : role === 'super_admin' ? 'bg-slate-100 cursor-default' : 'bg-slate-100 hover:bg-red-100 text-slate-400'
                            }`}
                          >
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

      {/* System tab */}
      {tab === 'system' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {[
              { label: 'API Server', status: 'Operational', uptime: '99.9%', icon: <Server size={16} />, color: 'emerald' },
              { label: 'Database', status: 'Operational', uptime: '99.99%', icon: <Database size={16} />, color: 'emerald' },
              { label: 'Test Delivery', status: 'Operational', uptime: '99.8%', icon: <Zap size={16} />, color: 'emerald' },
            ].map((s) => (
              <Card key={s.label} padding="sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">{s.icon}</div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{s.label}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-xs text-emerald-600">{s.status}</span>
                      <span className="text-xs text-slate-400">· {s.uptime}</span>
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
                { label: 'Autosave Interval', desc: 'Seconds between automatic saves', value: '30' },
                { label: 'Session Timeout', desc: 'Minutes of inactivity before logout', value: '60' },
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
            <Button size="sm" icon={<Plus size={13} />} onClick={handleAddUser}>Create User</Button>
          </div>
        }>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Full name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="user@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as Role }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="student">Student</option>
              <option value="tutor">Tutor</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
            <input type="password" value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Temporary password" />
          </div>
        </div>
      </Modal>

      {/* Delete User Confirm */}
      <Modal isOpen={!!deleteUser} onClose={() => setDeleteUser(null)} title="Delete User" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={() => { setUsers((u) => u.filter((x) => x.id !== deleteUser?.id)); setDeleteUser(null); }}>Delete</Button>
          </div>
        }>
        <p className="text-sm text-slate-600">Delete <strong>{deleteUser?.name}</strong>? All associated data will be permanently removed.</p>
      </Modal>
    </div>
  );
}
