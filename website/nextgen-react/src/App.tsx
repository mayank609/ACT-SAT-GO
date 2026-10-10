import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Testimonials } from './components/Testimonials';
import { Universities } from './components/Universities';
import { ProgramsHub } from './components/ProgramsHub';
import { CountUp } from './components/CountUp';
import { useScrollReveal } from './hooks/useScrollReveal';
import { ACT_PAGE } from './data/programs';
import heroImg from './assets/img/hero-y1.webp';
import avatar1 from './assets/img/avatar1.webp';
import avatar2 from './assets/img/avatar2.webp';
import avatar3 from './assets/img/avatar3.webp';
import avatar4 from './assets/img/avatar4.webp';
import { QUERY_API_BASE } from './config';
import { trackLead, leadSource, trackContactClick } from './lib/analytics';
import { SITE, STATS, PRIMARY_CTA, SECONDARY_CTA } from './site';
import { PainPoints } from './components/PainPoints';
import { HowItWorks } from './components/HowItWorks';
import { FaqSection } from './components/FaqSection';
import { TutorCards } from './components/TutorCards';
import { HOME_FAQ } from './data/faq';

// useLayoutEffect warns during prerendering; fall back to useEffect on the server.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
import { IconGlobe, IconUser, IconUsers, IconHeartCheck, IconGraduationCap, IconChart, IconDocument, IconClipboardCheck, IconLink, IconRoute, IconMonitor, IconFlag, IconNetwork, IconTrophy } from './components/Icons';


