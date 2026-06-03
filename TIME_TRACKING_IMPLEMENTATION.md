# Time Per Question Tracking - Complete Implementation

## 🔍 **Problem Found**
- Only **1 out of 13** submitted attempts (8%) had time data
- Only **5 out of 141** total questions (3.5%) had recorded time
- 92% of attempts showed zero time for ALL questions

## ✅ **Root Causes Identified**

1. **Insufficient Autosave Frequency**
   - Time was only being saved when user moved to next question
   - No periodic autosave of accumulated time data
   - If user spent time on last question before submitting, time wasn't always captured

2. **Missing Page Unload Handler**
   - Time data wasn't being saved when page was unloaded/closed
   - Critical data loss when browser tab was closed

3. **Lack of Comprehensive Logging**
   - Difficult to debug where time data was being lost

## 🔧 **Fixes Implemented**

### **1. Frontend - Enhanced Autosave (TestInterfacePage.tsx)**

**Change**: Modified periodic autosave to also save current question time
- Every 8 seconds: Save attempt state AND current question time
- On page unload: Save ALL questions' accumulated time using `navigator.sendBeacon`
- Added logging at each save point

**Code Location**: `frontend/src/pages/student/TestInterfacePage.tsx` (lines ~443-481, ~527-564)

```typescript
// Now saves the currently viewed question's time every 8 seconds
if (timeSpent > 0) {
  api.autosaveAnswer(attempt.id, {
    questionId: currentQuestion.id,
    timeSpentSeconds: timeSpent,
    ...
  })
}

// On unload, save all questions using sendBeacon (survives page close)
navigator.sendBeacon('/api/attempts/beacon-time', payload)
```

### **2. Backend - Detailed Logging (analytics endpoint)**

**File**: `platform/src/app/api/analytics/student/[studentId]/route.ts`

- Added comprehensive logging for debugging
- Logs each question's time data as it processes
- Shows section structure and data flow
- Helps identify where time data is missing

**Example Log Output**:
```
[Analytics] ======== PROCESSING ATTEMPT xxx ========
[Analytics] Attempt has 5 answers
[Analytics] Time breakdown: Q1=6s, Q2=3s, Q3=22s, Q4=3s, Q5=5s
[Analytics] Section "HA" has 5 questions
[Analytics]   Q1: 6s (correct) - Topic Name
[Analytics]   Q2: 3s (incorrect) - Topic Name
```

### **3. Backend - Autosave Logging**

**File**: `platform/src/app/api/attempts/[attemptId]/autosave/route.ts`

- Logs each question being saved with its time
- Format: `[Autosave] Attempt {id}: Q{questionId} = {time}s`
- Helps track data from frontend → Redis

### **4. Backend - Submit Logging**

**File**: `platform/src/actions/test-engine-actions.ts`

- Logs all answers being flushed from Redis to PostgreSQL
- Shows which questions have time data during submission
- Helps verify data persistence

### **5. Backend - Fallback Logic**

**File**: `platform/src/app/api/analytics/student/[studentId]/route.ts`

- If test questions aren't properly linked to sections
- Analytics reconstructs time data from answers
- Ensures data is never lost due to schema issues

### **6. Verification Scripts**

**New Script**: `platform/scripts/verify-time-tracking.ts`
- Checks all students' attempts
- Shows which have time data and which don't
- Provides summary statistics

**Run**: `npx ts-node scripts/verify-time-tracking.ts`

## 📊 **What Should Now Work**

### **For Students During Test**:
- ✅ Time tracked every 1 second while viewing a question
- ✅ Time saved every 8 seconds (periodic autosave)
- ✅ Time saved when moving to next question
- ✅ Time saved when marking for review
- ✅ Time saved on page unload/close
- ✅ Time saved when submitting section

### **For Analytics**:
- ✅ Time per question displayed in "Time per Question" graph
- ✅ Shows avg, slow (≥90s), and rushed (<20s) counts
- ✅ Color-coded by result (correct/incorrect/skipped)
- ✅ Question log shows individual times
- ✅ Works even if test structure is incomplete (fallback)

## 🧪 **Testing Instructions**

### **1. Check Current Data**
```bash
cd platform
npx ts-node scripts/verify-time-tracking.ts
```
Expected: Should show if recent attempts have time data

### **2. Test with New Attempt**
1. Go to Analytics
2. Have a student take a test
3. Check browser DevTools (F12) for logs starting with `[Test]`, `[AutosavePeriodic]`
4. Check server logs for `[Autosave]`, `[Submit]`, `[Analytics]` logs

### **3. Verify in Analytics**
1. After test completion
2. Go to Admin → Analytics
3. Select student and attempt
4. Check "Time per Question" graph - should show bars with colors

## 🔍 **Debugging Checklist**

If time data still isn't showing:

1. **Check Frontend Logs**:
   - Open DevTools → Console
   - Should see `[Test] Autosaving...` logs
   - Should see `[AutosavePeriodic]...` logs

2. **Check Server Logs**:
   - Should see `[Autosave]` logs when frontend sends data
   - Should see `[Submit]` logs when section is submitted
   - Should see `[Analytics]` logs when analytics are retrieved

3. **Verify Database**:
   ```bash
   npx ts-node scripts/verify-time-tracking.ts [student-email]
   ```
   Check if recent attempts have time data

4. **Check Test Structure**:
   - Ensure test has TestQuestion links
   - Run verify script to see test structure

## 📝 **Summary of Changes**

| File | Changes | Impact |
|------|---------|--------|
| TestInterfacePage.tsx | Enhanced autosave to save current Q time every 8s | ✅ Time saved periodically |
| TestInterfacePage.tsx | Added page unload handler with sendBeacon | ✅ Time saved on page close |
| autosave/route.ts | Added logging | ✅ Better debugging |
| test-engine-actions.ts | Added submit logging | ✅ Track persistence |
| analytics/route.ts | Added detailed logging + fallback | ✅ Recover from data gaps |
| analytics/route.ts | Enhanced question-level logging | ✅ See every question's time |
| verify-time-tracking.ts | New verification script | ✅ Monitor coverage |

## 🚀 **Next Steps**

1. Deploy these changes to the server
2. Have students attempt tests
3. Monitor logs to verify time data flow
4. Check analytics section to see Time per Question graphs
5. If issues persist, enable detailed logging in production temporarily

## 💡 **Key Improvements**

1. **Redundant Saves**: Time is saved in multiple places to prevent loss
2. **Better Logging**: Every step is logged for debugging
3. **Fallback Logic**: Analytics work even if schema is incomplete
4. **Browser-Safe**: Uses sendBeacon for page unload saves
5. **Comprehensive Tracking**: All entry points covered
