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
