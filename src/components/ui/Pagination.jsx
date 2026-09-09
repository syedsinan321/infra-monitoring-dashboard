import { ChevronLeft, ChevronRight } from 'lucide-react';

function pageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const lo = Math.max(2, current - 1);
  const hi = Math.min(total - 1, current + 1);
  if (lo > 2) pages.push('…');
  for (let p = lo; p <= hi; p++) pages.push(p);
  if (hi < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

export default function Pagination({
  page, perPage, total, onPage, onPerPage,
  label = 'rows', perPageOptions = [25, 50, 100],
}) {
  if (!total) return null;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safe = Math.min(page, totalPages);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/70 dark:border-white/[0.07] text-xs text-slate-500">
      <span>
        Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{(safe - 1) * perPage + 1}</span>–
        <span className="font-semibold text-slate-700 dark:text-slate-300">{Math.min(safe * perPage, total)}</span> of{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-300">{total}</span> {label}
      </span>
      <div className="flex items-center gap-3">
        {onPerPage && (
          <select
            value={perPage}
            onChange={e => onPerPage(parseInt(e.target.value, 10))}
            className="px-2 py-1.5 rounded-lg bg-white/70 dark:bg-white/[0.06] border border-slate-300/70 dark:border-white/[0.1] focus:outline-none cursor-pointer"
          >
            {perPageOptions.map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(Math.max(1, safe - 1))}
            disabled={safe <= 1}
            className="p-1.5 rounded-lg border border-slate-300/70 dark:border-white/[0.1] disabled:opacity-40 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {pageNumbers(safe, totalPages).map((p, i) => p === '…' ? (
            <span key={`e${i}`} className="px-1.5">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`min-w-[1.9rem] px-2 py-1.5 rounded-lg border text-center transition-colors
                ${p === safe
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'border-slate-300/70 dark:border-white/[0.1] hover:bg-slate-100/70 dark:hover:bg-white/[0.06]'}`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => onPage(Math.min(totalPages, safe + 1))}
            disabled={safe >= totalPages}
            className="p-1.5 rounded-lg border border-slate-300/70 dark:border-white/[0.1] disabled:opacity-40 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
