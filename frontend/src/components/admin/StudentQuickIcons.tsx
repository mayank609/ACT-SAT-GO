import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Eye, Info } from 'lucide-react';
import type { DbUser } from '../../lib/api';

/**
 * The two small icons in the student list's Name column (admin and tutor), like
 * Zuperscore: ⓘ shows the student's details on hover or tap, and 👁 opens their
 * reports in the Test Report tab.
 */
export function StudentQuickIcons({ studentId, name, email, student }: {
  studentId: string;
  name: string;
  email: string;
  student?: DbUser;
}) {
  const navigate = useNavigate();
  const infoRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const open = () => {
    const r = infoRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 260;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left - 12, window.innerWidth - width - 8)) });
  };

  const rows: [string, string | number | null | undefined][] = [
    ['Email', email],
    ['Phone', student?.phone],
    ['Parent phone', student?.parentPhone],
    ['School', student?.schoolName],
    ['Grade', student?.grade],
    ['Target score', student?.targetScore],
    ['Tutors', student?.tutors?.map((t) => t.name).join(', ') || student?.tutorName],
  ];

  const btn = 'p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors';

  return (
    <span className="inline-flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        ref={infoRef}
        type="button"
        className={btn}
        aria-label={`Details for ${name}`}
        onMouseEnter={open}
        onMouseLeave={() => setPos(null)}
        onClick={() => (pos ? setPos(null) : open())}
      >
        <Info size={15} />
      </button>
      <button type="button" className={btn} title="View test reports" onClick={() => navigate(`/test-report?student=${studentId}`)}>
        <Eye size={15} />
      </button>

      {pos && createPortal(
        <div
          className="fixed z-[100] w-[260px] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <p className="mb-2 text-sm font-semibold text-slate-900">{name}</p>
          <dl className="space-y-1 text-xs">
            {rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-24 flex-shrink-0 text-slate-500">{k}</dt>
                <dd className="min-w-0 break-words font-medium text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        </div>,
        document.body,
      )}
    </span>
  );
}


/**
 * Wraps a student's name in the student list. Hovering it fades in a small card
 * beside the Name column (never over the names) with the target test month and
 * diagnostic scores.
 */
export function StudentNameHover({ name, targetDate, scores, children }: {
  name: string;
  targetDate: string | null;
  scores: { label: string; value: ReactNode }[];
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const open = () => {
    const el = ref.current;
    if (!el) return;
    const cell = (el.closest('td') ?? el).getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const width = 220;
    const left = Math.min(cell.right + 8, window.innerWidth - width - 8);
    setPos({ top: Math.max(8, Math.min(r.top + r.height / 2 - 60, window.innerHeight - 140)), left });
  };

  const month = (() => {
    if (!targetDate) return null;
    const d = new Date(targetDate.includes('T') ? targetDate : targetDate.replace(/-/g, '/'));
    return isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  })();

  return (
    <span ref={ref} className="min-w-0" onMouseEnter={open} onMouseLeave={() => setPos(null)}>
      {children}
      {pos && createPortal(
        <div
          className="asg-fade-in pointer-events-none fixed z-[100] w-[220px] rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <p className="text-sm font-semibold text-slate-900">{name}</p>
          <p className="mt-0.5 text-xs text-slate-500">Target Date: <span className="font-medium text-slate-800">{month ?? 'Not set'}</span></p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Diagnostic score</p>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {scores.map((sc) => (
              <div key={sc.label} className="rounded-lg bg-blue-50 px-1.5 py-1 text-center">
                <div className="text-[10px] text-blue-700">{sc.label}</div>
                <div className="text-sm font-bold text-blue-950">{sc.value}</div>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
