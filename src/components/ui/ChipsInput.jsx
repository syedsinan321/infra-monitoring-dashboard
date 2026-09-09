import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Free-text chips (used for recipients). Enter / comma / blur commits the
 * current text as a chip; pasting "a@x.com, b@x.com" splits into multiple.
 * Model stays a plain string array to match the API.
 */
export default function ChipsInput({ value = [], onChange, placeholder, validate }) {
  const [draft, setDraft] = useState('');

  const commit = (raw) => {
    const parts = raw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) {
      if (!next.some(v => v.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    onChange(next);
    setDraft('');
  };

  const remove = (idx) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-wrap items-center gap-1.5 w-full px-2.5 py-2 rounded-lg text-sm bg-white/70 dark:bg-white/[0.06]
      border border-slate-300/70 dark:border-white/[0.1] focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/15 transition-colors">
      {value.map((v, i) => {
        const invalid = validate && !validate(v);
        return (
          <span
            key={`${v}-${i}`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border
              ${invalid
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25'
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25'}`}
          >
            {v}
            <button type="button" onClick={() => remove(i)} aria-label={`Remove ${v}`} className="hover:opacity-70">
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
      <input
        value={draft}
        onChange={e => {
          const v = e.target.value;
          if (v.includes(',') || v.includes(';')) commit(v);
          else setDraft(v);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
            e.preventDefault();
            commit(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) {
            remove(value.length - 1);
          }
        }}
        onBlur={() => { if (draft.trim()) commit(draft); }}
        placeholder={value.length ? '' : placeholder}
        className="flex-1 min-w-[8rem] bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
      />
    </div>
  );
}
