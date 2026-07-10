import { useState, useRef, useEffect } from 'react';
import { Header } from '../components/Header';
import careerHeroImg from '../assets/career-hero.jpeg';
import careerPartnerImg from '../assets/career-partner.png';
import { QUERY_API_BASE } from '../config';
import { fetchJobs, type Job } from '../admin/api';

/* ─────────────────────────────────────────────
   DATA
───────────────────────────────────────────── */

const DEFAULT_JOBS = [
  {
    id: 'job_1',
    dept: 'Academics',
    title: 'SAT / ACT Tutor (Math)',
    location: 'Remote (Global)',
    type: 'Full-time / Part-time',
    desc: 'Guide students to master math concepts, ace standardized tests and achieve their dream scores.',
  },
  {
    id: 'job_2',
    dept: 'Academics',
    title: 'SAT/ACT Tutor (Verbal)',
    location: 'Remote (Global)',
    type: 'Full-time / Part-time',
    desc: 'Help students excel in Reading & Writing sections of SAT and ACT with proven strategies.',
  },
  {
    id: 'job_3',
    dept: 'Academics',
    title: 'AP Calculus',
    location: 'Remote (Global)',
    type: 'Full-time / Part-time',
    desc: 'Teach AP Calculus AB/BC, preparing high school students for top AP scores.',
  },
  {
    id: 'job_4',
    dept: 'Academics',
    title: 'AP Biology',
    location: 'Remote (Global)',
    type: 'Full-time / Part-time',
    desc: 'Deliver comprehensive coaching in AP Biology concepts and experimental design.',
  },
  {
    id: 'job_5',
    dept: 'Academics',
    title: 'AP Computer Science',
    location: 'Remote (Global)',
    type: 'Full-time / Part-time',
    desc: 'Help students master coding, algorithms, and AP Computer Science exam topics.',
  },
  {
    id: 'job_6',
    dept: 'Operations',
    title: 'Operations Manager',
    location: 'Remote (Global)',
    type: 'Full-time',
    desc: 'Oversee daily operations, optimize scheduling, and manage coordinator teams.',
  },
  {
    id: 'job_7',
    dept: 'Student Success',
    title: 'Student Success Specialist',
    location: 'Remote (Global)',
    type: 'Full-time',
    desc: 'Support student academic journeys, coordinate between parents and mentors.',
  },
  {
    id: 'job_8',
    dept: 'Student Success',
    title: 'Student Success Executive',
    location: 'Remote (Global)',
    type: 'Full-time',
    desc: 'Manage onboarding, build parent relationships, and ensure high student satisfaction.',
  },
  {
    id: 'job_9',
    dept: 'Operations',
    title: 'Assessment and Testing Coordinator',
    location: 'Remote (Global)',
    type: 'Full-time',
    desc: 'Schedule and coordinate practice tests, analyze student performance metrics.',
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [phoneLocalNumber, setPhoneLocalNumber] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    subject: '',
    testPrep: [] as string[],
    grades: '',
    hourlyRate: '',
    videoUrl: '',
    remarks: '',
  });
  const [cvFile, setCvFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const TEST_PREP_OPTIONS = ['SAT', 'ACT', 'AP', 'K-12', 'Other'];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJobs();
        if (!cancelled) {
          setJobs(data.length > 0 ? data : (DEFAULT_JOBS as unknown as Job[]));
        }
      } catch (err) {
        console.error('Failed to load jobs, using defaults:', err);
        if (!cancelled) {
          setJobs(DEFAULT_JOBS as unknown as Job[]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleApplyClick = (jobTitle: string) => {
    let subject = jobTitle;
    let testPrep: string[] = [];
    
    if (jobTitle.toLowerCase().includes('sat') || jobTitle.toLowerCase().includes('act')) {
      testPrep = ['SAT', 'ACT'];
    } else if (jobTitle.toLowerCase().includes('ap')) {
      testPrep = ['AP'];
    }

    setForm((f) => ({
      ...f,
      subject,
      testPrep,
    }));

    const formEl = document.getElementById('apply-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleTestPrepChange = (option: string) => {
    setForm(f => {
      const exists = f.testPrep.includes(option);
      const testPrep = exists 
        ? f.testPrep.filter(t => t !== option)
        : [...f.testPrep, option];
      return { ...f, testPrep };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('CV file size must be under 5MB.');
      return;
    }

    const validExtensions = ['pdf', 'doc', 'docx'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !validExtensions.includes(fileExt)) {
      setErrorMsg('Only PDF, DOC, or DOCX files are allowed.');
      return;
    }

    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = () => {
      setCvFile({
        name: file.name,
        type: file.type,
        data: reader.result as string,
      });
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read the CV file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !phoneLocalNumber.trim()) {
      setErrorMsg('Name, Email, and WhatsApp number are required.');
      return;
    }
    if (!cvFile) {
      setErrorMsg('Please upload your CV.');
      return;
    }

    setSubmitStatus('submitting');
    setErrorMsg('');

    try {
      const response = await fetch(`${QUERY_API_BASE}/api/queries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: `${phoneCountryCode} ${phoneLocalNumber}`.trim(),
          city: form.city,
          subject: form.subject,
          testPrep: form.testPrep,
          grades: form.grades,
          hourlyRate: form.hourlyRate,
          cvFile,
          videoUrl: form.videoUrl,
          message: form.remarks,
          remarks: form.remarks,
          type: 'Tutor',
        }),
      });

      if (response.ok) {
        setSubmitStatus('success');
        setPhoneCountryCode('+1');
        setPhoneLocalNumber('');
        setForm({
          name: '',
          email: '',
          phone: '',
          city: '',
          subject: '',
          testPrep: [],
          grades: '',
          hourlyRate: '',
          videoUrl: '',
          remarks: '',
        });
        setCvFile(null);
      } else {
        const data = await response.json().catch(() => ({}));
        setErrorMsg(data.error || 'Failed to submit application.');
        setSubmitStatus('error');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error. Failed to reach the server.');
      setSubmitStatus('error');
    }
  };

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

            {/* Job cards */}
            <div className="careers-jobs-grid">
              {jobs.map((job) => (
                <article key={job.id || job.title} className="careers-job-card">
                  <h3 className="careers-job-title" style={{ marginTop: 0 }}>{job.title}</h3>
                  <p className="careers-job-location">{job.location}</p>
                  <p className="careers-job-desc">{job.desc}</p>
                  <div className="careers-job-footer">
                    <span className="careers-job-badge">{job.type}</span>
                    <button
                      type="button"
                      onClick={() => handleApplyClick(job.title)}
                      className="careers-job-apply-btn"
                    >
                      Apply Now →
                    </button>
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
              <button
                type="button"
                onClick={() => {
                  const formEl = document.getElementById('apply-form');
                  if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                }}
                className="careers-partner-btn"
              >
                Learn More →
              </button>
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

        {/* ── Tutor Application Form ── */}
        <section id="apply-form" className="careers-form-section">
          <div className="shell">
            <div className="careers-form-grid">
              
              {/* Form Info Panel */}
              <div className="careers-form-info">
                <span className="careers-section-eyebrow">WORK WITH US</span>
                <h2 className="careers-form-title">
                  Become an ACT SAT GO Tutor
                </h2>
                <p className="careers-form-desc">
                  We are always looking for exceptional, student-first mentors. Join our network of elite educators, set your own flexible hours, and tutor students globally from the comfort of your home.
                </p>
                
                <div className="careers-form-requirements">
                  <h3>What we look for:</h3>
                  <ul>
                    <li>
                      <span className="req-check">✓</span> High-scoring academic backgrounds (SAT 1500+, ACT 34+, or AP 5/5 preferred).
                    </li>
                    <li>
                      <span className="req-check">✓</span> Empathy, patience, and strong communication skills.
                    </li>
                    <li>
                      <span className="req-check">✓</span> Ability to teach in a structured, interactive 1-on-1 online format.
                    </li>
                    <li>
                      <span className="req-check">✓</span> A reliable, quiet workspace with high-speed internet and tutoring equipment.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Form Card */}
              <div className="careers-form-card">
                {submitStatus === 'success' ? (
                  <div className="careers-form-success animate-fade-in">
                    <div className="success-icon-badge">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h3>Application Submitted!</h3>
                    <p>
                      Thank you for applying. Our academic coordinators will review your CV and video introduction. We will contact you via WhatsApp or Email if your profile matches our requirements.
                    </p>
                    <button className="btn-reset-form" onClick={() => setSubmitStatus('idle')}>
                      Submit Another Application
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="careers-application-form">
                    <h3 className="form-legend">Apply for Tutoring Position</h3>
                    
                    {errorMsg && (
                      <div className="careers-form-error-banner animate-fade-in" role="alert">
                        {errorMsg}
                      </div>
                    )}

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="name">Full Name *</label>
                        <input
                          type="text"
                          id="name"
                          placeholder="e.g. Jane Doe"
                          required
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="email">Email Address *</label>
                        <input
                          type="email"
                          id="email"
                          placeholder="name@example.com"
                          required
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="phone">Contact Number (WhatsApp) *</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select
                            style={{
                              width: '120px',
                              padding: '0 8px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              color: 'white',
                              outline: 'none',
                              fontFamily: 'inherit',
                              fontSize: '14.5px',
                            }}
                            value={phoneCountryCode}
                            onChange={(e) => setPhoneCountryCode(e.target.value)}
                          >
                            <option style={{ backgroundColor: '#111827', color: 'white' }} value="+1">+1 (US)</option>
                            <option style={{ backgroundColor: '#111827', color: 'white' }} value="+91">+91 (IN)</option>
                            <option style={{ backgroundColor: '#111827', color: 'white' }} value="+44">+44 (UK)</option>
                            <option style={{ backgroundColor: '#111827', color: 'white' }} value="+971">+971 (AE)</option>
                            <option style={{ backgroundColor: '#111827', color: 'white' }} value="+65">+65 (SG)</option>
                            <option style={{ backgroundColor: '#111827', color: 'white' }} value="+61">+61 (AU)</option>
                            <option style={{ backgroundColor: '#111827', color: 'white' }} value="+966">+966 (SA)</option>
                            <option style={{ backgroundColor: '#111827', color: 'white' }} value="+974">+974 (QA)</option>
                            <option style={{ backgroundColor: '#111827', color: 'white' }} value="+968">+968 (OM)</option>
                            <option style={{ backgroundColor: '#111827', color: 'white' }} value="+965">+965 (KW)</option>
                            <option style={{ backgroundColor: '#111827', color: 'white' }} value="+973">+973 (BH)</option>
                            <option style={{ backgroundColor: '#111827', color: 'white' }} value="+852">+852 (HK)</option>
                          </select>
                          <input
                            type="tel"
                            id="phone"
                            placeholder="555 123 4567"
                            required
                            style={{ flex: 1 }}
                            value={phoneLocalNumber}
                            onChange={(e) => setPhoneLocalNumber(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label htmlFor="city">City / Location *</label>
                        <input
                          type="text"
                          id="city"
                          placeholder="e.g. Boston, USA"
                          required
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="subject">Subject / Expertise *</label>
                        <input
                          type="text"
                          id="subject"
                          placeholder="e.g. SAT Math, AP Physics"
                          required
                          value={form.subject}
                          onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="hourlyRate">Expected Hourly Rate (USD) *</label>
                        <input
                          type="text"
                          id="hourlyRate"
                          placeholder="e.g. $35/hr"
                          required
                          value={form.hourlyRate}
                          onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="grades">Grades / Target Audiences *</label>
                      <input
                        type="text"
                        id="grades"
                        placeholder="e.g. Grades 9-12, College"
                        required
                        value={form.grades}
                        onChange={(e) => setForm({ ...form, grades: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Test Prep Specializations (Select Multiple) *</label>
                      <div className="test-prep-checklist">
                        {TEST_PREP_OPTIONS.map((option) => (
                          <label key={option} className="checklist-item">
                            <input
                              type="checkbox"
                              checked={form.testPrep.includes(option)}
                              onChange={() => handleTestPrepChange(option)}
                            />
                            <span className="checklist-label">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="cv-upload" className="cv-upload-label">
                        Upload CV (PDF, DOC, DOCX - Max 5MB) *
                      </label>
                      <div className="file-uploader-box">
                        <input
                          type="file"
                          ref={fileInputRef}
                          id="cv-upload"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                        />
                        <button
                          type="button"
                          className="file-select-btn"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Select CV File
                        </button>
                        <span className="file-name-display">
                          {cvFile ? cvFile.name : 'No file chosen'}
                        </span>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="videoUrl">Tutoring Video Introduction Link *</label>
                      <input
                        type="url"
                        id="videoUrl"
                        placeholder="e.g. Loom, YouTube, Google Drive link"
                        required
                        value={form.videoUrl}
                        onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                      />
                      <span className="field-hint">Please provide a 2-3 min video link explaining a concept or introducing yourself.</span>
                    </div>

                    <div className="form-group">
                      <label htmlFor="remarks">Remarks (If Any)</label>
                      <textarea
                        id="remarks"
                        rows={3}
                        placeholder="Any additional details or schedule preferences..."
                        value={form.remarks}
                        onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitStatus === 'submitting'}
                      className="form-submit-btn"
                    >
                      {submitStatus === 'submitting' ? 'Submitting...' : 'Submit Application'}
                    </button>
                  </form>
                )}
              </div>

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
              <button
                type="button"
                onClick={() => {
                  const formEl = document.getElementById('apply-form');
                  if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                }}
                className="careers-cta-btn"
              >
                Apply Now →
              </button>
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
