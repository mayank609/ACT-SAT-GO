import { Bell, X } from 'lucide-react';
import { useNotificationStore } from '../../store/useNotificationStore';

const TYPE_COLORS: Record<string, string> = {
  alert: 'bg-orange-50 border-orange-200',
  feedback: 'bg-blue-50 border-blue-200',
  achievement: 'bg-green-50 border-green-200',
  reminder: 'bg-indigo-50 border-indigo-200',
  test_assigned: 'bg-blue-50 border-blue-200',
};

const TYPE_ICONS: Record<string, string> = {
  alert: '⏰',
  feedback: '💬',
  achievement: '🎉',
  reminder: '📌',
  test_assigned: '📝',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationsPanel() {
  const { notifications, loading, markRead, dismissLocal } = useNotificationStore();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    notifications.filter((n) => !n.read).forEach((n) => markRead(n.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-600" />
          Notifications
        </h2>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {unreadCount} new
          </span>
        )}
      </div>

      <div className="space-y-2">
        {loading && notifications.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">Loading…</div>
        ) : notifications.length > 0 ? (
          notifications.map((n) => {
            const colorClass = TYPE_COLORS[n.type] ?? 'bg-slate-50 border-slate-200';
            const icon = TYPE_ICONS[n.type] ?? '🔔';
            return (
              <div
                key={n.id}
                className={`border rounded-lg p-3 ${colorClass} flex items-start gap-3 transition-all hover:shadow-sm ${!n.read ? 'ring-1 ring-blue-200' : ''}`}
                onClick={() => { if (!n.read) markRead(n.id); }}
              >
                <div className="text-lg flex-shrink-0 pt-0.5">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{n.body}</p>
                  <p className="text-xs text-slate-500 mt-2">{relativeTime(n.createdAt)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); dismissLocal(n.id); }}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 text-sm">No notifications</p>
          </div>
        )}
      </div>

      {unreadCount > 0 && (
        <button
          onClick={handleMarkAllRead}
          className="w-full py-2 text-slate-700 font-semibold hover:bg-slate-50 rounded-lg transition-colors text-sm"
        >
          Mark all as read
        </button>
      )}
    </div>
  );
}
