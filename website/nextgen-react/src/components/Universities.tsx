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

  // Falls back to the school name if the remote logo can't be loaded.
  if (failed) return <span>{name}</span>;

  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={`${name} logo`}
      title={name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function Universities() {
  return (
    <div className="university-strip">
      {UNIVERSITIES.map((u) => (
        <UniLogo key={u.name} name={u.name} domain={u.domain} />
      ))}
    </div>
  );
}
