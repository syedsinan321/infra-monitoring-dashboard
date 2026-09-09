/** Standard search + filters row: first child stretches, the rest sit right. */
export default function Toolbar({ children, className = '' }) {
  return (
    <div className={`flex flex-col lg:flex-row lg:items-center gap-3 [&>*:first-child]:flex-1 ${className}`}>
      {children}
    </div>
  );
}
