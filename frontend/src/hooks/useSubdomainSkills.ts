import { useState, useCallback, useEffect } from 'react';
import { SKILLS_BY_SUBDOMAIN } from '../data/satDomains';

const STORAGE_KEY = 'actsatgo:subdomain_skills';
const EVENT = 'actsatgo:subdomain-skills-updated';

export type SkillsMap = Record<string, string[]>;

function load(): SkillsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SKILLS_BY_SUBDOMAIN;
    // Merge stored overrides onto defaults so any new subdomains added later are present
    return { ...SKILLS_BY_SUBDOMAIN, ...(JSON.parse(raw) as SkillsMap) };
  } catch {
    return SKILLS_BY_SUBDOMAIN;
  }
}

function persist(map: SkillsMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event(EVENT));
}

export function useSubdomainSkills() {
  const [skillsMap, setSkillsMap] = useState<SkillsMap>(load);

  useEffect(() => {
    const handler = () => setSkillsMap(load());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
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
  }, []);

  const removeSkill = useCallback((subdomain: string, skill: string) => {
    setSkillsMap(prev => {
      const updated = { ...prev, [subdomain]: (prev[subdomain] ?? []).filter(s => s !== skill) };
      persist(updated);
      return updated;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSkillsMap(SKILLS_BY_SUBDOMAIN);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { skillsMap, addSkill, removeSkill, resetToDefaults };
}
