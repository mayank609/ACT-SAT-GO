/** Yes/No choice shown when an admin adds or edits a tutor account. */
export function CanAddStudentsToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const opt = (v: boolean, label: string) => (
    <button type="button" onClick={() => onChange(v)}
      className={`px-4 py-1 text-xs font-bold rounded transition-all ${
        value === v
          ? v ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-600 text-white shadow-sm'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
      }`}>
      {label}
    </button>
  );
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-slate-700">Can add student accounts</p>
        <p className="text-xs text-slate-400">Students they add are assigned to them.</p>
      </div>
      <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/50 flex-shrink-0">
        {opt(true, 'Yes')}
        {opt(false, 'No')}
      </div>
    </div>
  );
}
