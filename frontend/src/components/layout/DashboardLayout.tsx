import { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dbId } = useAuthStore();
  const { setUserId, fetchNotifications } = useNotificationStore();
  const { pathname } = useLocation();
  // Full-bleed workspace pages span the whole area; others stay centered at max-w-7xl.
  const fullBleed = pathname === '/student-mistakes';

  useEffect(() => {
    if (!dbId) return;
    setUserId(dbId);
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [dbId, setUserId, fetchNotifications]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className={`flex-1 p-4 md:p-6 overflow-auto w-full ${fullBleed ? '' : 'max-w-7xl mx-auto'}`}>
          <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
