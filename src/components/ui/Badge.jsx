const VARIANTS = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25',
  warning:  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
  success:  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  info:     'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
  neutral:  'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25',
  site1:      'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25',
  site2:     'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25',
};

const DOTS = {
  critical: 'bg-red-500',
  warning:  'bg-amber-400',
  success:  'bg-emerald-400',
  info:     'bg-blue-400',
  neutral:  'bg-slate-400',
  site1:      'bg-sky-400',
  site2:     'bg-violet-400',
};

export default function Badge({ variant = 'neutral', dot = false, children, className = '' }) {
  return (
    <span
      className={`ui-badge inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap
        ${VARIANTS[variant] || VARIANTS.neutral} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOTS[variant] || DOTS.neutral}`} />}
      {children}
    </span>
  );
}
