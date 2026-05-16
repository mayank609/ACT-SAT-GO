import { Bell, Search, ChevronDown, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import type { Role } from '../../types';
import { useState } from 'react';

const roleLabels: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin / Operations',
  tutor: 'Tutor',
  student: 'Student',
};

const roleColors: Record<Role, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  tutor: 'bg-emerald-100 text-emerald-700',
  student: 'bg-amber-100 text-amber-700',
};

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onMenuClick: () => void;
}

export function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const { user } = useAuthStore();
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between sticky top-0 z-30 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          {title && <h1 className="text-base md:text-xl font-semibold text-slate-900 truncate">{title}</h1>}
          {subtitle && <p className="text-xs md:text-sm text-slate-500 hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {/* Search — hidden on small screens */}
        <div className="relative hidden lg:block">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Quick search..."
            className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white w-48 xl:w-56"
          />
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-lg border border-slate-200 z-50">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {[
                  { title: 'New test assigned', body: 'ACT Full Practice Test #2 has been assigned', time: '5m ago', unread: true },
                  { title: 'Score updated', body: 'Your SAT Practice Test #1 results are ready', time: '1h ago', unread: true },
                  { title: 'Tutor feedback', body: 'Dr. Rodriguez left feedback on your math section', time: '2h ago', unread: false },
                ].map((n, i) => (
                  <div key={i} className={`px-4 py-3 hover:bg-slate-50 cursor-pointer ${n.unread ? 'bg-blue-50/30' : ''}`}>
                    <div className="flex items-start gap-3">
                      {n.unread && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                      {!n.unread && <div className="w-2 h-2 mt-1.5 flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{n.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-xs text-slate-400 mt-1">{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-slate-100 text-center">
                <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">View all</button>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        {user && (
          <button className="flex items-center gap-2 pl-2 md:pl-3 pr-1 md:pr-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-slate-900 leading-tight max-w-24 truncate">{user.name}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleColors[user.role]}`}>
                {roleLabels[user.role]}
              </span>
            </div>
            <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
          </button>
        )}
      </div>
    </header>
  );
}
