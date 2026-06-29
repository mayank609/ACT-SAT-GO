import logo from '../assets/logo.png';

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <a className="brand" href="#home" aria-label="ACT SAT GO home" onClick={onNavigate}>
      <span className="brand-logo">
        <img src={logo} alt="ACT SAT GO" />
      </span>
      <small className="brand-tag">Achieve. Score. Go.</small>
    </a>
  );
}
