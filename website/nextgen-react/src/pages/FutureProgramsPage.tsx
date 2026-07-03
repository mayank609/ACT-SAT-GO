import { useEffect } from 'react';
import { Header } from '../components/Header';
import { Brand } from '../components/Brand';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { IconGlobe, IconGraduationCap, IconChart } from '../components/Icons';
import programsImg from '../assets/programs.png';

const CONSULT_HREF = '/#consultation';

function IconOpenBook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5.5C10.5 4.3 8 3.5 5 3.5v14c3 0 5.5.8 7 2 1.5-1.2 4-2 7-2v-14c-3 0-5.5.8-7 2Z" />
      <path d="M12 5.5v14" />
    </svg>
  );
}

function IconStarPerson() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" />
      <path d="M19 2.5 19.8 4.2 21.5 4.5 20.3 5.8 20.6 7.5 19 6.7 17.4 7.5 17.7 5.8 16.5 4.5 18.2 4.2Z" fill="var(--gold)" stroke="var(--gold)" />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10v4a5 5 0 0 1-10 0Z" />
      <path d="M7 5H4.5A1.5 1.5 0 0 0 3 6.5c0 1.8 1.4 3.3 3.2 3.5" />
      <path d="M17 5h2.5A1.5 1.5 0 0 1 21 6.5c0 1.8-1.4 3.3-3.2 3.5" />
      <path d="M12 13v3M9 20h6M10 16h4l.6 4H9.4Z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function IconChatBubble() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v11H9l-5 4V5Z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  );
}

const HERO_FEATURES = [
  { icon: <IconOpenBook />, label: 'Global Curricula' },
  { icon: <IconStarPerson />, label: 'Expert Mentors' },
  { icon: <IconChart />, label: 'Personalized Learning' },
  { icon: <IconTrophy />, label: 'Proven Results' },
];

const EXPLORE_PROGRAMS = [
  {
    badge: 'IB',
    title: 'IB Diploma Programme',
    text: 'A globally recognized program that develops inquiring, knowledgeable and compassionate young people.',
    points: ['6 Subject Groups', 'TOK, EE & CAS', 'Holistic Learning Approach', 'Global University Recognition'],
  },
  {
    badge: 'IGCSE',
    title: 'IGCSE / GCSE',
    text: 'Build strong academic foundations with internationally respected qualifications.',
    points: ['Wide Range of Subjects', 'Exam Board Alignment', 'Concept Clarity', 'Excellent University Pathway'],
  },
  {
    badge: 'AS',
    title: 'AS Level',
    text: 'The first step of Advanced Level studies that helps you build depth in your chosen subjects.',
    points: ['3–4 Subject Focus', 'In-depth Concept Building', 'Exam Preparation', 'Smooth Transition to A Level'],
  },
  {
    badge: 'A',
    title: 'A Level',
    text: 'Advanced pre-university qualification accepted by top universities worldwide.',
    points: ['Subject Specialization', 'Critical Thinking & Analysis', 'University Preparation', 'High Academic Rigor'],
  },
];

const LANGUAGES = [
  { flag: '🇬🇧', label: 'English' },
  { flag: '🇫🇷', label: 'French' },
  { flag: '🇪🇸', label: 'Spanish' },
  { flag: '🇩🇪', label: 'German' },
  { flag: '🇨🇳', label: 'Mandarin' },
  { flag: '🇯🇵', label: 'Japanese' },
  { flag: '🇸🇦', label: 'Arabic' },
  { flag: '🇮🇳', label: 'Hindi' },
];

const WHY_MATTERS = [
  { icon: <IconGlobe />, title: 'Global Recognition', text: 'Accepted by top universities and institutions around the world.' },
  { icon: <IconChart />, title: 'Academic Excellence', text: 'Build strong foundations and advanced knowledge in chosen subjects.' },
  { icon: <IconStarPerson />, title: 'Future Ready Skills', text: 'Develop critical thinking, problem solving and communication skills.' },
  { icon: <IconGraduationCap />, title: 'Limitless Opportunities', text: 'Empowering students to achieve their dreams and become global leaders.' },
];

