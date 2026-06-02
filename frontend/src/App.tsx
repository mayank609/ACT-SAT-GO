import { createBrowserRouter, RouterProvider, createRoutesFromElements, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Auth
import { LoginPage } from './pages/auth/LoginPage';

// Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { SuperAdminDashboard } from './pages/admin/SuperAdminDashboard';
import { TestBuilderPage } from './pages/admin/TestBuilderPage';
import { StudentManagementPage } from './pages/admin/StudentManagementPage';
import { AdminStudentProfilePage } from './pages/admin/AdminStudentProfilePage';
import { TutorManagementPage } from './pages/admin/TutorManagementPage';
import { TestsPage } from './pages/admin/TestsPage';
import { MonitoringPage } from './pages/admin/MonitoringPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { QuestionBankPage } from './pages/admin/QuestionBankPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { SupportPage } from './pages/admin/SupportPage';

// Tutor pages
import { TutorDashboard } from './pages/tutor/TutorDashboard';
import { MyStudentsPage } from './pages/tutor/MyStudentsPage';
import { StudentDetailPage } from './pages/tutor/StudentDetailPage';
import { TutorAnalyticsPage } from './pages/tutor/TutorAnalyticsPage';
import { StudentComparisonPage } from './pages/tutor/StudentComparisonPage';

// Student pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { TestInstructionsPage } from './pages/student/TestInstructionsPage';
import { TestInterfacePage } from './pages/student/TestInterfacePage';
import { TestReviewPage } from './pages/student/TestReviewPage';
import { SectionReviewPage } from './pages/student/SectionReviewPage';
import { MyTestsPage } from './pages/student/MyTestsPage';
import { MyProgressPage } from './pages/student/MyProgressPage';
import { ReviewAttemptsPage } from './pages/student/ReviewAttemptsPage';
import { MistakesPage } from './pages/student/MistakesPage';

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
  if (user.role === 'tutor') return <TutorAnalyticsPage />;
  return <ReportsPage />;
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<LoginPage />} />

      {/* Full-screen test pages (no dashboard layout) */}
      <Route path="/test-instructions/:testId" element={
        <ProtectedRoute><TestInstructionsPage /></ProtectedRoute>
      } />
      <Route path="/test/:testId" element={
        <ProtectedRoute><TestInterfacePage /></ProtectedRoute>
      } />

      {/* Dashboard layout */}
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
        <Route path="monitoring" element={<MonitoringPage />} />

        {/* Admin new pages */}
        <Route path="question-bank" element={<QuestionBankPage />} />
        <Route path="support" element={<SupportPage />} />

        {/* Super Admin only */}
        <Route path="user-management" element={<SuperAdminDashboard />} />

        {/* Tutor */}
        <Route path="my-students" element={<MyStudentsPage />} />
        <Route path="student/:id" element={<StudentDetailPage />} />
        <Route path="analytics" element={<AnalyticsRouter />} />

        {/* Shared / Tutor / Admin */}
        <Route path="comparison" element={<StudentComparisonPage />} />

        {/* Student */}
        <Route path="my-tests" element={<MyTestsPage />} />
        <Route path="my-progress" element={<MyProgressPage />} />
        <Route path="review-attempts" element={<ReviewAttemptsPage />} />
        <Route path="test-review/:attemptId" element={<TestReviewPage />} />
        <Route path="test-review/:attemptId/section/:sectionIdx" element={<SectionReviewPage />} />
        <Route path="mistakes" element={<MistakesPage />} />

        {/* Shared */}
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </>
  )
);

export default function App() {
  return <RouterProvider router={router} />;
}
