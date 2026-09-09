import { Card } from './Card';

const TONES = {
  positive: 'text-emerald-600 dark:text-emerald-400',
  negative: 'text-red-500 dark:text-red-400',
  warning:  'text-amber-600 dark:text-amber-400',
  muted:    'text-slate-500',
};

export default function KpiCard({ label, value, sub, subTone = 'muted', valueClass = '' }) {
  return (
    <Card className="p-4">
      <p className="micro-label text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className={`kpi-value mt-1.5 text-[26px] leading-8 font-semibold tracking-tight tabular-nums ${valueClass || 'text-slate-900 dark:text-white'}`}>
        {value}
      </p>
      {sub && <p className={`mt-1 text-xs font-medium ${TONES[subTone] || TONES.muted}`}>{sub}</p>}
    </Card>
  );
}
