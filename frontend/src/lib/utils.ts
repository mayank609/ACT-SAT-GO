/**
 * Converts a `<input type="datetime-local">` value (a timezone-less string like
 * "2026-08-10T23:59") into a proper ISO 8601 UTC timestamp. `new Date(value)`
 * on a naive string like this is parsed in whatever timezone the code runs in —
 * in the browser that's correctly the admin's own local timezone, but if the raw
 * string were sent to the server as-is, the server would re-parse it in *its*
 * timezone instead, silently shifting the deadline by the gap between the two.
 * Resolving it to an unambiguous UTC instant here, before it leaves the browser,
 * avoids that — the stored deadline then means the same moment everywhere, and
 * each viewer's UI already converts it back to their own local time on display.
 */
export function localDateTimeToISO(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Format seconds into human-readable duration: "45s", "1m 10s", "2h 5m" */
export function fmtSec(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (s < 3600) return r === 0 ? `${m}m` : `${m}m ${r}s`;
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}
