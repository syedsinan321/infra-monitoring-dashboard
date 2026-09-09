import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Card } from './Card';

/**
 * Generic portal modal shell — extracted from the pattern hand-rolled on the
 * Host Crash Report detail view: backdrop, sticky header, scrollable body.
 */
export default function Modal({ open, title, sub, icon: Icon, onClose, actions, maxWidth = 'max-w-4xl', children }) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <Card className={`w-full ${maxWidth} max-h-[85vh] overflow-y-auto shadow-2xl bg-white/95 dark:bg-slate-900/95`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200/70 dark:border-white/[0.07] bg-white/95 dark:bg-slate-900/95 backdrop-blur px-5 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && <Icon className="h-4 w-4 text-slate-400 flex-shrink-0" />}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{title}</h2>
              {sub && <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {actions && (
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200/70 dark:border-white/[0.07] bg-white/95 dark:bg-slate-900/95 backdrop-blur px-5 py-3">
            {actions}
          </div>
        )}
      </Card>
    </div>,
    document.body,
  );
}
