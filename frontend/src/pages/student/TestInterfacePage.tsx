import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams, useBlocker } from 'react-router-dom';
import { Bookmark, ChevronUp, ChevronDown, Send, AlertTriangle, X, Loader2, Calculator, BookOpen, PencilLine, MoreVertical, Highlighter } from 'lucide-react';
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

// Bluebook-style square button colours (active state handled separately)
const stateColors: Record<QuestionState, string> = {
  not_visited:    'bg-white border border-[#1b3d6e] text-[#1b3d6e]',
  not_answered:   'bg-white border border-dashed border-[#1b3d6e] text-[#1b3d6e]',
  answered:       'bg-[#1b3d6e] text-white border border-[#1b3d6e]',
  marked_review:  'bg-white border-2 border-red-500 text-red-600',
  answered_marked:'bg-[#1b3d6e] text-white border border-[#1b3d6e]',
};

// ─── Bluebook-style option with elimination ───────────────────────────────────

function BluebookOption({
  label, text, isSelected, isEliminated, onClick, onEliminate,
}: {
  label: string; text: string; isSelected: boolean; isEliminated: boolean;
  onClick: () => void; onEliminate: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-stretch gap-2">
      {/* Option body */}
      <div
        onClick={isEliminated ? undefined : onClick}
        className={`group flex-1 flex items-start gap-3 px-4 py-3 rounded-xl border transition-all select-none
          ${isEliminated
            ? 'border-gray-200 bg-white cursor-default'
            : isSelected
              ? 'border-[#1b3d6e] border-2 bg-white cursor-pointer'
              : 'border-gray-300 hover:border-gray-400 bg-white cursor-pointer'}`}
      >
        {/* Letter circle */}
        <div className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold transition-all
          ${isEliminated
            ? 'border-gray-300 bg-white text-gray-400'
            : isSelected
              ? 'bg-[#1b3d6e] border-[#1b3d6e] text-white'
              : 'bg-white border-gray-500 text-gray-700'}`}>
          <span className={isEliminated ? 'line-through decoration-gray-400' : ''}>{label}</span>
        </div>
        <div className={`flex-1 text-[15px] leading-relaxed pt-0.5 transition-all
          ${isEliminated ? 'line-through text-gray-400 decoration-gray-400' : 'text-gray-900'}`}>
          <RichContentRenderer content={text} variant="option" />
        </div>
      </div>

      {/* Far-right cross-out / undo control (Bluebook style) */}
      <div className="flex-shrink-0 flex items-center">
        {isEliminated ? (
          <button
            onClick={onEliminate}
            title="Undo"
            className="text-xs font-semibold text-[#1b3d6e] underline px-1.5"
          >
            Undo
          </button>
        ) : (
          <button
            onClick={onEliminate}
            title="Cross out this answer"
            className="relative inline-flex items-center justify-center w-6 h-6 rounded-full border border-gray-500 text-gray-600 text-[11px] font-bold hover:bg-gray-50 transition-colors"
          >
            {label}
            <span className="absolute left-0.5 right-0.5 top-1/2 -translate-y-1/2 h-[1.5px] bg-gray-600" />
          </button>
        )}
      </div>
    </div>
  );
}

// Deterministic confetti pieces for the "You're All Finished!" screen
const CONFETTI = Array.from({ length: 70 }, (_, i) => {
  const colors = ['#f6c945', '#ec4899', '#22d3ee', '#a78bfa', '#f87171', '#ffffff', '#34d399'];
  return {
    left: (i * 37) % 100,
    top: (i * 53) % 100,
    color: colors[i % colors.length],
    size: 5 + (i % 4) * 2,
    rot: (i * 47) % 360,
    round: i % 3 === 0,
  };
});

// ─── Component ────────────────────────────────────────────────────────────────

export function TestInterfacePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentAttempt, activeTest, startAttempt, updateQuestionState, updateTimeSpent, navigateToQuestion, advanceSection, recordTabSwitch, clearAttempt } = useTestStore();
  const { user } = useAuthStore();

  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | number | Record<string, any> | null>(null);
  const [eliminatedOptions, setEliminatedOptions] = useState<Set<string>>(new Set());
  const [numericInput, setNumericInput] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [breakSeconds, setBreakSeconds] = useState(600);
  const pendingNextSectionIdxRef = useRef<number | null>(null);
  const breakEndHandlerRef = useRef<() => void>(() => {});
  const [finished, setFinished] = useState(false);
  const [finishedAttemptId, setFinishedAttemptId] = useState<string | null>(null);
  const [timerHidden, setTimerHidden] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [tabSwitchWarning, setTabSwitchWarning] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcMode, setCalcMode] = useState<'graphing' | 'scientific'>('graphing');
  const [calcSize, setCalcSize] = useState({ width: 800, height: 550 });
  const [showReference, setShowReference] = useState(false);
  const [showHighlightsNotes, setShowHighlightsNotes] = useState(false);
  const [questionNotes, setQuestionNotes] = useState<Record<string, string>>({});
  const [questionHighlights, setQuestionHighlights] = useState<Record<string, string>>({});
  const [highlightTooltip, setHighlightTooltip] = useState<{ x: number; y: number } | null>(null);
  const [calcPos, setCalcPos] = useState(() => {
    const width = 800;
    const x = Math.max(20, window.innerWidth - width - 40);
    const y = 80;
    return { x, y };
  });
  const [isInteractingWithCalc, setIsInteractingWithCalc] = useState(false);
  const calcDragging = useRef(false);
  const calcDragOffset = useRef({ x: 0, y: 0 });
  const calcResizing = useRef(false);
  const calcResizeStart = useRef({ x: 0, y: 0, width: 800, height: 550 });
  const passageRef = useRef<HTMLDivElement>(null);
  const questionTextRef = useRef<HTMLDivElement>(null);
  const highlightPendingRef = useRef<{ container: HTMLDivElement; key: string } | null>(null);
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

    // Show a 10-minute break when crossing from a non-Math section into a Math section
    const prevName = test.sections[toSectionIdx - 1]?.name ?? '';
    const nextName = test.sections[toSectionIdx]?.name ?? '';
    const needsBreak = !/math/i.test(prevName) && /math/i.test(nextName);

    if (needsBreak) {
      pendingNextSectionIdxRef.current = toSectionIdx;
      setBreakSeconds(600);
      setShowBreak(true);
      // Submit the finished section in the background so it's ready when break ends
      if (!isPreview) {
        api.submitSection(attempt.id, fromSectionId).catch(() => {});
      }
      return;
    }

    // Show the "This Module Is Over" interstitial while we save the finished
    // module and start the next one. Keep it up for a brief minimum so the
    // message is readable even when the network round-trip is instant.
    setTransitioning(true);
    const minDisplay = new Promise<void>((res) => setTimeout(res, 2500));
    // Set timer to full section time immediately — prevents cascade if the sync
    // effect fires before startSection writes its Redis key
    const fullTime = (test.sections[toSectionIdx]?.timeLimit ?? 45) * 60;
    resetTimerRef.current(fullTime);
    try {
      if (!isPreview) {
        await api.submitSection(attempt.id, fromSectionId);
        const result = await api.startSection(attempt.id, test.sections[toSectionIdx].id) as { endTime: number };
        // Refine with exact server endTime
        resetTimerRef.current(Math.max(10, Math.floor((result.endTime - Date.now()) / 1000)));
      }
    } catch {
      // Keep the full-time fallback already set above
    }
    await minDisplay;
    setTransitioning(false);
  };

  const doFinalSubmit = async () => {
    if (!attempt || !currentSection || !currentQuestion) return;
    const finalAns = currentQuestion.type === 'numeric' ? (parseFloat(numericInput) || null) : selectedAnswer;

    // Preview mode never persists or shows the celebration — just exit.
    if (isPreview) {
      allowNavigationAwayRef.current = true;
      clearAttempt();
      navigate('/tests');
      return;
    }

    // Autosave last question's answer
    const finalTimeSpent = currentQAttempt?.timeSpent ?? 0
    console.log(`[Test] Autosaving final Q${currentQuestion.id}: ${finalTimeSpent}s`)
    api.autosaveAnswer(attempt.id, {
      questionId: currentQuestion.id,
      answerGiven: toDbAnswer(currentQuestion.type, finalAns),
      timeSpentSeconds: finalTimeSpent,
      isFlagged: false,
    }).catch(() => {});
    // Submit last section (also triggers score calculation in backend)
    await api.submitSection(attempt.id, currentSection.id).catch(() => {});

    // Allow leaving the page (disarm the navigation blocker) and show the
    // "You're All Finished!" celebration. We keep the attempt id so the
    // "View Your Score" button can route to the review page.
    allowNavigationAwayRef.current = true;
    setFinishedAttemptId(attempt.id);
    setFinished(true);
  };

  const goToScore = () => {
    allowNavigationAwayRef.current = true;
    const id = finishedAttemptId;
    clearAttempt();
    navigate(id ? `/test-review/${id}` : '/tests');
  };

  const stripHtmlTags = (text: string): string => {
    if (!text) return '';
    // Remove HTML tags
    return text
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  };

  const autosaveAttemptState = useCallback(() => {
    if (!attempt || isPreview) return;
    
    // Main periodic save: just save the attempt state
    api.autosaveAnswer(attempt.id, {
      attemptState: {
        currentSectionIndex: attempt.currentSectionIndex,
        currentQuestionIndex: attempt.currentQuestionIndex,
        sections: attempt.sections,
      },
    }).catch(() => {});

    // IMPORTANT: Also explicitly save the current question's accumulated time
    // This ensures time data is persisted even if user doesn't navigate
    if (currentQuestion && currentSection && currentQAttempt) {
      const timeSpent = currentQAttempt.timeSpent || 0
      if (timeSpent > 0) {
        console.log(`[AutosavePeriodic] Saving current Q: ${timeSpent}s`)
        api.autosaveAnswer(attempt.id, {
          questionId: currentQuestion.id,
          answerGiven: toDbAnswer(currentQuestion.type,
            currentQuestion.type === 'numeric' ? parseFloat(numericInput) || null : selectedAnswer
          ),
          timeSpentSeconds: timeSpent,
          isFlagged: currentQAttempt.state === 'marked_review' || currentQAttempt.state === 'answered_marked',
        }).catch(() => {});
      }
    }
  }, [attempt, isPreview, currentQuestion, currentSection, currentQAttempt, selectedAnswer, numericInput]);

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

  breakEndHandlerRef.current = () => {
    setShowBreak(false);
    const toSectionIdx = pendingNextSectionIdxRef.current;
    if (toSectionIdx === null || !attempt || !test) return;
    pendingNextSectionIdxRef.current = null;
    setTransitioning(true);
    const fullTime = (test.sections[toSectionIdx]?.timeLimit ?? 45) * 60;
    resetTimerRef.current(fullTime);
    if (!isPreview) {
      api.startSection(attempt.id, test.sections[toSectionIdx].id)
        .then((result: any) => {
          resetTimerRef.current(Math.max(10, Math.floor((result.endTime - Date.now()) / 1000)));
        })
        .catch(() => {})
        .finally(() => setTransitioning(false));
    } else {
      setTransitioning(false);
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

  // Break countdown
  useEffect(() => {
    if (!showBreak) return;
    const id = setInterval(() => {
      setBreakSeconds((s) => {
        if (s <= 1) {
          clearInterval(id);
          breakEndHandlerRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [showBreak]);

  // ── Side effects ─────────────────────────────────────────────────────────────

  // Fullscreen — request on start, log exits, never block the test UI
  useEffect(() => {
    if (!attempt?.id) return;
    // Best-effort fullscreen — only works if browser allows it (user gesture needed).
    // On success: hide banner. On failure: show banner but NEVER block the test.
    document.documentElement.requestFullscreen?.()
      .then(() => setIsFullscreenBlocked(false))
      .catch(() => setIsFullscreenBlocked(true)); // show soft banner, test still runs

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreenBlocked(true); // show soft banner
        const currentAttempt = attemptRef.current;
        if (currentAttempt && currentAttempt.id !== 'preview') {
          api.logCheatingEvent(currentAttempt.id, 'FULLSCREEN_EXIT', {
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        }
        // No exit warning modal — fullscreen status never interrupts the test
      } else {
        setIsFullscreenBlocked(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [attempt?.id]);

  useEffect(() => {
    if (!attempt || !currentSection || isPreview) return;
    const sync = () => {
      api.getSectionTimer(attempt.id, currentSection.id)
        .then((r) => {
          // Never reset to 0 from sync — a 0 would cascade section advances
          // if startSection hasn't completed yet on the server
          if (r.remainingSeconds > 5) resetTimerRef.current(r.remainingSeconds);
        })
        .catch(() => {});
    };
    // Delay first sync by 4s so startSection has time to write the Redis timer
    // before we read it — otherwise we get 0 and auto-skip sections
    const initial = setTimeout(sync, 4000);
    const interval = setInterval(sync, 15000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [attempt?.id, currentSection?.id, isPreview]);

  useEffect(() => {
    if (!attempt) return;
    const interval = setInterval(autosaveAttemptState, 8000);
    
    // Also save all question times on page unload
    const onBeforeUnload = () => {
      // Emergency save of all questions with their time data
      console.log('[Test] Page unloading - saving all question times')
      for (const section of Object.values(attempt.sections)) {
        for (const [qId, q] of Object.entries(section.questions)) {
          if (q.timeSpent > 0) {
            // Use navigator.sendBeacon for reliability (survives page unload)
            try {
              const payload = JSON.stringify({
                attemptId: attempt.id,
                questionId: qId,
                timeSpentSeconds: q.timeSpent,
                state: q.state,
              })
              navigator.sendBeacon('/api/attempts/beacon-time', payload)
            } catch (e) {
              // Fallback to regular API call
              api.autosaveAnswer(attempt.id, {
                questionId: qId,
                answerGiven: null,
                timeSpentSeconds: q.timeSpent,
                isFlagged: false,
              }).catch(() => {})
            }
          }
        }
      }
      autosaveAttemptState()
    };
    
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

  // Calculator drag & resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (calcDragging.current) {
        setCalcPos({ x: e.clientX - calcDragOffset.current.x, y: e.clientY - calcDragOffset.current.y });
      } else if (calcResizing.current) {
        const deltaX = e.clientX - calcResizeStart.current.x;
        const deltaY = e.clientY - calcResizeStart.current.y;
        setCalcSize({
          width: Math.max(360, Math.min(1200, calcResizeStart.current.width + deltaX)),
          height: Math.max(360, Math.min(800, calcResizeStart.current.height + deltaY)),
        });
      }
    };
    const onUp = () => {
      calcDragging.current = false;
      calcResizing.current = false;
      setIsInteractingWithCalc(false);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ── Text highlight helpers ──────────────────────────────────────────────────
  const handleContentMouseUp = useCallback((
    _e: React.MouseEvent,
    ref: React.RefObject<HTMLDivElement | null>,
    key: string,
  ) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;
    const range = sel.getRangeAt(0);
    if (!ref.current?.contains(range.commonAncestorContainer)) return;
    highlightPendingRef.current = { container: ref.current, key };
    const rect = range.getBoundingClientRect();
    setHighlightTooltip({ x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  const applyHighlight = useCallback(() => {
    const pending = highlightPendingRef.current;
    if (!pending) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setHighlightTooltip(null); return; }

    try {
      const range = sel.getRangeAt(0);
      if (!pending.container.contains(range.commonAncestorContainer)) {
        setHighlightTooltip(null);
        return;
      }
      const mark = document.createElement('mark');
      mark.style.cssText = 'background:#fef08a;border-radius:2px;padding:0 1px;';
      // extractContents + insertNode reliably handles selections spanning multiple elements
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
      // Merge adjacent text nodes to keep the DOM clean
      pending.container.normalize();
      setQuestionHighlights(prev => ({ ...prev, [pending.key]: pending.container.innerHTML }));
    } catch { /* ignore — e.g. selection in non-text node */ }

    sel.removeAllRanges();
    setHighlightTooltip(null);
    highlightPendingRef.current = null;
  }, []);

  // Dismiss tooltip when clicking outside
  useEffect(() => {
    const dismiss = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('[data-highlight-tooltip]')) setHighlightTooltip(null);
    };
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, []);

  // Accumulate time spent on the active question, one second at a time.
  // Re-binds whenever the active question changes so the elapsed seconds are
  // credited to the right question.
  useEffect(() => {
    const sectionId = currentSection?.id;
    const questionId = currentQuestion?.id;
    if (!sectionId || !questionId) return;
    questionTimerRef.current = setInterval(() => {
      updateTimeSpent(sectionId, questionId, 1);
    }, 1000);
    return () => { if (questionTimerRef.current) clearInterval(questionTimerRef.current); };
  }, [currentQIdx, currentSectionIdx, currentSection?.id, currentQuestion?.id, updateTimeSpent]);

  useEffect(() => {
    if (currentQAttempt) {
      const ans = currentQAttempt.selectedAnswer;
      setSelectedAnswer(ans ?? null);
      setNumericInput(typeof ans === 'number' ? String(ans) : '');
    } else {
      setSelectedAnswer(null);
      setNumericInput('');
    }
    setEliminatedOptions(new Set()); // reset eliminations on question change
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

  // Final celebration — shown after the whole test is submitted.
  if (finished) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#1e2150] overflow-hidden flex flex-col items-center justify-center px-6">
        {/* Confetti */}
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="absolute"
            style={{
              left: `${c.left}%`,
              top: `${c.top}%`,
              width: c.size,
              height: c.size,
              backgroundColor: c.color,
              borderRadius: c.round ? '9999px' : '1px',
              transform: `rotate(${c.rot}deg)`,
              opacity: 0.85,
            }}
          />
        ))}

        <h1 className="relative text-3xl sm:text-4xl font-bold text-white mb-10 text-center">You're All Finished!</h1>

        <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full px-8 py-10 flex flex-col sm:flex-row items-center gap-8">
          {/* Laptop + smiley illustration */}
          <div className="flex-shrink-0 flex items-center justify-center w-44 h-44 rounded-full bg-blue-50/70">
            <svg viewBox="0 0 120 100" className="w-32 h-28">
              <rect x="20" y="10" width="80" height="55" rx="4" fill="#fff" stroke="#cbd5e1" strokeWidth="3" />
              <path d="M10 82 L110 82 L100 65 L20 65 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="3" strokeLinejoin="round" />
              <circle cx="60" cy="37" r="16" fill="#dbeafe" stroke="#3b82f6" strokeWidth="3" />
              <circle cx="54" cy="33" r="2.2" fill="#3b82f6" />
              <circle cx="66" cy="33" r="2.2" fill="#3b82f6" />
              <path d="M52 42 Q60 50 68 42" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>

          <div className="hidden sm:block w-px self-stretch bg-gray-200" />

          <p className="text-center sm:text-left text-gray-700 text-lg leading-relaxed">
            Congratulations on completing your test! Your answers have been submitted.
            Click below to see how you did.
          </p>
        </div>

        <button
          onClick={goToScore}
          className="relative mt-10 bg-yellow-400 hover:bg-yellow-300 text-[#1e2150] font-bold text-lg px-10 py-3.5 rounded-full shadow-lg transition-colors"
        >
          View Your Score
        </button>
      </div>
    );
  }

  // ── Break screen (between R&W and Math) ─────────────────────────────────────
  if (showBreak) {
    const bm = Math.floor(breakSeconds / 60);
    const bs = breakSeconds % 60;
    const breakDisplay = `${bm}:${bs.toString().padStart(2, '0')}`;
    return (
      <div className="fixed inset-0 z-[200] bg-white flex overflow-hidden">
        {/* Left panel — timer */}
        <div className="w-56 flex-shrink-0 bg-[#1a1a1a] flex flex-col items-center justify-center gap-6 px-4">
          <div className="text-center">
            <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-3">Remaining Break Time:</p>
            <p className="text-5xl font-bold text-white font-mono tabular-nums">{breakDisplay}</p>
          </div>
          <button
            onClick={() => breakEndHandlerRef.current()}
            className="w-full py-2.5 rounded-full bg-[#f6c945] hover:bg-[#e5b930] text-black text-sm font-bold transition-colors"
          >
            Resume Testing
          </button>
        </div>

        {/* Right panel — instructions */}
        <div className="flex-1 overflow-y-auto px-10 py-8 max-w-2xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Practice Test Break</h1>
          <p className="text-sm text-gray-500 mb-5">
            You can resume this practice test as soon as you're ready to move on. On test day, you'll
            wait until the clock counts down. Read below to see how breaks work on test day.
          </p>
          <hr className="border-gray-300 mb-6" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Take a Break: Do Not Close Your Device</h2>
          <p className="text-sm text-gray-600 mb-5">
            After the break, a <strong>Resume Testing Now</strong> button will appear and you'll start
            the next section.
          </p>
          <p className="text-sm font-bold text-gray-900 mb-3">Follow these rules during the break:</p>
          <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
            <li>Do not disturb students who are still testing.</li>
            <li>Do not exit the app or close your laptop.</li>
            <li>Do not access phones, smartwatches, textbooks, notes, or the internet.</li>
            <li>Do not eat or drink near any testing device.</li>
            <li>Do not speak in the testing room; outside the room, do not discuss the exam with anyone.</li>
          </ol>
        </div>
      </div>
    );
  }

  // Between-module interstitial — shown right after a module is submitted,
  // while the next module is being prepared on the server.
  if (transitioning) {
    return (
      <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-3xl font-semibold text-[#3b5bdb] mb-10">This Module Is Over</h1>
        <p className="text-lg text-gray-700">All your work has been saved.</p>
        <p className="text-lg text-gray-700 mt-3">You'll move on automatically in just a moment.</p>
        <p className="text-lg text-gray-700 mt-3">Do not refresh this page or quit the app.</p>
        <div className="mt-14 w-10 h-10 border-[3px] border-[#3b5bdb] border-t-transparent rounded-full animate-spin" />
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
      const timeForQ = currentQAttempt?.timeSpent ?? 0
      console.log(`[Test] Autosaving Q${currentQuestion.id} (${newState}): ${timeForQ}s`)
      api.autosaveAnswer(attempt.id, {
        questionId: currentQuestion.id,
        answerGiven: toDbAnswer(currentQuestion.type, finalAns),
        timeSpentSeconds: timeForQ,
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
    const hasAnswer = finalAns !== null && finalAns !== '' && !(Array.isArray(finalAns) && finalAns.length === 0);
    // Bluebook behaviour: toggle the review flag on the current question and
    // stay where you are (no auto-advance).
    const currState = getQuestionState(currentSection.id, currentQuestion.id);
    const currentlyMarked = currState === 'marked_review' || currState === 'answered_marked';
    const nowMarked = !currentlyMarked;
    const newState: QuestionState = nowMarked
      ? (hasAnswer ? 'answered_marked' : 'marked_review')
      : (hasAnswer ? 'answered' : 'not_answered');
    updateQuestionState(currentSection.id, currentQuestion.id, newState, finalAns as any);
    if (!isPreview) {
      api.autosaveAnswer(attempt.id, {
        questionId: currentQuestion.id,
        answerGiven: toDbAnswer(currentQuestion.type, finalAns),
        timeSpentSeconds: currentQAttempt?.timeSpent ?? 0,
        isFlagged: nowMarked,
        attemptState: {
          currentSectionIndex: currentSectionIdx,
          currentQuestionIndex: currentQIdx,
          sections: attempt.sections,
        },
      }).catch(() => {});
    }
  };

  const isLowTime = timeLeft < 300;
  const currentQState = getQuestionState(currentSection.id, currentQuestion.id);
  const isMarked = currentQState === 'marked_review' || currentQState === 'answered_marked';
  const isMath = /math/i.test(currentSection.name);

  // Bluebook-style question header (number badge + Mark for Review + annotate)
  const questionHeaderBar = (
    <div className="flex items-center justify-between border-b-2 border-dashed border-gray-300 pb-2.5 mb-5">
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 bg-gray-900 text-white text-sm font-bold flex items-center justify-center rounded">{currentQIdx + 1}</span>
        <button onClick={markForReview} className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900">
          <Bookmark size={15} className={isMarked ? 'text-red-500' : ''} fill={isMarked ? '#ef4444' : 'none'} />
          Mark for Review
        </button>
      </div>
      <span title="Annotate" className="w-7 h-7 flex items-center justify-center rounded bg-[#1b3d6e] text-white text-[9px] font-bold tracking-tight">ABC</span>
    </div>
  );

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
          const isEliminated = eliminatedOptions.has(opt.id);
          return (
            <BluebookOption
              key={opt.id}
              label={opt.id.toUpperCase()}
              text={opt.text}
              isSelected={isSelected}
              isEliminated={isEliminated}
              onClick={() => {
                if (type === 'mcq_multi') {
                  const curr = Array.isArray(answer) ? answer as string[] : [];
                  setSelectedAnswer(curr.includes(opt.id) ? curr.filter((x) => x !== opt.id) : [...curr, opt.id]);
                } else {
                  setSelectedAnswer(isSelected ? null : opt.id);
                }
              }}
              onEliminate={(e) => {
                e.stopPropagation();
                setEliminatedOptions((prev) => {
                  const next = new Set(prev);
                  next.has(opt.id) ? next.delete(opt.id) : next.add(opt.id);
                  return next;
                });
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

      {/* ── TOP BAR (Bluebook) ───────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-[#fcfcfd] border-b border-gray-200 px-5 h-16 flex items-center justify-between z-20">
        {/* Left: module title + directions */}
        <div className="flex flex-col justify-center min-w-0">
          <p className="text-[15px] font-bold text-gray-900 leading-tight truncate">{currentSection.name}</p>
          <button
            onClick={() => setShowDirections(true)}
            className="flex items-center gap-1 text-[13px] text-gray-700 hover:text-gray-900 w-fit"
          >
            Directions <ChevronDown size={13} />
          </button>
        </div>

        {/* Center: timer */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center select-none">
          {!timerHidden && (
            <span className={`text-xl font-bold tabular-nums leading-none ${isLowTime ? 'text-red-600' : 'text-gray-900'}`}>
              {formatTime(timeLeft)}
            </span>
          )}
          <button
            onClick={() => setTimerHidden((v) => !v)}
            className={`text-[12px] font-medium text-gray-600 border border-gray-300 rounded-full px-3 py-0.5 hover:bg-gray-100 transition-colors ${timerHidden ? '' : 'mt-1.5'}`}
          >
            {timerHidden ? 'Show' : 'Hide'}
          </button>
        </div>

        {/* Right: tools */}
        <div className="flex items-center gap-5">
          {isMath && (
            <>
              <button onClick={() => setShowReference(true)} className="flex flex-col items-center gap-0.5 text-[11px] text-gray-700 hover:text-[#1b3d6e]">
                <BookOpen size={18} /> Reference
              </button>
              <button onClick={() => setShowCalculator((v) => !v)} className="flex flex-col items-center gap-0.5 text-[11px] text-gray-700 hover:text-[#1b3d6e]">
                <Calculator size={18} /> Calculator
              </button>
            </>
          )}
          {!isMath && (
            <button onClick={() => setShowHighlightsNotes(true)} className="flex flex-col items-center gap-0.5 text-[11px] text-gray-700 hover:text-[#1b3d6e]" title="Highlights & Notes">
              <PencilLine size={18} /> Highlights & Notes
            </button>
          )}
          <div className="relative">
            <button onClick={() => setShowMore((v) => !v)} className="flex flex-col items-center gap-0.5 text-[11px] text-gray-700 hover:text-[#1b3d6e]">
              <MoreVertical size={18} /> More
            </button>
            {showMore && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowMore(false)} />
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-30">
                  <button onClick={() => { setShowMore(false); setShowDirections(true); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Directions</button>
                  <button onClick={() => { setShowMore(false); setShowExitWarningModal(true); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">Exit Exam</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Practice-test banner */}
      <div className="flex-shrink-0 bg-[#1e2150] text-white text-center text-[12px] font-semibold tracking-wide py-1.5 z-10">
        THIS IS A PRACTICE TEST
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-white">
        {currentQuestion.parentQuestionText ? (
          /* Passage layout */
          <div className="flex h-full min-h-full divide-x divide-gray-200">
            {/* Left: Passage */}
            <div className="w-1/2 flex flex-col bg-white h-full">
              {/* Scrollable passage content */}
              <div className="flex-1 overflow-y-auto p-8">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Reading Passage</p>
                {questionHighlights[`passage:${currentQuestion.id}`] ? (
                  <div
                    ref={passageRef}
                    className="prose prose-gray max-w-none text-gray-800 text-[15px] leading-relaxed"
                    onMouseUp={!isMath ? (e) => handleContentMouseUp(e, passageRef, `passage:${currentQuestion.id}`) : undefined}
                    dangerouslySetInnerHTML={{ __html: questionHighlights[`passage:${currentQuestion.id}`] }}
                  />
                ) : (
                  <div
                    ref={passageRef}
                    className="prose prose-gray max-w-none text-gray-800 text-[15px] leading-relaxed"
                    onMouseUp={!isMath ? (e) => handleContentMouseUp(e, passageRef, `passage:${currentQuestion.id}`) : undefined}
                  >
                    <RichContentRenderer content={currentQuestion.parentQuestionText} variant="question" />
                  </div>
                )}
              </div>
            </div>
            {/* Right: Question */}
            <div className="w-1/2 overflow-y-auto p-8 bg-white">
              {questionHeaderBar}
              {questionHighlights[`text:${currentQuestion.id}`] ? (
                <div
                  ref={questionTextRef}
                  className="text-[15px] text-gray-900 leading-relaxed mb-6"
                  onMouseUp={!isMath ? (e) => handleContentMouseUp(e, questionTextRef, `text:${currentQuestion.id}`) : undefined}
                  dangerouslySetInnerHTML={{ __html: questionHighlights[`text:${currentQuestion.id}`] }}
                />
              ) : (
                <div
                  ref={questionTextRef}
                  className="text-[15px] text-gray-900 leading-relaxed mb-6"
                  onMouseUp={!isMath ? (e) => handleContentMouseUp(e, questionTextRef, `text:${currentQuestion.id}`) : undefined}
                >
                  <RichContentRenderer content={currentQuestion.text || `Question ${currentQIdx + 1}`} variant="question" />
                </div>
              )}
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
            {questionHeaderBar}
            {questionHighlights[`text:${currentQuestion.id}`] ? (
              <div
                ref={questionTextRef}
                className="text-[16px] text-gray-900 leading-relaxed mb-8 font-normal"
                onMouseUp={!isMath ? (e) => handleContentMouseUp(e, questionTextRef, `text:${currentQuestion.id}`) : undefined}
                dangerouslySetInnerHTML={{ __html: questionHighlights[`text:${currentQuestion.id}`] }}
              />
            ) : (
              <div
                ref={questionTextRef}
                className="text-[16px] text-gray-900 leading-relaxed mb-8 font-normal"
                onMouseUp={!isMath ? (e) => handleContentMouseUp(e, questionTextRef, `text:${currentQuestion.id}`) : undefined}
              >
                <RichContentRenderer content={currentQuestion.text || `Question ${currentQIdx + 1}`} variant="question" />
              </div>
            )}
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

      {/* ── BOTTOM BAR (Bluebook) ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-[#fcfcfd] border-t border-gray-200 px-5 h-16 flex items-center justify-between z-20">
        {/* Left: student name */}
        <p className="text-base font-bold text-gray-900 truncate max-w-[28%]">{user?.name ?? 'Student'}</p>

        {/* Center: question navigator pill */}
        <button
          onClick={() => setShowPalette(true)}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Question {currentQIdx + 1} of {totalQInSection}
          <ChevronUp size={15} />
        </button>

        {/* Right: back / next / submit */}
        <div className="flex items-center gap-2">
          <button
            disabled={currentQIdx === 0}
            onClick={() => saveAndNavigate(currentQIdx - 1)}
            className="px-5 py-2.5 text-sm font-semibold text-[#1b3d6e] rounded-full hover:bg-blue-50 disabled:opacity-0 disabled:pointer-events-none transition-colors"
          >
            Back
          </button>
          {isLastQuestion && isLastSection ? (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-1.5 px-7 py-2.5 text-sm font-semibold bg-[#1b3d6e] text-white rounded-full hover:bg-[#15305a] transition-colors"
            >
              <Send size={13} /> Submit
            </button>
          ) : (
            <button
              onClick={() => isLastQuestion ? saveAndNavigate(0, currentSectionIdx + 1) : saveAndNavigate(currentQIdx + 1)}
              className="px-9 py-2.5 text-sm font-semibold bg-[#1b3d6e] text-white rounded-full hover:bg-[#15305a] transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>

      {/* ── DESMOS CALCULATOR ────────────────────────────────────────────────── */}
      {showCalculator && (
        <div
          className="fixed z-40 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-100 ease-out"
          style={{
            left: calcPos.x,
            top: calcPos.y,
            width: Math.min(calcSize.width, window.innerWidth - 20),
            height: Math.min(calcSize.height, window.innerHeight - 100),
          }}
        >
          {/* Header & Drag handle */}
          <div
            className="flex items-center justify-between px-4 py-2.5 bg-[#1b3d6e] text-white cursor-move select-none flex-shrink-0"
            onMouseDown={(e) => {
              // Only initiate drag if user isn't clicking the tabs or close button
              const target = e.target as HTMLElement;
              if (target.closest('button')) return;
              
              calcDragging.current = true;
              calcDragOffset.current = { x: e.clientX - calcPos.x, y: e.clientY - calcPos.y };
              setIsInteractingWithCalc(true);
            }}
          >
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Calculator size={14} /> Calculator
              </span>
              
              {/* Tab Selector */}
              <div className="flex items-center bg-[#132d53] p-0.5 rounded-md text-[10px]">
                <button
                  onClick={() => {
                    setCalcMode('graphing');
                    setCalcSize({ width: 800, height: 550 });
                    setCalcPos((prev) => {
                      const nextX = Math.min(prev.x, window.innerWidth - 820);
                      const nextY = Math.min(prev.y, window.innerHeight - 570);
                      return { x: Math.max(10, nextX), y: Math.max(10, nextY) };
                    });
                  }}
                  className={`px-2.5 py-0.5 font-medium rounded-sm cursor-pointer transition-all ${
                    calcMode === 'graphing'
                      ? 'bg-[#1b3d6e] text-white shadow-sm font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Graphing
                </button>
                <button
                  onClick={() => {
                    setCalcMode('scientific');
                    setCalcSize({ width: 450, height: 520 });
                    setCalcPos((prev) => {
                      const nextX = Math.min(prev.x, window.innerWidth - 470);
                      const nextY = Math.min(prev.y, window.innerHeight - 540);
                      return { x: Math.max(10, nextX), y: Math.max(10, nextY) };
                    });
                  }}
                  className={`px-2.5 py-0.5 font-medium rounded-sm cursor-pointer transition-all ${
                    calcMode === 'scientific'
                      ? 'bg-[#1b3d6e] text-white shadow-sm font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Scientific
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowCalculator(false)}
              className="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Calculator iframe */}
          <iframe
            src={
              calcMode === 'graphing'
                ? 'https://www.desmos.com/testing/cb-digital-sat/graphing'
                : 'https://www.desmos.com/scientific'
            }
            title={calcMode === 'graphing' ? 'Desmos Graphing Calculator' : 'Desmos Scientific Calculator'}
            className="flex-1 w-full border-0 bg-white"
            style={{ pointerEvents: isInteractingWithCalc ? 'none' : 'auto' }}
            sandbox="allow-scripts allow-same-origin"
          />

          {/* Resize handle in bottom right corner */}
          <div
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-0.5 z-50 select-none"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              calcResizing.current = true;
              calcResizeStart.current = {
                x: e.clientX,
                y: e.clientY,
                width: calcSize.width,
                height: calcSize.height,
              };
              setIsInteractingWithCalc(true);
            }}
          >
            {/* Minimalist dot-pattern resize handle indicator */}
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              className="text-gray-400 fill-current opacity-70 hover:opacity-100 transition-opacity"
            >
              <circle cx="8" cy="8" r="1" />
              <circle cx="8" cy="5" r="1" />
              <circle cx="5" cy="8" r="1" />
              <circle cx="8" cy="2" r="1" />
              <circle cx="5" cy="5" r="1" />
              <circle cx="2" cy="8" r="1" />
            </svg>
          </div>
        </div>
      )}

      {/* ── REFERENCE SHEET ──────────────────────────────────────────────────── */}
      {showReference && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowReference(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[92vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-300 flex-shrink-0">
              <h2 className="text-sm font-bold text-gray-900 tracking-wide">Reference</h2>
              <button onClick={() => setShowReference(false)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><X size={16} /></button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-4">

              {/* ── Row 1: 2D Area shapes ── */}
              <div className="grid grid-cols-3 gap-3">
                {/* Circle */}
                <div className="flex flex-col items-center text-center border border-gray-200 rounded-lg py-3 px-2">
                  <svg viewBox="0 0 80 66" className="w-16 h-14 mb-2" aria-hidden>
                    <circle cx="40" cy="33" r="26" fill="none" stroke="#111" strokeWidth="1.6"/>
                    <line x1="40" y1="33" x2="66" y2="33" stroke="#111" strokeWidth="1.4"/>
                    <circle cx="40" cy="33" r="2" fill="#111"/>
                    <text x="50" y="28" fontSize="11" fill="#111" fontStyle="italic" fontFamily="serif">r</text>
                  </svg>
                  <p className="text-sm text-gray-900 leading-snug">A = πr²</p>
                  <p className="text-sm text-gray-900 leading-snug">C = 2πr</p>
                </div>

                {/* Rectangle */}
                <div className="flex flex-col items-center text-center border border-gray-200 rounded-lg py-3 px-2">
                  <svg viewBox="0 0 80 66" className="w-16 h-14 mb-2" aria-hidden>
                    <rect x="8" y="15" width="60" height="36" fill="none" stroke="#111" strokeWidth="1.6"/>
                    <text x="33" y="62" fontSize="11" fill="#111" fontStyle="italic" fontFamily="serif">l</text>
                    <text x="0" y="36" fontSize="11" fill="#111" fontStyle="italic" fontFamily="serif">w</text>
                  </svg>
                  <p className="text-sm text-gray-900">A = lw</p>
                </div>

                {/* Triangle */}
                <div className="flex flex-col items-center text-center border border-gray-200 rounded-lg py-3 px-2">
                  <svg viewBox="0 0 80 66" className="w-16 h-14 mb-2" aria-hidden>
                    <polygon points="8,58 72,58 40,10" fill="none" stroke="#111" strokeWidth="1.6"/>
                    <line x1="40" y1="10" x2="40" y2="58" stroke="#111" strokeWidth="1.2" strokeDasharray="4,3"/>
                    <polyline points="40,50 48,50 48,58" fill="none" stroke="#111" strokeWidth="1.2"/>
                    <text x="42" y="38" fontSize="11" fill="#111" fontStyle="italic" fontFamily="serif">h</text>
                    <text x="52" y="66" fontSize="11" fill="#111" fontStyle="italic" fontFamily="serif">b</text>
                  </svg>
                  <p className="text-sm text-gray-900">A = ½bh</p>
                </div>
              </div>

              {/* ── Row 2: Right triangles ── */}
              <div className="grid grid-cols-3 gap-3">
                {/* Pythagorean theorem */}
                <div className="flex flex-col items-center text-center border border-gray-200 rounded-lg py-3 px-2">
                  <svg viewBox="0 0 80 66" className="w-16 h-14 mb-2" aria-hidden>
                    <polygon points="8,58 60,58 8,14" fill="none" stroke="#111" strokeWidth="1.6"/>
                    <polyline points="8,46 20,46 20,58" fill="none" stroke="#111" strokeWidth="1.2"/>
                    <text x="10" y="38" fontSize="11" fill="#111" fontStyle="italic" fontFamily="serif">a</text>
                    <text x="32" y="66" fontSize="11" fill="#111" fontStyle="italic" fontFamily="serif">b</text>
                    <text x="38" y="33" fontSize="11" fill="#111" fontStyle="italic" fontFamily="serif">c</text>
                  </svg>
                  <p className="text-sm text-gray-900">c² = a² + b²</p>
                </div>

                {/* 30-60-90 */}
                <div className="flex flex-col items-center text-center border border-gray-200 rounded-lg py-3 px-2">
                  <svg viewBox="0 0 80 66" className="w-16 h-14 mb-2" aria-hidden>
                    <polygon points="8,58 72,58 8,14" fill="none" stroke="#111" strokeWidth="1.6"/>
                    <polyline points="8,46 20,46 20,58" fill="none" stroke="#111" strokeWidth="1.2"/>
                    <text x="9" y="40" fontSize="9" fill="#111" fontFamily="serif" fontStyle="italic">x√3</text>
                    <text x="36" y="66" fontSize="9" fill="#111" fontFamily="serif" fontStyle="italic">x</text>
                    <text x="42" y="34" fontSize="9" fill="#111" fontFamily="serif" fontStyle="italic">2x</text>
                    <text x="22" y="57" fontSize="8" fill="#555" fontFamily="sans-serif">60°</text>
                    <text x="10" y="57" fontSize="7.5" fill="#555" fontFamily="sans-serif">30°</text>
                  </svg>
                  <p className="text-[11px] text-gray-500 mb-0.5">30°– 60°– 90°</p>
                  <p className="text-sm text-gray-900">x : x√3 : 2x</p>
                </div>

                {/* 45-45-90 */}
                <div className="flex flex-col items-center text-center border border-gray-200 rounded-lg py-3 px-2">
                  <svg viewBox="0 0 80 66" className="w-16 h-14 mb-2" aria-hidden>
                    <polygon points="8,58 56,58 8,10" fill="none" stroke="#111" strokeWidth="1.6"/>
                    <polyline points="8,46 20,46 20,58" fill="none" stroke="#111" strokeWidth="1.2"/>
                    <text x="10" y="36" fontSize="9" fill="#111" fontFamily="serif" fontStyle="italic">x</text>
                    <text x="29" y="66" fontSize="9" fill="#111" fontFamily="serif" fontStyle="italic">x</text>
                    <text x="32" y="30" fontSize="9" fill="#111" fontFamily="serif" fontStyle="italic">x√2</text>
                    <text x="22" y="57" fontSize="8" fill="#555" fontFamily="sans-serif">45°</text>
                    <text x="10" y="57" fontSize="7.5" fill="#555" fontFamily="sans-serif">45°</text>
                  </svg>
                  <p className="text-[11px] text-gray-500 mb-0.5">45°– 45°– 90°</p>
                  <p className="text-sm text-gray-900">x : x : x√2</p>
                </div>
              </div>

              {/* ── Row 3: Volume shapes ── */}
              <div className="grid grid-cols-5 gap-2">
                {/* Rectangular Solid */}
                <div className="flex flex-col items-center text-center border border-gray-200 rounded-lg py-3 px-1">
                  <svg viewBox="0 0 72 58" className="w-14 h-11 mb-2" aria-hidden>
                    <rect x="12" y="22" width="36" height="26" fill="none" stroke="#111" strokeWidth="1.4"/>
                    <polygon points="12,22 26,10 62,10 48,22" fill="none" stroke="#111" strokeWidth="1.4"/>
                    <polygon points="48,22 62,10 62,36 48,48" fill="none" stroke="#111" strokeWidth="1.4"/>
                    <line x1="12" y1="48" x2="48" y2="48" stroke="#111" strokeWidth="1.4"/>
                    <line x1="48" y1="48" x2="48" y2="22" stroke="#111" strokeWidth="1.4"/>
                    <text x="25" y="55" fontSize="9" fill="#111" fontStyle="italic" fontFamily="serif">l</text>
                    <text x="51" y="46" fontSize="9" fill="#111" fontStyle="italic" fontFamily="serif">w</text>
                    <text x="3" y="37" fontSize="9" fill="#111" fontStyle="italic" fontFamily="serif">h</text>
                  </svg>
                  <p className="text-[11px] text-gray-900 font-medium">V = lwh</p>
                </div>

                {/* Cylinder */}
                <div className="flex flex-col items-center text-center border border-gray-200 rounded-lg py-3 px-1">
                  <svg viewBox="0 0 72 58" className="w-14 h-11 mb-2" aria-hidden>
                    <ellipse cx="36" cy="13" rx="22" ry="7" fill="none" stroke="#111" strokeWidth="1.4"/>
                    <ellipse cx="36" cy="45" rx="22" ry="7" fill="none" stroke="#111" strokeWidth="1.4"/>
                    <line x1="14" y1="13" x2="14" y2="45" stroke="#111" strokeWidth="1.4"/>
                    <line x1="58" y1="13" x2="58" y2="45" stroke="#111" strokeWidth="1.4"/>
                    <line x1="36" y1="13" x2="58" y2="13" stroke="#111" strokeWidth="1.2"/>
                    <text x="43" y="9" fontSize="9" fill="#111" fontStyle="italic" fontFamily="serif">r</text>
                    <text x="60" y="32" fontSize="9" fill="#111" fontStyle="italic" fontFamily="serif">h</text>
                  </svg>
                  <p className="text-[11px] text-gray-900 font-medium">V = πr²h</p>
                </div>

                {/* Sphere */}
                <div className="flex flex-col items-center text-center border border-gray-200 rounded-lg py-3 px-1">
                  <svg viewBox="0 0 72 58" className="w-14 h-11 mb-2" aria-hidden>
                    <circle cx="36" cy="29" r="23" fill="none" stroke="#111" strokeWidth="1.4"/>
                    <ellipse cx="36" cy="29" rx="23" ry="7" fill="none" stroke="#111" strokeWidth="1.1" strokeDasharray="4,3"/>
                    <line x1="36" y1="29" x2="59" y2="29" stroke="#111" strokeWidth="1.2"/>
                    <circle cx="36" cy="29" r="1.8" fill="#111"/>
                    <text x="44" y="25" fontSize="9" fill="#111" fontStyle="italic" fontFamily="serif">r</text>
                  </svg>
                  <p className="text-[11px] text-gray-900 font-medium">V = 4/3 πr³</p>
                </div>

                {/* Cone */}
                <div className="flex flex-col items-center text-center border border-gray-200 rounded-lg py-3 px-1">
                  <svg viewBox="0 0 72 58" className="w-14 h-11 mb-2" aria-hidden>
                    <line x1="36" y1="5" x2="12" y2="49" stroke="#111" strokeWidth="1.4"/>
                    <line x1="36" y1="5" x2="60" y2="49" stroke="#111" strokeWidth="1.4"/>
                    <ellipse cx="36" cy="49" rx="24" ry="7" fill="none" stroke="#111" strokeWidth="1.4"/>
                    <line x1="36" y1="5" x2="36" y2="49" stroke="#111" strokeWidth="1.1" strokeDasharray="3,3"/>
                    <line x1="36" y1="49" x2="60" y2="49" stroke="#111" strokeWidth="1.2"/>
                    <text x="43" y="47" fontSize="9" fill="#111" fontStyle="italic" fontFamily="serif">r</text>
                    <text x="38" y="30" fontSize="9" fill="#111" fontStyle="italic" fontFamily="serif">h</text>
                  </svg>
                  <p className="text-[11px] text-gray-900 font-medium">V = 1/3 πr²h</p>
                </div>

                {/* Pyramid */}
                <div className="flex flex-col items-center text-center border border-gray-200 rounded-lg py-3 px-1">
                  <svg viewBox="0 0 72 58" className="w-14 h-11 mb-2" aria-hidden>
                    <polygon points="16,48 56,48 64,36 24,36" fill="none" stroke="#111" strokeWidth="1.4"/>
                    <line x1="36" y1="7" x2="16" y2="48" stroke="#111" strokeWidth="1.4"/>
                    <line x1="36" y1="7" x2="56" y2="48" stroke="#111" strokeWidth="1.4"/>
                    <line x1="36" y1="7" x2="64" y2="36" stroke="#111" strokeWidth="1.4"/>
                    <line x1="36" y1="7" x2="24" y2="36" stroke="#111" strokeWidth="1.1" strokeDasharray="3,3"/>
                    <line x1="16" y1="48" x2="24" y2="36" stroke="#111" strokeWidth="1.1" strokeDasharray="3,3"/>
                    <text x="32" y="56" fontSize="9" fill="#111" fontStyle="italic" fontFamily="serif">l</text>
                    <text x="57" y="45" fontSize="9" fill="#111" fontStyle="italic" fontFamily="serif">w</text>
                  </svg>
                  <p className="text-[11px] text-gray-900 font-medium">V = 1/3 lwh</p>
                </div>
              </div>

              {/* ── Key Facts ── */}
              <div className="border-t border-gray-300 pt-3 space-y-1.5">
                <p className="text-[13px] text-gray-800">The number of degrees of arc in a circle is 360.</p>
                <p className="text-[13px] text-gray-800">The number of radians of arc in a circle is 2π.</p>
                <p className="text-[13px] text-gray-800">The sum of the measures in degrees of the angles of a triangle is 180.</p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── FLOATING HIGHLIGHT TOOLTIP ──────────────────────────────────────── */}
      {highlightTooltip && !isMath && (
        <div
          data-highlight-tooltip
          className="fixed z-[60] -translate-x-1/2 -translate-y-full"
          style={{ left: highlightTooltip.x, top: highlightTooltip.y - 8 }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          {/* Arrow */}
          <div className="flex flex-col items-center">
            <div className="flex items-center bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden">
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); applyHighlight(); }}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-gray-800 hover:bg-gray-50 transition-colors border-r border-gray-200"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="8" width="12" height="4" rx="1" fill="#fef08a" stroke="#d4b700" strokeWidth="0.8"/>
                  <rect x="3.5" y="1" width="7" height="8" rx="1" fill="#fef08a" stroke="#d4b700" strokeWidth="0.8"/>
                </svg>
                Highlight
              </button>
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setHighlightTooltip(null); window.getSelection()?.removeAllRanges(); }}
                className="px-2.5 py-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors text-[11px]"
              >
                <X size={11} />
              </button>
            </div>
            <div className="w-2 h-2 bg-white border-r border-b border-gray-300 rotate-45 -mt-1 shadow-sm" />
          </div>
        </div>
      )}

      {/* ── HIGHLIGHTS & NOTES ──────────────────────────────────────────────── */}
      {showHighlightsNotes && currentQuestion && !isMath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowHighlightsNotes(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <PencilLine size={16} /> Highlights & Notes
              </h2>
              <button onClick={() => setShowHighlightsNotes(false)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>

            {/* Question Info */}
            <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <p className="text-xs text-gray-500 font-medium">Question {currentQIdx + 1}</p>
              <p className="text-sm text-gray-700 font-medium mt-1 line-clamp-2">{stripHtmlTags(currentQuestion.text || '')}</p>
            </div>

            {/* Notes Area */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-5 py-3 flex-1 flex flex-col min-h-0">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Your Notes</label>
                <textarea
                  value={questionNotes[currentQuestion.id] || ''}
                  onChange={(e) => setQuestionNotes({
                    ...questionNotes,
                    [currentQuestion.id]: e.target.value,
                  })}
                  placeholder="Write any notes or observations about this question..."
                  className="flex-1 w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b3d6e] focus:border-transparent resize-none text-sm"
                />
              </div>

              {/* Info Text + Clear highlights */}
              <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0 flex items-center justify-between gap-2">
                <p className="text-xs text-gray-500">
                  Notes & highlights are saved locally for this attempt only.
                </p>
                {(questionHighlights[`passage:${currentQuestion.id}`] || questionHighlights[`text:${currentQuestion.id}`]) && (
                  <button
                    onClick={() => {
                      setQuestionHighlights(prev => {
                        const next = { ...prev };
                        delete next[`passage:${currentQuestion.id}`];
                        delete next[`text:${currentQuestion.id}`];
                        return next;
                      });
                    }}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium flex-shrink-0"
                  >
                    <Highlighter size={11} /> Clear highlights
                  </button>
                )}
              </div>

              {/* Close Button */}
              <div className="px-5 pb-4 pt-2 border-t border-gray-100 flex-shrink-0">
                <button
                  onClick={() => setShowHighlightsNotes(false)}
                  className="w-full px-4 py-2 bg-[#1b3d6e] text-white rounded-lg font-medium text-sm hover:bg-[#152d4d] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── QUESTION PALETTE MODAL ───────────────────────────────────────────── */}
      {showPalette && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowPalette(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900 text-center flex-1 pr-6">
                {currentSection.name}
              </h3>
              <button onClick={() => setShowPalette(false)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-500 flex-shrink-0">
                <X size={18} />
              </button>
            </div>

            {/* Legend */}
            <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-6">
              {/* Current */}
              <div className="flex items-center gap-2 text-xs text-gray-700 font-medium">
                <svg width="14" height="18" viewBox="0 0 14 18" fill="none" className="text-[#1b3d6e]">
                  <path d="M7 0C3.13 0 0 3.13 0 7c0 5.25 7 11 7 11s7-5.75 7-11c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S5.62 4.5 7 4.5s2.5 1.12 2.5 2.5S8.38 9.5 7 9.5z" fill="currentColor"/>
                </svg>
                Current
              </div>
              {/* Unanswered */}
              <div className="flex items-center gap-2 text-xs text-gray-700 font-medium">
                <div className="w-6 h-6 rounded border border-dashed border-[#1b3d6e] flex-shrink-0" />
                Unanswered
              </div>
              {/* For Review */}
              <div className="flex items-center gap-2 text-xs text-gray-700 font-medium">
                <Bookmark size={14} fill="#ef4444" className="text-red-500 flex-shrink-0" />
                For Review
              </div>
            </div>

            {/* Grid */}
            <div className="px-6 pt-5 pb-3 max-h-72 overflow-y-auto">
              <div className="grid grid-cols-10 gap-2">
                {currentSection.questions.map((q, idx) => {
                  const state = getQuestionState(currentSection.id, q.id);
                  const isActive = idx === currentQIdx;
                  const isReview = state === 'marked_review' || state === 'answered_marked';
                  return (
                    <div key={q.id} className="flex flex-col items-center gap-0.5">
                      {/* Pin above current */}
                      <div className="h-4 flex items-end justify-center">
                        {isActive && (
                          <svg width="10" height="13" viewBox="0 0 14 18" fill="none">
                            <path d="M7 0C3.13 0 0 3.13 0 7c0 5.25 7 11 7 11s7-5.75 7-11c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S5.62 4.5 7 4.5s2.5 1.12 2.5 2.5S8.38 9.5 7 9.5z" fill="#1b3d6e"/>
                          </svg>
                        )}
                      </div>
                      {/* Button */}
                      <button
                        onClick={() => { saveAndNavigate(idx); setShowPalette(false); }}
                        className={`relative w-9 h-9 rounded text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-[#1b3d6e] text-white border border-[#1b3d6e]'
                            : stateColors[state]
                        }`}
                      >
                        {idx + 1}
                        {/* Bookmark badge for review */}
                        {isReview && !isActive && (
                          <span className="absolute -top-1 -right-1">
                            <Bookmark size={9} fill="#ef4444" className="text-red-500" />
                          </span>
                        )}
                        {isReview && isActive && (
                          <span className="absolute -top-1 -right-1">
                            <Bookmark size={9} fill="#ef4444" className="text-red-500" />
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats row */}
            <div className="px-6 py-3 border-t border-gray-200 grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Answered', count: answeredCount, color: 'text-[#1b3d6e]' },
                { label: 'For Review', count: Object.values(currentSectionAttempt?.questions ?? {}).filter((q) => q.state === 'marked_review' || q.state === 'answered_marked').length, color: 'text-red-500' },
                { label: 'Unanswered', count: Object.values(currentSectionAttempt?.questions ?? {}).filter((q) => q.state === 'not_answered' || q.state === 'not_visited').length, color: 'text-gray-500' },
                { label: 'Total', count: totalQInSection, color: 'text-gray-400' },
              ].map((s) => (
                <div key={s.label}>
                  <p className={`text-base font-bold ${s.color}`}>{s.count}</p>
                  <p className="text-[11px] text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Go to Review Page */}
            <div className="px-6 pb-5 pt-2 flex justify-center">
              <button
                onClick={() => { setShowPalette(false); setShowSubmitModal(true); }}
                className="px-8 py-2.5 rounded-full border border-[#1b3d6e] text-[#1b3d6e] text-sm font-semibold hover:bg-blue-50 transition-colors"
              >
                Go to Review Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DIRECTIONS MODAL ─────────────────────────────────────────────────── */}
      <Modal isOpen={showDirections} onClose={() => setShowDirections(false)} title="Directions" size="md">
        <div className="text-sm text-gray-700 leading-relaxed space-y-3">
          {isMath ? (
            <>
              <p>The questions in this section address a number of important math skills.</p>
              <p>Use of a calculator is permitted for all questions. A reference sheet, calculator, and these directions can be accessed throughout the test.</p>
              <p>Unless otherwise indicated: all variables and expressions represent real numbers, figures are drawn to scale, all figures lie in a plane, and the domain of a given function is the set of all real numbers for which the function is defined.</p>
              <p>For multiple-choice questions, solve each problem and choose the correct answer from the choices provided. For student-produced response questions, solve each problem and enter your answer.</p>
            </>
          ) : (
            <>
              <p>The questions in this section address a number of important reading and writing skills.</p>
              <p>Each question includes one or more passages, which may include a table or graph. Read each passage and question carefully, then choose the best answer to the question based on the passage(s).</p>
              <p>All questions in this section are multiple-choice with four answer choices. Each question has a single best answer.</p>
            </>
          )}
          <p className="text-gray-500">You can cross out answers you think are wrong using the cross-out tool to the right of each choice, and mark a question for review to return to it later.</p>
        </div>
      </Modal>

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

      {/* Fullscreen nudge — small non-blocking banner, test always continues */}
      {isFullscreenBlocked && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-full shadow-md flex items-center gap-2.5 text-sm font-medium whitespace-nowrap">
          <AlertTriangle size={14} />
          Not in fullscreen — this has been logged
          <button
            onClick={() => {
              document.documentElement.requestFullscreen?.().catch(() => {});
              setIsFullscreenBlocked(false);
            }}
            className="ml-1 underline text-amber-700 hover:text-amber-900"
          >
            Re-enter
          </button>
          <button onClick={() => setIsFullscreenBlocked(false)} className="ml-1 text-amber-500 hover:text-amber-700">
            <X size={13} />
          </button>
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
