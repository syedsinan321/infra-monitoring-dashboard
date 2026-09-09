import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { Card } from './Card';
import Button from './Button';

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger = true, onConfirm, onCancel,
}) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <Card className="max-w-sm w-full bg-white/95 dark:bg-slate-900/95 p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/15 flex-shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
            {message && <p className="text-xs text-slate-500 mt-1.5">{message}</p>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </Card>
    </div>,
    document.body,
  );
}
