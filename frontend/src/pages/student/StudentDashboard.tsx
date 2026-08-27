import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, Clock, Target, Loader2, AlertCircle, Sparkles,
  Percent, Timer, Award, TrendingDown, CalendarCheck, BookOpenCheck,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../lib/api';
import { loadStudentAnalytics, aggregate, accuracy, avgTime, fmtTime, type QRecord } from '../../lib/analyticsData';
import { formatDate } from '../../lib/utils';

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
      {/* Welcome */}
      <div className="bg-gradient-to-br from-[#1e3a8a] via-[#1b3d6e] to-[#0f172a] rounded-2xl p-6 text-white shadow-lg border border-blue-900/40 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-blue-500/10 blur-xl" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-emerald-500/10 blur-xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-white/10 text-amber-300 backdrop-blur-md border border-white/10 hidden sm:block">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
                {greetingForHour(today.getHours())}, {firstName}! 👋
              </h1>
              <p className="text-blue-200 text-xs md:text-sm font-medium mt-1.5 italic">
                "{quote.text}" <span className="not-italic text-emerald-400 font-bold">— {quote.author}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/my-tests')}
            className="flex-shrink-0 flex items-center justify-center gap-2 bg-white text-[#1b3d6e] px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors"
          >
            Go to My Assignments →
          </button>
        </div>
      </div>

      {/* Stats row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Assigned', value: tests.length, icon: <Target size={15} />, color: 'text-[#1b3d6e] bg-blue-50', path: '/my-tests' },
          { label: 'Completed', value: completed.length, icon: <CheckCircle size={15} />, color: 'text-emerald-700 bg-emerald-50', path: '/my-progress' },
          { label: 'Remaining', value: pending.length, icon: <Clock size={15} />, color: 'text-amber-700 bg-amber-50', path: '/my-tests' },
          { label: 'Completion', value: `${completionPct}%`, icon: <Percent size={15} />, color: 'text-purple-700 bg-purple-50', path: '/my-progress' },
        ].map((s) => (
          <div
            key={s.label}
            onClick={() => navigate(s.path)}
            className="bg-white border border-gray-100 rounded-xl p-4 text-center cursor-pointer hover:border-blue-100 hover:shadow-sm transition-all"
          >
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
                    {formatDate(c.classDate)}
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
