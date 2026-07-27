import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Calendar, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import { resolveScoreMode, type ScoreMode } from '../../lib/testCategorize';

interface TestAttempt {
  id: string;
  testId: string;
  testTitle: string;
  submitDate: string;
  score: number;
  totalScore: number;
  accuracy: number;
  timeSpent: number;
  totalTime: number;
  scoreMode: ScoreMode;
}

export function ReviewAttemptsPage() {
  const navigate = useNavigate();
  const { dbId } = useAuthStore();

  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dbId) { setLoading(false); return; }
    api.getStudentAttempts(dbId)
      .then((response) => {
        if (!response || !Array.isArray(response.attempts)) return;
        const mapped = response.attempts
          .filter((a: any) => a?.status === 'SUBMITTED')
          .map((a: any) => {
            const sections: any[] = a.test?.sections ?? [];
            const totalQ = sections.reduce((s: number, sec: any) => s + (sec._count?.questions ?? 0), 0);
            const totalTimeMins = sections.reduce((s: number, sec: any) => s + (sec.durationMinutes ?? 0), 0);
            const timeSpentMins = Math.round(
              (a.sectionAttempts ?? []).reduce((s: number, sa: any) => {
                if (sa.startedAt && sa.completedAt)
                  return s + (new Date(sa.completedAt).getTime() - new Date(sa.startedAt).getTime());
                return s;
              }, 0) / 60000
            );
            const score = a.totalScore ?? 0;
            const scoreMode = resolveScoreMode({ category: a.test?.category, subCategory: a.test?.subCategory, title: a.test?.title });
            // Only a raw score (Practice Sheet/HW) is meaningfully "out of totalQ" — a scaled
            // Mock/Sectional score (200-1600 range) divided by question count is nonsensical.
            const accuracy = scoreMode === 'raw' && totalQ > 0 ? Math.round((score / totalQ) * 100) : 0;
            return {
              id: String(a.id),
              testId: String(a.testId),
              testTitle: a.test?.title ?? 'Unknown Test',
              submitDate: a.completedAt ?? a.startedAt,
              score,
              totalScore: totalQ,
              accuracy,
              timeSpent: timeSpentMins,
              totalTime: totalTimeMins,
              scoreMode,
            };
          }) as TestAttempt[];
        setAttempts(mapped);
      })
      .catch(() => setError('Failed to load attempts. Please try again.'))
      .finally(() => setLoading(false));
  }, [dbId]);

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
  };
  const fmtTime = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  const scoreColor = (acc: number) => acc >= 80 ? 'text-emerald-600' : acc >= 60 ? 'text-amber-600' : 'text-red-500';
  const scoreBg = (acc: number) => acc >= 80 ? 'bg-emerald-50' : acc >= 60 ? 'bg-amber-50' : 'bg-red-50';

  if (loading) return (
    <div className="flex items-center justify-center h-48 gap-2 text-slate-400 text-sm">
      <Loader2 size={18} className="animate-spin" /> Loading attempts…
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Review Attempts</h1>
        <p className="text-slate-400 text-sm mt-0.5">Your completed test history</p>
      </div>

      {attempts.length > 0 && (() => {
        // Accuracy (correct/total questions) is only meaningful for raw-scored (Practice
        // Sheet/HW) attempts — a scaled Mock/Sectional score has no "percent correct" here.
        const rawAttempts = attempts.filter(a => a.scoreMode === 'raw');
        const avgAccuracy = rawAttempts.length
          ? `${Math.round(rawAttempts.reduce((s, a) => s + a.accuracy, 0) / rawAttempts.length)}%`
          : '—';
        return (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Tests Completed', value: attempts.length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Avg Accuracy', value: avgAccuracy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Time Invested', value: fmtTime(attempts.reduce((s, a) => s + a.timeSpent, 0)), color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-100 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        );
      })()}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}

      {attempts.length === 0 && !error && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-100">
          <CheckCircle2 size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">No completed tests yet</p>
          <p className="text-slate-400 text-xs mt-1">Complete a test to review your attempt</p>
          <button onClick={() => navigate('/my-tests')}
            className="mt-4 text-xs text-blue-600 hover:text-blue-700 font-medium">
            Go to My Assignments →
          </button>
        </div>
      )}

      <div className="space-y-2">
        {attempts.map((attempt) => (
          <div key={attempt.id} onClick={() => navigate(`/test-review/${attempt.id}`)}
            className="bg-white border border-slate-100 rounded-xl p-4 cursor-pointer hover:border-slate-200 transition-colors group">
            <div className="flex items-start gap-3">
              {attempt.scoreMode === 'raw' ? (
                <div className={`w-12 h-12 rounded-xl ${scoreBg(attempt.accuracy)} flex-shrink-0 flex flex-col items-center justify-center`}>
                  <p className={`text-sm font-bold ${scoreColor(attempt.accuracy)}`}>{attempt.accuracy}%</p>
                  <p className="text-xs text-slate-400">{attempt.score}/{attempt.totalScore}</p>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex-shrink-0 flex flex-col items-center justify-center">
                  <p className="text-sm font-bold text-blue-700">{attempt.score}</p>
                  <p className="text-[10px] text-slate-400">scaled</p>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm group-hover:text-blue-600 transition-colors truncate">{attempt.testTitle}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                  <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(attempt.submitDate)}</span>
                  <span className="flex items-center gap-1"><Clock size={10} />{fmtTime(attempt.timeSpent)} / {fmtTime(attempt.totalTime)}</span>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); navigate(`/test-review/${attempt.id}`); }}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium flex-shrink-0">
                <Eye size={12} /> Review
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Review mistakes section */}
      {attempts.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-amber-50 border border-red-100 rounded-xl p-4 hover:border-red-200 transition-colors cursor-pointer mt-6"
          onClick={() => navigate('/mistakes')}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={18} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Consolidate Your Mistakes</p>
                <p className="text-xs text-gray-600 mt-0.5">View all wrong and unattempted questions from your tests in one place</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate('/mistakes');
              }}
              className="flex-shrink-0 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              View All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
