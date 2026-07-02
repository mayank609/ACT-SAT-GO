import { useState } from 'react';
import { Header } from './components/Header';
import { Brand } from './components/Brand';
import { Testimonials } from './components/Testimonials';
import { Universities } from './components/Universities';
import { Programs } from './components/Programs';
import { useScrollReveal } from './hooks/useScrollReveal';
import { ACT_PAGE } from './data/programs';
import heroImg from './assets/hero.png';
import { QUERY_API_BASE } from './config';
import { IconGlobe, IconUser, IconUsers, IconHeartCheck, IconGraduationCap, IconChart, IconDocument, IconClipboardCheck } from './components/Icons';


export default function App() {
  useScrollReveal();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', exam: 'General', message: '' });
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const openConsultationModal = (defaultExam = 'General') => {
    setFormData({ name: '', email: '', phone: '', exam: defaultExam, message: '' });
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
          type: 'Consultation'
        })
      });

      if (response.ok) {
        setSubmitStatus('success');
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
          <span className="orb orb-ring" aria-hidden="true" />
          <span className="orb orb-dot" aria-hidden="true" />
          <div className="shell hero-grid">
            <div className="hero-copy">
              <span className="eyebrow-hero">SAT · ACT · AP · K-12 TUTORING</span>
              <h1>The Right Guidance.<br />The Right Plan.<br /><span>The Right Future.</span></h1>
              <p className="hero-text">Personalized online tutoring for SAT, ACT, AP and K-12 students designed to unlock potential and achieve real results.</p>

              <div className="hero-actions-new">
                <a className="btn btn-primary" href="#consultation" onClick={(e) => { e.preventDefault(); openConsultationModal('General'); }}>
                  Book Free Consultation <span aria-hidden="true">→</span>
                </a>
                <a className="btn btn-outline" href="#programs">Explore Programs</a>
              </div>

              <div className="hero-trust">
                <div className="hero-avatars" aria-hidden="true">
                  <span>A</span><span>M</span><span>R</span><span>S</span>
                </div>
                <div>
                  <div className="stars">★★★★★</div>
                  <p>Trusted by 5,000+ students and parents worldwide</p>
                </div>
              </div>
            </div>

            <div className="hero-art">
              <img src={heroImg} alt="Students studying online with tutoring support" />

              <div className="floating-card card-concepts">
                <span className="concepts-check" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <strong>Concepts<br />Made Simple</strong>
              </div>

<div className="floating-card card-tags">
                <span>SAT</span><span>ACT</span><span>AP</span>
              </div>

              <div className="floating-card card-plan">
                <strong>Personalized Plan</strong>
                <i></i><i></i><i></i>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Band — Why ASG (bars only, no heading) */}
        <section className="stats-band shell" aria-label="Impact statistics">
          <div className="stats-band-reach">
            <span className="stat-icon" aria-hidden="true"><IconGlobe /></span>
            <strong>Students Across</strong>
            <span>USA · Canada · India · UAE · Singapore · UK</span>
          </div>
          <div><span className="stat-icon" aria-hidden="true"><IconUser /></span><strong>5,000+</strong><span>Students Mentored</span></div>
          <div><span className="stat-icon" aria-hidden="true"><IconUsers /></span><strong>300+</strong><span>Expert Tutors</span></div>
          <div><span className="stat-icon" aria-hidden="true"><IconHeartCheck /></span><strong>98%</strong><span>Parent Satisfaction</span></div>
          <div><span className="stat-icon" aria-hidden="true"><IconGlobe /></span><strong>50+</strong><span>Countries Reached</span></div>
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

        <Programs />

        <section className="cta-section shell">
          <div className="process-cta">
            <div>
              <h3>Every step is personalized.<br />Every action is guided.<br />Every goal is achievable.</h3>
              <a className="btn btn-primary" href="#consultation" onClick={(e) => { e.preventDefault(); openConsultationModal('General'); }}>
                Book Free Consultation <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="cta-graphic" aria-hidden="true">
              <svg viewBox="0 0 220 150" width="100%" height="100%">
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
                </defs>

                <rect x="12" y="104" width="18" height="30" rx="4" fill="url(#ctaGoldBar)" opacity="0.75" />
                <rect x="36" y="86" width="18" height="48" rx="4" fill="url(#ctaGoldBar)" opacity="0.85" />
                <rect x="60" y="66" width="18" height="68" rx="4" fill="url(#ctaGoldBar)" opacity="0.92" />
                <rect x="84" y="42" width="18" height="92" rx="4" fill="url(#ctaGoldBar)" />
                <rect x="108" y="16" width="18" height="118" rx="4" fill="url(#ctaGoldBar)" />

                <circle cx="168" cy="70" r="50" fill="none" stroke="url(#ctaRingGold)" strokeWidth="1.5" opacity="0.6" />
                <circle cx="168" cy="70" r="46" fill="url(#ctaRingGold)" />
                <circle cx="168" cy="70" r="36" fill="url(#ctaRingCream)" />
                <circle cx="168" cy="70" r="26" fill="url(#ctaRingGold)" />
                <circle cx="168" cy="70" r="16" fill="url(#ctaRingCream)" />
                <circle cx="168" cy="70" r="6" fill="#c9860f" />

                <path d="M209 9 199 11M209 9 207 19" stroke="url(#ctaArrow)" strokeWidth="4" strokeLinecap="round" />
                <line x1="209" y1="9" x2="176" y2="53" stroke="url(#ctaArrow)" strokeWidth="5" strokeLinecap="round" />
                <path d="M166 57 178 52 174 66Z" fill="url(#ctaArrow)" />
              </svg>
            </div>
          </div>
        </section>

        {/* Our Personalised Learning Process (7 steps) */}
        <section className="process section-light" id="process">
          <div className="shell">
            <div className="section-heading">
              <p className="eyebrow">Our method</p>
              <h2>Our Personalised Learning Process</h2>
              <p>A proven 7-step journey that keeps students, mentors, and families aligned.</p>
            </div>
            <div className="process-flow">
              {[
                { n: '01', title: 'Understand', text: 'We learn about your goals & challenges.' },
                { n: '02', title: 'Assess', text: 'Diagnostic test to analyze strengths & weaknesses.' },
                { n: '03', title: 'Create', text: 'We create a customized learning roadmap just for you.' },
                { n: '04', title: 'Learn', text: 'Live classes, practice & resources with expert guidance.' },
                { n: '05', title: 'Track', text: 'In-stream tracking of progress and performance.' },
                { n: '06', title: 'Feedback', text: 'Continuous feedback & data insights for improvement.' },
                { n: '07', title: 'Improve', text: 'Reach your target score & unlock future opportunities.' },
              ].map((s, i) => (
                <article key={s.n} className="process-step reveal" style={{ transitionDelay: `${i * 60}ms` }}>
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
          <div className="compare-table-new" role="table" aria-label="ACT SAT GO comparison">
            <div className="table-row-new table-head-new" role="row">
              <div className="col-others">OTHERS</div>
              <div className="col-asg">
                <svg className="asg-triangle-logo" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 3 21 20 3 20" />
                </svg>
                ACT SAT GO
              </div>
            </div>
            <div className="table-row-new" role="row">
              <div className="col-others-val">One-size-fits-all approach</div>
              <div className="col-asg-val">Personalized learning for every student</div>
            </div>
            <div className="table-row-new" role="row">
              <div className="col-others-val">Focus only on tutoring</div>
              <div className="col-asg-val">End-to-end academic success partner</div>
            </div>
            <div className="table-row-new" role="row">
              <div className="col-others-val">Limited performance insights</div>
              <div className="col-asg-val">AI-powered progress analytics</div>
            </div>
            <div className="table-row-new" role="row">
              <div className="col-others-val">Doubt support with limits</div>
              <div className="col-asg-val">Unlimited doubt solving &amp; mentor support</div>
            </div>
            <div className="table-row-new" role="row">
              <div className="col-others-val">Minimal parent communication</div>
              <div className="col-asg-val">Weekly reports &amp; regular PTMs</div>
            </div>
            <div className="table-row-new" role="row">
              <div className="col-others-val">Disconnected tools &amp; platforms</div>
              <div className="col-asg-val">All-in-one learning ecosystem</div>
            </div>
          </div>
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
                <a className="btn btn-outline" href="#consultation" onClick={(e) => { e.preventDefault(); openConsultationModal('General'); }}>
                  Talk to an Expert
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
                <input
                  id="modal-phone"
                  type="tel"
                  className="c-input"
                  placeholder="e.g. +91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
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
