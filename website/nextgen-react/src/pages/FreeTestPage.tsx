import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles, CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff,
  LogIn, MessageSquare, Phone, KeyRound, MonitorPlay, BarChart3,
} from 'lucide-react';
import { Header } from '../components/Header';
import { Brand } from '../components/Brand';
import { APP_LOGIN_URL, PLATFORM_API_BASE, QUERY_API_BASE } from '../config';
import { WHATSAPP_HREF, CALL_HREF } from '../components/WhatsAppButton';
import { trackLead } from '../lib/metaPixel';
import avatar1 from '../assets/avatar1.png';
import avatar2 from '../assets/avatar2.png';
import avatar3 from '../assets/avatar3.png';
import avatar4 from '../assets/avatar4.png';

type ExamType = 'SAT' | 'ACT' | 'AP' | 'GENERAL';

const MIN_PASSWORD = 8;

interface RegisterResponse {
  success?: boolean;
  leadId?: string;
  userId?: string;
  email?: string;
  accountCreated?: boolean;
  testAssigned?: boolean;
  test?: { id: string; title: string; category?: string | null } | null;
  error?: string;
  code?: 'ALREADY_REGISTERED' | 'AUTH_ERROR' | string;
}

/**
 * Free Demo Test — lead capture.
 *
 * The student fills in their details and chooses a password. The platform API
 * creates their portal account (restricted to a single demo test), assigns the
 * demo test the super admin configured, and records the lead for the admin
 * panel. The test itself is taken on the real test portal, so results and
 * analytics are identical to what enrolled students see.
 */
