import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import ArchitecturePage from '../pages/ArchitecturePage';

/* Near-fullscreen overlay for the Intersight Architecture diagram, opened
   from the Dashboard's "Intersight Topology" banner instead of navigating
   away. Reuses ArchitecturePage as-is (it manages its own data fetching). */
export default function IntersightTopologyModal({ onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full h-full max-w-[1600px] max-h-[92vh] rounded-2xl overflow-hidden
        bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-white/[0.08] shadow-2xl flex flex-col">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 p-2 rounded-lg text-slate-500 dark:text-slate-300
            bg-white/90 dark:bg-white/10 hover:bg-slate-200/80 dark:hover:bg-white/20 backdrop-blur-sm transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1 overflow-y-auto">
          <ArchitecturePage />
        </div>
      </div>
    </div>,
    document.body,
  );
}