export function FutureProgramsPage() {
  useScrollReveal();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Future Programs — ACT SAT GO';
  }, []);

  return (
    <>
      <Header />

      <main>
        {/* Hero */}
        <section className="future-hero section-dark">
          <span className="orb orb-gold" aria-hidden="true" />
          <span className="orb orb-ring" aria-hidden="true" />
          <div className="shell">
            <p className="future-breadcrumb">
              <a href="/#home">Home</a> <span aria-hidden="true">›</span> <span>Future Programs</span>
            </p>

            <div className="future-hero-grid">
              <div className="future-hero-copy">
                <h1>
                  Future Programs<br />
                  Expanding Horizons.<br />
                  Creating <span>Global Achievers.</span>
                </h1>
                <p className="hero-text">
                  We are constantly evolving to bring you world-class curricula and language learning programs
                  that prepare you for a limitless future.
                </p>

                <div className="future-feature-row">
                  {HERO_FEATURES.map((f) => (
                    <div key={f.label} className="future-feature-item">
                      <span className="future-feature-icon" aria-hidden="true">{f.icon}</span>
                      <span>{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="future-hero-art" aria-hidden="true">
                <svg className="future-globe-svg" viewBox="0 0 360 360">
                  <defs>
                    <pattern id="globeDots" width="10" height="10" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="1.1" fill="rgba(255,255,255,0.35)" />
                    </pattern>
                    <linearGradient id="orbitGold" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="rgba(255,180,0,0)" />
                      <stop offset="50%" stopColor="rgba(255,180,0,0.9)" />
                      <stop offset="100%" stopColor="rgba(255,180,0,0)" />
                    </linearGradient>
                  </defs>

                  <circle cx="180" cy="170" r="120" fill="#0b2744" />
                  <circle cx="180" cy="170" r="120" fill="url(#globeDots)" />
                  <circle cx="180" cy="170" r="120" fill="none" stroke="rgba(255,255,255,0.12)" />

                  <ellipse cx="180" cy="170" rx="170" ry="60" fill="none" stroke="url(#orbitGold)" strokeWidth="1.5" transform="rotate(-18 180 170)" />
                  <ellipse cx="180" cy="170" rx="150" ry="45" fill="none" stroke="url(#orbitGold)" strokeWidth="1.5" transform="rotate(12 180 170)" />

                  <g fill="var(--gold)">
                    <path d="M300 70 302 76 308 78 302 80 300 86 298 80 292 78 298 76Z" />
                    <path d="M70 230 271.5 232 275 236 271.5 232 268 234Z" />
                    <circle cx="60" cy="90" r="2.4" />
                    <circle cx="320" cy="230" r="2" />
                    <circle cx="90" cy="260" r="2" />
                  </g>
                </svg>

                <div className="future-book-stack">
                  <div className="future-cap"><IconGraduationCap /></div>
                  <div className="future-book book-ib">IB</div>
                  <div className="future-book book-igcse">IGCSE</div>
                  <div className="future-book book-alevel">A LEVEL</div>
                  <div className="future-book book-lang">LANGUAGES</div>
                </div>

                <div className="future-desk-props">
                  <svg viewBox="0 0 60 60" className="future-pencil-cup">
                    <rect x="8" y="26" width="30" height="26" rx="3" fill="#1c2b3a" />
                    <line x1="14" y1="8" x2="20" y2="30" stroke="#f5b93a" strokeWidth="4" strokeLinecap="round" />
                    <line x1="22" y1="4" x2="26" y2="30" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
                    <line x1="30" y1="10" x2="32" y2="30" stroke="#9aa5b1" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                  <svg viewBox="0 0 60 60" className="future-plant">
                    <rect x="16" y="38" width="28" height="18" rx="3" fill="#2a3b4d" />
                    <path d="M30 38c-10-6-14-18-8-30 8 6 12 18 8 30Z" fill="#2f7d5a" />
                    <path d="M30 38c8-4 12-14 8-24-8 4-12 14-8 24Z" fill="#3a9a6e" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Explore programs */}
        <section className="future-explore shell">
          <div className="section-heading center reveal">
            <h2>Explore Our Future Programs</h2>
            <p>International curricula and language programs to empower every learner worldwide.</p>
          </div>
          <div className="future-program-grid">
            {EXPLORE_PROGRAMS.map((p, i) => (
              <article key={p.title} className="future-program-card reveal" style={{ transitionDelay: `${i * 70}ms` }}>
                <div className="future-program-photo">
                  <img src={programsImg} alt="" />
                  <span className="future-program-badge">{p.badge}</span>
                </div>
                <div className="future-program-body">
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                  <ul>
                    {p.points.map((pt) => (
                      <li key={pt}><span className="future-check" aria-hidden="true"><IconCheck /></span>{pt}</li>
                    ))}
                  </ul>
                  <span className="future-coming-soon">
                    Coming Soon <IconCalendar />
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Language courses */}
        <section className="future-languages shell">
          <div className="future-languages-card">
            <div className="future-languages-text">
              <span className="future-lang-icon" aria-hidden="true"><IconChatBubble /></span>
              <h3>Language Courses</h3>
              <p>Learn new languages and improve communication skills with our expert-led courses and exam preparation programs.</p>
              <ul>
                <li><span className="future-check" aria-hidden="true"><IconCheck /></span>Communication &amp; Academic Language</li>
                <li><span className="future-check" aria-hidden="true"><IconCheck /></span>Multiple Languages to Choose From</li>
                <li><span className="future-check" aria-hidden="true"><IconCheck /></span>Global Exam Preparation</li>
                <li><span className="future-check" aria-hidden="true"><IconCheck /></span>Flexible Learning Options</li>
              </ul>
              <span className="future-coming-soon">
                Coming Soon <IconCalendar />
              </span>
            </div>
            <div className="future-languages-flags">
              {LANGUAGES.map((l) => (
                <div key={l.label} className="future-flag-chip">
                  <span className="future-flag-emoji" aria-hidden="true">{l.flag}</span>
                  <span>{l.label}</span>
                </div>
              ))}
              <p className="future-languages-footer">IELTS &middot; TOEFL &middot; PTE &middot; Duolingo &middot; DELF &middot; TEF &amp; more</p>
            </div>
            <div className="future-languages-photo">
              <img src={programsImg} alt="" />
            </div>
          </div>
        </section>

        {/* Why these programs matter */}
        <section className="future-why section-dark">
          <div className="shell future-why-grid">
            <div className="future-why-heading">
              <h2>Why These Programs<br /><span>Matter</span></h2>
              <p>These programs open doors to the best universities and global opportunities.</p>
            </div>
            {WHY_MATTERS.map((w) => (
              <div key={w.title} className="future-why-item">
                <span className="future-why-icon" aria-hidden="true">{w.icon}</span>
                <strong>{w.title}</strong>
                <p>{w.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="future-cta shell">
          <div className="future-cta-card">
            <div className="future-cta-text">
              <h2>Stay Ahead. Be Future Ready.</h2>
              <p>Join ACT SAT GO and be the first to know when our new programs launch.</p>
            </div>
            <a className="btn btn-primary" href={CONSULT_HREF}>
              Book Free Consultation <IconCalendar />
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-top shell">
          <div className="footer-brand-col">
            <Brand />
            <p className="footer-desc">
              ACT SAT GO offers expert guidance and resources to help students excel in their ACT | SAT | AP | and other academic courses. Join our community and unlock your potential with tailored learning strategies and comprehensive support.
            </p>
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
