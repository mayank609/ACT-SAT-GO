import { useState } from 'react';
import { Header } from '../components/Header';
import careerHeroImg from '../assets/career-hero.jpeg';
import careerPartnerImg from '../assets/career-partner.png';

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */

const DEPARTMENTS = [
  'All Departments',
  'Academics',
  'Operations',
  'Marketing',
  'Student Success',
  'Technology',
  'Design',
  'Others',
];

const JOBS = [
  {
    dept: 'Academics',
    deptColor: '#eef4ff',
    deptText: '#2563eb',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M17 8v8M12 11v5M7 15v1M2 17v1" />
      </svg>
    ),
    title: 'SAT/ACT Mentor',
    location: 'Remote (Global)',
    type: 'Full-time',
    desc: 'Guide students to master concepts, ace tests and achieve their dream scores.',
  },
  {
    dept: 'Operations',
    deptColor: '#fff7ed',
    deptText: '#ea580c',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2" width="6" height="6" rx="1" />
        <path d="M5 12h14M5 17h14" />
        <path d="M3 7h18v3H3z" />
      </svg>
    ),
    title: 'Academic Coordinator',
    location: 'Remote (Global)',
    type: 'Full-time',
    desc: 'Ensure smooth learning journeys by coordinating classes, mentors and students.',
  },
  {
    dept: 'Student Success',
    deptColor: '#f0fdf4',
    deptText: '#16a34a',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Student Success Specialist',
    location: 'Remote (Global)',
    type: 'Full-time',
    desc: 'Be the go-to person who ensures students and parents have an exceptional experience.',
  },
  {
    dept: 'Marketing',
    deptColor: '#fdf4ff',
    deptText: '#9333ea',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l19-9-9 19-2-8-8-2z" />
      </svg>
    ),
    title: 'Growth Marketing Associate',
    location: 'Remote (Global)',
    type: 'Full-time',
    desc: 'Help more students discover us through data-driven and creative marketing.',
  },
];

const CULTURE = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    label: 'Student First',
    desc: 'Everything we do is for student success.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
    label: 'Learn & Grow',
    desc: 'We invest in your growth and celebrate progress.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    label: 'Collaborate & Win',
    desc: 'Great results come from great teamwork.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    label: 'Innovate Always',
    desc: 'We challenge the status quo to create better outcomes.',
  },
];

