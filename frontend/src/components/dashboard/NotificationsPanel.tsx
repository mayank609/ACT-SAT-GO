import { Bell, X } from 'lucide-react';
import { useState } from 'react';

interface Notification {
  id: string;
  type: 'alert' | 'feedback' | 'achievement' | 'reminder';
  title: string;
  message: string;
  icon: React.ReactNode;
  timestamp: string;
  read: boolean;
}

function NotificationItem({ notification, onDismiss }: { notification: Notification; onDismiss: (id: string) => void }) {
  const typeColors = {
    alert: 'bg-orange-50 border-orange-200',
    feedback: 'bg-blue-50 border-blue-200',
    achievement: 'bg-green-50 border-green-200',
    reminder: 'bg-indigo-50 border-indigo-200',
  };

  return (
    <div className={`border rounded-lg p-3 ${typeColors[notification.type]} flex items-start gap-3 transition-all hover:shadow-sm`}>
      <div className="text-lg flex-shrink-0 pt-0.5">{notification.icon}</div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
        <p className="text-xs text-slate-600 mt-1">{notification.message}</p>
        <p className="text-xs text-slate-500 mt-2">{notification.timestamp}</p>
      </div>

      <button
        onClick={() => onDismiss(notification.id)}
        className="p-1 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function NotificationsPanel() {
  const initialNotifications: Notification[] = [
    {
      id: '1',
      type: 'alert',
      title: 'Test Approaching',
      message: 'ACT Full Practice Test #3 is scheduled for March 18. Start your preparation now!',
      icon: '⏰',
      timestamp: '2 hours ago',
      read: false,
    },
    {
      id: '2',
      type: 'feedback',
      title: 'Tutor Feedback Available',
      message: 'Dr. Rodriguez left detailed feedback on your SAT Math practice test',
      icon: '💬',
      timestamp: '1 day ago',
      read: false,
    },
    {
      id: '3',
      type: 'achievement',
      title: '🎉 7-Day Streak!',
      message: 'You\'ve maintained your study streak for 7 consecutive days. Great dedication!',
      icon: '🔥',
      timestamp: '1 day ago',
      read: true,
    },
    {
      id: '4',
      type: 'reminder',
      title: 'Review Weak Topics',
      message: 'Your Coordinate Geometry accuracy is at 58%. Complete the recommended practice set today.',
      icon: '📌',
      timestamp: '3 days ago',
      read: true,
    },
    {
      id: '5',
      type: 'achievement',
      title: 'Rank Improved!',
      message: 'Your global rank improved from #150 to #142. You\'re in the top 5%!',
      icon: '⭐',
      timestamp: '3 days ago',
      read: true,
    },
  ];

  const [notifications, setNotifications] = useState(initialNotifications);

  const handleDismiss = (id: string) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

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
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onDismiss={handleDismiss} />
          ))
        ) : (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 text-sm">No notifications</p>
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <button className="w-full py-2 text-slate-700 font-semibold hover:bg-slate-50 rounded-lg transition-colors text-sm">
          Mark all as read
        </button>
      )}
    </div>
  );
}
