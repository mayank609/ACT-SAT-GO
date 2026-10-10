import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, type TaSection, type TimeAnalyticsResponse } from '../../lib/api';
import { Modal } from '../common/Modal';
import { VisitGridChart, VisitGridLegend } from './VisitGridChart';

/**
 * Time Analysis for a whole attempt: all modules side by side in a 2×2 grid,
 * one compact visit-level pacing chart each, with an expand button per chart.
 *
 * Attempts taken before visit tracking existed have no event data; for those
 * `legacy` (the old per-module tabs) is rendered instead.
 */
export function AttemptTimeAnalyticsGrid({
  attemptId,
  sectionIds,
  legacy,
  onQuestionClick,
}: {
  attemptId: string;
  /** Section ids in display order; sections missing from the response are skipped. */
  sectionIds: string[];
  legacy: React.ReactNode;
  onQuestionClick?: (sectionId: string, questionIndex: number) => void;
}) {
  const [data, setData] = useState<TimeAnalyticsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<TaSection | null>(null);

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
  }, [attemptId]);

  if (!data && !failed) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const byId = new Map((data?.hasEvents ? data.sections : []).map((s) => [s.sectionId, s]));
  const sections = sectionIds.map((id) => byId.get(id)).filter((s): s is TaSection => !!s && s.visits.length > 0);

  if (sections.length === 0) return <>{legacy}</>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <div key={s.sectionId} className="space-y-1">
            <div className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">{s.name}</div>
            <VisitGridChart
              section={s}
              onExpand={() => setExpanded(s)}
              onQuestionClick={onQuestionClick ? (qi) => onQuestionClick(s.sectionId, qi) : undefined}
            />
          </div>
        ))}
      </div>
      <VisitGridLegend />

      <Modal isOpen={!!expanded} onClose={() => setExpanded(null)} title={expanded?.name ?? ''} size="xl">
        {expanded && (
          <div className="space-y-3">
            <VisitGridChart
              section={expanded}
              size="large"
              onQuestionClick={onQuestionClick ? (qi) => { setExpanded(null); onQuestionClick(expanded.sectionId, qi); } : undefined}
            />
            <VisitGridLegend />
            {onQuestionClick && <p className="text-center text-[11px] text-slate-400">Click a bar to open that question.</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
