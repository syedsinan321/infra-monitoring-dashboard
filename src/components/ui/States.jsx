export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-500" />
      <span className="ml-3 text-sm text-slate-500">{label}</span>
    </div>
  );
}

export function ErrorBanner({ message }) {
  return (
    <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
      Error: {message}
    </div>
  );
}
