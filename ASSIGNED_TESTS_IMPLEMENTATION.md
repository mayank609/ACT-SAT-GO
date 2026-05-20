# Assigned Tests + Resume Test System - Implementation Guide

## Overview

This document describes the complete **Assigned Tests + Resume Test** system for the Student Dashboard, designed to provide a professional, seamless competitive examination experience.

## Architecture

### Frontend Components

#### 1. **AssignedTestsSection** (`src/components/dashboard/AssignedTestsSection.tsx`)
- Main dashboard component displaying all assigned tests
- Shows test statistics (not started, in progress, completed, expired)
- Handles test actions (start, resume, review)
- Features:
  - Error handling with retry functionality
  - Loading states with skeleton placeholders
  - Empty state messaging
  - Refresh capability

#### 2. **TestCard** (`src/components/dashboard/TestCard.tsx`)
- Individual test card component
- Displays comprehensive test information:
  - Test title and description
  - Total questions and duration
  - Due date with human-readable format
  - Availability window
  - Remaining attempts
  - Current status badge
- Shows section breakdown with time and question counts
- Status-specific information boxes
- Contextual action buttons (Start, Resume, Review, Retry)
- Responsive design for mobile and desktop

#### 3. **AutosaveStatus** (`src/components/common/AutosaveStatus.tsx`)
- Real-time autosave status indicator
- States: Saving, Saved (with timestamp), Error
- Retry button for failed saves
- Non-intrusive UI that updates automatically

#### 4. **ConnectionRecoveryBanner** (`src/components/common/ConnectionRecoveryBanner.tsx`)
- Network status indicator
- Shows connection lost/restored messages
- Auto-hides after connection is restored
- Allows manual sync on reconnection

### Custom Hooks

#### 1. **useAssignedTests** (`src/hooks/useAssignedTests.ts`)
```typescript
useAssignedTests(studentId?: string): UseAssignedTestsResult
```
- Fetches assigned tests for a student
- Provides:
  - `tests`: Array of assigned tests
  - `loading`: Loading state
  - `error`: Error message if fetch fails
  - `refetch()`: Manual refresh function
- Utility functions:
  - `getTestStatusColor()`: CSS classes for status badges
  - `formatDueDate()`: Human-readable due dates
  - `formatAvailabilityWindow()`: Availability display
  - `getTotalDuration()`: Sums section durations
  - `getTotalQuestions()`: Counts total questions

#### 2. **useAutosave** (`src/hooks/useAutosave.ts`)
```typescript
useAutosave(attemptId?: string): UseAutosaveResult
```
Features:
- Persistent autosave with debouncing (5s interval)
- Separate saves for state and individual answers
- Recovery of saved state on page load
- Error handling with retry capability
- Returns:
  - `state`: Recovered attempt state
  - `answers`: Recovered question answers
  - `isSaving`: Current save status
  - `lastSaved`: Timestamp of last save
  - `error`: Error message if save failed
  - `saveState()`: Save full attempt state
  - `saveAnswer()`: Save individual answer
  - `recoverState()`: Manually recover state

#### 3. **useSectionTimer** (`src/hooks/useSectionTimer.ts`)
```typescript
useSectionTimer(attemptId?: string, sectionId?: string, totalDurationMinutes?: number): UseSectionTimerResult
```
Features:
- Server-authoritative timer with client countdown
- Automatic timer sync every 30 seconds
- Handles page visibility changes (tab switching)
- Connection recovery synchronization
- Returns:
  - `remainingSeconds`: Time left for section
  - `isExpired`: Whether time is up
  - `isPaused`: If tab is not visible
  - `timePercentage`: Progress for visual indicators
  - `formattedTime`: Formatted time string (HH:MM:SS)
  - `syncTimer()`: Manual sync function

### Data Types

