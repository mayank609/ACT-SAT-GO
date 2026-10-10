// Build-time prerendering: turns the client-only SPA into real HTML pages.
//
// For every public route in src/seo.ts this writes dist/<route>.html containing
// the fully rendered page plus a unique <title>, meta description, canonical
// URL, Open Graph tags and JSON-LD. The browser then hydrates that markup, so
// parents see content immediately and crawlers / link previews / AI search
// read the actual page instead of an empty <div id="root">.
// It also writes sitemap.xml, robots.txt, llms.txt and 404.html.
//
// Run after `vite build` and `vite build --ssr` (see "build" in package.json).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ssrDir = path.join(root, 'dist-ssr');

const entry = fs.readdirSync(ssrDir).find((f) => /^entry-server\.(m?js)$/.test(f));
if (!entry) throw new Error('dist-ssr/entry-server.js not found — run vite build --ssr first');
const { render, PAGES, headTags, canonicalUrl, SITE } = await import(pathToFileURL(path.join(ssrDir, entry)).href);

const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const HEAD_RE = /<!--head-tags-->[\s\S]*?<!--\/head-tags-->/;
if (!HEAD_RE.test(template) || !template.includes('<!--app-html-->')) {
  throw new Error('index.html is missing the <!--head-tags--> or <!--app-html--> markers');
}

// Source module(s) behind each route's lazy chunk (see src/routes.tsx).
const ROUTE_SOURCES = {
  '/': ['src/App.tsx'],
  '/sat': ['src/pages/ProgramPage.tsx', 'src/data/programs.ts'],
  '/act': ['src/pages/ProgramPage.tsx', 'src/data/programs.ts'],
  '/ap': ['src/pages/ProgramPage.tsx', 'src/data/programs.ts'],
  '/future-programs': ['src/pages/FutureProgramsPage.tsx'],
  '/k-12-tutoring': ['src/pages/K12TutoringPage.tsx'],
  '/about-us': ['src/pages/AboutUsPage.tsx'],
  '/resources': ['src/pages/ResourcesPage.tsx'],
  '/consultation': ['src/pages/EnquiryPage.tsx'],
  '/free-test': ['src/pages/FreeTestPage.tsx'],
  '/careers': ['src/pages/CareersPage.tsx'],
  '/privacy-policy': ['src/pages/PolicyPage.tsx'],
  '/terms': ['src/pages/PolicyPage.tsx'],
  '/refund-policy': ['src/pages/PolicyPage.tsx'],
  '/child-safety': ['src/pages/PolicyPage.tsx'],
  '/404': ['src/pages/NotFoundPage.tsx'],
};

const manifestPath = path.join(dist, '.vite', 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
const entryChunks = new Set();
(function collect(key, out) {
  const m = manifest[key];
  if (!m || out.has(m.file)) return;
  out.add(m.file);
  (m.imports || []).forEach((k) => collect(k, out));
})(entryKey, entryChunks);

function preloadLinks(routePath) {
  const files = new Set();
  const collect = (key) => {
    const m = manifest[key];
    if (!m || files.has(m.file) || entryChunks.has(m.file)) return;
    files.add(m.file);
    (m.imports || []).forEach(collect);
  };
  (ROUTE_SOURCES[routePath] || []).forEach(collect);
  return [...files].map((f) => `<link rel="modulepreload" crossorigin href="/${f}">`).join('\n    ');
}

function outFile(routePath) {
  if (routePath === '/') return 'index.html';
  return `${routePath.slice(1)}.html`; // served at the clean URL (vercel.json cleanUrls)
}

const today = new Date().toISOString().slice(0, 10);
const sitemapUrls = [];

for (const meta of PAGES) {
  const url = meta.path === '/404' ? '/this-page-does-not-exist' : meta.path;
  const appHtml = await render(url);
  if (!appHtml || appHtml.length < 200) throw new Error(`Prerender of ${meta.path} produced no content`);
  const html = template
    .replace(HEAD_RE, `${headTags(meta)}\n    ${preloadLinks(meta.path)}`)
    .replace('<!--app-html-->', appHtml);
  const file = path.join(dist, outFile(meta.path));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  if (!meta.noindex) sitemapUrls.push(canonicalUrl(meta.path));
  console.log(`prerendered ${meta.path.padEnd(18)} -> dist/${outFile(meta.path)} (${(html.length / 1024).toFixed(1)} kB)`);
}

const priority = (u) => (u === `${SITE.url}/` ? '1.0' : /\/(sat|act|ap|free-test|consultation)$/.test(u) ? '0.9' : '0.6');
fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><priority>${priority(u)}</priority></url>`).join('\n')}
</urlset>
`,
);

fs.writeFileSync(
  path.join(dist, 'robots.txt'),
  `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${SITE.url}/sitemap.xml
`,
);

// llms.txt (https://llmstxt.org): a plain Markdown map of the site for AI
// assistants and answer engines, built from the same titles and descriptions
// as the pages themselves.
const SECTIONS = [
  ['Tutoring programs', ['/sat', '/act', '/ap', '/k-12-tutoring', '/future-programs']],
  ['Free resources', ['/free-test', '/resources']],
  ['About and booking', ['/about-us', '/consultation', '/careers']],
  ['Policies', ['/refund-policy', '/child-safety', '/privacy-policy', '/terms']],
];
const llmsLink = (p) => {
  const m = PAGES.find((x) => x.path === p);
  return m ? `- [${m.title}](${canonicalUrl(p)}): ${m.description}` : null;
};
fs.writeFileSync(
  path.join(dist, 'llms.txt'),
  `# ${SITE.name}

> ${SITE.name} offers live 1-on-1 online tutoring for the Digital SAT, the enhanced ACT and AP exams, plus K-12 academics, for US students. Every student starts with a free diagnostic lesson, gets a plan built around their test date, has homework after every session, and parents receive regular progress reports. Program fees are published on the SAT, ACT and AP pages.

Contact: ${SITE.email}, ${SITE.phoneDisplay}. Home page: ${canonicalUrl('/')}

${SECTIONS.map(([h, paths]) => `## ${h}\n\n${paths.map(llmsLink).filter(Boolean).join('\n')}`).join('\n\n')}
`,
);

fs.rmSync(ssrDir, { recursive: true, force: true });
fs.rmSync(path.join(dist, '.vite'), { recursive: true, force: true });
console.log(`sitemap.xml (${sitemapUrls.length} URLs), robots.txt, llms.txt and 404.html written.`);
