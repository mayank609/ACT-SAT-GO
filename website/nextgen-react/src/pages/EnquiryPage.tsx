import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { Brand } from '../components/Brand';
import { QUERY_API_BASE } from '../config';

const EXAM_OPTIONS = ['General', 'SAT', 'ACT', 'AP Prep', 'K-12 Tutoring'];

function normalizeExam(raw: string | null): string {
  if (!raw) return 'General';
  const match = EXAM_OPTIONS.find((o) => o.toLowerCase() === raw.toLowerCase() || o.toLowerCase().startsWith(raw.toLowerCase()));
  return match ?? 'General';
}

export function EnquiryPage() {
  const [searchParams] = useSearchParams();
  const presetExam = normalizeExam(searchParams.get('exam'));
  const presetName = searchParams.get('name') ?? '';

  const [formData, setFormData] = useState({ name: presetName, email: '', phone: '', exam: presetExam, message: '' });
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1');
  const [phoneLocalNumber, setPhoneLocalNumber] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim()) return;

    setSubmitStatus('submitting');
    try {
      const response = await fetch(`${QUERY_API_BASE}/api/queries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          phone: `${phoneCountryCode} ${phoneLocalNumber}`.trim(),
          type: 'Consultation',
        }),
      });

      if (response.ok) {
        setSubmitStatus('success');
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error submitting query:', error);
      setSubmitStatus('error');
    }
  };

  return (
    <>
      <Header />

      <main>
        <section className="hero section-dark" style={{ paddingBottom: '60px' }}>
          <span className="orb orb-gold" aria-hidden="true" />
          <div className="shell" style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ marginBottom: '12px' }}>Book Your <span>Free Consultation</span></h1>
            <p className="hero-text" style={{ marginBottom: '32px' }}>
              Tell us about your goals and one of our academic counselors will design a customized learning roadmap for you.
            </p>

            <div className="c-modal" style={{ margin: '0 auto', textAlign: 'left', transform: 'none' }}>
              {submitStatus === 'success' ? (
                <div className="c-success-state">
                  <div className="c-success-icon">✓</div>
                  <h4>Consultation Booked!</h4>
                  <p>Thank you for reaching out. An expert academic counselor from ACT SAT GO will contact you shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit}>
                  <div className="c-form-group">
                    <label htmlFor="enq-name">Full Name</label>
                    <input
                      id="enq-name"
                      type="text"
                      className="c-input"
                      placeholder="e.g. Ananya Sharma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="c-form-group">
                    <label htmlFor="enq-email">Email Address</label>
                    <input
                      id="enq-email"
                      type="email"
                      className="c-input"
                      placeholder="e.g. ananya@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="c-form-group">
                    <label htmlFor="enq-phone">Phone Number</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        className="c-input"
                        style={{ width: '110px', padding: '0 8px', backgroundColor: '#0d1b31', color: 'white' }}
                        value={phoneCountryCode}
                        onChange={(e) => setPhoneCountryCode(e.target.value)}
                      >
                        <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+1">+1 (US)</option>
                        <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+91">+91 (IN)</option>
                        <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+44">+44 (UK)</option>
                        <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+971">+971 (AE)</option>
                        <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+65">+65 (SG)</option>
                        <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+61">+61 (AU)</option>
                        <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+966">+966 (SA)</option>
                        <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+974">+974 (QA)</option>
                        <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+968">+968 (OM)</option>
                        <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+965">+965 (KW)</option>
                        <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+973">+973 (BH)</option>
                        <option style={{ backgroundColor: '#0d1b31', color: 'white' }} value="+852">+852 (HK)</option>
                      </select>
                      <input
                        id="enq-phone"
                        type="tel"
                        className="c-input"
                        style={{ flex: 1 }}
                        placeholder="555 123 4567"
                        value={phoneLocalNumber}
                        onChange={(e) => setPhoneLocalNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="c-form-group">
                    <label htmlFor="enq-exam">Exam / Program Interest</label>
                    <select
                      id="enq-exam"
                      className="c-input"
                      value={formData.exam}
                      onChange={(e) => setFormData({ ...formData, exam: e.target.value })}
                    >
                      <option value="General">General / Other</option>
                      <option value="SAT">SAT Prep</option>
                      <option value="ACT">ACT Prep</option>
                      <option value="AP Prep">AP Prep</option>
                      <option value="K-12 Tutoring">K-12 Tutoring</option>
                    </select>
                  </div>

                  <div className="c-form-group">
                    <label htmlFor="enq-message">Tell us about your learning goals</label>
                    <textarea
                      id="enq-message"
                      className="c-input c-textarea"
                      placeholder="e.g. Target SAT score is 1500+, looking for 1-on-1 tutoring..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    />
                  </div>

                  {submitStatus === 'error' && (
                    <p style={{ color: '#ef4444', fontSize: '13px', margin: '8px 0', fontWeight: 600 }}>
                      ✕ Unable to submit form. Please check if the query server is running.
                    </p>
                  )}

                  <button type="submit" className="c-submit-btn" disabled={submitStatus === 'submitting'}>
                    {submitStatus === 'submitting' ? 'Submitting...' : 'Book Free Consultation'}
                  </button>
                </form>
              )}
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
    </>
  );
}
