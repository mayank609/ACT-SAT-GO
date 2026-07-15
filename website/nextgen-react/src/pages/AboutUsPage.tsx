import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Brand } from '../components/Brand';
import { useScrollReveal } from '../hooks/useScrollReveal';

import abImg from '../../images/ab b.png';
import abOrbitImg from '../../images/ab.jpeg';



export function AboutUsPage() {
  useScrollReveal();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);




  return (
    <>
      <Header />

      <main>
        {/* Hero Section */}
        <section className="about-hero section-dark">
          <span className="orb orb-gold" aria-hidden="true" />
          <div className="shell">
            <nav className="about-breadcrumb" aria-label="Breadcrumb">
              <Link to="/">Home</Link> &gt; <span>About Us</span>
            </nav>

            <div className="about-hero-grid">
              <div className="about-hero-copy">
                <h1 className="about-hero-title">
                  About{' '}
                  <span className="brand-logo-text-large">
                    ACT SAT <span className="brand-go-box-large">GO</span>
                  </span>
                </h1>

                <p className="about-hero-subtitle">
                  Personalized Learning. Guided by Experts.<br />Powered by Intelligence.
                </p>

                <p className="about-hero-description">
                  At ACTSATGO, we believe every student has a unique potential and a unique path. Our mission is to understand that potential and build the right path for them.
                </p>

                <div className="about-hero-quote">
                  <span className="about-hero-quote-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4.5 20c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" />
                    </svg>
                  </span>
                  <p className="about-hero-quote-text">
                    <strong style={{ color: 'var(--gold)' }}>When learning is personalized,</strong><br />
                    every student has the opportunity to achieve extraordinary results.
                  </p>
                </div>
              </div>

              <div className="about-hero-art">
                <div className="about-hero-photo-cropped-wrapper">
                  <div
                    className="about-hero-photo-cropped"
                    role="img"
                    aria-label="About ACT SAT GO — Personalized Learning, Intelligent Technology, Expert Mentorship"
                    style={{ backgroundImage: `url(${abImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Personalized Learning Journeys Section ── */}
        <section className="about-plj-section">
          <div className="shell about-plj-inner">

            {/* Left column: heading + description + student illustration */}
            <div className="about-plj-left">
              <p className="about-plj-eyebrow">WE DON'T JUST TEACH.</p>
              <h2 className="about-plj-title">
                We Build Personalized<br />Learning Journeys.
              </h2>
              <div className="about-plj-title-underline" aria-hidden="true" />
              <p className="about-plj-description">
                Every student learns differently and has different goals. That's why we start by understanding the learner first.
              </p>

              <div className="about-plj-illustration" aria-label="ACT SAT GO mentor working with a student" role="img">
                <img
                  src={abImg}
                  alt="ACT SAT GO mentor and student reviewing study material on a tablet"
                  className="about-plj-photo"
                />
              </div>
            </div>

            {/* Right column: 6 feature cards + quote */}
            <div className="about-plj-right">
              <div className="about-plj-cards-grid">
                {[
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <circle cx="12" cy="12" r="5" />
                        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                      </svg>
                    ),
                    title: 'Academic Goals',
                    text: 'Understanding what success looks like for each student.',
                  },
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="12" rx="1.5" />
                        <path d="M8 20h8M12 16v4" />
                        <path d="M6 12.5l3-3.2 2.6 2 4.4-4.8" strokeWidth="2" />
                      </svg>
                    ),
                    title: 'Current Strengths',
                    text: 'Identifying strengths to build confidence and momentum.',
                  },
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m21 21-3.5-3.5" />
                        <path d="M8 11h6M11 8v6" />
                      </svg>
                    ),
                    title: 'Learning Gaps',
                    text: 'Pinpointing concepts that need the right attention.',
                  },
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5.5C10.5 4.3 8 3.5 5 3.5v14c3 0 5.5.8 7 2 1.5-1.2 4-2 7-2v-14c-3 0-5.5.8-7 2Z" />
                        <path d="M12 5.5v14" />
                      </svg>
                    ),
                    title: 'Learning Style',
                    text: 'Recognizing how each student learns best.',
                  },
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 3" />
                      </svg>
                    ),
                    title: 'Right Pace',
                    text: 'Setting a pace that keeps students motivated and engaged.',
                  },
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="16" cy="8.5" r="2.6" />
                        <circle cx="9.5" cy="8" r="4" />
                        <path d="M2.5 20.5c0-4.4 3.6-6.9 7-6.9s7 2.5 7 6.9" />
                        <path d="M13 14.8c1-.5 2.2-.8 3-.8 3 0 5.5 2 5.5 5.5" />
                      </svg>
                    ),
                    title: 'Right Support',
                    text: 'Providing the right level of guidance at the right time.',
                  },
                ].map((card, idx) => (
                  <div key={idx} className="about-plj-card">
                    <span className="about-plj-card-icon" aria-hidden="true">{card.icon}</span>
                    <h4 className="about-plj-card-title">{card.title}</h4>
                    <p className="about-plj-card-text">{card.text}</p>
                  </div>
                ))}
              </div>

              {/* Bottom quote bar */}
              <div className="about-plj-quote-bar">
                <span className="about-plj-quote-star" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.4 7.3H22l-6.2 4.5 2.4 7.3L12 17.1l-6.2 4L8.2 13.8 2 9.3h7.6L12 2z" />
                  </svg>
                </span>
                <p className="about-plj-quote-text">
                  We don't fit students into our system.{' '}
                  <strong>We build a system that fits each student.</strong>
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ── Human Mentorship Meets Intelligent Technology Section ── */}
        <section className="about-tech-section">
          <div className="shell about-tech-inner">

            {/* Left column */}
            <div className="about-tech-left">
              <p className="about-tech-eyebrow">HUMAN MENTORSHIP MEETS</p>
              <h2 className="about-tech-title">Intelligent Technology.</h2>
              <div className="about-tech-title-underline" aria-hidden="true" />

              <p className="about-tech-description">
                Our experienced mentors bring empathy, expertise, and encouragement.<br />
                Our technology brings deep insights.
              </p>

              <p className="about-tech-tagline">
                Together, they create better learning decisions and better results.
              </p>

              {/* Tech card */}
              <div className="about-tech-card">
                <div className="about-tech-card-header">
                  <span className="about-tech-card-dot" aria-hidden="true" />
                  <span className="about-tech-card-dot" aria-hidden="true" />
                  <span className="about-tech-card-dot" aria-hidden="true" />
                </div>
                <h4 className="about-tech-card-title">Our Technology Tracks What Matters</h4>
                <p className="about-tech-card-text">
                  Insights that empower our mentors to guide students with precision, not guesswork.
                </p>
                <div className="about-tech-card-icon" aria-hidden="true">
                  <svg viewBox="0 0 48 32" fill="none">
                    <rect x="0" y="18" width="8" height="14" rx="2" fill="rgba(255,255,255,0.4)" />
                    <rect x="10" y="10" width="8" height="22" rx="2" fill="rgba(255,255,255,0.6)" />
                    <rect x="20" y="14" width="8" height="18" rx="2" fill="rgba(255,255,255,0.5)" />
                    <rect x="30" y="4" width="8" height="28" rx="2" fill="white" />
                    <rect x="40" y="8" width="8" height="24" rx="2" fill="rgba(255,255,255,0.7)" />
                    <path d="M4 15 L14 8 L24 11 L34 2 L44 5" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {/* Bottom quote bar */}
              <div className="about-tech-quote-bar">
                <span className="about-tech-quote-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.3H22l-6.2 4.5 2.4 7.3L12 17.1l-6.2 4L8.2 13.8 2 9.3h7.6L12 2z" /></svg>
                </span>
                <p className="about-tech-quote-text">
                  Technology doesn't replace teachers.{' '}
                  <strong>It empowers them to teach better.</strong>
                </p>
              </div>
            </div>

            {/* Right column — circular diagram */}
            <div className="about-tech-right">
              <div className="about-tech-orbit">

                {/* Center photo */}
                <div className="about-tech-orbit-center">
                  <div
                    className="about-tech-orbit-photo"
                    role="img"
                    aria-label="Mentor and student working together with technology"
                    style={{ backgroundImage: `url(${abOrbitImg})` }}
                  />
                </div>

                {/* Orbiting data-point nodes */}
                {[
                  { label: 'Time Invested',    desc: 'How much time a student spends practicing',     pos: 'top' },
                  { label: 'Concept Mastery',  desc: 'Which topics are mastered and where support is needed', pos: 'top-right' },
                  { label: 'Mistake Patterns', desc: 'Which mistakes are repeated and why',            pos: 'bottom-right' },
                  { label: 'Growth Over Time', desc: 'How performance evolves over time',              pos: 'bottom' },
                  { label: 'Confidence Growth',desc: 'Where confidence is building and where it needs strengthening', pos: 'bottom-left' },
                  { label: 'Focus Areas',      desc: 'Which topics receive the most attention',        pos: 'top-left' },
                ].map((node) => (
                  <div key={node.label} className={`about-tech-node about-tech-node--${node.pos}`}>
                    <div className="about-tech-node-icon" aria-hidden="true">
                      {node.pos === 'top' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
                      )}
                      {node.pos === 'top-right' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M17 8v8M12 11v5M7 15v1M2 17v1" /></svg>
                      )}
                      {node.pos === 'bottom-right' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
                      )}
                      {node.pos === 'bottom' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
                      )}
                      {node.pos === 'bottom-left' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                      )}
                      {node.pos === 'top-left' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                      )}
                    </div>
                    <p className="about-tech-node-label">{node.label}</p>
                    <p className="about-tech-node-desc">{node.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* ── Every Assignment Has a Purpose & Mission/Vision Section ── */}
        <section className="about-purpose-section">
          <div className="shell">
            {/* 4 Cards Grid */}
            <div className="purpose-cards-grid">
              {/* Card 1: Every Assignment Has a Purpose. */}
              <div className="purpose-card">
                <div className="purpose-card-header">
                  <span className="purpose-circle purpose-circle--orange">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="6" />
                      <circle cx="12" cy="12" r="2" fill="currentColor" />
                    </svg>
                  </span>
                  <h4>Every Assignment Has a Purpose.</h4>
                </div>
                <p>We create targeted practice based on data, so students focus on what truly improves their performance.</p>
                
                {/* SVG Illustration: Clipboard & Target */}
                <div className="purpose-card-graphic" aria-hidden="true">
                  <svg viewBox="0 0 120 100" fill="none" className="graphic-clipboard-target">
                    {/* Clipboard body */}
                    <rect x="25" y="15" width="55" height="75" rx="6" fill="#f8fafc" stroke="#d1d5db" strokeWidth="2" />
                    {/* Clamp */}
                    <path d="M42 15 V10 H63 V15 Z" fill="#9ca3af" rx="2" />
                    <rect x="47" y="7" width="11" height="5" rx="1.5" fill="#6b7280" />
                    {/* Lines */}
                    <line x1="38" y1="32" x2="68" y2="32" stroke="#e5e7eb" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="38" y1="44" x2="60" y2="44" stroke="#e5e7eb" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="38" y1="56" x2="55" y2="56" stroke="#e5e7eb" strokeWidth="2.5" strokeLinecap="round" />
                    
                    {/* Checkmarks */}
                    <path d="M34 32 L36 34 L40 30" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M34 44 L36 46 L40 42" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    
                    {/* Target overlapping bottom right */}
                    <circle cx="75" cy="70" r="22" fill="white" stroke="#e5e7eb" strokeWidth="1" />
                    <circle cx="75" cy="70" r="18" fill="#fffbeb" stroke="#f59b00" strokeWidth="2" />
                    <circle cx="75" cy="70" r="12" fill="white" stroke="#f59b00" strokeWidth="1.5" />
                    <circle cx="75" cy="70" r="6" fill="#f59b00" />
                    
                    {/* Arrow hitting target center */}
                    <path d="M92 53 L78 67" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                    <path d="M78 67 L83 67 M78 67 L78 62" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Fletching */}
                    <path d="M90 51 L94 55 M92 49 L96 53" stroke="#3b82f6" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>

              {/* Card 2: Smarter Preparation. Better Results. */}
              <div className="purpose-card">
                <div className="purpose-card-header">
                  <span className="purpose-circle purpose-circle--green">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                      <path d="M6 6h10M6 10h10" />
                    </svg>
                  </span>
                  <h4>Smarter Preparation. Better Results.</h4>
                </div>
                <p>Our SAT, ACT & AP programs combine expert instruction with continuous analysis for measurable score improvement.</p>
                
                {/* SVG Illustration: Book & Green Graph */}
                <div className="purpose-card-graphic" aria-hidden="true">
                  <svg viewBox="0 0 120 100" fill="none" className="graphic-book-graph">
                    {/* Open Book */}
                    <path d="M20 75 C35 75 45 78 55 83 V33 C45 28 35 25 20 25 Z" fill="#f8fafc" stroke="#d1d5db" strokeWidth="2" />
                    <path d="M90 75 C75 75 65 78 55 83 V33 C65 28 75 25 90 25 Z" fill="#f8fafc" stroke="#d1d5db" strokeWidth="2" />
                    
                    {/* Pages shadow lines */}
                    <path d="M25 35 H45 M25 45 H45 M25 55 H40 M25 65 H45" stroke="#e5e7eb" strokeWidth="2" strokeLinecap="round" />
                    <path d="M65 35 H85 M65 45 H80 M65 55 H85 M65 65 H80" stroke="#e5e7eb" strokeWidth="2" strokeLinecap="round" />
                    
                    {/* Green rising bar graph overlapping */}
                    <rect x="75" y="55" width="10" height="20" rx="1.5" fill="#10b981" opacity="0.75" />
                    <rect x="89" y="38" width="10" height="37" rx="1.5" fill="#10b981" />
                    <rect x="61" y="66" width="10" height="9" rx="1.5" fill="#10b981" opacity="0.5" />
                    
                    {/* Arrow line over the graph */}
                    <path d="M58 72 L72 61 L83 45 L94 30" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M94 30 H89 M94 30 V35" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {/* Card 3: More Than Scores. Stronger Futures. */}
              <div className="purpose-card">
                <div className="purpose-card-header">
                  <span className="purpose-circle purpose-circle--purple">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <h4>More Than Scores. Stronger Futures.</h4>
                </div>
                <p>We build confidence, discipline, curiosity and problem-solving skills that prepare students for life.</p>
                
                {/* SVG Illustration: Steps & Flag */}
                <div className="purpose-card-graphic" aria-hidden="true">
                  <svg viewBox="0 0 120 100" fill="none" className="graphic-steps-flag">
                    {/* Staircase steps */}
                    <path d="M20 80 H40 V64 H60 V48 H80 V32" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Filled steps background shadow */}
                    <path d="M20 80 H40 V64 H60 V48 H80 V32 H80 V80 H20 Z" fill="#f8fafc" opacity="0.5" />
                    
                    {/* Purple flag on top */}
                    <line x1="80" y1="32" x2="80" y2="10" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
                    <path d="M80 10 L102 18 L80 26 Z" fill="#7c3aed" stroke="#7c3aed" strokeWidth="1.5" strokeLinejoin="round" />
                    
                    {/* Stylized climbing/rising path */}
                    <path d="M25 76 L48 60 L68 44 L78 30" stroke="#a78bfa" strokeWidth="2.5" strokeDasharray="4 4" strokeLinecap="round" />
                    
                    {/* Small climbing figure/dot */}
                    <circle cx="48" cy="60" r="4.5" fill="#7c3aed" />
                    <circle cx="68" cy="44" r="4.5" fill="#7c3aed" />
                  </svg>
                </div>
              </div>

              {/* Card 4: Every Step. Backed by Data. */}
              <div className="purpose-card">
                <div className="purpose-card-header">
                  <span className="purpose-circle purpose-circle--gold">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34M12 2a6 6 0 0 1 6 6v3.5c0 3.3-2.7 6-6 6s-6-2.7-6-6V8a6 6 0 0 1 6-6z" />
                    </svg>
                  </span>
                  <h4>Every Step. Backed by Data.</h4>
                </div>
                <p>Every test. Every practice. Every recommendation is backed by meaningful insights and real learning data.</p>
                
                {/* SVG Illustration: Laptop with chart */}
                <div className="purpose-card-graphic" aria-hidden="true">
                  <svg viewBox="0 0 120 100" fill="none" className="graphic-laptop-chart">
                    {/* Laptop Screen */}
                    <rect x="22" y="20" width="76" height="50" rx="4" fill="#f8fafc" stroke="#d1d5db" strokeWidth="2.5" />
                    {/* Screen Inner */}
                    <rect x="26" y="24" width="68" height="42" fill="white" />
                    
                    {/* Base of laptop */}
                    <path d="M12 70 H108 L100 78 H20 Z" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="2.5" strokeLinejoin="round" />
                    <line x1="50" y1="74" x2="70" y2="74" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" />
                    
                    {/* Chart inside screen */}
                    {/* Bar chart left side */}
                    <rect x="32" y="52" width="6" height="10" fill="#93c5fd" />
                    <rect x="41" y="42" width="6" height="20" fill="#93c5fd" />
                    <rect x="50" y="32" width="6" height="30" fill="#3b82f6" />
                    
                    {/* Line chart right side */}
                    <path d="M62 55 L70 42 L78 48 L88 32" stroke="#f59b00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="62" cy="55" r="2" fill="#f59b00" />
                    <circle cx="70" cy="42" r="2" fill="#f59b00" />
                    <circle cx="78" cy="48" r="2" fill="#f59b00" />
                    <circle cx="88" cy="32" r="2" fill="#f59b00" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Mission & Vision Banner */}
            <div className="mission-vision-banner">
              {/* Mission */}
              <div className="mission-vision-col">
                <div className="mv-header">
                  <span className="mv-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V15" />
                    </svg>
                  </span>
                  <h3>Our Mission</h3>
                </div>
                <p>To redefine personalized education by combining exceptional mentorship with intelligent technology, empowering every student to learn more effectively, grow with confidence, and achieve their highest academic potential.</p>
              </div>

              {/* Separator Line */}
              <div className="mv-divider" aria-hidden="true" />

              {/* Vision */}
              <div className="mission-vision-col">
                <div className="mv-header">
                  <span className="mv-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </span>
                  <h3>Our Vision</h3>
                </div>
                <p>To become the world's most trusted personalized learning platform—where every student's educational journey is guided by expert mentors, powered by meaningful data, and designed around individual potential, not standardized instruction.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── The ACTSATGO Promise Section ── */}
        <section className="about-promise-section-new">
          <div className="shell">
            <div className="promise-container">
              <h2 className="promise-title">
                The <span className="promise-brand-text">ACTSAT<span className="promise-brand-go-box">GO</span></span> Promise
              </h2>

              <div className="promise-row">
                <div className="promise-item">
                  <span className="promise-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <p>Every student deserves to be understood.</p>
                </div>

                <span className="promise-divider" aria-hidden="true" />

                <div className="promise-item">
                  <span className="promise-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                  </span>
                  <p>Every learning journey deserves a strategy.</p>
                </div>

                <span className="promise-divider" aria-hidden="true" />

                <div className="promise-item">
                  <span className="promise-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </span>
                  <p>Every hour of practice should create progress.</p>
                </div>

                <span className="promise-divider" aria-hidden="true" />

                <div className="promise-item">
                  <span className="promise-item-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </span>
                  <p>Every dream deserves a team that believes in it.</p>
                </div>

                <span className="promise-divider promise-divider-strong" aria-hidden="true" />

                <div className="promise-message">
                  <p className="promise-card-sub">We're not just preparing students for exams.</p>
                  <p className="promise-card-main">
                    <strong>We're preparing them</strong>{' '}
                    <span className="promise-card-highlight">for success.</span>
                  </p>
                </div>

                {/* SVG Illustration: Rocket Blasting Off */}
                <div className="promise-card-graphic" aria-hidden="true">
                  <svg viewBox="0 0 140 140" fill="none" className="promise-rocket-svg">
                    {/* Background glow circle */}
                    <circle cx="90" cy="50" r="36" fill="#eff6ff" />
                    <circle cx="90" cy="50" r="24" fill="#dbeafe" opacity="0.6" />

                    {/* Sparkles */}
                    <path d="M115 25 L119 29 M119 25 L115 29" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M50 75 L54 79 M54 75 L50 79" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />

                    {/* Launch path line (dashed) */}
                    <path d="M30 120 C45 105 60 90 75 75" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" />

                    {/* Exhaust flames */}
                    <path d="M56 86 C52 92 48 100 48 108 C54 108 62 104 68 100 Z" fill="#f97316" />
                    <path d="M59 89 C57 93 54 98 54 103 C58 103 63 100 67 98 Z" fill="#facc15" />

                    {/* Rocket body */}
                    <path d="M62 82 L82 62 C88 56 94 40 96 34 C90 36 74 42 68 48 L48 68 Z" fill="#3b82f6" />
                    <path d="M52 72 L72 52 C76 48 80 44 86 42 C82 48 78 52 74 56 L54 76 Z" fill="#2563eb" />

                    {/* Nose cone */}
                    <path d="M84 46 C88 42 94 36 96 34 C94 36 88 42 84 46 Z" fill="#1d4ed8" />

                    {/* Wings */}
                    <path d="M48 68 L36 74 L42 86 L52 82 Z" fill="#1e3a8a" />
                    <path d="M68 48 L74 36 L86 42 L82 52 Z" fill="#1e3a8a" />

                    {/* Window */}
                    <circle cx="68" cy="62" r="5" fill="#ffffff" stroke="#1d4ed8" strokeWidth="2" />
                    <circle cx="68" cy="62" r="2.5" fill="#93c5fd" />
                  </svg>
                </div>
              </div>
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
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about-us">About Us</Link></li>
              <li><a href="/#programs">Courses</a></li>
              <li><a href="/#programs">Career</a></li>
              <li><a href="/#resources">Blogs</a></li>
              <li><a href="/consultation">Contact</a></li>
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
