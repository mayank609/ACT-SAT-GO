# Time Tracking Testing Guide

## Summary of Changes Made

✅ **Frontend autosave enhanced** (TestInterfacePage.tsx)
- Now saves the current question's accumulated time every 8 seconds
- Saves ALL questions' time data on page unload using browser sendBeacon
- Added detailed logging with `[Test]` and `[AutosavePeriodic]` prefixes

✅ **Backend logging enhanced**  
- autosave endpoint: logs each question's time as `[Autosave] Attempt {id}: Q{qId} = {time}s`
- submit endpoint: logs answers flushed to database with time values
- analytics endpoint: logs each question's time data as it processes

✅ **Fallback logic added**
- Analytics reconstructs time data from answers if test structure incomplete

## Current Baseline

**Before changes:**
- Only **1 of 13** attempts (8%) have time data
- Only **5 of 141** questions (3.5%) have recorded time
- 12 attempts show 0s for ALL questions

## Step-by-Step Testing

### 1. Deploy Changes

```powershell
# Option A: If using Vercel/Render (production)
git add .
git commit -m "Enhance time tracking with periodic autosave and sendBeacon"
git push

# Option B: If testing locally
# Frontend is already built, backend runs on next deploy
```

### 2. Verify Logging is Working

**In Browser DevTools (F12):**
1. Open Console tab
2. Go to test-taking interface
3. Start a test attempt
4. Answer a question and view it for 10+ seconds
5. Check Console for logs like:
   ```
   [Test] Autosaving...
   [AutosavePeriodic] Saving current Q: Xs
   ```

**On Server (check logs):**
1. Look for entries like:
   ```
   [Autosave] Attempt abc123: Q1 = 8s
   [Autosave] Attempt abc123: Q2 = 5s
   ```

### 3. Test Normal Attempt Flow

1. **Student takes a test:**
   - Spend 10+ seconds on each question
   - Navigate between questions
   - Answer all questions
   - Mark one for review
   - Submit the section

2. **Monitor console logs:**
   - Every 8 seconds: Should see `[AutosavePeriodic]` logs
   - On question change: Should see time being autosaved
   - On page close: All times should be saved via sendBeacon

3. **Check server logs:**
   - Should see `[Autosave]` logs with time values
   - On submit: Should see submit logs with time data

### 4. Verify Data Persists

After test is submitted:

```bash
cd platform
npx ts-node scripts/verify-time-tracking.ts
```

**Expected:**
- The new attempt should show time data
- Should see improvement from baseline (8% → higher %)
- Questions should have time between 3-120 seconds

### 5. Check Analytics Display

1. Go to Admin → Analytics
2. Select the student who just took the test
3. Select the attempt they just completed
4. Go to "Time per Question" tab

**Expected:**
- Should see bar chart with colored bars
- Hover over bars to see individual times
- Should show avg, slow (≥90s), and rushed (<20s) counts
- Question log should list each question with its time

## Troubleshooting

### Time data not appearing in analytics?

**Check 1: Frontend is sending time**
```
DevTools Console → Look for [AutosavePeriodic] logs
```

**Check 2: Backend is receiving time**
```
Server logs → Look for [Autosave] logs with Q{id} = {time}s
```

**Check 3: Database has the data**
```bash
# Check if specific attempt has time data
npx ts-node scripts/check-time-data.ts [attempt-id]
```

**Check 4: Analytics is retrieving time**
```
Server logs → Look for [Analytics] logs with time breakdown
```

### If time still isn't showing:

1. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)
2. **Check test structure**: Run `npx ts-node scripts/verify-time-tracking.ts` to see if questions are properly linked
3. **Check frontend build**: Ensure `npm run build` completed without errors
4. **Check backend**: Ensure autosave endpoint is responsive

## Key Files Modified

| File | Change | Effect |
|------|--------|--------|
| `frontend/src/pages/student/TestInterfacePage.tsx` | Enhanced autosave + page unload handler | Time saved every 8s + on close |
| `platform/src/app/api/attempts/[attemptId]/autosave/route.ts` | Added logging | Track data flow |
| `platform/src/actions/test-engine-actions.ts` | Added submit logging | Verify persistence |
| `platform/src/app/api/analytics/student/[studentId]/route.ts` | Enhanced logging + fallback | Debug data gaps |

## Expected Improvements After Changes

- ✅ Time captured for 100% of questions (vs 3.5%)
- ✅ Average 8-20 seconds per question (depends on difficulty)
- ✅ Time analytics graph populated with data
- ✅ Time data persists even if user closes browser mid-test

## Verification Checklist

- [ ] Frontend builds without errors
- [ ] New student attempt shows time logs in console
- [ ] Server logs show `[Autosave]` entries with time values
- [ ] After submission, analytics show Time per Question graph
- [ ] Verification script shows improvement in coverage
- [ ] All 3 students' future attempts have time data

---

**Need to test now?** Have a student take a test and share the student email so we can verify the data flow.
