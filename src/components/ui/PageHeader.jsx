/**
 * Compact page header — title, subtitle and actions on one row over a
 * hairline divider. Replaces the tall glass banner headers.
 */
export default function PageHeader({ title, subtitle, actions }) {
  // pt (not mt): a top margin collapses through the app shell and pushes the
  // washed background down, exposing a bar of flat body background on top.
  return (
    <div className="mx-4 sm:mx-6 lg:mx-8 pt-6 pb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 dark:border-white/[0.07]">
      <div>
        <h1 className="page-title text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
