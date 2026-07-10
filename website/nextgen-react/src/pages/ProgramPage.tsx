import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Brand } from '../components/Brand';
import { CountUp } from '../components/CountUp';
import { useScrollReveal } from '../hooks/useScrollReveal';
import type { ProgramPageData } from '../data/programs';
import apHeroImg from '../assets/ap-hero.png';
import satHeroImg from '../assets/sat-hero.png';
import highlightsImg from '../assets/highlights-girl-cutout.png';

const CONSULT_HREF = '/#consultation';

function getHighlightIcon(label: string, value: string) {
  const t = (label + ' ' + value).toLowerCase();
  if (t.includes('college') || t.includes('credit')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9 12 3l9 6" />
        <path d="M5 9v10M9 9v10M15 9v10M19 9v10" />
        <path d="M3 21h18" />
      </svg>
    );
  }
  if (t.includes('recogni') || t.includes('global')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18" />
        <path d="M12 3a14 14 0 0 0 0 18" />
      </svg>
    );
  }
  if (t.includes('scholarship') || t.includes('tuition') || t.includes('saved')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 20h18" />
        <path d="M6 20v-6" />
        <path d="M12 20V8" />
        <path d="M18 20v-10" />
        <path d="M14 4 20 4 20 10" />
        <path d="M20 4 12 12" />
      </svg>
    );
  }
  if (t.includes('date') || t.includes('flexible')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="9" r="6" />
        <path d="m8.5 14-2 7 5.5-3 5.5 3-2-7" />
      </svg>
    );
  }
  if (t.includes('composite') || t.includes('score') || t.includes('perfect')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (t.includes('mentor') || t.includes('support')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 20c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function getHeroBulletIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('instructor') || t.includes('tutor') || t.includes('strateg')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="6"></circle>
        <circle cx="12" cy="12" r="2"></circle>
      </svg>
    );
  }
  if (t.includes('learn') || t.includes('mentor')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
        <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
      </svg>
    );
  }
  if (t.includes('college') || t.includes('placement') || t.includes('data') || t.includes('progress')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
    </svg>
  );
}

function getStepIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('diagnostic')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V4" />
        <path d="M9 12h6M9 15.5h6M9 8.5h4" />
      </svg>
    );
  }
  if (t.includes('plan')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6.5C10.5 5.3 8 4.5 5 4.5v13c3 0 5.5.8 7 2 1.5-1.2 4-2 7-2v-13c-3 0-5.5.8-7 2Z" />
      </svg>
    );
  }
  if (t.includes('learn')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h16v11H9l-5 4V5Z" />
        <circle cx="8.5" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="12" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (t.includes('practice') || t.includes('analy')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="12" rx="1.5" />
        <path d="M8 20h8M12 16v4" />
        <path d="M6 12.5l3-3.2 2.6 2 4.4-4.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10v4a5 5 0 0 1-10 0Z" />
      <path d="M7 5H4.5A1.5 1.5 0 0 0 3 6.5c0 1.8 1.4 3.3 3.2 3.5" />
      <path d="M17 5h2.5A1.5 1.5 0 0 1 21 6.5c0 1.8-1.4 3.3-3.2 3.5" />
      <path d="M12 13v3M9 20h6M10 16h4l.6 4H9.4Z" />
    </svg>
  );
}

function getCurriculumIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('read') || t.includes('literat') || t.includes('english') || t.includes('humanities')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6.5C10.5 5.3 8 4.5 5 4.5v13c3 0 5.5.8 7 2 1.5-1.2 4-2 7-2v-13c-3 0-5.5.8-7 2Z" />
      </svg>
    );
  }
  if (t.includes('writ') || t.includes('grammar') || t.includes('language')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );
  }
  if (t.includes('math')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h2M12.5 11h2M17 11h0M8 15h2M12.5 15h2M17 15h0" />
      </svg>
    );
  }
  if (t.includes('science')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2h6M10 2v6.5L4.8 18a1.8 1.8 0 0 0 1.6 2.7h11.2a1.8 1.8 0 0 0 1.6-2.7L14 8.5V2" />
        <path d="M7.5 14.5h9" />
      </svg>
    );
  }
  if (t.includes('credit') || t.includes('college')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 2 8l10 5 10-5-10-5Z" />
        <path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" />
      </svg>
    );
  }
  if (t.includes('gpa') || t.includes('boost')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="12" rx="1.5" />
        <path d="M8 20h8M12 16v4" />
        <path d="M6 12.5l3-3.2 2.6 2 4.4-4.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 21l1.2-6.5-4.8-4.6 6.6-.9Z" />
    </svg>
  );
}

function getChooseIcon(index: number) {
  const icons = [
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4.5 20c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" /></svg>,
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h2M12.5 11h2M17 11h0M8 15h2M12.5 15h2M17 15h0" /></svg>,
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2.3h6c0-1.1.4-1.8 1-2.3A7 7 0 0 0 12 2Z" /></svg>,
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
  ];
  return icons[index % icons.length];
}

