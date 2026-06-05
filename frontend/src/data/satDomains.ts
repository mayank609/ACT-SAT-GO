// ─── SAT content blueprint: the single source of truth ───────────────────────
// Domains → subdomains exactly as published by College Board. Both the admin
// Test Builder (for tagging questions) and the student Test Review page (for
// scoring performance per domain/subdomain) import from here, so the names an
// admin tags are the exact names the review page matches against.

export interface SatDomain {
  /** Canonical domain name (one of the 8 SAT content domains). */
  name: string;
  /** Approx. share of its test section. */
  pct: number;
  /** Approx. question-count range on a real test. */
  range: string;
  /** Ordered subdomains belonging to this domain. */
  subs: string[];
}

/** Domains grouped by the two SAT sections. */
export const SAT_CONTENT: Record<'Reading and Writing' | 'Math', SatDomain[]> = {
  'Reading and Writing': [
    { name: 'Information and Ideas', pct: 26, range: '12 - 14', subs: ['Command of Evidence', 'Inferences', 'Central Ideas and Details'] },
    { name: 'Craft and Structure', pct: 28, range: '13 - 15', subs: ['Words in Context', 'Text Structure and Purpose', 'Cross-Text Connections'] },
    { name: 'Expression of Ideas', pct: 20, range: '8 - 12', subs: ['Rhetorical Synthesis', 'Transitions'] },
    { name: 'Standard English Conventions', pct: 26, range: '11 - 15', subs: ['Boundaries', 'Form, Structure, and Sense'] },
  ],
  'Math': [
    { name: 'Algebra', pct: 35, range: '13 - 15', subs: ['Linear equations in one variable', 'Linear functions', 'Linear equations in two variables', 'Systems of two linear equations in two variables', 'Linear inequalities in one or two variables'] },
    { name: 'Advanced Math', pct: 35, range: '13 - 15', subs: ['Nonlinear functions', 'Nonlinear equations in one variable', 'Systems of equations in two variables', 'Equivalent expressions'] },
    { name: 'Problem-Solving and Data Analysis', pct: 15, range: '5 - 7', subs: ['Ratios, rates, proportional relationships, and units', 'Percentages', 'One-variable data: Distributions and measures of center and spread', 'Two-variable data: Models and scatterplots', 'Probability and conditional probability', 'Inference from sample statistics and margin of error', 'Evaluating statistical claims: Observational studies and experiments'] },
    { name: 'Geometry and Trigonometry', pct: 15, range: '5 - 7', subs: ['Area and volume', 'Lines, angles, and triangles', 'Right triangles and trigonometry', 'Circles'] },
  ],
};

/** Flat list of all 8 domain names. */
export const ALL_DOMAIN_NAMES: string[] = Object.values(SAT_CONTENT).flat().map((d) => d.name);

/** Flat list of every subdomain name. */
export const ALL_SUBDOMAIN_NAMES: string[] = Object.values(SAT_CONTENT).flat().flatMap((d) => d.subs);

/** Domain name → its ordered subdomain list. */
export const SUBDOMAINS_BY_DOMAIN: Record<string, string[]> = Object.fromEntries(
  Object.values(SAT_CONTENT).flat().map((d) => [d.name, d.subs])
);
