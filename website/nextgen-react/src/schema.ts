import { SITE } from './site';
import { HOME_FAQ, type FaqItem } from './data/faq';
import { SAT_PAGE, ACT_PAGE, AP_PAGE, type ProgramPageData } from './data/programs';
import { PAGES } from './seo';

// Schema.org structured data (JSON-LD) for every page in the sitemap, per the
// "Schema Markup (JSON-LD) Implementation Guide". One @graph per page, written
// into the prerendered <head> by scripts/prerender.mjs so it is in the initial
// HTML. Every page links back to the organization via @id.
//
// Rules (guide §7): only mark up what the page shows. Offer prices are built
// from data/programs.ts — the same data the program pages render — so a price
// change on the page is automatically a price change here. FAQ answers come
// from data/faq.ts, the same text the homepage shows. No Review /
// AggregateRating for the site's own testimonials.

type Json = Record<string, unknown>;

const ORG_ID = `${SITE.url}/#organization`;
const WEBSITE_ID = `${SITE.url}/#website`;
const US = { '@type': 'Country', name: 'United States' };
const telephone = SITE.phoneHref.replace('tel:+1', '+1-').replace(/^(\+1-)(\d{3})(\d{3})(\d{4})$/, '$1$2-$3-$4');

const url = (path: string) => (path === '/' ? `${SITE.url}/` : `${SITE.url}${path}`);

const organization: Json = {
  '@type': 'EducationalOrganization',
  '@id': ORG_ID,
  name: SITE.name,
  alternateName: 'ACT SAT GO Tutoring',
  url: url('/'),
  logo: { '@type': 'ImageObject', url: `${SITE.url}/logo.png` },
  image: `${SITE.url}/og-image.jpg`,
  description:
    'Live 1-on-1 online tutoring for the Digital SAT, the enhanced ACT and AP exams, plus K-12 academics — with a diagnostic before the first lesson and progress reports for parents.',
  email: SITE.email,
  telephone,
  areaServed: US,
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    telephone,
    email: SITE.email,
    availableLanguage: 'English',
  },
  sameAs: [
    SITE.socials.facebook,
    SITE.socials.instagram,
    SITE.socials.youtube,
    SITE.socials.linkedin,
    // Google Business Profile (the share link, not the write-a-review link)
    SITE.googleReviewUrl.replace(/\/review$/, ''),
  ],
};

const website: Json = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: url('/'),
  name: SITE.name,
  publisher: { '@id': ORG_ID },
  inLanguage: 'en-US',
};

function webPage(type: string, path: string, name: string, description?: string): Json {
  return {
    '@type': type,
    '@id': `${url(path)}#webpage`,
    url: url(path),
    name,
    ...(description ? { description } : {}),
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': ORG_ID },
  };
}

function breadcrumb(path: string, name: string): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: url('/') },
      { '@type': 'ListItem', position: 2, name, item: url(path) },
    ],
  };
}

/** Offers exactly as the program page lists them; tiers without a numeric price ("Contact Us") are skipped. */
function offersFrom(data: ProgramPageData, path: string): Json[] {
  return data.tiers.flatMap((t) => {
    const price = t.price.replace(/[^0-9.]/g, '');
    if (!price) return [];
    // AP tiers list their subjects in the tag ("Biology · Physics · Chemistry");
    // SAT/ACT tags are marketing labels ("Flagship Program") and stay out of the name.
    const showTag = data.exam === 'AP' && t.tag && !/track|program|subjects/i.test(t.tag);
    return [{
      '@type': 'Offer',
      name: showTag ? `${t.name} (${t.tag})` : t.name,
      price,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: url(path),
      description: `Duration: ${t.weeks}`,
    }];
  });
}

function service(path: string, name: string, serviceType: string, description: string, offers?: Json[]): Json {
  return {
    '@type': 'Service',
    '@id': `${url(path)}#service`,
    name,
    serviceType,
    description,
    provider: { '@id': ORG_ID },
    areaServed: US,
    url: url(path),
    ...(offers && offers.length ? { offers } : {}),
  };
}

