import { useState } from 'react';
import {
  BookMarked, Plus, RotateCcw, ChevronDown, ChevronRight, Info, X,
} from 'lucide-react';
import { SAT_CONTENT } from '../../data/satDomains';
import { useSubdomainSkills } from '../../hooks/useSubdomainSkills';
import toast, { Toaster } from 'react-hot-toast';

// ─── Subdomain card ───────────────────────────────────────────────────────────

function SubdomainCard({
  subdomain,
  skills,
  onAdd,
  onRemove,
}: {
  subdomain: string;
  skills: string[];
  onAdd: (skill: string) => void;
  onRemove: (skill: string) => void;
}) {
  const [draft, setDraft] = useState('');

  const handleAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const exists = skills.some(s => s.toLowerCase() === trimmed.toLowerCase());
    if (exists) { toast.error('Skill already exists in this subdomain'); return; }
    onAdd(trimmed);
    setDraft('');
    toast.success(`Added "${trimmed}"`);
  };

  return (
    <div className="bg-slate-50/60 rounded-xl border border-slate-100 p-3">
      <p className="text-xs font-bold text-slate-600 mb-2 truncate">{subdomain}</p>

      {/* Skill chips */}
      <div className="flex flex-wrap gap-1.5 mb-2.5 min-h-[1.5rem]">
        {skills.length === 0 && (
          <span className="text-[11px] text-slate-400 italic">No skills yet</span>
        )}
        {skills.map(skill => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 bg-white border border-slate-200 rounded-full text-xs text-slate-700 font-medium shadow-sm"
          >
            {skill}
            <button
              onClick={() => onRemove(skill)}
              className="ml-0.5 text-slate-400 hover:text-red-500 transition-colors"
              title="Remove skill"
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>

      {/* Add skill input */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Add skill…"
          className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-0"
        />
        <button
          onClick={handleAdd}
          disabled={!draft.trim()}
          className="flex items-center gap-0.5 px-2.5 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40"
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}

// ─── Domain section ───────────────────────────────────────────────────────────

function DomainSection({
  domain,
  skillsMap,
  onAdd,
  onRemove,
}: {
  domain: { name: string; pct: number; range: string; subs: string[] };
  skillsMap: Record<string, string[]>;
  onAdd: (sub: string, skill: string) => void;
  onRemove: (sub: string, skill: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const totalSkills = domain.subs.reduce((acc, s) => acc + (skillsMap[s]?.length ?? 0), 0);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown size={15} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={15} className="text-slate-400 flex-shrink-0" />}
          <span className="font-semibold text-sm text-slate-800 truncate">{domain.name}</span>
          <span className="text-[11px] text-slate-400 flex-shrink-0">{domain.pct}%</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className="text-[11px] text-slate-500">{domain.subs.length} subdomains · {totalSkills} skills</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-100">
          {domain.subs.map(sub => (
            <SubdomainCard
              key={sub}
              subdomain={sub}
              skills={skillsMap[sub] ?? []}
              onAdd={skill => onAdd(sub, skill)}
              onRemove={skill => onRemove(sub, skill)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SkillsManagementPage() {
  const { skillsMap, addSkill, removeSkill, resetToDefaults } = useSubdomainSkills();
  const [confirmReset, setConfirmReset] = useState(false);

  const totalSkills = Object.values(skillsMap).reduce((acc, arr) => acc + arr.length, 0);

  const handleReset = () => {
    resetToDefaults();
    setConfirmReset(false);
    toast.success('Skills reset to defaults');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookMarked size={20} className="text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Skills Management</h1>
          </div>
          <p className="text-sm text-slate-500">
            Add or remove skills under each subdomain. The Test Builder's skill dropdown reflects these immediately.
          </p>
        </div>
        {confirmReset ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-slate-500">Reset all to defaults?</span>
            <button onClick={handleReset} className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700">
              Yes, reset
            </button>
            <button onClick={() => setConfirmReset(false)} className="px-3 py-1.5 text-xs font-bold bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex-shrink-0"
          >
            <RotateCcw size={13} /> Reset to Defaults
          </button>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Skills are the third level of the SAT content hierarchy: <strong>Domain → Subdomain → Skill</strong>.
          Click any domain to expand its subdomains. Add skills using the input fields, or remove them with the × button.
          <strong className="ml-1">{totalSkills} total skills</strong> across all subdomains.
        </p>
      </div>

      {/* Reading & Writing */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
          Reading &amp; Writing
        </h2>
        {SAT_CONTENT['Reading and Writing'].map(domain => (
          <DomainSection
            key={domain.name}
            domain={domain}
            skillsMap={skillsMap}
            onAdd={addSkill}
            onRemove={removeSkill}
          />
        ))}
      </div>

      {/* Math */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          Math
        </h2>
        {SAT_CONTENT['Math'].map(domain => (
          <DomainSection
            key={domain.name}
            domain={domain}
            skillsMap={skillsMap}
            onAdd={addSkill}
            onRemove={removeSkill}
          />
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Skills are stored locally. For team-wide persistence, ask your backend admin to add a <code className="font-mono bg-slate-100 px-1 rounded">subdomain_skills</code> config endpoint.
      </p>
    </div>
  );
}
