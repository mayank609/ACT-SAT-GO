import { Play, RotateCcw, Eye, Clock, Target, Calendar, Lock } from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import type { AssignedTestData } from '../../hooks/useAssignedTests';
import { formatDueDate, formatAvailabilityWindow, getTotalDuration, getTotalQuestions } from '../../hooks/useAssignedTests';

interface TestCardProps {
  test: AssignedTestData;
  onStart: (testId: string) => void;
  onResume: (testId: string, attemptId: string) => void;
  onReview: (attemptId: string) => void;
}

export function TestCard({ test, onStart, onResume, onReview }: TestCardProps) {
  const totalDuration = getTotalDuration(test.sections);
  const totalQuestions = getTotalQuestions(test.sections);
  const isCompleted = test.status === 'Completed';
  const isInProgress = test.status === 'In Progress';
  const isExpired = test.status === 'Expired';
  const isNotAvailable = test.availabilityState === 'upcoming';

  return (
    <div className={`bg-white border rounded-xl p-4 transition-all hover:shadow-sm ${isExpired ? 'border-red-100' : 'border-slate-100'}`}>
      {/* Header with status badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium truncate ${isExpired ? 'text-slate-500' : 'text-slate-900'}`}>
            {test.title}
          </h3>
          {test.description && (
            <p className="text-xs text-slate-400 truncate mt-1">{test.description}</p>
          )}
        </div>
        <Badge 
          variant={
            isCompleted ? 'success' :
            isInProgress ? 'warning' :
            isExpired ? 'danger' :
            'default'
          }
          size="sm"
          className="ml-2 flex-shrink-0"
        >
          {test.status}
        </Badge>
      </div>

      {/* Test metadata */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Target size={14} className="text-slate-400" />
          <span>{totalQuestions} questions</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <Clock size={14} className="text-slate-400" />
          <span>{totalDuration} minutes</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <Calendar size={14} className="text-slate-400" />
          <span>{formatDueDate(test.dueDate)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <span className="text-xs font-medium">{test.remainingAttempts}/{test.maxAttempts} attempts</span>
        </div>
      </div>

      {/* Availability window */}
      <div className="mb-4 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
        <p className="text-xs text-slate-600 flex items-center gap-1.5">
          <span className="text-slate-400">Availability:</span>
          <span className="font-medium">{formatAvailabilityWindow(test.availableFrom, test.availableUntil)}</span>
        </p>
      </div>

      {/* Sections breakdown (collapsible) */}
      {test.sections.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {test.sections.map((section) => (
            <div key={section.id} className="flex items-center justify-between text-xs px-2 py-1.5 bg-slate-50 rounded border border-slate-100">
              <span className="text-slate-700">{section.name}</span>
              <span className="text-slate-500">{section.durationMinutes}m • {section._count?.questions ?? 0}q</span>
            </div>
          ))}
        </div>
      )}

      {/* Status-specific info */}
      {isInProgress && test.inProgressAttemptId && (
        <div className="mb-4 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-xs text-blue-700">
            <span className="font-medium">In Progress:</span> Continue from where you left off
          </p>
        </div>
      )}

      {isCompleted && test.submittedAttemptId && (
        <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg">
          <p className="text-xs text-emerald-700">
            <span className="font-medium">Submitted:</span> View your attempt details
          </p>
        </div>
      )}

      {isExpired && (
        <div className="mb-4 p-2.5 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-xs text-red-700">
            <span className="font-medium">Expired:</span> This test is no longer available
          </p>
        </div>
      )}

      {isNotAvailable && (
        <div className="mb-4 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
          <p className="text-xs text-amber-700">
            <span className="font-medium">Upcoming:</span> This test will be available soon
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {isNotAvailable ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Lock size={14} />}
            disabled
          >
            Not Available Yet
          </Button>
        ) : isExpired ? (
          <Button
            size="sm"
            variant="secondary"
            disabled
          >
            Test Expired
          </Button>
        ) : isCompleted ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={<Eye size={14} />}
              onClick={() => test.submittedAttemptId && onReview(test.submittedAttemptId)}
            >
              Review Attempt
            </Button>
            {test.remainingAttempts > 0 && (
              <Button
                size="sm"
                variant="primary"
                icon={<RotateCcw size={14} />}
                onClick={() => onStart(test.testId)}
              >
                Retry Test
              </Button>
            )}
          </>
        ) : isInProgress ? (
          <Button
            size="sm"
            variant="primary"
            icon={<RotateCcw size={14} />}
            onClick={() => test.inProgressAttemptId && onResume(test.testId, test.inProgressAttemptId)}
          >
            Resume Test
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            icon={<Play size={14} />}
            onClick={() => onStart(test.testId)}
          >
            Start Test
          </Button>
        )}
      </div>
    </div>
  );
}
