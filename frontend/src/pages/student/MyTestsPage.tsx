import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Play, RotateCcw, Target, ChevronRight } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { MOCK_TESTS, MOCK_ATTEMPTS } from '../../data/mockData';
import { useAuthStore } from '../../store/useAuthStore';

export function MyTestsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const assignedTests = MOCK_TESTS.filter((t) => t.assignedStudentIds?.includes(user?.id ?? 's-1'));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Tests</h1>
        <p className="text-slate-400 text-sm mt-0.5">{assignedTests.length} tests assigned</p>
      </div>

      <div className="space-y-2">
        {assignedTests.map((test) => {
          const attempt = MOCK_ATTEMPTS.find((a) => a.testId === test.id && a.studentId === (user?.id ?? 's-1'));
          const isCompleted = attempt?.status === 'completed';
          const inProgress = attempt?.status === 'in_progress';
          const totalQ = test.sections.reduce((a, s) => a + s.questions.length, 0);
          const totalTime = test.sections.reduce((a, s) => a + s.timeLimit, 0);

          return (
            <div key={test.id} className="bg-white border border-slate-100 rounded-xl p-4">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BookOpen size={15} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{test.title}</p>
                      {test.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{test.description}</p>}
                    </div>
                    <Badge variant={isCompleted ? 'success' : inProgress ? 'warning' : 'default'} size="sm" className="flex-shrink-0">
                      {isCompleted ? 'Completed' : inProgress ? 'In Progress' : 'Not Started'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                    <span className="flex items-center gap-1"><Target size={10} /> {totalQ} questions</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {totalTime} min</span>
                    <span>{test.sections.length} sections</span>
                    {!test.allowBackNavigation && <span className="text-amber-600">No back nav</span>}
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {test.sections.map((sec) => (
                      <span key={sec.id} className="text-xs bg-slate-50 text-slate-500 px-2 py-0.5 rounded-md">
                        {sec.name}
                      </span>
                    ))}
                  </div>

                  {isCompleted && attempt && (
                    <div className="flex items-center gap-4 mt-3 p-3 bg-emerald-50 rounded-lg">
                      <div>
                        <span className="text-xl font-semibold text-slate-900">{attempt.score}</span>
                        <span className="text-slate-400 text-xs">/36</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        <p>Percentile: <span className="font-medium text-slate-700">{attempt.percentile}th</span></p>
                        <p>{attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString() : '—'}</p>
                      </div>
                      <button onClick={() => navigate(`/test-review/${attempt.id}`)} className="ml-auto text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                        Review <ChevronRight size={11} />
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    {isCompleted ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/test-review/${attempt?.id}`)}>Review Answers</Button>
                        <Button variant="ghost" size="sm" icon={<RotateCcw size={12} />}>Retake</Button>
                      </>
                    ) : (
                      <Button size="sm" icon={inProgress ? <RotateCcw size={12} /> : <Play size={12} />}
                        onClick={() => navigate(`/test-instructions/${test.id}`)}>
                        {inProgress ? 'Continue' : 'Start Test'}
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
