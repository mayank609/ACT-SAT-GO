import { useState, useCallback, useEffect } from 'react';

export interface SkillCategory {
  id: string;
  label: string;
  value: string;   // lowercase_underscore slug used for filtering
  active: boolean;
  order: number;
}

const STORAGE_KEY = 'actsatgo:skill_categories';

export const DEFAULT_SKILLS: SkillCategory[] = [
  { id: 'mock', label: 'Mocks', value: 'mock', active: true, order: 1 },
  { id: 'diagnostic', label: 'Diagnostic', value: 'diagnostic', active: true, order: 2 },
  { id: 'math_hw', label: 'Math HW', value: 'math_hw', active: true, order: 3 },
  { id: 'reading_hw', label: 'Reading HW', value: 'reading_hw', active: true, order: 4 },
  { id: 'writing_hw', label: 'Writing HW', value: 'writing_hw', active: true, order: 5 },
  { id: 'math_practice', label: 'Math Practice', value: 'math_practice', active: true, order: 6 },
  { id: 'reading_practice', label: 'Reading Practice', value: 'reading_practice', active: true, order: 7 },
  { id: 'writing_practice', label: 'Writing Practice', value: 'writing_practice', active: true, order: 8 },
];

export function labelToValue(label: string): string {
  return label.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/** Returns the skill value (or 'other') that best matches the given test title. */
export function getSkillForTest(testTitle: string, skills: SkillCategory[]): string {
  const t = testTitle.toLowerCase();
  for (const skill of [...skills].sort((a, b) => a.order - b.order)) {
    const words = skill.label.toLowerCase().split(/\s+/);
    const matches = words.every(word => {
      if (word === 'hw') return t.includes('hw') || t.includes('homework');
      return t.includes(word);
    });
    if (matches) return skill.value;
  }
  return 'other';
}

function load(): SkillCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SKILLS;
    const parsed = JSON.parse(raw) as SkillCategory[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SKILLS;
  } catch {
    return DEFAULT_SKILLS;
  }
}

function persist(skills: SkillCategory[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(skills));
  window.dispatchEvent(new Event('actsatgo:skills-updated'));
}

export function useSkillCategories() {
  const [skills, setSkills] = useState<SkillCategory[]>(load);

  useEffect(() => {
    const handler = () => setSkills(load());
    window.addEventListener('actsatgo:skills-updated', handler);
    return () => window.removeEventListener('actsatgo:skills-updated', handler);
  }, []);

  const toggleActive = useCallback((id: string) => {
    setSkills(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, active: !s.active } : s);
      persist(updated);
      return updated;
    });
  }, []);

  const addSkill = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const value = labelToValue(trimmed);
    const id = `${value}_${Date.now()}`;
    setSkills(prev => {
      const updated = [...prev, { id, label: trimmed, value, active: true, order: prev.length + 1 }];
      persist(updated);
      return updated;
    });
  }, []);

  const renameSkill = useCallback((id: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    setSkills(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, label: trimmed } : s);
      persist(updated);
      return updated;
    });
  }, []);

  const removeSkill = useCallback((id: string) => {
    setSkills(prev => {
      const updated = prev.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }));
      persist(updated);
      return updated;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setSkills(DEFAULT_SKILLS);
    persist(DEFAULT_SKILLS);
  }, []);

  return { skills, toggleActive, addSkill, renameSkill, removeSkill, resetToDefaults };
}
