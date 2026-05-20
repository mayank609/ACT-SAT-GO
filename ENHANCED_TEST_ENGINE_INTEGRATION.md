/**
 * ENHANCED TEST ENGINE - INTEGRATION GUIDE
 * 
 * This guide shows how to enhance the existing TestInterfacePage with
 * the new autosave and recovery hooks, while maintaining backward compatibility.
 */

import { useAutosave, type AttemptState } from '../../hooks/useAutosave';
import { useSectionTimer } from '../../hooks/useSectionTimer';
import { ConnectionRecoveryBanner } from '../../components/common/ConnectionRecoveryBanner';
import { AutosaveStatus } from '../../components/common/AutosaveStatus';

/**
 * STEP 1: Add hooks to TestInterfacePage component
 * 
 * Example integration:
 */
export const EnhancedTestInterfaceExample = () => {
  // Existing code...
  const attemptId = attempt?.id;
  const currentSection = test?.sections[currentSectionIdx];
  const totalDurationMinutes = currentSection?.timeLimit;

  // NEW: Initialize autosave hook
  const {
    state: recoveredState,
    answers: recoveredAnswers,
    isSaving,
    lastSaved,
    error: autosaveError,
    saveState,
    saveAnswer,
    recoverState,
  } = useAutosave(attemptId);

  // NEW: Initialize timer hook with server sync
  const {
    remainingSeconds,
    isExpired,
    isPaused,
    timePercentage,
    formattedTime,
    syncTimer,
  } = useSectionTimer(attemptId, currentSection?.id, totalDurationMinutes);

  /**
   * STEP 2: Enhance autosave logic
   * 
   * Instead of just pushing to Redis, use the hook:
   */
  const enhancedAutosaveAttemptState = () => {
    if (!attempt) return;

    // Create state object
    const currentState: AttemptState = {
      currentSectionIndex: attempt.currentSectionIndex,
      currentQuestionIndex: attempt.currentQuestionIndex,
      sections: attempt.sections,
      markedForReview: [], // Track marked questions
      tabSwitchCount: attempt.tabSwitchCount,
      isFullScreen: false,
      lastSavedAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save using the hook (debounced automatically)
    saveState(currentState);
  };

  /**
   * STEP 3: Enhance answer saving
   * 
   * When saving individual answers:
   */
  const enhancedSaveAnswer = (
    questionId: string,
    answer: string | string[] | number | null,
    timeSpent: number,
    isFlagged: boolean
  ) => {
    // Convert to DB format as before
    const dbAnswer = toDbAnswer(currentQuestion.type, answer);

    // Save using the hook
    saveAnswer(questionId, dbAnswer, timeSpent, isFlagged);

    // Also update local store
    const newState = answer !== null ? 'answered' : 'not_answered';
    updateQuestionState(currentSection.id, questionId, newState, answer);
  };

  /**
   * STEP 4: Add connection recovery
   * 
   * When connection is restored:
   */
  const handleConnectionRecover = async () => {
    // Sync timer with server
    await syncTimer();

    // Recover any failed autosaves
    await recoverState();

    // Continue where user left off
    console.log('Connection recovered - progress intact');
  };

  /**
   * STEP 5: Render new components
   * 
   * Add to component JSX:
   */
  return (
    <div>
      {/* NEW: Connection recovery banner */}
      <ConnectionRecoveryBanner onRecover={handleConnectionRecover} />

      {/* Existing test interface... */}

      {/* NEW: Autosave status indicator */}
      <div className="absolute top-4 right-4 z-40">
        <AutosaveStatus
          isSaving={isSaving}
          lastSaved={lastSaved}
          error={autosaveError}
          onRetry={() => enhancedAutosaveAttemptState()}
        />
      </div>

      {/* Timer with new styling */}
      <div
        className={`text-lg font-bold transition-colors ${
          isPaused ? 'text-amber-600' :
          isExpired ? 'bg-red-600 animate-pulse' : 'bg-slate-700'
        }`}
      >
        {formattedTime}
        {isPaused && <span className="text-xs ml-1">(paused)</span>}
      </div>

      {/* Timer progress bar */}
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isPaused ? 'bg-amber-500' :
            isExpired ? 'bg-red-500' :
            timePercentage > 50 ? 'bg-blue-500' :
            timePercentage > 25 ? 'bg-amber-500' :
            'bg-red-500'
          }`}
          style={{ width: `${timePercentage}%` }}
        />
      </div>
    </div>
  );
};

/**
 * STEP 6: Update useEffect hooks
 * 
 * Modify autosave interval:
 */
export const AutosaveIntervalExample = () => {
  const { saveState } = useAutosave();

  // Instead of manual interval, use the hook's debounced saveState
  // The hook handles debouncing internally (1 second)
  
  // But if you need a periodic sync to server:
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     saveState(currentAttemptState);
  //   }, 8000); // 8 seconds
  //   return () => clearInterval(interval);
  // }, []);
};

/**
 * STEP 7: Timer sync strategy
 * 
 * The useSectionTimer hook automatically:
 * - Syncs every 30 seconds
 * - Syncs on visibility change
 * - Syncs on reconnection
 * - Counts down locally for smooth UX
 * 
 * This provides:
 * - Accuracy (server-authoritative)
 * - Responsiveness (local countdown)
 * - Resilience (automatic recovery)
 */

/**
 * STEP 8: Error recovery flow
 * 
 * When autosave fails:
 * 1. AutosaveStatus shows error
 * 2. Answer remains in local state
 * 3. Retry button retriggers save
 * 4. On connection recovery, saves retry automatically
 * 
 * When connection is lost:
 * 1. ConnectionRecoveryBanner shows "Connection lost"
 * 2. Timer pauses visually
 * 3. Answers continue to be tracked locally
 * 4. Page refresh will recover everything
 * 5. User can manually click "Sync Now" when reconnected
 */

export const RecoveryWorkflowExample = {
  description: 'Complete recovery workflow',
  
  scenario1_PageRefresh: {
    steps: [
      '1. User in middle of test when page refreshes',
      '2. attemptId passed via URL query parameter',
      '3. TestInterfacePage detects attemptId',
      '4. useAutosave.recoverState() called automatically',
      '5. Fetches saved answers and state from Redis/DB',
      '6. useSectionTimer syncs remaining time with server',
      '7. useTestStore restored with all saved data',
      '8. User sees exact same state as before refresh',
      '9. Can continue testing seamlessly'
    ]
  },

  scenario2_ConnectionLoss: {
    steps: [
      '1. User loses network connection',
      '2. ConnectionRecoveryBanner shows "Connection lost"',
      '3. Timer pauses display (isPaused = true)',
      '4. Autosave attempts retry (fails silently)',
      '5. Answers tracked in memory',
      '6. User can continue answering questions',
      '7. When connection restored:',
      '   a. ConnectionRecoveryBanner shows "Connected"',
      '   b. syncTimer() calls resync',
      '   c. Failed autosaves retry automatically',
      '   d. Timer updates from server'
    ]
  },

  scenario3_TabSwitch: {
    steps: [
      '1. User switches to another tab',
      '2. visibilitychange event fires',
      '3. Timer pauses (isPaused = true)',
      '4. useSectionTimer stops countdown',
      '5. User switches back to test tab',
      '6. visibilitychange event fires again',
      '7. Timer syncs with server',
      '8. Countdown resumes from correct value',
      '9. Tab switch logged to CheatingLog'
    ]
  },

  scenario4_ManualSave: {
    steps: [
      '1. User on last question of last section',
      '2. Clicks "Submit Test"',
      '3. Modal appears with summary',
      '4. Manual save triggered: saveState(currentState)',
      '5. Manual submit triggered: api.submitSection()',
      '6. Backend calculates score',
      '7. Redirect to review page',
      '8. User can review all details'
    ]
  }
};

/**
 * BEST PRACTICES
 * 
 * 1. Always pass attemptId to hooks
 * 2. Call saveState() only when needed (submit, nav)
 * 3. Let useAutosave handle debouncing
 * 4. Trust useSectionTimer for accuracy
 * 5. Show AutosaveStatus for transparency
 * 6. Handle ConnectionRecoveryBanner gracefully
 * 7. Test all scenarios before deployment
 * 8. Monitor Redis for data persistence
 * 9. Log errors for debugging
 * 10. Consider user experience above all
 */
