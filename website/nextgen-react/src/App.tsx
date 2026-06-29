import { Header } from './components/Header';
import { Brand } from './components/Brand';
import { Programs } from './components/Programs';
import { Testimonials } from './components/Testimonials';
import { Newsletter } from './components/Newsletter';
import { Universities } from './components/Universities';
import { CountUp } from './components/CountUp';
import { useScrollReveal } from './hooks/useScrollReveal';
import heroImg from './assets/hero.png';
import ctaImg from './assets/cta.png';

const FEATURES = [
  { icon: '1:1', title: 'Personalized Learning', text: 'Each roadmap is built around goals, diagnostics, pace, and learning style.' },
  { icon: 'UNI', title: 'Expert Mentors', text: 'Work with skilled tutors from top academic backgrounds and exam tracks.' },
  { icon: 'AI', title: 'Data-Driven', text: 'Progress analytics reveal strengths, gaps, and next-best actions.' },
  { icon: '24/7', title: 'Beyond Classes', text: 'Doubt support, parent updates, and resources keep momentum alive.' },
];

const BENEFITS = [
  { icon: 'MAP', title: 'Personalized Roadmap', text: 'Custom plans based on skill level, test date, and target score.' },
  { icon: 'PRO', title: 'Top 1% Expert Tutors', text: 'Mentors with proven coaching experience and focused feedback.' },
  { icon: 'AI', title: 'AI-Powered Insights', text: 'Track progress, patterns, and readiness with clear dashboards.' },
  { icon: 'SUP', title: 'Comprehensive Support', text: 'From concepts to strategy, every step is guided and visible.' },
  { icon: 'FLEX', title: 'Flexible & Convenient', text: 'Learn at your pace with scheduling that works across time zones.' },
  { icon: 'WIN', title: 'Proven Results', text: 'High score improvements, strong applications, and better confidence.' },
];

const COMPARE = [
  { other: 'One-size-fits-all approach', ours: 'Personalized learning for every student' },
  { other: 'Focus only on tutoring', ours: 'End-to-end academic success partner' },
  { other: 'Limited performance insights', ours: 'AI-powered progress analytics' },
  { other: 'Doubt support with limits', ours: 'Unlimited doubt solving and mentor support' },
];

const STEPS = [
  { n: '01', title: 'Understand', text: 'Goals, background, and target outcomes.' },
  { n: '02', title: 'Assess', text: 'Diagnostic test and skill profile.' },
  { n: '03', title: 'Plan', text: 'Weekly roadmap and milestones.' },
  { n: '04', title: 'Learn', text: 'Live classes and expert guidance.' },
  { n: '05', title: 'Track', text: 'Analytics, homework, and revision.' },
  { n: '06', title: 'Improve', text: 'Focused practice and doubt solving.' },
  { n: '07', title: 'Achieve', text: 'Exam confidence and final readiness.' },
];

const STORIES = [
  { initial: 'A', name: 'Ananya K.', score: '1540 / 1600', detail: '+230 points improvement', school: 'University of Michigan' },
  { initial: 'R', name: 'Rohan S.', score: '33 / 36', detail: '+6 points improvement', school: 'Georgia Tech' },
  { initial: 'M', name: 'Meera P.', score: '5 / 5', detail: 'AP Calculus BC', school: 'Stanford University' },
  { initial: 'A', name: 'Arjun D.', score: '1510 / 1600', detail: '+210 points improvement', school: 'UC Berkeley' },
];