const WHY_CHOOSE_ITEMS = [
  { title: 'Expert Ivy League Mentors', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2 8l10 5 10-5-10-5Z" /><path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" /></svg> },
  { title: 'Live Interactive Classes', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M9 21h6M12 17v4" /><path d="M9.5 8.5 13 11l-3.5 2.5Z" /></svg> },
  { title: '1000+ Practice Questions', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v4h4" /><path d="M9 15.5h6M9 12h6M9 8.5h2" /></svg> },
  { title: '100+ Full Length Mocks', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V4" /><path d="M9 13l2 2 4-4.2" /></svg> },
  { title: 'Performance Tracking', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /><path d="M6 12.5l3-3.2 2.6 2 4.4-4.8" /></svg> },
  { title: 'Dedicated Student Support', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4V5Z" /><circle cx="8.5" cy="10.5" r="0.8" fill="currentColor" stroke="none" /><circle cx="12" cy="10.5" r="0.8" fill="currentColor" stroke="none" /><circle cx="15.5" cy="10.5" r="0.8" fill="currentColor" stroke="none" /></svg> },
];

const CTA_BENEFITS = [
  { title: 'Expert Counselors', text: 'Ivy League Trained', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4.5 20c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" /></svg> },
  { title: 'Personalized Roadmap', text: 'For Your Target Score', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg> },
  { title: 'Proven Results', text: '90%+ Students Improve', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M8 20h8M12 16v4" /><path d="M6 12.5l3-3.2 2.6 2 4.4-4.8" /></svg> },
  { title: 'Ongoing Support', text: 'Till You Achieve', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0Z" /><path d="M7 5H4.5A1.5 1.5 0 0 0 3 6.5c0 1.8 1.4 3.3 3.2 3.5" /><path d="M17 5h2.5A1.5 1.5 0 0 1 21 6.5c0 1.8-1.4 3.3-3.2 3.5" /><path d="M12 13v3M9 20h6M10 16h4l.6 4H9.4Z" /></svg> },
];

export function ProgramPage({ data }: { data: ProgramPageData }) {
  useScrollReveal();

  // Each program page should open at the top and carry a descriptive title.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${data.exam} Preparation — ACT SAT GO`;
  }, [data.exam]);

  const isAp = data.slug === 'ap';
  const isSat = data.slug === 'sat';
  const isAct = data.slug === 'act';

  return (
    <>
      <Header />

      <main>
        {/* Hero */}
        <section className={`prog-hero section-dark${(isSat || isAct) ? ' sat-page' : ''}`}>
          <span className="orb orb-gold" aria-hidden="true" />
          <span className="orb orb-ring" aria-hidden="true" />
          <div className="shell prog-hero-grid">
            <div className="prog-hero-copy">
              <span className="eyebrow-hero">{data.heroEyebrow}</span>
              <h1>
                {data.heroTitle.map((run, i) =>
                  run.gold ? <span key={i}>{run.text}</span> : <span key={i} className="plain">{run.text}</span>,
                )}
              </h1>
              <p className="hero-text">{data.heroText}</p>

              <div className="hero-bullets-grid">
                {data.heroBullets.map((b) => (
                  <div key={b.title} className="hero-bullet-item">
                    <span className="bullet-icon-wrapper">
                      {getHeroBulletIcon(b.title)}
                    </span>
                    <div className="bullet-text">
                      <strong>{b.title}</strong>
                      <span>{b.text}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hero-actions-new">
                <a className="btn btn-primary" href="#programs">{data.primaryCta} <span aria-hidden="true">→</span></a>
                <a className="btn btn-outline" href={CONSULT_HREF}>
                  {data.secondaryCta}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px', marginLeft: '6px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </a>
              </div>
            </div>

            {isAp ? (
              <div className="prog-hero-art ap-hero-art" aria-hidden="true">
                <div
                  className="ap-hero-illustration"
                  style={{ backgroundImage: `url(${apHeroImg})` }}
                />

                <div className="orbit-card badge-ap-strategy">
                  <div className="badge-icon-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="6"></circle>
                      <circle cx="12" cy="12" r="2"></circle>
                    </svg>
                  </div>
                  <span>Smart Strategy</span>
                </div>

                <div className="orbit-card badge-ap-concepts">
                  <div className="badge-icon-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .4 2.5 1.5 3.5.7.8 1.3 1.5 1.5 2.5"></path>
                      <line x1="9" y1="18" x2="15" y2="18"></line>
                      <line x1="10" y1="22" x2="14" y2="22"></line>
                    </svg>
                  </div>
                  <span>Deep Concepts</span>
                </div>

                <div className="orbit-card badge-ap-scores">
                  <div className="badge-icon-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                      <path d="M4 22h16"></path>
                      <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path>
                      <path d="M12 2a6 6 0 0 1 6 6v3.5c0 3.3-2.7 6-6 6s-6-2.7-6-6V8a6 6 0 0 1 6-6z"></path>
                    </svg>
                  </div>
                  <span>Top Scores & Credit</span>
                </div>
              </div>
            ) : (isSat || isAct) ? (
              <div className="hero-art" aria-hidden="true">
                <div className="sat-hero-img" style={{ backgroundImage: `url(${satHeroImg})` }} />

                <div className="orbit-card badge-target">
                  <div className="badge-icon-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="6"></circle>
                      <circle cx="12" cy="12" r="2"></circle>
                    </svg>
                  </div>
                  <span>Target Score</span>
                </div>

                <div className="orbit-card badge-track">
                  <div className="badge-icon-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"></line>
                      <line x1="12" y1="20" x2="12" y2="4"></line>
                      <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                  </div>
                  <span>Track Progress</span>
                </div>

                <div className="orbit-card badge-strategy">
                  <div className="badge-icon-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .4 2.5 1.5 3.5.7.8 1.3 1.5 1.5 2.5"></path>
                      <line x1="9" y1="18" x2="15" y2="18"></line>
                      <line x1="10" y1="22" x2="14" y2="22"></line>
                    </svg>
                  </div>
                  <span>Smart Strategy</span>
                </div>

                <div className="orbit-card badge-success">
                  <div className="badge-icon-bg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                      <path d="M4 22h16"></path>
                      <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path>
                      <path d="M12 2a6 6 0 0 1 6 6v3.5c0 3.3-2.7 6-6 6s-6-2.7-6-6V8a6 6 0 0 1 6-6z"></path>
                    </svg>
                  </div>
                  <span>Achieve Success</span>
                </div>
              </div>
            ) : (
              <div className="prog-hero-art" aria-hidden="true">
                <div className="exam-orb"><span>{data.exam}</span></div>
                <div className="orbit-badge badge-1">Smart Strategy</div>
                <div className="orbit-badge badge-2">Target Score</div>
                <div className="orbit-badge badge-3">Track Progress</div>
                <div className="orbit-badge badge-4">Achieve Success</div>
              </div>
            )}
          </div>
        </section>

        {/* Highlights band */}
        <section className="prog-highlights shell" aria-label={`${data.exam} highlights`}>
          <div className="highlights-row">
            <div className="highlights-text">
              <div className="section-heading reveal">
                <p className="eyebrow">{data.highlightsEyebrow}</p>
                <h2>{data.highlightsHeading}</h2>
                <p>{data.highlightsText}</p>
              </div>
              <div className="highlight-grid">
                {data.highlights.map((h, i) => (
                  <article key={h.label} className="highlight-card reveal" style={{ transitionDelay: `${i * 70}ms` }}>
                    <span className="highlight-icon" aria-hidden="true">{getHighlightIcon(h.label, h.value)}</span>
                    <strong>{h.value}</strong>
                    <span>{h.label}</span>
                  </article>
                ))}
              </div>
            </div>
            <div className="highlights-photo reveal" aria-hidden="true">
              <img src={highlightsImg} alt="" />
            </div>
          </div>
        </section>

        {/* 5-step approach */}
        <section className="prog-steps section-light">
          <div className="shell">
            <div className="section-heading center reveal">
              <p className="eyebrow">Our {data.exam} Prep Approach</p>
              <h2>{data.stepsHeading}</h2>
            </div>
            <div className="step-flow">
              {data.steps.map((s, i) => (
                <article key={s.n} className="step-card reveal" style={{ transitionDelay: `${i * 70}ms` }}>
                  {i > 0 && <span className="step-connector" aria-hidden="true" />}
                  <span className="step-icon" aria-hidden="true">{getStepIcon(s.title)}</span>
                  <span className="step-num">Step {s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Program tiers */}
        <section className="prog-tiers" id="programs">
          <div className="shell">
            <div className="section-heading center reveal">
              <p className="eyebrow">{data.tiersEyebrow}</p>
              <h2>{data.tiersHeading}</h2>
              <p>{data.tiersText}</p>
            </div>
            <p className="tier-table-kicker reveal">— Our {data.exam} Prep Programs —</p>
            <div className="tier-table-wrap reveal">
              <table className="tier-table">
                <thead>
                  <tr>
                    <th className="tt-num">#</th>
                    <th className="tt-program">Program</th>
                    <th>Duration</th>
                    <th>Ideal For</th>
                    <th>Key Highlights</th>
                    <th>Price (USD)</th>
                    <th>Explore</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tiers.map((t, i) => (
                    <tr key={t.name} style={{ ['--accent' as string]: t.accent }}>
                      <td className="tt-num"><span className="tt-num-badge">{i + 1}</span></td>
                      <td className="tt-program">
                        <span className="tt-program-icon" aria-hidden="true">{t.icon}</span>
                        <div>
                          <strong>{t.name}</strong>
                          {t.tag && <span className="tt-tag">{t.tag}</span>}
                        </div>
                      </td>
                      <td className="tt-duration">{t.weeks}</td>
                      <td className="tt-ideal">{t.idealFor}</td>
                      <td className="tt-highlights">
                        <ul>
                          {t.features.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="tt-price">
                        <strong>{t.price}</strong>
                        {t.oldPrice && <s>{t.oldPrice}</s>}
                      </td>
                      <td className="tt-explore">
                        <a className="tt-explore-btn" href={CONSULT_HREF} aria-label={`Explore ${t.name}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Curriculum */}
        <section className="prog-curriculum shell">
          <div className="section-heading center reveal">
            <p className="eyebrow">What You'll Learn</p>
            <h2>{data.curriculumHeading}</h2>
          </div>
          <div className="curriculum-grid">
            {data.curriculum.map((c, i) => (
              <article key={c.title} className="curriculum-card reveal" style={{ transitionDelay: `${i * 70}ms`, ['--accent' as string]: c.accent }}>
                <div className="curriculum-card-head">
                  <span className="curriculum-icon" aria-hidden="true">{getCurriculumIcon(c.title)}</span>
                  <h3>{c.title}</h3>
                </div>
                <ul>
                  {c.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* Everything you need */}
        <section className="prog-why shell">
          <div className="section-heading center reveal">
            <p className="eyebrow">Why Choose ACT SAT GO?</p>
            <h2>Everything You Need. All in One Place.</h2>
          </div>
          <div className="why-grid">
            {WHY_CHOOSE_ITEMS.map((w, i) => (
              <div key={w.title} className="why-item reveal" style={{ transitionDelay: `${i * 60}ms` }}>
                <span className="why-icon" aria-hidden="true">{w.icon}</span>
                <span>{w.title}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison table */}
        {data.compareCols && data.compareRows && (
          <section className="prog-compare section-light">
            <div className="shell">
              <div className="section-heading center reveal">
                <h2>{data.compareHeading}</h2>
              </div>
              <div className="compare-wrap reveal">
                <table className="prog-compare-table">
                  <thead>
                    <tr>
                      <th>Features</th>
                      {data.compareCols.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.compareRows.map((row) => (
                      <tr key={row.feature}>
                        <th scope="row">{row.feature}</th>
                        {row.values.map((v, i) => (
                          <td key={i} className={v === '✓' ? 'yes' : v === '✗' ? 'no' : undefined}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Help you choose */}
        <section className="prog-choose shell">
          <div className="section-heading center reveal">
            <p className="eyebrow">Not Sure Which Program Is Right For You?</p>
            <h2>{data.chooseHeading}</h2>
          </div>
          <div className="choose-grid">
            {data.chooseItems.map((c, i) => (
              <article key={c.choose} className="choose-card reveal" style={{ transitionDelay: `${i * 70}ms`, ['--accent' as string]: c.accent }}>
                {i > 0 && <span className="choose-connector" aria-hidden="true" />}
                <span className="choose-icon" aria-hidden="true">{getChooseIcon(i)}</span>
                <p>{c.prompt}</p>
                <span className="choose-label">Choose</span>
                <strong>{c.choose}</strong>
              </article>
            ))}
          </div>
        </section>

        {/* CTA + stats */}
        <section className="prog-cta section-dark" id="consultation">
          <span className="orb orb-gold" aria-hidden="true" />
          <div className="shell">
            <div className="prog-cta-banner">
              <div>
                <h2>Still Not Sure Which Program Fits You?</h2>
                <p>
                  Book a <strong>FREE 1-on-1 {data.exam} Consultation</strong> with our expert counselors.
                  We'll assess your level, understand your goals, and recommend the best learning path for you.
                </p>
              </div>
              <div className="prog-cta-actions">
                <a className="btn btn-primary" href={CONSULT_HREF}>Book Free Consultation <span aria-hidden="true">-&gt;</span></a>
                <a className="btn btn-outline" href={CONSULT_HREF}>Talk to an Expert</a>
              </div>
            </div>
            <div className="prog-cta-benefits">
              {CTA_BENEFITS.map((b) => (
                <div key={b.title} className="prog-cta-benefit">
                  <span className="prog-cta-benefit-icon" aria-hidden="true">{b.icon}</span>
                  <div>
                    <strong>{b.title}</strong>
                    <span>{b.text}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="prog-stats">
              {data.stats.map((s) => (
                <div key={s.label}>
                  <CountUp value={s.value} />
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
              <li><a href="/#consultation">Contact</a></li>
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
    </>
  );
}
