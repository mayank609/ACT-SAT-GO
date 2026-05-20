# Architecture & Component Relationship Diagram

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     STUDENT DASHBOARD                           │
│  (frontend/src/pages/student/StudentDashboard.tsx)             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ displays
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            ASSIGNED TESTS SECTION COMPONENT                     │
│  (frontend/src/components/dashboard/AssignedTestsSection.tsx)  │
│                                                                 │
│  ├─ useAssignedTests(studentId)                               │
│  │  ├─ Fetches: /api/students/{studentId}/assigned-tests      │
│  │  └─ Returns: AssignedTestData[]                             │
│  │                                                              │
│  ├─ Error State                                                 │
│  ├─ Loading State (skeleton)                                    │
│  ├─ Empty State                                                 │
│  └─ Test Grid (maps to TestCard components)                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ renders
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              TEST CARD COMPONENT (x N)                          │
│  (frontend/src/components/dashboard/TestCard.tsx)              │
│                                                                 │
│  ├─ Title, Description                                          │
│  ├─ Status Badge (Not Started | In Progress | etc)             │
│  ├─ Test Info (Q count, duration, due date)                    │
│  ├─ Availability Window                                         │
│  ├─ Section Breakdown                                           │
│  ├─ Attempts Counter                                            │
│  └─ Action Button                                               │
│      ├─ Start Test → /test-instructions/{testId}              │
│      ├─ Resume Test → /test/{testId}?attemptId={id}           │
│      ├─ Review Attempt → /test-review/{attemptId}             │
│      └─ Retry Test → /test-instructions/{testId}              │
└─────────────────────────────────────────────────────────────────┘
```

## 🧪 Test Taking Flow

```
START TEST
    │
    ▼
┌──────────────────────────────┐
│  TestInstructionsPage        │
│  - Load test details         │
│  - Show instructions         │
│  - Agreement checkbox        │
│  - Proceed button            │
└──────────────────┬───────────┘
                   │
                   ▼
          POST /api/attempts
          {testId, studentId}
          ↓ Returns: attemptId
                   │
                   ▼
┌──────────────────────────────┐
│  TestInterfacePage           │
│  ?attemptId={id}             │
│                              │
│  Hooks Initialized:          │
│  ├─ useAutosave             │
│  ├─ useSectionTimer         │
│  └─ useTestStore            │
│                              │
│  Components:                 │
│  ├─ ConnectionRecoveryBanner│
│  ├─ AutosaveStatus          │
│  ├─ Question Display        │
│  ├─ Answer Options          │
│  └─ Timer Display           │
│                              │
│  Features:                   │
│  ├─ Answer Questions        │
│  ├─ Mark for Review         │
│  ├─ Navigate Palette        │
│  ├─ Auto-save (5s)          │
│  └─ Timer Sync (30s)        │
└──────────────────┬───────────┘
                   │
        (page refresh)
                   │
                   ▼
        Automatic Recovery:
        ├─ useAutosave.recoverState()
        ├─ useSectionTimer.syncTimer()
        └─ Restore all answers & state
                   │
                   │
        (submit test)
                   ▼
          POST /api/attempts/.../
          sections/.../submit
          ↓ Backend calculates score
                   │
                   ▼
          /test-review/{attemptId}
```

## 📦 Hook Dependencies & Data Flow

```
┌─────────────────────────────────────────┐
│         useAssignedTests Hook           │
│  (frontend/src/hooks/useAssignedTests) │
└────────────┬────────────────────────────┘
             │
             │ Fetches
             ▼
    GET /api/students/{studentId}/assigned-tests
             │
             │ Returns
             ▼
┌─────────────────────────────────────────┐
│     AssignedTestData[] (Test List)      │
│                                         │
│  ├─ assignmentId                        │
│  ├─ testId                              │
│  ├─ title, description                  │
│  ├─ dueDate                             │
│  ├─ availableFrom, availableUntil       │
│  ├─ status (Not Started|In Prog|...)   │
│  ├─ usedAttempts, remainingAttempts     │
│  ├─ inProgressAttemptId (resume)        │
│  ├─ submittedAttemptId (review)         │
│  └─ sections[]                          │
└─────────────────────────────────────────┘


┌─────────────────────────────────────────┐
│         useAutosave Hook                │
│  (frontend/src/hooks/useAutosave)      │
└────────────┬────────────────────────────┘
             │
             │ On Mount:
             │ Calls recoverState()
             │
             ▼
  GET /api/attempts/{attemptId}/autosave
             │
             │ Returns
             ▼
┌─────────────────────────────────────────┐
│  AttemptState & SavedAnswers            │
│                                         │
│  AttemptState:                          │
│  ├─ currentSectionIndex                 │
│  ├─ currentQuestionIndex                │
│  ├─ sections[] (with timeUsed)          │
│  ├─ markedForReview[]                   │
│  ├─ tabSwitchCount                      │
│  └─ updatedAt                           │
│                                         │
│  SavedAnswers:                          │
│  ├─ {questionId}: SavedAnswer           │
│  │   ├─ answerGiven                     │
│  │   ├─ timeSpentSeconds                │
│  │   ├─ isFlagged                       │
│  │   └─ updatedAt                       │
│  └─ ...                                 │
└─────────────────────────────────────────┘
             │
             │ On Save:
             │ Calls saveState() or saveAnswer()
             │
             ▼
  POST /api/attempts/{attemptId}/autosave
      (Debounced 1s, Interval 5s)


