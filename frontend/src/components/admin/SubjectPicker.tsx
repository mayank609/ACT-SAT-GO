import { STUDENT_SUBJECTS } from '../../lib/sessionLog';

/** "Subjects to be taught" chips on the student enrol and edit forms. */
export function SubjectPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STUDENT_SUBJECTS.map((s) => {
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
  );
}
