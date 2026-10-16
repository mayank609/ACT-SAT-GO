import type { ReactNode } from 'react';
import type { ArticleStatus } from '../../lib/api';

// Shared pieces for the articles pages: the plain-text article renderer,
// the status badge and the word counter (matches the server's count).

export const wordCount = (text: string) => (text.trim().match(/\S+/g) ?? []).length;

/**
 * Renders article text safely as React nodes (never as HTML):
 * blank line = new paragraph, "## " / "### " = heading, "- " / "* " = bullet.
 */
export function ArticleBody({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let para: string[] = [];
  let bullets: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(<p key={out.length} className="my-4">{para.join(' ')}</p>);
    para = [];
  };
  const flushBullets = () => {
    if (bullets.length) {
      out.push(<ul key={out.length} className="my-4 list-disc pl-6 space-y-1.5">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>);
    }
    bullets = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (!line) { flushPara(); flushBullets(); }
    else if (heading) {
      flushPara(); flushBullets();
      out.push(heading[1].length === 2
        ? <h2 key={out.length} className="mt-7 mb-2 text-lg font-bold text-slate-900">{heading[2]}</h2>
        : <h3 key={out.length} className="mt-5 mb-1.5 font-bold text-slate-900">{heading[2]}</h3>);
    } else if (bullet) { flushPara(); bullets.push(bullet[1]); }
    else { flushBullets(); para.push(line); }
  }
  flushPara(); flushBullets();
  return <div className="text-[15px] sm:text-base leading-7 text-slate-700 break-words">{out}</div>;
}

const STATUS_STYLE: Record<ArticleStatus, { label: string; cls: string }> = {
  ASSIGNED: { label: 'To read', cls: 'bg-slate-100 text-slate-600' },
  SUBMITTED: { label: 'Waiting for review', cls: 'bg-blue-50 text-blue-700' },
  NEEDS_REVISION: { label: 'Needs changes', cls: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700' },
};

export function StatusBadge({ status, manager }: { status: ArticleStatus; manager?: boolean }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.ASSIGNED;
  const label = manager && status === 'SUBMITTED' ? 'To review' : manager && status === 'ASSIGNED' ? 'Not submitted' : s.label;
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>{label}</span>;
}

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

/** True when the due date has passed and the student hasn't submitted yet. */
export const isOverdue = (dueAt: string | null, status: ArticleStatus) =>
  !!dueAt && (status === 'ASSIGNED' || status === 'NEEDS_REVISION') && new Date(dueAt).getTime() < Date.now();
