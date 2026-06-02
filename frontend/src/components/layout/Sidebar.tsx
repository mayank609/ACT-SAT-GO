import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, Settings,
  LogOut, GraduationCap, ClipboardList, ChevronLeft, ChevronRight, X,
  Activity, UserCheck, Database, LifeBuoy, ChevronDown,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import type { Role } from '../../types';

interface NavSubItem {
  label: string;
  path: string;
  subItems?: { label: string; path: string }[];
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: Role[];
  subItems?: NavSubItem[];
}

// Student-focused navigation (clean and minimal — diagnostic test flow)
const studentNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} />, roles: ['student'] },
  { label: 'My Tests', path: '/my-tests', icon: <ClipboardList size={18} />, roles: ['student'] },
  { label: 'My Progress', path: '/my-progress', icon: <BarChart3 size={18} />, roles: ['student'] },
  { label: 'Review Mistakes', path: '/mistakes', icon: <AlertCircle size={18} />, roles: ['student'] },
  { label: 'Settings', path: '/settings', icon: <Settings size={18} />, roles: ['student'] },
];

// Admin/Tutor navigation
const adminNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} />, roles: ['super_admin', 'admin', 'tutor'] },
  { label: 'Students', path: '/students', icon: <GraduationCap size={18} />, roles: ['super_admin', 'admin'] },
  { label: 'My Students', path: '/my-students', icon: <GraduationCap size={18} />, roles: ['tutor'] },
  { label: 'Tutors', path: '/tutors', icon: <UserCheck size={18} />, roles: ['super_admin', 'admin'] },
  { label: 'Test Builder', path: '/tests', icon: <ClipboardList size={18} />, roles: ['super_admin', 'admin'] },
  { label: 'Question Bank', path: '/question-bank', icon: <Database size={18} />, roles: ['super_admin', 'admin'] },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: <BarChart3 size={18} />,
    roles: ['super_admin', 'admin', 'tutor'],
    subItems: [
      { label: 'Performance', path: '/analytics' },
      { label: 'Student Comparison', path: '/comparison' },
    ],
  },
  { label: 'Live Monitoring', path: '/monitoring', icon: <Activity size={18} />, roles: ['super_admin', 'admin'] },
  { label: 'Support', path: '/support', icon: <LifeBuoy size={18} />, roles: ['super_admin', 'admin', 'tutor'] },
  { label: 'Settings', path: '/settings', icon: <Settings size={18} />, roles: ['super_admin', 'admin', 'tutor'] },
];

const navItems: NavItem[] = [...studentNavItems, ...adminNavItems];

const roleLabels: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  tutor: 'Tutor',
  student: 'Student',
};


interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

export function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = React.useState<Record<string, boolean>>({});

  const toggleExpand = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setExpandedItems(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const filteredNav = navItems.filter((item) => user && item.roles.includes(user.role));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-300">
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 py-5 border-b border-transparent ${collapsed ? 'justify-center px-2' : ''}`}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-600/20">
          <span className="text-white font-bold text-sm">A</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-slate-900 text-sm tracking-wide truncate">ACT · SAT · GO</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Control Center</span>
          </div>
        )}
        <button onClick={() => setMobileOpen(false)} className="ml-auto md:hidden p-1 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto scrollbar-hide">
        {filteredNav.map((item) => (
          <div key={item.path}>
            <NavLink
              to={item.path}
              end={item.path === '/my-tests' ? false : undefined}
              onClick={(e) => {
                if (item.subItems && !collapsed) toggleExpand(e, item.path);
                else setMobileOpen(false);
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                } ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  {isActive && !item.subItems && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
                  )}
                  <span className={`flex-shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1">{item.label}</span>
                      {item.subItems && (
                        <ChevronDown size={14} className={`transition-transform ${expandedItems[item.path] ? 'rotate-180' : ''}`} />
                      )}
                    </>
                  )}
                </>
              )}
            </NavLink>
            
            {/* First level sub-items */}
            {!collapsed && item.subItems && expandedItems[item.path] && (
              <div className="ml-7 mt-1 border-l border-slate-200 pl-2 space-y-1">
                {item.subItems.map(subItem => (
                  <div key={subItem.path}>
                    <NavLink
                      to={subItem.path}
                      onClick={(e) => {
                        if (subItem.subItems) toggleExpand(e, subItem.path);
                        else setMobileOpen(false);
                      }}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive && !subItem.subItems ? 'text-blue-700 bg-blue-50 font-semibold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
                        }`
                      }
                    >
                      <span>{subItem.label}</span>
                      {subItem.subItems && (
                        <ChevronDown size={14} className={`transition-transform ${expandedItems[subItem.path] ? 'rotate-180' : ''}`} />
                      )}
                    </NavLink>
                    
                    {/* Second level sub-items */}
                    {subItem.subItems && expandedItems[subItem.path] && (
                      <div className="ml-4 mt-1 border-l border-slate-200 pl-2 space-y-1">
                        {subItem.subItems.map(subSubItem => (
                          <NavLink
                            key={subSubItem.path}
                            to={subSubItem.path}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) =>
                              `block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                isActive ? 'text-blue-700 bg-blue-50 font-semibold' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                              }`
                            }
                          >
                            {subSubItem.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-slate-100 p-3 space-y-1">

        {user && (
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2 ${collapsed ? 'justify-center px-0' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold flex-shrink-0">
              {user.name.charAt(0)}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{roleLabels[user.role]}</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 text-sm font-medium group ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut size={18} className="flex-shrink-0 group-hover:-translate-x-1 transition-transform" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out md:hidden shadow-2xl
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`
          relative hidden md:flex flex-col transition-all duration-300 ease-in-out
          ${collapsed ? 'w-20' : 'w-64'}
          h-screen sticky top-0 flex-shrink-0 shadow-lg border-r border-slate-200 z-50
        `}
      >
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-4 top-1/2 -translate-y-1/2 z-50 w-8 h-8 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-md group"
        >
          {collapsed ? <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" /> : <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />}
        </button>
      </aside>
    </>
  );
}
