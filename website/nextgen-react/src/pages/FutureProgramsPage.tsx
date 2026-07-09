import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Brand } from '../components/Brand';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { IconGlobe, IconGraduationCap, IconChart } from '../components/Icons';
import img9 from '../assets/9.jpeg';
import img3 from '../assets/3.jpeg';
import img7 from '../assets/7.jpeg';
import img8 from '../assets/8.jpeg';
import langImg from '../assets/10.png';
import heroImg from '../assets/4.png';

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
    image: img9,
    photoPos: 'center center',
  },
  {
    badge: 'IGCSE',
    title: 'IGCSE / GCSE',
    text: 'Build strong academic foundations with internationally respected qualifications.',
    points: ['Wide Range of Subjects', 'Exam Board Alignment', 'Concept Clarity', 'Excellent University Pathway'],
    image: img3,
    photoPos: 'center 30%',
  },
  {
    badge: 'AS',
    title: 'AS Level',
    text: 'The first step of Advanced Level studies that helps you build depth in your chosen subjects.',
    points: ['3–4 Subject Focus', 'In-depth Concept Building', 'Exam Preparation', 'Smooth Transition to A Level'],
    image: img7,
    photoPos: 'center 20%',
  },
  {
    badge: 'A',
    title: 'A Level',
    text: 'Advanced pre-university qualification accepted by top universities worldwide.',
    points: ['Subject Specialization', 'Critical Thinking & Analysis', 'University Preparation', 'High Academic Rigor'],
    image: img8,
    photoPos: 'center 25%',
  },
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
                <img className="future-hero-photo" src={heroImg} alt="Future Programs" />
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
                <div
                  className="future-program-photo"
                  style={{ backgroundImage: `url(${p.image})`, backgroundPosition: p.photoPos, backgroundSize: 'cover' }}
                >
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

            <div className="future-languages-photo">
              <img src={langImg} alt="Language courses" />
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
              <a href="https://www.google.com/search?q=ACT+SAT+GO+reviews" target="_blank" rel="noopener noreferrer" aria-label="Google Reviews">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              </a>
            </div>
          </div>

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

          <div className="footer-col">
            <h4 className="footer-heading">Quick Links</h4>
            <ul className="footer-links">
              <li><a href="/#home">Home</a></li>
              <li><Link to="/about-us">About Us</Link></li>
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
