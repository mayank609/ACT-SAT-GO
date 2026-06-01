import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, FileSearch, CheckCircle, Clock, Target, Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';

interface AssignedTest {
  assignmentId: string;
  testId: string;
  title: string;
  description?: string;
  status: 'Not Started' | 'In Progress' | 'Completed' | 'Expired';
  remainingAttempts: number;
  maxAttempts: number;
  inProgressAttemptId?: string | null;
  submittedAttemptId?: string | null;
  sections: Array<{ id: string; name: string; durationMinutes: number; _count?: { questions: number } }>;
  dueDate?: string;
}

interface Attempt {
  id: string;
  status: string;
  totalScore: number | null;
  completedAt: string | null;
  startedAt: string;
  test: { title: string };
}

export function StudentDashboard() {
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const [tests, setTests] = useState<AssignedTest[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    Promise.all([
      api.getAssignedTests(dbId).then(r => setTests((r.assignedTests ?? []) as AssignedTest[])).catch(() => {}),
      api.getStudentAttempts(dbId).then(r => setAttempts(((r.attempts ?? []) as Attempt[]).filter(a => a.status === 'SUBMITTED'))).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [dbId]);

  const pending = tests.filter(t => t.status === 'Not Started' || t.status === 'In Progress');
  const completed = tests.filter(t => t.status === 'Completed');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="text-[#1b3d6e] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hello, {firstName}</h1>
        <p className="text-gray-500 text-sm mt-0.5">Welcome to your diagnostic test portal</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Assigned', value: tests.length, icon: <Target size={15} />, color: 'text-[#1b3d6e] bg-blue-50' },
          { label: 'Completed', value: completed.length, icon: <CheckCircle size={15} />, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Pending', value: pending.length, icon: <Clock size={15} />, color: 'text-amber-700 bg-amber-50' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 text-center">
            <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md mb-2 ${s.color}`}>
              {s.icon} {s.label}
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending tests */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Tests to Complete</h2>
          <div className="space-y-2">
            {pending.map((test) => {
              const totalQ = test.sections.reduce((a, s) => a + (s._count?.questions ?? 0), 0);
              const totalMin = test.sections.reduce((a, s) => a + s.durationMinutes, 0);
              const isInProgress = test.status === 'In Progress';
              return (
                <div key={test.assignmentId} className="bg-white border-2 border-[#1b3d6e]/20 rounded-xl p-4 hover:border-[#1b3d6e]/40 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${isInProgress ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-[#1b3d6e]'}`}>
                          {isInProgress ? 'In Progress' : 'Not Started'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900">{test.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {test.sections.length} sections · {totalQ} questions · {totalMin} min
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {test.sections.map(s => (
                          <span key={s.id} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{s.name}</span>
                        ))}
                      </div>
                      {test.dueDate && (
                        <p className="text-xs text-red-500 mt-1.5">Due: {new Date(test.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
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
                      {isInProgress ? 'Continue' : 'Start Test'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed tests / results */}
      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Completed Tests</h2>
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-50">
              {completed.map((test) => {
                // Find matching submitted attempt for this test
                const attempt = attempts.find(a => a.test?.title === test.title);
                return (
                  <div key={test.assignmentId} className="flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={14} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{test.title}</p>
                      {attempt?.completedAt && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Completed {new Date(attempt.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {attempt.totalScore !== null && ` · Score: ${attempt.totalScore}`}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => test.submittedAttemptId && navigate(`/test-review/${test.submittedAttemptId}`)}
                      disabled={!test.submittedAttemptId}
                      className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#1b3d6e] bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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

      {/* Review mistakes section */}
      {attempts.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-amber-50 border border-red-100 rounded-xl p-4 hover:border-red-200 transition-colors cursor-pointer"
          onClick={() => navigate('/mistakes')}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={18} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Review Mistakes</p>
                <p className="text-xs text-gray-600 mt-0.5">See all wrong and unattempted questions from all your tests</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate('/mistakes');
              }}
              className="flex-shrink-0 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              View
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {tests.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-xl py-16 text-center">
          <Target size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No tests assigned yet</p>
          <p className="text-gray-400 text-sm mt-1">Your admin will assign diagnostic tests to you soon.</p>
        </div>
      )}
    </div>
  );
}
