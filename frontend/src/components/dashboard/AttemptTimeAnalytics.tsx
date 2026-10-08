import { useEffect, useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import { api, type TimeAnalyticsResponse } from '../../lib/api';
import { VisitTimelineChart, NoVisitData } from './VisitTimelineChart';

/**
 * Time Analytics for one module of an attempt. Shows the visit-level timeline
 * when the attempt has event data; attempts taken before event tracking existed
 * fall back to the old per-question chart (`legacy`), clearly labelled, rather
 * than faking visits.
 */
export function AttemptTimeAnalytics({
  attemptId,
  sectionId,
  legacy,
  onQuestionClick,
}: {
  attemptId: string;
  sectionId: string;
  legacy: React.ReactNode;
  onQuestionClick?: (questionIndex: number) => void;
}) {
  const [data, setData] = useState<TimeAnalyticsResponse | null>(null);
  const [failed, setFailed] = useState<{ status?: number; message: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(null);
    api.getTimeAnalytics(attemptId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: Error & { status?: number }) => {
        if (cancelled) return;
        console.error('[TimeAnalytics] failed to load visit-level timing:', e.status, e.message);
        setFailed({ status: e.status, message: e.message });
      });
    return () => { cancelled = true; };
  }, [attemptId, reloadKey]);

  if (!data && !failed) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const section = data?.hasEvents ? data.sections.find((s) => s.sectionId === sectionId) : undefined;
  if (!section) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <span>
            {failed
              ? <>Visit-level timing could not be loaded ({failureReason(failed)}), so this shows total time per question.</>
              : 'Legacy data — revisits were not recorded for this attempt, so this shows total time per question in question order.'}
          </span>
          {failed && (
            <button type="button" className="ml-auto shrink-0 font-semibold text-blue-600 hover:underline" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </button>
          )}
        </div>
        {legacy}
      </div>
    );
  }
  if (section.visits.length === 0) return <NoVisitData />;
  return <VisitTimelineChart section={section} onQuestionClick={onQuestionClick} />;
}

function failureReason(f: { status?: number; message: string }): string {
  if (!f.status) return 'could not reach the server';
  if (f.status === 404) {
    return /attempt not found/i.test(f.message)
      ? 'this attempt was not found'
      : 'HTTP 404 — the server does not have the Time Analytics endpoint yet; the backend needs redeploying';
  }
  if (f.status === 401 || f.status === 403) return `HTTP ${f.status} — not allowed to view this attempt`;
  return `HTTP ${f.status}${f.message ? ` — ${f.message}` : ''}`;
}
