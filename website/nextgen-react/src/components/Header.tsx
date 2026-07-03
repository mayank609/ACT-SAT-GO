import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';
import { APP_LOGIN_URL } from '../config';

const PROGRAM_LINKS: { to?: string; href?: string; label: string }[] = [
  { to: '/sat', label: 'SAT' },
  { to: '/act', label: 'ACT' },
  { to: '/ap', label: 'AP' },
  { to: '/k-12-tutoring', label: 'K-12 Tutoring' },
  { to: '/future-programs', label: 'Future Programs' },
];

const RESOURCE_LINKS = [
  { href: '/#process', label: 'Our Method' },
  { href: '/#results', label: 'Success Stories' },
  { href: '/#consultation', label: 'ACT Guide' },
];

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

          <a href="/#about" onClick={close}>About Us</a>

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
            <button
              type="button"
              className="nav-dropdown-toggle"
              aria-expanded={resourcesOpen}
              onClick={() => setResourcesOpen((v) => !v)}
            >
              Resources <span aria-hidden="true">▾</span>
            </button>
            <div className="nav-dropdown-menu" role="menu">
              {RESOURCE_LINKS.map((r) => (
                <a key={r.href} href={r.href} role="menuitem" onClick={close}>{r.label}</a>
              ))}
            </div>
          </div>

          <a href="/#programs" onClick={close}>Career</a>

          <a href={APP_LOGIN_URL} onClick={close}>Login</a>

          {/* Mobile-only actions inside the drawer */}
          <div className="nav-links-mobile-actions">
            <a className="btn btn-primary" href="/#consultation" onClick={close}>
              Enroll Now <span aria-hidden="true">→</span>
            </a>
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
          <a className="btn btn-primary" href="/#consultation" onClick={close}>
            Enroll Now <span aria-hidden="true">→</span>
          </a>
        </div>
      </nav>
    </header>
  );
}

