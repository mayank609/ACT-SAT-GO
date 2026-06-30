import { Link } from 'react-router-dom';

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link className="brand" to="/" aria-label="ScoreπGo home" onClick={onNavigate}>
      <span className="brand-logo-text">
        Score <span className="brand-go-box">π Go</span>
      </span>
    </Link>
  );
}