┌─────────────────────────────────────────┐
│       useSectionTimer Hook              │
│  (frontend/src/hooks/useSectionTimer)  │
└────────────┬────────────────────────────┘
             │
             │ On Mount:
             │ syncTimer() → startInterval()
             │
             ▼
  GET /api/attempts/{attemptId}/sections/{sectionId}/timer
             │
             │ Returns
             ▼
┌─────────────────────────────────────────┐
│  Timer Data                             │
│                                         │
│  ├─ remainingSeconds (authoritative)    │
│  ├─ expired (boolean)                   │
│  └─ (synced every 30 seconds)           │
└─────────────────────────────────────────┘
             │
             │ Computes
             ▼
┌─────────────────────────────────────────┐
│  Hook Returns:                          │
│  ├─ remainingSeconds (countdown)        │
│  ├─ isExpired                           │
│  ├─ isPaused (tab hidden)               │
│  ├─ timePercentage (0-100)              │
│  ├─ formattedTime (HH:MM:SS)            │
│  └─ syncTimer() (manual sync)           │
└─────────────────────────────────────────┘
```

## 🔄 Recovery Workflows

### Scenario 1: Page Refresh

```
User refreshes page mid-test
    │
    ▼
URL preserved: /test/{testId}?attemptId={id}
    │
    ▼
TestInterfacePage mounts
    │
    ├─ useAutosave(attemptId) initializes
    │  │
    │  └─ useEffect: recoverState() called
    │     │
    │     ├─ GET /api/attempts/{id}
    │     ├─ GET /api/attempts/{id}/autosave
    │     │
    │     └─ Restore to Zustand store
    │
    ├─ useSectionTimer(attemptId, sectionId) initializes
    │  │
    │  └─ syncTimer() → GET timer endpoint
    │     └─ Countdown resumes
    │
    └─ Render: User sees exact same state
```

### Scenario 2: Connection Loss & Recovery

```
User has network connection
    │
    ├─ autoSave() succeeds
    ├─ Timer syncs every 30s
    └─ All working normally

User loses network
    │
    ├─ window 'offline' event fires
    │  │
    │  └─ ConnectionRecoveryBanner shows "Connection lost"
    │
    ├─ Timer pauses display (isPaused = true)
    │
    ├─ autoSave() fails (error state shown)
    │  │
    │  ├─ User can still answer locally
    │  ├─ Answers stored in memory
    │  └─ Retry button available
    │
    └─ All user input still tracked

User reconnects
    │
    ├─ window 'online' event fires
    │  │
    │  └─ ConnectionRecoveryBanner shows "Restored"
    │
    ├─ Timer syncs with server
    │  │
    │  └─ Countdown continues accurately
    │
    ├─ Failed saves retry automatically
    │  │
    │  └─ localStorage used as queue
    │
    └─ User continues seamlessly
```

### Scenario 3: Tab Switch

```
User in test taking
    │
    ├─ Focus on test tab
    │  └─ useSectionTimer: isPaused = false
    │
    └─ Tab visible: visibilitychange = false

User switches to another tab
    │
    ├─ visibilitychange event fires
    │  │
    │  ├─ useSectionTimer: isPaused = true
    │  ├─ Timer display paused
    │  └─ api.logCheatingEvent('TAB_SWITCH')
    │
    └─ User not visible: visibilitychange = true

User switches back to test
    │
    ├─ visibilitychange event fires
    │  │
    │  ├─ useSectionTimer: isPaused = false
    │  ├─ syncTimer() called
    │  │  └─ GET /api/.../timer
    │  │     └─ remainingSeconds updated
    │  │
    │  └─ Countdown resumes with correct value
    │
    └─ Tab switch logged in CheatingLog
```

## 💾 Data Persistence Layers

```
┌──────────────────────────────────────┐
│     CLIENT (Browser Memory)          │
│                                      │
│  ├─ Zustand store (useTestStore)    │
│  │  ├─ currentAttempt                │
│  │  ├─ activeTest                    │
│  │  └─ sections with answers         │
│  │                                   │
│  ├─ React state                      │
│  │  ├─ selectedAnswer                │
│  │  ├─ numericInput                  │
│  │  └─ UI flags                      │
│  │                                   │
│  └─ useAutosave hook state          │
│     ├─ answers (SavedAnswer[])      │
│     ├─ lastSaved timestamp          │
│     └─ isSaving flag                │
└──────────────────────────────────────┘
            │ Saves on
            │ navigation,
            │ timer expiration
            ▼
