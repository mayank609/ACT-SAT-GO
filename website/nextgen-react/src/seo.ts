import { SITE } from './site';

// Per-route <title>, meta description and canonical URL. Structured data
// (JSON-LD) lives in schema.ts, which only the prerenderer loads.
// Used twice: by scripts/prerender.mjs to write real HTML <head> tags for
// every public page (what search engines and link previews read), and by
// <RouteMeta> to keep the head in sync during client-side navigation.

export interface PageMeta {
  path: string;
  title: string;
  description: string;
  /** Excluded from the sitemap and marked noindex. */
  noindex?: boolean;
}

export const PAGES: PageMeta[] = [
  {
    path: '/',
    title: 'Online SAT & ACT Tutoring for US Students | 1-on-1 | ACT SAT GO',
    description:
      '1-on-1 online tutoring for the Digital SAT, ACT and AP exams: a diagnostic first, homework after every session and weekly reports for parents.',
  },
  {
    path: '/sat',
    title: 'Digital SAT Tutoring Online — 1-on-1 Expert Tutors | ACT SAT GO',
    description:
      'Live 1-on-1 Digital SAT tutoring with a personal plan, full-length adaptive practice tests and a score report after each. See programs and fees.',
  },
  {
    path: '/act',
    title: 'ACT Tutoring Online for the Enhanced ACT — 1-on-1 | ACT SAT GO',
    description:
      'Online 1-on-1 tutoring built for the enhanced ACT: 131 core questions, about 2 hours, Science optional. Programs, fees and a free diagnostic lesson.',
  },
  {
    path: '/ap',
    title: 'AP Tutoring Online — Calculus, Physics & More | ACT SAT GO',
    description:
      '1-on-1 online AP tutoring for Calculus AB/BC, Physics, Chemistry, Biology, Statistics, Economics and more, aiming for 4s and 5s.',
  },
  {
    path: '/k-12-tutoring',
    title: 'Online K-12 Tutoring — Math, English & Science | ACT SAT GO',
    description:
      '1-on-1 online tutoring for elementary, middle and high school students in Math, English, Science and study skills, with a personalised plan for every child.',
  },
  {
    path: '/future-programs',
    title: 'IB, IGCSE, AS & A Level Tutoring Online | ACT SAT GO',
    description:
      'Online 1-on-1 tutoring for the IB Diploma Programme, IGCSE/GCSE, AS and A Level — for internationally mobile families.',
  },
  {
    path: '/about-us',
    title: 'About ACT SAT GO — How We Teach and Who We Are',
    description:
      'How ACT SAT GO plans, teaches and tracks every student: diagnostics, 1-on-1 tutors, homework after every session and progress reports for parents.',
  },
  {
    path: '/resources',
    title: 'Free AP Exam Guides (PDF) & SAT, ACT Resources | ACT SAT GO',
    description:
      'Download 42 free AP exam guides as PDFs, one for every AP subject, plus free guides and articles on the Digital SAT, the enhanced ACT and college applications.',
  },
  {
    path: '/consultation',
    title: 'Book a Free Diagnostic Lesson | ACT SAT GO',
    description:
      'Book a free diagnostic lesson: your child gets a baseline score and you get a clear plan for the SAT, ACT or AP — no payment, no obligation.',
  },
  {
    path: '/free-test',
    title: 'Free Digital SAT & ACT Practice Test with Score Report | ACT SAT GO',
    description:
      'Take a free, timed SAT or ACT practice test in our real exam interface and get your scaled score with section, topic and question-level analytics.',
  },
  {
    path: '/careers',
    title: 'Online Tutor Jobs — SAT, ACT & AP | Careers at ACT SAT GO',
    description: 'Teach SAT, ACT and AP students online with ACT SAT GO. See open tutor and operations roles and apply.',
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | ACT SAT GO',
    description: 'How ACT SAT GO collects, uses and protects personal information, including information about children.',
  },
  {
    path: '/terms',
    title: 'Terms of Service | ACT SAT GO',
    description: 'The terms that apply when you use the ACT SAT GO website and tutoring services.',
  },
  {
    path: '/refund-policy',
    title: 'Refund & Cancellation Policy | ACT SAT GO',
    description: 'How rescheduling, cancellations and refunds work for ACT SAT GO tutoring programs.',
  },
  {
    path: '/child-safety',
    title: 'Child Safety & Online Sessions | ACT SAT GO',
    description: 'How ACT SAT GO keeps online tutoring sessions safe for students, and how parents stay involved.',
  },
  {
    path: '/404',
    title: 'Page not found | ACT SAT GO',
    description: 'The page you were looking for could not be found.',
    noindex: true,
  },
];

const FALLBACK: PageMeta = {
  path: '',
  title: 'ACT SAT GO',
  description: PAGES[0].description,
  noindex: true,
};

export function metaForPath(pathname: string): PageMeta {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean.startsWith('/free-test/')) return { ...PAGES.find((p) => p.path === '/free-test')!, noindex: true };
  if (clean.startsWith('/admin')) return { ...FALLBACK, title: 'Admin | ACT SAT GO' };
  return PAGES.find((p) => p.path === clean) ?? { ...PAGES.find((p) => p.path === '/404')! };
}

export function canonicalUrl(path: string): string {
  return path === '/' ? `${SITE.url}/` : `${SITE.url}${path}`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Static <head> tags for prerendered HTML. */
export function headTags(meta: PageMeta, jsonLd?: Record<string, unknown> | null): string {
  const url = canonicalUrl(meta.path);
  const image = `${SITE.url}/og-image.jpg`;
  const tags = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE.name}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ];
  if (jsonLd) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`);
  }
  return tags.join('\n    ');
}
