import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Auth
import { LoginPage } from './pages/auth/LoginPage';

// Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { SuperAdminDashboard } from './pages/admin/SuperAdminDashboard';
import { TestBuilderPage } from './pages/admin/TestBuilderPage';
import { StudentManagementPage } from './pages/admin/StudentManagementPage';
import { TutorManagementPage } from './pages/admin/TutorManagementPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { TestsPage } from './pages/admin/TestsPage';
import { MonitoringPage } from './pages/admin/MonitoringPage';
import { SettingsPage } from './pages/admin/SettingsPage';

// Tutor pages
import { TutorDashboard } from './pages/tutor/TutorDashboard';
import { StudentDetailPage } from './pages/tutor/StudentDetailPage';
import { TutorAnalyticsPage } from './pages/tutor/TutorAnalyticsPage';

// Student pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { TestInstructionsPage } from './pages/student/TestInstructionsPage';
import { TestInterfacePage } from './pages/student/TestInterfacePage';
import { TestReviewPage } from './pages/student/TestReviewPage';
import { MyTestsPage } from './pages/student/MyTestsPage';
import { MyProgressPage } from './pages/student/MyProgressPage';

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
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
          <Route path="tutors" element={<TutorManagementPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="monitoring" element={<MonitoringPage />} />

          {/* Super Admin only */}
          <Route path="user-management" element={<SuperAdminDashboard />} />

          {/* Tutor */}
          <Route path="my-students" element={<StudentManagementPage />} />
          <Route path="student/:id" element={<StudentDetailPage />} />
          <Route path="analytics" element={<AnalyticsRouter />} />

          {/* Student */}
          <Route path="my-tests" element={<MyTestsPage />} />
          <Route path="my-progress" element={<MyProgressPage />} />
          <Route path="test-review/:attemptId" element={<TestReviewPage />} />

          {/* Shared */}
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
