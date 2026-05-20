import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface AssignedTestData {
  assignmentId: string;
  testId: string;
  title: string;
  description?: string;
  dueDate?: string;
  availableFrom?: string;
  availableUntil?: string;
  availabilityState: 'upcoming' | 'open' | 'expired';
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Expired';
  completionStatus: 'Submitted' | 'In Progress' | 'Pending';
  usedAttempts: number;
  remainingAttempts: number;
  maxAttempts: number;
  latestAttemptId?: string | null;
  inProgressAttemptId?: string | null;
  submittedAttemptId?: string | null;
  sections: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    _count?: { questions: number };
  }>;
}

interface UseAssignedTestsResult {
  tests: AssignedTestData[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAssignedTests(studentId?: string): UseAssignedTestsResult {
  const [tests, setTests] = useState<AssignedTestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.getAssignedTests(studentId);
      setTests((response.assignedTests ?? []) as AssignedTestData[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch assigned tests';
      setError(message);
      console.error('Error fetching assigned tests:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    refetch();
  }, [studentId, refetch]);

  return { tests, loading, error, refetch };
}

export function getTestStatusColor(status: string): string {
  switch (status) {
    case 'Not Started':
      return 'bg-slate-100 text-slate-700';
    case 'In Progress':
      return 'bg-blue-100 text-blue-700';
    case 'Completed':
      return 'bg-emerald-100 text-emerald-700';
    case 'Expired':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function getTestStatusIcon(status: string) {
  switch (status) {
    case 'Not Started':
      return '○';
    case 'In Progress':
      return '◐';
    case 'Completed':
      return '◉';
    case 'Expired':
      return '✕';
    default:
      return '○';
  }
}

export function formatDueDate(date?: string): string {
  if (!date) return 'No due date';
  const d = new Date(date);
  const now = new Date();
  const daysUntil = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return `Expired ${Math.abs(daysUntil)} days ago`;
  } else if (daysUntil === 0) {
    return 'Due today';
  } else if (daysUntil === 1) {
    return 'Due tomorrow';
  } else if (daysUntil <= 7) {
    return `Due in ${daysUntil} days`;
  } else {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

export function formatAvailabilityWindow(from?: string, until?: string): string {
  if (!from && !until) return 'Always available';

  const fromDate = from ? new Date(from) : null;
  const untilDate = until ? new Date(until) : null;
  const now = new Date();

  if (fromDate && now < fromDate) {
    return `Available ${fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  if (untilDate) {
    return `Until ${untilDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  return 'Available';
}

export function getTotalDuration(sections: Array<{ durationMinutes: number }>): number {
  return sections.reduce((sum, s) => sum + s.durationMinutes, 0);
}

export function getTotalQuestions(sections: Array<{ _count?: { questions: number } }>): number {
  return sections.reduce((sum, s) => sum + (s._count?.questions ?? 0), 0);
}
