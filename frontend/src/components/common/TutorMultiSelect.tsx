import { useRef, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface TutorOption {
  id: string;
  name: string;
}

interface TutorMultiSelectProps {
  options: TutorOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function TutorMultiSelect({ options, value, onChange, placeholder = 'No tutor assigned' }: TutorMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const selectedNames = options.filter((o) => value.includes(o.id)).map((o) => o.name);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
      >
        <span className={`truncate text-left ${selectedNames.length ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
          {selectedNames.length ? selectedNames.join(', ') : placeholder}
        </span>
        <ChevronDown size={14} className={`flex-shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-56 overflow-y-auto">
          {options.length > 0 ? (
            options.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={value.includes(opt.id)}
                  onChange={() => toggle(opt.id)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                {opt.name}
              </label>
            ))
          ) : (
            <div className="px-3 py-4 text-center text-sm text-slate-400">No tutors available</div>
          )}
        </div>
      )}
    </div>
  );
}
