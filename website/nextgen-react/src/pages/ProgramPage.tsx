import { useEffect } from 'react';
import { Header } from '../components/Header';
import { Brand } from '../components/Brand';
import { useScrollReveal } from '../hooks/useScrollReveal';
import type { ProgramPageData } from '../data/programs';
import apHeroImg from '../assets/ap-hero.png';
import satHeroImg from '../assets/sat-hero.png';

const CONSULT_HREF = '/#consultation';

function getHeroBulletIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('instructor') || t.includes('tutor') || t.includes('strateg')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="6"></circle>
        <circle cx="12" cy="12" r="2"></circle>
      </svg>
    );
  }
  if (t.includes('learn') || t.includes('mentor')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
        <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
      </svg>
    );
  }
  if (t.includes('college') || t.includes('placement') || t.includes('data') || t.includes('progress')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
    </svg>
  );
}

export function ProgramPage({ data }: { data: ProgramPageData }) {
  useScrollReveal();

  // Each program page should open at the top and carry a descriptive title.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${data.exam} Preparation — ACT SAT GO`;
  }, [data.exam]);

  const isAp = data.slug === 'ap';
  const isSat = data.slug === 'sat';
  const isAct = data.slug === 'act';

  return (
    <>
      <Header />

      <main>
        {/* Hero */}
        <section className={`prog-hero section-dark${(isSat || isAct) ? ' sat-page' : ''}`}>
          <span className="orb orb-gold" aria-hidden="true" />
          <span className="orb orb-ring" aria-hidden="true" />
          <div className="shell prog-hero-grid">
            <div className="prog-hero-copy">
              <span className="eyebrow-hero">{data.heroEyebrow}</span>
              <h1>
                {data.heroTitle.map((run, i) =>
                  run.gold ? <span key={i}>{run.text}</span> : <span key={i} className="plain">{run.text}</span>,
                )}
              </h1>
              <p className="hero-text">{data.heroText}</p>
              
              <div className="hero-bullets-grid">
                {data.heroBullets.map((b) => (
                  <div key={b.title} className="hero-bullet-item">
                    <span className="bullet-icon-wrapper">
                      {getHeroBulletIcon(b.title)}
                    </span>
                    <div className="bullet-text">
                      <strong>{b.title}</strong>
                      <span>{b.text}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hero-actions-new">
                <a className="btn btn-primary" href="#programs">{data.primaryCta} <span aria-hidden="true">→</span></a>
                <a className="btn btn-outline" href={CONSULT_HREF}>
                  {data.secondaryCta}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', marginLeft: '6px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </a>
              </div>
            </div>
            
            {isAp ? (
              <div className="prog-hero-art ap-hero-art" aria-hidden="true">
                <div
                  className="ap-hero-illustration"
                  style={{ backgroundImage: `url(${apHeroImg})` }}
                />

                <div className="orbit-card badge-ap-strategy">
                  <div className="badge-icon-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="6"></circle>
                      <circle cx="12" cy="12" r="2"></circle>
                    </svg>
                  </div>
                  <span>Smart Strategy</span>
                </div>

                <div className="orbit-card badge-ap-concepts">
                  <div className="badge-icon-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .4 2.5 1.5 3.5.7.8 1.3 1.5 1.5 2.5"></path>
                      <line x1="9" y1="18" x2="15" y2="18"></line>
                      <line x1="10" y1="22" x2="14" y2="22"></line>
                    </svg>
                  </div>
                  <span>Deep Concepts</span>
                </div>

                <div className="orbit-card badge-ap-scores">
                  <div className="badge-icon-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                      <path d="M4 22h16"></path>
                      <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path>
                      <path d="M12 2a6 6 0 0 1 6 6v3.5c0 3.3-2.7 6-6 6s-6-2.7-6-6V8a6 6 0 0 1 6-6z"></path>
                    </svg>
                  </div>
                  <span>Top Scores & Credit</span>
                </div>
              </div>
            ) : (isSat || isAct) ? (
              <div className="hero-art" aria-hidden="true">
                <div className="sat-hero-img" style={{ backgroundImage: `url(${satHeroImg})` }} />

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
            ) : (
              <div className="prog-hero-art" aria-hidden="true">
                <div className="exam-orb"><span>{data.exam}</span></div>
                <div className="orbit-badge badge-1">Smart Strategy</div>
                <div className="orbit-badge badge-2">Target Score</div>
                <div className="orbit-badge badge-3">Track Progress</div>
                <div className="orbit-badge badge-4">Achieve Success</div>
              </div>
            )}
          </div>
        </section>

        {/* Highlights band */}
        <section className="prog-highlights shell" aria-label={`${data.exam} highlights`}>
          <div className="section-heading reveal">
            <h2>{data.highlightsHeading}</h2>
          </div>
          <div className="highlight-grid">
            {data.highlights.map((h, i) => (
              <article key={h.label} className="highlight-card reveal" style={{ transitionDelay: `${i * 70}ms` }}>
                <strong>{h.value}</strong>
                <span>{h.label}</span>
              </article>
            ))}
          </div>
        </section>

        {/* Program tiers */}
        <section className="prog-tiers" id="programs">
          <div className="shell">
            <div className="section-heading center reveal">
              <p className="eyebrow">{data.tiersEyebrow}</p>
              <h2>{data.tiersHeading}</h2>
              <p>{data.tiersText}</p>
            </div>
            <div className="tier-grid">
              {data.tiers.map((t, i) => (
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
                  <a className="btn tier-btn" href={CONSULT_HREF}>View Details <span aria-hidden="true">-&gt;</span></a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5-step approach */}
        <section className="prog-steps section-light">
          <div className="shell">
            <div className="section-heading center reveal">
              <p className="eyebrow">Our {data.exam} Prep Approach</p>
              <h2>{data.stepsHeading}</h2>
            </div>
            <div className="step-flow">
              {data.steps.map((s, i) => (
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
            <h2>{data.curriculumHeading}</h2>
          </div>
          <div className="curriculum-grid">
            {data.curriculum.map((c, i) => (
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
              <h2>{data.compareHeading}</h2>
            </div>
            <div className="compare-wrap reveal">
              <table className="prog-compare-table">
                <thead>
                  <tr>
                    <th>Features</th>
                    {data.compareCols.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.compareRows.map((row) => (
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

        {/* Help you choose */}
        <section className="prog-choose shell">
          <div className="section-heading center reveal">
            <p className="eyebrow">Not Sure Which Program Is Right For You?</p>
            <h2>{data.chooseHeading}</h2>
          </div>
          <div className="choose-grid">
            {data.chooseItems.map((c, i) => (
              <article key={c.choose} className="choose-card reveal" style={{ transitionDelay: `${i * 70}ms`, ['--accent' as string]: c.accent }}>
                <p>{c.prompt}</p>
                <span className="choose-label">Choose</span>
                <strong>{c.choose}</strong>
              </article>
            ))}
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
                  Book a <strong>FREE 1-on-1 {data.exam} Consultation</strong> with our expert counselors.
                  We'll assess your level, understand your goals, and recommend the best learning path for you.
                </p>
              </div>
              <div className="prog-cta-actions">
                <a className="btn btn-primary" href={CONSULT_HREF}>Book Free Consultation <span aria-hidden="true">-&gt;</span></a>
                <a className="btn btn-outline" href={CONSULT_HREF}>Talk to an Expert</a>
              </div>
            </div>
            <div className="prog-stats">
              {data.stats.map((s) => (
                <div key={s.label}>
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-top shell">
          {/* Brand column */}
          <div className="footer-brand-col">
            <Brand />
            <p className="footer-desc">
              ACT SAT GO offers expert guidance and resources to help students excel in their ACT | SAT | AP | and other academic courses. Join our community and unlock your potential with tailored learning strategies and comprehensive support.
            </p>
            {/* Social Media Links */}
            <div className="footer-social">
              <a href="https://www.facebook.com/actsatgousa" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="https://www.instagram.com/act_sat_go" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href="https://www.youtube.com/@ACTSATGOTutoring" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#04111f"/></svg>
              </a>
              <a href="https://www.linkedin.com/company/act-sat-go/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
            </div>
          </div>

          {/* Courses */}
          <div className="footer-col">
            <h4 className="footer-heading">Courses</h4>
            <ul className="footer-links">
              <li><a href="/act">ACT</a></li>
              <li><a href="/sat">SAT</a></li>
              <li><a href="/ap">AP</a></li>
              <li><a href="/#programs">Elementary School</a></li>
              <li><a href="/#programs">Middle School</a></li>
              <li><a href="/#programs">High School</a></li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="footer-col">
            <h4 className="footer-heading">Quick Links</h4>
            <ul className="footer-links">
              <li><a href="/#home">Home</a></li>
              <li><a href="/#about">About Us</a></li>
              <li><a href="/#programs">Courses</a></li>
              <li><a href="/#programs">Career</a></li>
              <li><a href="/#resources">Blogs</a></li>
              <li><a href="/#consultation">Contact</a></li>
            </ul>
          </div>

          {/* Get In Touch */}
          <div className="footer-col">
            <h4 className="footer-heading">Get In Touch</h4>
            <ul className="footer-contact">
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.61 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <a href="tel:+13322314081">+1 (332) 231-4081</a>
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <a href="mailto:info@actsatgo.com">info@actsatgo.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom shell">
          <p>&copy; {new Date().getFullYear()} ACT SAT GO. All rights reserved.</p>
          <p>Designed for students who aim higher.</p>
        </div>
      </footer>
    </>
  );
}
