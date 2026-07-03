const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconGlobe() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

export function IconUser() {
  return (
    <svg {...base}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" />
    </svg>
  );
}

export function IconUsers() {
  return (
    <svg {...base}>
      <circle cx="16" cy="8.5" r="2.6" stroke="#9aa5b1" />
      <path d="M11.3 12.6c2.9.4 4.7 2.4 4.7 5.4" stroke="#9aa5b1" />
      <circle cx="9.5" cy="8" r="4" fill="var(--gold)" stroke="none" />
      <path d="M2.5 20.5c0-4.4 3.6-6.9 7-6.9s7 2.5 7 6.9" />
    </svg>
  );
}

export function IconHeartCheck() {
  return (
    <svg {...base}>
      <path d="M12 20s-7.1-4.4-9.4-8.8C1.3 8 2.7 4.7 5.9 4.1c2.1-.4 4.1.6 6.1 3 2-2.4 4-3.4 6.1-3 3.2.6 4.6 3.9 3.3 7.1C19.1 15.6 12 20 12 20Z" />
      <path d="M9 11.7l2 2 4-4.2" />
    </svg>
  );
}

export function IconGraduationCap() {
  return (
    <svg {...base}>
      <path d="M12 3 2 8l10 5 10-5-10-5Z" fill="var(--gold)" stroke="var(--gold)" />
      <path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" />
      <path d="M22 8v6" />
    </svg>
  );
}

export function IconChart() {
  return (
    <svg {...base}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
      <path d="M6 12.5l3-3.2 2.6 2 4.4-4.8" stroke="var(--gold)" strokeWidth="2" />
    </svg>
  );
}

export function IconDocument() {
  return (
    <svg {...base}>
      <path d="M6 3h8l4 4v14H6Z" stroke="#6b7684" />
      <path d="M14 3v4h4" stroke="#6b7684" />
      <path d="M9 15.5h6" stroke="#6b7684" />
      <path d="M9 8.5h2" stroke="#6b7684" />
      <path d="M9 12h6" stroke="var(--gold)" strokeWidth="2.2" />
    </svg>
  );
}

export function IconClipboardCheck() {
  return (
    <svg {...base}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V4" fill="var(--gold)" stroke="var(--gold)" />
      <path d="M9 13l2 2 4-4.2" stroke="var(--gold)" strokeWidth="2.2" />
    </svg>
  );
}

export function IconTarget() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.2" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconOpenBookSquare() {
  return (
    <svg {...base}>
      <path d="M12 6.5C10.5 5.3 8 4.5 5 4.5v13c3 0 5.5.8 7 2 1.5-1.2 4-2 7-2v-13c-3 0-5.5.8-7 2Z" />
    </svg>
  );
}

export function IconRocket() {
  return (
    <svg {...base}>
      <path d="M13.5 3.5c3 .5 5 2.5 5.5 5.5-3 3-7 6-9 8l-4-4c2-2 5-6 8-9.5Z" />
      <circle cx="14.5" cy="9.5" r="1.4" />
      <path d="M9 15l-2 5-2.5-2.5L9 15Z" />
      <path d="M8 13c-1.5-.5-3 0-4 1-1 1.5-1 3-1 3s1.5 0 3-1c1-1 1.5-2.5 1-3Z" fill="var(--gold)" stroke="none" />
    </svg>
  );
}
