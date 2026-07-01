import { useState } from 'react';
import { Header } from './components/Header';
import { Brand } from './components/Brand';
import { Testimonials } from './components/Testimonials';
import { useScrollReveal } from './hooks/useScrollReveal';
import { ACT_PAGE } from './data/programs';
import heroImg from './assets/hero.png';

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
      const response = await fetch('http://localhost:5005/api/queries', {
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

        {/* Stats Band */}
        <section className="stats-band shell" aria-label="Impact statistics">
          <div className="stats-band-reach">
            <strong>Students Across</strong>
            <span>USA · Canada · India · UAE · Singapore · UK</span>
          </div>
          <div><strong>5,000+</strong><span>Students Mentored</span></div>
          <div><strong>300+</strong><span>Expert Tutors</span></div>
          <div><strong>98%</strong><span>Parent Satisfaction</span></div>
          <div><strong>50+</strong><span>Countries Reached</span></div>
        </section>

        {/* Features */}
        <section className="features shell" id="about">
          <article>
            <span className="icon">1:1</span>
            <h3>Personalized One-to-One Learning</h3>
            <p>Each roadmap is built around goals, diagnostics, pace, and learning style.</p>
          </article>
          <article>
            <span className="icon">UNI</span>
            <h3>Expert Mentors from Top Universities</h3>
            <p>Work with skilled tutors from top academic backgrounds and exam tracks.</p>
          </article>
          <article>
            <span className="icon">AI</span>
            <h3>Data-Driven Progress Tracking</h3>
            <p>Progress analytics reveal strengths, gaps, and next-best actions.</p>
          </article>
          <article>
            <span className="icon">★</span>
            <h3>Proven Strategies &amp; Study Plans</h3>
            <p>Battle-tested methods for every exam section, structured for consistent score gains.</p>
          </article>
          <article>
            <span className="icon">24/7</span>
            <h3>Beyond Classes Complete Support Ecosystem</h3>
            <p>Doubt support, parent updates, and resources keep momentum alive.</p>
          </article>
        </section>

        {/* Why Different */}
        <section className="difference shell" id="why">
          <div className="section-heading">
            <p className="eyebrow">Why families choose us</p>
            <h2>Why ACT SAT GO Is Different</h2>
            <p>A learning experience designed around student confidence, parent clarity, and measurable outcomes.</p>
          </div>
          <div className="benefit-grid">
            <article><span className="icon">MAP</span><h3>Personalized Roadmap</h3><p>Custom plans based on skill level, test date, and target score.</p></article>
            <article><span className="icon">PRO</span><h3>Top 1% Expert Tutors</h3><p>Mentors with proven coaching experience and focused feedback.</p></article>
            <article><span className="icon">AI</span><h3>AI-Powered Insights</h3><p>Track progress, patterns, and readiness with clear dashboards.</p></article>
            <article><span className="icon">SUP</span><h3>Comprehensive Support</h3><p>From concepts to strategy, every step is guided and visible.</p></article>
            <article><span className="icon">FLEX</span><h3>Flexible &amp; Convenient</h3><p>Learn at your pace with flexible scheduling across time zones.</p></article>
            <article><span className="icon">WIN</span><h3>Proven Results</h3><p>High score improvements, strong applications, and better confidence.</p></article>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="comparison shell">
          <aside className="note-card">
            <span className="note-badge">★ Why Us?</span>
            <strong>We don't just teach.<em>We transform.</em></strong>
            <p>Every student gets a personalized path built for real results — not one-size-fits-all lessons.</p>
            <div className="note-card-check">✓</div>
          </aside>
          <div className="compare-table" role="table" aria-label="ACT SAT GO comparison">
            <h2>Why Families Choose ACT SAT GO</h2>
            <div className="table-row table-head" role="row">
              <span>Others</span><span>ACT SAT GO</span>
            </div>
            <div className="table-row" role="row"><span>One-size-fits-all approach</span><strong>Personalized learning for every student</strong></div>
            <div className="table-row" role="row"><span>Focus only on tutoring</span><strong>End-to-end academic success partner</strong></div>
            <div className="table-row" role="row"><span>Limited performance insights</span><strong>AI-powered progress analytics</strong></div>
            <div className="table-row" role="row"><span>Doubt support with limits</span><strong>Unlimited doubt solving and mentor support</strong></div>
            <div className="table-row" role="row"><span>Minimal parent communication</span><strong>Weekly reports &amp; regular PTMs</strong></div>
            <div className="table-row" role="row"><span>Disconnected tools &amp; platforms</span><strong>All-in-one learning ecosystem</strong></div>
          </div>
        </section>


        {/* Program Tiers */}
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
                  <a className="btn tier-btn" href="#consultation" onClick={(e) => { e.preventDefault(); openConsultationModal(t.name); }}>
                    View Details <span aria-hidden="true">-&gt;</span>
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Personalized Learning Process (7 steps) */}
        <section className="process section-light" id="process">
          <div className="shell">
            <div className="section-heading">
              <p className="eyebrow">Our method</p>
              <h2>Our Personalized Learning Process</h2>
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
          <div className="section-heading">
            <p className="eyebrow">Success stories</p>
            <h2>Real Students. Real Results.</h2>
          </div>
          <div className="story-grid">
            <article><div className="portrait">A</div><h3>Ananya K.</h3><strong>1540 / 1600</strong><p>+230 points improvement</p><span>University of Michigan</span></article>
            <article><div className="portrait">R</div><h3>Rohan S.</h3><strong>33 / 36</strong><p>+6 points improvement</p><span>Georgia Tech</span></article>
            <article><div className="portrait">M</div><h3>Meera P.</h3><strong>5 / 5</strong><p>AP Calculus BC</p><span>Stanford University</span></article>
            <article><div className="portrait">A</div><h3>Arjun D.</h3><strong>1510 / 1600</strong><p>+210 points improvement</p><span>UC Berkeley</span></article>
          </div>
          <p className="uni-strip-label">Our students have been accepted to top universities worldwide.</p>
          <div className="university-strip">
            <span>Harvard</span><span>Stanford</span><span>MIT</span><span>Berkeley</span><span>NYU</span><span>Georgia Tech</span>
          </div>
        </section>

        {/* Testimonials */}
        <Testimonials />

        {/* Newsletter */}
        <section className="newsletter shell" id="resources">
          <div>
            <h2>Stay Updated with Free Resources &amp; Tips</h2>
            <p>Get the latest study tips, resources, and exam updates delivered to your inbox.</p>
          </div>
          <form onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="nl-email">Email address</label>
            <input id="nl-email" type="email" placeholder="Enter your email" />
            <button className="btn btn-primary" type="submit">Subscribe</button>
          </form>
        </section>

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
        <div className="shell">
          <Brand />
          <p>Premium academic coaching for SAT, ACT, AP, and K-12 learners.</p>
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
