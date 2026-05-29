import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams, useBlocker } from 'react-router-dom';
import { Flag, ChevronLeft, ChevronRight, Send, AlertTriangle, Grid3X3, Loader2 } from 'lucide-react';
import { useTestStore } from '../../store/useTestStore';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
import { OptionRenderer } from '../../components/admin/OptionRenderer';
import type { QuestionState, SectionAttempt } from '../../types';
import type { TestAttempt } from '../../types';
import { transformDbTest, flattenTest } from './TestInstructionsPage';

// ─── helpers ──────────────────────────────────────────────────────────────────

function useTimer(initialSeconds: number, onExpire: () => void) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (seconds <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire();
      return;
    }
    intervalRef.current = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [seconds]);  // eslint-disable-line react-hooks/exhaustive-deps

  const reset = (s: number) => { expiredRef.current = false; setSeconds(s); };
  return { seconds, reset };
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// Converts frontend answer to DB storage format so scoring comparison works
function toDbAnswer(type: string, answer: string | string[] | number | null | Record<string, any>): unknown {
  if (answer === null || answer === '' || (Array.isArray(answer) && answer.length === 0)) return null;
  
  // For passage questions, answer is an object with linked question answers
  if (type === 'passage') {
    if (typeof answer !== 'object' || Array.isArray(answer)) return null;
    
    const passageAnswers: Record<string, any> = {};
    for (const [qId, qAnswer] of Object.entries(answer)) {
      if (qAnswer === null || qAnswer === '' || (Array.isArray(qAnswer) && qAnswer.length === 0)) {
        passageAnswers[qId] = null;
      } else if (typeof qAnswer === 'number') {
        passageAnswers[qId] = { value: qAnswer };
      } else if (Array.isArray(qAnswer)) {
        passageAnswers[qId] = { keys: qAnswer.map((k: string) => k.toUpperCase()) };
      } else {
        passageAnswers[qId] = { key: String(qAnswer).toUpperCase() };
      }
    }
    return passageAnswers;
  }
  
  if (type === 'numeric') return { value: typeof answer === 'number' ? answer : parseFloat(String(answer)) || null };
  if (type === 'mcq_multi') return { keys: (answer as string[]).map((k) => k.toUpperCase()) };
  return { key: (answer as string).toUpperCase() };
}

