import { useEffect } from 'react';
import { Header } from '../components/Header';
import { Brand } from '../components/Brand';
import { useScrollReveal } from '../hooks/useScrollReveal';
import type { ProgramPageData } from '../data/programs';

const CONSULT_HREF = '/#consultation';

export function ProgramPage({ data }: { data: ProgramPageData }) {
  useScrollReveal();

  // Each program page should open at the top and carry a descriptive title.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${data.exam} Preparation — ACT SAT GO`;
  }, [data.exam]);

  return (
    <>
      <Header />

      <main>
        {/* Hero */}
        <section className="prog-hero section-dark">
          <span className="orb orb-gold" aria-hidden="true" />
          <span className="orb orb-ring" aria-hidden="true" />
          <div className="shell prog-hero-grid">
            <div className="prog-hero-copy">
              <p className="eyebrow">{data.heroEyebrow}</p>
              <h1>
                {data.heroTitle.map((run, i) =>
                  run.gold ? <span key={i}>{run.text}</span> : <span key={i} className="plain">{run.text}</span>,
                )}
              </h1>
              <p className="hero-text">{data.heroText}</p>
              <div className="hero-actions">
                <a className="btn btn-primary" href="#programs">{data.primaryCta} <span aria-hidden="true">-&gt;</span></a>
                <a className="btn btn-outline" href={CONSULT_HREF}>{data.secondaryCta} <span aria-hidden="true">↓</span></a>
              </div>
              <ul className="prog-hero-bullets">
                {data.heroBullets.map((b) => (
                  <li key={b.title}>
                    <strong>{b.title}</strong>
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="prog-hero-art" aria-hidden="true">
              <div className="exam-orb"><span>{data.exam}</span></div>
              <div className="orbit-badge badge-1">Smart Strategy</div>
              <div className="orbit-badge badge-2">Target Score</div>
              <div className="orbit-badge badge-3">Track Progress</div>
              <div className="orbit-badge badge-4">Achieve Success</div>
            </div>
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
        <div className="shell">
          <Brand />
          <p>Premium academic coaching for SAT, ACT, AP, and K-12 learners.</p>
        </div>
      </footer>
    </>
  );
}
