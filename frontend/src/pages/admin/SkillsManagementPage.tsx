import { useState } from 'react';
import {
  BookMarked, Plus, RotateCcw, ChevronDown, ChevronRight, Info, X, Trash2,
} from 'lucide-react';
import { SAT_CONTENT } from '../../data/satDomains';
import { useSubdomainSkills } from '../../hooks/useSubdomainSkills';
import { useSubdomains } from '../../hooks/useSubdomains';
import toast, { Toaster } from 'react-hot-toast';

// ─── Subdomain card ───────────────────────────────────────────────────────────

function SubdomainCard({
  subdomain,
  skills,
  onAdd,
  onRemove,
  onRemoveSubdomain,
}: {
  subdomain: string;
  skills: string[];
  onAdd: (skill: string) => void;
  onRemove: (skill: string) => void;
  onRemoveSubdomain: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const handleAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const exists = skills.some(s => s.toLowerCase() === trimmed.toLowerCase());
    if (exists) { toast.error('Skill already exists in this subdomain'); return; }
    onAdd(trimmed);
    setDraft('');
    toast.success(`Added "${trimmed}"`);
  };

  const handleDeleteSubdomain = () => {
    onRemoveSubdomain();
    setConfirmDel(false);
    toast.success(`Removed subdomain "${subdomain}"`);
  };

  return (
    <div className="bg-slate-50/60 rounded-xl border border-slate-100 p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-bold text-slate-600 truncate">{subdomain}</p>
        {confirmDel ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleDeleteSubdomain}
              className="px-1.5 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              className="px-1.5 py-0.5 text-[10px] font-bold bg-white text-slate-500 border border-slate-200 rounded hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
            title="Delete subdomain"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

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
  subdomains,
  skillsMap,
  onAdd,
  onRemove,
  onAddSubdomain,
  onRemoveSubdomain,
}: {
  domain: { name: string; pct: number; range: string };
  subdomains: string[];
  skillsMap: Record<string, string[]>;
  onAdd: (sub: string, skill: string) => void;
  onRemove: (sub: string, skill: string) => void;
  onAddSubdomain: (name: string) => void;
  onRemoveSubdomain: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [subDraft, setSubDraft] = useState('');
  const totalSkills = subdomains.reduce((acc, s) => acc + (skillsMap[s]?.length ?? 0), 0);

  const handleAddSubdomain = () => {
    const trimmed = subDraft.trim();
    if (!trimmed) return;
    if (subdomains.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Subdomain already exists in this domain');
      return;
    }
    onAddSubdomain(trimmed);
    setSubDraft('');
    toast.success(`Added subdomain "${trimmed}"`);
  };

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
          <span className="text-[11px] text-slate-500">{subdomains.length} subdomains · {totalSkills} skills</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {subdomains.length === 0 && (
              <p className="text-[11px] text-slate-400 italic col-span-full py-2">No subdomains yet — add one below.</p>
            )}
            {subdomains.map(sub => (
              <SubdomainCard
                key={sub}
                subdomain={sub}
                skills={skillsMap[sub] ?? []}
                onAdd={skill => onAdd(sub, skill)}
                onRemove={skill => onRemove(sub, skill)}
                onRemoveSubdomain={() => onRemoveSubdomain(sub)}
              />
            ))}
          </div>

          {/* Add subdomain */}
          <div className="flex gap-1.5 pt-1">
            <input
              type="text"
              value={subDraft}
              onChange={e => setSubDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSubdomain()}
              placeholder={`Add a subdomain to ${domain.name}…`}
              className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-0"
            />
            <button
              onClick={handleAddSubdomain}
              disabled={!subDraft.trim()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-40"
            >
              <Plus size={12} /> Subdomain
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SkillsManagementPage() {
  const { skillsMap, addSkill, removeSkill, resetToDefaults } = useSubdomainSkills();
  const { subdomainsByDomain, addSubdomain, removeSubdomain, resetToDefaults: resetSubdomains } = useSubdomains();
  const [confirmReset, setConfirmReset] = useState(false);

  const totalSkills = Object.values(skillsMap).reduce((acc, arr) => acc + arr.length, 0);

  const handleReset = () => {
    resetToDefaults();
    resetSubdomains();
    setConfirmReset(false);
    toast.success('Subdomains & skills reset to defaults');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookMarked size={20} className="text-blue-600" />
            <h1 className="text-xl font-bold text-slate-900">Subdomains &amp; Skills</h1>
          </div>
          <p className="text-sm text-slate-500">
            Add or remove subdomains within each domain, and skills within each subdomain. The Test Builder's
            subdomain and skill dropdowns reflect these changes immediately.
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
          The SAT content hierarchy is <strong>Domain → Subdomain → Skill</strong>. Domains are fixed by College Board;
          you can add or delete <strong>subdomains</strong> and <strong>skills</strong> beneath them. Click any domain to
          expand it, add a subdomain with the field at the bottom of its panel, or delete one with the trash icon.
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
            subdomains={subdomainsByDomain[domain.name] ?? []}
            skillsMap={skillsMap}
            onAdd={addSkill}
            onRemove={removeSkill}
            onAddSubdomain={name => addSubdomain(domain.name, name)}
            onRemoveSubdomain={name => removeSubdomain(domain.name, name)}
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
            subdomains={subdomainsByDomain[domain.name] ?? []}
            skillsMap={skillsMap}
            onAdd={addSkill}
            onRemove={removeSkill}
            onAddSubdomain={name => addSubdomain(domain.name, name)}
            onRemoveSubdomain={name => removeSubdomain(domain.name, name)}
          />
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center">
        Subdomains &amp; skills are shared platform-wide — anything added or removed here is immediately visible to every admin and super admin.
      </p>
    </div>
  );
}
