export default function Toggle({ checked, onChange, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex flex-shrink-0 h-5 w-9 items-center rounded-full
        transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
        ${checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/15'} ${className}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm
          transition-transform duration-150 ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
      />
    </button>
  );
}
