import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';

interface UseSectionTimerResult {
  remainingSeconds: number;
  isExpired: boolean;
  isPaused: boolean;
  timePercentage: number;
  formattedTime: string;
  syncTimer: () => Promise<void>;
}

export function useSectionTimer(
  attemptId?: string,
  sectionId?: string,
  totalDurationMinutes?: number
): UseSectionTimerResult {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncTimer = useCallback(async () => {
    if (!attemptId || !sectionId) return;

    try {
      const response = await api.getSectionTimer(attemptId, sectionId);
      setRemainingSeconds(response.remainingSeconds);
      setIsExpired(response.expired);
    } catch (error) {
      console.error('Error syncing timer:', error);
    }
  }, [attemptId, sectionId]);

  useEffect(() => {
    if (!attemptId || !sectionId || !totalDurationMinutes) return;

    // Initial sync
    syncTimer();

    // Set up interval to decrement timer
    timerIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 0) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Sync timer every 30 seconds to ensure accuracy
    syncTimerRef.current = setInterval(() => {
      syncTimer();
    }, 30000);

    // Handle page visibility changes (user switches tabs)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
        // Resync timer when user comes back
        syncTimer();
      }
    };

    // Handle connection recovery
    const handleOnline = () => {
      syncTimer();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [attemptId, sectionId, totalDurationMinutes, syncTimer]);

  const timePercentage =
    totalDurationMinutes && totalDurationMinutes > 0
      ? Math.max(0, Math.min(100, (remainingSeconds / (totalDurationMinutes * 60)) * 100))
      : 0;

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  return {
    remainingSeconds,
    isExpired,
    isPaused,
    timePercentage,
    formattedTime: formatTime(remainingSeconds),
    syncTimer,
  };
}
