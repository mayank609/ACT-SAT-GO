// SAT and ACT exam guides served from /public/guides/sat-act/. Each PDF lives at
// /guides/sat-act/<slug>.pdf and its cover thumbnail at /guides/sat-act/covers/<slug>.webp.
// To add a guide: drop both files in public/guides/sat-act/ and add an entry below.

export interface TestGuide {
  slug: string;
  title: string;
  tag: string;
  pages: number;
  sizeKb: number;
  summary: string;
  keywords: string[];
}

export const TEST_GUIDES_UPDATED = 'October 2026';

export const TEST_GUIDES: TestGuide[] = [
  {
    slug: 'sat-exam-guide-act-sat-go',
    title: 'SAT',
    tag: 'Digital SAT',
    pages: 13,
    sizeKb: 1170,
    summary: 'Both sections explained module by module, how adaptive scoring works, all eight content domains, a 12-week plan, 2026–27 test dates and 10 hard practice questions.',
    keywords: ['digital sat', 'bluebook', 'desmos', 'college board', 'reading and writing', 'math'],
  },
  {
    slug: 'act-exam-guide-act-sat-go',
    title: 'ACT',
    tag: 'Enhanced ACT',
    pages: 13,
    sizeKb: 1144,
    summary: 'The enhanced ACT section by section, optional Science and Writing, the formulas to memorize, a 12-week plan, 2026–27 test dates and 10 hard practice questions.',
    keywords: ['enhanced act', 'english', 'math', 'reading', 'science', 'writing', 'composite'],
  },
];

export const testGuidePdf = (g: TestGuide) => `/guides/sat-act/${g.slug}.pdf`;
export const testGuideCover = (g: TestGuide) => `/guides/sat-act/covers/${g.slug}.webp`;
