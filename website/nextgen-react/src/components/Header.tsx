import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';
import { APP_LOGIN_URL } from '../config';
import { WHATSAPP_HREF, CALL_HREF } from './WhatsAppButton';

const PROGRAM_LINKS: { to?: string; href?: string; label: string }[] = [
  { to: '/sat', label: 'SAT' },
  { to: '/act', label: 'ACT' },
  { to: '/ap', label: 'AP' },
  { to: '/k-12-tutoring', label: 'K-12 Tutoring' },
  { to: '/future-programs', label: 'Future Programs' },
];

const RESOURCE_LINKS: { to?: string; href?: string; label: string }[] = [
  { to: '/resources', label: 'Blog & Articles' },
  { href: '/resources', label: 'Guides & Downloads' },
  { href: '/resources', label: 'Webinars & Videos' },
];

function ContactDropdown({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`nav-dropdown contact-dropdown${open ? ' is-open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="btn btn-primary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Contact Us <span aria-hidden="true">→</span>
      </button>
      <div className="nav-dropdown-menu contact-menu" role="menu">
        <a
          href={WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
          onClick={() => { setOpen(false); onNavigate?.(); }}
        >
          <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
            <path d="M16.01 3C9.38 3 4 8.38 4 15.01c0 2.35.65 4.55 1.79 6.43L3 29l7.76-2.71a12.9 12.9 0 0 0 5.25 1.12h.01c6.63 0 12-5.38 12-12.01C28.02 8.38 22.65 3 16.01 3zm0 22.02h-.01a9.98 9.98 0 0 1-5.09-1.39l-.36-.21-4.6 1.61 1.55-4.48-.24-.37a9.96 9.96 0 0 1-1.55-5.35c0-5.53 4.5-10.02 10.03-10.02a9.95 9.95 0 0 1 7.09 2.94 9.94 9.94 0 0 1 2.94 7.08c0 5.53-4.5 10.19-10.03 10.19z" />
            <path d="M21.62 17.66c-.29-.15-1.73-.86-2-.95-.27-.1-.46-.15-.66.15-.2.29-.75.95-.92 1.14-.17.2-.34.22-.63.07-.29-.15-1.22-.45-2.33-1.44-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.59-.9-2.18-.24-.57-.48-.5-.66-.51h-.56c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.44s1.05 2.83 1.19 3.03c.15.2 2.06 3.14 4.99 4.4.7.3 1.24.48 1.67.61.7.22 1.34.19 1.84.12.56-.08 1.73-.71 1.97-1.39.24-.68.24-1.27.17-1.39-.07-.12-.26-.2-.55-.35z" />
          </svg>
          WhatsApp Us
        </a>
        <a
          href={CALL_HREF}
          role="menuitem"
          onClick={() => { setOpen(false); onNavigate?.(); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.61 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          Call Us
        </a>
      </div>
    </div>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);

  const close = () => {
    setOpen(false);
    setProgramsOpen(false);
    setResourcesOpen(false);
  };

  return (
    <header className="site-header">
      <nav className={`nav shell${open ? ' is-open' : ''}`} aria-label="Primary navigation">
        <Brand onNavigate={close} />
        <button
          className="nav-toggle"
          type="button"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span></span><span></span><span></span>
        </button>
        <div className="nav-links" data-nav>
          <a href="/#home" onClick={close} className="nav-home" aria-label="Home">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 11.5 12 4l9 7.5" />
              <path d="M5.5 9.5V20h13V9.5" />
              <path d="M10 20v-6h4v6" />
            </svg>
          </a>

          <Link to="/about-us" onClick={close}>About Us</Link>

          <div
            className={`nav-dropdown${programsOpen ? ' is-open' : ''}`}
            onMouseEnter={() => setProgramsOpen(true)}
            onMouseLeave={() => setProgramsOpen(false)}
          >
            <button
              type="button"
              className="nav-dropdown-toggle"
              aria-expanded={programsOpen}
              onClick={() => setProgramsOpen((v) => !v)}
            >
              Programs <span aria-hidden="true">▾</span>
            </button>
            <div className="nav-dropdown-menu" role="menu">
              {PROGRAM_LINKS.map((p) => (
                p.to ? (
                  <Link key={p.label} to={p.to} role="menuitem" onClick={close}>{p.label}</Link>
                ) : (
                  <a key={p.label} href={p.href} role="menuitem" onClick={close}>{p.label}</a>
                )
              ))}
            </div>
          </div>

          <div
            className={`nav-dropdown${resourcesOpen ? ' is-open' : ''}`}
            onMouseEnter={() => setResourcesOpen(true)}
            onMouseLeave={() => setResourcesOpen(false)}
          >
            <Link
              to="/resources"
              className="nav-dropdown-toggle"
              aria-expanded={resourcesOpen}
              onClick={() => { close(); setResourcesOpen(false); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              Resources <span aria-hidden="true">▾</span>
            </Link>
            <div className="nav-dropdown-menu" role="menu">
              {RESOURCE_LINKS.map((r) => (
                r.to ? (
                  <Link key={r.to + r.label} to={r.to} role="menuitem" onClick={close}>{r.label}</Link>
                ) : (
                  <a key={r.label} href={r.href} role="menuitem" onClick={close}>{r.label}</a>
                )
              ))}
            </div>
          </div>


          <Link to="/careers" onClick={close}>Career</Link>

          <a href={APP_LOGIN_URL} onClick={close}>Login</a>

          {/* Mobile-only actions inside the drawer */}
          <div className="nav-links-mobile-actions">
            <ContactDropdown onNavigate={close} />
            {/* Social icons strip in mobile drawer */}
            <div className="nav-social">
              <a href="https://www.facebook.com/actsatgousa" target="_blank" rel="noopener noreferrer" aria-label="Facebook" onClick={close}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="https://www.instagram.com/act_sat_go" target="_blank" rel="noopener noreferrer" aria-label="Instagram" onClick={close}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href="https://www.youtube.com/@ACTSATGOTutoring" target="_blank" rel="noopener noreferrer" aria-label="YouTube" onClick={close}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#06172a"/></svg>
              </a>
              <a href="https://www.linkedin.com/company/act-sat-go/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" onClick={close}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
            </div>
          </div>
        </div>
        <div className="nav-actions">
          <ContactDropdown onNavigate={close} />
        </div>
      </nav>
    </header>
  );
}

