// Data model for the dedicated program landing pages (ACT, SAT, AP).
// Each page is rendered by the shared <ProgramPage> component from one of
// these objects, so all three stay visually and structurally consistent.

export interface ProgramTier {
  name: string;
  tag?: string;
  icon: string;
  weeks: string;
  features: string[];
  price: string;
  oldPrice?: string;
  accent: string;
  featured?: boolean;
}

export interface Step {
  n: string;
  title: string;
  text: string;
}

export interface CurriculumArea {
  title: string;
  points: string[];
  accent: string;
}

export interface Highlight {
  value: string;
  label: string;
}

export interface CompareRow {
  feature: string;
  values: string[];
}

export interface ChooseItem {
  prompt: string;
  choose: string;
  accent: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface ProgramPageData {
  slug: string;
  exam: string;
  heroEyebrow: string;
  /** Hero headline split into plain/highlighted runs. */
  heroTitle: { text: string; gold?: boolean }[];
  heroText: string;
  heroBullets: { title: string; text: string }[];
  primaryCta: string;
  secondaryCta: string;
  highlightsHeading: string;
  highlights: Highlight[];
  tiersEyebrow: string;
  tiersHeading: string;
  tiersText: string;
  tiers: ProgramTier[];
  stepsHeading: string;
  steps: Step[];
  curriculumHeading: string;
  curriculum: CurriculumArea[];
  compareHeading: string;
  compareCols: string[];
  compareRows: CompareRow[];
  chooseHeading: string;
  chooseItems: ChooseItem[];
  stats: Stat[];
}

const SHARED_STATS: Stat[] = [
  { value: '90+', label: 'Top Scores Achieved' },
  { value: '10K+', label: 'Students Trained' },
  { value: '4.8/5', label: 'Student Rating' },
  { value: '98%', label: 'Recommend Us' },
];

export const ACT_PAGE: ProgramPageData = {
  slug: 'act',
  exam: 'ACT',
  heroEyebrow: 'ACT® Preparation',
  heroTitle: [
    { text: 'Ace the ' },
    { text: 'ACT.', gold: true },
    { text: '\nUnlock Your ' },
    { text: 'Future.', gold: true },
  ],
  heroText:
    'Expert-led programs, proven strategies, and personalized support to help you achieve your target ACT score and get into your dream universities.',
  heroBullets: [
    { title: 'Proven Strategies', text: 'Score Higher' },
    { title: 'Expert Mentors', text: '1-on-1 Support' },
    { title: 'Data-Driven', text: 'Progress Tracking' },
    { title: 'Doubt Solving', text: 'Whenever You Need' },
  ],
  primaryCta: 'Explore ACT Programs',
  secondaryCta: 'Download ACT Guide',
  highlightsHeading: 'Why Prep With ACT SAT GO?',
  highlights: [
    { value: '36', label: 'Target a Perfect Composite' },
    { value: '12+', label: 'Full-Length ACT Mocks' },
    { value: '1:1', label: 'Personal Mentor Support' },
    { value: '100%', label: 'Section-Wise Coverage' },
  ],
  tiersEyebrow: 'Choose Your Perfect ACT Program',
  tiersHeading: 'Find the Program That Fits Your Goals',
  tiersText:
    "Whether you're just starting or looking for a final score boost, we have the perfect path for you.",
  tiers: [
    {
      name: 'ACT Mastery Program',
      icon: '♛',
      weeks: '12 – 16 Weeks',
      accent: '#1c5fa5',
      featured: true,
      price: '$1299',
      oldPrice: '$1699',
      features: [
        'Complete ACT all-section coverage',
        '3 – 4 live classes per week',
        '12+ full-length ACT mocks',
        'Personal mentor & progress reports',
        'Premium study material & drills',
      ],
    },
    {
      name: 'ACT Accelerator Program',
      icon: '⚡',
      weeks: '4 – 6 Weeks',
      accent: '#16a34a',
      price: '$1199',
      oldPrice: '$1599',
      features: [
        'High-impact condensed curriculum',
        '3 – 4 live classes + recordings',
        '8 full-length ACT mocks',
        'Proven strategies & shortcuts',
        'Quick feedback & doubt solving',
      ],
    },
    {
      name: 'ACT Test Series+',
      icon: '▤',
      weeks: '6 – 8 Weeks',
      accent: '#6d28d9',
      price: '$599',
      oldPrice: '$799',
      features: [
        '12 full-length ACT mocks',
        'Advanced performance analytics',
        'Section-wise strengths report',
        'Score predictor & time analysis',
        '1-on-1 consultation (optional)',
      ],
    },
    {
      name: 'ACT Math Program',
      icon: '∑',
      weeks: '6 – 8 Weeks',
      accent: '#f59b00',
      price: '$699',
      oldPrice: '$899',
      features: [
        'Deep dive into ACT Math',
        'Calculator & No-Calculator strategies',
        'Timed drills & practice sets',
        'Math formula handbook',
        'Weekly assessments',
      ],
    },
    {
      name: 'ACT English Program',
      icon: '✎',
      weeks: '6 – 8 Weeks',
      accent: '#dc2626',
      price: '$699',
      oldPrice: '$899',
      features: [
        'English, Reading & Science focus',
        'Grammar & usage mastery',
        'Reading comprehension strategies',
        'Practice passages & drills',
        'Vocabulary booster',
      ],
    },
  ],
  stepsHeading: 'Our ACT Prep Approach',
  steps: [
    { n: '1', title: 'Diagnostic Test', text: 'Evaluate your current level and identify strengths & gaps.' },
    { n: '2', title: 'Personalized Plan', text: 'Get a customized study plan for your target score.' },
    { n: '3', title: 'Live Learning', text: 'Interactive classes with expert ACT instructors.' },
    { n: '4', title: 'Practice & Analyze', text: 'Mock tests, analysis & continuous improvement.' },
    { n: '5', title: 'Score & Succeed', text: 'Refine strategies and achieve your target score.' },
  ],
  curriculumHeading: 'ACT Curriculum Overview',
  curriculum: [
    { title: 'English', accent: '#1c5fa5', points: ['Grammar & Usage', 'Rhetorical Skills', 'Strategy & Timing'] },
    { title: 'Math', accent: '#16a34a', points: ['Algebra', 'Geometry', 'Data & Statistics'] },
    { title: 'Reading', accent: '#6d28d9', points: ['Comprehension', 'Inference', 'Evidence-Based'] },
    { title: 'Science', accent: '#f59b00', points: ['Data Interpretation', 'Research Summaries', 'Conflicting Viewpoints'] },
  ],
  compareHeading: 'Program Comparison',
  compareCols: ['ACT Mastery', 'ACT Accelerator', 'ACT Test Series+', 'ACT Math', 'ACT English'],
  compareRows: [
    { feature: 'Duration', values: ['12 – 16 Weeks', '4 – 6 Weeks', '6 – 8 Weeks', '6 – 8 Weeks', '6 – 8 Weeks'] },
    { feature: 'Live Classes', values: ['3 – 4 / Week', '3 – 4 / Week', '—', '2 – 3 / Week', '2 – 3 / Week'] },
    { feature: 'Full Curriculum', values: ['All Sections', 'Condensed All Sections', '—', 'Math Only', 'English, Reading & Science'] },
    { feature: 'Full-Length Mocks', values: ['12+', '8', '12', 'Topic Tests', 'Topic Tests'] },
    { feature: 'Personal Mentor', values: ['✓', '✓', 'Optional', '✗', '✓'] },
    { feature: 'Performance Analytics', values: ['✓', '✓', '✓', '✓', '✓'] },
    { feature: 'Best For', values: ['Complete Preparation', 'Quick Score Boost', 'Practice & Fine Tune', 'Math Improvement', 'English & Reading Focus'] },
    { feature: 'Fees (USD)', values: ['$1299', '$1199', '$599', '$699', '$699'] },
  ],
  chooseHeading: "Still Not Sure Which Program Fits You?",
  chooseItems: [
    { prompt: "I'm starting my ACT preparation.", choose: 'ACT Mastery Program', accent: '#1c5fa5' },
    { prompt: 'My exam is within 1 month.', choose: 'ACT Accelerator Program', accent: '#16a34a' },
    { prompt: "I've already studied and need practice.", choose: 'ACT Test Series+', accent: '#6d28d9' },
    { prompt: 'I only need help with Math.', choose: 'ACT Math Program', accent: '#f59b00' },
    { prompt: 'I need help with English & Reading.', choose: 'ACT English Program', accent: '#dc2626' },
  ],
  stats: SHARED_STATS,
};

export const SAT_PAGE: ProgramPageData = {
  slug: 'sat',
  exam: 'SAT',
  heroEyebrow: 'Master the SAT. Get Your Best Score.',
  heroTitle: [
    { text: 'SAT', gold: true },
    { text: '\nPreparation' },
  ],
  heroText:
    'Expert-led coaching, proven strategies, and top-quality resources to help you achieve your target SAT score and open doors to your dream universities.',
  heroBullets: [
    { title: 'Proven Strategies', text: 'Score Higher' },
    { title: 'Expert Mentors', text: 'Ivy League Trained' },
    { title: 'Personalized Support', text: 'Every Step of the Way' },
    { title: 'Data Driven', text: 'Progress Tracking' },
  ],
  primaryCta: 'Enroll Now',
  secondaryCta: 'Download Syllabus',
  highlightsHeading: 'Your Gateway to Global Opportunities',
  highlights: [
    { value: '4,000+', label: 'Colleges Accepting SAT' },
    { value: '1600', label: 'Target a Perfect Score' },
    { value: '12+', label: 'Full-Length Mock Tests' },
    { value: 'Flexible', label: 'Test Dates' },
  ],
  tiersEyebrow: 'Our SAT Prep Programs',
  tiersHeading: 'Find the Program That Fits Your Goals',
  tiersText:
    'Comprehensive, high-impact SAT preparation tailored to your timeline and target score.',
  tiers: [
    {
      name: 'SAT Mastery Track',
      tag: 'Flagship Program',
      icon: '♛',
      weeks: '12 – 16 Weeks',
      accent: '#1c5fa5',
      featured: true,
      price: '$1200',
      oldPrice: '$1500',
      features: [
        'Complete Math, Reading & Writing coverage',
        '12+ full-length mock tests',
        'Personal mentor & progress reports',
        '3 – 4 live classes per week',
      ],
    },
    {
      name: 'SAT Accelerator',
      tag: 'FastTrack Program',
      icon: '⚡',
      weeks: '4 – 6 Weeks',
      accent: '#16a34a',
      price: '$1200',
      oldPrice: '$1500',
      features: [
        'Condensed & high-impact curriculum',
        '8 full-length mock tests',
        'Fast-track concept revision',
        '3 – 4 live sessions weekly + recordings',
      ],
    },
    {
      name: 'SAT Test Series+',
      tag: 'Only Mocks Program',
      icon: '▤',
      weeks: '6 – 8 Weeks',
      accent: '#6d28d9',
      price: '$500',
      oldPrice: '$600',
      features: [
        '12 full-length, timed mock tests',
        'Advanced performance analytics',
        'Score predictor & time analysis',
        'Optional 1-on-1 consultation',
      ],
    },
    {
      name: 'SAT Math Pro',
      tag: 'Math Program',
      icon: '∑',
      weeks: '6 – 8 Weeks',
      accent: '#f59b00',
      price: '$700',
      oldPrice: '$850',
      features: [
        'Algebra, Advanced Math, Geometry & Data Analysis',
        'Calculator & No-Calculator strategies',
        'Timed drills, worksheets & mini-tests',
        'Weekly progress assessments',
      ],
    },
    {
      name: 'SAT Verbal Edge',
      tag: 'Verbal Program',
      icon: '✎',
      weeks: '6 – 8 Weeks',
      accent: '#dc2626',
      price: '$700',
      oldPrice: '$850',
      features: [
        'Master critical reading & rhetorical skills',
        'In-depth grammar aligned with SAT',
        'Vocabulary-in-context techniques',
        'Strategies for every question type',
      ],
    },
  ],
  stepsHeading: 'A Proven 5-Step Path to Success',
  steps: [
    { n: '1', title: 'Diagnostic Test', text: 'Evaluate your current level and identify strengths & areas for improvement.' },
    { n: '2', title: 'Personalized Plan', text: 'Get a customized study plan tailored to your target score and timeline.' },
    { n: '3', title: 'Live Learning', text: 'Interactive live classes with expert tutors and concept-based learning.' },
    { n: '4', title: 'Practice & Analyze', text: 'Extensive practice with mock tests and detailed performance analysis.' },
    { n: '5', title: 'Score & Succeed', text: 'Refine strategies, boost confidence, and achieve your target score.' },
  ],
  curriculumHeading: 'SAT Curriculum Overview',
  curriculum: [
    { title: 'Reading', accent: '#1c5fa5', points: ['Command of Evidence', 'Words in Context', 'Expression of Ideas', 'Standard English Conventions'] },
    { title: 'Writing & Language', accent: '#16a34a', points: ['Grammar & Usage', 'Rhetorical Skills', 'Transitions & Coherence', 'Revision & Editing'] },
    { title: 'Math', accent: '#f59b00', points: ['Algebra', 'Advanced Math', 'Problem Solving & Data Analysis', 'Geometry & Trigonometry'] },
  ],
  compareHeading: 'Program Comparison',
  compareCols: ['SAT Mastery', 'SAT Accelerator', 'SAT Test Series+', 'SAT Math Pro', 'SAT Verbal Edge'],
  compareRows: [
    { feature: 'Duration', values: ['12 – 16 Weeks', '4 – 6 Weeks', '6 – 8 Weeks', '6 – 8 Weeks', '6 – 8 Weeks'] },
    { feature: 'Live Classes', values: ['3 – 4 / Week', '3 – 4 / Week', '—', '2 – 3 / Week', '2 – 3 / Week'] },
    { feature: 'Full Curriculum', values: ['All Sections', 'Condensed All Sections', '—', 'Math Only', 'Reading & Writing'] },
    { feature: 'Full-Length Mocks', values: ['12+', '8', '12', 'Topic Tests', 'Topic Tests'] },
    { feature: 'Personal Mentor', values: ['✓', '✓', 'Optional', '✗', '✓'] },
    { feature: 'Performance Analytics', values: ['✓', '✓', '✓', '✓', '✓'] },
    { feature: 'Best For', values: ['Complete Preparation', 'Quick Score Boost', 'Practice & Fine Tune', 'Math Improvement', 'Reading & Writing Focus'] },
    { feature: 'Fees (USD)', values: ['$1200', '$1200', '$500', '$700', '$700'] },
  ],
  chooseHeading: "We'll Help You Choose",
  chooseItems: [
    { prompt: "I'm starting my SAT preparation.", choose: 'SAT Mastery Track', accent: '#1c5fa5' },
    { prompt: 'My exam is within 1 month.', choose: 'SAT Accelerator', accent: '#16a34a' },
    { prompt: "I've already studied and need practice.", choose: 'SAT Test Series+', accent: '#6d28d9' },
    { prompt: 'I only need help with Math.', choose: 'SAT Math Pro', accent: '#f59b00' },
    { prompt: 'I need help with Reading & Writing.', choose: 'SAT Verbal Edge', accent: '#dc2626' },
  ],
  stats: SHARED_STATS,
};

export const AP_PAGE: ProgramPageData = {
  slug: 'ap',
  exam: 'AP',
  heroEyebrow: 'AP® Preparation',
  heroTitle: [
    { text: 'Master ' },
    { text: 'AP®.', gold: true },
    { text: '\nScore Higher. ' },
    { text: 'Stand Out.', gold: true },
  ],
  heroText:
    "Expert-led coaching, smart strategies, and personalized support to help you earn top AP scores and college credit while you're still in high school.",
  heroBullets: [
    { title: 'Expert AP Instructors', text: '& Subject Specialists' },
    { title: 'Personalized Learning', text: '& Study Plans' },
    { title: 'College Strategies', text: '& Placement' },
    { title: 'Doubt Solving', text: 'Whenever You Need' },
  ],
  primaryCta: 'Explore AP Programs',
  secondaryCta: 'Download AP Guide',
  highlightsHeading: 'Get Ahead. Get Credit. Get Noticed.',
  highlights: [
    { value: '3,000+', label: 'Colleges Accept AP Credit' },
    { value: '$1000s', label: 'Saved in College Tuition' },
    { value: '5', label: 'Target a Perfect AP Score' },
    { value: '30+', label: 'AP Subjects Covered' },
  ],
  tiersEyebrow: 'AP Subjects We Cover',
  tiersHeading: 'Popular AP Subjects & Programs',
  tiersText:
    'Fees are per subject. Bundle discounts available for multiple subject enrollments.',
  tiers: [
    {
      name: 'AP Calculus AB/BC',
      tag: 'STEM Track',
      icon: '∫',
      weeks: '12 – 20 Weeks',
      accent: '#1c5fa5',
      featured: true,
      price: '$699',
      features: [
        'Limits, derivatives, integrals & series',
        'Advanced problem solving',
        'For students aiming for STEM majors',
        'Full-length practice exams',
      ],
    },
    {
      name: 'AP Sciences',
      tag: 'Biology · Physics · Chemistry',
      icon: '⚗',
      weeks: '12 – 16 Weeks',
      accent: '#16a34a',
      price: '$649',
      features: [
        'Cell biology, genetics, ecology & evolution',
        'Mechanics, electricity & modern physics',
        'Atomic structure, reactions & labs',
        'Pre-med & engineering aligned',
      ],
    },
    {
      name: 'AP English',
      tag: 'Language & Literature',
      icon: '✎',
      weeks: '8 – 12 Weeks',
      accent: '#6d28d9',
      price: '$499',
      features: [
        'Rhetorical analysis, argument & synthesis',
        'Poetry, prose, drama & literary analysis',
        'Writing strategies & critical reading',
        'Timed essay practice',
      ],
    },
    {
      name: 'AP Humanities',
      tag: 'History · Psych · Econ',
      icon: '🏛',
      weeks: '8 – 12 Weeks',
      accent: '#f59b00',
      price: '$499',
      features: [
        'US History concepts, periods & DBQ skills',
        'Human behavior, cognition & research methods',
        'Market structure, fiscal policy & inflation',
        'For political science & business tracks',
      ],
    },
    {
      name: 'AP & Many More',
      tag: '30+ Subjects',
      icon: '✦',
      weeks: 'Varies',
      accent: '#dc2626',
      price: 'Contact Us',
      features: [
        'AP Computer Science & Statistics',
        'Environmental Science & more',
        'Explore 30+ AP subjects with expert guidance',
        'Custom plans for any subject combination',
      ],
    },
  ],
  stepsHeading: 'A Proven 5-Step Path to AP Success',
  steps: [
    { n: '1', title: 'Diagnostic Test', text: 'Evaluate your current level and identify strengths & gaps.' },
    { n: '2', title: 'Personalized Plan', text: 'Get a customized study plan for your AP subject.' },
    { n: '3', title: 'Live Learning', text: 'Interactive live classes with expert AP instructors.' },
    { n: '4', title: 'Practice & Analyze', text: 'AP-style questions, quizzes & tests with performance insights.' },
    { n: '5', title: 'Score & Excel', text: 'Refine strategies, boost confidence & achieve your target score.' },
  ],
  curriculumHeading: 'Why Take AP® Courses?',
  curriculum: [
    { title: 'Earn College Credit', accent: '#1c5fa5', points: ['3,000+ colleges accept AP credit', 'Save thousands in tuition', 'Skip introductory courses'] },
    { title: 'Boost Your GPA', accent: '#16a34a', points: ['Weighted GPA advantage', 'Stronger transcript', 'Demonstrate rigor'] },
    { title: 'Stand Out', accent: '#f59b00', points: ['Stronger college application', 'Show academic ambition', 'Get noticed by admissions'] },
  ],
  compareHeading: 'Popular AP Subjects & Fee Details',
  compareCols: ['Calculus AB/BC', 'Biology', 'Physics 1 & 2', 'English Lang/Lit', 'US History'],
  compareRows: [
    { feature: 'Duration', values: ['12 – 20 Weeks', '12 – 16 Weeks', '12 – 16 Weeks', '8 – 12 Weeks', '8 – 12 Weeks'] },
    { feature: 'Ideal For', values: ['STEM majors', 'Pre-med & biotech', 'Engineering', 'Writing & reading', 'History & law'] },
    { feature: 'Live Classes', values: ['✓', '✓', '✓', '✓', '✓'] },
    { feature: 'Practice Exams', values: ['✓', '✓', '✓', '✓', '✓'] },
    { feature: 'Personal Mentor', values: ['✓', '✓', '✓', '✓', '✓'] },
    { feature: 'Fee (USD)', values: ['$699', '$649', '$649', '$499', '$499'] },
  ],
  chooseHeading: "We'll Help You Choose",
  chooseItems: [
    { prompt: 'I want complete preparation for my AP exams.', choose: 'AP Mastery Program', accent: '#1c5fa5' },
    { prompt: 'My exam is soon and I need a fast boost.', choose: 'AP Accelerator Program', accent: '#16a34a' },
    { prompt: "I've studied already and need more practice.", choose: 'AP Test Series+', accent: '#6d28d9' },
    { prompt: 'I want to master one specific AP subject.', choose: 'AP Subject Intensive', accent: '#f59b00' },
    { prompt: 'I prefer learning in a small, supportive group.', choose: 'AP Small Group Program', accent: '#dc2626' },
  ],
  stats: SHARED_STATS,
};

export const PROGRAM_PAGES: Record<string, ProgramPageData> = {
  act: ACT_PAGE,
  sat: SAT_PAGE,
  ap: AP_PAGE,
};
