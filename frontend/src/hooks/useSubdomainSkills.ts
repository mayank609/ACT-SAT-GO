import { useState, useCallback, useEffect, useRef } from 'react';
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
  const skillsMapRef = useRef(skillsMap);
  useEffect(() => { skillsMapRef.current = skillsMap; }, [skillsMap]);

  useEffect(() => {
    api.getTaxonomy()
      .then((r) => setSkillsMap({ ...SKILLS_BY_SUBDOMAIN, ...r.skillsMap }))
      .catch(() => {});
  }, []);

  // Re-fetches the latest server state right before applying a mutation and
  // persisting the result. A locally-held snapshot can be stale — this component
  // may have been open for a while — and a write built on top of stale state
  // would silently erase whatever another admin added to the shared taxonomy in
  // the meantime, since PUT replaces the whole map. Basing every write on a fresh
  // read keeps additions from different admins/sessions from clobbering each other.
  const mutate = useCallback(async (fn: (current: SkillsMap) => SkillsMap) => {
    let base = skillsMapRef.current;
    try {
      const r = await api.getTaxonomy();
      base = { ...SKILLS_BY_SUBDOMAIN, ...r.skillsMap };
    } catch { /* fall back to local state if the refetch fails */ }
    const updated = fn(base);
    setSkillsMap(updated);
    await api.updateTaxonomy({ skillsMap: updated }).catch(() => {});
  }, []);

  const addSkill = useCallback((subdomain: string, skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    mutate(prev => {
      const existing = prev[subdomain] ?? [];
      if (existing.some(s => s.toLowerCase() === trimmed.toLowerCase())) return prev;
      return { ...prev, [subdomain]: [...existing, trimmed] };
    });
  }, [mutate]);

  const removeSkill = useCallback((subdomain: string, skill: string) => {
    mutate(prev => ({ ...prev, [subdomain]: (prev[subdomain] ?? []).filter(s => s !== skill) }));
  }, [mutate]);

  const resetToDefaults = useCallback(() => {
    setSkillsMap(SKILLS_BY_SUBDOMAIN);
    api.updateTaxonomy({ skillsMap: {} }).catch(() => {});
  }, []);

  return { skillsMap, addSkill, removeSkill, resetToDefaults };
}
