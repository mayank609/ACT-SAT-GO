import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, FileSearch, CheckCircle, Clock, Target, Loader2, AlertCircle, Sparkles,
  Percent, Timer, Award, TrendingDown, CalendarClock, CalendarCheck, BookOpenCheck,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import { loadStudentAnalytics, aggregate, accuracy, avgTime, fmtTime, type QRecord } from '../../lib/analyticsData';

interface RecentClass {
  id: string;
  tutorName: string;
  topic: string;
  homework: string;
  classDate: string;
  createdAt: string;
}

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
  totalQuestions?: number;
  answeredCount?: number;
}

const quotes = [
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Strive for progress, not perfection.", author: "Unknown" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" }
];

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function StudentDashboard() {
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const [tests, setTests] = useState<AssignedTest[]>([]);
  const [loadedAttempts, setLoadedAttempts] = useState<{ id: string; title: string; completedAt: string | null; totalScore: number | null; isDiagnostic: boolean }[]>([]);
  const [records, setRecords] = useState<Map<string, QRecord[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [recentClasses, setRecentClasses] = useState<RecentClass[]>([]);

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    Promise.all([
      api.getAssignedTests(dbId).then(r => setTests((r.assignedTests ?? []) as AssignedTest[])).catch(() => {}),
      loadStudentAnalytics(dbId).then(({ attempts, records }) => { setLoadedAttempts(attempts); setRecords(records); }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [dbId]);

  useEffect(() => {
    if (!dbId) return;
    let cancelled = false;
    api.getTutorAssignments({ studentId: dbId })
      .then(async ({ assignments }) => {
        const lists = await Promise.all(
          assignments.map(a =>
            api.getClassProgress(a.tutorId, dbId)
              .then(r => r.entries.map(e => ({ ...e, homework: e.homework ?? '', tutorName: a.tutor.name })))
              .catch(() => [] as RecentClass[])
          )
        );
        if (cancelled) return;
        const merged = lists.flat().sort((a, b) =>
          new Date(b.classDate).getTime() - new Date(a.classDate).getTime() ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setRecentClasses(merged.slice(0, 4));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [dbId]);

  const pending = tests.filter(t => t.status === 'Not Started' || t.status === 'In Progress');
  const completed = tests.filter(t => t.status === 'Completed');
  const completionPct = tests.length ? Math.round((completed.length / tests.length) * 100) : 0;

  const continueTest = pending.find(t => t.status === 'In Progress') ?? pending[0] ?? null;
  const upcomingTest = pending
    .filter(t => t.dueDate)
    .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime())[0] ?? null;

  // Non-diagnostic scored records across all this student's submitted attempts —
  // same scope AdminAnalyticsPage uses for a student's cumulative view.
  const nonDiagRecords = useMemo(() => {
    const nonDiagIds = new Set(loadedAttempts.filter(a => !a.isDiagnostic).map(a => a.id));
    const out: QRecord[] = [];
    for (const [id, recs] of records) if (nonDiagIds.has(id)) out.push(...recs);
    return out;
  }, [loadedAttempts, records]);

  const overallAgg = useMemo(() => aggregate(nonDiagRecords), [nonDiagRecords]);
  const rwAgg = useMemo(() => aggregate(nonDiagRecords.filter(r => r.subject === 'rw')), [nonDiagRecords]);
  const mathAgg = useMemo(() => aggregate(nonDiagRecords.filter(r => r.subject === 'math')), [nonDiagRecords]);
  const rwAcc = accuracy(rwAgg);
  const mathAcc = accuracy(mathAgg);
  const hasSubjectData = rwAgg.total > 0 && mathAgg.total > 0;
  const bestSubject = hasSubjectData ? (rwAcc >= mathAcc ? { name: 'Reading & Writing', pct: rwAcc } : { name: 'Math', pct: mathAcc }) : null;
  const weakSubject = hasSubjectData ? (rwAcc < mathAcc ? { name: 'Reading & Writing', pct: rwAcc } : { name: 'Math', pct: mathAcc }) : null;

  const quoteIndex = (dbId ? dbId.length : 0) % quotes.length;
  const quote = quotes[quoteIndex];
  const today = new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="text-[#1b3d6e] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Welcome + Continue Learning */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-gradient-to-br from-[#1e3a8a] via-[#1b3d6e] to-[#0f172a] rounded-2xl p-6 text-white shadow-lg border border-blue-900/40 relative overflow-hidden flex flex-col">
          <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-blue-500/10 blur-xl" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-emerald-500/10 blur-xl" />

          <div className="relative z-10 space-y-4 flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
                  {greetingForHour(today.getHours())}, {firstName}! 👋
                </h1>
                <p className="text-blue-200 text-xs md:text-sm font-medium mt-1">
                  {continueTest ? "Let's pick up where you left off." : "Welcome to your diagnostic test portal."}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-white/10 text-amber-300 backdrop-blur-md border border-white/10 hidden sm:block">
                <Sparkles size={20} />
              </div>
            </div>

            {continueTest ? (
              (() => {
                const totalQ = continueTest.totalQuestions ?? (continueTest.sections ?? []).reduce((a, s) => a + (s._count?.questions ?? 0), 0);
                const answered = continueTest.answeredCount ?? 0;
                const pct = totalQ > 0 ? Math.round((answered / totalQ) * 100) : 0;
                const isInProgress = continueTest.status === 'In Progress';
                const totalMin = (continueTest.sections ?? []).reduce((a, s) => a + s.durationMinutes, 0);
                const go = () => isInProgress && continueTest.inProgressAttemptId
                  ? navigate(`/test/${continueTest.testId}?attemptId=${continueTest.inProgressAttemptId}`)
                  : navigate(`/test-instructions/${continueTest.testId}`);
                return (
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                    <p className="text-[10px] uppercase tracking-wide text-blue-200 font-semibold mb-1">
                      {isInProgress ? 'Continue Learning' : 'Start Next'}
                    </p>
                    <h3 className="font-bold text-lg">{continueTest.title}</h3>
                    {totalQ > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-blue-200 mb-1">
                          <span>Progress</span>
                          <span>{answered} / {totalQ} Questions</span>
                        </div>
                        <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-blue-200">
                      {totalQ > 0 && <span>{Math.max(totalQ - answered, 0)} questions left</span>}
                      {totalMin > 0 && <span>{totalMin} min total</span>}
                    </div>
                    <button onClick={go} className="mt-4 w-full flex items-center justify-center gap-2 bg-white text-[#1b3d6e] px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors">
                      <Play size={13} /> {isInProgress ? 'Resume Test' : 'Start Test'}
                    </button>
                  </div>
                );
              })()
            ) : (
              <div className="border-t border-white/10 pt-4 mt-2">
                <p className="text-xs md:text-sm italic text-blue-100/90 leading-relaxed">"{quote.text}"</p>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mt-1">— {quote.author}</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming test */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1b3d6e] flex items-center justify-center flex-shrink-0"><CalendarClock size={16} /></div>
            <p className="text-sm font-semibold text-gray-900">Upcoming Test</p>
          </div>
          {upcomingTest ? (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{upcomingTest.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Due {new Date(upcomingTest.dueDate as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={() => navigate(`/test-instructions/${upcomingTest.testId}`)}
                className="mt-3 w-full text-center text-xs font-semibold text-[#1b3d6e] border border-[#1b3d6e]/30 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
              >
                View Details
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400 flex-1 flex items-center">No upcoming due dates right now.</p>
          )}
        </div>
      </div>

      {/* Stats row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Assigned', value: tests.length, icon: <Target size={15} />, color: 'text-[#1b3d6e] bg-blue-50' },
          { label: 'Completed', value: completed.length, icon: <CheckCircle size={15} />, color: 'text-emerald-700 bg-emerald-50' },
          { label: 'Remaining', value: pending.length, icon: <Clock size={15} />, color: 'text-amber-700 bg-amber-50' },
          { label: 'Completion', value: `${completionPct}%`, icon: <Percent size={15} />, color: 'text-purple-700 bg-purple-50' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 text-center">
            <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md mb-2 ${s.color}`}>
              {s.icon} {s.label}
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Stats row 2 — real cumulative performance, from all non-diagnostic submitted attempts */}
      {overallAgg.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md mb-2 text-emerald-700 bg-emerald-50"><Percent size={15} /> Avg Accuracy</div>
            <p className="text-2xl font-bold text-gray-900">{accuracy(overallAgg)}%</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md mb-2 text-blue-700 bg-blue-50"><Timer size={15} /> Avg Time</div>
            <p className="text-2xl font-bold text-gray-900">{fmtTime(avgTime(overallAgg))}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">per question</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md mb-2 text-amber-700 bg-amber-50"><Award size={15} /> Best Subject</div>
            <p className="text-lg font-bold text-gray-900">{bestSubject?.name ?? '—'}</p>
            {bestSubject && <p className="text-[10px] text-gray-400 mt-0.5">{bestSubject.pct}% accuracy</p>}
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md mb-2 text-red-700 bg-red-50"><TrendingDown size={15} /> Needs Improvement</div>
            <p className="text-lg font-bold text-gray-900">{weakSubject?.name ?? '—'}</p>
            {weakSubject && <p className="text-[10px] text-gray-400 mt-0.5">{weakSubject.pct}% accuracy</p>}
          </div>
        </div>
      )}

      {/* Pending tests */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Tests to Complete</h2>
          <div className="space-y-2">
            {pending.map((test) => {
              const totalQ = test.totalQuestions ?? (test.sections ?? []).reduce((a, s) => a + (s._count?.questions ?? 0), 0);
              const answered = test.answeredCount ?? 0;
              const pct = totalQ > 0 ? Math.round((answered / totalQ) * 100) : 0;
              const totalMin = (test.sections ?? []).reduce((a, s) => a + s.durationMinutes, 0);
              const isInProgress = test.status === 'In Progress';
              const go = () => isInProgress && test.inProgressAttemptId
                ? navigate(`/test/${test.testId}?attemptId=${test.inProgressAttemptId}`)
                : navigate(`/test-instructions/${test.testId}`);
              return (
                <div key={test.assignmentId} onClick={go} className="bg-white border-2 border-[#1b3d6e]/20 rounded-xl p-4 hover:border-[#1b3d6e]/40 transition-colors cursor-pointer">
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
                      {isInProgress && totalQ > 0 && (
                        <div className="mt-2 max-w-[220px]">
                          <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                            <span>{pct}% complete</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}
                      {test.dueDate && (
                        <p className="text-xs text-red-500 mt-1.5">Due: {new Date(test.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); go(); }}
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
                const attempt = loadedAttempts.find(a => a.title === test.title);
                const review = () => test.submittedAttemptId && navigate(`/test-review/${test.submittedAttemptId}`);
                return (
                  <div
                    key={test.assignmentId}
                    onClick={review}
                    className={`flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition-colors ${test.submittedAttemptId ? 'cursor-pointer' : ''}`}
                  >
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
                      onClick={(e) => { e.stopPropagation(); review(); }}
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

      {/* Recent Classes */}
      {recentClasses.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1b3d6e] flex items-center justify-center flex-shrink-0"><CalendarCheck size={16} /></div>
              <p className="text-sm font-semibold text-gray-900">Recent Classes</p>
            </div>
            <button onClick={() => navigate('/attendance')} className="text-xs font-semibold text-[#1b3d6e] hover:underline">View all</button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentClasses.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900">{c.topic}</p>
                  <p className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(c.classDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                {c.homework && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1 inline-flex items-center gap-1 mt-1.5">
                    <BookOpenCheck size={11} /> {c.homework}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">with {c.tutorName}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review mistakes section */}
      {loadedAttempts.length > 0 && (
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
