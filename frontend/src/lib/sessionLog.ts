// Shared constants/helpers for tutor session logs — used by both the tutor's own
// "Log a Session" page and the admin session-log views, so the two never drift
// out of sync on what a session's fields/status values actually mean.

export const SUBJECTS = ['SAT Math', 'SAT Reading', 'SAT Writing', 'ACT Math', 'ACT English', 'ACT Reading', 'ACT Science', 'Other'];
export const STATUSES = ['Completed', 'No Show - Tutor', 'No Show - Student', 'Cancelled'] as const;
export const ENGAGEMENTS = ['High', 'Medium', 'Low'] as const;
export const HW_SUBFILTERS = ['HW', 'English', 'Maths', 'All'] as const;

export const SESSION_TYPES = ['Core Prep', 'Review Session', 'Doubt Session', 'Master Class'] as const;
// Core Prep and Master Class run a full 60-minute session; Review and Doubt
// sessions default to a shorter 30-minute slot. Tutors can still edit the
// duration field afterward — this only sets the default on type change.
export const SESSION_TYPE_DEFAULT_DURATION: Record<(typeof SESSION_TYPES)[number], number> = {
  'Core Prep': 60,
  'Review Session': 30,
  'Doubt Session': 30,
  'Master Class': 60,
};

const READING_TOPICS = [
  'Words in Context', 'Traps', 'Main Idea', 'Purpose', 'Fact / Inference',
  'Illustrating Claims', 'Logically Text Completion', 'Command of Evidence',
  'Cross Text Connections', 'Overall Structure',
];
const WRITING_TOPICS = [
  'Subject-Verb Agreement-1', 'Subject-Verb Agreement-2', 'Verb Forms & Tenses', 'Modifiers',
  'Parallel Structures & Faulty Comparisons', 'Pronoun Antecedent', 'Plurals and Possessives',
  'Sentence Structure', 'Linking Clauses', 'Punctuation', 'Supplements', 'Transitions',
  'Rhetorical Synthesis', 'Command of Evidence : Quantitative',
];
const MATH_TOPICS = [
  'Linear Equation', 'Algebra', 'Functions & Polynomial', 'Quadratic Equations', 'Parabola',
  'Percentage, Proportions and Unit Conversions', 'Exponential Functions and Radical Function',
  'Statistics', 'Research Methodology', 'Geometry', 'Trigonometry',
];

// Picks the curated topic checklist for a given Subject dropdown value; subjects
// outside SAT/ACT Math/Reading/Writing-English (e.g. ACT Science, Other) fall
// back to the free-text textarea only.
export function topicsForSubject(subject: string): string[] {
  if (subject.includes('Math')) return MATH_TOPICS;
  if (subject.includes('Reading')) return READING_TOPICS;
  if (subject.includes('Writing') || subject.includes('English')) return WRITING_TOPICS;
  return [];
}

export function statusVariant(status?: string): 'success' | 'danger' | 'default' | 'info' {
  if (status === 'Completed') return 'success';
  // Covers both new ("No Show - Tutor"/"No Show - Student") and legacy ("No Show") values.
  if (status?.startsWith('No Show')) return 'danger';
  if (status === 'Scheduled') return 'info';
  return 'default';
}

export function toLines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

// Session History lists are always shown most-recent-first by the session's actual
// classDate, not by when the row was logged/inserted — a session logged today for a
// missed date last week must still land in its correct date position, not at the top.
export function sortSessionEntries<T extends { classDate: string; createdAt: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) =>
    new Date(b.classDate).getTime() - new Date(a.classDate).getTime() ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export interface DbTest {
  id: string;
  title: string;
  status: string;
  category?: string;
  subCategory?: string;
  sections: unknown[];
}

export const emptySessionForm = {
  studentId: '', classDate: new Date().toISOString().split('T')[0], startTime: '', durationMinutes: '60', actualDurationMinutes: '',
  subject: SUBJECTS[0], status: 'Completed' as string, sessionType: 'Core Prep' as string, topic: '', homeworkTestIds: [] as string[], notes: '',
  understanding: 0, attendance: 'Present', engagement: 'High' as string, nextSessionGoal: '', nextSessionAt: '',
};
