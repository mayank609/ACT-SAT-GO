import { Bell, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useNavigate } from 'react-router-dom';
import type { Role } from '../../types';
import { useState, useRef, useEffect } from 'react';

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
  const { user, logout } = useAuthStore();
  const { notifications, markRead } = useNotificationStore();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
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

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleMarkAllRead = () => {
    notifications.filter((n) => !n.read).forEach((n) => markRead(n.id));
  };

  return (
    <header className="bg-white border-b border-slate-100 px-4 md:px-6 h-13 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors">
          <Menu size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-1 w-72 bg-white rounded-xl border border-slate-100 z-50">
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
                    <div key={n.id} onClick={() => { if (!n.read) markRead(n.id); }}
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
          <div className="flex items-center gap-2 pl-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-slate-800 leading-tight">{user.name.split(' ')[0]}</p>
              <p className="text-xs text-slate-400">{roleLabels[user.role]}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
