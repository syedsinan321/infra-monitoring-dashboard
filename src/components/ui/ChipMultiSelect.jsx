/**
 * Toggleable-pill multi-select (group-by fields, email columns). Deliberately
 * not a dropdown -- no portal/outside-click/listbox a11y work needed.
 * Selected order is preserved, since it drives email column order.
 */
export default function ChipMultiSelect({ options, value = [], onChange, badges = {} }) {
  const toggle = (name) => {
    if (value.includes(name)) onChange(value.filter(v => v !== name));
    else onChange([...value, name]);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const selected = value.includes(opt.name);
        const badge = badges[opt.name];
        return (
          <button
            type="button"
            key={opt.name}
            onClick={() => toggle(opt.name)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
              ${selected
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25'
                : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-300/70 dark:border-white/[0.1] hover:border-slate-400 dark:hover:border-white/20'}`}
          >
            {selected && <span className="text-[10px] font-bold">{value.indexOf(opt.name) + 1}</span>}
            {opt.label}
            {badge && (
              <span className="text-[9px] uppercase tracking-wide opacity-70 border border-current/30 rounded px-1">
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
