import { TEST_GUIDES, TEST_GUIDES_UPDATED, testGuideCover, testGuidePdf, type TestGuide } from '../data/testGuides';
import { trackDownload } from '../lib/analytics';

const GENERIC_QUERIES = ['guides', 'guide', 'test prep', 'pdf', 'sat act', 'sat and act'];

/** True when a guide matches a free-text query (used by the page-level search too). */
export function testGuideMatches(g: TestGuide, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q || GENERIC_QUERIES.includes(q)) return true;
  const text = `${g.title} ${g.tag} ${g.summary} ${g.keywords.join(' ')}`.toLowerCase();
  return q.split(/\s+/).every((word) => text.includes(word));
}

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

interface TestGuidesSectionProps {
  /** Text typed into the hero search box; narrows the guides too. */
  pageQuery?: string;
}

export function TestGuidesSection({ pageQuery = '' }: TestGuidesSectionProps) {
  const visible = TEST_GUIDES.filter((g) => testGuideMatches(g, pageQuery));

  return (
    <section id="sat-act-guides" className="resources-section shell ap-guides" aria-labelledby="sat-act-guides-title">
      <div className="section-header-row ap-guides-head">
        <div className="section-title">
          <span className="ap-guides-eyebrow">FREE PDF DOWNLOADS · NO SIGN-UP</span>
          <h2 id="sat-act-guides-title">SAT &amp; ACT Test Guides</h2>
          <p>
            Complete guides to both tests: format and timing, every skill in plain English, a 12-week study plan and
            10 practice questions with explanations. Updated {TEST_GUIDES_UPDATED}.
          </p>
        </div>
      </div>

      <ul className="ap-guides-grid">
        {visible.map((g) => {
          const pdf = testGuidePdf(g);
          return (
            <li key={g.slug} className="ap-guide-card">
              <a
                className="ap-guide-cover"
                href={pdf}
                target="_blank"
                rel="noopener"
                aria-label={`Open the ${g.title} test guide PDF in a new tab`}
                onClick={() => trackDownload(g.title, 'open')}
              >
                <img src={testGuideCover(g)} alt={`${g.title} test guide cover`} loading="lazy" width={360} height={466} />
              </a>
              <div className="ap-guide-body">
                <span className="ap-guide-tag">{g.tag}</span>
                <h3>{g.title} Test Guide</h3>
                <p>{g.summary}</p>
                <p className="ap-guide-meta">
                  PDF · {g.pages} pages · {formatSize(g.sizeKb)}
                </p>
                <a className="ap-guide-download" href={pdf} download onClick={() => trackDownload(g.title, 'download')}>
                  <IconDownload /> Download free PDF
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
