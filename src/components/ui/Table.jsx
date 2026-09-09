import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';

/** Standardized table primitives — one look for every table in the app. */

export function Table({ children, className = '' }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${className}`}>{children}</table>
    </div>
  );
}

export function THead({ children, className = '' }) {
  return (
    <thead className={`border-b border-slate-200/70 dark:border-white/[0.07] ${className}`}>
      <tr>{children}</tr>
    </thead>
  );
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">{children}</tbody>;
}

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' };

export function Th({ children, align = 'left', sortable = false, active = false, dir = 'asc', onSort, className = '' }) {
  return (
    <th
      onClick={sortable ? onSort : undefined}
      className={`${ALIGN[align]} py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap
        ${sortable ? 'cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200 transition-colors' : ''} ${className}`}
    >
      {children}
      {sortable && (
        active
          ? (dir === 'asc'
              ? <ChevronUp className="h-3 w-3 inline ml-1 text-blue-500 dark:text-blue-400" />
              : <ChevronDown className="h-3 w-3 inline ml-1 text-blue-500 dark:text-blue-400" />)
          : <ArrowUpDown className="h-3 w-3 inline ml-1 text-slate-400/60" />
      )}
    </th>
  );
}

export function Tr({ children, className = '', ...props }) {
  return (
    <tr className={`transition-colors hover:bg-slate-100/60 dark:hover:bg-white/[0.04] ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function Td({ children, align = 'left', className = '' }) {
  return <td className={`py-2.5 px-4 text-sm ${ALIGN[align]} ${className}`}>{children}</td>;
}

/** Collapsible group header row (e.g. one datacenter inside a table card). */
export function GroupRow({ expanded, onToggle, icon: Icon, title, meta, titleClass = '' }) {
  return (
    <button
      onClick={onToggle}
      className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors"
    >
      <div className="flex items-center gap-2.5">
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
        <span className={`text-sm font-semibold ${titleClass || 'text-slate-900 dark:text-white'}`}>{title}</span>
      </div>
      {meta && <div className="flex items-center gap-4 text-xs text-slate-500">{meta}</div>}
    </button>
  );
}

/** Animated container for group content — smooth expand/collapse. */
export function GroupBody({ expanded, children }) {
  return (
    <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
