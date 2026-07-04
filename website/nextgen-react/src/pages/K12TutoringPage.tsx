import { useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { Brand } from '../components/Brand';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { IconGlobe, IconGraduationCap, IconUser, IconChart } from '../components/Icons';
import programsImg from '../assets/programs.png';
import ctaImg6 from '../assets/6.jpeg';
import k12HeroImg from '../assets/k12-hero.png';
import k12ElementaryImg from '../assets/k12-elementary.jpg';
import k12MiddleImg from '../assets/k12-middle.jpg';
import k12HighImg from '../assets/k12-high.jpg';

const CONSULT_HREF = '/#consultation';

function IconStar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 21l1.2-6.5-4.8-4.6 6.6-.9Z" />
    </svg>
  );
}

function IconBackpack() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8V6a5 5 0 0 1 10 0v2" />
      <path d="M5 9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
      <path d="M9 13h6M10 9v3h4V9" />
    </svg>
  );
}

function IconBookSquare() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.5C10.5 5.3 8 4.5 5 4.5v13c3 0 5.5.8 7 2 1.5-1.2 4-2 7-2v-13c-3 0-5.5.8-7 2Z" />
    </svg>
  );
}

function IconMedal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="15" r="6" />
      <path d="m9 10-3-7M15 10l3-7M9 15l1.7 1.7L15 13" />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v18" />
      <path d="M5 4h13l-2.5 4L18 12H5" />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V4" />
      <path d="M9 12h6M9 15.5h6M9 8.5h4" />
    </svg>
  );
}

function IconBrain() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .4 2.5 1.5 3.5.7.8 1.3 1.5 1.5 2.5" />
      <line x1="9" y1="18" x2="15" y2="18" />
      <line x1="10" y1="22" x2="14" y2="22" />
    </svg>
  );
}

function IconChatDots() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v11H9l-5 4V5Z" />
      <circle cx="8.5" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconCalendarClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <circle cx="12" cy="15.5" r="3" />
      <path d="M12 14v1.5l1 1" />
    </svg>
  );
}

function IconBulb() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2.3h6c0-1.1.4-1.8 1-2.3A7 7 0 0 0 12 2Z" />
    </svg>
  );
}

function IconPuzzle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4h3.5a1.5 1.5 0 0 1 0 3H12v2h3a2 2 0 0 1 2 2v3h2a1.5 1.5 0 0 1 0 3.5H19v2.5H4V16h2.5a1.5 1.5 0 0 0 0-3H4v-3a2 2 0 0 1 2-2h3V6a1.5 1.5 0 0 1 0-2Z" />
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

const HERO_FEATURES = [
  { icon: <IconUser />, label: 'Personalized Learning' },
  { icon: <IconStar />, label: 'Expert Tutors' },
  { icon: <IconChart />, label: 'Proven Results' },
];

const GRADE_LEVELS = [
  {
    accent: '#f59b00',
    tint: '#fff3d6',
    badge: <IconBackpack />,
    photo: k12ElementaryImg,
    eyebrow: 'GRADES K–5',
    title: 'Elementary School',
    text: 'We help young learners build strong foundations in core subjects while developing confidence and curiosity.',
    focus: ['Reading & Writing', 'Math Fundamentals', 'Phonics & Vocabulary', 'Homework Help', 'Confidence Building'],
    goalIcon: <IconMedal />,
    goal: 'Build strong basics. Spark a love for learning.',
  },
  {
    accent: '#1c5fa5',
    tint: '#e2edf9',
    badge: <IconBookSquare />,
    photo: k12MiddleImg,
    eyebrow: 'GRADES 6–8',
    title: 'Middle School',
    text: 'We strengthen concepts and habits to help students become independent, organized learners.',
    focus: ['Math & Pre-Algebra', 'Science & Social Studies', 'Writing & Grammar', 'Study Skills & Organization', 'Test Prep & Assessments'],
    goalIcon: <IconFlag />,
    goal: 'Build strong skills. Prepare for high school success.',
  },
  {
    accent: '#6d28d9',
    tint: '#ece6fb',
    badge: <IconGraduationCap />,
    photo: k12HighImg,
    eyebrow: 'GRADES 9–12',
    title: 'High School',
    text: 'We provide advanced academic support to help students achieve college and career goals.',
    focus: ['Advanced Math & Sciences', 'English & Literature', 'AP Course Support', 'SAT / ACT Preparation', 'College Readiness'],
    goalIcon: <IconTarget />,
    goal: 'Master challenging topics. Achieve ambitious goals.',
  },
];

