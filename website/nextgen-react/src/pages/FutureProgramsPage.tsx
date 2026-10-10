import { useEffect } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { IconGlobe, IconGraduationCap, IconChart } from '../components/Icons';
import img9 from '../assets/img/9.webp';
import img3 from '../assets/img/3.webp';
import img7 from '../assets/img/7.webp';
import img8 from '../assets/img/8.webp';
import langImg from '../assets/img/10.webp';
import heroImg from '../assets/img/4.webp';

const CONSULT_HREF = '/consultation';

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

function IconArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
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
              <a href="/">Home</a> <span aria-hidden="true">›</span> <span>Future Programs</span>
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
                />
                <div className="future-program-body">
                  <h3>{p.title}</h3>
                  <p>{p.text}</p>
                  <ul>
                    {p.points.map((pt) => (
                      <li key={pt}><span className="future-check" aria-hidden="true"><IconCheck /></span>{pt}</li>
                    ))}
                  </ul>
                  <span className="future-coming-soon">
                    Know more <IconArrowRight />
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
              <img src={langImg} alt="Language courses" loading="lazy" />
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
              Book a Free Diagnostic Lesson <IconCalendar />
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
