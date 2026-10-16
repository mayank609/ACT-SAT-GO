import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../lib/api';

/**
 * Keeps a fixed popup fully on screen: after it renders, measures its height
 * and, when it would run past the bottom of the window, moves it up (above the
 * row for 'below' popups, or shifted up for 'beside' ones).
 */
function useOnScreenTop(popupRef: RefObject<HTMLDivElement | null>, anchor: DOMRect | null, mode: 'below' | 'beside') {
  const [top, setTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!anchor) { setTop(null); return; }
    const h = popupRef.current?.offsetHeight ?? 0;
    const maxTop = window.innerHeight - h - 8;
    if (mode === 'below') {
      const below = anchor.bottom + 6;
      setTop(below <= maxTop ? below : Math.max(8, anchor.top - h - 6));
    } else {
      setTop(Math.max(8, Math.min(anchor.top + anchor.height / 2 - h / 2, maxTop)));
    }
  }, [anchor, mode, popupRef]);
  return top;
}

/** Session-log and assignment counts, fetched once per student on first hover. */
type HoverStats = { pending: number; noShows: number; reschedules: number };
const statsCache = new Map<string, Promise<HoverStats>>();

function loadStats(studentId: string, tutorIds: string[]): Promise<HoverStats> {
  const key = `${studentId}:${tutorIds.join(',')}`;
  let p = statsCache.get(key);
  if (!p) {
    p = Promise.all([
      api.getAssignedTests(studentId).then((r) => (r.assignedTests as { status?: string }[]) ?? []).catch(() => []),
      Promise.all(tutorIds.map((t) => api.getClassProgress(t, studentId).then((r) => r.entries).catch(() => []))),
    ]).then(([assigned, logs]) => {
      const entries = logs.flat();
      return {
        pending: assigned.filter((a) => a.status !== 'Completed').length,
        // A student no-show (the tutor not turning up isn't the student's).
        noShows: entries.filter((e) => e.status === 'No Show - Student' || e.status === 'No Show').length,
        reschedules: entries.filter((e) => e.status === 'Rescheduled').length,
      };
    });
    statsCache.set(key, p);
  }
  return p;
}

/**
 * Wraps a student's name in the student list (admin and tutor). Hovering it
 * fades in a small card beside the Name column (never over the names) with the
 * student's time zone, pending assignments, average mock score, and the
 * no-shows and reschedules logged in the Session Log.
 */
export function StudentNameHover({ studentId, name, timezone, avgMockScore, tutorIds, children }: {
  studentId: string;
  name: string;
  timezone: string | null | undefined;
  avgMockScore: number | null;
  tutorIds: string[];
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ rect: DOMRect; left: number } | null>(null);
  const [stats, setStats] = useState<HoverStats | null>(null);
  const top = useOnScreenTop(popupRef, anchor?.rect ?? null, 'beside');
  const pos = anchor ? { top: top ?? anchor.rect.top, left: anchor.left } : null;

  const open = () => {
    const el = ref.current;
    if (!el) return;
    const cell = (el.closest('td') ?? el).getBoundingClientRect();
    setAnchor({ rect: el.getBoundingClientRect(), left: Math.min(cell.right + 8, window.innerWidth - 240 - 8) });
    if (!stats) loadStats(studentId, tutorIds).then(setStats).catch(() => {});
  };

  const rows: [string, ReactNode][] = [
    ['Time zone', timezone || 'Not set'],
    ['Pending assignments', stats ? stats.pending : '…'],
    ['Average mock score', avgMockScore ?? '—'],
    ['No shows', stats ? stats.noShows : '…'],
    ['Reschedules', stats ? stats.reschedules : '…'],
  ];

  return (
    <span ref={ref} className="min-w-0" onMouseEnter={open} onMouseLeave={() => setAnchor(null)}>
      {children}
      {pos && createPortal(
        <div
          ref={popupRef}
          className="asg-fade-in pointer-events-none fixed z-[100] w-[240px] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <p className="mb-2 text-sm font-semibold text-slate-900">{name}</p>
          <dl className="space-y-1 text-xs">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-semibold text-slate-800 text-right break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </div>,
        document.body,
      )}
    </span>
  );
}