┌──────────────────────────────────────┐
│     REDIS (Cache Layer)              │
│     (4 hour TTL)                     │
│                                      │
│  Keys:                               │
│  ├─ state:{attemptId}               │
│  │  └─ Full AttemptState object      │
│  ├─ answers:{attemptId}             │
│  │  └─ Hash of question→answer       │
│  └─ timer:{attemptId}:{sectionId}  │
│     └─ End time (Unix ms)            │
└──────────────────────────────────────┘
            │ Fails over to
            │ database on
            │ final submit
            ▼
┌──────────────────────────────────────┐
│     DATABASE (Permanent)             │
│     (Prisma/PostgreSQL)              │
│                                      │
│  Tables:                             │
│  ├─ TestAttempt                      │
│  │  ├─ id                            │
│  │  ├─ testId, studentId             │
│  │  ├─ status                        │
│  │  ├─ totalScore (after submit)    │
│  │  └─ timestamps                    │
│  │                                   │
│  ├─ AttemptAnswer                    │
│  │  ├─ attemptId, questionId         │
│  │  ├─ answerGiven                   │
│  │  ├─ timeSpentSeconds              │
│  │  └─ isFlagged                     │
│  │                                   │
│  ├─ SectionAttempt                   │
│  │  ├─ attemptId, sectionId          │
│  │  ├─ startedAt, completedAt       │
│  │  └─ (for analytics)               │
│  │                                   │
│  └─ CheatingLog                      │
│     ├─ attemptId                     │
│     ├─ eventType (TAB_SWITCH, etc)  │
│     └─ metadata, timestamp           │
└──────────────────────────────────────┘
```

## 🎯 Component Hierarchy

```
StudentDashboard
├─ Card (Stats)
├─ Chart (Score Trend)
└─ AssignedTestsSection
   ├─ Error State (if error)
   ├─ Loading State (if loading)
   ├─ Empty State (if no tests)
   └─ TestCard (for each test)
      ├─ Status Badge
      ├─ Info Grid
      ├─ Sections List
      ├─ Status Box (conditional)
      └─ Action Button(s)

TestInterfacePage
├─ ConnectionRecoveryBanner
├─ Header
│  ├─ Student Info
│  ├─ Test Title
│  └─ Timer Display
├─ Section Tabs
├─ Main Content
│  ├─ Question Area
│  │  ├─ Question Text
│  │  ├─ Options (MCQ/MSQ)
│  │  ├─ Numeric Input
│  │  └─ Action Buttons
│  └─ Question Palette (desktop)
│     ├─ Legend
│     ├─ Question Grid
│     └─ Stats
└─ Mobile Drawer (if palette open)
   └─ Question Grid + Stats

AutosaveStatus (anywhere)
├─ Saving State
├─ Saved State + Timestamp
└─ Error State + Retry Button

ConnectionRecoveryBanner (top)
├─ Offline: "Connection lost"
└─ Online: "Connection restored"
```

## 🔐 Security Flow

```
Student accesses Dashboard
    │
    ├─ Verify authentication (JWT token)
    │
    ├─ GET /api/students/{studentId}/assigned-tests
    │  │
    │  └─ Server verifies:
    │     ├─ User is authenticated
    │     ├─ User is a student (role check)
    │     ├─ studentId matches authenticated user
    │     └─ Return only assigned tests
    │
    └─ Display tests

Student clicks Start Test
    │
    ├─ POST /api/attempts {testId, studentId}
    │  │
    │  └─ Server verifies:
    │     ├─ User authenticated
    │     ├─ Test assigned to student
    │     ├─ Test is available (time window)
    │     ├─ Attempts available
    │     └─ Create attempt
    │
    └─ Get attemptId

During Test
    │
    ├─ POST /api/attempts/{attemptId}/autosave
    │  │
    │  └─ Server verifies:
    │     ├─ Attempt exists
    │     ├─ User owns attempt
    │     └─ Save to Redis
    │
    └─ Timer always server-authoritative
       ├─ GET /api/.../timer
       │  └─ Client cannot manipulate
       │
       └─ Cannot cheat by changing local time

On Submit
    │
    ├─ POST /api/attempts/{attemptId}/sections/.../submit
    │  │
    │  └─ Server:
    │     ├─ Validates section completed
    │     ├─ Loads all answers from DB
    │     ├─ Compares to correct answers
    │     ├─ Calculates score
    │     └─ Saves results
    │
    └─ Score cannot be modified by client
```

## 📊 Performance Metrics

```
Time Measurements
├─ Initial Load: <1s (test list)
├─ Page Navigation: <100ms
├─ Autosave Request: <500ms
├─ Timer Sync: <200ms
├─ Recovery (refresh): <1s
└─ Connection Recovery: <100ms

Network Optimization
├─ Autosave: 5 second interval
├─ Timer Sync: 30 second interval
├─ Debounce: 1 second
├─ Compression: Gzip enabled
└─ Caching: Redis + Browser cache

Database Performance
├─ Query: <50ms (w/ indexes)
├─ Save: <100ms
├─ Bulk: <200ms
└─ Index coverage: studentId, attemptId
```

This architecture ensures a robust, scalable, and user-friendly test-taking platform!
