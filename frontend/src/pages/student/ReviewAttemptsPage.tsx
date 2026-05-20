import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Calendar, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';

interface TestAttempt {
  id: string;
  testId: string;
  testTitle: string;
  submitDate: string;
  score: number;
  totalScore: number;
  accuracy: number;
  status: 'Submitted' | 'In Review' | 'Evaluated';
  timeSpent: number;
  totalTime: number;
}

export function ReviewAttemptsPage() {
  const navigate = useNavigate();
  const { dbId } = useAuthStore();

  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAttempts() {
      if (!dbId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch completed attempts
        const response = await api.getStudentAttempts?.(dbId);
        if (response && Array.isArray(response.attempts)) {
          // Filter only submitted/evaluated attempts
          const submittedAttempts = response.attempts
            .filter((a: any) => a?.status === 'Submitted' || a?.status === 'Evaluated')
            .map((a: any) => ({
              id: String(a.id),
              testId: String(a.testId),
              testTitle: String(a.testTitle),
              submitDate: String(a.submitDate),
              score: Number(a.score),
              totalScore: Number(a.totalScore),
              accuracy: Number(a.accuracy),
              status: a.status === 'Evaluated' ? 'Evaluated' : 'Submitted',
              timeSpent: Number(a.timeSpent),
              totalTime: Number(a.totalTime),
            })) as TestAttempt[];
          setAttempts(submittedAttempts);
        }
      } catch (err) {
        setError('Failed to load test attempts. Please try again.');
        console.error('Error loading attempts:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAttempts();
  }, [dbId]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getScoreColor = (accuracy: number) => {
    if (accuracy >= 80) return 'text-emerald-700';
    if (accuracy >= 60) return 'text-amber-700';
    return 'text-red-700';
  };

  const getScoreBgColor = (accuracy: number) => {
    if (accuracy >= 80) return 'bg-emerald-50';
    if (accuracy >= 60) return 'bg-amber-50';
    return 'bg-red-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="text-blue-600 animate-spin" />
        <span className="ml-3 text-slate-600">Loading your test attempts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Review Attempts</h1>
        <p className="text-slate-600 mt-1">View and review your completed test attempts</p>
      </div>

      {/* Stats */}
      {attempts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-50 border-blue-100">
            <div className="p-4">
              <p className="text-sm text-blue-600 font-medium">Total Attempts</p>
              <p className="text-3xl font-bold text-blue-900 mt-2">{attempts.length}</p>
            </div>
          </Card>

          <Card className="bg-emerald-50 border-emerald-100">
            <div className="p-4">
              <p className="text-sm text-emerald-600 font-medium">Average Accuracy</p>
              <p className="text-3xl font-bold text-emerald-900 mt-2">
                {Math.round(attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length)}%
              </p>
            </div>
          </Card>

          <Card className="bg-purple-50 border-purple-100">
            <div className="p-4">
              <p className="text-sm text-purple-600 font-medium">Total Time Spent</p>
              <p className="text-3xl font-bold text-purple-900 mt-2">
                {formatTime(attempts.reduce((sum, a) => sum + a.timeSpent, 0))}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-red-700 hover:text-red-800 font-medium mt-1"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {attempts.length === 0 && !error && (
        <Card className="border-dashed border-2 border-slate-200 text-center py-12">
          <CheckCircle2 size={48} className="text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No completed tests yet</h3>
          <p className="text-slate-600 mb-4">Complete a test to review your attempt and detailed feedback</p>
          <Button
            variant="primary"
            onClick={() => navigate('/my-tests')}
          >
            Go to Tests
          </Button>
        </Card>
      )}

      {/* Attempts list */}
      {attempts.length > 0 && (
        <div className="space-y-3">
          {attempts.map((attempt) => (
            <div
              key={attempt.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/test-review/${attempt.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  navigate(`/test-review/${attempt.id}`);
                }
              }}
              className="hover:shadow-md transition-shadow cursor-pointer group"
            >
              <Card className="border border-slate-100">
                <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {attempt.testTitle}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-slate-600 mt-2">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} className="text-slate-400" />
                        {formatDate(attempt.submitDate)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} className="text-slate-400" />
                        {formatTime(attempt.timeSpent)} / {formatTime(attempt.totalTime)}
                      </div>
                    </div>
                  </div>

                  {/* Score badge */}
                  <div className={`text-right p-2 rounded-lg ${getScoreBgColor(attempt.accuracy)}`}>
                    <p className={`text-2xl font-bold ${getScoreColor(attempt.accuracy)}`}>
                      {attempt.score}/{attempt.totalScore}
                    </p>
                    <p className={`text-xs font-medium ${getScoreColor(attempt.accuracy)} mt-0.5`}>
                      {Math.round(attempt.accuracy)}% accuracy
                    </p>
                  </div>
                </div>

                {/* Status and action */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {attempt.status === 'Evaluated' ? (
                      <>
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <span className="text-xs font-medium text-emerald-700">Evaluated</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={16} className="text-amber-600" />
                        <span className="text-xs font-medium text-amber-700">In Review</span>
                      </>
                    )}
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Eye size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/test-review/${attempt.id}`);
                    }}
                  >
                    View Details
                  </Button>
                </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
