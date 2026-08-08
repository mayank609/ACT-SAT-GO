import { useState, useCallback, useEffect } from 'react';
import { SKILLS_BY_SUBDOMAIN } from '../data/satDomains';
import { api } from '../lib/api';

export type SkillsMap = Record<string, string[]>;

/**
 * Admin-editable Subdomain → Skill taxonomy, shared across every admin/super-admin
 * via the backend (previously stored per-browser in localStorage, so a skill one
 * admin added was invisible to everyone else). Merges the backend's overrides onto
 * the built-in defaults so new default subdomains shipped later still show up.
 */
export function useSubdomainSkills() {
  const [skillsMap, setSkillsMap] = useState<SkillsMap>(SKILLS_BY_SUBDOMAIN);

  useEffect(() => {
    api.getTaxonomy()
      .then((r) => setSkillsMap({ ...SKILLS_BY_SUBDOMAIN, ...r.skillsMap }))
      .catch(() => {});
  }, []);

  const persist = useCallback((map: SkillsMap) => {
    api.updateTaxonomy({ skillsMap: map }).catch(() => {});
  }, []);

  const addSkill = useCallback((subdomain: string, skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    setSkillsMap(prev => {
      const existing = prev[subdomain] ?? [];
      if (existing.some(s => s.toLowerCase() === trimmed.toLowerCase())) return prev;
      const updated = { ...prev, [subdomain]: [...existing, trimmed] };
      persist(updated);
      return updated;
    });
  }, [persist]);

  const removeSkill = useCallback((subdomain: string, skill: string) => {
    setSkillsMap(prev => {
      const updated = { ...prev, [subdomain]: (prev[subdomain] ?? []).filter(s => s !== skill) };
      persist(updated);
      return updated;
    });
  }, [persist]);

  const resetToDefaults = useCallback(() => {
    setSkillsMap(SKILLS_BY_SUBDOMAIN);
    api.updateTaxonomy({ skillsMap: {} }).catch(() => {});
  }, []);

  return { skillsMap, addSkill, removeSkill, resetToDefaults };
}
