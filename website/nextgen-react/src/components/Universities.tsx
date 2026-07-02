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
    <div className="uni-logo-chip" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 18px',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '30px',
      transition: 'all 0.25s ease',
      cursor: 'default'
    }}>
      {!failed && (
        <img
          src={logoUrl}
          alt={`${name} logo`}
          title={name}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{
            height: '22px',
            width: '22px',
            objectFit: 'contain',
            filter: 'none',
            opacity: 1,
            margin: 0,
            transform: 'none'
          }}
        />
      )}
      <span style={{
        fontSize: '13.5px',
        fontWeight: '700',
        color: '#334155',
        padding: 0,
        borderRadius: 0,
        background: 'none'
      }}>{name}</span>
    </div>
  );
}

export function Universities() {
  return (
    <div className="university-strip" style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: '12px',
      marginTop: '26px',
      padding: '20px',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      background: '#ffffff',
      fontWeight: 'bold'
    }}>
      {UNIVERSITIES.map((u) => (
        <UniLogo key={u.name} name={u.name} domain={u.domain} />
      ))}
    </div>
  );
}

