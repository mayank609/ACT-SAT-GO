import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

interface ConnectionRecoveryProps {
  onRecover?: () => void;
}

export function ConnectionRecoveryBanner({ onRecover }: ConnectionRecoveryProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => setShowBanner(false), 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg">
        <WifiOff size={18} className="flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm">Connection lost</p>
          <p className="text-xs text-red-100">Your progress is being saved locally. Reconnect to sync.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg animate-in slide-in-from-top">
      <Wifi size={18} className="flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-sm">Connection restored</p>
        <p className="text-xs text-emerald-100">Syncing your progress...</p>
      </div>
      {onRecover && (
        <button
          onClick={onRecover}
          className="text-xs font-medium bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          Sync Now
        </button>
      )}
    </div>
  );
}
