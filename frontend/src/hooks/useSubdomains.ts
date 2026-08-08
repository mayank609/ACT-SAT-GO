import { useState, useCallback, useEffect } from 'react';
import { SUBDOMAINS_BY_DOMAIN } from '../data/satDomains';
import { api } from '../lib/api';

export type SubdomainsMap = Record<string, string[]>;

/**
 * Admin-editable Domain → Subdomain taxonomy, shared across every admin/super-admin
 * via the backend (previously stored per-browser in localStorage, so a subdomain one
 * admin added was invisible to everyone else). Mirrors {@link useSubdomainSkills}
 * (which manages Subdomain → Skill). Both the Skills Management page and the Test
 * Builder read from here so a subdomain added in one place is immediately taggable
 * in the other.
 */
export function useSubdomains() {
  const [subdomainsByDomain, setMap] = useState<SubdomainsMap>(SUBDOMAINS_BY_DOMAIN);

  useEffect(() => {
    api.getTaxonomy()
      .then((r) => setMap({ ...SUBDOMAINS_BY_DOMAIN, ...r.subdomainsByDomain }))
      .catch(() => {});
  }, []);

  const persist = useCallback((map: SubdomainsMap) => {
    api.updateTaxonomy({ subdomainsByDomain: map }).catch(() => {});
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
  }, [persist]);

  const removeSubdomain = useCallback((domain: string, name: string) => {
    setMap(prev => {
      const updated = { ...prev, [domain]: (prev[domain] ?? []).filter(s => s !== name) };
      persist(updated);
      return updated;
    });
  }, [persist]);

  const resetToDefaults = useCallback(() => {
    setMap(SUBDOMAINS_BY_DOMAIN);
    api.updateTaxonomy({ subdomainsByDomain: {} }).catch(() => {});
  }, []);

  return { subdomainsByDomain, addSubdomain, removeSubdomain, resetToDefaults };
}
