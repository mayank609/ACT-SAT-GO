import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag, ChevronLeft, ChevronRight, Send, AlertTriangle, Grid3X3 } from 'lucide-react';
import { useTestStore } from '../../store/useTestStore';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import type { QuestionState } from '../../types';

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
function toDbAnswer(type: string, answer: string | string[] | number | null): unknown {
  if (answer === null || answer === '' || (Array.isArray(answer) && answer.length === 0)) return null;
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
  const navigate = useNavigate();
  const { currentAttempt, activeTest, updateQuestionState, navigateToQuestion, advanceSection, recordTabSwitch, clearAttempt } = useTestStore();
  const { user } = useAuthStore();

  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | number | null>(null);
  const [numericInput, setNumericInput] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [tabSwitchWarning, setTabSwitchWarning] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref so timer-expire callback always sees latest reset function
  const resetTimerRef = useRef<(s: number) => void>(() => {});
  // Ref so timer-expire callback always sees latest component state
  const timerExpireHandlerRef = useRef<() => void>(() => {});

  const test = activeTest;
  const attempt = currentAttempt;

  useEffect(() => {
    if (!test || !attempt) navigate('/dashboard');
  }, [test, attempt, navigate]);

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
      await api.submitSection(attempt.id, fromSectionId);
      const result = await api.startSection(attempt.id, test.sections[toSectionIdx].id) as { endTime: number };
      resetTimerRef.current(Math.max(10, Math.floor((result.endTime - Date.now()) / 1000)));
    } catch {
      resetTimerRef.current((test.sections[toSectionIdx]?.timeLimit ?? 45) * 60);
    }
  };

  const doFinalSubmit = async () => {
    if (!attempt || !currentSection || !currentQuestion) return;
    const finalAns = currentQuestion.type === 'numeric' ? (parseFloat(numericInput) || null) : selectedAnswer;
    // Autosave last question's answer
    api.autosaveAnswer(attempt.id, {
      questionId: currentQuestion.id,
      answerGiven: toDbAnswer(currentQuestion.type, finalAns),
      timeSpentSeconds: currentQAttempt?.timeSpent ?? 0,
      isFlagged: false,
    }).catch(() => {});
    // Submit last section (also triggers score calculation in backend)
    await api.submitSection(attempt.id, currentSection.id).catch(() => {});
    clearAttempt();
    navigate(`/test-review/${attempt.id}`);
  };

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

  // ── Side effects ─────────────────────────────────────────────────────────────

  // Fullscreen Exit Tracking
  useEffect(() => {
    if (!attempt) return;
    document.documentElement.requestFullscreen?.().catch(() => {});
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        api.logCheatingEvent(attempt.id, 'FULLSCREEN_EXIT', {
          timestamp: new Date().toISOString(),
        }).catch(() => {});
        setTimeout(() => document.documentElement.requestFullscreen?.().catch(() => {}), 1000);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [attempt]);

  // Tab switching Tracking
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        recordTabSwitch();
        if (attempt) {
          api.logCheatingEvent(attempt.id, 'TAB_SWITCH', {
            count: (attempt.tabSwitchCount ?? 0) + 1,
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        }
        setTabSwitchWarning(true);
        setTimeout(() => setTabSwitchWarning(false), 3000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [recordTabSwitch, attempt]);

  // Inactivity Tracking
  useEffect(() => {
    if (!attempt) return;
    let inactivityTimeout: ReturnType<typeof setTimeout>;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(() => {
        api.logCheatingEvent(attempt.id, 'INACTIVITY', {
          timestamp: new Date().toISOString(),
          durationSeconds: 60,
        }).catch(() => {});
      }, 60000);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(ev => window.addEventListener(ev, resetInactivityTimer));
    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimeout);
      events.forEach(ev => window.removeEventListener(ev, resetInactivityTimer));
    };
  }, [attempt]);

  // Copy/Paste and Right-Click Tracking
  useEffect(() => {
    if (!attempt) return;

    const handleCopy = () => {
      api.logCheatingEvent(attempt.id, 'SUSPICIOUS_INPUT', {
        type: 'copy',
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    };

    const handlePaste = () => {
      api.logCheatingEvent(attempt.id, 'SUSPICIOUS_INPUT', {
        type: 'paste',
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      api.logCheatingEvent(attempt.id, 'SUSPICIOUS_INPUT', {
        type: 'right_click',
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [attempt]);

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

    updateQuestionState(currentSection.id, currentQuestion.id, newState, finalAns);

    // Autosave to Redis
    api.autosaveAnswer(attempt.id, {
      questionId: currentQuestion.id,
      answerGiven: toDbAnswer(currentQuestion.type, finalAns),
      timeSpentSeconds: currentQAttempt?.timeSpent ?? 0,
      isFlagged: newState === 'marked_review' || newState === 'answered_marked',
    }).catch(() => {});

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
    updateQuestionState(currentSection.id, currentQuestion.id, hasAnswer ? 'answered_marked' : 'marked_review', finalAns);
    api.autosaveAnswer(attempt.id, {
      questionId: currentQuestion.id,
      answerGiven: toDbAnswer(currentQuestion.type, finalAns),
      timeSpentSeconds: currentQAttempt?.timeSpent ?? 0,
      isFlagged: true,
    }).catch(() => {});
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
    <div className="flex flex-col min-h-screen bg-slate-100">
      {tabSwitchWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium whitespace-nowrap">
          <AlertTriangle size={15} /> Tab switch detected! Logged.
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-800 text-white px-3 md:px-4 py-2.5 md:py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
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
        <div className="max-w-6xl mx-auto flex gap-1 overflow-x-auto py-2 scrollbar-hide">
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
        <div className="max-w-6xl mx-auto pb-2">
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isLowTime ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="flex-1 flex max-w-6xl mx-auto w-full gap-3 md:gap-4 p-3 md:p-4">
        {/* Question area */}
        <div className="flex-1 flex flex-col gap-3 md:gap-4 min-w-0">
          <div className="bg-white rounded-xl md:rounded-2xl border border-slate-200 p-4 md:p-6 flex-1">
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
              {currentQuestion.text || `Question ${currentQIdx + 1}`}
            </div>

            {/* MCQ options */}
            {(currentQuestion.type === 'mcq_single' || currentQuestion.type === 'mcq_multi') && currentQuestion.options && (
              <div className="space-y-2">
                {currentQuestion.options.map((opt) => {
                  const isSelected = currentQuestion.type === 'mcq_multi'
                    ? Array.isArray(selectedAnswer) && selectedAnswer.includes(opt.id)
                    : selectedAnswer === opt.id;
                  return (
                    <button key={opt.id} onClick={() => {
                      if (currentQuestion.type === 'mcq_multi') {
                        const curr = Array.isArray(selectedAnswer) ? selectedAnswer as string[] : [];
                        setSelectedAnswer(curr.includes(opt.id) ? curr.filter((x) => x !== opt.id) : [...curr, opt.id]);
                      } else {
                        setSelectedAnswer(opt.id);
                      }
                    }}
                      className={`w-full flex items-center gap-3 p-3 md:p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}>
                      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 text-slate-500'
                      }`}>{opt.id.toUpperCase()}</div>
                      <span className={`text-sm ${isSelected ? 'text-blue-900 font-medium' : 'text-slate-700'}`}>{opt.text}</span>
                    </button>
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

          {/* Action buttons */}
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

        {/* Desktop palette */}
        <div className="hidden md:block w-56 lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sticky top-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">{currentSection.name}</h3>
            <div className="grid grid-cols-2 gap-1 mb-3 text-xs">
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
            <div className="grid grid-cols-6 gap-1 max-h-72 overflow-y-auto">
              {currentSection.questions.map((q, idx) => {
                const state = getQuestionState(currentSection.id, q.id);
                const isActive = idx === currentQIdx;
                return (
                  <button key={q.id} onClick={() => navigateToQuestion(currentSectionIdx, idx)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${stateColors[state]} ${isActive ? 'ring-2 ring-offset-1 ring-slate-500 scale-110' : ''}`}>
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
    </div>
  );
}
