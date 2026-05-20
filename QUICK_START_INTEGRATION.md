# Quick Start Guide - Integrating New Autosave System

This guide walks you through integrating the new autosave and recovery system into your existing test interface.

## 🚀 5-Minute Integration

### Step 1: Add Imports (TestInterfacePage.tsx)

```typescript
import { useAutosave } from '../../hooks/useAutosave';
import { useSectionTimer } from '../../hooks/useSectionTimer';
import { AutosaveStatus } from '../../components/common/AutosaveStatus';
import { ConnectionRecoveryBanner } from '../../components/common/ConnectionRecoveryBanner';
```

### Step 2: Initialize Hooks

Add these right after your other hooks in TestInterfacePage:

```typescript
export function TestInterfacePage() {
  // ... existing code ...

  // NEW: Add these hooks
  const {
    isSaving,
    lastSaved,
    error: autosaveError,
    saveState,
    saveAnswer,
    recoverState,
  } = useAutosave(attempt?.id);

  const {
    remainingSeconds,
    isExpired,
    timePercentage,
    formattedTime,
    syncTimer,
  } = useSectionTimer(attempt?.id, currentSection?.id, currentSection?.timeLimit);

  // ... rest of code ...
}
```

### Step 3: Update Timer Display

Replace your existing timer display code:

**OLD:**
```typescript
const { seconds: timeLeft, reset: resetTimer } = useTimer(sectionTimeSeconds - (currentSectionAttempt?.timeUsed ?? 0), handleTimerExpire);
```

**NEW:**
```typescript
// Use useSectionTimer instead - it handles all the complexity
// Just use remainingSeconds and formattedTime
```

### Step 4: Add Components to JSX

Add these to your JSX at the top:

```jsx
<div className="fixed inset-0 z-50">
  {/* Connection Recovery Banner */}
  <ConnectionRecoveryBanner onRecover={async () => {
    await syncTimer();
    await recoverState();
  }} />
</div>

{/* Autosave Status - Add to header or sidebar */}
<div className="absolute top-4 right-4">
  <AutosaveStatus
    isSaving={isSaving}
    lastSaved={lastSaved}
    error={autosaveError}
    onRetry={() => {
      // Trigger autosave when retry button clicked
      if (attempt) {
        saveState({
          currentSectionIndex: attempt.currentSectionIndex,
          currentQuestionIndex: attempt.currentQuestionIndex,
          sections: attempt.sections,
          markedForReview: [],
          tabSwitchCount: attempt.tabSwitchCount,
          isFullScreen: false,
          lastSavedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }}
  />
</div>

{/* Timer Display */}
<div className="text-lg font-bold font-mono">
  {formattedTime}
</div>

{/* Timer Progress Bar */}
<div className="h-1 bg-slate-100 rounded-full overflow-hidden">
  <div
    className={`h-full transition-all ${
      isExpired ? 'bg-red-500' :
      timePercentage > 50 ? 'bg-blue-500' :
      'bg-amber-500'
    }`}
    style={{ width: `${timePercentage}%` }}
  />
</div>
```

### Step 5: Update Autosave Calls

Replace your existing autosave calls:

**OLD:**
```typescript
api.autosaveAnswer(attempt.id, {
  questionId,
  answerGiven: toDbAnswer(...),
  timeSpentSeconds: ...,
  isFlagged: ...,
})
```

**NEW:**
```typescript
saveAnswer(
  questionId,
  toDbAnswer(...),
  currentQAttempt?.timeSpent ?? 0,
  isFlagged
);
```

### Step 6: Update State Saving

Replace periodic state saves:

**OLD:**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    api.autosaveAnswer(attempt.id, {
      attemptState: { /* state */ }
    })
  }, 8000);
  return () => clearInterval(interval);
}, [attempt])
```

**NEW:**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    saveState({
      currentSectionIndex: attempt.currentSectionIndex,
      currentQuestionIndex: attempt.currentQuestionIndex,
      sections: attempt.sections,
      markedForReview: [],
      tabSwitchCount: attempt.tabSwitchCount,
      isFullScreen: false,
      lastSavedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }, 8000);
  return () => clearInterval(interval);
}, [attempt, saveState])
```

### Step 7: That's it!

Your test interface now has:
✅ Automatic autosave
✅ Page refresh recovery
✅ Connection loss handling
✅ Server-authoritative timer
✅ Visual feedback for all states

## 🎯 Key Benefits

| Feature | Before | After |
|---------|--------|-------|
| Autosave | Manual API calls | Automatic & debounced |
| Page Refresh | Progress lost | Fully recovered |
| Connection Loss | Data lost | Automatic retry & sync |
| Timer Accuracy | Local only | Server-authoritative |
| User Feedback | None | Autosave status + banner |

## 🔍 Testing

### Test Autosave
1. Start a test
2. Answer some questions
3. Open DevTools Network tab
4. Wait 5 seconds
5. See POST to `/api/attempts/.../autosave`
6. Verify answers are saved

### Test Page Refresh Recovery
1. Start a test
2. Answer some questions
3. Note your position
4. Refresh page (F5)
5. Verify all answers are restored
6. Verify timer is correct

### Test Connection Loss
1. Start a test
2. Open DevTools → Network
3. Set throttling to "Offline"
4. Try to answer - works locally
5. ConnectionRecoveryBanner shows offline
6. Set back to normal connection
7. Banner shows "Restored"
8. Verify autosaves retried

## 📝 Example Implementation

See full example in:
- `ENHANCED_TEST_ENGINE_INTEGRATION.md` - Complete integration guide
- `frontend/src/pages/student/TestInterfacePage.tsx` - Reference implementation

## ❓ FAQ

**Q: Will this break existing functionality?**
A: No, the hooks are designed to complement existing code. You can integrate gradually.

**Q: What if Redis is down?**
A: Graceful degradation - data still saves to database on submit.

**Q: What about users with slow connections?**
A: Debouncing and optimizations ensure smooth experience even on 3G.

**Q: Can I customize the debounce interval?**
A: Yes, modify `AUTOSAVE_INTERVAL_MS` in `useAutosave.ts` (default: 5000ms).

**Q: Will this work on mobile?**
A: Yes, fully responsive and tested on mobile browsers.

## 🚨 Important Notes

1. **Always pass attemptId** to hooks - they're disabled without it
2. **Don't forget connection recovery handler** - user won't be notified of reconnection without it
3. **Test thoroughly** before deploying to production
4. **Monitor Redis** - ensure it's running and has space
5. **Watch autosave errors** - set up error logging/alerts

## ✅ Deployment Checklist

Before pushing to production:

- [ ] All components integrated
- [ ] No TypeScript errors
- [ ] Tested in development
- [ ] Tested page refresh recovery
- [ ] Tested connection loss
- [ ] Tested on mobile
- [ ] Performance is acceptable
- [ ] Error logging working
- [ ] Team trained

## 🎉 You're Done!

Your test interface now has enterprise-grade autosave and recovery. Students can now:

✅ Start a test confidently
✅ Resume after interruptions
✅ Never lose progress
✅ Take tests on any network condition
✅ Seamlessly continue after page refreshes

---

**Need Help?**
- See `ASSIGNED_TESTS_IMPLEMENTATION.md` for detailed architecture
- See `ENHANCED_TEST_ENGINE_INTEGRATION.md` for integration patterns
- Check component props in JSDoc comments
- Review hook implementations for advanced usage
