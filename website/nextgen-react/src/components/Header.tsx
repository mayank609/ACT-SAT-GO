import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from './Brand';

const PROGRAM_LINKS = [
  { to: '/sat', label: 'SAT Preparation' },
  { to: '/act', label: 'ACT Preparation' },
  { to: '/ap', label: 'AP Preparation' },
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
          aria-label="Open navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span></span><span></span><span></span>
        </button>
        <div className="nav-links" data-nav>
          <a href="/#home" onClick={close}>Home</a>
          
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
                <Link key={p.to} to={p.to} role="menuitem" onClick={close}>{p.label}</Link>
              ))}
            </div>
          </div>

          <a href="/#programs" onClick={close}>Practice</a>

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

          <a href="/#about" onClick={close}>About Us</a>
        </div>
        <div className="nav-actions">
          <Link className="nav-login" to="/admin/login" onClick={close}>
            Log in
          </Link>
          <a className="btn btn-primary" href="/#consultation" onClick={close}>
            Enroll Now <span aria-hidden="true">→</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
