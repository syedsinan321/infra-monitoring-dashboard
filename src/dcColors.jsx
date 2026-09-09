/**
 * Datacenter accent colors — SITE1 sky, SITE2 violet. One source of truth so
 * every page colors datacenter names/numbers the same way. In dark mode the
 * Steel Blue layer remaps these to --site1-accent / --site2-accent.
 */
export const DC_TEXT = {
  SITE1:  'text-sky-500 dark:text-sky-400',
  SITE2: 'text-violet-500 dark:text-violet-400',
};

export function classifyDC(name = '') {
  const n = (name || '').toLowerCase();
  if (n.includes('site2')) return 'SITE2';
  if (n.includes('site1')) return 'SITE1';
  return null;
}

/** Accent class for a DC name or anything DC-prefixed (clusters, domains). */
export function dcTextClass(value) {
  return DC_TEXT[value] || DC_TEXT[classifyDC(value)] || '';
}

/** Renders a datacenter (or DC-prefixed domain/cluster) name in its accent color. */
export function DcName({ value, className = '' }) {
  const accent = dcTextClass(value);
  return (
    <span className={`${accent ? `font-medium ${accent}` : ''} ${className}`.trim() || undefined}>
      {value || '—'}
    </span>
  );
}
