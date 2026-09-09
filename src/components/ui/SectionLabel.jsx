export default function SectionLabel({ children, className = '' }) {
  return (
    <p className={`section-label micro-label text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 ${className}`}>
      {children}
    </p>
  );
}
