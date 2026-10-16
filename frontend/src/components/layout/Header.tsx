import { Bell, Calculator, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import type { Role } from '../../types';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { DesmosCalculator } from '../calculator/DesmosCalculator';
import { UserAvatar } from '../common/UserAvatar';

const roleLabels: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  tutor: 'Tutor',
  student: 'Student',
};

interface HeaderProps {
  onMenuClick: () => void;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { notifications, markRead } = useNotificationStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [desmosOpen, setDesmosOpen] = useState(false);
  const showDesmos = user?.role === 'student' || user?.role === 'tutor';
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const handleMarkAllRead = () => {
    notifications.filter((n) => !n.read).forEach((n) => markRead(n.id));
  };

  return (
    <header className="bg-white border-b border-slate-100 px-3 md:px-6 h-13 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <button onClick={onMenuClick} aria-label="Open menu" className="md:hidden -ml-1.5 p-2 rounded-lg text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors">
          <Menu size={20} />
        </button>
        {/* Brand on phones only, where the sidebar (and its logo) is tucked into the drawer */}
        <span className="md:hidden font-extrabold tracking-tight text-[15px] leading-none text-[#0B1E36] whitespace-nowrap truncate">
          Score&nbsp;<span className="text-amber-500">π</span>&nbsp;Go
        </span>
      </div>

      <div className="flex items-center gap-1">
        {/* Desmos calculator, available on every page for students and tutors */}
        {showDesmos && (
          <button onClick={() => setDesmosOpen((o) => !o)} title="Desmos calculator"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              desmosOpen ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}>
            <Calculator size={16} /> <span className="hidden sm:inline">DESMOS</span>
          </button>
        )}

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setNotifOpen(!notifOpen)} aria-label="Notifications"
            className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-1 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl border border-slate-100 z-50">
              <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">Notifications</p>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs text-blue-600">Mark read</button>
                )}
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No notifications</p>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div key={n.id} onClick={() => {
                      if (!n.read) markRead(n.id);
                      if (n.link?.startsWith('/')) { setNotifOpen(false); navigate(n.link); }
                    }}
                      className={`px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${!n.read ? 'bg-blue-50/30' : ''}`}>
                      <div className="flex items-start gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-900">{n.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{n.body}</p>
                        </div>
                        <p className="text-xs text-slate-300 flex-shrink-0">{relativeTime(n.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        {user && (
          <button type="button" onClick={() => navigate('/profile')} title="My Profile"
            className="flex items-center gap-2 pl-2 pr-1 py-0.5 rounded-lg text-left hover:bg-slate-50 transition-colors">
            <UserAvatar name={user.name} src={user.avatar} className="w-7 h-7 bg-blue-100 text-blue-700 text-xs" />
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-slate-800 leading-tight">{user.name.split(' ')[0]}</p>
              <p className="text-xs text-slate-400">{user.isDemo ? 'Demo Student' : roleLabels[user.role]}</p>
            </div>
          </button>
        )}
      </div>

      {/* Portal to <body> so the panel floats above the page, not inside the header's stacking layer */}
      {showDesmos && createPortal(<DesmosCalculator open={desmosOpen} onClose={() => setDesmosOpen(false)} />, document.body)}
    </header>
  );
}