const PARTNER_PERKS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="8 17 12 21 16 17" />
        <line x1="12" y1="12" x2="12" y2="21" />
        <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
      </svg>
    ),
    label: 'Empower',
    desc: 'students to reach their full potential',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    label: 'Flexible',
    desc: 'collaboration that works for you',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    label: 'Exclusive',
    desc: 'resources and training support',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    label: 'Meaningful',
    desc: 'rewards for your referrals',
  },
];

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */
export function CareersPage() {
  const [activeTab, setActiveTab] = useState('All Departments');

  const filtered = activeTab === 'All Departments'
    ? JOBS
    : JOBS.filter((j) => j.dept === activeTab);

  return (
    <>
      <Header />

      <main>
        {/* ── Hero ── */}
        <section className="careers-hero-section">
          <div className="careers-hero-img-wrap">
            <img
              src={careerHeroImg}
              alt="Build the Future of Student Success — Careers at ACT SAT GO"
              className="careers-hero-img"
            />
          </div>
        </section>

        {/* ── Open Positions ── */}
        <section className="careers-jobs-section">
          <div className="shell">
            <p className="careers-section-eyebrow">OPEN POSITIONS</p>
            <h2 className="careers-jobs-title">
              Find your opportunity<br />to make an impact.
            </h2>

            {/* Filter tabs */}
            <div className="careers-tabs" role="tablist" aria-label="Filter by department">
              {DEPARTMENTS.map((dept) => (
                <button
                  key={dept}
                  role="tab"
                  aria-selected={activeTab === dept}
                  className={`careers-tab${activeTab === dept ? ' is-active' : ''}`}
                  onClick={() => setActiveTab(dept)}
                >
                  {dept}
                </button>
              ))}
            </div>

            {/* Job cards */}
            <div className="careers-jobs-grid">
              {filtered.map((job) => (
                <article key={job.title} className="careers-job-card">
                  <div
                    className="careers-job-icon"
                    style={{ background: job.deptColor, color: job.deptText }}
                  >
                    {job.icon}
                  </div>
                  <p className="careers-job-dept" style={{ color: job.deptText }}>
                    {job.dept.toUpperCase()}
                  </p>
                  <h3 className="careers-job-title">{job.title}</h3>
                  <p className="careers-job-location">{job.location}</p>
                  <p className="careers-job-desc">{job.desc}</p>
                  <div className="careers-job-footer">
                    <span className="careers-job-badge">{job.type}</span>
                    <a href="mailto:careers@actsatgo.com" className="careers-job-apply">
                      Apply Now →
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Culture ── */}
        <section className="careers-culture-section">
          <div className="shell">
            <p className="careers-section-eyebrow">OUR CULTURE</p>
            <h2 className="careers-culture-title">A place to grow, learn and make an impact.</h2>
            <div className="careers-culture-grid">
              {CULTURE.map((c) => (
                <div key={c.label} className="careers-culture-card">
                  <div className="careers-culture-icon">{c.icon}</div>
                  <p className="careers-culture-label">{c.label}</p>
                  <p className="careers-culture-desc">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Partner With Us ── */}
        <section className="careers-partner-section">
          <div className="shell careers-partner-inner">
            {/* Left copy */}
            <div className="careers-partner-copy">
              <p className="careers-section-eyebrow">PARTNER WITH US</p>
              <h2 className="careers-partner-title">
                Help more students.<br />
                <span className="careers-partner-accent">Grow</span> together.
              </h2>
              <p className="careers-partner-desc">
                We work with enthusiastic education counsellors who share our mission of empowering
                students. By collaborating with ACT SAT GO, you can provide valued guidance to
                students while creating a rewarding opportunity for yourself.
              </p>
              <div className="careers-partner-perks">
                {PARTNER_PERKS.map((p) => (
                  <div key={p.label} className="careers-partner-perk">
                    <span className="careers-partner-perk-icon">{p.icon}</span>
                    <div>
                      <strong>{p.label}</strong>
                      <span>{p.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <a href="mailto:partners@actsatgo.com" className="careers-partner-btn">
                Learn More →
              </a>
            </div>

            {/* Right image */}
            <div className="careers-partner-image-wrap">
              {/* centre ring graphic */}
              <div className="careers-partner-ring" aria-hidden="true">
                <svg viewBox="0 0 120 120" fill="none">
                  <circle cx="60" cy="60" r="58" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="6 6" />
                  <circle cx="60" cy="60" r="42" stroke="#2563eb" strokeWidth="1" strokeOpacity="0.4" />
                  <path d="M60 30c0 0 8 10 8 20s-8 20-8 20s-8-10-8-20 8-20 8-20z" fill="#2563eb" fillOpacity="0.08" />
                  <circle cx="60" cy="60" r="14" fill="#2563eb" fillOpacity="0.1" />
                  {/* people icon */}
                  <g stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M52 55a4 4 0 1 1 8 0 4 4 0 0 1-8 0z" />
                    <path d="M44 75v-2a8 8 0 0 1 8-8h16a8 8 0 0 1 8 8v2" />
                    <path d="M68 51a4 4 0 1 1 0 8" strokeOpacity="0.5" />
                    <path d="M76 75v-2a8 8 0 0 0-4-7" strokeOpacity="0.5" />
                  </g>
                </svg>
              </div>
              <img
                src={careerPartnerImg}
                alt="Education counsellor working with ACT SAT GO"
                className="careers-partner-img"
              />
            </div>
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="careers-cta-section">
          <div className="shell careers-cta-inner">
            <div className="careers-cta-copy">
              <p className="careers-cta-eyebrow">MAKE AN IMPACT</p>
              <h2 className="careers-cta-title">
                Build a career that<br />makes a <span className="careers-cta-accent">difference.</span>
              </h2>
              <p className="careers-cta-desc">
                Join a team where your work empowers students, supports families and creates a lasting impact.
              </p>
              <a href="mailto:careers@actsatgo.com" className="careers-cta-btn">
                Explore Openings →
              </a>
            </div>
            {/* decorative illustration */}
            <div className="careers-cta-illustration" aria-hidden="true">
              <svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* platform steps */}
                <rect x="40" y="120" width="60" height="60" rx="4" fill="#1d4ed8" />
                <rect x="110" y="90" width="60" height="90" rx="4" fill="#ffb400" />
                <rect x="180" y="60" width="60" height="120" rx="4" fill="#1d4ed8" />
                {/* flag on top */}
                <line x1="210" y1="60" x2="210" y2="20" stroke="white" strokeWidth="3" strokeLinecap="round" />
                <polygon points="210,20 240,32 210,44" fill="#ffb400" />
                {/* silhouettes */}
                {/* small person */}
                <circle cx="70" cy="108" r="8" fill="white" fillOpacity="0.7" />
                <path d="M60 120v10a10 10 0 0 0 20 0v-10" fill="white" fillOpacity="0.7" />
                {/* medium person */}
                <circle cx="140" cy="76" r="9" fill="white" fillOpacity="0.85" />
                <path d="M129 90v11a11 11 0 0 0 22 0V90" fill="white" fillOpacity="0.85" />
                {/* tall person */}
                <circle cx="210" cy="44" r="10" fill="white" />
                <path d="M198 58v12a12 12 0 0 0 24 0V58" fill="white" />
                {/* helping arm */}
                <path d="M180 76 L196 58" stroke="#ffb400" strokeWidth="2.5" strokeLinecap="round" />
                {/* leaves */}
                <ellipse cx="22" cy="150" rx="14" ry="28" fill="#1e3a5f" transform="rotate(-30 22 150)" />
                <ellipse cx="14" cy="140" rx="10" ry="22" fill="#1d4ed8" fillOpacity="0.6" transform="rotate(-50 14 140)" />
                <ellipse cx="258" cy="155" rx="14" ry="28" fill="#1e3a5f" transform="rotate(30 258 155)" />
              </svg>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