const stateColors: Record<QuestionState, string> = {
  not_visited: 'bg-slate-200 text-slate-600',
  not_answered: 'bg-red-500 text-white',
  answered: 'bg-emerald-500 text-white',
  marked_review: 'bg-purple-500 text-white',
  answered_marked: 'bg-blue-500 text-white',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TestInterfacePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentAttempt, activeTest, startAttempt, updateQuestionState, navigateToQuestion, advanceSection, recordTabSwitch, clearAttempt } = useTestStore();
  const { user } = useAuthStore();

  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | number | Record<string, any> | null>(null);
  const [numericInput, setNumericInput] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [tabSwitchWarning, setTabSwitchWarning] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(searchParams.get('attemptId')));
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const { testId } = useParams<{ testId: string }>();
  const isPreview = searchParams.get('preview') === 'true';

  const [isFullscreenBlocked, setIsFullscreenBlocked] = useState(true);
  const [showExitWarningModal, setShowExitWarningModal] = useState(false);
  const [allowNavigationAway, setAllowNavigationAway] = useState(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !allowNavigationAwayRef.current && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked' && !exitWarningShownRef.current) {
      exitWarningShownRef.current = true;
      setShowExitWarningModal(true);
    }
  }, [blocker.state]);

  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref so timer-expire callback always sees latest reset function
  const resetTimerRef = useRef<(s: number) => void>(() => {});
  // Ref so timer-expire callback always sees latest component state
  const timerExpireHandlerRef = useRef<() => void>(() => {});

  const test = activeTest;
  const attempt = currentAttempt;
  const attemptIdFromQuery = searchParams.get('attemptId');

  useEffect(() => {
    async function restoreAttemptFromBackend() {
      if (isPreview && !currentAttempt && testId) {
        setRestoring(true);
        setRestoreError(null);
        try {
          const { test: rawTest } = await api.getTest(testId);
          const restoredTest = flattenTest(transformDbTest(rawTest as any));
          const sections: Record<string, SectionAttempt> = {};
          restoredTest.sections.forEach((sec) => {
            const questions: SectionAttempt['questions'] = {};
            sec.questions.forEach((q) => {
              questions[q.id] = { questionId: q.id, state: 'not_visited', timeSpent: 0 };
            });
            sections[sec.id] = {
              sectionId: sec.id,
              startedAt: new Date().toISOString(),
              completedAt: undefined,
              timeUsed: 0,
              questions,
            };
          });
          const attempt: TestAttempt = {
            id: 'preview',
            testId,
            studentId: user?.id ?? 'preview',
            status: 'in_progress',
            startedAt: new Date().toISOString(),
            currentSectionIndex: 0,
            currentQuestionIndex: 0,
            sections,
            tabSwitchCount: 0,
            isFullScreen: false,
          };
          startAttempt(attempt, restoredTest);
          setRestoring(false);
        } catch (err: any) {
          console.error('[Preview] Failed to restore preview attempt:', err);
          setRestoring(false);
          setRestoreError(err?.message ?? 'Failed to restore preview.');
        }
        return;
      }

      if (!attemptIdFromQuery || currentAttempt) {
        setRestoring(false);
        return;
      }
      setRestoring(true);
      setRestoreError(null);
      try {
        const [attemptRes, autosaveRes] = await Promise.all([
          api.getAttempt(attemptIdFromQuery),
          api.getAutosaveState(attemptIdFromQuery),
        ]);
        const rawAttempt = attemptRes.attempt as any;
        if (!rawAttempt || !rawAttempt.test) {
          throw new Error('Attempt data is missing or incomplete. The test may have been deleted.');
        }
        const restoredTest = flattenTest(transformDbTest(rawAttempt.test));
        if (!restoredTest.sections || restoredTest.sections.length === 0) {
          throw new Error('Test has no sections. It may have been modified or corrupted.');
        }
        const state = (autosaveRes.state as any) ?? {};
        const answersMap = (autosaveRes.answers as Record<string, any>) ?? {};

        const sections: TestAttempt['sections'] = {};
        restoredTest.sections.forEach((section) => {
          const dbSectionAttempt = rawAttempt.sectionAttempts?.find((s: any) => s.sectionId === section.id);
          const questions: TestAttempt['sections'][string]['questions'] = {};
          section.questions.forEach((q) => {
            const dbAnswer = rawAttempt.answers?.find((a: any) => a.questionId === q.id);
            const cached = answersMap[q.id] ?? null;
            const fromDb = dbAnswer?.answerGiven ?? null;
            const answerPayload = cached?.answerGiven ?? fromDb;
            const normalizedAnswer = answerPayload?.value ?? answerPayload?.keys?.map((k: string) => k.toLowerCase()) ?? answerPayload?.key?.toLowerCase() ?? null;
            const isFlagged = Boolean(cached?.isFlagged ?? dbAnswer?.isFlagged);
            const hasAnswer = normalizedAnswer !== null && normalizedAnswer !== '' && !(Array.isArray(normalizedAnswer) && normalizedAnswer.length === 0);
            const stateFromCache = state?.sections?.[section.id]?.questions?.[q.id]?.state as QuestionState | undefined;
            questions[q.id] = {
              questionId: q.id,
              state: stateFromCache ?? (isFlagged ? (hasAnswer ? 'answered_marked' : 'marked_review') : (hasAnswer ? 'answered' : 'not_visited')),
              selectedAnswer: normalizedAnswer,
              timeSpent: cached?.timeSpentSeconds ?? dbAnswer?.timeSpentSeconds ?? 0,
            };
          });
          sections[section.id] = {
            sectionId: section.id,
            startedAt: dbSectionAttempt?.startedAt ? new Date(dbSectionAttempt.startedAt).toISOString() : undefined,
            completedAt: dbSectionAttempt?.completedAt ? new Date(dbSectionAttempt.completedAt).toISOString() : undefined,
            timeUsed: state?.sections?.[section.id]?.timeUsed ?? 0,
            questions,
          };
        });

        // Resolve active section index: prefer Redis state, fallback to DB
        let currentSectionIdx = state?.currentSectionIndex as number | undefined;
        if (currentSectionIdx === undefined || currentSectionIdx === null) {
          const activeSecAttempt = rawAttempt.sectionAttempts?.find(
            (sa: any) => sa.startedAt && !sa.completedAt
          );
          if (activeSecAttempt) {
            currentSectionIdx = restoredTest.sections.findIndex(
              (s) => s.id === activeSecAttempt.sectionId
            );
          }
          currentSectionIdx = (currentSectionIdx === undefined || currentSectionIdx === null || currentSectionIdx === -1) ? 0 : currentSectionIdx;
        }

        const restoredAttempt: TestAttempt = {
          id: rawAttempt.id,
          testId: rawAttempt.testId,
          studentId: rawAttempt.studentId,
          status: rawAttempt.status === 'IN_PROGRESS' ? 'in_progress' : 'completed',
          startedAt: rawAttempt.startedAt ? new Date(rawAttempt.startedAt).toISOString() : new Date().toISOString(),
          completedAt: rawAttempt.completedAt ? new Date(rawAttempt.completedAt).toISOString() : undefined,
          currentSectionIndex: currentSectionIdx,
          currentQuestionIndex: state?.currentQuestionIndex ?? 0,
          sections,
          tabSwitchCount: rawAttempt.cheatingLogs?.filter((l: any) => l.eventType === 'TAB_SWITCH').length ?? 0,
          isFullScreen: false,
        };
        startAttempt(restoredAttempt, restoredTest);
        setRestoring(false);
      } catch (err: any) {
        console.error('[Resume] Failed to restore attempt:', err);
        setRestoring(false);
        setRestoreError(err?.message ?? 'An unexpected error occurred while restoring your test attempt.');
      }
    }
    restoreAttemptFromBackend();
  }, [attemptIdFromQuery, currentAttempt, startAttempt, navigate]);

  useEffect(() => {
    if (!restoring && !restoreError && !test && !attempt && !attemptIdFromQuery) navigate('/dashboard');
  }, [test, attempt, navigate, restoring, restoreError, attemptIdFromQuery]);

  const currentSectionIdx = attempt?.currentSectionIndex ?? 0;
  const currentQIdx = attempt?.currentQuestionIndex ?? 0;
  const currentSection = test?.sections[currentSectionIdx];
  const currentQuestion = currentSection?.questions[currentQIdx];
  const currentSectionAttempt = attempt && currentSection ? attempt.sections[currentSection.id] : null;
  const currentQAttempt = currentQuestion && currentSectionAttempt ? currentSectionAttempt.questions[currentQuestion.id] : null;

  const sectionTimeSeconds = (currentSection?.timeLimit ?? 45) * 60;

  // Stable expire callback — delegates to ref which is always updated
  const handleTimerExpire = useCallback(() => timerExpireHandlerRef.current(), []);

  const { seconds: timeLeft, reset: resetTimer } = useTimer(
    sectionTimeSeconds - (currentSectionAttempt?.timeUsed ?? 0),
    handleTimerExpire,
  );
  resetTimerRef.current = resetTimer;

  // ── API helpers ──────────────────────────────────────────────────────────────

  const doSectionTransition = async (fromSectionId: string, toSectionIdx: number) => {
    if (!attempt || !test) return;
    try {
      if (!isPreview) {
        await api.submitSection(attempt.id, fromSectionId);
        const result = await api.startSection(attempt.id, test.sections[toSectionIdx].id) as { endTime: number };
        resetTimerRef.current(Math.max(10, Math.floor((result.endTime - Date.now()) / 1000)));
      } else {
        resetTimerRef.current((test.sections[toSectionIdx]?.timeLimit ?? 45) * 60);
      }
    } catch {
      resetTimerRef.current((test.sections[toSectionIdx]?.timeLimit ?? 45) * 60);
    }
  };

  const doFinalSubmit = async () => {
    if (!attempt || !currentSection || !currentQuestion) return;
    const finalAns = currentQuestion.type === 'numeric' ? (parseFloat(numericInput) || null) : selectedAnswer;
    if (!isPreview) {
      // Autosave last question's answer
      api.autosaveAnswer(attempt.id, {
        questionId: currentQuestion.id,
        answerGiven: toDbAnswer(currentQuestion.type, finalAns),
        timeSpentSeconds: currentQAttempt?.timeSpent ?? 0,
        isFlagged: false,
      }).catch(() => {});
      // Submit last section (also triggers score calculation in backend)
      await api.submitSection(attempt.id, currentSection.id).catch(() => {});
    }
    allowNavigationAwayRef.current = true;
    clearAttempt();
    navigate(isPreview ? '/tests' : `/test-review/${attempt.id}`);
  };

  const autosaveAttemptState = useCallback(() => {
    if (!attempt || isPreview) return;
    api.autosaveAnswer(attempt.id, {
      attemptState: {
        currentSectionIndex: attempt.currentSectionIndex,
        currentQuestionIndex: attempt.currentQuestionIndex,
        sections: attempt.sections,
      },
    }).catch(() => {});
  }, [attempt, isPreview]);

  // Update the timer-expire handler every render so it always has fresh state
  timerExpireHandlerRef.current = () => {
    if (!test || !attempt || !currentSection) return;
    if (currentSectionIdx < test.sections.length - 1) {
      advanceSection();
      doSectionTransition(currentSection.id, currentSectionIdx + 1);
    } else {
      doFinalSubmit();
    }
  };
  // Refs for tracking mutable states in event listeners without re-binding
  const attemptRef = useRef(attempt);
  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  const allowNavigationAwayRef = useRef(allowNavigationAway);
  useEffect(() => {
    allowNavigationAwayRef.current = allowNavigationAway;
  }, [allowNavigationAway]);

  // Gate ref to prevent the exit warning modal from being triggered twice
  const exitWarningShownRef = useRef(false);

  // ── Side effects ─────────────────────────────────────────────────────────────

  // Fullscreen — enter once when attempt starts, exit only on unmount
  useEffect(() => {
    if (!attempt?.id) return;
    
    // Only request fullscreen if not already in fullscreen
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFullscreenBlocked(false)).catch(() => setIsFullscreenBlocked(true));
    } else {
      setIsFullscreenBlocked(false);
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreenBlocked(true);
        const currentAttempt = attemptRef.current;
        if (currentAttempt && currentAttempt.id !== 'preview') {
          api.logCheatingEvent(currentAttempt.id, 'FULLSCREEN_EXIT', {
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        }
        if (!allowNavigationAwayRef.current && !exitWarningShownRef.current) {
          exitWarningShownRef.current = true;
          setShowExitWarningModal(true);
        }
      } else {
        setIsFullscreenBlocked(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [attempt?.id, isPreview]);

  useEffect(() => {
    if (!attempt || !currentSection || isPreview) return;
    const sync = () => {
      api.getSectionTimer(attempt.id, currentSection.id)
        .then((r) => resetTimerRef.current(r.remainingSeconds))
        .catch(() => {});
    };
    sync();
    const interval = setInterval(sync, 15000);
    return () => clearInterval(interval);
  }, [attempt?.id, currentSection?.id, isPreview]);

  useEffect(() => {
    if (!attempt) return;
    const interval = setInterval(autosaveAttemptState, 8000);
    const onBeforeUnload = () => autosaveAttemptState();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [attempt?.id, autosaveAttemptState]);

  // Tab switching Tracking
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        recordTabSwitch();
        const currentAttempt = attemptRef.current;
        if (currentAttempt && currentAttempt.id !== 'preview') {
          api.logCheatingEvent(currentAttempt.id, 'TAB_SWITCH', {
            count: (currentAttempt.tabSwitchCount ?? 0) + 1,
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        }
        setTabSwitchWarning(true);
        setTimeout(() => setTabSwitchWarning(false), 3000);
        if (!allowNavigationAwayRef.current && !exitWarningShownRef.current) {
          exitWarningShownRef.current = true;
          setShowExitWarningModal(true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [recordTabSwitch, isPreview]);

  // Inactivity Tracking
  useEffect(() => {
    if (!attempt?.id || isPreview) return;
    let inactivityTimeout: ReturnType<typeof setTimeout>;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(() => {
        const currentAttempt = attemptRef.current;
        if (currentAttempt && currentAttempt.id !== 'preview') {
          api.logCheatingEvent(currentAttempt.id, 'INACTIVITY', {
            timestamp: new Date().toISOString(),
            durationSeconds: 60,
          }).catch(() => {});
        }
      }, 60000);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, resetInactivityTimer));
    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimeout);
      events.forEach(ev => window.removeEventListener(ev, resetInactivityTimer));
    };
  }, [attempt?.id, isPreview]);

  // Copy/Paste and Right-Click Tracking
  useEffect(() => {
    if (!attempt?.id || isPreview) return;

    const handleCopy = () => {
      const currentAttempt = attemptRef.current;
      if (currentAttempt && currentAttempt.id !== 'preview') {
        api.logCheatingEvent(currentAttempt.id, 'SUSPICIOUS_INPUT', {
          type: 'copy',
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }
    };

    const handlePaste = () => {
      const currentAttempt = attemptRef.current;
      if (currentAttempt && currentAttempt.id !== 'preview') {
        api.logCheatingEvent(currentAttempt.id, 'SUSPICIOUS_INPUT', {
          type: 'paste',
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const currentAttempt = attemptRef.current;
      if (currentAttempt && currentAttempt.id !== 'preview') {
        api.logCheatingEvent(currentAttempt.id, 'SUSPICIOUS_INPUT', {
          type: 'right_click',
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [attempt?.id, isPreview]);

  useEffect(() => {
    questionTimerRef.current = setInterval(() => {}, 1000);
    return () => { if (questionTimerRef.current) clearInterval(questionTimerRef.current); };
  }, [currentQIdx, currentSectionIdx]);

  useEffect(() => {
    if (currentQAttempt) {
      const ans = currentQAttempt.selectedAnswer;
      setSelectedAnswer(ans ?? null);
      setNumericInput(typeof ans === 'number' ? String(ans) : '');
    } else {
      setSelectedAnswer(null);
      setNumericInput('');
    }
  }, [currentQuestion?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading & Error views for resume ────────────────────────────────────────
  if (restoring) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm bg-white p-8 rounded-2xl border border-slate-200 shadow-md">
          <Loader2 size={36} className="text-blue-600 animate-spin mx-auto" />
          <h3 className="font-semibold text-slate-800 text-base">Resuming Test Attempt…</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Restoring your progress, question palette, and remaining time from our server safely.
          </p>
        </div>
      </div>
    );
  }

  if (restoreError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md bg-white p-8 rounded-2xl border border-red-100 shadow-md">
          <AlertTriangle size={36} className="text-red-500 mx-auto" />
          <h3 className="font-semibold text-slate-800 text-base">Failed to Resume Test</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{restoreError}</p>
          <div className="pt-2">
            <Button onClick={() => navigate('/dashboard')} size="sm" variant="secondary" className="px-6">
              Go back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!test || !attempt || !currentSection || !currentQuestion) return null;

  const totalQInSection = currentSection.questions.length;
  const isLastQuestion = currentQIdx === totalQInSection - 1;
  const isLastSection = currentSectionIdx === test.sections.length - 1;

  const getQuestionState = (sectionId: string, qId: string): QuestionState =>
    attempt.sections[sectionId]?.questions[qId]?.state ?? 'not_visited';

  const saveAndNavigate = async (nextQIdx: number, nextSectionIdx?: number) => {
    if (!currentSection) return;
    const finalAns = currentQuestion.type === 'numeric' ? (parseFloat(numericInput) || null) : selectedAnswer;
    const hasAnswer = finalAns !== null && finalAns !== '' && !(Array.isArray(finalAns) && finalAns.length === 0);
    const prevState = getQuestionState(currentSection.id, currentQuestion.id);
    const newState: QuestionState = hasAnswer
      ? (prevState === 'marked_review' || prevState === 'answered_marked' ? 'answered_marked' : 'answered')
      : (prevState === 'marked_review' || prevState === 'answered_marked' ? 'marked_review' : 'not_answered');

    updateQuestionState(currentSection.id, currentQuestion.id, newState, finalAns as any);

    // Autosave to Redis
    if (!isPreview) {
      api.autosaveAnswer(attempt.id, {
        questionId: currentQuestion.id,
        answerGiven: toDbAnswer(currentQuestion.type, finalAns),
        timeSpentSeconds: currentQAttempt?.timeSpent ?? 0,
        isFlagged: newState === 'marked_review' || newState === 'answered_marked',
        attemptState: {
          currentSectionIndex: nextSectionIdx ?? currentSectionIdx,
          currentQuestionIndex: nextSectionIdx !== undefined ? 0 : nextQIdx,
          sections: attempt.sections,
        },
      }).catch(() => {});
    }

    if (nextSectionIdx !== undefined) {
      advanceSection();
      doSectionTransition(currentSection.id, nextSectionIdx);
    } else {
      navigateToQuestion(currentSectionIdx, nextQIdx);
    }
  };

  const markForReview = () => {
    if (!currentSection) return;
    const finalAns = currentQuestion.type === 'numeric' ? (parseFloat(numericInput) || null) : selectedAnswer;
    const hasAnswer = finalAns !== null && finalAns !== '';
    updateQuestionState(currentSection.id, currentQuestion.id, hasAnswer ? 'answered_marked' : 'marked_review', finalAns as any);
    if (!isPreview) {
      api.autosaveAnswer(attempt.id, {
        questionId: currentQuestion.id,
        answerGiven: toDbAnswer(currentQuestion.type, finalAns),
        timeSpentSeconds: currentQAttempt?.timeSpent ?? 0,
        isFlagged: true,
        attemptState: {
          currentSectionIndex: currentSectionIdx,
          currentQuestionIndex: currentQIdx,
          sections: attempt.sections,
        },
      }).catch(() => {});
    }
    if (!isLastQuestion) navigateToQuestion(currentSectionIdx, currentQIdx + 1);
  };

  const pct = Math.round(((sectionTimeSeconds - timeLeft) / sectionTimeSeconds) * 100);
  const isLowTime = timeLeft < 300;

  const answeredCount = Object.values(currentSectionAttempt?.questions ?? {}).filter(
    (q) => q.state === 'answered' || q.state === 'answered_marked'
  ).length;
  const markedCount = Object.values(currentSectionAttempt?.questions ?? {}).filter(
    (q) => q.state === 'marked_review' || q.state === 'answered_marked'
  ).length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 md:pr-52">
      {tabSwitchWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium whitespace-nowrap">
          <AlertTriangle size={15} /> Tab switch detected! Logged.
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-800 text-white px-3 md:px-4 py-2.5 md:py-3">
        <div className="max-w-[95vw] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div className="w-7 h-7 md:w-8 md:h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xs md:text-sm flex-shrink-0">A</div>
            <div className="hidden sm:block min-w-0">
              <p className="text-xs text-slate-400">Candidate</p>
              <p className="text-sm font-medium truncate max-w-32 md:max-w-none">{user?.name}</p>
            </div>
          </div>
          <div className="text-center hidden md:block min-w-0 flex-1 px-4">
            <p className="text-xs text-slate-400">Test</p>
            <p className="text-sm font-medium truncate">{test.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPalette(!showPalette)}
              className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 rounded-lg text-xs font-medium">
              <Grid3X3 size={13} />
              <span>{answeredCount}/{totalQInSection}</span>
            </button>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-sm md:text-base font-bold ${isLowTime ? 'bg-red-600 animate-pulse' : 'bg-slate-700'}`}>
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>
      </header>

      {/* Section tabs */}
      <div className="bg-white border-b border-slate-200 px-3 md:px-4">
        <div className="max-w-[95vw] mx-auto flex gap-1 overflow-x-auto py-2 scrollbar-hide">
          {test.sections.map((sec, idx) => (
            <div key={sec.id} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
              idx === currentSectionIdx ? 'bg-blue-600 text-white' :
              idx < currentSectionIdx ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              'bg-slate-100 text-slate-500'
            }`}>
              {sec.name}
            </div>
          ))}
        </div>
        <div className="max-w-[95vw] mx-auto pb-2">
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isLowTime ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-[95vw] mx-auto w-full gap-3 md:gap-4 p-3 md:p-4 min-h-0">
        {currentQuestion.parentQuestionText ? (
          <div className="flex-1 flex flex-col lg:flex-row gap-4 min-w-0">
            {/* Passage Panel (Left) */}
            <aside className="lg:w-[60%] w-full bg-white rounded-xl md:rounded-2xl border border-slate-200 p-3 md:p-4 flex flex-col min-w-0 shadow-sm" aria-label="Passage">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 border-b border-slate-100 pb-2">Reading Passage</h3>
              <div className="overflow-y-auto flex-1 text-left" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                <div className="prose prose-slate max-w-none text-slate-800 leading-relaxed text-sm md:text-base">
                  <RichContentRenderer content={currentQuestion.parentQuestionText} variant="question" />
                </div>
              </div>
            </aside>

            {/* Question Panel (Right) */}
            <main className="lg:w-[40%] w-full bg-white rounded-xl md:rounded-2xl border border-slate-200 p-4 md:p-5 flex flex-col min-w-0 shadow-sm" aria-label="Question">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-500">Q {currentQIdx + 1}</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-sm text-slate-400">{totalQInSection}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {currentQAttempt?.timeSpent && currentQAttempt.timeSpent > 0 && (
                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{currentQAttempt.timeSpent}s</span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                    currentQuestion.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700' :
                    currentQuestion.difficulty === 'medium' ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-700'
                  }`}>{currentQuestion.difficulty}</span>
                  {currentQuestion.topic && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{currentQuestion.topic}</span>
                  )}
                </div>
              </div>

              <div className="text-base md:text-lg text-slate-900 leading-relaxed mb-4 md:mb-5 flex-shrink-0 text-left font-semibold">
                <RichContentRenderer content={currentQuestion.text || `Question ${currentQIdx + 1}`} variant="question" />
              </div>

              {/* MCQ options */}
              {(currentQuestion.type === 'mcq_single' || currentQuestion.type === 'mcq_multi') && currentQuestion.options && (
                <div className="space-y-3 flex-shrink-0 text-left">
                  {currentQuestion.options.map((opt) => {
                    const isSelected = currentQuestion.type === 'mcq_multi'
                      ? Array.isArray(selectedAnswer) && selectedAnswer.includes(opt.id)
                      : selectedAnswer === opt.id;
                    return (
                      <OptionRenderer
                        key={opt.id}
                        label={opt.id.toUpperCase()}
                        text={opt.text}
                        isSelected={isSelected}
                        onClick={() => {
                          if (currentQuestion.type === 'mcq_multi') {
                            const curr = Array.isArray(selectedAnswer) ? selectedAnswer as string[] : [];
                            setSelectedAnswer(curr.includes(opt.id) ? curr.filter((x) => x !== opt.id) : [...curr, opt.id]);
                          } else {
                            setSelectedAnswer(opt.id);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Numeric */}
              {currentQuestion.type === 'numeric' && (
                <div className="text-left">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Enter your answer:</label>
                  <input type="number" value={numericInput} onChange={(e) => setNumericInput(e.target.value)}
                    placeholder="Type numeric answer"
                    className="w-40 md:w-48 px-4 py-3 border-2 border-slate-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 transition-all" />
                </div>
              )}
            </main>
          </div>
        ) : (
          /* Question area (Standard Layout) */
          <div className="flex-1 flex flex-col gap-3 md:gap-4 min-w-0">
            <div className="bg-white rounded-xl md:rounded-2xl border border-slate-200 p-4 md:p-6 flex-1 shadow-sm text-left">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-500">Q {currentQIdx + 1}</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-sm text-slate-400">{totalQInSection}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {currentQAttempt?.timeSpent && currentQAttempt.timeSpent > 0 && (
                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{currentQAttempt.timeSpent}s</span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                    currentQuestion.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700' :
                    currentQuestion.difficulty === 'medium' ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-700'
                  }`}>{currentQuestion.difficulty}</span>
                  {currentQuestion.topic && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg hidden sm:inline">{currentQuestion.topic}</span>
                  )}
                </div>
              </div>

              <div className="text-sm md:text-base text-slate-900 leading-relaxed mb-5 md:mb-6">
                <RichContentRenderer content={currentQuestion.text || `Question ${currentQIdx + 1}`} variant="question" />
              </div>

              {/* MCQ options */}
              {(currentQuestion.type === 'mcq_single' || currentQuestion.type === 'mcq_multi') && currentQuestion.options && (
                <div className="space-y-2">
                  {currentQuestion.options.map((opt) => {
                    const isSelected = currentQuestion.type === 'mcq_multi'
                      ? Array.isArray(selectedAnswer) && selectedAnswer.includes(opt.id)
                      : selectedAnswer === opt.id;
                    return (
                      <OptionRenderer
                        key={opt.id}
                        label={opt.id.toUpperCase()}
                        text={opt.text}
                        isSelected={isSelected}
                        onClick={() => {
                          if (currentQuestion.type === 'mcq_multi') {
                            const curr = Array.isArray(selectedAnswer) ? selectedAnswer as string[] : [];
                            setSelectedAnswer(curr.includes(opt.id) ? curr.filter((x) => x !== opt.id) : [...curr, opt.id]);
                          } else {
                            setSelectedAnswer(opt.id);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Numeric */}
              {currentQuestion.type === 'numeric' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Enter your answer:</label>
                  <input type="number" value={numericInput} onChange={(e) => setNumericInput(e.target.value)}
                    placeholder="Type numeric answer"
                    className="w-40 md:w-48 px-4 py-3 border-2 border-slate-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 transition-all" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action buttons — always rendered below question area */}
        <div className="max-w-[95vw] mx-auto w-full px-3 md:px-4 pb-3 md:pb-4">
          <div className="bg-white rounded-xl md:rounded-2xl border border-slate-200 p-3 md:p-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setSelectedAnswer(null); setNumericInput(''); }}>
                  Clear
                </Button>
                <Button size="sm" icon={<Flag size={12} />} onClick={markForReview}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs md:text-sm">
                  <span className="hidden sm:inline">Mark Review</span>
                  <span className="sm:hidden">Flag</span>
                </Button>
              </div>
              <div className="flex gap-1.5 md:gap-2">
                <Button variant="secondary" size="sm" icon={<ChevronLeft size={12} />}
                  disabled={currentQIdx === 0}
                  onClick={() => navigateToQuestion(currentSectionIdx, currentQIdx - 1)}>
                  <span className="hidden sm:inline">Back</span>
                </Button>
                {isLastQuestion && isLastSection ? (
                  <Button size="sm" variant="success" icon={<Send size={12} />} onClick={() => setShowSubmitModal(true)}>
                    Submit
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => {
                    if (isLastQuestion) saveAndNavigate(0, currentSectionIdx + 1);
                    else saveAndNavigate(currentQIdx + 1);
                  }}>
                    Save & Next <ChevronRight size={12} className="ml-0.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop palette — fixed right sidebar */}
      <div className="hidden md:block fixed right-4 top-1/4 w-44 z-10">
        <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-lg">
          <h3 className="text-sm font-semibold text-slate-700 mb-2 truncate">{currentSection.name}</h3>
          <div className="grid grid-cols-2 gap-1 mb-2 text-xs">
            {[
              { color: 'bg-slate-200', label: 'Not Visited' },
              { color: 'bg-red-500', label: 'Not Answered' },
              { color: 'bg-emerald-500', label: 'Answered' },
              { color: 'bg-purple-500', label: 'Marked' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`} />
                <span className="text-slate-500 text-xs leading-tight">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1 max-h-64 overflow-y-auto">
            {currentSection.questions.map((q, idx) => {
              const state = getQuestionState(currentSection.id, q.id);
              const isActive = idx === currentQIdx;
              return (
                <button key={q.id} onClick={() => navigateToQuestion(currentSectionIdx, idx)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${stateColors[state]} ${isActive ? 'ring-2 ring-offset-1 ring-slate-500 scale-105' : ''}`}>
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Answered', color: 'text-emerald-600', count: answeredCount },
              { label: 'Marked', color: 'text-purple-600', count: markedCount },
              { label: 'Not Ans.', color: 'text-red-500', count: Object.values(currentSectionAttempt?.questions ?? {}).filter((q) => q.state === 'not_answered').length },
              { label: 'Unvisited', color: 'text-slate-500', count: Object.values(currentSectionAttempt?.questions ?? {}).filter((q) => q.state === 'not_visited').length },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.count}</p>
                <p className="text-slate-400 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile palette drawer */}
      {showPalette && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPalette(false)} />
          <div className="relative bg-white rounded-t-2xl w-full p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">{currentSection.name} — Question Palette</h3>
              <button onClick={() => setShowPalette(false)} className="text-slate-400 text-lg">✕</button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              {[
                { color: 'bg-slate-200', label: 'Not Visited' },
                { color: 'bg-red-500', label: 'Not Answered' },
                { color: 'bg-emerald-500', label: 'Answered' },
                { color: 'bg-purple-500', label: 'Marked' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-slate-500">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
              {currentSection.questions.map((q, idx) => {
                const state = getQuestionState(currentSection.id, q.id);
                const isActive = idx === currentQIdx;
                return (
                  <button key={q.id} onClick={() => { navigateToQuestion(currentSectionIdx, idx); setShowPalette(false); }}
                    className={`h-9 rounded-lg text-xs font-bold transition-all ${stateColors[state]} ${isActive ? 'ring-2 ring-slate-500' : ''}`}>
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Submit modal */}
      <Modal isOpen={showSubmitModal} onClose={() => setShowSubmitModal(false)} title="Submit Test" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowSubmitModal(false)}>Review</Button>
            <Button variant="success" size="sm" icon={<Send size={14} />} onClick={doFinalSubmit}>Submit Final</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700">Review your test summary before submitting:</p>
          {test.sections.map((sec) => {
            const secAtt = attempt.sections[sec.id];
            const answered = Object.values(secAtt?.questions ?? {}).filter((q) => q.state === 'answered' || q.state === 'answered_marked').length;
            return (
              <div key={sec.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-medium text-slate-700">{sec.name}</span>
                <span className={`text-sm font-bold ${answered === sec.questions.length ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {answered}/{sec.questions.length}
                </span>
              </div>
            );
          })}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            Once submitted, you cannot change your answers.
          </div>
        </div>
      </Modal>

      {/* Fullscreen blocker overlay */}
      {isFullscreenBlocked && !showExitWarningModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl max-w-md w-full text-center space-y-4 shadow-2xl">
            <AlertTriangle size={48} className="text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-slate-900">Fullscreen Required</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              To start or resume your exam, you must enter fullscreen mode. Escaping fullscreen may be logged as a suspicious activity.
            </p>
            <Button size="lg" className="w-full mt-4" onClick={() => {
              document.documentElement.requestFullscreen?.().catch(() => {});
              setIsFullscreenBlocked(false);
            }}>
              Enter Fullscreen & Resume Test
            </Button>
          </div>
        </div>
      )}

      {/* Exit Warning Modal */}
      <Modal isOpen={showExitWarningModal} onClose={() => {}} title="Warning: Suspicious Activity Detected" size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex gap-3 text-red-800 text-sm">
            <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Are you sure you want to exit fullscreen or navigate away?</p>
              <p>This activity has been recorded as a suspicious behavior.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="danger" size="sm" onClick={() => {
              // Set ref immediately so useBlocker and event handlers see it synchronously
              allowNavigationAwayRef.current = true;
              setAllowNavigationAway(true);
              setShowExitWarningModal(false);
              clearAttempt();
              // Exit fullscreen first if active
              if (document.fullscreenElement) {
                document.exitFullscreen?.().catch(() => {});
              }
              if (blocker.state === 'blocked') {
                blocker.proceed();
              } else {
                navigate(isPreview ? '/tests' : '/dashboard');
              }
            }}>
              Exit Anyway
            </Button>
            <Button variant="primary" size="sm" onClick={() => {
              exitWarningShownRef.current = false;
              setShowExitWarningModal(false);
              setIsFullscreenBlocked(false);
              document.documentElement.requestFullscreen?.().catch(() => {});
              if (blocker.state === 'blocked') {
                blocker.reset();
              }
            }}>
              Continue Test
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
