import { useMemo, useState } from 'react';
import {
  AP_GUIDES,
  AP_GUIDE_CATEGORIES,
  AP_GUIDES_UPDATED,
  apGuideCover,
  apGuidePdf,
  type ApGuide,
  type ApGuideCategory,
} from '../data/apGuides';
import { trackDownload } from '../lib/analytics';

const GENERIC_AP_QUERIES = ['ap', 'ap guides', 'ap guide', 'test prep', 'subject guides', 'guides', 'pdf'];

function haystack(g: ApGuide): string {
  return `${g.title} ${g.category} ${g.summary} ${g.keywords.join(' ')}`.toLowerCase();
}

/** True when a guide matches a free-text query (used by the page-level search too). */
export function apGuideMatches(g: ApGuide, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q || GENERIC_AP_QUERIES.includes(q)) return true;
  const text = haystack(g);
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

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

interface ApGuidesSectionProps {
  /** Text typed into the hero search box; narrows the guides too. */
  pageQuery?: string;
}

export function ApGuidesSection({ pageQuery = '' }: ApGuidesSectionProps) {
  const [category, setCategory] = useState<ApGuideCategory | 'All'>('All');
  const [query, setQuery] = useState('');

  const visible = useMemo(
    () =>
      AP_GUIDES.filter(
        (g) =>
          (category === 'All' || g.category === category) &&
          apGuideMatches(g, pageQuery) &&
          apGuideMatches(g, query),
      ),
    [category, query, pageQuery],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    AP_GUIDES.forEach((g) => (c[g.category] = (c[g.category] || 0) + 1));
    return c;
  }, []);

  const reset = () => {
    setCategory('All');
    setQuery('');
  };

  return (
    <section id="ap-guides" className="resources-section shell ap-guides" aria-labelledby="ap-guides-title">
      <div className="section-header-row ap-guides-head">
        <div className="section-title">
          <span className="ap-guides-eyebrow">FREE PDF DOWNLOADS · NO SIGN-UP</span>
          <h2 id="ap-guides-title">AP Exam Guides for Every Subject</h2>
          <p>
            {AP_GUIDES.length} complete guides: exam format, every unit in plain English, free-response playbooks and
            10 practice questions with explanations. Updated {AP_GUIDES_UPDATED}.
          </p>
        </div>
      </div>

      <div className="ap-guides-toolbar">
        <label className="ap-guides-search">
          <IconSearch />
          <span className="sr-only">Find your AP subject</span>
          <input
            type="search"
            placeholder="Find your AP subject, e.g. Biology, Calc BC, APUSH"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className="ap-guides-chips" role="group" aria-label="Filter by subject area">
          <button
            type="button"
            className={`ap-chip${category === 'All' ? ' active' : ''}`}
            aria-pressed={category === 'All'}
            onClick={() => setCategory('All')}
          >
            All <span>{AP_GUIDES.length}</span>
          </button>
          {AP_GUIDE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`ap-chip${category === c ? ' active' : ''}`}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c} <span>{counts[c]}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="ap-guides-count" aria-live="polite">
        Showing {visible.length} of {AP_GUIDES.length} guides
      </p>

      {visible.length === 0 ? (
        <div className="search-empty-state">
          <h3>No AP guide matches that</h3>
          <p>Try the course name, like "Chemistry" or "World History".</p>
          <button type="button" className="clear-search-btn" onClick={reset}>
            Show all AP guides
          </button>
        </div>
      ) : (
        <ul className="ap-guides-grid">
          {visible.map((g) => {
            const pdf = apGuidePdf(g);
            return (
              <li key={g.slug} className="ap-guide-card">
                <a
                  className="ap-guide-cover"
                  href={pdf}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Open the ${g.title} exam guide PDF in a new tab`}
                  onClick={() => trackDownload(g.title, 'open')}
                >
                  <img src={apGuideCover(g)} alt={`${g.title} exam guide cover`} loading="lazy" width={360} height={466} />
                </a>
                <div className="ap-guide-body">
                  <span className="ap-guide-tag">{g.category}</span>
                  <h3>{g.title} Exam Guide</h3>
                  <p>{g.summary}</p>
                  <p className="ap-guide-meta">
                    PDF · {g.pages} pages · {formatSize(g.sizeKb)}
                  </p>
                  <a
                    className="ap-guide-download"
                    href={pdf}
                    download
                    onClick={() => trackDownload(g.title, 'download')}
                  >
                    <IconDownload /> Download free PDF
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="ap-guides-cta">
        <div>
          <h3>Want a tutor for your AP exam?</h3>
          <p>Book a free diagnostic lesson and get a study plan built around your course and exam date.</p>
        </div>
        <a className="ap-guides-cta-btn" href="/consultation">
          Book a free lesson <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}
