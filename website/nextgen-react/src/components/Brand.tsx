import { Link } from 'react-router-dom';

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link className="brand" to="/" aria-label="ACT SAT GO home" onClick={onNavigate}>
      <span className="brand-logo-text">
        ACT SAT <span className="brand-go-box">GO</span>
      </span>
    </Link>
  );
}