function faqPageFor(path: string, items: FaqItem[]): Json {
  return {
    '@type': 'FAQPage',
    '@id': `${url(path)}#faq`,
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

const faqPage = faqPageFor('/', HOME_FAQ);

const titleOf = (path: string) => PAGES.find((p) => p.path === path)?.title ?? SITE.name;

const SAT_DESC = 'Live 1-on-1 Digital SAT tutoring with a personalised plan, full-length adaptive practice tests and a score report after each one.';
const ACT_DESC = 'Online 1-on-1 tutoring built for the enhanced ACT: 131 core questions, about 2 hours, Science optional.';
const AP_SERVICE_DESC = '1-on-1 online AP tutoring for Calculus AB/BC, Physics, Chemistry, Biology, Statistics, Economics, Computer Science and more.';
const AP_PAGE_DESC = `${AP_SERVICE_DESC.replace(' and more.', ' and more — aiming for 4s and 5s.')} Book a free diagnostic lesson.`;
const K12_DESC = '1-on-1 online tutoring for elementary, middle and high school students in Math, English, Science and study skills, with a personalised plan for every child.';
const FREE_TEST_DESC = 'One full-length Digital SAT or ACT practice test in a real exam interface, with a scaled score and a section, topic and question-level score report.';

/** Simple pages (guide block 10): WebPage + breadcrumb with these names. */
const SIMPLE: Record<string, { crumb: string; name: string }> = {
  '/careers': { crumb: 'Careers', name: 'Careers at ACT SAT GO' },
  '/future-programs': { crumb: 'Future Programs', name: 'IB, IGCSE & A Levels | ACT SAT GO' },
  '/privacy-policy': { crumb: 'Privacy Policy', name: 'Privacy Policy | ACT SAT GO' },
  '/terms': { crumb: 'Terms', name: 'Terms of Service | ACT SAT GO' },
  '/refund-policy': { crumb: 'Refund & Cancellation Policy', name: 'Refund & Cancellation Policy | ACT SAT GO' },
  '/child-safety': { crumb: 'Child Safety', name: 'Child Safety & Online Sessions | ACT SAT GO' },
};

function graphFor(path: string): Json[] | null {
  switch (path) {
    case '/':
      return [
        organization,
        website,
        { ...webPage('WebPage', '/', titleOf('/')), '@id': `${SITE.url}/#webpage` },
        faqPage,
      ];
    case '/sat':
      return [
        webPage('WebPage', path, titleOf(path), SAT_DESC),
        service(path, 'Digital SAT Tutoring (1-on-1, online)', 'SAT test preparation', SAT_DESC, offersFrom(SAT_PAGE, path)),
        breadcrumb(path, 'SAT'),
        ...(SAT_PAGE.faq ? [faqPageFor(path, SAT_PAGE.faq)] : []),
      ];
    case '/act':
      return [
        webPage('WebPage', path, titleOf(path), ACT_DESC),
        service(path, 'ACT Tutoring (1-on-1, online)', 'ACT test preparation', ACT_DESC, offersFrom(ACT_PAGE, path)),
        breadcrumb(path, 'ACT'),
        ...(ACT_PAGE.faq ? [faqPageFor(path, ACT_PAGE.faq)] : []),
      ];
    case '/ap':
      return [
        webPage('WebPage', path, titleOf(path), AP_PAGE_DESC),
        service(path, 'AP Tutoring (1-on-1, online)', 'AP exam preparation', AP_SERVICE_DESC, offersFrom(AP_PAGE, path)),
        breadcrumb(path, 'AP'),
      ];
    case '/k-12-tutoring':
      return [
        webPage('WebPage', path, titleOf(path), K12_DESC),
        service(path, 'K-12 Tutoring (1-on-1, online)', 'K-12 academic tutoring', K12_DESC),
        breadcrumb(path, 'K-12 Tutoring'),
      ];
    case '/free-test':
      return [
        webPage('WebPage', path, titleOf(path), FREE_TEST_DESC),
        service(path, 'Free Digital SAT & ACT Practice Test', 'Practice test with score report', FREE_TEST_DESC, [{
          '@type': 'Offer',
          name: 'Free practice test',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: url(path),
        }]),
        breadcrumb(path, 'Free Practice Test'),
      ];
    case '/consultation':
      return [
        webPage('ContactPage', path, titleOf(path),
          'Book a free 1-on-1 diagnostic lesson for the Digital SAT, ACT, AP or K-12 tutoring. No payment, no obligation.'),
        breadcrumb(path, 'Book a Free Diagnostic Lesson'),
      ];
    case '/about-us':
      return [
        webPage('AboutPage', path, titleOf(path),
          'How ACT SAT GO plans, teaches and tracks every student: diagnostics, 1-on-1 tutors, homework after every session and progress reports for parents.'),
        breadcrumb(path, 'About Us'),
      ];
    case '/resources':
      return [
        webPage('CollectionPage', path, titleOf(path),
          'Free SAT, ACT and AP study guides, checklists and templates from ACT SAT GO.'),
        breadcrumb(path, 'Resources'),
      ];
    default: {
      const simple = SIMPLE[path];
      if (!simple) return null;
      return [webPage('WebPage', path, simple.name), breadcrumb(path, simple.crumb)];
    }
  }
}

/** The JSON-LD document for a page, or null for pages without markup (404, admin). */
export function schemaFor(path: string): Json | null {
  const graph = graphFor(path);
  return graph ? { '@context': 'https://schema.org', '@graph': graph } : null;
}
