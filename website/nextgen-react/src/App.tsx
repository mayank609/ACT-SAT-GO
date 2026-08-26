import { useState, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Header } from './components/Header';
import { Brand } from './components/Brand';
import { Testimonials } from './components/Testimonials';
import { Universities } from './components/Universities';
import { ProgramsHub } from './components/ProgramsHub';
import { CountUp } from './components/CountUp';
import { useScrollReveal } from './hooks/useScrollReveal';
import { ACT_PAGE } from './data/programs';
import heroImg from './assets/hero-y1.png';
import avatar1 from './assets/avatar1.png';
import avatar2 from './assets/avatar2.png';
import avatar3 from './assets/avatar3.png';
import avatar4 from './assets/avatar4.png';
import { QUERY_API_BASE } from './config';
import { trackLead } from './lib/metaPixel';
import { IconGlobe, IconUser, IconUsers, IconHeartCheck, IconGraduationCap, IconChart, IconDocument, IconClipboardCheck, IconLink, IconRoute, IconMonitor, IconFlag, IconNetwork, IconTrophy } from './components/Icons';


export default function App() {
  useScrollReveal();

  const tableRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
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
          type: 'Consultation'
        })
      });

      if (response.ok) {
        setSubmitStatus('success');
        trackLead();
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
              <span className="eyebrow-hero"></span>
              <h1>The Right Guidance.<br />The Right Plan.<br /><span>The Right Future.</span></h1>
              <p className="hero-text">Personalized online tutoring for SAT, ACT, AP and K-12 students designed to unlock potential and achieve real results.</p>

              <div className="hero-actions-new">
                <a className="btn btn-primary" href="#consultation" onClick={(e) => { e.preventDefault(); openConsultationModal('General'); }}>
                  Book Free Consultation <span aria-hidden="true">→</span>
                </a>
                <a className="btn btn-outline" href="#programs">Explore Programs</a>
              </div>

              <div className="hero-trust">
                <div className="hero-avatars">
                  <img src={avatar1} alt="Student avatar 1" />
                  <img src={avatar2} alt="Student avatar 2" />
                  <img src={avatar3} alt="Student avatar 3" />
                  <img src={avatar4} alt="Student avatar 4" />
                </div>
                <div>
                  <div className="stars">★★★★★</div>
                  <p>Trusted by 5,000+ students and parents worldwide</p>
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

              <img src={heroImg} alt="Students studying online with tutoring support" />

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
                <span className="score-title">Score Improvement</span>
                <span className="score-value">+230 Points</span>
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
            <div className="stat-text"><CountUp value="5,000+" /><span>Students Mentored</span></div>
          </div>
          <div>
            <span className="stat-icon" aria-hidden="true"><IconUsers /></span>
            <div className="stat-text"><CountUp value="300+" /><span>Expert Tutors</span></div>
          </div>
          <div>
            <span className="stat-icon" aria-hidden="true"><IconHeartCheck /></span>
            <div className="stat-text"><CountUp value="98%" /><span>Parent Satisfaction</span></div>
          </div>
          <div>
            <span className="stat-icon" aria-hidden="true"><IconGlobe /></span>
            <div className="stat-text"><CountUp value="50+" /><span>Countries Reached</span></div>
          </div>
        </section>

        {/* Every Step is Personalised */}
        <section className="features shell" id="about">
          <article>
            <span className="icon"><IconUsers /></span>
            <h3>Personalized One-to-One Learning</h3>
            <p>Each roadmap is built around goals, diagnostics, pace, and learning style.</p>
          </article>
          <article>
            <span className="icon"><IconGraduationCap /></span>
            <h3>Expert Mentors from Top Universities</h3>
            <p>Work with skilled tutors from top academic backgrounds and exam tracks.</p>
          </article>
          <article>
            <span className="icon"><IconChart /></span>
            <h3>Data-Driven Progress Tracking</h3>
            <p>Progress analytics reveal strengths, gaps, and next-best actions.</p>
          </article>
          <article>
            <span className="icon"><IconDocument /></span>
            <h3>Proven Strategies &amp; Study Plans</h3>
            <p>Battle-tested methods for every exam section, structured for consistent score gains.</p>
          </article>
          <article>
            <span className="icon"><IconClipboardCheck /></span>
            <h3>Beyond Classes Complete Support Ecosystem</h3>
            <p>Doubt support, parent updates, and resources keep momentum alive.</p>
          </article>
        </section>

        <ProgramsHub />

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
              <a className="btn btn-primary" href="#consultation" onClick={(e) => { e.preventDefault(); openConsultationModal('General'); }}>
                Book Free Consultation <span aria-hidden="true">→</span>
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
                { n: '05', title: 'Track', text: 'AI-driven tracking of progress and performance.', icon: <IconFlag /> },
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
            <a className="view-all-link" href="#results">View all stories <span aria-hidden="true">→</span></a>
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
              { others: 'Limited performance insights', asg: 'AI-powered progress analytics' },
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

        {/* CTA + Stats */}
        <section className="prog-cta section-dark" id="consultation">
          <span className="orb orb-gold" aria-hidden="true" />
          <div className="shell">
            <div className="prog-cta-banner">
              <div>
                <h2>Ready to Achieve Your Dream Score?</h2>
                <p>
                  Book a <strong>free consultation</strong> with our experts and take the first step toward your goals.
                  We will assess your level, understand your goals, and recommend the best learning path for you.
                </p>
              </div>
              <div className="prog-cta-actions">
                <a className="btn btn-primary" href="#consultation" onClick={(e) => { e.preventDefault(); openConsultationModal('General'); }}>
                  Book Free Consultation <span aria-hidden="true">-&gt;</span>
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
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
              </a>
              <a href="https://www.instagram.com/act_sat_go" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
              </a>
              <a href="https://www.youtube.com/@ACTSATGOTutoring" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" /><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#04111f" /></svg>
              </a>
              <a href="https://www.linkedin.com/company/act-sat-go/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>
              </a>
              <a href="https://g.page/r/CaMyM5bggIx1EBM/review" target="_blank" rel="noopener noreferrer" aria-label="Google Reviews">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Courses */}
          <div className="footer-col">
            <h4 className="footer-heading">Courses</h4>
            <ul className="footer-links">
              <li><Link to="/act">ACT</Link></li>
              <li><Link to="/sat">SAT</Link></li>
              <li><Link to="/ap">AP</Link></li>
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
              <li><Link to="/about-us">About Us</Link></li>
              <li><a href="/#programs">Courses</a></li>
              <li><a href="/#programs">Career</a></li>
              <li><a href="/#resources">Blogs</a></li>
              <li><a href="/consultation">Contact</a></li>
            </ul>
          </div>

          {/* Get In Touch */}
          <div className="footer-col">
            <h4 className="footer-heading">Get In Touch</h4>
            <ul className="footer-contact">
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.61 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                <a href="tel:+13322314081">+91 80855 59439</a>
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
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

      {/* Consultation Request Modal */}
      <div className={`c-modal-overlay${isModalOpen ? ' is-active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) closeConsultationModal(); }}>
        <div className="c-modal">
          <button className="c-modal-close" onClick={closeConsultationModal}>&times;</button>

          {submitStatus === 'success' ? (
            <div className="c-success-state">
              <div className="c-success-icon">✓</div>
              <h4>Consultation Booked!</h4>
              <p>Thank you for reaching out. An expert academic counselor from ACT SAT GO will contact you shortly.</p>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={closeConsultationModal}>Close</button>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit}>
              <div className="c-modal-header">
                <h3>Book Free Consultation</h3>
                <p>Submit your goals and our experts will design a customized learning roadmap.</p>
              </div>

              <div className="c-form-group">
                <label htmlFor="modal-name">Full Name</label>
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
                <label htmlFor="modal-message">Tell us about your learning goals</label>
                <textarea
                  id="modal-message"
                  className="c-input c-textarea"
                  placeholder="e.g. Target SAT score is 1500+, looking for 1-on-1 tutoring..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>

              {submitStatus === 'error' && (
                <p style={{ color: '#ef4444', fontSize: '13px', margin: '8px 0', fontWeight: 600 }}>
                  ✕ Unable to submit form. Please check if the query server is running.
                </p>
              )}

              <button
                type="submit"
                className="c-submit-btn"
                disabled={submitStatus === 'submitting'}
              >
                {submitStatus === 'submitting' ? 'Submitting...' : 'Book Free Consultation'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
