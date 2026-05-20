import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { TestCard } from './TestCard';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { useAssignedTests } from '../../hooks/useAssignedTests';
import type { AssignedTestData } from '../../hooks/useAssignedTests';

interface AssignedTestsSectionProps {
  studentId?: string;
  maxDisplay?: number;
  showViewAll?: boolean;
}

export function AssignedTestsSection({
  studentId,
  maxDisplay = 3,
  showViewAll = true,
}: AssignedTestsSectionProps) {
  const navigate = useNavigate();
  const { tests, loading, error, refetch } = useAssignedTests(studentId);
  const [displayedTests, setDisplayedTests] = useState<AssignedTestData[]>([]);

  useEffect(() => {
    setDisplayedTests(tests.slice(0, maxDisplay));
  }, [tests, maxDisplay]);

  const handleStartTest = async (testId: string) => {
    navigate(`/test-instructions/${testId}`);
  };

  const handleResumeTest = async (testId: string, attemptId: string) => {
    navigate(`/test/${testId}?attemptId=${attemptId}`);
  };

  const handleReviewAttempt = async (attemptId: string) => {
    navigate(`/test-review/${attemptId}`);
  };

  const inProgressCount = tests.filter((t) => t.status === 'In Progress').length;
  const completedCount = tests.filter((t) => t.status === 'Completed').length;
  const notStartedCount = tests.filter((t) => t.status === 'Not Started').length;
  const expiredCount = tests.filter((t) => t.status === 'Expired').length;

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <BookOpen size={18} className="text-blue-600" />
            Assigned Tests
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {notStartedCount} available • {inProgressCount} in progress • {completedCount} completed
            {expiredCount > 0 && ` • ${expiredCount} expired`}
          </p>
        </div>
        {showViewAll && tests.length > maxDisplay && (
          <button
            onClick={() => navigate('/my-tests')}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
          >
            View all ({tests.length})
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <Card padding="md" className="bg-red-50 border border-red-100">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">{error}</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => refetch()}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 bg-slate-100 rounded-xl animate-pulse border border-slate-200"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && tests.length === 0 && !error && (
        <Card padding="lg" className="text-center py-12">
          <BookOpen size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600 mb-1">No tests assigned yet</p>
          <p className="text-xs text-slate-400">Your tutor will assign tests here</p>
        </Card>
      )}

      {/* Tests grid */}
      {!loading && displayedTests.length > 0 && (
        <div className="space-y-3">
          {displayedTests.map((test) => (
            <TestCard
              key={test.assignmentId}
              test={test}
              onStart={handleStartTest}
              onResume={handleResumeTest}
              onReview={handleReviewAttempt}
            />
          ))}
        </div>
      )}

      {/* Refresh button */}
      {!loading && tests.length > 0 && (
        <button
          onClick={() => refetch()}
          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      )}
    </div>
  );
}
