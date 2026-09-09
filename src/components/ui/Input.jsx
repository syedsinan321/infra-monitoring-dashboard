export default function Input({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-lg text-sm bg-white/70 dark:bg-white/[0.06]
        border border-slate-300/70 dark:border-white/[0.1] text-slate-900 dark:text-white
        placeholder-slate-400 dark:placeholder-slate-500
        focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/15 transition-colors ${className}`}
    />
  );
}
