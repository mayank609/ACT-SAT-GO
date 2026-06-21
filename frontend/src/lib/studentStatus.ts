// Student enrollment status, derived from the post-diagnostic decision.
//   diagnosticDecision === 'keep'  → Active   (kept after diagnostic)
//   diagnosticDecision === 'leave' → Inactive (not kept, or left mid-sem / after tenure)
//   null / undefined               → Pending  (diagnostic decision not made yet)
export type StudentStatus = 'active' | 'inactive' | 'pending';

export function studentStatusFromDecision(decision?: 'keep' | 'leave' | null): StudentStatus {
  return decision === 'keep' ? 'active' : decision === 'leave' ? 'inactive' : 'pending';
}

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
};

// Tailwind classes for a small status pill/badge.
export const STUDENT_STATUS_BADGE: Record<StudentStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  inactive: 'bg-rose-100 text-rose-700 border border-rose-200',
  pending: 'bg-amber-100 text-amber-700 border border-amber-200',
};
