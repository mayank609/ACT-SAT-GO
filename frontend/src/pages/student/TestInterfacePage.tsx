import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag, ChevronLeft, ChevronRight, Send, AlertTriangle } from 'lucide-react';
import { useTestStore } from '../../store/useTestStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import type { QuestionState } from '../../types';

function useTimer(initialSeconds: number, onExpire: () => void) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (seconds <= 0) {
      onExpire();
      return;
    }
    intervalRef.current = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [seconds]);

  const reset = (s: number) => setSeconds(s);
  return { seconds, reset };
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const stateColors: Record<QuestionState, string> = {
  not_visited: 'bg-slate-200 text-slate-600',
  not_answered: 'bg-red-500 text-white',
  answered: 'bg-emerald-500 text-white',
  marked_review: 'bg-purple-500 text-white',
  answered_marked: 'bg-blue-500 text-white',
};

export function TestInterfacePage() {
  const navigate = useNavigate();
  const { currentAttempt, activeTest, updateQuestionState, navigateToQuestion, advanceSection, completeAttempt, recordTabSwitch } = useTestStore();
  const { user } = useAuthStore();

  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | number | null>(null);
  const [numericInput, setNumericInput] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [tabSwitchWarning, setTabSwitchWarning] = useState(false);
  const [showPalette, setShowPalette] = useState(true);

  const questionTimeRef = useRef(0);
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const test = activeTest;
  const attempt = currentAttempt;

  // Redirect if no active test
  useEffect(() => {
    if (!test || !attempt) {
      navigate('/dashboard');
    }
  }, [test, attempt, navigate]);

  const currentSectionIdx = attempt?.currentSectionIndex ?? 0;
  const currentQIdx = attempt?.currentQuestionIndex ?? 0;
  const currentSection = test?.sections[currentSectionIdx];
  const currentQuestion = currentSection?.questions[currentQIdx];
  const currentSectionAttempt = attempt && currentSection ? attempt.sections[currentSection.id] : null;
  const currentQAttempt = currentQuestion && currentSectionAttempt ? currentSectionAttempt.questions[currentQuestion.id] : null;

  // Timer
  const sectionTimeSeconds = (currentSection?.timeLimit ?? 45) * 60;
  const handleTimerExpire = useCallback(() => {
    if (test && currentSectionIdx < test.sections.length - 1) {
      advanceSection();
    } else {
      handleFinalSubmit();
    }
  }, [currentSectionIdx, test]);

  const { seconds: timeLeft, reset: resetTimer } = useTimer(
    sectionTimeSeconds - (currentSectionAttempt?.timeUsed ?? 0),
    handleTimerExpire
  );

  // Track tab visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        recordTabSwitch();
        setTabSwitchWarning(true);
        setTimeout(() => setTabSwitchWarning(false), 3000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [recordTabSwitch]);

  // Per-question timer
  useEffect(() => {
    questionTimeRef.current = 0;
    questionTimerRef.current = setInterval(() => { questionTimeRef.current += 1; }, 1000);
    return () => { if (questionTimerRef.current) clearInterval(questionTimerRef.current); };
  }, [currentQIdx, currentSectionIdx]);

  // Load existing answer when navigating
  useEffect(() => {
    if (currentQAttempt) {
      const ans = currentQAttempt.selectedAnswer;
      setSelectedAnswer(ans ?? null);
      setNumericInput(typeof ans === 'number' ? String(ans) : '');
    } else {
      setSelectedAnswer(null);
      setNumericInput('');
    }
  }, [currentQuestion?.id]);

  if (!test || !attempt || !currentSection || !currentQuestion) {
    return null;
  }

  const totalQInSection = currentSection.questions.length;
  const isLastQuestion = currentQIdx === totalQInSection - 1;
  const isLastSection = currentSectionIdx === test.sections.length - 1;

  const getQuestionState = (sectionId: string, qId: string): QuestionState => {
    return attempt.sections[sectionId]?.questions[qId]?.state ?? 'not_visited';
  };

  const saveAndNavigate = (nextQIdx: number, nextSectionIdx?: number) => {
    if (!currentSection) return;
    const finalAns = currentQuestion.type === 'numeric' ? (parseFloat(numericInput) || null) : selectedAnswer;
    const hasAnswer = finalAns !== null && finalAns !== '' && !(Array.isArray(finalAns) && finalAns.length === 0);
    const prevState = getQuestionState(currentSection.id, currentQuestion.id);
    const newState: QuestionState = hasAnswer
      ? (prevState === 'marked_review' || prevState === 'answered_marked' ? 'answered_marked' : 'answered')
      : (prevState === 'marked_review' || prevState === 'answered_marked' ? 'marked_review' : 'not_answered');
    updateQuestionState(currentSection.id, currentQuestion.id, newState, finalAns);

    if (nextSectionIdx !== undefined) {
      advanceSection();
      resetTimer((test.sections[nextSectionIdx]?.timeLimit ?? 45) * 60);
    } else {
      navigateToQuestion(currentSectionIdx, nextQIdx);
    }
  };

  const markForReview = () => {
    if (!currentSection) return;
    const finalAns = currentQuestion.type === 'numeric' ? (parseFloat(numericInput) || null) : selectedAnswer;
    const hasAnswer = finalAns !== null && finalAns !== '';
    updateQuestionState(currentSection.id, currentQuestion.id, hasAnswer ? 'answered_marked' : 'marked_review', finalAns);
    if (!isLastQuestion) {
      navigateToQuestion(currentSectionIdx, currentQIdx + 1);
    }
  };

  const clearResponse = () => {
    setSelectedAnswer(null);
    setNumericInput('');
  };

  const handleFinalSubmit = () => {
    completeAttempt();
    navigate('/dashboard');
  };

  const pct = Math.round(((sectionTimeSeconds - timeLeft) / sectionTimeSeconds) * 100);
  const isLowTime = timeLeft < 300;

  return (
    <div className="flex flex-col min-h-screen bg-slate-100">
      {/* Tab switch warning */}
      {tabSwitchWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium">
          <AlertTriangle size={16} />
          Tab switch detected! This has been logged.
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-800 text-white px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">A</div>
            <div className="hidden sm:block">
              <p className="text-xs text-slate-400">Candidate</p>
              <p className="text-sm font-medium">{user?.name}</p>
            </div>
          </div>

          <div className="text-center hidden sm:block">
            <p className="text-xs text-slate-400">Test</p>
            <p className="text-sm font-medium truncate max-w-48">{test.title}</p>
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold ${isLowTime ? 'bg-red-600 animate-pulse' : 'bg-slate-700'}`}>
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      {/* Section tabs */}
      <div className="bg-white border-b border-slate-200 px-4">
        <div className="max-w-6xl mx-auto flex gap-1 overflow-x-auto py-2">
          {test.sections.map((sec, idx) => (
            <div
              key={sec.id}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                idx === currentSectionIdx
                  ? 'bg-blue-600 text-white'
                  : idx < currentSectionIdx
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {sec.name}
            </div>
          ))}
        </div>
        {/* Time progress bar */}
        <div className="max-w-6xl mx-auto pb-2">
          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isLowTime ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex max-w-6xl mx-auto w-full gap-4 p-4">
        {/* Question area */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Question */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex-1">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-500">Question {currentQIdx + 1}</span>
                <span className="text-slate-300">/</span>
                <span className="text-sm text-slate-400">{totalQInSection}</span>
              </div>
              <div className="flex items-center gap-2">
                {currentQAttempt?.timeSpent && currentQAttempt.timeSpent > 0 && (
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                    {currentQAttempt.timeSpent}s spent
                  </span>
                )}
                <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                  currentQuestion.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700' :
                  currentQuestion.difficulty === 'medium' ? 'bg-amber-50 text-amber-700' :
                  'bg-red-50 text-red-700'
                }`}>
                  {currentQuestion.difficulty}
                </span>
                {currentQuestion.topic && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{currentQuestion.topic}</span>
                )}
              </div>
            </div>

            <div className="text-base text-slate-900 leading-relaxed mb-6">
              {currentQuestion.text || `Question ${currentQIdx + 1}: This is a sample question for ${currentSection.name}.`}
            </div>

            {/* Options */}
            {(currentQuestion.type === 'mcq_single' || currentQuestion.type === 'mcq_multi') && currentQuestion.options && (
              <div className="space-y-2.5">
                {currentQuestion.options.map((opt) => {
                  const isSelected = currentQuestion.type === 'mcq_multi'
                    ? Array.isArray(selectedAnswer) && selectedAnswer.includes(opt.id)
                    : selectedAnswer === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        if (currentQuestion.type === 'mcq_multi') {
                          const curr = Array.isArray(selectedAnswer) ? selectedAnswer as string[] : [];
                          setSelectedAnswer(
                            curr.includes(opt.id) ? curr.filter((x) => x !== opt.id) : [...curr, opt.id]
                          );
                        } else {
                          setSelectedAnswer(opt.id);
                        }
                      }}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${
                        isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 text-slate-500'
                      }`}>
                        {opt.id.toUpperCase()}
                      </div>
                      <span className={`text-sm ${isSelected ? 'text-blue-900 font-medium' : 'text-slate-700'}`}>
                        {opt.text || `Option ${opt.id.toUpperCase()}: Sample answer choice`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Numeric */}
            {currentQuestion.type === 'numeric' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Enter your answer:</label>
                <input
                  type="number"
                  value={numericInput}
                  onChange={(e) => setNumericInput(e.target.value)}
                  placeholder="Type numeric answer here"
                  className="w-48 px-4 py-3 border-2 border-slate-200 rounded-xl text-lg focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={clearResponse}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Flag size={13} />}
                  onClick={markForReview}
                  className="border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  Mark for Review
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    markForReview();
                    saveAndNavigate(currentQIdx + 1);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Save & Mark for Review
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ChevronLeft size={13} />}
                  disabled={currentQIdx === 0}
                  onClick={() => navigateToQuestion(currentSectionIdx, currentQIdx - 1)}
                >
                  Back
                </Button>
                {isLastQuestion && isLastSection ? (
                  <Button
                    size="sm"
                    variant="success"
                    icon={<Send size={13} />}
                    onClick={() => setShowSubmitModal(true)}
                  >
                    Submit Test
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    icon={<ChevronRight size={13} />}
                    iconRight
                    onClick={() => {
                      if (isLastQuestion) {
                        saveAndNavigate(0, currentSectionIdx + 1);
                      } else {
                        saveAndNavigate(currentQIdx + 1);
                      }
                    }}
                  >
                    Save & Next
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Question palette */}
        <div className={`transition-all duration-300 ${showPalette ? 'w-64' : 'w-0 overflow-hidden'}`}>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sticky top-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">{currentSection.name}</h3>
              <button onClick={() => setShowPalette(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-1.5 mb-4 text-xs">
              {[
                { color: 'bg-slate-200', label: 'Not Visited' },
                { color: 'bg-red-500', label: 'Not Answered' },
                { color: 'bg-emerald-500', label: 'Answered' },
                { color: 'bg-purple-500', label: 'Marked' },
                { color: 'bg-blue-500', label: 'Ans+Marked' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={`w-4 h-4 rounded-full ${item.color}`} />
                  <span className="text-slate-500 text-xs">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Question grid */}
            <div className="grid grid-cols-6 gap-1.5 max-h-80 overflow-y-auto">
              {currentSection.questions.map((q, idx) => {
                const state = getQuestionState(currentSection.id, q.id);
                const isActive = idx === currentQIdx;
                return (
                  <button
                    key={q.id}
                    onClick={() => navigateToQuestion(currentSectionIdx, idx)}
                    className={`
                      w-8 h-8 rounded-lg text-xs font-bold transition-all
                      ${stateColors[state]}
                      ${isActive ? 'ring-2 ring-offset-1 ring-slate-500 scale-110' : ''}
                    `}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Stats */}
            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'Answered', color: 'text-emerald-600', count: Object.values(currentSectionAttempt?.questions ?? {}).filter((q) => q.state === 'answered' || q.state === 'answered_marked').length },
                { label: 'Marked', color: 'text-purple-600', count: Object.values(currentSectionAttempt?.questions ?? {}).filter((q) => q.state === 'marked_review' || q.state === 'answered_marked').length },
                { label: 'Not Ans.', color: 'text-red-500', count: Object.values(currentSectionAttempt?.questions ?? {}).filter((q) => q.state === 'not_answered').length },
                { label: 'Unvisited', color: 'text-slate-500', count: Object.values(currentSectionAttempt?.questions ?? {}).filter((q) => q.state === 'not_visited').length },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className={`text-base font-bold ${s.color}`}>{s.count}</p>
                  <p className="text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {!showPalette && (
          <button
            onClick={() => setShowPalette(true)}
            className="self-start sticky top-4 px-2 py-4 bg-blue-600 text-white rounded-xl text-xs font-medium writing-mode-vertical"
            style={{ writingMode: 'vertical-rl' }}
          >
            Palette
          </button>
        )}
      </div>

      {/* Submit modal */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Test"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowSubmitModal(false)}>Review Answers</Button>
            <Button variant="success" size="sm" icon={<Send size={14} />} onClick={handleFinalSubmit}>Submit Final</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">You are about to submit your test. Please review the summary:</p>
          {test.sections.map((sec) => {
            const secAtt = attempt.sections[sec.id];
            const answered = Object.values(secAtt?.questions ?? {}).filter((q) => q.state === 'answered' || q.state === 'answered_marked').length;
            const total = sec.questions.length;
            return (
              <div key={sec.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-medium text-slate-700">{sec.name}</span>
                <span className={`text-sm font-bold ${answered === total ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {answered}/{total} answered
                </span>
              </div>
            );
          })}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            Once submitted, you cannot go back to change your answers.
          </div>
        </div>
      </Modal>
    </div>
  );
}
