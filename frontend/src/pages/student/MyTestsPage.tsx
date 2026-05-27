import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Clock, Play, RotateCcw, Target, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';

interface ApiTest {
  assignmentId: string;
  testId: string;
  title: string;
  description?: string;
  category?: string;
  subCategory?: string;
  dueDate?: string;
  availableFrom?: string;
  availableUntil?: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Expired';
  completionStatus: string;
  remainingAttempts: number;
  maxAttempts: number;
  inProgressAttemptId?: string | null;
  submittedAttemptId?: string | null;
  sections: Array<{ id: string; name: string; durationMinutes: number; _count?: { questions: number } }>;
}

export function MyTestsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { dbId } = useAuthStore();

  const [tests, setTests] = useState<ApiTest[]>([]);
  const [loading, setLoading] = useState(true);

  const categoryFilter = searchParams.get('category');
  const subCategoryFilter = searchParams.get('subCategory');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (dbId) {
          const testsData = await api.getAssignedTests(dbId);
          setTests(testsData.assignedTests as ApiTest[]);
        } else {
          setTests([]);
        }
      } catch {
        // fallback: keep empty lists
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dbId]);

  const filteredTests = tests.filter(t => {
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (subCategoryFilter && t.subCategory !== subCategoryFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={20} className="text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Tests {categoryFilter ? `- ${categoryFilter}` : ''} {subCategoryFilter ? `(${subCategoryFilter})` : ''}</h1>
        <p className="text-slate-400 text-sm mt-0.5">{filteredTests.length} test{filteredTests.length !== 1 ? 's' : ''} available</p>
      </div>

      {filteredTests.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
          <BookOpen size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No tests available yet</p>
        </div>
      )}

      <div className="space-y-2">
        {filteredTests.map((test) => {
          const totalQ = test.sections.reduce((a, s) => a + (s._count?.questions ?? 0), 0);
          const totalTime = test.sections.reduce((a, s) => a + s.durationMinutes, 0);

          return (
            <div key={test.assignmentId} className="bg-white border border-slate-100 rounded-xl p-4">
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
                    <Badge variant={test.status === 'Completed' ? 'success' : test.status === 'In Progress' ? 'warning' : test.status === 'Expired' ? 'danger' : 'default'} size="sm" className="flex-shrink-0">
                      {test.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 flex-wrap">
                    <span className="flex items-center gap-1"><Target size={10} /> {totalQ} questions</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {totalTime} min</span>
                    <span>{test.sections.length} sections</span>
                    {test.dueDate && <span>Due: {new Date(test.dueDate).toLocaleDateString()}</span>}
                    <span className={`font-medium ${test.remainingAttempts === 0 ? 'text-red-400' : 'text-blue-500'}`}>
                      {test.remainingAttempts}/{test.maxAttempts} attempts left
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {test.sections.map((sec) => (
                      <span key={sec.id} className="text-xs bg-slate-50 text-slate-500 px-2 py-0.5 rounded-md">{sec.name}</span>
                    ))}
                  </div>

                  {test.status === 'Completed' && test.submittedAttemptId && (
                    <div className={`flex items-center justify-between mt-3 p-3 rounded-lg ${test.remainingAttempts > 0 ? 'bg-blue-50 border border-blue-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                      <p className={`text-xs font-medium ${test.remainingAttempts > 0 ? 'text-blue-700' : 'text-emerald-700'}`}>
                        {test.remainingAttempts > 0
                          ? `${test.remainingAttempts} attempt${test.remainingAttempts !== 1 ? 's' : ''} remaining — you can retake this test`
                          : 'All attempts used — test complete'}
                      </p>
                      <button onClick={() => navigate(`/test-review/${test.submittedAttemptId}`)} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 flex-shrink-0 ml-3">
                        Review last <ChevronRight size={11} />
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    {test.status === 'Completed' ? (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/test-review/${test.submittedAttemptId}`)}>
                          Review Attempt
                        </Button>
                        {test.remainingAttempts > 0 && (
                          <Button size="sm" icon={<RotateCcw size={12} />}
                            onClick={() => navigate(`/test-instructions/${test.testId}`)}>
                            Retake Test
                          </Button>
                        )}
                      </>
                    ) : test.status === 'Expired' ? (
                      <Button variant="ghost" size="sm" disabled>Expired</Button>
                    ) : (
                      <Button size="sm" icon={test.status === 'In Progress' ? <RotateCcw size={12} /> : <Play size={12} />}
                        onClick={() => test.status === 'In Progress' && test.inProgressAttemptId
                          ? navigate(`/test/${test.testId}?attemptId=${test.inProgressAttemptId}`)
                          : navigate(`/test-instructions/${test.testId}`)}>
                        {test.status === 'In Progress' ? 'Resume Test' : 'Start Test'}
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
