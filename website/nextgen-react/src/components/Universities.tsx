import { useState } from 'react';

const UNIVERSITIES = [
  { name: 'Harvard University', domain: 'harvard.edu' },
  { name: 'Yale University', domain: 'yale.edu' },
  { name: 'Dartmouth College', domain: 'dartmouth.edu' },
  { name: 'Brown University', domain: 'brown.edu' },
  { name: 'Cornell University', domain: 'cornell.edu' },
  { name: 'University of Pennsylvania', domain: 'upenn.edu' },
  { name: 'Massachusetts Institute of Technology (MIT)', domain: 'mit.edu' },
  { name: 'California Institute of Technology (Caltech)', domain: 'caltech.edu' },
  { name: 'Stanford University', domain: 'stanford.edu' },
  { name: 'Georgetown University', domain: 'georgetown.edu' },
  { name: 'University of Florida', domain: 'ufl.edu' },
  { name: 'University of Texas at Austin', domain: 'utexas.edu' },
  { name: 'University of Alabama', domain: 'ua.edu' },
  { name: 'Auburn University', domain: 'auburn.edu' },
  { name: 'Louisiana State University', domain: 'lsu.edu' },
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
