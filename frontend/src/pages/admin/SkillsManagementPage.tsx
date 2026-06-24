import { useState } from 'react';
import {
  BookMarked, Plus, Trash2, RotateCcw, Pencil, Check, X, Info,
  GripVertical,
} from 'lucide-react';
import { useSkillCategories, DEFAULT_SKILLS } from '../../hooks/useSkillCategories';
import toast, { Toaster } from 'react-hot-toast';

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
        active ? 'bg-indigo-600' : 'bg-slate-200'
      }`}
      aria-label={active ? 'Deactivate' : 'Activate'}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          active ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ─── Inline editable label ───────────────────────────────────────────────────

function EditableLabel({
  label,
  onSave,
}: {
  label: string;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  const commit = () => {
    if (draft.trim() && draft.trim() !== label) onSave(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 flex-1">
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(label); setEditing(false); }
          }}
          className="flex-1 px-2 py-0.5 text-sm border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-0"
        />
        <button onClick={commit} className="text-emerald-600 hover:text-emerald-700">
          <Check size={14} />
        </button>
        <button onClick={() => { setDraft(label); setEditing(false); }} className="text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-1 group">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <button
        onClick={() => { setDraft(label); setEditing(true); }}
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SkillsManagementPage() {
  const { skills, toggleActive, addSkill, renameSkill, removeSkill, resetToDefaults } = useSkillCategories();
  const [newLabel, setNewLabel] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const activeCount = skills.filter(s => s.active).length;

  const handleAdd = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const exists = skills.some(s => s.label.toLowerCase() === trimmed.toLowerCase());
    if (exists) { toast.error('A skill with that name already exists.'); return; }
    addSkill(trimmed);
    setNewLabel('');
    toast.success(`"${trimmed}" added`);
  };

  const handleDelete = (id: string) => {
    const skill = skills.find(s => s.id === id);
    removeSkill(id);
    setConfirmDelete(null);
    toast.success(`"${skill?.label}" removed`);
  };

  const handleReset = () => {
    resetToDefaults();
    setConfirmReset(false);
    toast.success('Skills reset to defaults');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookMarked size={20} className="text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-900">Skills Management</h1>
          </div>
          <p className="text-sm text-slate-500">
            Define the test-type categories that appear as filter toggles on the Student Mistakes page.
          </p>
        </div>
        {confirmReset ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-slate-500">Reset to defaults?</span>
            <button onClick={handleReset} className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
              Yes, reset
            </button>
            <button onClick={() => setConfirmReset(false)} className="px-3 py-1.5 text-xs font-bold bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <RotateCcw size={13} /> Reset to Defaults
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
        <Info size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-700 leading-relaxed">
          <strong>How matching works:</strong> A test is matched to a skill when its title contains all the words in the skill's label (case-insensitive). "HW" also matches "homework".
          For example, a test titled <em>"Math HW Set 3"</em> will match the skill <em>"Math HW"</em>.
          <br />
          <strong className="mt-1 block">{activeCount} of {skills.length} skills active</strong> — only active skills appear as toggles.
        </div>
      </div>

      {/* Add new skill */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Add New Skill</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder='e.g. "Science Practice" or "ACT Mock"'
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={handleAdd}
            disabled={!newLabel.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={15} /> Add
          </button>
        </div>
      </div>

      {/* Skills list */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1.5rem_1fr_auto_auto] items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <span />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Skill Label</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Active</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Remove</span>
        </div>

        {skills.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">
            No skills defined. Add one above or reset to defaults.
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {[...skills].sort((a, b) => a.order - b.order).map(skill => {
              const isDefault = DEFAULT_SKILLS.some(d => d.id === skill.id);
              return (
                <div
                  key={skill.id}
                  className={`grid grid-cols-[1.5rem_1fr_auto_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors ${
                    !skill.active ? 'opacity-50' : ''
                  }`}
                >
                  {/* Drag handle placeholder */}
                  <GripVertical size={14} className="text-slate-300 flex-shrink-0" />

                  {/* Label (editable) + keyword preview */}
                  <div className="min-w-0">
                    <EditableLabel
                      label={skill.label}
                      onSave={val => renameSkill(skill.id, val)}
                    />
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {skill.label.toLowerCase().split(/\s+/).map(w => (
                        <span key={w} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono">
                          {w === 'hw' ? 'hw / homework' : w}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Active toggle */}
                  <div className="flex justify-center">
                    <ToggleSwitch active={skill.active} onToggle={() => toggleActive(skill.id)} />
                  </div>

                  {/* Delete */}
                  <div className="flex justify-center">
                    {confirmDelete === skill.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(skill.id)} className="text-[10px] font-bold text-red-600 hover:text-red-700">
                          Yes
                        </button>
                        <span className="text-slate-300">|</span>
                        <button onClick={() => setConfirmDelete(null)} className="text-[10px] text-slate-400 hover:text-slate-600">
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(skill.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                        title={isDefault ? 'Remove default skill' : 'Remove skill'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Preview — Filter Toggles</p>
        <p className="text-xs text-slate-400 mb-3">This is how the active skills will appear on the Student Mistakes page:</p>
        <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white border border-indigo-600">
            All
          </span>
          {skills.filter(s => s.active).sort((a, b) => a.order - b.order).map(skill => (
            <span
              key={skill.id}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-600 border border-slate-200"
            >
              {skill.label}
            </span>
          ))}
          {skills.filter(s => s.active).length === 0 && (
            <span className="text-xs text-slate-400 italic">No active skills — only "All" will show.</span>
          )}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-slate-400 text-center">
        Skills are stored locally in this browser. For team-wide persistence, ask your backend admin to add a <code className="font-mono bg-slate-100 px-1 rounded">skill_categories</code> config endpoint.
      </p>
    </div>
  );
}
