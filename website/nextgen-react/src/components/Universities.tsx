import { useState } from 'react';

const UNIVERSITIES = [
  { name: 'Harvard', domain: 'harvard.edu' },
  { name: 'Stanford', domain: 'stanford.edu' },
  { name: 'MIT', domain: 'mit.edu' },
  { name: 'Berkeley', domain: 'berkeley.edu' },
  { name: 'NYU', domain: 'nyu.edu' },
  { name: 'Georgia Tech', domain: 'gatech.edu' },
];

function UniLogo({ name, domain }: { name: string; domain: string }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${domain}&size=128`;

  return (
    <div className="uni-logo-chip">
      {!failed && (
        <img
          src={logoUrl}
          alt={`${name} logo`}
          title={name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      <span>{name}</span>
    </div>
  );
}

export function Universities() {
  return (
    <div className="university-marquee">
      <div className="university-track">
        {[...UNIVERSITIES, ...UNIVERSITIES].map((u, i) => (
          <UniLogo key={`${u.name}-${i}`} name={u.name} domain={u.domain} />
        ))}
      </div>
    </div>
  );
}
