import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Play, Clock, ListChecks, CheckCircle, Loader2, AlertCircle,
  FileSearch, PieChart, MessageCircle, Award, Target, Hourglass,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useAssignedTests, getTotalDuration, getTotalQuestions, type AssignedTestData } from '../../hooks/useAssignedTests';
import { loadStudentAnalytics, aggregate, computeSatScore, type LoadedAttempt, type QRecord } from '../../lib/analyticsData';
import { formatDate } from '../../lib/utils';

// Where "Enroll" sends a demo student. Overridable per environment.
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER ?? '918085559439';
const ENROLL_HREF =
  import.meta.env.VITE_ENROLL_URL ??
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi! I just finished the free demo test and I'd like to know more about enrolling.")}`;

/**
 * Landing page for Free Demo Test accounts (user.isDemo).
 *
 * A demo account has exactly one assigned test with one attempt. This page is
 * the whole "portal" for them: start/resume the test, then see the score and
 * jump to the full report/analytics, with a clear path to enroll.
 */
export function DemoDashboard() {
  const navigate = useNavigate();
  const { user, dbId } = useAuthStore();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const { tests, loading: testsLoading, error } = useAssignedTests(dbId ?? undefined);
  const [attempts, setAttempts] = useState<LoadedAttempt[]>([]);
  const [records, setRecords] = useState<Map<string, QRecord[]>>(new Map());
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // The demo test is the single active assignment. Prefer one with an attempt.
  const demoTest: AssignedTestData | null = useMemo(() => {
    if (!tests.length) return null;
    return (
      tests.find((t) => t.status === 'In Progress') ??
      tests.find((t) => t.status === 'Completed') ??
      tests.find((t) => t.status === 'Not Started') ??
      tests[0]
    );
  }, [tests]);

  const completed = demoTest?.status === 'Completed';

  useEffect(() => {
    if (!dbId || !completed) {
      setAnalyticsLoading(false);
      return;
    }
    setAnalyticsLoading(true);
    loadStudentAnalytics(dbId)
      .then(({ attempts, records }) => {
        setAttempts(attempts);
        setRecords(records);
      })
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, [dbId, completed]);

  const attempt = useMemo(() => {
    if (!demoTest?.submittedAttemptId) return attempts[0] ?? null;
    return attempts.find((a) => a.id === demoTest.submittedAttemptId) ?? attempts[0] ?? null;
  }, [attempts, demoTest]);

  const recs = attempt ? records.get(attempt.id) ?? [] : [];
  const agg = aggregate(recs);
  const sat = recs.length ? computeSatScore(recs) : null;
  const accuracyPct = agg.correct + agg.incorrect > 0 ? Math.round((agg.correct / (agg.correct + agg.incorrect)) * 100) : 0;
  const isScaled = attempt?.scoreMode !== 'raw';
  const displayScore = attempt?.totalScore ?? sat?.total ?? null;

  const startOrResume = () => {
    if (!demoTest) return;
    if (demoTest.status === 'In Progress' && demoTest.inProgressAttemptId) {
      navigate(`/test/${demoTest.testId}?attemptId=${demoTest.inProgressAttemptId}`);
    } else {
      navigate(`/test-instructions/${demoTest.testId}`);
    }
  };

  const reviewAttemptId = demoTest?.submittedAttemptId ?? attempt?.id ?? null;

  if (testsLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0B1E36] via-[#12305a] to-[#1b3d6e] text-white p-6 md:p-8 shadow-lg">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider bg-amber-400/15 text-amber-300 px-2.5 py-1 rounded-full">
          <Sparkles size={12} /> Free Demo Test
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold mt-3">Welcome, {firstName}!</h1>
        <p className="text-slate-300 mt-1.5 max-w-2xl text-sm md:text-base">
          {completed
            ? 'Your demo test is complete. Explore your score report below, then talk to us about a personalised prep plan.'
            : 'This is the same exam platform our enrolled students use. Take your one free demo test to get a real score and a detailed analysis of your strengths and weak areas.'}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* No test assigned yet */}
      {!demoTest && !error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 flex gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Hourglass size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Your demo test is being prepared</h2>
            <p className="text-sm text-slate-600 mt-1">
              Your account is ready, but a demo test has not been assigned yet. Our team will assign it shortly — check back soon, or message us to speed things up.
            </p>
            <a href={ENROLL_HREF} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
              <MessageCircle size={16} /> Chat with us on WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Test card */}
      {demoTest && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  completed ? 'bg-emerald-100 text-emerald-700' : demoTest.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {completed ? 'Completed' : demoTest.status === 'In Progress' ? 'In Progress' : 'Ready to start'}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">1 attempt</span>
              </div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900 mt-2 truncate">{demoTest.title}</h2>
              {demoTest.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{demoTest.description}</p>}

              <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5"><ListChecks size={15} className="text-slate-400" /> {demoTest.sections.length} section{demoTest.sections.length === 1 ? '' : 's'}</span>
                <span className="inline-flex items-center gap-1.5"><Target size={15} className="text-slate-400" /> {getTotalQuestions(demoTest.sections)} questions</span>
                <span className="inline-flex items-center gap-1.5"><Clock size={15} className="text-slate-400" /> {getTotalDuration(demoTest.sections)} min</span>
              </div>

              {demoTest.sections.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {demoTest.sections.map((s) => (
                    <li key={s.id} className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-600">
                      {s.name} · {s.durationMinutes} min
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2 md:w-56 flex-shrink-0">
              {!completed ? (
                <button
                  onClick={startOrResume}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-3 transition-colors"
                >
                  <Play size={16} /> {demoTest.status === 'In Progress' ? 'Resume Demo Test' : 'Start Demo Test'}
                </button>
              ) : (
                <>
                  {reviewAttemptId && (
                    <button
                      onClick={() => navigate(`/test-review/${reviewAttemptId}`)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-3 transition-colors"
                    >
                      <FileSearch size={16} /> View Full Report
                    </button>
                  )}
                  <button
                    onClick={() => navigate('/analytics')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold px-4 py-3 transition-colors"
                  >
                    <PieChart size={16} /> Score Analytics
                  </button>
                </>
              )}
              {!completed && (
                <p className="text-[11px] text-slate-400 text-center">
                  Timed sections · one attempt only · do not refresh mid-test
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Result summary */}
      {completed && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-slate-900 inline-flex items-center gap-2"><Award size={18} className="text-amber-500" /> Your Demo Score</h3>
            {attempt?.completedAt && <span className="text-xs text-slate-400">Submitted {formatDate(attempt.completedAt)}</span>}
          </div>

          {analyticsLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 size={16} className="animate-spin" /> Loading your results…</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label={isScaled ? 'Scaled Score' : 'Score'} value={displayScore != null ? String(Math.round(displayScore)) : '—'} accent />
              {sat && isScaled && sat.rwTotal > 0 && <Stat label="Reading & Writing" value={String(sat.rw)} />}
              {sat && isScaled && sat.mathTotal > 0 && <Stat label="Math" value={String(sat.math)} />}
              <Stat label="Accuracy" value={`${accuracyPct}%`} sub={`${agg.correct} correct · ${agg.incorrect} wrong · ${agg.skipped} skipped`} />
            </div>
          )}
        </div>
      )}

      {/* Enroll CTA */}
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
          <CheckCircle size={20} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900">Want the full program?</h3>
          <p className="text-sm text-slate-600 mt-0.5">
            Enrolled students get unlimited mock tests, sectional practice, homework tracking, and one-on-one tutoring with detailed analytics after every test.
          </p>
        </div>
        <a
          href={ENROLL_HREF}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 transition-colors whitespace-nowrap"
        >
          <MessageCircle size={16} /> Talk to an Advisor
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${accent ? 'text-blue-700' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
