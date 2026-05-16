import { Bell, Search, Menu, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
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

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);
  const notifRef = useRef<HTMLDivElement>(null);

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

  const notifications = [
    { title: 'Test assigned', body: 'ACT Practice #2 has been assigned to you', time: '5m', unread: true },
    { title: 'Score ready', body: 'SAT Practice #1 results are available', time: '1h', unread: true },
    { title: 'Tutor note', body: 'Dr. Rodriguez left feedback on your math section', time: '2h', unread: false },
    { title: 'Test completed', body: 'Alex Thompson scored 28 on ACT Full #1', time: '3h', unread: false },
  ];

  return (
    <header className="bg-white border-b border-slate-100 px-4 md:px-6 h-13 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors">
          <Menu size={18} />
        </button>
        <div className="relative hidden lg:block">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input type="text" placeholder="Search..." className="pl-8 pr-4 py-1.5 text-sm bg-slate-50 border-none rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-200 w-44 text-slate-700 placeholder-slate-300" />
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) setUnreadCount(0); }}
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
                <button onClick={() => setUnreadCount(0)} className="text-xs text-blue-600">Mark read</button>
              </div>
              <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                {notifications.map((n, i) => (
                  <div key={i} className={`px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${n.unread ? 'bg-blue-50/30' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.unread ? 'bg-blue-500' : 'bg-transparent'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-900">{n.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{n.body}</p>
                      </div>
                      <p className="text-xs text-slate-300 flex-shrink-0">{n.time}</p>
                    </div>
                  </div>
                ))}
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
            <button onClick={handleLogout} className="p-1.5 ml-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
