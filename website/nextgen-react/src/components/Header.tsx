import { useState } from 'react';
import { Brand } from './Brand';
import { APP_LOGIN_URL } from '../config';

const NAV_LINKS = [
  { href: '#programs', label: 'Programs' },
  { href: '#process', label: 'K-12 Learning' },
  { href: '#results', label: 'Study Abroad' },
  { href: '#resources', label: 'Resources' },
  { href: '#about', label: 'About Us' },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="site-header">
      <nav className={`nav shell${open ? ' is-open' : ''}`} aria-label="Primary navigation">
        <Brand onNavigate={close} />
        <button
          className="nav-toggle"
          type="button"
          aria-label="Open navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span></span><span></span><span></span>
        </button>
        <div className="nav-links" data-nav>
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={close}>{l.label}</a>
          ))}
        </div>
        <div className="nav-actions">
          <a className="btn btn-ghost" href={APP_LOGIN_URL} onClick={close}>Login</a>
          <a className="btn btn-primary" href="#consultation" onClick={close}>Book Free Consultation</a>
        </div>
      </nav>
    </header>
  );
}
