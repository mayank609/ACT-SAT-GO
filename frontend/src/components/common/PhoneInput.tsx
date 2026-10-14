import { useEffect, useState } from 'react';

// Country codes offered next to every phone number field. India first (most
// students), then the other markets ACT SAT GO serves, then the rest A–Z.
export const COUNTRY_CODES: { code: string; label: string }[] = [
  { code: '+91', label: 'IN' },
  { code: '+1', label: 'US/CA' },
  { code: '+971', label: 'AE' },
  { code: '+65', label: 'SG' },
  { code: '+60', label: 'MY' },
  { code: '+44', label: 'UK' },
  { code: '+61', label: 'AU' },
  { code: '+973', label: 'BH' },
  { code: '+880', label: 'BD' },
  { code: '+86', label: 'CN' },
  { code: '+49', label: 'DE' },
  { code: '+33', label: 'FR' },
  { code: '+852', label: 'HK' },
  { code: '+62', label: 'ID' },
  { code: '+81', label: 'JP' },
  { code: '+254', label: 'KE' },
  { code: '+82', label: 'KR' },
  { code: '+965', label: 'KW' },
  { code: '+94', label: 'LK' },
  { code: '+977', label: 'NP' },
  { code: '+234', label: 'NG' },
  { code: '+64', label: 'NZ' },
  { code: '+968', label: 'OM' },
  { code: '+63', label: 'PH' },
  { code: '+974', label: 'QA' },
  { code: '+966', label: 'SA' },
  { code: '+66', label: 'TH' },
  { code: '+90', label: 'TR' },
  { code: '+84', label: 'VN' },
  { code: '+27', label: 'ZA' },
];
const DEFAULT_CODE = '+91';

/** Splits a saved number like "+91 98765 43210" into code and local part. */
export function splitPhone(value: string | null | undefined): { code: string; local: string } {
  const v = (value ?? '').trim();
  if (v.startsWith('+')) {
    const digits = v.slice(1).replace(/\D/g, '');
    // Longest known code that matches, else the digits before the first space.
    const known = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
      .find((c) => digits.startsWith(c.code.slice(1)));
    if (known && (v.startsWith(`${known.code} `) || v.startsWith(`${known.code}-`) || !/\s/.test(v))) {
      return { code: known.code, local: v.slice(known.code.length).replace(/^[\s-]+/, '') };
    }
    const m = v.match(/^(\+\d{1,4})[\s-]*(.*)$/);
    if (m) return { code: m[1], local: m[2] };
  }
  return { code: DEFAULT_CODE, local: v };
}

/**
 * Phone number with a country code picker. The value is saved as
 * "+CC number" (e.g. "+91 9876543210"), or "" when no number is typed.
 */
export function PhoneInput({ value, onChange, className, placeholder = 'Phone number' }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [code, setCode] = useState(() => splitPhone(value).code);
  const local = splitPhone(value).local;
  // Follow the saved value when the form is (re)filled, but keep the picked code while the number is empty.
  useEffect(() => { if (value) setCode(splitPhone(value).code); }, [value]);

  const emit = (c: string, l: string) => onChange(l.trim() ? `${c} ${l.replace(/^\s+/, '')}` : '');
  // The field's own classes, minus full width, so the code picker stays narrow.
  const base = (className ?? '').split(/\s+/).filter((c) => c !== 'w-full' && !/^px-/.test(c)).join(' ');
  const codes = COUNTRY_CODES.some((c) => c.code === code) ? COUNTRY_CODES : [{ code, label: '' }, ...COUNTRY_CODES];

  return (
    <div className="flex gap-1.5">
      <select value={code} aria-label="Country code"
        onChange={(e) => { setCode(e.target.value); emit(e.target.value, local); }}
        className={`${base} w-auto shrink-0 px-2`}>
        {codes.map((c) => <option key={c.code} value={c.code}>{c.code}{c.label ? ` ${c.label}` : ''}</option>)}
      </select>
      <input type="tel" value={local} placeholder={placeholder} inputMode="tel"
        onChange={(e) => emit(code, e.target.value)}
        className={`${className ?? ''} min-w-0 flex-1`} />
    </div>
  );
}