```typescript
interface AssignedTestData {
  assignmentId: string;
  testId: string;
  title: string;
  description?: string;
  dueDate?: string;
  availableFrom?: string;
  availableUntil?: string;
  availabilityState: 'upcoming' | 'open' | 'expired';
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Expired';
  completionStatus: 'Submitted' | 'In Progress' | 'Pending';
  usedAttempts: number;
  remainingAttempts: number;
  maxAttempts: number;
  latestAttemptId?: string | null;
  inProgressAttemptId?: string | null;
  submittedAttemptId?: string | null;
  sections: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    _count?: { questions: number };
  }>;
}

interface AttemptState {
  currentSectionIndex: number;
  currentQuestionIndex: number;
  sections: Record<string, {
    startedAt?: string;
    completedAt?: string;
    timeUsed: number;
  }>;
  markedForReview: string[];
  tabSwitchCount: number;
  isFullScreen: boolean;
  lastSavedAt: number;
  updatedAt: number;
}

interface SavedAnswer {
  answerGiven: unknown;
  timeSpentSeconds: number;
  isFlagged: boolean;
  updatedAt: number;
}
```

## Backend API Endpoints

### Existing Endpoints Used

#### 1. Get Assigned Tests
```http
GET /api/students/{studentId}/assigned-tests
```
Response includes all assigned tests with their status, availability, and attempt information.

#### 2. Start Attempt
```http
POST /api/attempts
Body: { testId, studentId }
```
Returns `attemptId` for new or existing in-progress attempt.

#### 3. Autosave Answers
```http
POST /api/attempts/{attemptId}/autosave
Body: { 
  questionId?, 
  answerGiven?, 
  timeSpentSeconds?,
  isFlagged?,
  attemptState?
}
```

#### 4. Get Autosave State
```http
GET /api/attempts/{attemptId}/autosave
```
Returns saved state and answers for recovery.

#### 5. Get Section Timer
```http
GET /api/attempts/{attemptId}/sections/{sectionId}/timer
```
Returns remaining seconds and expiration status.

#### 6. Start Section
```http
POST /api/attempts/{attemptId}/sections/{sectionId}/start
```
Initializes section timer and creates section attempt record.

#### 7. Submit Section
```http
POST /api/attempts/{attemptId}/sections/{sectionId}/submit
```
Finalizes section and begins score calculation.

## State Management

### Redux-like Zustand Store
Uses existing `useTestStore` for:
- Current attempt state
- Active test details
- Question navigation
- Section progression
- Answer tracking

### Redis (Backend)
Stores:
- Autosaved state and answers (4-hour TTL)
- Section timers (precise server-side tracking)

### Prisma Database
Persists:
- Test attempts and answers (permanent)
- Section attempts (for analytics)
- Cheating logs (tab switches, suspicious input)

## Recovery Mechanisms

### 1. Page Refresh Recovery
**Flow:**
1. User refreshes page during test
2. `attemptId` passed via URL query parameter
3. `TestInterfacePage` detects and calls recovery
4. `useAutosave` fetches saved state from server
5. Attempt restored with all answers intact
6. Timer resynchronized with server

**Code:**
```typescript
useEffect(() => {
  async function restoreAttemptFromBackend() {
    if (!attemptIdFromQuery || currentAttempt) return;
    const [attemptRes, autosaveRes] = await Promise.all([
      api.getAttempt(attemptIdFromQuery),
      api.getAutosaveState(attemptIdFromQuery),
    ]);
    // Restore state...
    startAttempt(restoredAttempt, restoredTest);
  }
  restoreAttemptFromBackend();
}, [attemptIdFromQuery]);
```

### 2. Connection Loss Recovery
**Features:**
- Browser `online`/`offline` events trigger recovery
- `ConnectionRecoveryBanner` notifies user
- Timer automatically syncs on reconnection
- Pending autosaves retry automatically
- All answers preserved locally during outage

### 3. Tab Switch Detection
**Tracking:**
- `visibilitychange` event logs tab switches
- Logged to `CheatingLog` with timestamps
- Timer pauses when tab not visible
- Automatic resync when tab becomes active

### 4. Network Timeouts
**Handling:**
- API calls to autosave have built-in timeout (5s)
- Failed saves show error state with retry button
- User can manually retry failed saves
- All unsaved state remains in memory

