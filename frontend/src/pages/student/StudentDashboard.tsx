import { useAuthStore } from '../../store/useAuthStore';
import { WelcomeSection } from '../../components/dashboard/WelcomeSection';
import { PerformanceCards } from '../../components/dashboard/PerformanceCards';
import { TestActivityChart } from '../../components/dashboard/TestActivityChart';
import { TopicBreakdown } from '../../components/dashboard/TopicBreakdown';
import { AIRecommendations } from '../../components/dashboard/AIRecommendations';
import { UpcomingTests } from '../../components/dashboard/UpcomingTests';
import { RecentTestsTable } from '../../components/dashboard/RecentTestsTable';
import { TimeManagementAnalytics } from '../../components/dashboard/TimeManagementAnalytics';
import { SectionPerformance } from '../../components/dashboard/SectionPerformance';
import { StudyPlanner } from '../../components/dashboard/StudyPlanner';
import { NotificationsPanel } from '../../components/dashboard/NotificationsPanel';
import { Zap } from 'lucide-react';

export function StudentDashboard() {
  const { user } = useAuthStore();

  // Mock analytics data
  const analyticsData = {
    overallGrade: 'A-',
    testsTaken: 18,
    globalRank: 142,
    accuracy: 82,
    avgTimePerQuestion: 78,
    weeklyStudyHours: 24.5,
    currentStreak: 7,
    weakestSubject: 'Data Interpretation',
  };

  const strongTopics = [
    { name: 'Algebra', accuracy: 88, questionsCorrect: 22, questionsTotal: 25, status: 'strong' as const },
    { name: 'Literature', accuracy: 85, questionsCorrect: 17, questionsTotal: 20, status: 'strong' as const },
    { name: 'Physics', accuracy: 84, questionsCorrect: 21, questionsTotal: 25, status: 'strong' as const },
  ];

  const improvementTopics = [
    { name: 'Calculus', accuracy: 62, questionsCorrect: 15, questionsTotal: 25, status: 'needs_work' as const },
    { name: 'Data Interpretation', accuracy: 58, questionsCorrect: 14, questionsTotal: 24, status: 'needs_work' as const },
    { name: 'Reading Comprehension', accuracy: 71, questionsCorrect: 17, questionsTotal: 24, status: 'improving' as const },
    { name: 'Coordinate Geometry', accuracy: 65, questionsCorrect: 16, questionsTotal: 25, status: 'improving' as const },
  ];

  const sections = [
    { name: 'English', accuracy: 82, color: 'blue' as const },
    { name: 'Mathematics', accuracy: 76, color: 'purple' as const },
    { name: 'Reading', accuracy: 78, color: 'green' as const },
    { name: 'Science', accuracy: 80, color: 'orange' as const },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50">
      {/* Main content */}
      <main className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Student Dashboard</h1>
            <p className="text-slate-600 mt-1">Welcome to EduPulse AI Premium Academic Suite</p>
          </div>
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Upgrade Plan
          </button>
        </div>

        {/* Welcome Section */}
        <section className="mb-8">
          <WelcomeSection
            studentName={user?.name || 'Alex Thompson'}
            completionPercent={85}
            currentStreak={7}
            studyGoalTarget={100}
            currentXp={3450}
            nextLevel={5000}
          />
        </section>

        {/* Performance Overview */}
        <section className="mb-8">
          <PerformanceCards analytics={analyticsData} />
        </section>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Charts and Analytics (2 columns wide) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Test Activity Chart */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
              <TestActivityChart />
            </div>

            {/* Time Management Analytics */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
              <TimeManagementAnalytics />
            </div>

            {/* Upcoming Tests */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
              <UpcomingTests />
            </div>
          </div>

          {/* Right Column - Sidebar Panels */}
          <div className="space-y-6">
            {/* AI Recommendations */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
              <AIRecommendations />
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
              <NotificationsPanel />
            </div>
          </div>
        </div>

        {/* Topic Analysis & Section Performance Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
            <TopicBreakdown strongTopics={strongTopics} improvementTopics={improvementTopics} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow">
            <SectionPerformance sections={sections} />
          </div>
        </div>

        {/* Study Planner */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow mb-8">
          <StudyPlanner />
        </div>

        {/* Recent Tests Table */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow mb-8">
          <RecentTestsTable />
        </div>

        {/* Footer CTA */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-xl transition-colors shadow-sm hover:shadow-md transform hover:scale-105 transition-transform">
            🚀 Start Mock Test
          </button>
          <button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 rounded-xl transition-colors shadow-sm hover:shadow-md transform hover:scale-105 transition-transform">
            📊 View Analytics
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-colors shadow-sm hover:shadow-md transform hover:scale-105 transition-transform">
            💬 Ask AI Tutor
          </button>
          <button className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-xl transition-colors shadow-sm hover:shadow-md transform hover:scale-105 transition-transform">
            📈 Download Report
          </button>
        </div>
      </main>
    </div>
  );
}
