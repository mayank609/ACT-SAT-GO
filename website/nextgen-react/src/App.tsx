import { Header } from './components/Header';
import { Brand } from './components/Brand';
import { useScrollReveal } from './hooks/useScrollReveal';
import { ACT_PAGE } from './data/programs';
import heroImg from './assets/hero.png';

export default function App() {
  useScrollReveal();

  return (
    <>
      <Header />

      <main>
        {/* Hero */}
        <section className="hero section-dark" id="home">
          <span className="orb orb-gold" aria-hidden="true" />
          <span className="orb orb-ring" aria-hidden="true" />
          <span className="orb orb-dot" aria-hidden="true" />
          <div className="shell hero-grid">
            <div className="hero-copy">
              <span className="eyebrow-hero">ACT® PREPARATION</span>
              <h1>Ace the <span>ACT.</span><br />Unlock Your <span>Future.</span></h1>
              <p className="hero-text">Expert-led programs, proven strategies, and personalized support to help you achieve your target ACT score and get into your dream universities.</p>
              
              <div className="hero-bullets-grid">
                <div className="hero-bullet-item">
                  <span className="bullet-icon-wrapper">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="6"></circle>
                      <circle cx="12" cy="12" r="2"></circle>
                    </svg>
                  </span>
                  <div className="bullet-text">
                    <strong>Proven Strategies</strong>
                    <span>Score Higher</span>
                  </div>
                </div>

                <div className="hero-bullet-item">
                  <span className="bullet-icon-wrapper">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </span>
                  <div className="bullet-text">
                    <strong>Expert Mentors</strong>
                    <span>1-on-1 Support</span>
                  </div>
                </div>

                <div className="hero-bullet-item">
                  <span className="bullet-icon-wrapper">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"></line>
                      <line x1="12" y1="20" x2="12" y2="4"></line>
                      <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                  </span>
                  <div className="bullet-text">
                    <strong>Data-Driven</strong>
                    <span>Progress Tracking</span>
                  </div>
                </div>

                <div className="hero-bullet-item">
                  <span className="bullet-icon-wrapper">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                    </svg>
                  </span>
                  <div className="bullet-text">
                    <strong>Doubt Solving</strong>
                    <span>Whenever You Need</span>
                  </div>
                </div>
              </div>

              <div className="hero-actions-new">
                <a className="btn btn-primary" href="#programs">Explore ACT Programs <span aria-hidden="true">→</span></a>
                <a className="btn btn-outline" href="#consultation">
                  Download ACT Guide
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', marginLeft: '6px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </a>
              </div>
            </div>
            <div className="hero-art">
              <img src={heroImg} alt="Students studying online with ACT SAT GO tutoring support" />
              
              <div className="orbit-card badge-target">
                <div className="badge-icon-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="6"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                  </svg>
                </div>
                <span>Target Score</span>
              </div>

              <div className="orbit-card badge-track">
                <div className="badge-icon-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
                </div>
                <span>Track Progress</span>
              </div>

              <div className="orbit-card badge-strategy">
                <div className="badge-icon-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .4 2.5 1.5 3.5.7.8 1.3 1.5 1.5 2.5"></path>
                    <line x1="9" y1="18" x2="15" y2="18"></line>
                    <line x1="10" y1="22" x2="14" y2="22"></line>
                  </svg>
                </div>
                <span>Smart Strategy</span>
              </div>

              <div className="orbit-card badge-success">
                <div className="badge-icon-bg">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                    <path d="M4 22h16"></path>
                    <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path>
                    <path d="M12 2a6 6 0 0 1 6 6v3.5c0 3.3-2.7 6-6 6s-6-2.7-6-6V8a6 6 0 0 1 6-6z"></path>
                  </svg>
                </div>
                <span>Achieve Success</span>
              </div>
            </div>
          </div>
        </section>

        {/* Program tiers */}
        <section className="prog-tiers" id="programs">
          <div className="shell">
            <div className="section-heading center reveal">
              <p className="eyebrow">— {ACT_PAGE.tiersEyebrow} —</p>
              <h2>{ACT_PAGE.tiersHeading}</h2>
              <p>{ACT_PAGE.tiersText}</p>
            </div>
            <div className="tier-grid">
              {ACT_PAGE.tiers.map((t, i) => (
                <article
                  key={t.name}
                  className={`tier-card reveal${t.featured ? ' featured' : ''}`}
                  style={{ transitionDelay: `${i * 60}ms`, ['--accent' as string]: t.accent }}
                >
                  {t.featured && <span className="tier-flag">Most Popular</span>}
                  <span className="tier-icon" aria-hidden="true">{t.icon}</span>
                  <h3>{t.name}</h3>
                  {t.tag && <span className="tier-tag">{t.tag}</span>}
                  <span className="tier-weeks">📅 {t.weeks}</span>
                  <ul>
                    {t.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <div className="tier-price">
                    <strong>{t.price}</strong>
                    {t.oldPrice && <s>{t.oldPrice}</s>}
                  </div>
                  <a className="btn tier-btn" href="#consultation">View Details <span aria-hidden="true">-&gt;</span></a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5-step approach */}
        <section className="prog-steps section-light">
          <div className="shell">
            <div className="section-heading center reveal">
              <p className="eyebrow">— OUR ACT PREP APPROACH —</p>
              <h2>{ACT_PAGE.stepsHeading}</h2>
            </div>
            <div className="step-flow">
              {ACT_PAGE.steps.map((s, i) => (
                <article key={s.n} className="step-card reveal" style={{ transitionDelay: `${i * 70}ms` }}>
                  <span className="step-num">Step {s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Curriculum */}
        <section className="prog-curriculum shell">
          <div className="section-heading reveal">
            <h2>{ACT_PAGE.curriculumHeading}</h2>
          </div>
          <div className="curriculum-grid">
            {ACT_PAGE.curriculum.map((c, i) => (
              <article key={c.title} className="curriculum-card reveal" style={{ transitionDelay: `${i * 70}ms`, ['--accent' as string]: c.accent }}>
                <h3>{c.title}</h3>
                <ul>
                  {c.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* Comparison table */}
        <section className="prog-compare section-light">
          <div className="shell">
            <div className="section-heading center reveal">
              <h2>{ACT_PAGE.compareHeading}</h2>
            </div>
            <div className="compare-wrap reveal">
              <table className="prog-compare-table">
                <thead>
                  <tr>
                    <th>Features</th>
                    {ACT_PAGE.compareCols.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ACT_PAGE.compareRows.map((row) => (
                    <tr key={row.feature}>
                      <th scope="row">{row.feature}</th>
                      {row.values.map((v, i) => (
                        <td key={i} className={v === '✓' ? 'yes' : v === '✗' ? 'no' : undefined}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CTA + stats */}
        <section className="prog-cta section-dark" id="consultation">
          <span className="orb orb-gold" aria-hidden="true" />
          <div className="shell">
            <div className="prog-cta-banner">
              <div>
                <h2>Still Not Sure Which Program Fits You?</h2>
                <p>
                  Book a <strong>FREE 1-on-1 ACT Consultation</strong> with our expert counselors.
                  We'll assess your level, understand your goals, and recommend the best learning path for you.
                </p>
              </div>
              <div className="prog-cta-actions">
                <a className="btn btn-primary" href="#consultation">Book Free Consultation <span aria-hidden="true">-&gt;</span></a>
              </div>
            </div>
            <div className="prog-stats">
              {ACT_PAGE.stats.map((s, idx) => (
                <div key={s.label}>
                  {[
                    // Trophy SVG
                    <svg key="1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: 'var(--gold)' }}>
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                      <path d="M4 22h16"></path>
                      <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path>
                      <path d="M12 2a6 6 0 0 1 6 6v3.5c0 3.3-2.7 6-6 6s-6-2.7-6-6V8a6 6 0 0 1 6-6z"></path>
                    </svg>,
                    // Book SVG
                    <svg key="2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: 'var(--gold)' }}>
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    </svg>,
                    // Star SVG
                    <svg key="3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: 'var(--gold)' }}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>,
                    // Thumbs-up SVG
                    <svg key="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: 'var(--gold)' }}>
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                    </svg>
                  ][idx]}
                  <strong style={{ marginTop: '8px' }}>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="shell">
          <Brand />
          <p>Premium academic coaching for SAT, ACT, AP, and K-12 learners.</p>
        </div>
      </footer>
    </>
  );
}
