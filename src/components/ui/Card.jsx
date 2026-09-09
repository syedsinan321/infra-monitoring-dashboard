/**
 * Flat premium surface — near-opaque, hairline border, soft shadow on hover.
 * The base building block of the design system.
 */
export function Card({ className = '', hover = false, children, ...props }) {
  return (
    <div
      className={`rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-slate-900/60 backdrop-blur-md
        ${hover ? 'card-clickable cursor-pointer transition-all duration-150' : ''}
        ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
