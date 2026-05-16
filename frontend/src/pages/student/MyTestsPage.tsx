import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Play, CheckCircle, RotateCcw } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { MOCK_TESTS, MOCK_ATTEMPTS } from '../../data/mockData';
import { useAuthStore } from '../../store/useAuthStore';

export function MyTestsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const assignedTests = MOCK_TESTS.filter((t) => t.assignedStudentIds?.includes(user?.id ?? 's-1'));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Tests</h1>
        <p className="text-slate-500 text-sm mt-0.5">{assignedTests.length} tests assigned to you</p>
      </div>

      <div className="space-y-4">
        {assignedTests.map((test) => {
          const attempt = MOCK_ATTEMPTS.find((a) => a.testId === test.id && a.studentId === (user?.id ?? 's-1'));
          const isCompleted = attempt?.status === 'completed';
          const inProgress = attempt?.status === 'in_progress';
          const totalQ = test.sections.reduce((a, s) => a + s.questions.length, 0);
          const totalTime = test.sections.reduce((a, s) => a + s.timeLimit, 0);

          return (
            <div key={test.id} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-all">
              <div className="flex items-start gap-5">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={22} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-slate-900 text-lg">{test.title}</h3>
                    <Badge variant={isCompleted ? 'success' : inProgress ? 'warning' : 'info'} className="flex-shrink-0">
                      {isCompleted ? 'Completed' : inProgress ? 'In Progress' : 'Not Started'}
                    </Badge>
                  </div>
                  {test.description && <p className="text-slate-500 text-sm mb-3">{test.description}</p>}

                  {/* Section pills */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {test.sections.map((sec) => (
                      <span key={sec.id} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                        {sec.name} · {sec.questions.length}q · {sec.timeLimit}m
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                    <span className="flex items-center gap-1.5"><BookOpen size={13} /> {totalQ} questions</span>
                    <span className="flex items-center gap-1.5"><Clock size={13} /> {totalTime} minutes total</span>
                    {!test.allowBackNavigation && <span className="text-amber-600 font-medium">No backward navigation</span>}
                  </div>

                  {isCompleted && attempt && (
                    <div className="flex items-center gap-6 p-4 bg-emerald-50 rounded-xl mb-4">
                      <CheckCircle size={20} className="text-emerald-600" />
                      <div>
                        <span className="text-3xl font-bold text-slate-900">{attempt.score}</span>
                        <span className="text-slate-500 text-sm">/36</span>
                      </div>
                      <div className="text-sm text-slate-600">
                        <p>Percentile: <span className="font-semibold text-slate-900">{attempt.percentile}th</span></p>
                        <p>Completed: {attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {isCompleted ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/test-review/${attempt?.id}`)}>
                          Review Answers
                        </Button>
                        <Button variant="ghost" size="sm" icon={<RotateCcw size={13} />}>Retake</Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        icon={inProgress ? <RotateCcw size={13} /> : <Play size={13} />}
                        onClick={() => navigate(`/test-instructions/${test.id}`)}
                      >
                        {inProgress ? 'Continue Test' : 'Start Test'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
