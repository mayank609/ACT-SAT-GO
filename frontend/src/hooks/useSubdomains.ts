import { useState, useCallback, useEffect, useRef } from 'react';
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
  const mapRef = useRef(subdomainsByDomain);
  useEffect(() => { mapRef.current = subdomainsByDomain; }, [subdomainsByDomain]);

  useEffect(() => {
    api.getTaxonomy()
      .then((r) => setMap({ ...SUBDOMAINS_BY_DOMAIN, ...r.subdomainsByDomain }))
      .catch(() => {});
  }, []);

  // Re-fetches the latest server state right before applying a mutation and
  // persisting the result — see useSubdomainSkills' mutate for the rationale: a
  // write built on a stale local snapshot would silently erase whatever another
  // admin added to the shared taxonomy in the meantime, since PUT replaces the
  // whole map.
  const mutate = useCallback(async (fn: (current: SubdomainsMap) => SubdomainsMap) => {
    let base = mapRef.current;
    try {
      const r = await api.getTaxonomy();
      base = { ...SUBDOMAINS_BY_DOMAIN, ...r.subdomainsByDomain };
    } catch { /* fall back to local state if the refetch fails */ }
    const updated = fn(base);
    setMap(updated);
    await api.updateTaxonomy({ subdomainsByDomain: updated }).catch(() => {});
  }, []);

  const addSubdomain = useCallback((domain: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    mutate(prev => {
      const existing = prev[domain] ?? [];
      if (existing.some(s => s.toLowerCase() === trimmed.toLowerCase())) return prev;
      return { ...prev, [domain]: [...existing, trimmed] };
    });
  }, [mutate]);

  const removeSubdomain = useCallback((domain: string, name: string) => {
    mutate(prev => ({ ...prev, [domain]: (prev[domain] ?? []).filter(s => s !== name) }));
  }, [mutate]);

  const resetToDefaults = useCallback(() => {
    setMap(SUBDOMAINS_BY_DOMAIN);
    api.updateTaxonomy({ subdomainsByDomain: {} }).catch(() => {});
  }, []);

  return { subdomainsByDomain, addSubdomain, removeSubdomain, resetToDefaults };
}
