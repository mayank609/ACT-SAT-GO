import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Calendar, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
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
            return {
              id: String(a.id),
              testId: String(a.testId),
              testTitle: a.test?.title ?? 'Unknown Test',
              submitDate: a.completedAt ?? a.startedAt,
              score,
              totalScore: totalQ,
              accuracy: totalQ > 0 ? Math.round((score / totalQ) * 100) : 0,
              timeSpent: timeSpentMins,
              totalTime: totalTimeMins,
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

      {attempts.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Tests Completed', value: attempts.length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Avg Accuracy', value: `${Math.round(attempts.reduce((s, a) => s + a.accuracy, 0) / attempts.length)}%`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Time Invested', value: fmtTime(attempts.reduce((s, a) => s + a.timeSpent, 0)), color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-slate-100 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

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
            Go to My Tests →
          </button>
        </div>
      )}

      <div className="space-y-2">
        {attempts.map((attempt) => (
          <div key={attempt.id} onClick={() => navigate(`/test-review/${attempt.id}`)}
            className="bg-white border border-slate-100 rounded-xl p-4 cursor-pointer hover:border-slate-200 transition-colors group">
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-xl ${scoreBg(attempt.accuracy)} flex-shrink-0 flex flex-col items-center justify-center`}>
                <p className={`text-sm font-bold ${scoreColor(attempt.accuracy)}`}>{attempt.accuracy}%</p>
                <p className="text-xs text-slate-400">{attempt.score}/{attempt.totalScore}</p>
              </div>
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
    </div>
  );
}
