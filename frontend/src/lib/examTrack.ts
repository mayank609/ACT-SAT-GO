import { useEffect, useState } from 'react';
import { api, type DbUser } from './api';

// A student's exam track: SAT, ACT, or a custom exam (IELTS, school exams, AP…).
// Custom-exam tests use Test.category "Custom" with the exam name as
// subCategory, and are scored on raw marks. Mirrors platform/src/lib/examTrack.ts.

export type Track = 'SAT' | 'ACT' | 'CUSTOM';
export const TRACK_OPTIONS: Array<{ value: Track; label: string }> = [
  { value: 'SAT', label: 'SAT' },
  { value: 'ACT', label: 'ACT' },
  { value: 'CUSTOM', label: 'Custom exam' },
];

export const isCustomStudent = (u: { track?: string | null } | null | undefined) => u?.track === 'CUSTOM';

/** What the student is preparing for, e.g. "SAT" or "IELTS". Students with no track default to SAT. */
export const examLabel = (u: { track?: string | null; customExam?: string | null } | null | undefined): string =>
  u?.track === 'CUSTOM' ? (u.customExam || 'Custom exam') : u?.track === 'ACT' ? 'ACT' : 'SAT';

/** Target-score input hints per track (custom targets are a percentage). */
export const targetScoreHint = (track: string | null | undefined) =>
  track === 'CUSTOM' ? { min: 1, max: 100, placeholder: 'e.g. 85 (%)', label: 'Target Score (%)' }
    : track === 'ACT' ? { min: 1, max: 36, placeholder: 'e.g. 32', label: 'Target ACT Score' }
    : track === 'SAT' ? { min: 400, max: 1600, placeholder: 'e.g. 1450', label: 'Target SAT Score' }
    : { min: 1, max: 1600, placeholder: 'e.g. 1400', label: 'Target Score' };

/** Custom exam names already in use (students' exams + custom tests), for suggestions. */
export function useCustomExamNames(): string[] {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.all([
      api.getUsersByRole('STUDENT').then((r) => (r.users ?? []).map((u: DbUser) => u.customExam)).catch(() => []),
      api.getAllTests({ category: 'Custom' }).then((r) => (r.tests as Array<{ subCategory?: string | null }>).map((t) => t.subCategory)).catch(() => []),
    ]).then(([a, b]) => {
      if (!alive) return;
      const set = new Set<string>();
      for (const n of [...a, ...b]) if (typeof n === 'string' && n.trim()) set.add(n.trim());
      setNames([...set].sort((x, y) => x.localeCompare(y)));
    });
    return () => { alive = false; };
  }, []);
  return names;
}

type TestLike = { category?: string | null; subCategory?: string | null };
const sameExam = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Assign dialogs open on the "Custom" tab for custom-exam students (when such tests exist). */
export function defaultAssignFilter(student: { track?: string | null } | null | undefined, tests: TestLike[]): string {
  return isCustomStudent(student) && tests.some((t) => (t.category ?? '').toLowerCase() === 'custom') ? 'Custom' : 'All';
}

/** Puts tests for the student's own custom exam first (stable otherwise). */
export function examTestsFirst<T extends TestLike>(tests: T[], student: { track?: string | null; customExam?: string | null } | null | undefined): T[] {
  if (!isCustomStudent(student)) return tests;
  const mine = (t: T) => (t.category ?? '').toLowerCase() === 'custom' && sameExam(t.subCategory, student?.customExam);
  return [...tests.filter(mine), ...tests.filter((t) => !mine(t))];
}