## User Workflows

### Starting a Test
1. User views Dashboard with Assigned Tests Section
2. Clicks "Start Test" on available test
3. Navigates to Test Instructions page
4. Reviews instructions and section overview
5. Confirms academic integrity agreement
6. Clicks "Proceed to Start Test"
7. Backend creates attempt, frontend initializes state
8. Redirected to Test Interface page

### Resuming an Interrupted Test
1. User returns to Dashboard
2. In-progress test shows "Resume Test" button
3. Clicks resume button
4. Redirected to `/test/{testId}?attemptId={attemptId}`
5. Page auto-recovers from autosaved state
6. All previous answers restored
7. Timer picks up where it left off
8. User continues exactly from previous position

### Completing a Test
1. User answers all sections
2. On last section's last question, shows "Submit" button
3. Modal appears with test summary
4. User confirms submission
5. Final section submitted to backend
6. Backend calculates score
7. Redirect to Review page with results

### Reviewing Completed Test
1. User clicks "Review Attempt" on completed test
2. Views detailed attempt review
3. Can see all answers, correct answers, and explanations
4. Section-wise and topic-wise breakdowns
5. Can attempt test again if attempts remain

## UI/UX Features

### Visual Feedback
- **Status Badges**: Color-coded (Not Started, In Progress, Completed, Expired)
- **Autosave Indicator**: Shows save status with timestamps
- **Connection Status**: Network banner with real-time updates
- **Timer Display**: Large, color-changing timer (red when <5 min)
- **Progress Indicators**: Section tabs, time percentage bars
- **Question Palette**: Visual grid showing answer status

### Responsive Design
- **Mobile**: Stack layout, hidden desktop elements
- **Tablet**: Single column, full width cards
- **Desktop**: Side-by-side layout with question palette
- **Breakpoints**: sm (640px), md (768px), lg (1024px)

### Accessibility
- Proper heading hierarchy
- ARIA labels for status indicators
- Keyboard navigation support
- High contrast colors for readability
- Clear error messages

## Performance Optimizations

### Frontend
- **Debounced Autosave**: 5-second interval to reduce API calls
- **React Query Integration**: Potential for caching assigned tests
- **Lazy Loading**: Components loaded on demand
- **Memoization**: Test cards memoized to prevent unnecessary renders

### Backend
- **Redis Caching**: Fast autosave and timer retrieval
- **Connection Pooling**: Efficient database connections
- **Index Optimization**: Fast queries on studentId, attemptId
- **TTL Management**: Automatic cleanup of old autosave data

## Testing Checklist

- [ ] Student can view assigned tests on dashboard
- [ ] Starting a test creates attempt and redirects correctly
- [ ] Test answers are autosaved periodically
- [ ] Page refresh recovers all answers
- [ ] Timer displays correctly and counts down
- [ ] Timer syncs with server every 30 seconds
- [ ] Tab switching is detected and logged
- [ ] Connection loss shows banner
- [ ] Connection restored syncs data
- [ ] Submitting test finalizes attempt
- [ ] Completed test shows review button
- [ ] Review page displays all attempt details
- [ ] Retry button works on completed test
- [ ] Attempts count is accurate
- [ ] Due dates display correctly
- [ ] Expired tests show proper status
- [ ] Mobile layout is responsive
- [ ] All error states handled gracefully

## Configuration

### Environment Variables
```env
VITE_API_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://...
```

### Redis TTL
- Autosave data: 4 hours
- Section timers: 4 hours

### Autosave Settings
- Interval: 5 seconds
- Debounce: 1 second
- Auto-retry: On connection recovery

## Future Enhancements

1. **Offline Mode**: Service workers for full offline support
2. **Real-time Sync**: WebSockets for live progress updates
3. **Proctoring**: Advanced monitoring and proctoring features
4. **Analytics Dashboard**: Student performance insights
5. **Adaptive Testing**: Dynamic difficulty based on performance
6. **Mobile App**: Native mobile application
7. **Internationalization**: Multi-language support
