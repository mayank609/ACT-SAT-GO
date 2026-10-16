import { useState, useEffect, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
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

  useEffect(() => {
    if (!dbId) return;
    setUserId(dbId);
    fetchNotifications();
    // Don't poll from background tabs; catch up as soon as the tab is visible again.
    const interval = setInterval(() => {
      if (!document.hidden) fetchNotifications();
    }, 30_000);
    const onVisible = () => {
      if (!document.hidden) fetchNotifications();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
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
        {/* Every page uses the full width with a tight margin, so content (not empty space) fills the screen. */}
        <main className="flex-1 px-3 py-3 md:px-4 overflow-auto w-full">
          <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
