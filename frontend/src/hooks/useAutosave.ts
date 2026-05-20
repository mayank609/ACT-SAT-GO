import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';

export interface AttemptState {
  currentSectionIndex: number;
  currentQuestionIndex: number;
  sections: Record<
    string,
    {
      startedAt?: string;
      completedAt?: string;
      timeUsed: number;
    }
  >;
  markedForReview: string[];
  tabSwitchCount: number;
  isFullScreen: boolean;
  lastSavedAt: number;
  updatedAt: number;
}

export interface SavedAnswer {
  answerGiven: unknown;
  timeSpentSeconds: number;
  isFlagged: boolean;
  updatedAt: number;
}

interface UseAutosaveResult {
  state: AttemptState | null;
  answers: Record<string, SavedAnswer>;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  saveState: (state: AttemptState) => Promise<void>;
  saveAnswer: (
    questionId: string,
    answer: unknown,
    timeSpent: number,
    isFlagged?: boolean
  ) => Promise<void>;
  recoverState: () => Promise<{ state: AttemptState | null; answers: Record<string, SavedAnswer> } | null>;
}

export function useAutosave(attemptId?: string): UseAutosaveResult {
  const [state, setState] = useState<AttemptState | null>(null);
  const [answers, setAnswers] = useState<Record<string, SavedAnswer>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStateRef = useRef<AttemptState | null>(null);

  const saveState = useCallback(
    async (newState: AttemptState) => {
      if (!attemptId) return;

      pendingStateRef.current = newState;
      setState(newState);

      // Debounce the actual save
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      autosaveTimerRef.current = setTimeout(async () => {
        if (!pendingStateRef.current) return;

        setIsSaving(true);
        setError(null);

        try {
          await api.autosaveAnswer(attemptId, {
            attemptState: pendingStateRef.current,
          });
          setLastSaved(new Date());
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Autosave failed';
          setError(message);
          console.error('Autosave error:', err);
        } finally {
          setIsSaving(false);
        }
      }, 1000); // Debounce for 1 second
    },
    [attemptId]
  );

  const saveAnswer = useCallback(
    async (
      questionId: string,
      answerGiven: unknown,
      timeSpentSeconds: number,
      isFlagged = false
    ) => {
      if (!attemptId) return;

      const newAnswer: SavedAnswer = {
        answerGiven,
        timeSpentSeconds,
        isFlagged,
        updatedAt: Date.now(),
      };

      setAnswers((prev) => ({
        ...prev,
        [questionId]: newAnswer,
      }));

      setIsSaving(true);
      setError(null);

      try {
        await api.autosaveAnswer(attemptId, {
          questionId,
          answerGiven,
          timeSpentSeconds,
          isFlagged,
        });
        setLastSaved(new Date());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save answer';
        setError(message);
        console.error('Save answer error:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [attemptId]
  );

  const recoverState = useCallback(async () => {
    if (!attemptId) return null;

    try {
      const response = await api.getAutosaveState(attemptId);
      const recoveredState = response.state as AttemptState | null;
      const recoveredAnswers = response.answers as Record<string, SavedAnswer> | null;

      if (recoveredState) {
        setState(recoveredState);
      }
      if (recoveredAnswers) {
        setAnswers(recoveredAnswers);
      }

      return {
        state: recoveredState,
        answers: recoveredAnswers || {},
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to recover state';
      setError(message);
      console.error('State recovery error:', err);
      return null;
    }
  }, [attemptId]);

  // Load saved state on mount
  useEffect(() => {
    if (attemptId) {
      recoverState();
    }

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [attemptId, recoverState]);

  return {
    state,
    answers,
    isSaving,
    lastSaved,
    error,
    saveState,
    saveAnswer,
    recoverState,
  };
}
