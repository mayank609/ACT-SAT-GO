import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Shows `label` immediately above its child on hover. Rendered in a portal so
 * scrolling lists can't clip it.
 */
export function HoverLabel({ label, children }: { label: string; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  return (
    <span
      className="inline-flex"
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: r.top });
      }}
      onMouseLeave={() => setPos(null)}
      onMouseDown={() => setPos(null)}
    >
      {children}
      {pos && createPortal(
        <span
          className="pointer-events-none fixed z-[1000] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-white shadow"
          style={{ left: pos.x, top: pos.y - 4 }}
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  );
}
