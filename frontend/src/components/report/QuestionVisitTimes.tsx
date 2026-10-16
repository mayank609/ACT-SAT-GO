import { useEffect, useState } from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import { fmtMmSs } from '../../lib/utils';
import { api, type TimeAnalyticsResponse, type TaResult, type TaVisit } from '../../lib/api';

/**
 * Per-question time analysis for the Question Wise Report: total time plus the
 * time of each visit (1st attempt, 2nd attempt, …), coloured like the Time
 * Analytics bars (green correct, red incorrect, indigo unanswered) by the
 * answer the student left at the end of that visit. Uses the same cached
 * time-analytics response as the charts, so opening questions adds no requests.
 * Attempts taken before visit tracking existed show the total time only.
 * Shown in the top-right of each question's header.
 */

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const fmt = (ms: number) => fmtMmSs(ms / 1000);

const RESULT_STYLE: Record<TaResult, { dot: string; label: string }> = {
  correct: { dot: 'bg-emerald-500', label: 'answer correct' },
  incorrect: { dot: 'bg-red-500', label: 'answer incorrect' },
  unanswered: { dot: 'bg-indigo-500', label: 'no answer' },
};

// One fetch per attempt, shared by every question on the page.
const cache = new Map<string, Promise<TimeAnalyticsResponse | null>>();
function load(attemptId: string) {
  let p = cache.get(attemptId);
  if (!p) {
    p = api.getTimeAnalytics(attemptId).catch(() => null);
    cache.set(attemptId, p);
    p.then((r) => { if (!r) cache.delete(attemptId); });
  }
  return p;
}

export function QuestionVisitTimes({ attemptId, questionId, fallbackSeconds }: {
  attemptId: string;
  questionId: string;
  /** Saved total time for the question, used when visits were not recorded. */
  fallbackSeconds: number;
}) {
  const [data, setData] = useState<TimeAnalyticsResponse | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    load(attemptId).then((r) => { if (!cancelled) setData(r); });
    return () => { cancelled = true; };
  }, [attemptId]);

  const visits: TaVisit[] = data?.hasEvents
    ? data.sections.flatMap((s) => s.visits.filter((v) => v.questionId === questionId)).sort((a, b) => a.visitNo - b.visitNo)
    : [];
  const totalMs = visits.length > 0 ? visits.reduce((sum, v) => sum + v.activeMs, 0) : fallbackSeconds * 1000;
  const [open, setOpen] = useState(false);
  // A new question starts collapsed.
  useEffect(() => { setOpen(false); }, [questionId]);

  // "Time Taken" pill for the top-right of the question header. Clicking it
  // slides open one chip per visit (1st attempt, 2nd attempt, …) in MM:SS.
  return (
    <span className="inline-flex items-center justify-end gap-1.5 text-xs">
      <span
        className={`inline-flex items-center gap-1.5 overflow-hidden transition-all duration-300 ease-out ${
          open ? 'max-w-[640px] opacity-100' : 'max-w-0 opacity-0'
        }`}
        aria-hidden={!open}
      >
        {visits.length > 0 ? visits.map((v) => {
          const style = RESULT_STYLE[v.exitResult] ?? RESULT_STYLE.unanswered;
          return (
            <span
              key={v.visitNo}
              title={`${ordinal(v.visitNo)} attempt: ${fmt(v.activeMs)}, ${style.label} when leaving`}
              className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-1.5 py-0.5"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
              <span className="text-slate-500">{ordinal(v.visitNo)} attempt</span>
              <span className="font-semibold text-slate-800 tabular-nums">{fmt(v.activeMs)}</span>
            </span>
          );
        }) : (
          <span className="whitespace-nowrap text-slate-400">
            {data === undefined ? 'Loading…' : 'Attempt times not recorded for this test'}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={open ? 'Hide time for each attempt' : 'Show time for each attempt'}
        className={`inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 font-semibold tabular-nums transition-colors ${
          open ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700'
        }`}
      >
        <Clock size={11} /> Time Taken {fmt(totalMs)}
        <ChevronRight size={12} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
    </span>
  );
}
