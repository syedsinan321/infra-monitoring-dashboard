export default function Select({ value, onChange, children, className = '' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`px-3 py-2 rounded-lg text-sm bg-white/70 dark:bg-white/[0.06]
        border border-slate-300/70 dark:border-white/[0.1] text-slate-900 dark:text-white
        focus:outline-none focus:border-blue-500/60 cursor-pointer transition-colors ${className}`}
    >
      {children}
    </select>
  );
}