export function FreeTestPage() {
  const [searchParams] = useSearchParams();
  const rawExamParam = (searchParams.get('exam') || 'SAT').toUpperCase();
  const requestedExam: ExamType = (['SAT', 'ACT', 'AP', 'GENERAL'].includes(rawExamParam) ? rawExamParam : 'SAT') as ExamType;

  const [stage, setStage] = useState<'register' | 'success'>('register');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phoneCountryCode: '+1',
    phoneLocalNumber: '',
    password: '',
    confirmPassword: '',
    exam: requestedExam,
    grade: 'Grade 11',
    school: '',
    targetScore: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [result, setResult] = useState<RegisterResponse | null>(null);

  // Banner copy + on/off switch managed from the admin panel ("Free Test Leads" → Settings).
  const [banner, setBanner] = useState<{ title: string; subtitle: string; active: boolean } | null>(null);
  useEffect(() => {
    fetch(`${PLATFORM_API_BASE}/api/free-tests`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const cfg = res?.config;
        if (!cfg) return;
        setBanner({
          title: cfg.bannerTitle || 'Free Demo Test',
          subtitle: cfg.bannerSubtitle || '',
          active: cfg.activeOnWebsite !== false,
        });
      })
      .catch(() => {});
  }, []);

  const loginHref = (email: string) => {
    const sep = APP_LOGIN_URL.includes('?') ? '&' : '?';
    return `${APP_LOGIN_URL}${sep}email=${encodeURIComponent(email)}&demo=1`;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAlreadyRegistered(false);

    if (!form.name.trim() || !form.email.trim() || !form.phoneLocalNumber.trim()) {
      setError('Please fill in your full name, email, and phone number.');
      return;
    }
    if (form.password.length < MIN_PASSWORD) {
      setError(`Please choose a password with at least ${MIN_PASSWORD} characters — you will use it to log in to the test portal.`);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    setSubmitting(true);
    const fullPhone = `${form.phoneCountryCode} ${form.phoneLocalNumber}`.trim();

    try {
      const res = await fetch(`${PLATFORM_API_BASE}/api/free-tests/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: fullPhone,
          password: form.password,
          exam: form.exam,
          grade: form.grade,
          school: form.school.trim(),
          targetScore: form.targetScore.trim(),
        }),
      });
      const data: RegisterResponse = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409 || data.code === 'ALREADY_REGISTERED') {
          setAlreadyRegistered(true);
        }
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      trackLead();

      // Mirror the lead into the website's own query-server / MongoDB CRM (best effort).
      fetch(`${QUERY_API_BASE}/api/queries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: fullPhone,
          exam: form.exam,
          grade: form.grade,
          message: `Free Demo Test account created (${form.exam}) | Test: ${data.test?.title || 'pending assignment'} | School: ${form.school.trim() || 'N/A'} | Target: ${form.targetScore.trim() || 'N/A'}`,
          type: 'Free Demo Test',
          status: 'Active',
          stage: 'New Lead',
          source: 'Website Free Demo Test',
        }),
      }).catch(() => {});

      setResult({ ...data, email: data.email || form.email.trim().toLowerCase() });
      setStage('success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err?.message || 'Could not reach the server. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const title = banner?.title || 'Free Demo Test';
  const subtitle =
    banner?.subtitle ||
    'Create your free account, take one full demo test on our real exam platform, and get a detailed score report with section and topic analytics.';
  const registrationsOpen = banner ? banner.active : true;

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 2: SUCCESS — account created, hand off to the test portal
  // ═══════════════════════════════════════════════════════════════════════════
  if (stage === 'success' && result) {
    const email = result.email || form.email.trim().toLowerCase();
    return (
      <>
        <Header />
        <main>
          <section className="ft-register-section">
            <span className="orb orb-gold" aria-hidden="true" />
            <div className="ft-container" style={{ maxWidth: 880 }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div className="ft-badge">
                  <CheckCircle2 size={14} /> You're registered
                </div>
                <h1 className="ft-title">
                  Your demo account is <span>ready</span>
                </h1>
                <p className="ft-subtitle">
                  {result.accountCreated
                    ? 'Log in to the test portal with the email and password you just chose. Your demo test is waiting on your dashboard.'
                    : 'We have saved your details. Our team will set up your demo test access and contact you shortly.'}
                </p>
              </div>

              <div className="ft-form-card" style={{ marginBottom: 24 }}>
                <h2>Next steps</h2>
                <p className="ft-form-desc">Three quick steps to your score report.</p>

                <ol className="ft-benefits-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li className="ft-benefit-item">
                    <div className="ft-benefit-icon"><LogIn size={16} /></div>
                    <div className="ft-benefit-text">
                      <strong>1. Log in to the test portal</strong>
                      <p>
                        Email: <b style={{ color: '#fff' }}>{email}</b> · Password: the one you just created.
                      </p>
                    </div>
                  </li>
                  <li className="ft-benefit-item">
                    <div className="ft-benefit-icon"><MonitorPlay size={16} /></div>
                    <div className="ft-benefit-text">
                      <strong>2. Start your demo test</strong>
                      <p>
                        {result.test?.title
                          ? <>Your assigned test is <b style={{ color: '#fff' }}>{result.test.title}</b>. It is timed, with one attempt — find a quiet spot before you start.</>
                          : 'Your demo test will appear on your dashboard as soon as our team assigns it (usually within a few hours).'}
                      </p>
                    </div>
                  </li>
                  <li className="ft-benefit-item">
                    <div className="ft-benefit-icon"><BarChart3 size={16} /></div>
                    <div className="ft-benefit-text">
                      <strong>3. Get your full score report</strong>
                      <p>Scaled score, section breakdown, topic-wise accuracy and time analysis — the same analytics our enrolled students use.</p>
                    </div>
                  </li>
                </ol>

                {result.accountCreated && (
                  <a href={loginHref(email)} className="ft-submit-btn" style={{ textDecoration: 'none', marginTop: 20 }}>
                    <span>Go to Test Portal &amp; Log In</span>
                    <ArrowRight size={17} />
                  </a>
                )}
                <p className="ft-guarantee">
                  <KeyRound size={12} style={{ verticalAlign: '-2px' }} /> Forgot your password later? Use "Forgot password" on the login page or message us.
                </p>
              </div>

              <div className="ft-strategy-cta">
                <div>
                  <h3>Questions before you start?</h3>
                  <p>Our counsellors can walk you through the demo and what a personalised prep plan looks like.</p>
                </div>
                <div className="ft-strategy-buttons">
                  <a href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer" className="ft-cta-wa">
                    <MessageSquare size={16} /> WhatsApp
                  </a>
                  <a href={CALL_HREF} className="ft-cta-call">
                    <Phone size={16} /> Call us
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE 1: REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <Header />

      <main>
        <section className="ft-register-section">
          <span className="orb orb-gold" aria-hidden="true" />
          <div className="ft-container">
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div className="ft-badge">
                <Sparkles size={14} /> {title}
              </div>
              <h1 className="ft-title">
                Digital SAT &amp; ACT <span>Demo Test on the Real Platform</span>
              </h1>
              <p className="ft-subtitle">{subtitle}</p>
            </div>

            <div className="ft-grid">
              {/* Left: what you get */}
              <div className="ft-benefits-card">
                <div>
                  <div className="ft-benefits-header">
                    <h3>How the Free Demo Works</h3>
                  </div>

                  <ul className="ft-benefits-list">
                    <li className="ft-benefit-item">
                      <div className="ft-benefit-icon"><CheckCircle2 size={16} /></div>
                      <div className="ft-benefit-text">
                        <strong>Create your free demo account</strong>
                        <p>Fill in the form and choose a password. That's your login for our test portal.</p>
                      </div>
                    </li>
                    <li className="ft-benefit-item">
                      <div className="ft-benefit-icon"><CheckCircle2 size={16} /></div>
                      <div className="ft-benefit-text">
                        <strong>One full demo test, real exam interface</strong>
                        <p>Section timers, question palette, flag-for-review, calculator — exactly what our enrolled students use.</p>
                      </div>
                    </li>
                    <li className="ft-benefit-item">
                      <div className="ft-benefit-icon"><CheckCircle2 size={16} /></div>
                      <div className="ft-benefit-text">
                        <strong>Instant scaled score (400–1600 / 1–36)</strong>
                        <p>Section-wise and topic-wise breakdown, accuracy and time analysis right after you submit.</p>
                      </div>
                    </li>
                    <li className="ft-benefit-item">
                      <div className="ft-benefit-icon"><CheckCircle2 size={16} /></div>
                      <div className="ft-benefit-text">
                        <strong>Question-by-question review</strong>
                        <p>See every question, your answer, the correct answer and an explanation to spot weak areas fast.</p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="ft-trust-box">
                  <div className="ft-avatars">
                    <img src={avatar1} alt="Student avatar 1" />
                    <img src={avatar2} alt="Student avatar 2" />
                    <img src={avatar3} alt="Student avatar 3" />
                    <img src={avatar4} alt="Student avatar 4" />
                  </div>
                  <div className="ft-trust-stats">
                    <div className="ft-stars">★★★★★</div>
                    <span>4.9/5 • 1,200+ Students Tested</span>
                  </div>
                </div>
              </div>

              {/* Right: registration form */}
              <div className="ft-form-card">
                <h2>Create Your Free Demo Account</h2>
                <p className="ft-form-desc">
                  Takes one minute. You'll log in to the test portal with this email and password.
                </p>

                {!registrationsOpen && (
                  <div className="ft-error-banner" style={{ background: 'rgba(255,180,0,0.12)', borderColor: 'rgba(255,180,0,0.35)', color: '#fcd34d' }}>
                    <AlertCircle size={16} />
                    <span>Demo test registrations are paused right now. Message us on WhatsApp and we'll set you up personally.</span>
                  </div>
                )}

                {error && (
                  <div className="ft-error-banner">
                    <AlertCircle size={16} />
                    <span>
                      {error}
                      {alreadyRegistered && (
                        <>
                          {' '}
                          <a href={loginHref(form.email.trim().toLowerCase())} style={{ color: '#fff', textDecoration: 'underline', fontWeight: 800 }}>
                            Log in here
                          </a>
                        </>
                      )}
                    </span>
                  </div>
                )}

                <form onSubmit={handleRegister}>
                  <div className="ft-form-group">
                    <label htmlFor="ft-name">Student Full Name *</label>
                    <input
                      id="ft-name"
                      type="text"
                      required
                      className="ft-input"
                      placeholder="e.g. Maya Johnson"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="ft-form-row">
                    <div className="ft-form-group">
                      <label htmlFor="ft-email">Email Address (your login) *</label>
                      <input
                        id="ft-email"
                        type="email"
                        required
                        autoComplete="email"
                        className="ft-input"
                        placeholder="student@example.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>

                    <div className="ft-form-group">
                      <label htmlFor="ft-phone">Phone / WhatsApp *</label>
                      <div className="ft-phone-wrap">
                        <select
                          className="ft-select"
                          value={form.phoneCountryCode}
                          onChange={(e) => setForm({ ...form, phoneCountryCode: e.target.value })}
                          aria-label="Country code"
                        >
                          <option value="+1">+1 (US)</option>
                          <option value="+91">+91 (IN)</option>
                          <option value="+44">+44 (UK)</option>
                          <option value="+971">+971 (AE)</option>
                          <option value="+65">+65 (SG)</option>
                          <option value="+61">+61 (AU)</option>
                          <option value="+966">+966 (SA)</option>
                          <option value="+974">+974 (QA)</option>
                          <option value="+968">+968 (OM)</option>
                          <option value="+965">+965 (KW)</option>
                          <option value="+973">+973 (BH)</option>
                          <option value="+852">+852 (HK)</option>
                        </select>
                        <input
                          id="ft-phone"
                          type="tel"
                          required
                          autoComplete="tel-national"
                          className="ft-input"
                          placeholder="555 123 4567"
                          value={form.phoneLocalNumber}
                          onChange={(e) => setForm({ ...form, phoneLocalNumber: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="ft-form-row">
                    <div className="ft-form-group">
                      <label htmlFor="ft-password">Create Password *</label>
                      <div className="ft-phone-wrap">
                        <input
                          id="ft-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={MIN_PASSWORD}
                          autoComplete="new-password"
                          className="ft-input"
                          placeholder={`At least ${MIN_PASSWORD} characters`}
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="ft-select"
                          style={{ width: 48, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="ft-form-group">
                      <label htmlFor="ft-confirm">Confirm Password *</label>
                      <input
                        id="ft-confirm"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={MIN_PASSWORD}
                        autoComplete="new-password"
                        className="ft-input"
                        placeholder="Re-enter your password"
                        value={form.confirmPassword}
                        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="ft-form-row">
                    <div className="ft-form-group">
                      <label htmlFor="ft-exam">Target Exam *</label>
                      <select
                        id="ft-exam"
                        className="ft-select"
                        value={form.exam}
                        onChange={(e) => setForm({ ...form, exam: e.target.value as ExamType })}
                      >
                        <option value="SAT">Digital SAT (1600 Scale)</option>
                        <option value="ACT">ACT (36 Scale)</option>
                        <option value="AP">AP Exam Prep</option>
                        <option value="GENERAL">General Assessment</option>
                      </select>
                    </div>

                    <div className="ft-form-group">
                      <label htmlFor="ft-grade">Current Grade</label>
                      <select
                        id="ft-grade"
                        className="ft-select"
                        value={form.grade}
                        onChange={(e) => setForm({ ...form, grade: e.target.value })}
                      >
                        <option value="Grade 8">Grade 8</option>
                        <option value="Grade 9">Grade 9 (Freshman)</option>
                        <option value="Grade 10">Grade 10 (Sophomore)</option>
                        <option value="Grade 11">Grade 11 (Junior)</option>
                        <option value="Grade 12">Grade 12 (Senior)</option>
                        <option value="Gap Year / Other">Gap Year / Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="ft-form-row">
                    <div className="ft-form-group">
                      <label htmlFor="ft-target-score">Target Score (Optional)</label>
                      <input
                        id="ft-target-score"
                        type="text"
                        className="ft-input"
                        placeholder="e.g. 1500+ / 34+"
                        value={form.targetScore}
                        onChange={(e) => setForm({ ...form, targetScore: e.target.value })}
                      />
                    </div>

                    <div className="ft-form-group">
                      <label htmlFor="ft-school">School Name (Optional)</label>
                      <input
                        id="ft-school"
                        type="text"
                        className="ft-input"
                        placeholder="e.g. Lincoln High School"
                        value={form.school}
                        onChange={(e) => setForm({ ...form, school: e.target.value })}
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={submitting || !registrationsOpen} className="ft-submit-btn">
                    {submitting ? (
                      'Creating your demo account...'
                    ) : (
                      <>
                        <span>Create Account &amp; Get My Demo Test</span>
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>

                  <p className="ft-guarantee">
                    🔒 100% Free • No credit card • Already registered?{' '}
                    <a href={APP_LOGIN_URL} style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'underline' }}>Log in</a>
                  </p>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-top shell">
        <div className="footer-brand-col">
          <Brand />
          <p className="footer-desc">
            ACT SAT GO offers expert guidance and resources to help students excel in their ACT | SAT | AP | and other academic courses. Join our community and unlock your potential with tailored learning strategies and comprehensive support.
          </p>
        </div>

        <div className="footer-col">
          <h4 className="footer-heading">Programs</h4>
          <ul className="footer-links">
            <li><a href="/sat">SAT</a></li>
            <li><a href="/act">ACT</a></li>
            <li><a href="/ap">AP</a></li>
            <li><a href="/k-12-tutoring">K-12 Tutoring</a></li>
            <li><a href="/future-programs">Future Programs</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-heading">Company</h4>
          <ul className="footer-links">
            <li><a href="/about-us">About Us</a></li>
            <li><a href="/">Home</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom shell">
        <p>&copy; {new Date().getFullYear()} ACT SAT GO. All rights reserved.</p>
        <p>Designed for students who aim higher.</p>
      </div>
    </footer>
  );
}
