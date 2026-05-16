# ACT / SAT GO — Test Preparation Platform

A production-grade, analytics-heavy web application for ACT and SAT test preparation. Built for tutoring centers and independent educators who need a robust platform for test delivery, student management, and deep performance analytics — not just a basic quiz tool.

---

## Table of Contents

1. [Overview](#overview)
2. [Live Demo Credentials](#live-demo-credentials)
3. [Feature Requirements](#feature-requirements)
   - [1. User Roles & Access Control](#1-user-roles--access-control)
   - [2. Student & Tutor Management](#2-student--tutor-management)
   - [3. Test Creation Module](#3-test-creation-module)
   - [4. Test Delivery Interface](#4-test-delivery-interface)
   - [5. Timer Logic](#5-timer-logic)
   - [6. Analytics & Reporting](#6-analytics--reporting)
   - [7. Test Attempt Review](#7-test-attempt-review)
   - [8. Admin Dashboard](#8-admin-dashboard)
   - [9. Scalability & Performance](#9-scalability--performance)
   - [10. Security](#10-security)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Architecture Overview](#architecture-overview)
7. [Data Models](#data-models)
8. [Routing & Navigation](#routing--navigation)
9. [State Management](#state-management)
10. [Getting Started](#getting-started)
11. [Available Scripts](#available-scripts)
12. [Pages & Components Reference](#pages--components-reference)
13. [Responsive Design](#responsive-design)
14. [Anti-Cheating System](#anti-cheating-system)
15. [Future Backend Integration](#future-backend-integration)

---

## Overview

ACT/SAT GO is a full-featured test preparation platform with four distinct user portals, a flexible test builder, section-timed test delivery, and analytics down to the individual question level. The current implementation is a complete, responsive React frontend with mock data — designed to be wired to any REST or GraphQL backend.

**Key differentiators:**
- Section-level independent timers with auto-advance
- 5-state question palette (not visited / not answered / answered / marked for review / answered & marked)
- Per-question time tracking fed into analytics
- Tab-switch detection and logging
- Radar, bar, line, and area charts for deep performance visualisation
- Role-based sidebar, routes, and data visibility — all from a single codebase

---

## Live Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `super@testplatform.com` | `demo123` |
| Admin | `admin@testplatform.com` | `demo123` |
| Tutor | `tutor@testplatform.com` | `demo123` |
| Student | `student@testplatform.com` | `demo123` |

Each role shows a completely different sidebar, dashboard, and available routes.

---

## Feature Requirements

### 1. User Roles & Access Control

The platform implements **Role-Based Access Control (RBAC)** with four roles:

| Role | Capabilities |
|------|-------------|
| **Super Admin** | Full system control — all pages, user management, platform configuration |
| **Admin / Operations** | Create/edit/delete tests, manage all students and tutors, view all reports |
| **Tutor** | View only their assigned students, access student analytics, monitor progress |
| **Student** | Take assigned tests, view their own results and progress history |

**Implementation details:**
- Roles are stored on the `User` object as a typed union: `'super_admin' | 'admin' | 'tutor' | 'student'`
- The sidebar navigation is filtered at render time based on `user.role` — nav items carry a `roles: Role[]` array
- React Router routes are individually wrapped in `<ProtectedRoute>` which checks authentication
- A `DashboardRouter` component reads the active role and renders the correct dashboard component
- Permissions are data-driven (each `NavItem` declares which roles can see it) rather than hardcoded conditionals scattered across the codebase

### 2. Student & Tutor Management

**Student profiles** contain:
- Name, email, grade level (9–12)
- Assigned tutor reference
- Target ACT/SAT score
- Tests attempted count, average score, last active date

**Features implemented:**
- Searchable, sortable data table with all student records
- Avatar initials, grade badge, tutor assignment column
- Score progress bar comparing current avg to target
- Tab filtering: All / Active / Inactive
- **Add Student modal** — first name, last name, email, grade, target score, tutor assignment
- **Bulk Upload modal** — CSV/Excel drag-and-drop upload area with template download link
- Per-student detail modal showing stats, tutor info, and badge indicators
- Four summary stat cards: Total, With Tutors, Avg Score, Tests Done

**Tutor visibility:**
- Tutors see a `my-students` page that surfaces only their assigned students
- Student detail page (`/student/:id`) shows full analytics for one student, accessible only by their assigned tutor or admins

### 3. Test Creation Module

The **Test Builder** (`/test-builder`) is a rich, multi-panel editor:

**Test-level settings:**
- Title, description, status (Draft / Published / Archived)
- Toggle: Allow backward section navigation
- Toggle: Show results to student immediately

**Section management:**
- Add / remove / reorder sections (Math, Reading, Writing, Science, etc.)
- Each section has: name, custom time limit (minutes)
- Section sidebar showing question count per section
- Active section state — click to switch

**Question editor (per question):**
- Question text input
- Type selector: `mcq_single` (single-correct MCQ), `mcq_multi` (multiple-correct), `numeric` (free numeric entry)
- Add/remove answer options (MCQ) — mark correct option(s)
- Correct answer field (numeric)
- Explanation field (shown during review)
- **Tagging:** Topic (Algebra, Grammar, Reading Comp, etc.), Sub-topic, Difficulty (Easy / Medium / Hard)

**Question palette in builder:**
- Visual grid of all questions in the active section
- Click to jump to any question
- Add question button

### 4. Test Delivery Interface

The test interface (`/test/:testId`) is a **fullscreen, distraction-free environment**:

**Layout:**
- Top header bar: test title, section tabs, timer, submit button
- Main area: question text + options (or numeric input)
- Right sidebar (desktop): question palette + answer legend
- Bottom sheet (mobile): collapsible palette triggered by palette button

**Question interactions:**
- MCQ single: click option to select, click again or "Clear Response" to deselect
- MCQ multi: checkbox-style multi-select
- Numeric: text input for numeric answer
- **Save & Next**: records answer, advances question
- **Mark for Review & Next**: flags question with purple state, advances
- **Clear Response**: deselects current answer

**5-state palette:**

| State | Color | Meaning |
|-------|-------|---------|
| Not Visited | Grey | Student has not opened this question |
| Not Answered | Red | Student opened but left blank |
| Answered | Green | Answer saved |
| Marked for Review | Purple | Flagged for later, no answer |
| Answered & Marked | Blue | Answer saved AND flagged |

**Autosave:** Zustand state is persisted to `localStorage` automatically via the `persist` middleware — the attempt survives browser refresh.

**Resume capability:** On returning to `/test/:testId`, the store rehydrates the full attempt state including current section, current question, all answers, and time used.

**Tab-switch detection:**
- `visibilitychange` event listener fires on every tab switch
- `tabSwitchCount` is incremented in the test store
- Warning overlay appears on first switch; count is logged for admin review

### 5. Timer Logic

Each section has an **independent countdown timer**:

- Implemented in a custom `useTimer` hook using `useRef` to avoid stale closure bugs
- Displays `MM:SS` format; turns amber at ≤5 minutes, red at ≤1 minute
- On expiry: section is automatically completed and the student advances to the next section
- `timeUsed` per section is tracked in seconds within `SectionAttempt`
- Per-question `timeSpent` is accumulated while the question is active

**No backward navigation** (configurable per test via `allowBackNavigation` flag):
- Section tabs are disabled for sections already completed
- The store prevents `currentSectionIndex` from decreasing unless the flag is set

### 6. Analytics & Reporting

Analytics are the core of the platform. The data model supports drill-down from test → section → question → topic.

**Per-student analytics (TestAnalytics type):**

| Metric | Detail |
|--------|--------|
| Composite score | Total score out of max (ACT: 36, SAT: 1600) |
| Percentile | Rank among all test-takers |
| Overall accuracy | Correct / attempted % |
| Total time used | vs. allocated time |
| Section accuracy | Per-section correct/wrong/skipped counts |
| Topic breakdown | Accuracy and avg time spent per topic |

**Charts rendered:**
- **Radar chart** — skill profile across topics (Algebra, Grammar, Reading, Science, Geometry, Trig)
- **Bar chart** — section-by-section correct / wrong / skipped
- **Line chart** — score trend over multiple test attempts
- **Area chart** — time-spent pattern

**For Tutors — Student Detail Page (`/student/:id`):**
- Score history line chart (AreaChart with gradient fill)
- Section comparison bar chart
- Topic radar chart
- Weak areas identified with accuracy badges
- Per-test breakdown table with time, score, and percentile

**Admin Reports Page (`/reports`):**
- Platform-wide stats: total tests, avg score, completion rate, active students
- Student performance table with searchable/sortable columns
- Score distribution chart
- Export to PDF/Excel buttons (UI wired, backend integration point)

**Student Progress Page (`/my-progress`):**
- Personal score trend line chart
- Topic-wise performance table with color-coded accuracy
- Weak vs strong area identification

### 7. Test Attempt Review

The **Test Review Page** (`/test-review/:attemptId`) gives a complete post-test breakdown:

**Score summary banner:**
- Composite score (large, prominent)
- Per-section accuracy percentage
- Overall accuracy, percentile, total time used

**Section-level breakdown:**
- Tab switcher to jump between sections
- Correct / Wrong / Skipped / Accuracy stats per section

**Question-level review:**
- Every question card shows:
  - Question text
  - All options (green = correct, red = user's wrong answer with strikethrough)
  - Time spent on that question
  - Correct / Wrong / Skipped badge
  - Expandable explanation (toggle show/hide)
- Color-coded card borders (green = correct, red = wrong, grey = skipped)

**Charts:**
- Section bar chart (correct/wrong/skipped per section)
- Topic radar chart (skill profile)

### 8. Admin Dashboard

The admin homepage (`/dashboard` for admin/super_admin roles) provides a command-center overview:

**Stat cards:** Total Students, Active Tests, Avg Score, This Month's Attempts

**Charts:**
- Score distribution bar chart (how many students scored in each range)
- Weekly test completions area chart

**Recent activity feed:** Latest test attempts with status and timestamp

**Alerts panel:** Students with low accuracy, low activity warnings

**Tests management (`/tests`):**
- Card grid of all tests with status badges
- Create Test modal
- Assign test to student/group modal
- Delete confirmation modal
- Edit / Duplicate actions

**Test builder (`/test-builder`):** Full question authoring (see section 3)

**Reports (`/reports`):** Exportable student performance table and charts

### 9. Scalability & Performance

**Frontend architecture:**

- **Code splitting** via Vite's dynamic import (each page is a separate chunk)
- **Zustand** with `persist` middleware for zero-latency local state reads — avoids re-fetching on navigation
- **Recharts** uses `ResponsiveContainer` — charts adapt without layout recalculation
- **DataTable** implements client-side pagination (configurable page size) to avoid rendering thousands of DOM nodes
- **React 19** with concurrent rendering — UI remains responsive during heavy re-renders

**Backend readiness (integration points):**
- All mock data is in `src/data/mockData.ts` — replace with API calls without changing component code
- Store actions (`startAttempt`, `updateAnswer`, `advanceSection`) map 1:1 to REST endpoints
- `tabSwitchCount` and `timeSpent` are tracked at the store level and ready to be flushed to an API on autosave intervals

### 10. Security

**Authentication:**
- Session stored in `localStorage` via Zustand `persist` — replace with JWT verification on API calls
- `ProtectedRoute` component guards all authenticated routes
- Unauthenticated users are always redirected to `/login`

**Anti-cheating logs:**
- `tabSwitchCount` on `TestAttempt` is incremented every time `document.visibilityState` changes to `hidden`
- First switch triggers a visible warning modal
- Count is part of the attempt payload — admins can filter/sort students by tab switch count in reports
- Inactivity detection: `timeSpent` per question reveals if a student is idle (very high time on one question)
- Full-screen enforcement: `isFullScreen` flag on the attempt; can be wired to the Fullscreen API

**Data protection:**
- Student performance data is role-gated — tutors only see their assigned students
- No cross-student data leaks in the UI layer

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19.x |
| Language | TypeScript | 6.x |
| Build Tool | Vite | 8.x |
| Styling | Tailwind CSS | 4.x |
| Routing | React Router | 7.x |
| State Management | Zustand | 5.x |
| Charts | Recharts | 3.x |
| Icons | Lucide React | 1.x |
| Linting | ESLint + typescript-eslint | 10.x / 8.x |

**Why this stack:**
- **Tailwind v4** — `@import "tailwindcss"` syntax, no config file needed, used as a Vite plugin (`@tailwindcss/vite`) for fast HMR
- **Zustand v5** — minimal boilerplate, built-in `persist` middleware for localStorage rehydration (critical for test resume)
- **React Router v7** — nested routes with `<Outlet>` enabling the dashboard layout wrapper without prop drilling
- **Recharts v3** — declarative chart API, `ResponsiveContainer` works seamlessly with Tailwind's flex/grid layouts

---

## Project Structure

```
ACT-SAT-GO/
└── frontend/
    ├── public/
    ├── src/
    │   ├── assets/
    │   ├── components/
    │   │   ├── common/
    │   │   │   ├── Badge.tsx          # Variant badges (success, danger, info, etc.)
    │   │   │   ├── Button.tsx         # Variant buttons with loading spinner
    │   │   │   ├── Card.tsx           # Card + StatCard with trend indicator
    │   │   │   ├── DataTable.tsx      # Generic typed table (search, sort, paginate)
    │   │   │   └── Modal.tsx          # Accessible modal with backdrop + footer slot
    │   │   └── layout/
    │   │       ├── DashboardLayout.tsx  # Root layout with sidebar + header + outlet
    │   │       ├── Header.tsx           # Top bar with hamburger, search, user menu
    │   │       └── Sidebar.tsx          # Collapsible desktop + drawer mobile sidebar
    │   ├── data/
    │   │   └── mockData.ts            # All mock entities (tests, students, tutors, analytics)
    │   ├── pages/
    │   │   ├── auth/
    │   │   │   └── LoginPage.tsx      # Role-demo login with credential buttons
    │   │   ├── admin/
    │   │   │   ├── AdminDashboard.tsx
    │   │   │   ├── TestBuilderPage.tsx
    │   │   │   ├── TestsPage.tsx
    │   │   │   ├── StudentManagementPage.tsx
    │   │   │   └── ReportsPage.tsx
    │   │   ├── tutor/
    │   │   │   ├── TutorDashboard.tsx
    │   │   │   └── StudentDetailPage.tsx
    │   │   └── student/
    │   │       ├── StudentDashboard.tsx
    │   │       ├── MyTestsPage.tsx
    │   │       ├── MyProgressPage.tsx
    │   │       ├── TestInstructionsPage.tsx  # Pre-test instructions + agreement
    │   │       ├── TestInterfacePage.tsx     # Full test-taking environment
    │   │       └── TestReviewPage.tsx        # Post-test answer review + analytics
    │   ├── store/
    │   │   ├── useAuthStore.ts        # Auth state with persist (login/logout/user)
    │   │   └── useTestStore.ts        # Active attempt state (answers, timer, navigation)
    │   ├── types/
    │   │   └── index.ts               # All TypeScript interfaces and type aliases
    │   ├── App.tsx                    # Router config + ProtectedRoute + DashboardRouter
    │   ├── main.tsx                   # React DOM entry point
    │   └── index.css                  # Tailwind v4 import + global resets
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.app.json
    └── vite.config.ts
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │                   React App                       │  │
│  │                                                   │  │
│  │  ┌─────────────┐    ┌──────────────────────────┐ │  │
│  │  │  Auth Store  │    │      Test Store           │ │  │
│  │  │  (Zustand)   │    │      (Zustand)            │ │  │
│  │  │  persisted   │    │      persisted            │ │  │
│  │  │  localStorage│    │      localStorage         │ │  │
│  │  └──────┬───────┘    └───────────┬──────────────┘ │  │
│  │         │                        │                 │  │
│  │  ┌──────▼────────────────────────▼──────────────┐ │  │
│  │  │               React Router v7                 │ │  │
│  │  │                                               │ │  │
│  │  │  /login          → LoginPage                  │ │  │
│  │  │  /dashboard      → DashboardRouter            │ │  │
│  │  │                    ├─ AdminDashboard           │ │  │
│  │  │                    ├─ TutorDashboard           │ │  │
│  │  │                    └─ StudentDashboard         │ │  │
│  │  │  /tests          → TestsPage                  │ │  │
│  │  │  /test-builder   → TestBuilderPage            │ │  │
│  │  │  /students       → StudentManagementPage      │ │  │
│  │  │  /reports        → ReportsPage                │ │  │
│  │  │  /my-students    → StudentManagementPage      │ │  │
│  │  │  /student/:id    → StudentDetailPage          │ │  │
│  │  │  /my-tests       → MyTestsPage                │ │  │
│  │  │  /my-progress    → MyProgressPage             │ │  │
│  │  │  /test-review/:id→ TestReviewPage             │ │  │
│  │  │                                               │ │  │
│  │  │  [Fullscreen — no layout wrapper]             │ │  │
│  │  │  /test-instructions/:id → TestInstructionsPage│ │  │
│  │  │  /test/:id              → TestInterfacePage   │ │  │
│  │  └───────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Data flow during a test:**

```
TestInstructionsPage
  └─ handleStart()
       └─ useTestStore.startAttempt(attempt, test)
            └─ TestInterfacePage
                 ├─ useTimer(timeLimit, onExpire)
                 │    └─ onExpire → useTestStore.advanceSection()
                 ├─ question interactions
                 │    └─ useTestStore.updateAnswer(sectionId, questionId, answer, state)
                 ├─ visibilitychange listener
                 │    └─ useTestStore.recordTabSwitch()
                 └─ Submit → useTestStore.completeAttempt()
                              └─ navigate('/test-review/:attemptId')
```

---

## Data Models

```typescript
// Core user with role
interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'tutor' | 'student';
  assignedTutorId?: string;      // student → their tutor
  assignedStudentIds?: string[]; // tutor → their students
}

// Question with full tagging
interface Question {
  id: string;
  text: string;
  type: 'mcq_single' | 'mcq_multi' | 'numeric';
  options?: { id: string; text: string }[];
  correctAnswer: string | string[] | number;
  topic: string;
  subTopic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation?: string;
}

// Section with independent timer
interface Section {
  id: string;
  name: string;
  timeLimit: number; // minutes
  questions: Question[];
}

// Full test entity
interface Test {
  id: string;
  title: string;
  sections: Section[];
  status: 'draft' | 'published' | 'archived';
  allowBackNavigation: boolean;
  showResults: boolean;
  assignedStudentIds?: string[];
}

// Per-question tracking during attempt
interface QuestionAttempt {
  questionId: string;
  selectedAnswer?: string | string[] | number | null;
  state: 'not_visited' | 'answered' | 'marked_review' | 'answered_marked' | 'not_answered';
  timeSpent: number; // seconds — accumulated while question is active
}

// Full attempt snapshot (persisted to localStorage)
interface TestAttempt {
  id: string;
  testId: string;
  studentId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
  currentSectionIndex: number;
  currentQuestionIndex: number;
  sections: Record<string, SectionAttempt>;
  tabSwitchCount: number;
  isFullScreen: boolean;
}

// Post-attempt analytics
interface TestAnalytics {
  attemptId: string;
  totalScore: number;
  percentile: number;
  sections: SectionAnalytics[]; // per-section correct/wrong/skipped/accuracy
  overallAccuracy: number;
  totalTimeUsed: number;
}
```

---

## Routing & Navigation

| Path | Component | Roles | Layout |
|------|-----------|-------|--------|
| `/login` | `LoginPage` | Public | None |
| `/dashboard` | `DashboardRouter` → role-specific | All | Dashboard |
| `/tests` | `TestsPage` | Admin, Super Admin | Dashboard |
| `/test-builder` | `TestBuilderPage` | Admin, Super Admin | Dashboard |
| `/students` | `StudentManagementPage` | Admin, Super Admin | Dashboard |
| `/reports` | `ReportsPage` | Admin, Super Admin | Dashboard |
| `/analytics` | `ReportsPage` | Admin, Super Admin | Dashboard |
| `/my-students` | `StudentManagementPage` | Tutor | Dashboard |
| `/student/:id` | `StudentDetailPage` | Tutor, Admin | Dashboard |
| `/my-tests` | `MyTestsPage` | Student | Dashboard |
| `/my-progress` | `MyProgressPage` | Student | Dashboard |
| `/test-review/:attemptId` | `TestReviewPage` | Student | Dashboard |
| `/test-instructions/:testId` | `TestInstructionsPage` | Student | Fullscreen |
| `/test/:testId` | `TestInterfacePage` | Student | Fullscreen |

Test pages are rendered **outside** the `DashboardLayout` — they have no sidebar, no header, and occupy the full viewport for a distraction-free experience.

---

## State Management

### `useAuthStore` (Zustand + persist)

```typescript
{
  user: User | null,
  isAuthenticated: boolean,
  login(email, password): boolean,
  logout(): void,
}
```

Persisted to `localStorage` key `auth-storage`. On reload, the user stays logged in.

### `useTestStore` (Zustand + persist)

```typescript
{
  currentAttempt: TestAttempt | null,
  currentTest: Test | null,

  startAttempt(attempt, test): void,
  updateAnswer(sectionId, questionId, answer, state): void,
  markForReview(sectionId, questionId): void,
  advanceQuestion(): void,
  advanceSection(): void,
  completeAttempt(): void,
  recordTabSwitch(): void,
  updateQuestionTime(sectionId, questionId, seconds): void,
}
```

Persisted to `localStorage` key `test-storage`. Enables resume after disconnection — the student returns to `/test/:testId` and finds their exact position, answers, and time tracking intact.

---

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd ACT-SAT-GO/frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173` (or the next available port).

### First login

1. Open the app in your browser
2. Use one of the demo credential buttons on the login page, or type manually:
   - **Admin:** `admin@testplatform.com` / `demo123`
   - **Student:** `student@testplatform.com` / `demo123`

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint across all source files |

### TypeScript check (without emitting)

```bash
npx tsc --noEmit -p tsconfig.app.json
```

---

## Pages & Components Reference

### Common Components

**`Button`** — Primary, secondary, ghost, danger, success variants. Accepts `icon`, `loading`, `disabled`, `size` (sm/md/lg) props.

**`Badge`** — Inline status chips. Variants: `default`, `success`, `warning`, `danger`, `info`, `purple`. Size: `sm` / `md`.

**`Card`** — White rounded panel. `padding` prop: `none | sm | md`. `StatCard` variant adds icon, trend arrow (up/down), and color accent.

**`Modal`** — Animated backdrop + centered panel. Props: `isOpen`, `onClose`, `title`, `size` (sm/md/lg/xl), `footer` (React node rendered in sticky footer).

**`DataTable`** — Generic typed table `DataTable<T>`. Accepts `columns` (with optional `sortable` and `render`), `data`, `searchable`, `searchPlaceholder`, `actions` (per-row action renderer), and `pageSize`.

### Layout Components

**`DashboardLayout`** — Root layout. Manages `collapsed` (desktop sidebar) and `mobileOpen` (mobile drawer) state. Renders `<Sidebar>` + `<Header>` + `<Outlet>`.

**`Sidebar`** — Dual-mode: desktop collapsible (`hidden md:flex`) and mobile slide-in drawer (`fixed inset-y-0 left-0 z-50`). Both render `SidebarContent` — a shared inner component with the navigation links.

**`Header`** — Top bar with page title, search (desktop only), hamburger (mobile only), notification bell, and user avatar + name + logout.

---

## Responsive Design

The entire UI is mobile-first using Tailwind CSS responsive prefixes:

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| (default) | < 640px | Mobile: single column, drawer sidebar, bottom-sheet palette |
| `sm:` | ≥ 640px | Small tablet: 2-column grids, some hidden items shown |
| `md:` | ≥ 768px | Tablet: desktop sidebar appears, full header search shown |
| `lg:` | ≥ 1024px | Desktop: 3-4 column grids, full chart layouts |

**Key responsive patterns:**

- **Sidebar:** Hidden on mobile behind a hamburger button. Opens as a full-height drawer with a black overlay. Desktop sidebar is collapsible (icon-only mode).
- **Test palette:** On mobile becomes a bottom-sheet drawer triggered by a button showing `X/Y answered`. On desktop it's a fixed right-side panel.
- **Data tables:** Columns hide gracefully on small screens (email hidden on mobile, some action buttons hidden on small screens).
- **Charts:** All wrapped in `<ResponsiveContainer width="100%" height={...}>` — adapts to any container width.
- **Grids:** Stats use `grid-cols-2 md:grid-cols-4`, chart panels use `grid-cols-1 lg:grid-cols-3`.
- **Modals:** Full-width on mobile, max-width constrained on desktop.

---

## Anti-Cheating System

The platform implements a multi-layer anti-cheating approach:

### Tab Switch Detection

```typescript
// In TestInterfacePage.tsx
useEffect(() => {
  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') {
      recordTabSwitch(); // increments tabSwitchCount in store
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, []);
```

- First switch: warning modal shown to student
- All switches: count logged on `TestAttempt.tabSwitchCount`
- Admins can view tab switch counts per student in reports

### Full-Screen Enforcement

- `TestAttempt.isFullScreen` flag tracks fullscreen state
- Integration point: wire to `document.requestFullscreen()` and `fullscreenchange` event

### Time Anomaly Detection

- Per-question `timeSpent` in seconds is tracked continuously
- Unusually high time on a single question (idle detection) is visible in analytics
- Unusually low time (copied answers) can be flagged with threshold rules

### Academic Integrity Notice

- Pre-test instructions page includes an explicit Academic Integrity Notice
- Student must check an agreement checkbox before the Start button enables
- Agreement text: declaration of no prohibited materials, understanding of monitoring

---

## Future Backend Integration

The frontend is built to swap mock data for real API calls with minimal changes:

### Authentication

Replace `useAuthStore.login()` logic:
```typescript
// Current (mock)
const user = MOCK_USERS.find(u => u.email === email && u.password === password);

// Future (API)
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
const { token, user } = await response.json();
// Store token in store, attach as Authorization header to all requests
```

### Test Attempt Sync

The store actions map directly to REST endpoints:

| Store Action | API Endpoint |
|---|---|
| `startAttempt()` | `POST /api/attempts` |
| `updateAnswer()` | `PATCH /api/attempts/:id/answer` |
| `advanceSection()` | `PATCH /api/attempts/:id/section` |
| `completeAttempt()` | `POST /api/attempts/:id/complete` |
| `recordTabSwitch()` | `POST /api/attempts/:id/events` |

### Autosave

Add an interval in `TestInterfacePage.tsx`:
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    if (currentAttempt) {
      fetch(`/api/attempts/${currentAttempt.id}`, {
        method: 'PATCH',
        body: JSON.stringify(currentAttempt),
      });
    }
  }, 30_000); // every 30 seconds
  return () => clearInterval(interval);
}, [currentAttempt]);
```

### Mock Data Replacement

All mock data lives in `src/data/mockData.ts`. Replace exports with React Query hooks or SWR fetchers:

```typescript
// Before
import { MOCK_STUDENTS } from '../../data/mockData';

// After
const { data: students } = useQuery(['students'], fetchStudents);
```

---

## License

Private — all rights reserved. For licensing inquiries contact the repository owner.
