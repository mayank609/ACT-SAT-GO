import { useState } from 'react';
import { STUDENT_SUBJECTS } from '../../lib/sessionLog';

/** "Subjects to be taught" chips on the student enrol and edit forms, plus any typed-in subject (e.g. "College Chemistry"). */
export function SubjectPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [custom, setCustom] = useState('');
  const subjects = [...STUDENT_SUBJECTS, ...value.filter((s) => !STUDENT_SUBJECTS.includes(s))];
  const addCustom = () => {
    const s = custom.trim();
    if (s && !value.some((v) => v.toLowerCase() === s.toLowerCase())) onChange([...value, s]);
    setCustom('');
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {subjects.map((s) => {
          const on = value.includes(s);
          return (
            <button key={s} type="button"
              onClick={() => onChange(on ? value.filter((x) => x !== s) : [...value, s])}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                on ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
              }`}>
              {s}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        <input type="text" value={custom} onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          placeholder="Other subject, e.g. College Chemistry"
          className="flex-1 min-w-0 px-3 py-1.5 text-xs border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-100" />
        <button type="button" onClick={addCustom} disabled={!custom.trim()}
          className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:border-blue-300 disabled:opacity-50">
          Add
        </button>
      </div>
    </div>
  );
}