export default function App() {
  useScrollReveal();

  const tableRef = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    function adjustHeights() {
      if (!tableRef.current) return;
      const othersCol = tableRef.current.querySelector('.compare-col-others');
      const asgCol = tableRef.current.querySelector('.compare-col-asg');
      if (!othersCol || !asgCol) return;

      const othersCells = othersCol.querySelectorAll('.compare-cell') as NodeListOf<HTMLElement>;
      const asgCells = asgCol.querySelectorAll('.compare-cell') as NodeListOf<HTMLElement>;

      // Reset heights first
      othersCells.forEach(cell => cell.style.height = 'auto');
      asgCells.forEach(cell => cell.style.height = 'auto');

      // Only adjust heights if screen is desktop/tablet (not stacked vertically on mobile)
      if (window.innerWidth > 640) {
        const count = Math.min(othersCells.length, asgCells.length);
        for (let i = 0; i < count; i++) {
          const othersHeight = othersCells[i].getBoundingClientRect().height;
          const asgHeight = asgCells[i].getBoundingClientRect().height;
          const maxHeight = Math.max(othersHeight, asgHeight);
          othersCells[i].style.height = `${maxHeight}px`;
          asgCells[i].style.height = `${maxHeight}px`;
        }
      }
    }

    adjustHeights();

    // Re-run after images/layouts settle
    const timer = setTimeout(adjustHeights, 200);

    window.addEventListener('resize', adjustHeights);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', adjustHeights);
    };
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', exam: 'General', message: '' });
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [phoneLocalNumber, setPhoneLocalNumber] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const openConsultationModal = (defaultExam = 'General') => {
    setFormData({ name: '', email: '', phone: '', exam: defaultExam, message: '' });
    setPhoneCountryCode('+1');
    setPhoneLocalNumber('');
    setSubmitStatus('idle');
    setIsModalOpen(true);
    document.body.classList.add('modal-open-body');
  };

  const closeConsultationModal = () => {
    setIsModalOpen(false);
    document.body.classList.remove('modal-open-body');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim()) return;

    setSubmitStatus('submitting');
    try {
      const response = await fetch(`${QUERY_API_BASE}/api/queries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          phone: `${phoneCountryCode} ${phoneLocalNumber}`.trim(),
          type: 'Consultation',
          source: leadSource('Website · Home modal'),
        })
      });

      if (response.ok) {
        setSubmitStatus('success');
        trackLead('home_modal', { exam: formData.exam });
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error submitting query:', error);
      setSubmitStatus('error');
    }
  };

  return (
    <>
      <Header />

      <main>
        {/* Hero */}
        <section className="hero section-dark" id="home">
          <span className="orb orb-gold" aria-hidden="true" />
          <div className="shell hero-grid">
            <div className="hero-copy">
              <h1>1-on-1 Digital SAT &amp; ACT tutoring that raises scores — <span>with a plan you can see every week.</span></h1>
              <p className="hero-text">Expert tutors, a diagnostic before the first lesson, homework after every session and a weekly progress report for parents. Live online, scheduled around your family&rsquo;s time zone.</p>

              <div className="hero-actions-new">
                <a className="btn btn-primary" href="/consultation" onClick={(e) => { e.preventDefault(); openConsultationModal('General'); }}>
                  {PRIMARY_CTA} <span aria-hidden="true">→</span>
                </a>
                <Link className="btn btn-secondary" to="/free-test" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {SECONDARY_CTA}
                </Link>
              </div>

              <div className="hero-trust">
                <div className="hero-avatars">
                  <img src={avatar1} alt="" width="40" height="40" />
                  <img src={avatar2} alt="" width="40" height="40" />
                  <img src={avatar3} alt="" width="40" height="40" />
                  <img src={avatar4} alt="" width="40" height="40" />
                </div>
                <div>
                  <div className="stars">★★★★★</div>
                  <p>Rated {STATS.rating} · Trusted by {STATS.students} students and parents worldwide</p>
                </div>
              </div>
            </div>

            <div className="hero-art">
              {/* Background artwork decorations */}
              <div className="hero-decorations" aria-hidden="true">
                {/* Dotted globe wireframe background */}
                <svg className="globe-bg" viewBox="0 0 400 400" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1.2">
                  <circle cx="200" cy="200" r="160" />
                  <path d="M200,40 A200,160 0 0,0 200,360" />
                  <path d="M200,40 A200,160 0 0,1 200,360" />
                  <path d="M200,40 A80,160 0 0,0 200,360" />
                  <path d="M200,40 A80,160 0 0,1 200,360" />
                  <line x1="200" y1="40" x2="200" y2="360" />
                  <line x1="40" y1="200" x2="360" y2="200" />
                  <path d="M70,100 Q200,140 330,100" />
                  <path d="M70,300 Q200,260 330,300" />
                </svg>
              </div>

              <img src={heroImg} alt="Student in a live 1-on-1 online tutoring session" width="1200" height="952" {...{ fetchpriority: 'high' }} />

              {/* Concepts Made Simple check badge */}
              <div className="floating-card card-concepts-new">
                <span className="concepts-check-new" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <div>
                  <span className="concept-title">Concepts</span>
                  <span className="concept-sub">Made Simple</span>
                </div>
              </div>

              {/* Score Improvement chart card */}
              <div className="floating-card card-score-new">
                <span className="score-title">Weekly Progress Report</span>
                <span className="score-value">For Parents</span>
                <svg className="score-chart" viewBox="0 0 160 50">
                  <path
                    d="M10,40 Q35,28 60,32 T110,22 L150,8"
                    fill="none"
                    stroke="var(--gold)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="10" cy="40" r="3.5" fill="var(--gold)" />
                  <circle cx="35" cy="28" r="3.5" fill="var(--gold)" />
                  <circle cx="60" cy="32" r="3.5" fill="var(--gold)" />
                  <circle cx="85" cy="25" r="3.5" fill="var(--gold)" />
                  <circle cx="110" cy="22" r="3.5" fill="var(--gold)" />
                  <circle cx="150" cy="8" r="4.5" fill="var(--gold)" />
                </svg>
              </div>

              {/* Exam tag stack */}
              <div className="floating-card card-exams-new">
                <span className="exam-tag active">SAT</span>
                <span className="exam-tag active">ACT</span>
                <span className="exam-tag">AP</span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Band — Why ASG (bars only, no heading) */}
        <section className="stats-band shell" aria-label="Impact statistics">
          <div className="stats-band-reach">
            <span className="stat-icon" aria-hidden="true"><IconGlobe /></span>
            <div className="stat-text">
              <strong>Students Across</strong>
              <span>USA · Canada · India · UAE · Singapore · UK</span>
            </div>
          </div>
          <div>
            <span className="stat-icon" aria-hidden="true"><IconUser /></span>
            <div className="stat-text"><CountUp value={STATS.students} /><span>Students Mentored</span></div>
          </div>
          <div>
            <span className="stat-icon" aria-hidden="true"><IconUsers /></span>
            <div className="stat-text"><CountUp value={STATS.tutors} /><span>Expert Tutors</span></div>
          </div>
          <div>
            <span className="stat-icon" aria-hidden="true"><IconHeartCheck /></span>
            <div className="stat-text"><CountUp value={STATS.satisfaction} /><span>Parent Satisfaction</span></div>
          </div>
          <div>
            <span className="stat-icon" aria-hidden="true"><IconGlobe /></span>
            <div className="stat-text"><CountUp value={STATS.countries} /><span>Countries Reached</span></div>
          </div>
        </section>

        <PainPoints />

        {/* What changes for your child */}
        <section className="features shell" id="about">
          <article>
            <span className="icon"><IconUsers /></span>
            <h3>A plan built around your test date</h3>
            <p>From diagnostic to test day, every week is planned around your child&rsquo;s target score.</p>
          </article>
          <article>
            <span className="icon"><IconGraduationCap /></span>
            <h3>A specialist tutor, not a generalist</h3>
            <p>Every student is matched with a tutor for their exact test or AP course &mdash; selected, trained and reviewed by our academic team.</p>
          </article>
          <article>
            <span className="icon"><IconChart /></span>
            <h3>Weekly progress reports for parents</h3>
            <p>See scores, completed homework and what the next sessions will focus on &mdash; no guessing whether it&rsquo;s working.</p>
          </article>
          <article>
            <span className="icon"><IconDocument /></span>
            <h3>25+ full-length Digital SAT practice tests</h3>
            <p>With a score report after each one, so you can see the trend, not just a single number.</p>
          </article>
          <article>
            <span className="icon"><IconClipboardCheck /></span>
            <h3>Homework after every session</h3>
            <p>Reviewed before the next lesson, with practice sets built from your child&rsquo;s own mistakes &mdash; so no hour is wasted re-teaching.</p>
          </article>
        </section>

        <ProgramsHub />

        {/* Free Demo Test Callout Banner */}
        <section className="shell" style={{ margin: '48px auto' }}>
          <div style={{
            background: 'linear-gradient(135deg, #06172a 0%, #0d2c54 50%, #06172a 100%)',
            borderRadius: '24px',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            padding: '36px 32px',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ maxWidth: '600px', zIndex: 1 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '9999px',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid rgba(56, 189, 248, 0.3)',
                marginBottom: '12px'
              }}>
                FREE PRACTICE TEST
              </div>
              <h3 style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', lineHeight: 1.2, margin: '0 0 10px 0' }}>
                Not ready to talk to anyone yet? Take a free practice test first.
              </h3>
              <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                Sit one timed SAT or ACT practice test in our real exam interface and get your scaled score with section, topic and question-level analytics. No card, no sales call.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '220px', zIndex: 1 }}>
              <Link to="/free-test?exam=SAT" className="btn btn-secondary" style={{ textAlign: 'center', fontWeight: 700 }}>
                Free SAT Practice Test →
              </Link>
              <Link to="/free-test?exam=ACT" className="btn btn-outline" style={{ textAlign: 'center', borderColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }}>
                Free ACT Practice Test →
              </Link>
            </div>
          </div>
        </section>

        <section className="cta-section shell">
          <div className="process-cta">
            <span className="process-cta-dots process-cta-dots-tr" aria-hidden="true" />
            <span className="process-cta-dots process-cta-dots-bl" aria-hidden="true" />
            <div>
              <h3>
                <span className="cta-line">Every step is <em>personalized.</em></span>
                <span className="cta-line">Every action is <em>guided.</em></span>
                <span className="cta-line">Every goal is <em>achievable.</em></span>
              </h3>
              <a className="btn btn-primary" href="/consultation" onClick={(e) => { e.preventDefault(); openConsultationModal('General'); }}>
                {PRIMARY_CTA} <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="cta-graphic" aria-hidden="true">
              <svg viewBox="0 0 260 170" width="100%" height="100%">
                <defs>
                  <linearGradient id="ctaGoldBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffe29a" />
                    <stop offset="45%" stopColor="#f2a92e" />
                    <stop offset="100%" stopColor="#b9781a" />
                  </linearGradient>
                  <radialGradient id="ctaRingGold" cx="35%" cy="30%" r="75%">
                    <stop offset="0%" stopColor="#ffe9ae" />
                    <stop offset="55%" stopColor="#efa62e" />
                    <stop offset="100%" stopColor="#a8690f" />
                  </radialGradient>
                  <radialGradient id="ctaRingCream" cx="35%" cy="30%" r="75%">
                    <stop offset="0%" stopColor="#fff6e2" />
                    <stop offset="100%" stopColor="#f2ddb2" />
                  </radialGradient>
                  <linearGradient id="ctaArrow" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffe29a" />
                    <stop offset="100%" stopColor="#b9781a" />
                  </linearGradient>
                  <radialGradient id="ctaGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffb400" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#ffb400" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* ambient rings */}
                <circle cx="205" cy="70" r="88" fill="none" stroke="#ffffff" strokeOpacity="0.06" />
                <circle cx="205" cy="70" r="68" fill="none" stroke="#ffffff" strokeOpacity="0.08" />

                {/* ground glow */}
                <ellipse cx="150" cy="146" rx="105" ry="14" fill="url(#ctaGlow)" />

                {/* bars */}
                <rect x="6" y="108" width="18" height="26" rx="4" fill="url(#ctaGoldBar)" opacity="0.7" />
                <rect x="30" y="94" width="18" height="40" rx="4" fill="url(#ctaGoldBar)" opacity="0.8" />
                <rect x="54" y="78" width="18" height="56" rx="4" fill="url(#ctaGoldBar)" opacity="0.88" />
                <rect x="78" y="60" width="18" height="74" rx="4" fill="url(#ctaGoldBar)" opacity="0.94" />
                <rect x="102" y="40" width="18" height="94" rx="4" fill="url(#ctaGoldBar)" />
                <rect x="126" y="18" width="18" height="116" rx="4" fill="url(#ctaGoldBar)" />

                {/* target */}
                <circle cx="205" cy="70" r="54" fill="none" stroke="#06172a" strokeOpacity="0.5" strokeWidth="2" />
                <circle cx="205" cy="70" r="51" fill="url(#ctaRingGold)" />
                <circle cx="205" cy="70" r="40" fill="url(#ctaRingCream)" />
                <circle cx="205" cy="70" r="29" fill="url(#ctaRingGold)" />
                <circle cx="205" cy="70" r="18" fill="url(#ctaRingCream)" />
                <circle cx="205" cy="70" r="7" fill="#c9860f" />

                {/* arrow — rises from the bars and bursts through the target */}
                <path d="M162 113 150 117M162 113 158 101" stroke="url(#ctaArrow)" strokeWidth="4.5" strokeLinecap="round" />
                <line x1="162" y1="113" x2="238" y2="33" stroke="url(#ctaArrow)" strokeWidth="5.5" strokeLinecap="round" />
                <path d="M252 23 236 29 246 39Z" fill="url(#ctaArrow)" />
              </svg>
            </div>
          </div>
        </section>

        {/* Our Personalized Learning Process (7 steps) */}
        <section className="process section-light" id="process">
          <div className="shell">
            <div className="section-heading">
              <h2>Our Personalized Learning Process</h2>
              <p>A proven 7-step journey to help every student succeed.</p>
            </div>
            <div className="process-flow">
              {[
                { n: '01', title: 'Understand', text: 'We learn about your goals & challenges.', icon: <IconLink /> },
                { n: '02', title: 'Assess', text: 'Diagnostic tests to analyze strengths & weaknesses.', icon: <IconDocument /> },
                { n: '03', title: 'Plan', text: 'We create a custom learning roadmap just for you.', icon: <IconRoute /> },
                { n: '04', title: 'Learn', text: 'Live classes, practice & resources with expert guidance.', icon: <IconMonitor /> },
                { n: '05', title: 'Track', text: 'Weekly progress reports with section-by-section analytics.', icon: <IconFlag /> },
                { n: '06', title: 'Improve', text: 'Continuous feedback & data insights for continuous improvement.', icon: <IconNetwork /> },
                { n: '07', title: 'Achieve', text: 'Reach your target score & unlock your future.', icon: <IconTrophy /> },
              ].map((s, i) => (
                <article key={s.n} className="process-step reveal" style={{ transitionDelay: `${i * 60}ms` }}>
                  <span className="process-icon" aria-hidden="true">{s.icon}</span>
                  <span className="process-num">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Success Stories */}
        <section className="success shell" id="results">
          <div className="success-heading-row">
            <div className="section-heading">
              <h2>Success Stories</h2>
              <p>Real students. Real results.</p>
            </div>
            <a className="view-all-link" href="#testimonials">Read parent &amp; student reviews <span aria-hidden="true">→</span></a>
          </div>
          <div className="story-grid">
            <article><div className="portrait">A</div><h3>Ananya K.</h3><span className="exam-type">SAT Score</span><strong>1540 / 1600</strong><p>+230 points improvement</p><span>University of Michigan</span></article>
            <article><div className="portrait">R</div><h3>Rohan S.</h3><span className="exam-type">ACT Score</span><strong>33 / 36</strong><p>+6 points improvement</p><span>Georgia Tech</span></article>
            <article><div className="portrait">M</div><h3>Meera P.</h3><span className="exam-type">AP Score</span><strong>5 / 5</strong><p>AP Calculus BC</p><span>Stanford University</span></article>
            <article><div className="portrait">A</div><h3>Arjun D.</h3><span className="exam-type">SAT Score</span><strong>1510 / 1600</strong><p>+210 points improvement</p><span>UC Berkeley</span></article>
          </div>
          <p className="uni-strip-label">Our students have been accepted to top universities worldwide.</p>
          <Universities />
        </section>

        <TutorCards />

        {/* Why Families Choose ASG — Comparison Table */}
        <section className="comparison shell" id="why-us">
          <div className="section-heading center" style={{ gridColumn: '1 / -1', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '32px', color: '#000000', fontWeight: 800, textAlign: 'center' }}>Why Families Choose ACT SAT GO</h2>
          </div>
          <aside className="note-card-new">
            <p className="note-card-text">
              We don't just<br />
              <strong>teach.</strong>
            </p>
            <p className="note-card-text">
              We transform<br />
              <strong>potential into</strong><br />
              <strong>performance.</strong>
            </p>
            <div className="note-card-check-orange">✓</div>
          </aside>
          {(() => {
            const COMPARE_ROWS = [
              { others: 'One-size-fits-all approach', asg: 'Personalized learning for every student' },
              { others: 'Focus only on tutoring', asg: 'End-to-end academic success partner' },
              { others: 'Limited performance insights', asg: 'Weekly parent reports with section-level analytics' },
              { others: 'Doubt support with limits', asg: 'Unlimited doubt solving & mentor support' },
              { others: 'Minimal parent communication', asg: 'Weekly reports & regular PTMs' },
              { others: 'Disconnected tools & platforms', asg: 'All-in-one learning ecosystem' },
            ];
            return (
              <div ref={tableRef} className="compare-table-new" role="table" aria-label="ACT SAT GO comparison">
                <div className="compare-col compare-col-others" role="rowgroup">
                  <div className="compare-cell compare-head col-others" role="columnheader">OTHERS</div>
                  {COMPARE_ROWS.map((r) => (
                    <div key={r.others} className="compare-cell col-others-val" role="cell">{r.others}</div>
                  ))}
                </div>
                <div className="compare-col compare-col-asg" role="rowgroup">
                  <div className="compare-cell compare-head col-asg" role="columnheader">
                    <svg className="asg-triangle-logo" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 3 21 20 3 20" />
                    </svg>
                    ACT SAT GO
                  </div>
                  {COMPARE_ROWS.map((r) => (
                    <div key={r.asg} className="compare-cell col-asg-val" role="cell">{r.asg}</div>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>


        {/* What Our Students & Parents Say — Testimonials */}
        <Testimonials />

        <HowItWorks />

        <FaqSection items={HOME_FAQ} />

        {/* CTA + Stats */}
        <section className="prog-cta section-dark" id="consultation">
          <span className="orb orb-gold" aria-hidden="true" />
          <div className="shell">
            <div className="prog-cta-banner">
              <div>
                <h2>Ready to Achieve Your Dream Score?</h2>
                <p>
                  Book a <strong>free diagnostic lesson</strong>: your child gets a baseline score, you get a clear plan for the
                  target score and test date. No payment, no obligation.
                </p>
              </div>
              <div className="prog-cta-actions">
                <a className="btn btn-primary" href="/consultation" onClick={(e) => { e.preventDefault(); openConsultationModal('General'); }}>
                  {PRIMARY_CTA} <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
            <div className="prog-stats">
              {ACT_PAGE.stats.map((s, idx) => (
                <div key={s.label}>
                  {[
                    <svg key="1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: 'var(--gold)' }}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path><path d="M12 2a6 6 0 0 1 6 6v3.5c0 3.3-2.7 6-6 6s-6-2.7-6-6V8a6 6 0 0 1 6-6z"></path></svg>,
                    <svg key="2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: 'var(--gold)' }}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>,
                    <svg key="3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: 'var(--gold)' }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>,
                    <svg key="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px', color: 'var(--gold)' }}><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>,
                  ][idx]}
                  <strong style={{ marginTop: '8px' }}>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Consultation Request Modal */}
      <div className={`c-modal-overlay${isModalOpen ? ' is-active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) closeConsultationModal(); }}>
        <div className="c-modal">
          <button className="c-modal-close" onClick={closeConsultationModal}>&times;</button>

          {submitStatus === 'success' ? (
            <div className="c-success-state">
              <div className="c-success-icon">✓</div>
              <h4>Request received!</h4>
              <p>Thank you. An academic advisor from ACT SAT GO will contact you shortly to schedule your free diagnostic lesson.</p>
              {SITE.bookingUrl && (
                <p><a href={SITE.bookingUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackContactClick('booking')} style={{ color: 'var(--gold)', fontWeight: 800 }}>Prefer to pick a time yourself? Open the calendar →</a></p>
              )}
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={closeConsultationModal}>Close</button>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit}>
              <div className="c-modal-header">
                <h3>{PRIMARY_CTA}</h3>
                <p>Tell us a little about your child. An advisor will confirm a time &mdash; no payment, no obligation.</p>
              </div>

              <div className="c-form-group">
                <label htmlFor="modal-name">Parent or student name</label>
                <input
                  id="modal-name"
                  type="text"
                  className="c-input"
                  placeholder="e.g. Ananya Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="c-form-group">
                <label htmlFor="modal-email">Email Address</label>
                <input
                  id="modal-email"
                  type="email"
                  className="c-input"
                  placeholder="e.g. ananya@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="c-form-group">
                <label htmlFor="modal-phone">Phone Number</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="c-input"
                    style={{ width: '110px', padding: '0 8px', backgroundColor: '#0d1b31', color: 'white' }}
                    value={phoneCountryCode}
                    onChange={(e) => setPhoneCountryCode(e.target.value)}
                  >
                    <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+1">+1 (US)</option>
                    <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+91">+91 (IN)</option>
                    <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+44">+44 (UK)</option>
                    <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+971">+971 (AE)</option>
                    <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+65">+65 (SG)</option>
                    <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+61">+61 (AU)</option>
                    <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+966">+966 (SA)</option>
                    <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+974">+974 (QA)</option>
                    <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+968">+968 (OM)</option>
                    <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+965">+965 (KW)</option>
                    <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+973">+973 (BH)</option>
                    <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+852">+852 (HK)</option>
                  </select>
                  <input
                    id="modal-phone"
                    type="tel"
                    className="c-input"
                    style={{ flex: 1 }}
                    placeholder="555 123 4567"
                    value={phoneLocalNumber}
                    onChange={(e) => setPhoneLocalNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="c-form-group">
                <label htmlFor="modal-exam">Exam / Program Interest</label>
                <select
                  id="modal-exam"
                  className="c-input"
                  value={formData.exam}
                  onChange={(e) => setFormData({ ...formData, exam: e.target.value })}
                >
                  <option value="General">General / Other</option>
                  <option value="SAT">SAT Prep</option>
                  <option value="ACT">ACT Prep</option>
                  <option value="AP Prep">AP Prep</option>
                  <option value="K-12 Tutoring">K-12 Tutoring</option>
                </select>
              </div>

              <div className="c-form-group">
                <label htmlFor="modal-message">Target score and test date (optional)</label>
                <textarea
                  id="modal-message"
                  className="c-input c-textarea"
                  placeholder="e.g. Aiming for 1450+ on the March SAT, currently around 1250"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>

              {submitStatus === 'error' && (
                <p style={{ color: '#ef4444', fontSize: '13px', margin: '8px 0', fontWeight: 600 }}>
                  ✕ Sorry, something went wrong. Please try again, or text us on WhatsApp.
                </p>
              )}

              <button
                type="submit"
                className="c-submit-btn"
                disabled={submitStatus === 'submitting'}
              >
                {submitStatus === 'submitting' ? 'Submitting...' : PRIMARY_CTA}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
