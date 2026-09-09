const VARIANTS = {
  primary:   'bg-blue-600 hover:bg-blue-500 text-white border border-transparent shadow-sm',
  secondary: 'bg-white/70 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-slate-300/70 dark:border-white/[0.1]',
  ghost:     'bg-transparent hover:bg-slate-200/60 dark:hover:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-transparent',
  danger:    'bg-red-600 hover:bg-red-500 text-white border border-transparent shadow-sm',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
};

export default function Button({
  variant = 'secondary', size = 'md', icon: Icon, loading = false,
  className = '', children, ...props
}) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANTS[variant] || VARIANTS.secondary} ${SIZES[size] || SIZES.md} ${className}`}
    >
      {Icon && <Icon className={`${size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${loading ? 'animate-spin' : ''}`} />}
      {children}
    </button>
  );
}
