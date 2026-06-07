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
    { name: 'Information and Ideas', pct: 26, range: '12 - 14', subs: ['Main Idea', 'Fact-based / Inference', 'Critical Reasoning', 'Illustrate the Claim', 'Logical Completion'] },
    { name: 'Craft and Structure', pct: 28, range: '13 - 15', subs: ['Cross-text Connections', 'Words in Context', 'Overall Structure', 'Function / Purpose'] },
    { name: 'Expression of Ideas', pct: 20, range: '8 - 12', subs: ['Transitions', 'Rhetorical Synthesis'] },
    { name: 'Standard English Conventions', pct: 26, range: '11 - 15', subs: ['Form Structure and Sense', 'Boundaries'] },
  ],
  'Math': [
    { name: 'Algebra', pct: 35, range: '13 - 15', subs: ['Linear Equations in one or two variables', 'Linear Inequalities'] },
    { name: 'Advanced Math', pct: 35, range: '13 - 15', subs: ['Exponent Rules', 'Basic Function Questions', 'Radical Equations', 'Polynomial', 'Exponential Functions', 'Absolute Value Equations & Inequalities', 'Parabolas', 'Quadratic Equations'] },
    { name: 'Problem-Solving and Data Analysis', pct: 15, range: '5 - 7', subs: ['Research Studies', 'Statistics', 'Ratio, Rates and Percentages'] },
    { name: 'Geometry', pct: 15, range: '5 - 7', subs: ['Lines and Angles', 'Areas and Volumes', 'Triangles', 'Circles', 'Polygons'] },
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

/** Subdomain name → its list of key Skills. */
export const SKILLS_BY_SUBDOMAIN: Record<string, string[]> = {
  // Reading & Writing - Information and Ideas
  'Main Idea': [],
  'Fact-based / Inference': [],
  'Critical Reasoning': [],
  'Illustrate the Claim': [],
  'Logical Completion': [],

  // Reading & Writing - Craft and Structure
  'Cross-text Connections': [],
  'Words in Context': [],
  'Overall Structure': [],
  'Function / Purpose': [],

  // Reading & Writing - Expression of Ideas
  'Transitions': [],
  'Rhetorical Synthesis': [],

  // Reading & Writing - Standard English Conventions
  'Form Structure and Sense': ['Modifiers', 'Plurals and Possessives', 'Sentence Structure', 'Pronoun Antecedent', 'Parallelism and Faulty Comparison', 'Verb Agreement and Forms'],
  'Boundaries': ['Linking Clauses', 'Supplements', 'Punctuation'],

  // Math - Algebra
  'Linear Equations in one or two variables': [
    'Identification of Linear Equations for word problems',
    'Interpreting slope / y-intercept of linear function',
    'Identification of linear equation using graphs',
    'Calculating equation of straight lines using slope/points',
    'Finding linear function using x,f(x)',
    'Conditions of solvability for slope intercept form',
    'Solving simultaneous linear equations in two variables',
    'Conditions of solvability for general form',
    'Solving linear equation in one variable'
  ],
  'Linear Inequalities': [
    'Solving linear inequality in one variable',
    'Solving linear inequality in two variables',
    'Absolute value functions (equations/inequalities)'
  ],

  // Math - Advanced Math
  'Exponent Rules': [
    'Simplification of expressions using exponent rules'
  ],
  'Basic Function Questions': [
    'Function graph interpretation',
    'Comparison of two functions',
    'Function evaluation at a given point'
  ],
  'Radical Equations': [
    'Solving radical equations'
  ],
  'Polynomial': [
    'Equivalent expression / simplification based questions',
    'Identifying functions using graphs (Factor theorem)'
  ],
  'Exponential Functions': [
    'Solving exponential equations',
    'Identifying y-intercept of exponential functions',
    'Linear vs exponential function comparison',
    'Compound interest problems',
    'Identifying exponential function from graph',
    'Identifying exponential function from word problem',
    'Interpreting y-intercept / rate of exponential function'
  ],
  'Absolute Value Equations & Inequalities': [
    'Framing / solving of absolute value equations & inequalities',
    'Absolute value equations inequalities'
  ],
  'Parabolas': [
    'Identifying x/y intercept of parabola',
    'Identifying x/y coordinate of vertex of parabola',
    'Converting one form to another for parabolas',
    'Word problems on parabolas',
    'Identification of equations using graphs'
  ],
  'Quadratic Equations': [
    'Sum and product of roots (cubic)',
    'Sum and product of roots (quadratic)',
    'Solving system of one linear and one quadratic equation',
    'Solving quadratic equations',
    'Using discriminant of a quadratic equation (no. of x intercepts)',
    'Frame quadratic equation and solve'
  ],

  // Math - Geometry
  'Lines and Angles': [
    'Basic properties'
  ],
  'Areas and Volumes': [
    'Calculating areas',
    'Calculating volumes',
    'Calculating dimensions of geometric figures'
  ],
  'Triangles': [
    'Properties of triangles',
    'Trigonometry',
    'Special triangles',
    'Similarity in triangles'
  ],
  'Circles': [
    'Arc length / area of sector calculations',
    'Circle properties',
    'Translations on circles',
    'Circle equations',
    'Unit circle / circle trigonometry'
  ],
  'Polygons': [
    'Angle sum properties',
    'Length and areas'
  ],

  // Math - Problem Solving and Data Analysis
  'Research Studies': [
    'Confidence interval / margin of error inference',
    'Cause and effect questions',
    'Generalisation questions'
  ],
  'Statistics': [
    'Two way probability table',
    'Effects on numerical values (outliers / removal of values etc)',
    'Table based data interpretation',
    'Graph based data interpretation (Pie charts, bar graphs)',
    'Scatterplot based questions (line of best fit)',
    'Data based calculation questions (mean/median/std etc)'
  ],
  'Ratio, Rates and Percentages': [
    'Questions on time, distance and speed',
    'Percentage based questions',
    'Unit change questions (other than areas and volumes)',
    'Area/volume questions based on ratios / unit change',
    'Calculating multipliers for percentage increase/decrease'
  ]
};

