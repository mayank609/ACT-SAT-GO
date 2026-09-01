import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, createRoutesFromElements, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from './store/useAuthStore';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Auth — kept eager so the login screen paints instantly (it's the common entry).
import { LoginPage } from './pages/auth/LoginPage';

// All other pages are code-split so each route's JS (and heavy deps like pdf.js,
// KaTeX and recharts) only loads when that route is actually visited.

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const SuperAdminDashboard = lazy(() => import('./pages/admin/SuperAdminDashboard').then((m) => ({ default: m.SuperAdminDashboard })));
const TestBuilderPage = lazy(() => import('./pages/admin/TestBuilderPage').then((m) => ({ default: m.TestBuilderPage })));
const StudentManagementPage = lazy(() => import('./pages/admin/StudentManagementPage').then((m) => ({ default: m.StudentManagementPage })));
const AdminStudentProfilePage = lazy(() => import('./pages/admin/AdminStudentProfilePage').then((m) => ({ default: m.AdminStudentProfilePage })));
const TutorManagementPage = lazy(() => import('./pages/admin/TutorManagementPage').then((m) => ({ default: m.TutorManagementPage })));
const TestsPage = lazy(() => import('./pages/admin/TestsPage').then((m) => ({ default: m.TestsPage })));
const MonitoringPage = lazy(() => import('./pages/admin/MonitoringPage').then((m) => ({ default: m.MonitoringPage })));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const QuestionBankPage = lazy(() => import('./pages/admin/QuestionBankPage').then((m) => ({ default: m.QuestionBankPage })));
const SupportPage = lazy(() => import('./pages/admin/SupportPage').then((m) => ({ default: m.SupportPage })));
const StudentDoubtsAdminPage = lazy(() => import('./pages/admin/StudentDoubtsAdminPage').then((m) => ({ default: m.StudentDoubtsAdminPage })));
const StudentMistakesPage = lazy(() => import('./pages/admin/StudentMistakesPage').then((m) => ({ default: m.StudentMistakesPage })));
const SkillsManagementPage = lazy(() => import('./pages/admin/SkillsManagementPage').then((m) => ({ default: m.SkillsManagementPage })));
const AdminAttendancePage = lazy(() => import('./pages/admin/AdminAttendancePage').then((m) => ({ default: m.AdminAttendancePage })));
const AdminTeacherSalaryPage = lazy(() => import('./pages/admin/AdminTeacherSalaryPage').then((m) => ({ default: m.AdminTeacherSalaryPage })));

// Tutor pages
const TutorDashboard = lazy(() => import('./pages/tutor/TutorDashboard').then((m) => ({ default: m.TutorDashboard })));
const MyStudentsPage = lazy(() => import('./pages/tutor/MyStudentsPage').then((m) => ({ default: m.MyStudentsPage })));
const StudentDetailPage = lazy(() => import('./pages/tutor/StudentDetailPage').then((m) => ({ default: m.StudentDetailPage })));
const TutorAnalyticsPage = lazy(() => import('./pages/tutor/TutorAnalyticsPage').then((m) => ({ default: m.TutorAnalyticsPage })));
const AttendancePage = lazy(() => import('./pages/tutor/AttendancePage').then((m) => ({ default: m.AttendancePage })));

// Student pages
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard').then((m) => ({ default: m.StudentDashboard })));
const MyAttendancePage = lazy(() => import('./pages/student/MyAttendancePage').then((m) => ({ default: m.MyAttendancePage })));
const TestInstructionsPage = lazy(() => import('./pages/student/TestInstructionsPage').then((m) => ({ default: m.TestInstructionsPage })));
const TestInterfacePage = lazy(() => import('./pages/student/TestInterfacePage').then((m) => ({ default: m.TestInterfacePage })));
const TestReviewPage = lazy(() => import('./pages/student/TestReviewPage').then((m) => ({ default: m.TestReviewPage })));
const SectionReviewPage = lazy(() => import('./pages/student/SectionReviewPage').then((m) => ({ default: m.SectionReviewPage })));
const MyTestsPage = lazy(() => import('./pages/student/MyTestsPage').then((m) => ({ default: m.MyTestsPage })));
const AnalyticsPage = lazy(() => import('./pages/student/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage').then((m) => ({ default: m.AdminAnalyticsPage })));
const ReviewAttemptsPage = lazy(() => import('./pages/student/ReviewAttemptsPage').then((m) => ({ default: m.ReviewAttemptsPage })));
const MistakesPage = lazy(() => import('./pages/student/MistakesPage').then((m) => ({ default: m.MistakesPage })));
const DoubtsPage = lazy(() => import('./pages/student/DoubtsPage').then((m) => ({ default: m.DoubtsPage })));
const MyProgressPage = lazy(() => import('./pages/student/MyProgressPage').then((m) => ({ default: m.MyProgressPage })));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-screen text-slate-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function DashboardRouter() {
  const { user } = useAuthStore();
  if (!user) return null;
  if (user.role === 'student') return <StudentDashboard />;
  if (user.role === 'tutor') return <TutorDashboard />;
  if (user.role === 'super_admin') return <SuperAdminDashboard />;
  return <AdminDashboard />;
}

function AnalyticsRouter() {
  const { user } = useAuthStore();
  if (!user) return null;
  if (user.role === 'student') return <AnalyticsPage />;
  if (user.role === 'tutor') return <TutorAnalyticsPage />;
  return <AdminAnalyticsPage />;
}

function AttendanceRouter() {
  const { user } = useAuthStore();
  if (!user) return null;
  if (user.role === 'student') return <MyAttendancePage />;
  if (user.role === 'tutor') return <AttendancePage />;
  return <AdminAttendancePage />;
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<LoginPage />} />

      {/* Full-screen test pages (no dashboard layout) */}
      <Route path="/test-instructions/:testId" element={
        <ProtectedRoute><Suspense fallback={<PageFallback />}><TestInstructionsPage /></Suspense></ProtectedRoute>
      } />
      <Route path="/test/:testId" element={
        <ProtectedRoute><Suspense fallback={<PageFallback />}><TestInterfacePage /></Suspense></ProtectedRoute>
      } />

      {/* Dashboard layout — its <Outlet/> is wrapped in Suspense for lazy children */}
      <Route path="/" element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardRouter />} />

        {/* Admin + Super Admin */}
        <Route path="tests" element={<TestsPage />} />
        <Route path="test-builder" element={<TestBuilderPage />} />
        <Route path="students" element={<StudentManagementPage />} />
        <Route path="students/:id" element={<AdminStudentProfilePage />} />
        <Route path="tutors" element={<TutorManagementPage />} />
        <Route path="teacher-salaries" element={<AdminTeacherSalaryPage />} />
        <Route path="salaries" element={<Navigate to="/teacher-salaries" replace />} />
        <Route path="monitoring" element={<MonitoringPage />} />

        {/* Admin new pages */}
        <Route path="question-bank" element={<QuestionBankPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="student-doubts" element={<StudentDoubtsAdminPage />} />
        <Route path="student-mistakes" element={<StudentMistakesPage />} />
        <Route path="skills" element={<SkillsManagementPage />} />

        {/* Super Admin only */}
        <Route path="user-management" element={<SuperAdminDashboard />} />

        {/* Tutor */}
        <Route path="my-students" element={<MyStudentsPage />} />
        <Route path="student/:id" element={<StudentDetailPage />} />
        <Route path="analytics" element={<AnalyticsRouter />} />
        <Route path="attendance" element={<AttendanceRouter />} />

        {/* Student */}
        <Route path="my-tests" element={<MyTestsPage />} />
        <Route path="my-progress" element={<MyProgressPage />} />
        <Route path="review-attempts" element={<ReviewAttemptsPage />} />
        <Route path="test-review/:attemptId" element={<TestReviewPage />} />
        <Route path="test-review/:attemptId/section/:sectionIdx" element={<SectionReviewPage />} />
        <Route path="mistakes" element={<MistakesPage />} />
        <Route path="doubts" element={<DoubtsPage />} />

        {/* Shared */}
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </>
  )
);

export default function App() {
  const initAuth = useAuthStore((s) => s.initAuth);
  const bootstrapping = useAuthStore((s) => s.bootstrapping);

  // Reconcile persisted auth with the real Supabase session before rendering
  // any route — prevents a flash of protected content (or a wrong redirect)
  // when a persisted session has actually expired or been revoked.
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  if (bootstrapping) return <PageFallback />;

  return <RouterProvider router={router} />;
}
