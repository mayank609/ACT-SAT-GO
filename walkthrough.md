# Walkthrough - Pacing Timeline & Calculator Integration

All requirements have been successfully implemented and verified in the codebase.

## 1. Dual-Mode Premium Desmos Calculator
- Integrated a premium draggable, resizable Desmos calculator in [TestInterfacePage.tsx](file:///c:/Users/pamar/OneDrive/Desktop/hehe/ACT-SAT-GO/frontend/src/pages/student/TestInterfacePage.tsx).
- Defaults to **Graphing Mode** using the Bluebook Digital SAT graphing workspace, but allows toggling to **Scientific Mode** (which dynamically resizes to a narrower scientific layout).
- Smooth dragging and resizing are handled via overlay state-locking to prevent iframe pointer intercept issues.

## 2. Relocated Timer
- Relocated the section timer in [TestInterfacePage.tsx](file:///c:/Users/pamar/OneDrive/Desktop/hehe/ACT-SAT-GO/frontend/src/pages/student/TestInterfacePage.tsx) from the top header bar to:
  - The bottom of the passage panel for passage-based questions.
  - The bottom of the question card for single standalone questions.

## 3. Pacing Timeline & Stats on Reports Dashboards
- Added a horizontal **Pacing Timeline** (visit-by-visit chronological analysis of question visits) using a `ScatterChart` in:
  - Student: [MyProgressPage.tsx](file:///c:/Users/pamar/OneDrive/Desktop/hehe/ACT-SAT-GO/frontend/src/pages/student/MyProgressPage.tsx)
  - Tutor: [TutorAnalyticsPage.tsx](file:///c:/Users/pamar/OneDrive/Desktop/hehe/ACT-SAT-GO/frontend/src/pages/tutor/TutorAnalyticsPage.tsx)
  - Admin: [ReportsPage.tsx](file:///c:/Users/pamar/OneDrive/Desktop/hehe/ACT-SAT-GO/frontend/src/pages/admin/ReportsPage.tsx)
- The timeline chart design perfectly matches the visual guidelines:
  - **Section title** centered at the very top.
  - **Legend** (Visit 1 to 4) centered below the title.
  - **Solid vertical and horizontal grid lines** using `#f1f5f9` matching the reference image.
  - **Clean axis border boundaries** using slate border lines.
  - **Vertical axis label** `"Questions"` on the left.
  - **Horizontal axis label** `"Time(in min)"` at the bottom.
  - **Integer X-axis tick intervals** representing minutes elapsed.
  - **Automatic first-section auto-selection** when student data is loaded to immediately render the chart.
- The timeline uses standard colors:
  - Visit 1: `#80245a`
  - Visit 2: `#3b82f6`
  - Visit 3: `#22c55e`
  - Visit 4: `#6366f1`
- Fully filterable by section, with calculated summary cards for average time spent, "stuck" count (≥ 90s), and "rushed" count (< 20s).
- Tooltips display question index, topic name, result status, visit pass index, and exact duration.