const JOURNEY_STEPS = [
  { n: '1', title: 'Assess', text: "We understand your child's strengths, challenges, and goals.", icon: <IconClipboard />, accent: '#f59b00' },
  { n: '2', title: 'Plan', text: 'We create a personalized learning plan tailored to their needs.', icon: <IconTarget />, accent: '#1c5fa5' },
  { n: '3', title: 'Learn', text: 'Engaging sessions with expert tutors and proven teaching methods.', icon: <IconBookSquare />, accent: '#6d28d9' },
  { n: '4', title: 'Grow', text: 'Track progress, build confidence, and achieve measurable results.', icon: <IconChart />, accent: '#f59b00' },
];

const SKILLS = [
  { icon: <IconBrain />, title: 'Critical Thinking', text: 'Solve problems and think independently.' },
  { icon: <IconChatDots />, title: 'Communication', text: 'Express ideas clearly and confidently.' },
  { icon: <IconCalendarClock />, title: 'Time Management', text: 'Build habits that lead to productivity.' },
  { icon: <IconBulb />, title: 'Curiosity', text: 'Encourage questions and a love for learning.' },
  { icon: <IconPuzzle />, title: 'Adaptability', text: 'Prepare for challenges and new opportunities.' },
  { icon: <IconTrophy />, title: 'Confidence', text: 'Believe in their abilities and aim higher.' },
];

const BOTTOM_STATS = [
  { icon: <IconGraduationCap />, value: '10,000+', label: 'Students Mentored' },
  { icon: <IconUser />, value: '200+', label: 'Expert Tutors' },
  { icon: <IconStar />, value: '95%', label: 'Improvement Rate' },
  { icon: <IconGlobe />, value: '20+', label: 'Countries Served' },
];

