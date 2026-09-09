/**
 * Label + hint + error wrapper, codifying the markup hand-rolled on the
 * Host Crash Report collect form.
 */
export default function FieldRow({ label, hint, error, children }) {
  return (
    <div>
      {label && (
        <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
          {label}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  );
}
