import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, BarChart3, Settings,
  LogOut, GraduationCap, BookOpen, ClipboardList, ChevronLeft, ChevronRight, Bell
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import type { Role } from '../../types';
import { useState } from 'react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: Role[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} />, roles: ['super_admin', 'admin', 'tutor', 'student'] },
  { label: 'Tests', path: '/tests', icon: <FileText size={18} />, roles: ['super_admin', 'admin'] },
  { label: 'Test Builder', path: '/test-builder', icon: <ClipboardList size={18} />, roles: ['super_admin', 'admin'] },
  { label: 'Students', path: '/students', icon: <GraduationCap size={18} />, roles: ['super_admin', 'admin', 'tutor'] },
  { label: 'My Students', path: '/my-students', icon: <Users size={18} />, roles: ['tutor'] },
  { label: 'My Tests', path: '/my-tests', icon: <BookOpen size={18} />, roles: ['student'] },
  { label: 'Analytics', path: '/analytics', icon: <BarChart3 size={18} />, roles: ['super_admin', 'admin', 'tutor'] },
  { label: 'My Progress', path: '/my-progress', icon: <BarChart3 size={18} />, roles: ['student'] },
  { label: 'Reports', path: '/reports', icon: <ClipboardList size={18} />, roles: ['super_admin', 'admin'] },
  { label: 'Settings', path: '/settings', icon: <Settings size={18} />, roles: ['super_admin', 'admin'] },
];

const roleLabels: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  tutor: 'Tutor',
  student: 'Student',
};

const roleColors: Record<Role, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  tutor: 'bg-emerald-100 text-emerald-700',
  student: 'bg-amber-100 text-amber-700',
};

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNav = navItems.filter((item) => user && item.roles.includes(user.role));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={`
        relative flex flex-col bg-slate-900 text-white transition-all duration-300
        ${collapsed ? 'w-16' : 'w-64'}
        min-h-screen flex-shrink-0
      `}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-700/50 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">A</span>
        </div>
        {!collapsed && (
          <div>
            <span className="font-bold text-white text-base">ACT·SAT</span>
            <span className="block text-xs text-slate-400">Test Platform</span>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-10 w-6 h-6 bg-slate-700 rounded-full flex items-center justify-center hover:bg-slate-600 transition-colors border border-slate-600"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {filteredNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
              ${isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }
              ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? item.label : undefined}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Notifications & User */}
      <div className="border-t border-slate-700/50 p-2 space-y-0.5">
        <button className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm ${collapsed ? 'justify-center' : ''}`}>
          <Bell size={18} className="flex-shrink-0" />
          {!collapsed && <span>Notifications</span>}
        </button>

        {user && (
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/50 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user.name.charAt(0)}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleColors[user.role]}`}>
                  {roleLabels[user.role]}
                </span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors text-sm ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
