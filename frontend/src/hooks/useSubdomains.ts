import { useState, useCallback, useEffect } from 'react';
import { SUBDOMAINS_BY_DOMAIN } from '../data/satDomains';

const STORAGE_KEY = 'actsatgo:domain_subdomains';
const EVENT = 'actsatgo:domain-subdomains-updated';

export type SubdomainsMap = Record<string, string[]>;

function load(): SubdomainsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SUBDOMAINS_BY_DOMAIN;
    // Merge stored overrides onto defaults so any new default domains shipped in a
    // later app version still show up even if the admin saved an older map.
    return { ...SUBDOMAINS_BY_DOMAIN, ...(JSON.parse(raw) as SubdomainsMap) };
  } catch {
    return SUBDOMAINS_BY_DOMAIN;
  }
}

function persist(map: SubdomainsMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Admin-editable Domain → Subdomain taxonomy, persisted to localStorage.
 * Mirrors {@link useSubdomainSkills} (which manages Subdomain → Skill). Both the
 * Skills Management page and the Test Builder read from here so a subdomain added
 * in one place is immediately taggable in the other.
 */
export function useSubdomains() {
  const [subdomainsByDomain, setMap] = useState<SubdomainsMap>(load);

  useEffect(() => {
    const handler = () => setMap(load());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const addSubdomain = useCallback((domain: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setMap(prev => {
      const existing = prev[domain] ?? [];
      if (existing.some(s => s.toLowerCase() === trimmed.toLowerCase())) return prev;
      const updated = { ...prev, [domain]: [...existing, trimmed] };
      persist(updated);
      return updated;
    });
  }, []);

  const removeSubdomain = useCallback((domain: string, name: string) => {
    setMap(prev => {
      const updated = { ...prev, [domain]: (prev[domain] ?? []).filter(s => s !== name) };
      persist(updated);
      return updated;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setMap(SUBDOMAINS_BY_DOMAIN);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { subdomainsByDomain, addSubdomain, removeSubdomain, resetToDefaults };
}
