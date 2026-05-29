import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams, useBlocker } from 'react-router-dom';
import { Bookmark, ChevronLeft, ChevronRight, Send, AlertTriangle, X, Loader2 } from 'lucide-react';
import { useTestStore } from '../../store/useTestStore';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { RichContentRenderer } from '../../components/admin/RichContentRenderer';
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
  not_visited:    'bg-white border border-gray-300 text-gray-600',
  not_answered:   'bg-white border border-gray-300 text-gray-400',
  answered:       'bg-[#1b3d6e] text-white border border-[#1b3d6e]',
  marked_review:  'bg-white border-2 border-amber-500 text-amber-700',
  answered_marked:'bg-[#1b3d6e] text-white border-2 border-amber-400',
};

// ─── Bluebook-style option ────────────────────────────────────────────────────

function BluebookOption({
  label, text, isSelected, onClick,
}: { label: string; text: string; isSelected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all select-none
        ${isSelected
          ? 'border-[#1b3d6e] bg-blue-50'
          : 'border-gray-200 hover:border-gray-400 bg-white'}`}
    >
      <div className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-bold mt-0.5 transition-all
        ${isSelected
          ? 'bg-[#1b3d6e] border-[#1b3d6e] text-white'
          : 'bg-white border-gray-400 text-gray-600'}`}>
        {label}
      </div>
      <div className="flex-1 text-gray-800 text-[15px] leading-relaxed pt-0.5">
        <RichContentRenderer content={text} variant="option" />
      </div>
    </div>
  );
}

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
  const currentQState = getQuestionState(currentSection.id, currentQuestion.id);
  const isMarked = currentQState === 'marked_review' || currentQState === 'answered_marked';

  const answeredCount = Object.values(currentSectionAttempt?.questions ?? {}).filter(
    (q) => q.state === 'answered' || q.state === 'answered_marked'
  ).length;

  const renderOptions = (opts: typeof currentQuestion.options, type: string, answer: typeof selectedAnswer) => {
    if (!opts) return null;
    return (
      <div className="space-y-2.5">
        {opts.map((opt) => {
          const isSelected = type === 'mcq_multi'
            ? Array.isArray(answer) && answer.includes(opt.id)
            : answer === opt.id;
          return (
            <BluebookOption
              key={opt.id}
              label={opt.id.toUpperCase()}
              text={opt.text}
              isSelected={isSelected}
              onClick={() => {
                if (type === 'mcq_multi') {
                  const curr = Array.isArray(answer) ? answer as string[] : [];
                  setSelectedAnswer(curr.includes(opt.id) ? curr.filter((x) => x !== opt.id) : [...curr, opt.id]);
                } else {
                  setSelectedAnswer(isSelected ? null : opt.id);
                }
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">

      {/* Tab switch toast */}
      {tabSwitchWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 text-sm font-medium whitespace-nowrap">
          <AlertTriangle size={14} /> Tab switch detected — logged
        </div>
      )}

      {/* ── TOP BAR ──────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-5 h-14 flex items-center justify-between z-10">
        {/* Exit */}
        <button
          onClick={() => setShowExitWarningModal(true)}
          className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          Exit
        </button>

        {/* Center: test + section */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none select-none">
          <p className="text-[11px] text-gray-400 leading-none tracking-wide">{test.title}</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5 leading-none">{currentSection.name}</p>
        </div>

        {/* Right: timer + palette */}
        <div className="flex items-center gap-3">
          <span className={`text-base font-mono font-semibold tabular-nums ${isLowTime ? 'text-red-600' : 'text-gray-900'}`}>
            {formatTime(timeLeft)}
          </span>
          <button
            onClick={() => setShowPalette(true)}
            className="text-sm font-medium text-gray-700 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors"
          >
            Question {currentQIdx + 1} of {totalQInSection}
          </button>
        </div>
      </header>

      {/* Thin section + progress strip */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 py-2 flex items-center gap-4">
        {test.sections.map((sec, idx) => (
          <div key={sec.id} className={`flex items-center gap-1.5 text-xs font-medium ${
            idx === currentSectionIdx ? 'text-[#1b3d6e]' :
            idx < currentSectionIdx ? 'text-emerald-600' : 'text-gray-400'
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              idx === currentSectionIdx ? 'bg-[#1b3d6e]' :
              idx < currentSectionIdx ? 'bg-emerald-500' : 'border border-gray-300 bg-white'
            }`} />
            {sec.name}
          </div>
        ))}
        <div className="flex-1 h-0.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${isLowTime ? 'bg-red-500' : 'bg-[#1b3d6e]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-[#f7f8fa]">
        {currentQuestion.parentQuestionText ? (
          /* Passage layout */
          <div className="flex h-full min-h-full divide-x divide-gray-200">
            {/* Left: Passage */}
            <div className="w-1/2 overflow-y-auto p-8 bg-white">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Reading Passage</p>
              <div className="prose prose-gray max-w-none text-gray-800 text-[15px] leading-relaxed">
                <RichContentRenderer content={currentQuestion.parentQuestionText} variant="question" />
              </div>
            </div>
            {/* Right: Question */}
            <div className="w-1/2 overflow-y-auto p-8 bg-[#f7f8fa]">
              <p className="text-xs text-gray-500 mb-5 font-medium">
                Question {currentQIdx + 1} of {totalQInSection}
              </p>
              <div className="text-[15px] text-gray-900 leading-relaxed mb-6">
                <RichContentRenderer content={currentQuestion.text || `Question ${currentQIdx + 1}`} variant="question" />
              </div>
              {(currentQuestion.type === 'mcq_single' || currentQuestion.type === 'mcq_multi') &&
                renderOptions(currentQuestion.options, currentQuestion.type, selectedAnswer)}
              {currentQuestion.type === 'numeric' && (
                <div>
                  <p className="text-sm text-gray-600 mb-2 font-medium">Enter your answer:</p>
                  <input type="number" value={numericInput} onChange={(e) => setNumericInput(e.target.value)}
                    placeholder="0"
                    className="w-40 px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-mono focus:outline-none focus:border-[#1b3d6e] transition-colors bg-white" />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Standard layout */
          <div className="max-w-3xl mx-auto px-6 py-10">
            <p className="text-xs text-gray-500 mb-6 font-medium">
              Question {currentQIdx + 1} of {totalQInSection}
              {currentQuestion.topic && <span className="ml-3 text-gray-400">· {currentQuestion.topic}</span>}
            </p>
            <div className="text-[16px] text-gray-900 leading-relaxed mb-8 font-normal">
              <RichContentRenderer content={currentQuestion.text || `Question ${currentQIdx + 1}`} variant="question" />
            </div>
            {(currentQuestion.type === 'mcq_single' || currentQuestion.type === 'mcq_multi') &&
              renderOptions(currentQuestion.options, currentQuestion.type, selectedAnswer)}
            {currentQuestion.type === 'numeric' && (
              <div>
                <p className="text-sm text-gray-600 mb-2 font-medium">Enter your answer:</p>
                <input type="number" value={numericInput} onChange={(e) => setNumericInput(e.target.value)}
                  placeholder="0"
                  className="w-40 px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-mono focus:outline-none focus:border-[#1b3d6e] transition-colors bg-white" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── BOTTOM TOOLBAR ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-5 h-14 flex items-center justify-between z-10">
        {/* Mark for Review */}
        <button
          onClick={markForReview}
          className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
            isMarked
              ? 'text-amber-600 bg-amber-50 border border-amber-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Bookmark size={15} fill={isMarked ? 'currentColor' : 'none'} />
          Mark for Review
        </button>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            disabled={currentQIdx === 0}
            onClick={() => navigateToQuestion(currentSectionIdx, currentQIdx - 1)}
            className="flex items-center gap-1 px-5 py-2 text-sm font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={15} /> Back
          </button>
          {isLastQuestion && isLastSection ? (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-[#1b3d6e] text-white rounded-md hover:bg-[#15305a] transition-colors"
            >
              <Send size={13} /> Submit
            </button>
          ) : (
            <button
              onClick={() => isLastQuestion ? saveAndNavigate(0, currentSectionIdx + 1) : saveAndNavigate(currentQIdx + 1)}
              className="flex items-center gap-1 px-5 py-2 text-sm font-semibold bg-[#1b3d6e] text-white rounded-md hover:bg-[#15305a] transition-colors"
            >
              Next <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── QUESTION PALETTE MODAL ───────────────────────────────────────────── */}
      {showPalette && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowPalette(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Palette header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{currentSection.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{answeredCount} of {totalQInSection} answered</p>
              </div>
              <button onClick={() => setShowPalette(false)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500">
                <X size={18} />
              </button>
            </div>
            {/* Legend */}
            <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-3">
              {[
                { cls: 'bg-white border border-gray-300', label: 'Not visited' },
                { cls: 'bg-[#1b3d6e]', label: 'Answered' },
                { cls: 'bg-white border-2 border-amber-500', label: 'Marked' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <div className={`w-5 h-5 rounded-full ${item.cls} flex-shrink-0`} />
                  {item.label}
                </div>
              ))}
            </div>
            {/* Grid */}
            <div className="p-5 grid grid-cols-8 gap-2 max-h-64 overflow-y-auto">
              {currentSection.questions.map((q, idx) => {
                const state = getQuestionState(currentSection.id, q.id);
                const isActive = idx === currentQIdx;
                return (
                  <button
                    key={q.id}
                    onClick={() => { navigateToQuestion(currentSectionIdx, idx); setShowPalette(false); }}
                    className={`w-9 h-9 rounded-full text-xs font-semibold transition-all ${stateColors[state]} ${isActive ? 'ring-2 ring-offset-1 ring-[#1b3d6e] scale-110' : ''}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            {/* Stats row */}
            <div className="px-5 py-3 border-t border-gray-100 grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Answered', count: answeredCount, color: 'text-[#1b3d6e]' },
                { label: 'Marked', count: Object.values(currentSectionAttempt?.questions ?? {}).filter((q) => q.state === 'marked_review' || q.state === 'answered_marked').length, color: 'text-amber-600' },
                { label: 'Skipped', count: Object.values(currentSectionAttempt?.questions ?? {}).filter((q) => q.state === 'not_answered').length, color: 'text-gray-500' },
                { label: 'Unseen', count: Object.values(currentSectionAttempt?.questions ?? {}).filter((q) => q.state === 'not_visited').length, color: 'text-gray-400' },
              ].map((s) => (
                <div key={s.label}>
                  <p className={`text-base font-bold ${s.color}`}>{s.count}</p>
                  <p className="text-[11px] text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMIT MODAL ─────────────────────────────────────────────────────── */}
      <Modal isOpen={showSubmitModal} onClose={() => setShowSubmitModal(false)} title="Submit Test" size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowSubmitModal(false)}>Go Back</Button>
            <Button variant="success" size="sm" icon={<Send size={14} />} onClick={doFinalSubmit}>Submit</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">You're about to submit. Review your section totals:</p>
          {test.sections.map((sec) => {
            const secAtt = attempt.sections[sec.id];
            const answered = Object.values(secAtt?.questions ?? {}).filter((q) => q.state === 'answered' || q.state === 'answered_marked').length;
            const total = sec.questions.length;
            return (
              <div key={sec.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{sec.name}</span>
                <span className={`text-sm font-bold ${answered === total ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {answered}/{total}
                </span>
              </div>
            );
          })}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            Once submitted, you cannot change your answers.
          </div>
        </div>
      </Modal>

      {/* ── FULLSCREEN BLOCKER ────────────────────────────────────────────────── */}
      {isFullscreenBlocked && !showExitWarningModal && (
        <div className="fixed inset-0 z-[100] bg-gray-900/95 flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl max-w-md w-full text-center space-y-4 shadow-2xl">
            <AlertTriangle size={44} className="text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Fullscreen Required</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              This exam must be taken in fullscreen mode. Exiting fullscreen is logged as a security event.
            </p>
            <button
              className="w-full mt-2 py-3 bg-[#1b3d6e] text-white rounded-lg font-semibold text-sm hover:bg-[#15305a] transition-colors"
              onClick={() => {
                document.documentElement.requestFullscreen?.().catch(() => {});
                setIsFullscreenBlocked(false);
              }}
            >
              Enter Fullscreen & Continue
            </button>
          </div>
        </div>
      )}

      {/* ── EXIT WARNING MODAL ────────────────────────────────────────────────── */}
      <Modal isOpen={showExitWarningModal} onClose={() => {}} title="Leave Exam?" size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex gap-3 text-red-800 text-sm">
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">This activity has been flagged.</p>
              <p className="text-red-700 text-xs">Exiting fullscreen or navigating away is recorded as suspicious behavior.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => {
              exitWarningShownRef.current = false;
              setShowExitWarningModal(false);
              setIsFullscreenBlocked(false);
              document.documentElement.requestFullscreen?.().catch(() => {});
              if (blocker.state === 'blocked') blocker.reset();
            }}>
              Continue Test
            </Button>
            <Button variant="danger" size="sm" onClick={() => {
              allowNavigationAwayRef.current = true;
              setAllowNavigationAway(true);
              setShowExitWarningModal(false);
              clearAttempt();
              if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
              if (blocker.state === 'blocked') blocker.proceed();
              else navigate(isPreview ? '/tests' : '/dashboard');
            }}>
              Exit Anyway
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