export function K12TutoringPage() {
  useScrollReveal();
  const heroArtRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'K-12 Tutoring — ACT SAT GO';
  }, []);

  useEffect(() => {
    const el = heroArtRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      el.style.setProperty('--tilt-x', `${(-y * 6).toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${(x * 6).toFixed(2)}deg`);
    };
    const handleLeave = () => {
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    };

    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
    return () => {
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return (
    <>
      <Header />

      <main>
        {/* Hero */}
        <section className="k12-hero section-dark">
          <span className="k12-hero-texture" aria-hidden="true" />
          <span className="orb orb-gold" aria-hidden="true" />
          <span className="orb orb-ring" aria-hidden="true" />
          <div className="shell k12-hero-grid">
            <div className="k12-hero-copy">
              <span className="eyebrow-hero">K-12 TUTORING</span>
              <h1>
                Personalized Support.<br />
                Stronger Foundations.<br />
                <span>Limitless Futures.</span>
              </h1>
              <p className="hero-text">
                From building core skills to mastering advanced concepts, we support your child
                at every step of their academic journey.
              </p>

              <div className="k12-hero-actions">
                <a className="btn btn-primary" href={CONSULT_HREF}>Book a Free Consultation <span aria-hidden="true">→</span></a>
                <a className="btn btn-outline" href="/#programs">Explore Programs</a>
              </div>

              <div className="k12-feature-row">
                {HERO_FEATURES.map((f) => (
                  <div key={f.label} className="k12-feature-item">
                    <span className="k12-feature-icon" aria-hidden="true">{f.icon}</span>
                    <span>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="k12-hero-art" ref={heroArtRef} aria-hidden="true">
              <span className="k12-blob k12-blob-gold"></span>
              <span className="k12-blob k12-blob-blue"></span>
              <span className="k12-ring-glow"></span>
              <span className="k12-doodle k12-doodle-bulb">💡</span>
              <span className="k12-doodle k12-doodle-book">📖</span>
              <span className="k12-doodle k12-doodle-cap">🎓</span>
              <span className="k12-doodle k12-doodle-formula">∑</span>
              <span className="k12-doodle k12-doodle-star">✦</span>
              <span className="k12-doodle k12-doodle-pi">π</span>
              <img className="k12-hero-photo" src={k12HeroImg} alt="Three students supported by ACT SAT GO tutoring" />
            </div>
          </div>
        </section>

        {/* Grade levels */}
        <section className="k12-grades shell">
          <div className="section-heading center reveal">
            <p className="eyebrow">Three Stages. One Goal.</p>
            <h2>The Right Support for<br />Every <span className="k12-blue">Grade Level.</span></h2>
          </div>
          <div className="k12-grade-grid">
            {GRADE_LEVELS.map((g, i) => (
              <article
                key={g.title}
                className="k12-grade-card reveal"
                style={{ transitionDelay: `${i * 70}ms`, ['--accent' as string]: g.accent, ['--tint' as string]: g.tint }}
              >
                <span className="k12-grade-badge" aria-hidden="true">{g.badge}</span>
                <p className="k12-grade-eyebrow">{g.eyebrow}</p>
                <h3>{g.title}</h3>
                <p className="k12-grade-text">{g.text}</p>
                <div className="k12-grade-photo">
                  <img src={g.photo ?? programsImg} alt="" />
                </div>
                <p className="k12-focus-label">Focus Areas</p>
                <ul>
                  {g.focus.map((f) => (
                    <li key={f}>
                      <span className="k12-check" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="k12-goal-box">
                  <span className="k12-goal-icon" aria-hidden="true">{g.goalIcon}</span>
                  <div>
                    <strong>Goal</strong>
                    <p>{g.goal}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Learning journey */}
        <section className="k12-journey section-dark">
          <div className="shell k12-journey-grid">
            <div className="k12-journey-heading">
              <h2>Your Child's<br /><span className="k12-gold">Learning</span> Journey</h2>
              <p>A simple, student-focused process designed to deliver real academic growth and confidence.</p>
            </div>
            <div className="k12-journey-steps">
              {JOURNEY_STEPS.map((s, i) => (
                <div key={s.n} className="k12-journey-step" style={{ ['--accent' as string]: s.accent }}>
                  {i > 0 && <span className="k12-journey-line" aria-hidden="true" />}
                  <span className="k12-journey-icon" aria-hidden="true">{s.icon}</span>
                  <strong>{s.n}. {s.title}</strong>
                  <p>{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Skills */}
        <section className="k12-skills shell">
          <div className="section-heading center reveal">
            <h2>Skills for Today. <span className="k12-blue">Success</span> for Tomorrow.</h2>
          </div>
          <div className="k12-skills-grid">
            {SKILLS.map((s, i) => (
              <article key={s.title} className="k12-skill-card reveal" style={{ transitionDelay: `${i * 60}ms` }}>
                <span className="k12-skill-icon" aria-hidden="true">{s.icon}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="k12-cta shell" id="consultation">
          <div className="k12-cta-card">

            <div className="k12-cta-text">
              <h2>Every Child Has Potential.<br /><span>We Help Them Unlock It.</span></h2>
              <p>Book a free consultation and get a personalized learning plan for your child.</p>
              <a className="btn btn-primary" href={CONSULT_HREF}>Book a Free Consultation <span aria-hidden="true">→</span></a>
            </div>
            <div className="k12-cta-stats">
              {BOTTOM_STATS.map((s) => (
                <div key={s.label} className="k12-cta-stat">
                  <span className="k12-cta-stat-icon" aria-hidden="true">{s.icon}</span>
                  <div>
                    <strong>{s.value}</strong>
                    <span>{s.label}</span>
                  </div>
                </div>
              ))}
            </div>
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
            </div>
          </div>

          <div className="footer-col">
            <h4 className="footer-heading">Courses</h4>
            <ul className="footer-links">
              <li><a href="/act">ACT</a></li>
              <li><a href="/sat">SAT</a></li>
              <li><a href="/ap">AP</a></li>
              <li><a href="/k-12-tutoring">Elementary School</a></li>
              <li><a href="/k-12-tutoring">Middle School</a></li>
              <li><a href="/k-12-tutoring">High School</a></li>
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
    </>
  );
}
