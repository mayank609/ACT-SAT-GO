import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, FileSearch, CheckCircle, Clock, Target, Loader2, BookOpen } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';

interface ApiTest {
  assignmentId: string;
  testId: string;
  title: string;
  description?: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Expired';
  remainingAttempts: number;
  maxAttempts: number;
  inProgressAttemptId?: string | null;
  submittedAttemptId?: string | null;
  dueDate?: string;
  sections: Array<{ id: string; name: string; durationMinutes: number; _count?: { questions: number } }>;
}

export function MyTestsPage() {
  const navigate = useNavigate();
  const { dbId } = useAuthStore();
  const [tests, setTests] = useState<ApiTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    api.getAssignedTests(dbId)
      .then(r => setTests((r.assignedTests ?? []) as ApiTest[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dbId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 size={20} className="text-[#1b3d6e] animate-spin" />
      </div>
    );
  }

  const pending = tests.filter(t => t.status === 'Not Started' || t.status === 'In Progress');
  const completed = tests.filter(t => t.status === 'Completed');
  const expired = tests.filter(t => t.status === 'Expired');

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My Tests</h1>
        <p className="text-gray-500 text-sm mt-0.5">{tests.length} test{tests.length !== 1 ? 's' : ''} assigned</p>
      </div>

      {tests.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl py-16 text-center">
          <BookOpen size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No tests assigned yet</p>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">To Complete</h2>
          <div className="space-y-2">
            {pending.map((test) => {
              const totalQ = (test.sections ?? []).reduce((a, s) => a + (s._count?.questions ?? 0), 0);
              const totalMin = (test.sections ?? []).reduce((a, s) => a + s.durationMinutes, 0);
              const isInProgress = test.status === 'In Progress';
              const usedAttempts = Math.max(test.maxAttempts - test.remainingAttempts, 0);
              const isRetake = !isInProgress && usedAttempts > 0;
              return (
                <div key={test.assignmentId} className="bg-white border-2 border-[#1b3d6e]/20 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${isInProgress ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-[#1b3d6e]'}`}>
                          {isInProgress ? 'In Progress' : isRetake ? 'Retake Available' : 'Not Started'}
                        </span>
                        {test.maxAttempts > 1 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {test.remainingAttempts} of {test.maxAttempts} attempts left
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900">{test.title}</h3>
                      {test.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{test.description}</p>}
                      <p className="text-xs text-gray-500 mt-1.5">
                        {test.sections.length} section{test.sections.length !== 1 ? 's' : ''} · {totalQ} questions · {totalMin} min
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {test.sections.map(s => (
                          <span key={s.id} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{s.name}</span>
                        ))}
                      </div>
                      {test.dueDate && (
                        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                          <Clock size={10} /> Due: {new Date(test.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                      {isRetake && test.submittedAttemptId && (
                        <button
                          onClick={() => navigate(`/test-review/${test.submittedAttemptId}`)}
                          className="text-xs text-blue-600 hover:underline mt-1.5 flex items-center gap-1"
                        >
                          <FileSearch size={11} /> Review last attempt
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => isInProgress && test.inProgressAttemptId
                        ? navigate(`/test/${test.testId}?attemptId=${test.inProgressAttemptId}`)
                        : navigate(`/test-instructions/${test.testId}`)
                      }
                      className="flex-shrink-0 flex items-center gap-2 bg-[#1b3d6e] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#15305a] transition-colors"
                    >
                      <Play size={13} />
                      {isInProgress ? 'Continue' : isRetake ? 'Retake' : 'Start Test'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Completed</h2>
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-50">
              {completed.map((test) => {
                const totalQ = (test.sections ?? []).reduce((a, s) => a + (s._count?.questions ?? 0), 0);
                return (
                  <div key={test.assignmentId} className="flex items-center gap-4 px-4 py-3.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={14} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{test.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {test.sections.length} sections · {totalQ} questions
                      </p>
                    </div>
                    <button
                      onClick={() => test.submittedAttemptId && navigate(`/test-review/${test.submittedAttemptId}`)}
                      disabled={!test.submittedAttemptId}
                      className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#1b3d6e] bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <FileSearch size={13} /> View Analysis
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Expired */}
      {expired.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Expired</h2>
          <div className="space-y-1.5">
            {expired.map((test) => (
              <div key={test.assignmentId} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 opacity-60">
                <Target size={14} className="text-gray-400 flex-shrink-0" />
                <p className="text-sm text-gray-500 flex-1 truncate">{test.title}</p>
                <span className="text-xs text-gray-400 font-medium">Expired</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