const STATS = [
  { value: '5,000+', label: 'Students Mentored' },
  { value: '300+', label: 'Expert Tutors' },
  { value: '98%', label: 'Parent Satisfaction' },
  { value: '50+', label: 'Countries Reached' },
];

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
              <p className="eyebrow">Personalized online tutoring</p>
              <h1>The Right Guidance.<br />The Right Plan.<br /><span>The Right Future.</span></h1>
              <p className="hero-text">Expert SAT, ACT, AP, and K-12 support designed to turn potential into measurable academic progress.</p>
              <div className="hero-actions">
                <a className="btn btn-primary" href="#consultation">Book Free Consultation <span aria-hidden="true">-&gt;</span></a>
                <a className="btn btn-outline" href="#programs">Explore Programs</a>
              </div>
              <div className="rating-row" aria-label="Student trust rating">
                <div className="avatars" aria-hidden="true">
                  <span>A</span><span>M</span><span>R</span><span>S</span>
                </div>
                <div>
                  <div className="stars">★★★★★</div>
                  <p>Trusted by 5,000+ students and parents worldwide</p>
                </div>
              </div>
            </div>
            <div className="hero-art">
              <img src={heroImg} alt="Students studying online with ACT SAT GO tutoring support" />
              <div className="floating-card card-score">
                <strong>Score Improvement</strong>
                <span>+230 Points</span>
                <svg viewBox="0 0 120 54" aria-hidden="true">
                  <polyline points="3,45 24,33 42,37 62,21 80,26 98,10 117,17"></polyline>
                </svg>
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

        {/* Stats */}
        <section className="stats-band shell" aria-label="Impact statistics">
          {STATS.map((s, i) => (
            <div key={s.label} className="reveal" style={{ transitionDelay: `${i * 70}ms` }}>
              <CountUp value={s.value} /><span>{s.label}</span>
            </div>
          ))}
        </section>

        {/* Features */}
        <section className="features shell" id="about">
          {FEATURES.map((f, i) => (
            <article key={f.title} className="reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </section>

        {/* Difference */}
        <section className="difference shell">
          <div className="section-heading reveal">
            <p className="eyebrow">Why families choose us</p>
            <h2>Why ACT SAT GO Is Different</h2>
            <p>A learning experience designed around student confidence, parent clarity, and measurable outcomes.</p>
          </div>
          <div className="benefit-grid">
            {BENEFITS.map((b, i) => (
              <article key={b.title} className="reveal" style={{ transitionDelay: `${i * 70}ms` }}><span className="icon">{b.icon}</span><h3>{b.title}</h3><p>{b.text}</p></article>
            ))}
          </div>
        </section>

        {/* Comparison */}
        <section className="comparison shell">
          <aside className="note-card reveal">
            <strong>We do not just teach.</strong>
            <p>We transform potential into performance.</p>
            <span>✓</span>
          </aside>
          <div className="compare-table reveal" role="table" aria-label="ACT SAT GO comparison">
            <h2>Why Families Choose ACT SAT GO</h2>
            <div className="table-row table-head" role="row">
              <span>Others</span><span>ACT SAT GO</span>
            </div>
            {COMPARE.map((c) => (
              <div className="table-row" role="row" key={c.other}><span>{c.other}</span><strong>{c.ours}</strong></div>
            ))}
          </div>
        </section>

        {/* Process */}
        <section className="process section-light" id="process">
          <div className="shell">
            <div className="section-heading reveal">
              <p className="eyebrow">Our method</p>
              <h2>Our Personalized Learning Process</h2>
              <p>A proven 7-step journey that keeps students, mentors, and families aligned.</p>
            </div>
            <div className="timeline">
              {STEPS.map((s, i) => (
                <article key={s.n} className="reveal" style={{ transitionDelay: `${i * 60}ms` }}><span>{s.n}</span><h3>{s.title}</h3><p>{s.text}</p></article>
              ))}
            </div>
            <div className="process-cta">
              <div>
                <h3>Every step is personalized. Every action is guided. Every goal is achievable.</h3>
                <a className="btn btn-primary" href="#consultation">Book Free Consultation <span aria-hidden="true">-&gt;</span></a>
              </div>
              <div className="target-graphic" aria-hidden="true">
                <span></span><span></span><span></span><b></b>
              </div>
            </div>
          </div>
        </section>

        {/* Programs (filterable) */}
        <Programs />

        {/* Success */}
        <section className="success shell" id="results">
          <div className="section-heading reveal">
            <p className="eyebrow">Success stories</p>
            <h2>Real Students. Real Results.</h2>
          </div>
          <div className="story-grid">
            {STORIES.map((s, i) => (
              <article key={i} className="reveal" style={{ transitionDelay: `${i * 70}ms` }}>
                <div className="portrait">{s.initial}</div>
                <h3>{s.name}</h3>
                <strong>{s.score}</strong>
                <p>{s.detail}</p>
                <span>{s.school}</span>
              </article>
            ))}
          </div>
          <Universities />
          <p className="strip-caption">Where our students have earned admission</p>
        </section>

        {/* Consultation CTA */}
        <section className="cta section-dark" id="consultation">
          <span className="orb orb-blue" aria-hidden="true" />
          <span className="orb orb-gold" aria-hidden="true" />
          <div className="shell cta-grid">
            <div>
              <h2>Ready to Achieve Your Dream Score?</h2>
              <p>Book a free consultation with our experts and take the first step toward your goals.</p>
              <a className="btn btn-primary" href="mailto:hello@actsatgo.com">Book Free Consultation <span aria-hidden="true">-&gt;</span></a>
            </div>
            <img src={ctaImg} alt="Successful student ready for academic coaching" />
          </div>
        </section>

        {/* Testimonials (tabbed) */}
        <Testimonials />

        {/* Newsletter */}
        <Newsletter />
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
