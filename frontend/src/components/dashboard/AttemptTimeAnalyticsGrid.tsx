import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Loader2, Zap } from 'lucide-react';
import { fmtSec } from '../../lib/utils';
import { api, type TimeAnalyticsResponse } from '../../lib/api';
import { RUSHED_THRESHOLD, SLOW_THRESHOLD, type QuestionTimeStat } from './QuestionTimeChart';
import { VisitGridCard, VisitGridModal, gridFromTotals, gridFromVisits, type GridSection } from './VisitGridChart';

export interface TimeGridModule {
  sectionId: string;
  /** Shown above the module's chart, e.g. "Section 1, Module 1: Reading and Writing". */
  title: string;
  /** Per-question totals, used when the attempt has no visit data. */
  stats: QuestionTimeStat[];
}

/**
 * "View Time Analytics" (Zuperscore layout): every module of the attempt at
 * once in a 2×2 grid, one visit chart each, with an expand icon per chart.
 *
 * Modules with recorded visits draw one bar per visit. Modules without them
 * (attempts from before visit tracking, or when the request fails) draw one
 * bar per question from the stored per-question time, so the view always shows.
 */
export function AttemptTimeAnalyticsGrid({
  attemptId,
  modules,
  onQuestionClick,
}: {
  attemptId: string;
  modules: TimeGridModule[];
  onQuestionClick?: (sectionId: string, questionIndex: number) => void;
}) {
  const [data, setData] = useState<TimeAnalyticsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    api.getTimeAnalytics(attemptId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: Error & { status?: number }) => {
        if (cancelled) return;
        console.error('[TimeAnalytics] failed to load visit-level timing:', e.status, e.message);
        setFailed(true);
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

  const byId = new Map((data?.hasEvents ? data.sections : []).map((s) => [s.sectionId, s]));
  let usedTotals = false;
  const sections: GridSection[] = modules.map((m) => {
    const s = byId.get(m.sectionId);
    if (s && s.visits.length > 0) return gridFromVisits(s, m.title);
    usedTotals = true;
    return gridFromTotals(m.sectionId, m.title, m.stats);
  });
  const expanded = sections.find((s) => s.sectionId === expandedId) ?? null;

  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sections.map((s) => (
          <div key={s.sectionId} className="space-y-1.5">
            <div className="px-1 text-xs font-semibold text-slate-600">{s.title}</div>
            <PacingCounts section={s} />
            <VisitGridCard
              section={s}
              onExpand={() => setExpandedId(s.sectionId)}
              onQuestionClick={onQuestionClick ? (qi) => onQuestionClick(s.sectionId, qi) : undefined}
            />
          </div>
        ))}
      </div>

      {failed ? (
        <p className="text-xs text-slate-500">
          Visit-level timing could not be loaded, so each question shows as one bar.{' '}
          <button type="button" className="font-semibold text-blue-600 hover:underline" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </button>
        </p>
      ) : usedTotals ? (
        <p className="text-xs text-slate-500">Revisits were not recorded for this test, so each question shows as one bar.</p>
      ) : null}

      {expanded && (
        <VisitGridModal
          section={expanded}
          onClose={() => setExpandedId(null)}
          onQuestionClick={onQuestionClick ? (qi) => { setExpandedId(null); onQuestionClick(expanded.sectionId, qi); } : undefined}
        />
      )}
    </div>
  );
}

/** ASG's pacing counts for one module, kept above its chart: average time per question, slow and rushed questions. */
function PacingCounts({ section }: { section: GridSection }) {
  const n = section.rowSeconds.length;
  if (n === 0) return null;
  const avg = Math.round(section.rowSeconds.reduce((a, t) => a + t, 0) / n);
  const slow = section.rowSeconds.filter((t) => t >= SLOW_THRESHOLD).length;
  const rushed = section.rowSeconds.filter((t, i) => t < RUSHED_THRESHOLD && section.rowAnswered[i]).length;
  return (
    <div className="flex flex-wrap gap-2 px-1">
      <span className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-500">
        <Clock size={12} className="text-gray-400" />
        <b className="text-gray-900">{fmtSec(avg)}</b> avg / question
      </span>
      <span className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50/50 px-2.5 py-1 text-[11px] text-red-500">
        <AlertTriangle size={12} className="text-red-600" />
        <b className="text-red-600">{slow}</b> slow &ge; {fmtSec(SLOW_THRESHOLD)}
      </span>
      <span className="flex items-center gap-1.5 rounded-lg border border-amber-100 bg-amber-50/50 px-2.5 py-1 text-[11px] text-amber-500">
        <Zap size={12} className="text-amber-600" />
        <b className="text-amber-600">{rushed}</b> rushed &lt; {fmtSec(RUSHED_THRESHOLD)}
      </span>
    </div>
  );
}
