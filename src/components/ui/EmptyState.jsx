export default function EmptyState({ icon: Icon, title, hint, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-10 px-6 ${className}`}>
      {Icon && (
        <div className="p-3 rounded-xl bg-slate-500/10 mb-3">
          <Icon className="h-5 w-5 text-slate-400" />
        </div>
      )}
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {hint && <p className="text-xs text-slate-500 mt-1 max-w-xs">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
