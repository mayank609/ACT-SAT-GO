import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, Settings,
  LogOut, GraduationCap, ClipboardList, ChevronLeft, ChevronRight, X,
  Activity, UserCheck, Database, LifeBuoy, ChevronDown,
  AlertCircle, HelpCircle, PieChart, BookMarked, CalendarCheck, TrendingUp,
  Banknote
} from 'lucide-react';
import logo from '../../assets/logo.png';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import type { Role } from '../../types';

// Days between today and an ISO date (midnight-to-midnight, so "today" reads 0 not fractional).
function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function formatExamDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

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
  { label: 'My Assignments', path: '/my-tests', icon: <ClipboardList size={18} />, roles: ['student'] },
  { label: 'My Progress', path: '/my-progress', icon: <TrendingUp size={18} />, roles: ['student'] },
  { label: 'My Classes', path: '/attendance', icon: <CalendarCheck size={18} />, roles: ['student'] },
  { label: 'Analytics', path: '/analytics', icon: <PieChart size={18} />, roles: ['student'] },
  { label: 'Review Mistakes', path: '/mistakes', icon: <AlertCircle size={18} />, roles: ['student'] },
  { label: 'My Doubts', path: '/doubts', icon: <HelpCircle size={18} />, roles: ['student'] },
  { label: 'Settings', path: '/settings', icon: <Settings size={18} />, roles: ['student'] },
];

// Admin/Tutor navigation
const adminNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} />, roles: ['super_admin', 'admin', 'tutor'] },
  { label: 'Students', path: '/students', icon: <GraduationCap size={18} />, roles: ['super_admin', 'admin'] },
  { label: 'My Students', path: '/my-students', icon: <GraduationCap size={18} />, roles: ['tutor'] },
  { label: 'Session Log', path: '/attendance', icon: <CalendarCheck size={18} />, roles: ['super_admin', 'admin', 'tutor'] },
  { label: 'Teacher Salaries', path: '/teacher-salaries', icon: <Banknote size={18} />, roles: ['super_admin', 'admin'] },
  { label: 'Tutors', path: '/tutors', icon: <UserCheck size={18} />, roles: ['super_admin', 'admin'] },
  { label: 'Test Builder', path: '/tests', icon: <ClipboardList size={18} />, roles: ['super_admin', 'admin'] },
  { label: 'Question Bank', path: '/question-bank', icon: <Database size={18} />, roles: ['super_admin', 'admin'] },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: <BarChart3 size={18} />,
    roles: ['super_admin', 'admin', 'tutor'],
  },
  { label: 'Live Monitoring', path: '/monitoring', icon: <Activity size={18} />, roles: ['super_admin', 'admin'] },
  { label: 'Student Doubts', path: '/student-doubts', icon: <HelpCircle size={18} />, roles: ['super_admin', 'admin', 'tutor'] },
  { label: 'Student Mistakes', path: '/student-mistakes', icon: <AlertCircle size={18} />, roles: ['super_admin', 'admin', 'tutor'] },
  { label: 'Skills', path: '/skills', icon: <BookMarked size={18} />, roles: ['super_admin', 'admin'] },
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
  const [nextSatDate, setNextSatDate] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user || user.role === 'student') return;
    api.getSettings().then((r) => setNextSatDate(r.nextSatDate)).catch(() => {});
  }, [user?.role]);

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
    <div className="flex flex-col h-full bg-[#0B1E36] border-r border-white/5 transition-all duration-300">
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 py-4 border-b border-white/5 ${collapsed ? 'justify-center px-2' : ''}`}>
        {/* Icon badge — cropped from the logo artwork so it sits in a clean circle */}
        <div
          className="w-9 h-9 rounded-full bg-white ring-1 ring-amber-100 shadow-sm flex-shrink-0"
          style={{
            backgroundImage: `url(${logo})`,
            backgroundSize: '140% auto',
            backgroundPosition: 'center 10%',
            backgroundRepeat: 'no-repeat',
          }}
          role="img"
          aria-label="ScoreπGo"
        />
        {!collapsed && (
          <span className="font-extrabold tracking-tight text-[15px] leading-none text-white whitespace-nowrap">
            Score&nbsp;<span className="text-amber-400">π</span>&nbsp;Go
          </span>
        )}
        <button onClick={() => setMobileOpen(false)} className="ml-auto md:hidden p-1 text-slate-400 hover:text-white transition-colors">
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
                    ? 'bg-blue-600/25 text-blue-300 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                } ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  {isActive && !item.subItems && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />
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
              <div className="ml-7 mt-1 border-l border-white/10 pl-2 space-y-1">
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
                          isActive && !subItem.subItems ? 'text-blue-300 bg-blue-600/20 font-semibold' : 'text-slate-400 hover:text-white hover:bg-white/5 font-medium'
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
                      <div className="ml-4 mt-1 border-l border-white/10 pl-2 space-y-1">
                        {subItem.subItems.map(subSubItem => (
                          <NavLink
                            key={subSubItem.path}
                            to={subSubItem.path}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) =>
                              `block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                isActive ? 'text-blue-300 bg-blue-600/20 font-semibold' : 'text-slate-400 hover:text-white hover:bg-white/5'
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
      <div className="border-t border-white/5 p-3 space-y-1">

        {user?.role === 'student' && !collapsed && (
          <div className="mb-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Exam Date</p>
            {user.targetDate ? (() => {
              const days = daysUntil(user.targetDate as string);
              return (
                <>
                  <p className="text-sm font-semibold text-white mt-0.5">{formatExamDate(user.targetDate as string)}</p>
                  <p className="text-xs text-amber-400 font-medium mt-0.5">
                    {days > 0 ? `${days} day${days === 1 ? '' : 's'} left` : days === 0 ? 'Today!' : 'Date has passed'}
                  </p>
                </>
              );
            })() : (
              <p className="text-xs text-slate-400 mt-0.5">Not set yet — ask your tutor/admin</p>
            )}
          </div>
        )}

        {user && user.role !== 'student' && !collapsed && (
          <div className="mb-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Next SAT</p>
            {nextSatDate ? (() => {
              const days = daysUntil(nextSatDate);
              return (
                <>
                  <p className="text-sm font-semibold text-white mt-0.5">{formatExamDate(nextSatDate)}</p>
                  <p className="text-xs text-amber-400 font-medium mt-0.5">
                    {days > 0 ? `${days} day${days === 1 ? '' : 's'} left` : days === 0 ? 'Today!' : 'Date has passed'}
                  </p>
                </>
              );
            })() : (
              <p className="text-xs text-slate-400 mt-0.5">
                {user.role === 'super_admin' ? 'Not set — add it in Settings' : 'Not set yet'}
              </p>
            )}
          </div>
        )}

        {user && (
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2 ${collapsed ? 'justify-center px-0' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user.name.charAt(0)}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{roleLabels[user.role]}</p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 text-sm font-medium group ${collapsed ? 'justify-center' : ''}`}
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
          h-screen sticky top-0 flex-shrink-0 shadow-lg border-r border-white/5 z-50
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
