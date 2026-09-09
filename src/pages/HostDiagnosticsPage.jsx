import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Stethoscope, Search, RefreshCw, Sparkles, AlertTriangle, ScrollText,
  Activity, FileText, Server, CheckCircle2, XCircle, Clock,
  FlaskConical, HelpCircle, Layers, User, KeyRound, Eye, EyeOff, Package,
  Download, X, Trash2, LayoutGrid, List, ChevronRight, DollarSign,
  Info, Network, Boxes,
} from 'lucide-react';
import ClaudeSpark from '../components/ClaudeSpark';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, PieChart, Pie, Cell,
} from 'recharts';
import { fetchCimcHosts } from '../api';
import mockFetch from '../mockFetch';
import AnalysisReport from '../components/AnalysisReport';
import DeviceDetailModal from '../components/DeviceDetailModal';
import { loadDeviceIndex } from '../deviceIndex';
import { dcTextClass } from '../dcColors';
import {
  PageHeader, Button, Badge, SearchInput, Select, Pagination,
  LoadingState, ErrorBanner, EmptyState,
} from '../components/ui';

const API_BASE = import.meta.env.VITE_API_URL || '';

// This is a static demo — there's no real TAC bundle on a server to stream.
// The "Download" button hands back a small placeholder file instead of a
// dead link, so the interaction still completes end to end.
function mockDownloadHref() {
  const body = [
    'Mock TAC tech-support bundle', '='.repeat(30), '',
    'This is a placeholder file from the Platform Dashboard demo build.',
    'In the original, live-backend version of this app, this button streamed',
    'a real Cisco Intersight tech-support bundle collected from the device.',
    '',
    `Generated: ${new Date().toISOString()}`,
  ].join('\n');
  return `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`;
}

const LOCAL_TZ_LABEL = Intl.DateTimeFormat().resolvedOptions().timeZone;

const DC_TABS = [
  { key: 'ALL',  label: 'All Servers' },
  { key: 'SITE1',  label: 'SITE1' },
  { key: 'SITE2', label: 'SITE2' },
];

const TIME_RANGES = [
  { value: '6',  label: 'Last 6 hours' },
  { value: '12', label: 'Last 12 hours' },
  { value: '24', label: 'Last 24 hours' },
  { value: '48', label: 'Last 48 hours' },
  { value: 'custom', label: 'Custom range' },
];

const SOURCE_CHOICES = [
  { key: 'intersight', label: 'Intersight', icon: ScrollText, sources: ['intersight'],            desc: 'Faults, SEL & TAC bundle' },
  { key: 'vcenter',    label: 'vCenter',    icon: Activity,   sources: ['vcenter'],               desc: 'Events & host syslog' },
  { key: 'both',       label: 'Both',       icon: Layers,     sources: ['intersight', 'vcenter'], desc: 'Full picture' },
];

function localToUtcIso(localDateTimeStr) {
  if (!localDateTimeStr) return null;
  return new Date(localDateTimeStr).toISOString();
}

function fmtLocal(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  return d.toLocaleString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  });
}

function prettyModel(id) {
  if (!id) return '—';
  return id.split('-').map(w => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

function relTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '—';
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDuration(secs) {
  if (secs == null) return null;
  const s = Math.round(secs);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

function fmtClock(isoStr) {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// Severity buckets for the Past Analyses timeline (mirrors the filter pills).
const SEV_BUCKETS = {
  critical: { icon: XCircle,       iconCls: 'text-red-400',     ring: 'bg-red-500/15' },
  warning:  { icon: AlertTriangle, iconCls: 'text-amber-400',   ring: 'bg-amber-500/15' },
  healthy:  { icon: CheckCircle2,  iconCls: 'text-emerald-400', ring: 'bg-emerald-500/15' },
  none:     { icon: Clock,         iconCls: 'text-slate-400',   ring: 'bg-slate-500/15' },
};

function sevBucket(h) {
  if (!h.analyzed) return 'none';
  if (h.severity === 'Critical' || h.severity === 'Major') return 'critical';
  if (h.severity === 'Warning') return 'warning';
  return 'healthy';
}

const REPORT_PILLS = [
  { key: 'all',      label: 'All' },
  { key: 'warning',  label: 'Warning',  dot: 'bg-amber-400' },
  { key: 'critical', label: 'Critical', dot: 'bg-red-400' },
  { key: 'healthy',  label: 'Healthy',  dot: 'bg-emerald-400' },
];

const SEVERITY_META = {
  Critical: 'bg-red-500/15 border-red-500/30 text-red-400',
  Major:    'bg-orange-500/15 border-orange-500/30 text-orange-400',
  Warning:  'bg-amber-500/15 border-amber-500/30 text-amber-400',
  Info:     'bg-slate-500/15 border-slate-500/30 text-slate-400',
};

function SeverityBadge({ severity }) {
  const cls = SEVERITY_META[severity] || SEVERITY_META['Info'];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      {severity}
    </span>
  );
}

const STATUS_TONES = {
  green: 'bg-emerald-400',
  red:   'bg-red-400',
  amber: 'bg-amber-400',
  slate: 'bg-slate-400',
};

// Health from the live vCenter host state. Folds in vCenter's overallStatus
// rollup (which includes triggered alarms) so an alarming host can't read
// Healthy: Offline / MM / Alert / Degraded / Healthy.
function vcStatus(vc) {
  if (!vc?.connection_state) return null;
  // notResponding / disconnected — vCenter has lost contact with the host
  if (vc.connection_state !== 'connected') return { label: 'Offline', tone: 'red' };
  if (vc.maintenance_mode) return { label: 'MM', tone: 'amber' };
  if (vc.power_state !== 'poweredOn') return { label: 'Degraded', tone: 'amber' };
  if (vc.overall_status === 'red') return { label: 'Alert', tone: 'red' };
  if (vc.overall_status === 'yellow') return { label: 'Degraded', tone: 'amber' };
  return { label: 'Healthy', tone: 'green' };
}

function StatusDot({ status }) {
  if (!status) return <span className="text-xs text-slate-500">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${STATUS_TONES[status.tone] || STATUS_TONES.slate}`} />
      {status.label}
    </span>
  );
}

const ALARM_SEV_ORDER = { Alert: 0, Offline: 1, Degraded: 2, MM: 3 };

/* "Alarms" section — every non-healthy host, with the exact errors inline:
   live Intersight alarms, vCenter triggered alarms and config issues. */
function AlarmsSection({ hosts, vcByShort, onOpenDevice, deviceLoading }) {
  const [details, setDetails] = useState({}); // moid -> { loading, error, data }
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    for (const h of hosts) {
      if (fetchedRef.current.has(h.moid)) continue;
      fetchedRef.current.add(h.moid);
      setDetails(d => ({ ...d, [h.moid]: { loading: true } }));
      const hint = h.vcenter ? `&vcenter=${encodeURIComponent(h.vcenter)}` : '';
      mockFetch(`${API_BASE}/api/diagnostics/host-alerts?host=${encodeURIComponent(h.server_profile)}${hint}`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(data => setDetails(d => ({ ...d, [h.moid]: { data } })))
        .catch(e => setDetails(d => ({ ...d, [h.moid]: { error: e.message } })));
    }
  }, [hosts]);

  if (hosts.length === 0) {
    return (
      <div className="ai-surface rounded-xl p-10 text-center ai-fade-in">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-500 dark:text-emerald-400" />
        <p className="text-sm font-medium text-slate-900 dark:text-white">All hosts healthy</p>
        <p className="text-xs text-slate-500 mt-1">
          No alerts, degraded states, maintenance mode, or offline hosts right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 ai-fade-in">
      {hosts.map(h => {
        const vc = vcByShort.get((h.server_profile || '').toLowerCase());
        const det = details[h.moid] || {};
        const red = h.status.tone === 'red';
        const reasons = [];
        if (vc) {
          if (vc.connection_state && vc.connection_state !== 'connected') reasons.push(`vCenter connection: ${vc.connection_state}`);
          if (vc.maintenance_mode) reasons.push('In maintenance mode');
          if (vc.power_state && vc.power_state !== 'poweredOn') reasons.push(`Power: ${vc.power_state}`);
          if (vc.overall_status === 'red' || vc.overall_status === 'yellow') reasons.push(`vCenter overall status: ${vc.overall_status}`);
        }
        const isAlarms = det.data?.intersight?.alarms || [];
        const vcAlarms = det.data?.vcenter?.alarms || [];
        const configIssues = det.data?.vcenter?.config_issues || [];
        return (
          <div
            key={h.moid}
            className={`ai-surface rounded-xl border overflow-hidden ${red ? 'border-red-500/30' : 'border-amber-500/30'}`}
          >
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-200/60 dark:border-white/[0.06]">
              <StatusDot status={h.status} />
              <button
                onClick={() => onOpenDevice(h)}
                className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {deviceLoading === h.moid ? 'Opening…' : h.server_profile}
              </button>
              {h.cluster && <span className={`text-xs ${dcTextClass(h.cluster) || 'text-slate-500'}`}>{h.cluster}</span>}
              {h.vcenter && <span className="text-xs text-slate-500">{h.vcenter}</span>}
              <span className="ml-auto flex flex-wrap gap-1.5">
                {reasons.map(r => (
                  <span
                    key={r}
                    className={`px-2 py-0.5 rounded-md border text-[11px] ${red
                      ? 'bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-300'
                      : 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-300'}`}
                  >
                    {r}
                  </span>
                ))}
              </span>
            </div>

            <div className="px-4 py-3 space-y-2">
              {det.loading && (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Pulling exact errors from Intersight &amp; vCenter…
                </p>
              )}
              {det.error && (
                <p className="text-xs text-amber-500 dark:text-amber-400">Could not load error detail: {det.error}</p>
              )}
              {det.data && (
                <>
                  {isAlarms.map((a, i) => (
                    <div key={`is-${i}`} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                      <p className="text-slate-700 dark:text-slate-200 break-words">
                        <span className="text-[11px] font-semibold text-slate-500 mr-1.5">INTERSIGHT · {a.severity}</span>
                        {a.description}
                      </p>
                    </div>
                  ))}
                  {vcAlarms.map((a, i) => (
                    <div key={`vc-${i}`} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                      <p className="text-slate-700 dark:text-slate-200 break-words">
                        <span className="text-[11px] font-semibold text-slate-500 mr-1.5">VCENTER ALARM</span>
                        {a.name}
                        {a.time && <span className="text-xs text-slate-500"> · {new Date(a.time).toLocaleString()}</span>}
                      </p>
                    </div>
                  ))}
                  {configIssues.map((msg, i) => (
                    <div key={`ci-${i}`} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                      <p className="text-slate-700 dark:text-slate-200 break-words">
                        <span className="text-[11px] font-semibold text-slate-500 mr-1.5">VCENTER CONFIG ISSUE</span>
                        {msg}
                      </p>
                    </div>
                  ))}
                  {isAlarms.length === 0 && vcAlarms.length === 0 && configIssues.length === 0 && (
                    <p className="text-xs text-slate-500">
                      No specific alarm text from Intersight or vCenter — the status comes from the state flags above.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SourceChip({ vcenterOnly }) {
  return vcenterOnly ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/30 whitespace-nowrap">
      vCenter
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 whitespace-nowrap">
      Intersight
    </span>
  );
}

function UsageStat({ icon: Icon, tile, label, value, sub }) {
  return (
    <div className="ai-surface rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3.5">
        <div className={`p-2.5 rounded-xl ${tile}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className="kpi-value text-2xl font-bold text-slate-900 dark:text-white truncate" title={String(value)}>{value}</p>
      {sub && <div className="text-xs text-slate-500 mt-1.5">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, right, children, className = '' }) {
  return (
    <div className={`ai-surface rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="ai-surface rounded-xl p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}/20`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}

/* ------------------------- Fleet health KPI row ------------------------- */

function KpiCard({ icon: Icon, tile, label, value, sub, pct, barCls, affectedHosts, affectedLabel = 'Affected hosts' }) {
  const shown = (affectedHosts || []).slice(0, 12);
  return (
    <div className="relative group hover:z-50 ai-surface rounded-2xl p-4 flex flex-col gap-2.5 min-w-0">
      <div className="flex items-center gap-2.5">
        <div className={`p-2 rounded-xl ${tile}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">{label}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-slate-500 truncate">{sub}</p>}
      </div>
      {pct != null && (
        <div className="h-1 rounded-full bg-slate-200/70 dark:bg-white/[0.07] overflow-hidden">
          <div className={`h-full rounded-full ${barCls}`} style={{ width: `${Math.max(pct, 1.5)}%` }} />
        </div>
      )}
      {/* Hover tooltip: which hosts are behind this number */}
      {shown.length > 0 && (
        <div className="kpi-tooltip pointer-events-none absolute left-0 top-full mt-1.5 z-50 hidden group-hover:block w-72 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-2xl p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{affectedLabel}</p>
          <ul className="space-y-1.5">
            {shown.map(h => (
              <li key={h.moid} className="flex items-center justify-between gap-3 text-xs">
                <span className="font-mono text-slate-700 dark:text-slate-200 truncate">{h.server_profile}</span>
                <StatusDot status={h.status} />
              </li>
            ))}
          </ul>
          {affectedHosts.length > shown.length && (
            <p className="text-[11px] text-slate-500 mt-2">+{affectedHosts.length - shown.length} more — see the Alarms tab</p>
          )}
        </div>
      )}
    </div>
  );
}

function FleetKpis({ hosts }) {
  const total         = hosts.length;
  const healthy       = hosts.filter(h => h.status?.label === 'Healthy').length;
  const criticalHosts = hosts.filter(h => h.status?.tone === 'red');
  const warningHosts  = hosts.filter(h => h.status?.tone === 'amber');
  const critical = criticalHosts.length;
  const warning  = warningHosts.length;
  const domains  = new Set(hosts.map(h => h.domain).filter(d => d && d !== '—')).size;
  const pct = n => (total ? (n / total) * 100 : 0);
  const fmtPct = n => `${pct(n).toFixed(1)}%`;
  const healthyPct = pct(healthy);
  // Health ring geometry: r=30 → circumference ≈ 188.5
  const CIRC = 2 * Math.PI * 30;
  const ringTone = healthyPct >= 97 ? 'stroke-emerald-500' : healthyPct >= 90 ? 'stroke-amber-500' : 'stroke-red-500';

  return (
    // relative z-20 lifts the row's stacking context above the cards below it,
    // so the hover tooltips aren't painted behind them (ai-surface's
    // backdrop-filter and ai-fade-in's transform both create stacking contexts).
    <div className="relative z-20 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-5 ai-fade-in">
      <KpiCard
        icon={Server} label="Total Servers" value={total}
        sub={domains ? `${domains} domain${domains === 1 ? '' : 's'}` : 'All Domains'}
        tile="bg-gradient-to-br from-violet-500 to-indigo-500"
      />
      <KpiCard
        icon={CheckCircle2} label="Healthy" value={healthy} sub={fmtPct(healthy)}
        tile="bg-gradient-to-br from-emerald-500 to-teal-500"
        pct={pct(healthy)} barCls="bg-emerald-500"
      />
      <KpiCard
        icon={AlertTriangle} label="Warning" value={warning} sub={fmtPct(warning)}
        tile="bg-gradient-to-br from-amber-500 to-orange-500"
        pct={pct(warning)} barCls="bg-amber-500"
        affectedHosts={warningHosts}
      />
      <KpiCard
        icon={XCircle} label="Critical" value={critical} sub={fmtPct(critical)}
        tile="bg-gradient-to-br from-red-500 to-rose-500"
        pct={pct(critical)} barCls="bg-red-500"
        affectedHosts={criticalHosts}
      />
      <div className="ai-surface rounded-2xl p-4 flex items-center gap-4 col-span-2 md:col-span-1">
        <div className="relative h-[72px] w-[72px] flex-shrink-0">
          <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
            <circle cx="36" cy="36" r="30" fill="none" strokeWidth="6"
              className="stroke-slate-200/80 dark:stroke-white/[0.08]" />
            <circle cx="36" cy="36" r="30" fill="none" strokeWidth="6" strokeLinecap="round"
              className={`${ringTone} transition-all duration-700`}
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - healthyPct / 100)} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
              {total ? `${healthyPct.toFixed(1).replace(/\.0$/, '')}%` : '—'}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Overall Health</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
            {healthyPct >= 97 ? 'Healthy' : healthyPct >= 90 ? 'Degraded' : 'At Risk'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{healthy} of {total} servers</p>
        </div>
      </div>
    </div>
  );
}

/* --------------------- AI fleet summary banner ("Powered by Claude") --------------------- */

function AiFleetSummary({ hosts, alarmHosts, history, onAskClaude }) {
  const domains = new Set(hosts.map(h => h.domain).filter(d => d && d !== '—')).size;

  // Most affected cluster/domain among the currently alarming hosts.
  const mostAffected = useMemo(() => {
    const counts = new Map();
    for (const h of alarmHosts) {
      const key = h.cluster || h.domain;
      if (key && key !== '—') counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }, [alarmHosts]);

  // Claude's most recent verdict, newest first, for the insights column.
  const latest = useMemo(() => history
    .filter(h => h.analyzed && h.root_cause)
    .sort((a, b) => (b.analyzed_at || '').localeCompare(a.analyzed_at || ''))[0],
  [history]);

  return (
    <div className="ai-surface rounded-2xl p-5 mb-6 ai-fade-in border border-violet-500/20">
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-5">
        {/* Fleet facts */}
        <div className="lg:w-[34%] min-w-0">
          <div className="flex items-center gap-2 mb-3.5">
            <span className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Fleet Summary</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300">
              Powered by Claude
            </span>
          </div>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              {hosts.length} servers monitored across {domains} domain{domains === 1 ? '' : 's'}
            </li>
            <li className="flex items-center gap-2">
              <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${alarmHosts.length ? 'text-amber-500' : 'text-slate-400'}`} />
              {alarmHosts.length
                ? `${alarmHosts.length} server${alarmHosts.length === 1 ? ' has' : 's have'} active alarms`
                : 'No servers with active alarms'}
            </li>
            {mostAffected && (
              <li className="flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span>
                  Most affected:{' '}
                  <span className="font-semibold text-violet-600 dark:text-violet-300">{mostAffected}</span>
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Recent AI insights */}
        <div className="flex-1 min-w-0 lg:border-l lg:pl-5 border-slate-200/60 dark:border-white/[0.06]">
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white mb-3">
            <Sparkles className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400" />
            Recent AI Insights
          </h4>
          {latest ? (
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-3">
              <span className="font-mono font-semibold">{latest.host}</span>
              {' '}({relTime(latest.analyzed_at)}): {latest.root_cause}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              No analyses yet. Collect logs for a server, FI, or chassis and let Claude find the root cause.
            </p>
          )}
        </div>

        {/* Ask Claude */}
        <div className="flex lg:flex-col items-center justify-center gap-3 lg:pl-2">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-500/25">
            <ClaudeSpark className="h-8 w-8" />
          </div>
          <button
            onClick={onAskClaude}
            title="Pick a host for Claude to analyze"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-[0_2px_12px_rgba(124,58,237,0.35)] transition-all"
          >
            <ClaudeSpark className="h-3.5 w-3.5" color="#ffffff" />
            Ask Claude
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- FI / Chassis equipment sections -------------------- */

const EQUIP_META = {
  fi:      { icon: Network, singular: 'Fabric Interconnect', plural: 'Fabric Interconnects' },
  chassis: { icon: Boxes,   singular: 'Chassis',             plural: 'Chassis' },
};

const ALARM_CHIP = {
  Critical: 'bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-300',
  Major:    'bg-orange-500/10 border-orange-500/25 text-orange-600 dark:text-orange-300',
  Warning:  'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-300',
  Info:     'bg-slate-500/10 border-slate-500/25 text-slate-600 dark:text-slate-300',
};

const EQ_TAC_TERMINAL = ['Completed', 'Failed', 'CollectionFailed', 'TimedOut', 'PartiallyCompleted'];

function equipmentStatus(d) {
  const c = d.alarm_counts || {};
  // Chassis connection_status lists the connected fabric paths (e.g. "A,B");
  // an empty string means no path to either FI.
  if (d.connection_status === '') return { label: 'Offline', tone: 'red' };
  if (c.Critical > 0) return { label: 'Critical', tone: 'red' };
  if (c.Major > 0 || c.Warning > 0) return { label: 'Degraded', tone: 'amber' };
  const oper = (d.oper_state || '').toLowerCase();
  if (oper && !['ok', 'operable', 'operational'].includes(oper)) return { label: 'Degraded', tone: 'amber' };
  return { label: 'Healthy', tone: 'green' };
}

/* KPI row for the FI/Chassis pages — the equipment counterpart of FleetKpis. */
function EquipmentKpis({ kind, items }) {
  const meta = EQUIP_META[kind];
  const devices = (items || []).map(d => ({
    moid: d.moid,
    server_profile: d.display_name || d.name,
    domain_name: d.domain_name,
    status: equipmentStatus(d),
  }));
  const total    = devices.length;
  const healthy  = devices.filter(d => d.status.label === 'Healthy').length;
  const critical = devices.filter(d => d.status.tone === 'red');
  const warning  = devices.filter(d => d.status.tone === 'amber');
  const domains  = new Set(devices.map(d => d.domain_name).filter(Boolean)).size;
  const pct = n => (total ? (n / total) * 100 : 0);
  const fmtPct = n => `${pct(n).toFixed(1)}%`;
  const healthyPct = pct(healthy);
  const CIRC = 2 * Math.PI * 30;
  const ringTone = healthyPct >= 97 ? 'stroke-emerald-500' : healthyPct >= 90 ? 'stroke-amber-500' : 'stroke-red-500';

  return (
    // relative z-20: see FleetKpis — keeps hover tooltips above the cards below.
    <div className="relative z-20 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6 ai-fade-in">
      <KpiCard
        icon={meta.icon} label={`Total ${meta.plural}`} value={total}
        sub={domains ? `${domains} domain${domains === 1 ? '' : 's'}` : undefined}
        tile="bg-gradient-to-br from-violet-500 to-indigo-500"
      />
      <KpiCard
        icon={CheckCircle2} label="Healthy" value={healthy} sub={fmtPct(healthy)}
        tile="bg-gradient-to-br from-emerald-500 to-teal-500"
        pct={pct(healthy)} barCls="bg-emerald-500"
      />
      <KpiCard
        icon={AlertTriangle} label="Warning" value={warning.length} sub={fmtPct(warning.length)}
        tile="bg-gradient-to-br from-amber-500 to-orange-500"
        pct={pct(warning.length)} barCls="bg-amber-500"
        affectedHosts={warning} affectedLabel={`Affected ${meta.plural.toLowerCase()}`}
      />
      <KpiCard
        icon={XCircle} label="Critical" value={critical.length} sub={fmtPct(critical.length)}
        tile="bg-gradient-to-br from-red-500 to-rose-500"
        pct={pct(critical.length)} barCls="bg-red-500"
        affectedHosts={critical} affectedLabel={`Affected ${meta.plural.toLowerCase()}`}
      />
      <div className="ai-surface rounded-2xl p-4 flex items-center gap-4 col-span-2 md:col-span-1">
        <div className="relative h-[72px] w-[72px] flex-shrink-0">
          <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
            <circle cx="36" cy="36" r="30" fill="none" strokeWidth="6"
              className="stroke-slate-200/80 dark:stroke-white/[0.08]" />
            <circle cx="36" cy="36" r="30" fill="none" strokeWidth="6" strokeLinecap="round"
              className={`${ringTone} transition-all duration-700`}
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - healthyPct / 100)} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
              {total ? `${healthyPct.toFixed(1).replace(/\.0$/, '')}%` : '—'}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Overall Health</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
            {healthyPct >= 97 ? 'Healthy' : healthyPct >= 90 ? 'Degraded' : 'At Risk'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{healthy} of {total} {meta.plural.toLowerCase()}</p>
        </div>
      </div>
    </div>
  );
}

function EquipmentSection({ kind, items, loading, error, onReload, onOpenDevice, onAnalyzed }) {
  const meta = EQUIP_META[kind];
  const [query, setQuery]               = useState('');
  const [hours, setHours]               = useState('24');
  const [collecting, setCollecting]     = useState(null); // moid
  const [collectError, setCollectError] = useState(null);
  const [bundle, setBundle]             = useState(null);
  const [context, setContext]           = useState('');
  const [analyzing, setAnalyzing]       = useState(false);
  const [analysis, setAnalysis]         = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [tac, setTac]                   = useState(null);
  const resultsRef = useRef(null);

  // Poll the TAC bundle status every 10s until it reaches a terminal state.
  useEffect(() => {
    if (!tac?.statusMoid || EQ_TAC_TERMINAL.includes(tac.status)) return;
    const timer = setInterval(async () => {
      try {
        const res = await mockFetch(`${API_BASE}/api/diagnostics/techsupport/${tac.statusMoid}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const st = await res.json();
        setTac(t => t && t.statusMoid === tac.statusMoid
          ? { ...t, status: st.status, fileName: st.file_name, fileSize: st.file_size, reason: st.reason }
          : t);
      } catch (err) {
        setTac(t => t ? { ...t, error: err.message } : t);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [tac?.statusMoid, tac?.status]);

  async function handleGenerateTac() {
    if (!bundle) return;
    setTac({ creating: true });
    try {
      const res = await mockFetch(`${API_BASE}/api/diagnostics/equipment/techsupport`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ kind, moid: bundle.moid }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const created = await res.json();
      setTac({ statusMoid: created.status_moid, status: 'Pending', serial: created.serial });
    } catch (err) {
      setTac({ error: err.message });
    }
  }

  const devices = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (items || []).map(d => ({ ...d, status: equipmentStatus(d) }));
    if (!q) return list;
    return list.filter(d =>
      (d.display_name || d.name || '').toLowerCase().includes(q) ||
      (d.model || '').toLowerCase().includes(q) ||
      (d.serial || '').toLowerCase().includes(q) ||
      (d.domain_name || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  async function collectFor(device) {
    setCollecting(device.moid);
    setCollectError(null);
    setBundle(null);
    setAnalysis(null);
    setAnalysisError(null);
    setTac(null);
    try {
      const res = await mockFetch(`${API_BASE}/api/diagnostics/equipment/collect`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ kind, moid: device.moid, hours: parseInt(hours, 10) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setBundle(result);
      // Resume/reuse a bundle already generated for this device in Intersight.
      const recent = (result.tac_bundles || [])[0];
      if (recent?.status_moid) {
        setTac({
          statusMoid: recent.status_moid,
          status: recent.status || 'Pending',
          fileName: recent.file_name,
          fileSize: recent.file_size,
          created: recent.created,
          existing: true,
        });
      }
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setCollectError(err.message);
    } finally {
      setCollecting(null);
    }
  }

  async function handleAnalyze() {
    if (!bundle) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    try {
      const res = await mockFetch(`${API_BASE}/api/diagnostics/equipment/analyze`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          bundle,
          // Include the TAC bundle contents when one has finished collecting
          tac_status_moid: tac?.status === 'Completed' ? tac.statusMoid : null,
          context: context.trim() || null,
          history_id: bundle.history_id || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setAnalysis(result);
      onAnalyzed?.(result);
    } catch (err) {
      setAnalysisError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading && !items) return <LoadingState label={`Loading ${meta.plural.toLowerCase()}…`} />;
  if (error && !items) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error} />
        <Button size="sm" icon={RefreshCw} onClick={onReload}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="ai-fade-in space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          className="flex-1"
          value={query}
          onChange={setQuery}
          placeholder={`Search by name, model, serial, or domain…`}
        />
        <div className="flex items-center gap-2">
          <Select value={hours} onChange={setHours}>
            {TIME_RANGES.filter(r => r.value !== 'custom').map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
          <Button size="sm" icon={RefreshCw} loading={loading} onClick={onReload}>Refresh</Button>
        </div>
      </div>

      {collectError && <ErrorBanner message={collectError} />}

      {/* Device grid */}
      {devices.length === 0 ? (
        <div className="ai-surface rounded-2xl">
          <EmptyState
            icon={meta.icon}
            title={query ? `No ${meta.plural.toLowerCase()} match your search` : `No ${meta.plural.toLowerCase()} found`}
            hint={query ? 'Try clearing the search.' : 'Nothing reported by Intersight.'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map(d => {
            const alarms = d.alarms || [];
            const counts = d.alarm_counts || {};
            return (
              <div
                key={d.moid}
                className="ai-surface rounded-2xl p-5 flex flex-col gap-3 transition-all duration-150 hover:border-violet-500/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.12)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                      <meta.icon className="h-4 w-4 text-violet-500 dark:text-violet-400 flex-shrink-0" />
                      <button
                        onClick={() => onOpenDevice?.(d, kind)}
                        className="truncate text-left hover:text-violet-500 dark:hover:text-violet-400 hover:underline underline-offset-2"
                        title="View details and alerts"
                      >
                        {d.display_name || d.name}
                      </button>
                    </h3>
                    <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">
                      {d.model || '—'}{d.serial ? ` · ${d.serial}` : ''}
                    </p>
                  </div>
                  <StatusDot status={d.status} />
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {d.domain_name && (
                    <span className="px-2 py-0.5 rounded-md border border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300 font-medium">
                      {d.domain_name}
                    </span>
                  )}
                  {kind === 'chassis' && d.total_slots != null && (
                    <span className="text-slate-500">{d.used_slots}/{d.total_slots} slots</span>
                  )}
                  {kind === 'fi' && d.out_of_band_ip_address && (
                    <span className="font-mono text-slate-500">{d.out_of_band_ip_address}</span>
                  )}
                </div>

                {/* Active alarms */}
                {alarms.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {['Critical', 'Major', 'Warning', 'Info'].filter(s => counts[s] > 0).map(s => (
                        <span key={s} className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${ALARM_CHIP[s]}`}>
                          {counts[s]} {s}
                        </span>
                      ))}
                    </div>
                    {alarms.slice(0, 3).map((a, i) => (
                      <p key={i} className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2" title={a.description}>
                        <span className="text-[10px] font-semibold text-slate-500 mr-1">{a.affected_mo || a.code}</span>
                        {a.description}
                      </p>
                    ))}
                    {alarms.length > 3 && (
                      <p className="text-[11px] text-slate-500">+{alarms.length - 3} more — collect to see all</p>
                    )}
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    No active alarms
                  </p>
                )}

                <div className="mt-auto pt-1">
                  <button
                    onClick={() => collectFor(d)}
                    disabled={!!collecting}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors text-xs font-medium disabled:opacity-50 bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/30"
                    title="Pull the Intersight alarm history for this device"
                  >
                    {collecting === d.moid
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : <ScrollText className="h-3.5 w-3.5" />}
                    {collecting === d.moid ? 'Collecting…' : 'Collect Alarms'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Collected bundle + analysis */}
      {bundle && (
        <div ref={resultsRef} className="ai-surface rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <meta.icon className="h-4 w-4 text-violet-500 dark:text-violet-400" />
              {bundle.host}
            </h3>
            <span className="text-xs text-slate-500">
              {fmtLocal(bundle.window_start)} → {fmtLocal(bundle.window_end)}
            </span>
            <span className="text-xs text-slate-500">{(bundle.faults || []).length} alarms in window</span>
            <button
              onClick={() => { setBundle(null); setAnalysis(null); setAnalysisError(null); setTac(null); }}
              className="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-500/10 transition-colors"
              title="Close results"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {(bundle.faults || []).length > 0 ? (
            <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-xl border border-slate-200/60 dark:border-white/[0.06]">
              <table className="w-full">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200/60 dark:border-white/[0.06]">
                    <th className="text-left py-2.5 px-3 font-medium whitespace-nowrap">Time</th>
                    <th className="text-left py-2.5 px-3 font-medium">Severity</th>
                    <th className="text-left py-2.5 px-3 font-medium">Code</th>
                    <th className="text-left py-2.5 px-3 font-medium">Component</th>
                    <th className="text-left py-2.5 px-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
                  {bundle.faults.map((f, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 text-xs font-mono text-slate-500 whitespace-nowrap">{fmtLocal(f.created)}</td>
                      <td className="py-2 px-3"><SeverityBadge severity={f.severity} /></td>
                      <td className="py-2 px-3 text-xs font-mono text-slate-500">{f.code || '—'}</td>
                      <td className="py-2 px-3 text-xs text-slate-600 dark:text-slate-300">{f.affected_mo || '—'}</td>
                      <td className="py-2 px-3 text-sm text-slate-700 dark:text-slate-200">{f.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              No alarms transitioned in this window — the device looks quiet.
            </p>
          )}

          {/* TAC tech-support bundle */}
          <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.06] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Package className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">TAC Log Bundle</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Generate the diagnostic bundle Cisco TAC uses — collection runs on the device via Intersight (~5–15 min)
                  </p>
                </div>
              </div>
              {(!tac || (tac.existing && EQ_TAC_TERMINAL.includes(tac.status))) && (
                <button
                  onClick={handleGenerateTac}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                >
                  <Package className="h-3.5 w-3.5" />
                  {tac?.existing ? 'Generate New Bundle' : 'Generate TAC Bundle'}
                </button>
              )}
            </div>

            {tac?.existing && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Found an existing bundle in Intersight from {fmtLocal(tac.created)} — no need to regenerate it.
              </p>
            )}
            {tac?.creating && (
              <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Requesting bundle from Intersight…
              </p>
            )}
            {tac?.error && (
              <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10">
                <p className="text-xs text-red-500 dark:text-red-400 font-medium">TAC bundle error: {tac.error}</p>
              </div>
            )}
            {tac?.statusMoid && !EQ_TAC_TERMINAL.includes(tac.status) && (
              <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-500 dark:text-emerald-400" />
                Collecting on the device — status: <span className="font-semibold text-emerald-600 dark:text-emerald-300">{tac.status}</span>.
                This page checks every 10 seconds; you can keep working meanwhile.
              </p>
            )}
            {tac?.status === 'Completed' && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 border border-emerald-500/30 bg-emerald-500/10">
                <p className="text-xs text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5" />
                  Bundle ready: <span className="font-mono">{tac.fileName}</span>
                  {tac.fileSize ? ` (${(tac.fileSize / (1024 * 1024)).toFixed(1)} MB)` : ''}
                </p>
                <a
                  href={mockDownloadHref()}
                  download={tac.fileName || 'techsupport-bundle.txt'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </div>
            )}
            {tac?.status && EQ_TAC_TERMINAL.includes(tac.status) && tac.status !== 'Completed' && (
              <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10">
                <p className="text-xs text-red-500 dark:text-red-400 font-medium">
                  Bundle collection ended with status {tac.status}{tac.reason ? ` — ${tac.reason}` : ''}.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              rows={2}
              placeholder="Optional: describe the incident you're investigating (helps Claude focus the analysis)…"
              className="w-full rounded-xl bg-white/70 dark:bg-black/20 border border-slate-300/70 dark:border-white/10 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 resize-y"
            />
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 shadow-[0_2px_12px_rgba(124,58,237,0.35)] transition-all"
            >
              {analyzing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ClaudeSpark className="h-3.5 w-3.5" color="#ffffff" />}
              {analyzing ? 'Analyzing…' : 'Analyze with Claude'}
            </button>
          </div>

          {analysisError && (
            <div className="rounded-xl p-4 border border-red-500/30 bg-red-500/10">
              <p className="text-sm text-red-500 dark:text-red-400 font-medium">Analysis error: {analysisError}</p>
            </div>
          )}

          {analysis && (
            <AnalysisReport
              analysis={analysis}
              host={bundle.host}
              windowStart={fmtLocal(bundle.window_start)}
              windowEnd={fmtLocal(bundle.window_end)}
              sources={bundle.sources}
              model={bundle.device?.model}
              faultCount={bundle.faults?.length}
              usage={analysis.usage}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* Equipment "Alarms" sub-tab — every FI/chassis with active alarms, with the
   exact alarm text inline (mirrors the servers AlarmsSection). */
function EquipmentAlarmsSection({ kind, items, loading, error, onReload, onOpenDevice }) {
  const meta = EQUIP_META[kind];

  if (loading && !items) return <LoadingState label={`Loading ${meta.plural.toLowerCase()}…`} />;
  if (error && !items) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error} />
        <Button size="sm" icon={RefreshCw} onClick={onReload}>Retry</Button>
      </div>
    );
  }

  const alarming = (items || [])
    .map(d => ({ ...d, status: equipmentStatus(d) }))
    .filter(d => (d.alarms || []).length > 0)
    .sort((a, b) =>
      ((b.alarm_counts?.Critical || 0) - (a.alarm_counts?.Critical || 0)) ||
      ((b.alarms?.length || 0) - (a.alarms?.length || 0)));

  if (alarming.length === 0) {
    return (
      <div className="ai-surface rounded-xl p-10 text-center ai-fade-in">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-500 dark:text-emerald-400" />
        <p className="text-sm font-medium text-slate-900 dark:text-white">All {meta.plural.toLowerCase()} healthy</p>
        <p className="text-xs text-slate-500 mt-1">No active Intersight alarms right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 ai-fade-in">
      {alarming.map(d => {
        const red = d.status.tone === 'red';
        const counts = d.alarm_counts || {};
        return (
          <div
            key={d.moid}
            className={`ai-surface rounded-xl border overflow-hidden ${red ? 'border-red-500/30' : 'border-amber-500/30'}`}
          >
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-200/60 dark:border-white/[0.06]">
              <StatusDot status={d.status} />
              <button
                onClick={() => onOpenDevice?.(d, kind)}
                className="flex items-center gap-1.5 font-mono text-sm font-semibold text-slate-900 dark:text-white hover:text-violet-500 dark:hover:text-violet-400 hover:underline underline-offset-2"
                title="View details and alerts"
              >
                <meta.icon className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400" />
                {d.display_name || d.name}
              </button>
              {d.domain_name && <span className="text-xs text-slate-500">{d.domain_name}</span>}
              {d.model && <span className="text-xs font-mono text-slate-500">{d.model}</span>}
              <span className="ml-auto flex flex-wrap gap-1.5">
                {['Critical', 'Major', 'Warning', 'Info'].filter(s => counts[s] > 0).map(s => (
                  <span key={s} className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${ALARM_CHIP[s]}`}>
                    {counts[s]} {s}
                  </span>
                ))}
              </span>
            </div>
            <div className="px-4 py-3 space-y-2">
              {(d.alarms || []).map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${a.severity === 'Warning' || a.severity === 'Info' ? 'bg-amber-400' : 'bg-red-400'}`} />
                  <p className="text-slate-700 dark:text-slate-200 break-words">
                    <span className="text-[11px] font-semibold text-slate-500 mr-1.5">
                      {a.severity}{a.affected_mo ? ` · ${a.affected_mo}` : ''}
                    </span>
                    {a.description}
                    {a.created && <span className="text-xs text-slate-500"> · {relTime(a.created)}</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* "Ask Claude" host picker — affected hosts first, then the rest of the fleet. */
function AskClaudeModal({ alarmHosts, hosts, onClose, onPick }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const match = h => !q ||
    h.server_profile?.toLowerCase().includes(q) ||
    h.cluster?.toLowerCase().includes(q) ||
    h.vcenter?.toLowerCase().includes(q);

  const alarmMoids = new Set(alarmHosts.map(h => h.moid));
  const affected = alarmHosts.filter(match);
  const rest = hosts
    .filter(h => !alarmMoids.has(h.moid))
    .filter(match)
    .sort((a, b) => (a.server_profile || '').localeCompare(b.server_profile || ''));

  const Row = ({ h }) => (
    <button
      onClick={() => onPick(h)}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-violet-500/10 transition-colors"
    >
      <StatusDot status={h.status} />
      <span className="font-mono text-sm text-slate-800 dark:text-slate-200 truncate">{h.server_profile}</span>
      {h.cluster && (
        <span className={`text-xs truncate ${dcTextClass(h.cluster) || 'text-slate-500'}`}>{h.cluster}</span>
      )}
      <ChevronRight className="h-4 w-4 text-slate-400 ml-auto flex-shrink-0" />
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg ai-surface rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 pb-3 flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-500/25">
            <ClaudeSpark className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ask Claude</h2>
            <p className="text-xs text-slate-500">Pick a host — Claude collects its logs and finds the root cause.</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 pb-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Search by name, cluster, or vCenter…" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {affected.length > 0 && (
            <>
              <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-500 dark:text-red-400">
                Affected hosts ({affected.length})
              </p>
              {affected.map(h => <Row key={h.moid} h={h} />)}
            </>
          )}
          <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            All servers ({rest.length})
          </p>
          {rest.map(h => <Row key={h.moid} h={h} />)}
          {affected.length === 0 && rest.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-500">No hosts match your search.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const LOG_TABS = [
  { key: 'sel',    label: 'Intersight SEL',    icon: ScrollText,    source: 'intersight' },
  { key: 'faults', label: 'Intersight Faults', icon: AlertTriangle, source: 'intersight' },
  { key: 'events', label: 'vCenter Events',    icon: Activity,      source: 'vcenter' },
  { key: 'logs',   label: 'Host Logs',         icon: FileText,      source: 'vcenter' },
];

export default function HostDiagnosticsPage() {
  const [data, setData]             = useState(null);
  const [vcHosts, setVcHosts]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDcTab, setActiveDcTab] = useState('ALL');
  // section = which entity page (servers | fi | chassis);
  // view = which sub-tab inside it (list | alarms | reports | usage)
  const [section, setSection]       = useState('servers');
  const [view, setView]             = useState('list');
  const location = useLocation();
  const navigate = useNavigate();

  // Servers view controls
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('diagViewMode') || 'grid');
  const [domainFilter, setDomainFilter] = useState('all');
  const [vcFilter, setVcFilter]         = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy]             = useState('name');
  const [page, setPage]                 = useState(1);
  const [perPage, setPerPage]           = useState(24);
  const [reportQuery, setReportQuery]   = useState('');
  const [reportFilter, setReportFilter] = useState('all');
  const [reportSort, setReportSort]     = useState('newest');
  const [showMeterInfo, setShowMeterInfo] = useState(true);

  useEffect(() => { localStorage.setItem('diagViewMode', viewMode); }, [viewMode]);

  // Deep links: ?q=<host>&dc=<SITE1|SITE2> from the global search bar, and
  // ?section=servers|usage|reports from the sidebar sub-items.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    const dc = params.get('dc');
    const s = params.get('section');
    if (q) setSearchQuery(q);
    if (dc === 'SITE1' || dc === 'SITE2') setActiveDcTab(dc);
    const v = params.get('view');
    if (s === 'servers' || s === 'fi' || s === 'chassis') {
      setSection(s);
      setView(['list', 'alarms', 'reports'].includes(v) ? v : 'list');
    } else if (s === 'usage') {
      // Global Claude API usage — its own sidebar entry, not per entity.
      // Reset the view so no entity sub-section renders alongside it.
      setSection('usage');
      setView('list');
    } else if (s === 'alarms' || s === 'reports') {
      // Legacy deep links from before the per-entity sub-tabs
      setSection('servers');
      setView(s);
    } else if (q) {
      setSection('servers');
      setView('list');
    }
  }, [location.search]);

  const [range, setRange]         = useState('24');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');

  // Which host+sources combination is currently collecting, e.g. { host, sources }
  const [collecting, setCollecting]     = useState(null);
  const [collectError, setCollectError] = useState(null);
  const [bundle, setBundle]             = useState(null);
  const [activeLogTab, setActiveLogTab] = useState('sel');

  const [analyzing, setAnalyzing]         = useState(false);
  const [analysisContext, setAnalysisContext] = useState('');
  const [usage, setUsage]                 = useState(null);
  const [history, setHistory]             = useState([]);
  const [historyLoading, setHistoryLoading] = useState(null);
  const [historyModal, setHistoryModal]   = useState(null); // full record shown in popup
  const [analysisError, setAnalysisError] = useState(null);
  const [analysis, setAnalysis]           = useState(null);

  // CIMC credentials — held in memory for this session only, never persisted.
  const [cimcUser, setCimcUser]         = useState('admin');
  const [cimcPassword, setCimcPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Pending collection awaiting confirmation in the modal: { host } + source picker
  const [pendingCollect, setPendingCollect] = useState(null);
  const [pendingSources, setPendingSources] = useState(['intersight', 'vcenter']);

  // TAC tech-support bundle state: { statusMoid, status, fileName, fileSize, reason, error, creating }
  const [tac, setTac] = useState(null);

  const resultsRef = useRef(null);

  const TAC_TERMINAL = ['Completed', 'Failed', 'CollectionFailed', 'TimedOut', 'PartiallyCompleted'];

  // Poll the bundle status every 10s until it reaches a terminal state.
  useEffect(() => {
    if (!tac?.statusMoid || TAC_TERMINAL.includes(tac.status)) return;
    const timer = setInterval(async () => {
      try {
        const res = await mockFetch(`${API_BASE}/api/diagnostics/techsupport/${tac.statusMoid}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const st = await res.json();
        setTac(t => t && t.statusMoid === tac.statusMoid
          ? { ...t, status: st.status, fileName: st.file_name, fileSize: st.file_size, reason: st.reason, downloadReady: st.download_ready }
          : t);
      } catch (err) {
        setTac(t => t ? { ...t, error: err.message } : t);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [tac?.statusMoid, tac?.status]);

  async function handleGenerateTac() {
    if (!bundle) return;
    setTac({ creating: true });
    try {
      const res = await mockFetch(`${API_BASE}/api/diagnostics/techsupport`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ host: bundle.host }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const created = await res.json();
      setTac({ statusMoid: created.status_moid, status: 'Pending', serial: created.serial });
    } catch (err) {
      setTac({ error: err.message });
    }
  }

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [result, vcRes] = await Promise.all([
        fetchCimcHosts(),
        mockFetch(`${API_BASE}/api/vmware/esxi-host-list`).then(r => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      setData(result);
      setVcHosts(vcRes?.hosts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(() => {
    mockFetch(`${API_BASE}/api/diagnostics/history`)
      .then(r => (r.ok ? r.json() : []))
      .then(h => Array.isArray(h) && setHistory(h))
      .catch(() => {});
  }, []);

  const loadUsage = useCallback(() => {
    mockFetch(`${API_BASE}/api/diagnostics/usage`)
      .then(r => (r.ok ? r.json() : null))
      .then(u => u && setUsage(u))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
    loadHistory();
    loadUsage();
  }, [loadData, loadHistory, loadUsage]);

  // FI / Chassis inventory + active alarms — loaded lazily the first time one
  // of the equipment tabs opens (it costs a live Intersight alarm query).
  const [equipment, setEquipment]       = useState(null);
  const [equipLoading, setEquipLoading] = useState(false);
  const [equipError, setEquipError]     = useState(null);

  const loadEquipment = useCallback(async () => {
    setEquipLoading(true);
    setEquipError(null);
    try {
      const res = await mockFetch(`${API_BASE}/api/diagnostics/equipment`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      setEquipment(await res.json());
    } catch (err) {
      setEquipError(err.message);
    } finally {
      setEquipLoading(false);
    }
  }, []);

  useEffect(() => {
    if ((section === 'fi' || section === 'chassis') && !equipment && !equipLoading && !equipError) {
      loadEquipment();
    }
  }, [section, equipment, equipLoading, equipError, loadEquipment]);

  // Re-fetch when the usage/reports sections open so their dashboards always
  // reflect the latest records, even if the initial load raced or went stale.
  useEffect(() => {
    if (section === 'usage' || view === 'reports') {
      loadHistory();
      if (section === 'usage') loadUsage();
    }
  }, [section, view, loadHistory, loadUsage]);

  function refreshAll() {
    setLoading(true);
    loadData();
    loadHistory();
    loadUsage();
    if (equipment || equipError) loadEquipment();
  }

  async function openHistorySummary(id) {
    setHistoryLoading(id);
    try {
      const res = await mockFetch(`${API_BASE}/api/diagnostics/history/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHistoryModal(await res.json());
    } catch (err) {
      setCollectError(`Could not load history record: ${err.message}`);
    } finally {
      setHistoryLoading(null);
    }
  }

  async function deleteHistoryRecord(id) {
    try {
      const res = await mockFetch(`${API_BASE}/api/diagnostics/history/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      setHistory(h => h.filter(r => r.id !== id));
      if (historyModal?.id === id) setHistoryModal(null);
    } catch (err) {
      setCollectError(`Could not delete history record: ${err.message}`);
    }
  }

  async function openHistoryRecord(id) {
    setHistoryLoading(id);
    try {
      const res = await mockFetch(`${API_BASE}/api/diagnostics/history/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const record = await res.json();
      setHistoryModal(null);
      setSection('servers');
      setView('list');
      const b = { ...record.bundle, history_id: record.id };
      setCollectError(null);
      setAnalysisError(null);
      setBundle(b);
      setAnalysis(record.analysis || null);
      const firstTab = LOG_TABS.find(t => (b.sources || []).includes(t.source));
      setActiveLogTab(firstTab ? firstTab.key : 'sel');
      const recent = (b.tac_bundles || [])[0];
      setTac(recent?.status_moid ? {
        statusMoid: recent.status_moid,
        status: recent.status || 'Pending',
        fileName: recent.file_name,
        fileSize: recent.file_size,
        created: recent.created,
        existing: true,
      } : null);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setCollectError(`Could not load history record: ${err.message}`);
    } finally {
      setHistoryLoading(null);
    }
  }

  // Match vCenter host records to Intersight blades by short hostname.
  const vcByShort = useMemo(() => {
    const m = new Map();
    for (const h of vcHosts) m.set((h.host_name || '').split('.')[0].toLowerCase(), h);
    return m;
  }, [vcHosts]);

  const hosts = useMemo(() => {
    const intersight = (data?.hosts || []).map(h => {
      const vc = vcByShort.get((h.server_profile || '').toLowerCase());
      return {
        ...h,
        vcenter: vc?.vcenter ? vc.vcenter.split('.')[0] : null,
        cluster: vc?.cluster || null,
        // Blades in the list are powered on per Intersight; prefer live ESXi state.
        status: vcStatus(vc) || { label: 'Healthy', tone: 'green' },
      };
    });
    // Hosts that live only in vCenter (no Intersight blade) still support
    // vCenter/syslog collection — list them alongside the blades.
    const known = new Set(intersight.map(h => (h.server_profile || '').toLowerCase()));
    const vcOnly = vcHosts
      .filter(h => !known.has((h.host_name || '').split('.')[0].toLowerCase()))
      .map(h => ({
        moid: `vc-${h.host_name}`,
        datacenter: h.datacenter,
        domain: '—',
        server_profile: (h.host_name || '').split('.')[0],
        blade_name: null,
        mgmt_ip: null,
        vcenter_only: true,
        vcenter: h.vcenter ? h.vcenter.split('.')[0] : null,
        cluster: h.cluster || null,
        status: vcStatus(h) || { label: 'Unknown', tone: 'slate' },
      }));
    return [...intersight, ...vcOnly];
  }, [data, vcHosts, vcByShort]);

  const counts = useMemo(() => {
    const c = { ALL: hosts.length, SITE1: 0, SITE2: 0 };
    for (const h of hosts) {
      if (c[h.datacenter] !== undefined) c[h.datacenter] += 1;
    }
    return c;
  }, [hosts]);

  const domainOptions  = useMemo(() => [...new Set(hosts.map(h => h.domain).filter(d => d && d !== '—'))].sort(), [hosts]);
  const vcenterOptions = useMemo(() => [...new Set(hosts.map(h => h.vcenter).filter(Boolean))].sort(), [hosts]);
  const statusOptions  = useMemo(() => [...new Set(hosts.map(h => h.status?.label).filter(Boolean))].sort(), [hosts]);

  // Non-healthy hosts for the Alarms section, most severe first.
  const alarmHosts = useMemo(() => hosts
    .filter(h => h.status && !['Healthy', 'Unknown'].includes(h.status.label))
    .sort((a, b) => (ALARM_SEV_ORDER[a.status.label] ?? 9) - (ALARM_SEV_ORDER[b.status.label] ?? 9)),
  [hosts]);

  const filteredHosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return hosts.filter((h) => {
      if (activeDcTab !== 'ALL' && h.datacenter !== activeDcTab) return false;
      if (domainFilter !== 'all' && h.domain !== domainFilter) return false;
      if (vcFilter !== 'all' && h.vcenter !== vcFilter) return false;
      if (statusFilter !== 'all' && h.status?.label !== statusFilter) return false;
      if (!q) return true;
      return (
        h.blade_name?.toLowerCase().includes(q) ||
        h.server_profile?.toLowerCase().includes(q) ||
        h.domain?.toLowerCase().includes(q) ||
        h.mgmt_ip?.toLowerCase().includes(q) ||
        h.vcenter?.toLowerCase().includes(q)
      );
    });
  }, [hosts, activeDcTab, searchQuery, domainFilter, vcFilter, statusFilter]);

  const sortedHosts = useMemo(() => {
    const arr = [...filteredHosts];
    const name = h => h.server_profile || '';
    if (sortBy === 'domain') {
      arr.sort((a, b) => (a.domain || '').localeCompare(b.domain || '') || name(a).localeCompare(name(b)));
    } else if (sortBy === 'cluster') {
      arr.sort((a, b) => (a.cluster || '').localeCompare(b.cluster || '') || name(a).localeCompare(name(b)));
    } else {
      arr.sort((a, b) => name(a).localeCompare(name(b)));
    }
    return arr;
  }, [filteredHosts, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedHosts.length / perPage));
  const safePage   = Math.min(page, totalPages);
  const pageHosts  = sortedHosts.slice((safePage - 1) * perPage, safePage * perPage);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeDcTab, domainFilter, vcFilter, statusFilter, sortBy, perPage]);

  // History scoped to the active entity tab (server | fi | chassis). The
  // global Claude Usage section sees every record regardless of kind.
  const kindKey = section === 'servers' ? 'server' : section;
  const kindHistory = useMemo(
    () => (section === 'usage' ? history : history.filter(h => (h.kind || 'server') === kindKey)),
    [history, kindKey, section]
  );

  const filteredReports = useMemo(() => {
    const q = reportQuery.trim().toLowerCase();
    let list = kindHistory;
    if (q) {
      list = list.filter(h =>
        h.host?.toLowerCase().includes(q) ||
        h.root_cause?.toLowerCase().includes(q) ||
        h.severity?.toLowerCase().includes(q)
      );
    }
    if (reportFilter !== 'all') list = list.filter(h => sevBucket(h) === reportFilter);
    const ts = h => h.analyzed_at || h.collected_at || '';
    return [...list].sort((a, b) => reportSort === 'oldest'
      ? ts(a).localeCompare(ts(b))
      : ts(b).localeCompare(ts(a)));
  }, [kindHistory, reportQuery, reportFilter, reportSort]);

  // Timeline groups, one per calendar day.
  const reportGroups = useMemo(() => {
    const groups = [];
    const byKey = new Map();
    for (const h of filteredReports) {
      const d = new Date(h.analyzed_at || h.collected_at);
      const key = isNaN(d.getTime()) ? 'unknown' : d.toDateString();
      if (!byKey.has(key)) {
        const g = {
          key,
          label: isNaN(d.getTime())
            ? 'Unknown date'
            : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          items: [],
        };
        byKey.set(key, g);
        groups.push(g);
      }
      byKey.get(key).items.push(h);
    }
    return groups;
  }, [filteredReports]);

  // --- Claude Usage dashboard data (derived from per-record history usage) ---
  // Usage is normalized so records from older index formats still show up.
  const analyzedHistory = useMemo(
    () => kindHistory.filter(h => h.analyzed).map(h => ({ ...h, usage: h.usage || {} })),
    [kindHistory]
  );


  const trendData = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push({
        key: d.toDateString(),
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        input: 0,
        output: 0,
      });
    }
    const byKey = new Map(days.map(d => [d.key, d]));
    for (const h of analyzedHistory) {
      const ts = new Date(h.analyzed_at || h.collected_at);
      if (isNaN(ts.getTime())) continue;
      const bucket = byKey.get(ts.toDateString());
      if (bucket) {
        bucket.input  += h.usage.input_tokens  || 0;
        bucket.output += h.usage.output_tokens || 0;
      }
    }
    return days;
  }, [analyzedHistory]);

  const tokenSplit = useMemo(() => (usage ? [
    { name: 'Input Tokens',  value: usage.input_tokens  || 0, color: '#3b82f6' },
    { name: 'Output Tokens', value: usage.output_tokens || 0, color: '#10b981' },
  ] : []), [usage]);

  const topHosts = useMemo(() => {
    const m = new Map();
    for (const h of analyzedHistory) {
      m.set(h.host, (m.get(h.host) || 0) + (h.usage.cost || 0));
    }
    return [...m.entries()]
      .map(([host, cost]) => ({ host, cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 6);
  }, [analyzedHistory]);

  const recentAnalyses = useMemo(
    () => [...analyzedHistory]
      .sort((a, b) => (b.analyzed_at || b.collected_at || '').localeCompare(a.analyzed_at || a.collected_at || ''))
      .slice(0, 6),
    [analyzedHistory]
  );

  function openCollect(host, sources) {
    setPendingSources(host.vcenter_only ? ['vcenter'] : sources);
    setPendingCollect({ host });
  }

  // Device detail card (same one the global search opens) — lazily builds the
  // full device index for serials, CPU/memory, FI details, etc.
  const deviceIndexRef = useRef(null);
  const [deviceDetail, setDeviceDetail] = useState(null);
  const [deviceLoading, setDeviceLoading] = useState(null);

  // "Ask Claude" host picker (opened from the AI Fleet Summary banner)
  const [askClaudeOpen, setAskClaudeOpen] = useState(false);

  // FI/Chassis equivalent of openDeviceCard — the equipment list already
  // carries everything the modal needs (info + live alarms), so no fetch.
  function openEquipmentDeviceCard(d, kind) {
    if (kind === 'fi') {
      setDeviceDetail({
        type: 'fi',
        name: d.display_name || d.name,
        model: d.model,
        serial: d.serial,
        switchId: d.switch_id,
        ip: d.out_of_band_ip_address,
        domain: d.domain_name,
        evac: d.oper_evac_state,
        totalPorts: d.total_ports,
        usedPorts: d.used_ports,
        alarms: d.alarms,
        alarmCounts: d.alarm_counts,
      });
    } else {
      setDeviceDetail({
        type: 'chassis',
        name: d.display_name || d.name,
        model: d.model,
        serial: d.serial,
        chassisId: d.chassis_id,
        domain: d.domain_name,
        connectionStatus: d.connection_status,
        operState: d.oper_state,
        totalSlots: d.total_slots,
        usedSlots: d.used_slots,
        alarms: d.alarms,
        alarmCounts: d.alarm_counts,
      });
    }
  }

  async function openDeviceCard(host) {
    setDeviceLoading(host.moid);
    try {
      if (!deviceIndexRef.current) deviceIndexRef.current = await loadDeviceIndex();
      const short = (host.server_profile || '').toLowerCase();
      const entry = deviceIndexRef.current.entries.find(
        e => e.type === 'host' && (e.name || '').toLowerCase() === short
      );
      setDeviceDetail(entry || {
        type: 'host',
        name: host.server_profile,
        profile: host.server_profile,
        vcenterOnly: host.vcenter_only,
        ip: host.mgmt_ip,
        domain: host.vcenter_only ? null : host.domain,
        dc: host.datacenter,
        vc: null,
      });
    } finally {
      setDeviceLoading(null);
    }
  }

  async function collectFor(host, sources) {
    if (range === 'custom' && (!startTime || !endTime)) {
      setCollectError('Select a start and end time for the custom range.');
      return;
    }
    setCollecting({ host: host.server_profile, sources });
    setCollectError(null);
    setBundle(null);
    setAnalysis(null);
    setAnalysisError(null);
    setTac(null);

    const body = { host: host.server_profile, sources };
    if (sources.includes('intersight') && cimcPassword) {
      body.cimc_username = cimcUser || 'admin';
      body.cimc_password = cimcPassword;
    }
    if (range === 'custom') {
      body.start_time = localToUtcIso(startTime);
      body.end_time   = localToUtcIso(endTime);
    } else {
      body.hours = parseInt(range, 10);
    }

    try {
      const res = await mockFetch(`${API_BASE}/api/diagnostics/collect`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setBundle(result);
      const firstTab = LOG_TABS.find(t => result.sources.includes(t.source));
      setActiveLogTab(firstTab ? firstTab.key : 'sel');
      // Resume/reuse a bundle already generated for this blade in Intersight —
      // survives page refreshes since Intersight is the source of truth.
      const recent = (result.tac_bundles || [])[0];
      if (recent?.status_moid) {
        setTac({
          statusMoid: recent.status_moid,
          status: recent.status || 'Pending',
          fileName: recent.file_name,
          fileSize: recent.file_size,
          created: recent.created,
          existing: true,
        });
      }
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      loadHistory();
    } catch (err) {
      setCollectError(err.message);
    } finally {
      setCollecting(null);
    }
  }

  async function handleAnalyze() {
    if (!bundle) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);

    try {
      const res = await mockFetch(`${API_BASE}/api/diagnostics/analyze`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          host: bundle.host,
          bundle,
          // Include the TAC bundle contents when one has finished collecting
          tac_status_moid: tac?.status === 'Completed' ? tac.statusMoid : null,
          context: analysisContext.trim() || null,
          history_id: bundle.history_id || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setAnalysis(result);
      if (result.usage_totals) setUsage(result.usage_totals);
      loadHistory();
    } catch (err) {
      setAnalysisError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  const hasIntersight = bundle?.sources?.includes('intersight');
  const hasVcenter    = bundle?.sources?.includes('vcenter');
  const visibleLogTabs = LOG_TABS.filter(t => bundle?.sources?.includes(t.source));

  const collectBtnCls = color =>
    `inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors text-xs font-medium disabled:opacity-50 ${color}`;

  const collectButtons = host => (
    <>
      <button
        onClick={() => openCollect(host, ['intersight'])}
        disabled={!!collecting || host.vcenter_only}
        className={collectBtnCls('bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30')}
        title={host.vcenter_only ? 'Not managed by Intersight' : 'Pull Intersight SEL & faults'}
      >
        <ScrollText className="h-3.5 w-3.5" />
        Intersight
      </button>
      <button
        onClick={() => openCollect(host, ['vcenter'])}
        disabled={!!collecting}
        className={collectBtnCls('bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30')}
        title="Pull vCenter events & host logs"
      >
        <Activity className="h-3.5 w-3.5" />
        vCenter
      </button>
      <button
        onClick={() => openCollect(host, ['intersight', 'vcenter'])}
        disabled={!!collecting || host.vcenter_only}
        className={collectBtnCls('bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30')}
        title={host.vcenter_only ? 'Not managed by Intersight' : 'Pull both Intersight & vCenter logs'}
      >
        <Layers className="h-3.5 w-3.5" />
        Both
      </button>
    </>
  );

  return (
    <>
      <PageHeader
        title={(
          <span className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 shadow-[0_2px_12px_rgba(124,58,237,0.35)]">
              <ClaudeSpark className="h-4 w-4" color="#ffffff" />
            </span>
            AI Diagnostics
          </span>
        )}
        subtitle="Collect logs from servers, FIs & chassis and let Claude find the root cause"
        actions={(
          <Button
            size="sm" icon={RefreshCw} loading={loading}
            onClick={refreshAll}
            title="Refresh hosts, reports & usage"
          >
            Refresh
          </Button>
        )}
      />

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Fleet health overview + AI summary — servers page only */}
        {section === 'servers' && data && hosts.length > 0 && (
          <>
            <FleetKpis hosts={hosts} />
            <AiFleetSummary
              hosts={hosts}
              alarmHosts={alarmHosts}
              history={history}
              onAskClaude={() => setAskClaudeOpen(true)}
            />
          </>
        )}

        {/* FI / Chassis health overview on their own pages */}
        {(section === 'fi' || section === 'chassis') && equipment && (
          <EquipmentKpis
            kind={section}
            items={section === 'fi' ? equipment.fis : equipment.chassis}
          />
        )}

        {/* Sub-tabs inside the entity (the entity itself — Servers / FI /
            Chassis — is picked from the sidebar): list / alarms / history */}
        {section !== 'usage' && (
        <div className="flex items-center gap-2 mb-6 px-1 overflow-x-auto">
          {[
            { key: 'list',    label: section === 'servers' ? 'Servers' : section === 'fi' ? 'Fabric Interconnects' : 'Chassis' },
            { key: 'alarms',  label: 'Alarms' },
            { key: 'reports', label: 'History' },
          ].map(t => {
            const alarmCount = t.key !== 'alarms' ? 0
              : section === 'servers' ? alarmHosts.length
              : ((section === 'fi' ? equipment?.fis : equipment?.chassis) || [])
                  .filter(d => (d.alarms || []).length > 0).length;
            return (
              <button
                key={t.key}
                onClick={() => navigate(`/host-diagnostics?section=${section}&view=${t.key}`)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap
                  ${view === t.key
                    ? 'bg-violet-600 border-violet-600 text-white shadow-[0_2px_10px_rgba(124,58,237,0.3)]'
                    : 'bg-white/70 dark:bg-white/[0.06] border-slate-300/70 dark:border-white/[0.1] text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/[0.1]'}`}
              >
                {t.label}
                {alarmCount > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${view === t.key
                    ? 'bg-white/20 border-white/30 text-white'
                    : 'bg-red-500/15 text-red-500 dark:text-red-400 border-red-500/25'}`}>
                    {alarmCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        )}

        {error && <div className="mb-6"><ErrorBanner message={error} /></div>}
        {collectError && <div className="mb-4"><ErrorBanner message={collectError} /></div>}

        {/* ------------------------------ Servers ------------------------------ */}
        {section === 'servers' && view === 'list' && loading && !data && (
          <LoadingState label="Loading hosts…" />
        )}

        {section === 'servers' && view === 'list' && data && (
          <>
            {/* Search + filters */}
            <div className="ai-fade-in flex flex-col xl:flex-row gap-3 mb-4">
              <SearchInput
                className="flex-1"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by server name, profile, IP, or blade…"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={domainFilter} onChange={setDomainFilter}>
                  <option value="all">All Domains</option>
                  {domainOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </Select>
                <Select value={vcFilter} onChange={setVcFilter}>
                  <option value="all">All vCenters</option>
                  {vcenterOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </Select>
                <Select value={statusFilter} onChange={setStatusFilter}>
                  <option value="all">All Statuses</option>
                  {statusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </Select>
              </div>
            </div>

            {/* DC pills + view controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                {DC_TABS.map((tab) => {
                  const isActive = activeDcTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveDcTab(tab.key)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors
                        ${isActive
                          ? 'bg-violet-600 border-violet-600 text-white shadow-[0_2px_10px_rgba(124,58,237,0.3)]'
                          : 'bg-white/70 dark:bg-white/[0.06] border-slate-300/70 dark:border-white/[0.1] text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/[0.1]'
                        }`}
                    >
                      {tab.label}
                      <span className="ml-1.5 opacity-70 tabular-nums">{counts[tab.key] ?? 0}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={sortBy} onChange={setSortBy}>
                  <option value="name">Sort: Name</option>
                  <option value="domain">Sort: Domain</option>
                  <option value="cluster">Sort: Cluster</option>
                </Select>
                <div className="flex items-center rounded-lg border border-slate-300/70 dark:border-white/[0.1] overflow-hidden">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors
                      ${viewMode === 'table'
                        ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
                        : 'bg-white/70 dark:bg-white/[0.06] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    <List className="h-3.5 w-3.5" />
                    Table
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors
                      ${viewMode === 'grid'
                        ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
                        : 'bg-white/70 dark:bg-white/[0.06] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Grid
                  </button>
                </div>
              </div>
            </div>

            {/* Server grid */}
            {viewMode === 'grid' && (
              pageHosts.length === 0 ? (
                <div className="ai-surface rounded-2xl">
                  <EmptyState
                    icon={Server}
                    title={searchQuery || domainFilter !== 'all' || vcFilter !== 'all' || statusFilter !== 'all'
                      ? 'No servers match your search or filters'
                      : 'No servers found'}
                    hint="Try clearing the search or switching filters."
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {pageHosts.map((host) => (
                    <div
                      key={host.moid}
                      className="ai-surface rounded-2xl p-5 flex flex-col gap-3 transition-all duration-150 hover:border-violet-500/40 hover:shadow-[0_4px_20px_rgba(124,58,237,0.12)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <button
                            onClick={() => openDeviceCard(host)}
                            title="View device details & alerts"
                            className="block max-w-full text-left"
                          >
                            <h3 className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-slate-900 dark:text-white hover:text-violet-500 dark:hover:text-violet-300 hover:underline underline-offset-2 transition-colors">
                              <span className="truncate">{host.server_profile}</span>
                              {deviceLoading === host.moid && (
                                <RefreshCw className="h-3 w-3 animate-spin text-violet-400 flex-shrink-0" />
                              )}
                            </h3>
                          </button>
                          <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">
                            {host.mgmt_ip || host.vcenter || '—'}
                          </p>
                        </div>
                        <StatusDot status={host.status} />
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <SourceChip vcenterOnly={host.vcenter_only} />
                        {host.blade_name && (
                          <span className="text-xs font-mono text-slate-500 truncate" title={host.blade_name}>
                            {host.blade_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
                        <LayoutGrid className="h-3 w-3 flex-shrink-0" />
                        <span className={`truncate ${dcTextClass(host.cluster)}`} title={host.cluster || undefined}>
                          {host.cluster || 'No vCenter cluster'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 mt-auto pt-1">
                        {collectButtons(host)}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Server table */}
            {viewMode === 'table' && (
              <div className="relative ai-surface rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/10 dark:border-white/5">
                        <th className="text-left py-3 px-4 font-medium">Server Profile</th>
                        <th className="text-left py-3 px-4 font-medium">Blade Name</th>
                        <th className="text-left py-3 px-4 font-medium">Management IP</th>
                        <th className="text-left py-3 px-4 font-medium">Domain</th>
                        <th className="text-left py-3 px-4 font-medium">vCenter</th>
                        <th className="text-left py-3 px-4 font-medium">Cluster</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-right py-3 px-4 font-medium">Collect Logs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 dark:divide-white/5">
                      {pageHosts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                            No servers match your search or filters.
                          </td>
                        </tr>
                      ) : (
                        pageHosts.map((host) => (
                          <tr key={host.moid} className="hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-4">
                              <button
                                onClick={() => openDeviceCard(host)}
                                title="View device details & alerts"
                                className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-violet-500 dark:hover:text-violet-300 hover:underline underline-offset-2 transition-colors"
                              >
                                {host.server_profile}
                                {deviceLoading === host.moid && (
                                  <RefreshCw className="h-3 w-3 animate-spin text-violet-400" />
                                )}
                              </button>
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2">
                                <Server className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                {host.vcenter_only
                                  ? <SourceChip vcenterOnly />
                                  : <span className="text-sm text-slate-600 dark:text-slate-300">{host.blade_name}</span>}
                              </div>
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">{host.mgmt_ip || '—'}</span>
                            </td>
                            <td className="py-2.5 px-4">
                              <span className={`text-sm ${dcTextClass(host.domain) || 'text-slate-600 dark:text-slate-300'}`}>{host.domain}</span>
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">{host.vcenter || '—'}</span>
                            </td>
                            <td className="py-2.5 px-4">
                              <span className={`text-sm ${dcTextClass(host.cluster) || 'text-slate-500 dark:text-slate-400'}`}>{host.cluster || '—'}</span>
                            </td>
                            <td className="py-2.5 px-4">
                              <StatusDot status={host.status} />
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center justify-end gap-2">
                                {collectButtons(host)}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination */}
            {sortedHosts.length > 0 && (
              <div className="mt-1">
                <Pagination
                  page={safePage} perPage={perPage} total={sortedHosts.length}
                  onPage={setPage} onPerPage={setPerPage} label="servers"
                  perPageOptions={[12, 24, 48, 96]}
                />
              </div>
            )}
          </>
        )}

        {/* --------------------------- FI / Chassis --------------------------- */}
        {(section === 'fi' || section === 'chassis') && view === 'list' && (
          <EquipmentSection
            key={section}
            kind={section}
            items={section === 'fi' ? equipment?.fis : equipment?.chassis}
            loading={equipLoading}
            error={equipError}
            onReload={loadEquipment}
            onOpenDevice={openEquipmentDeviceCard}
            onAnalyzed={(result) => {
              if (result.usage_totals) setUsage(result.usage_totals);
              loadHistory();
            }}
          />
        )}

        {/* ------------------------------ Alarms ------------------------------ */}
        {section === 'servers' && view === 'alarms' && (
          loading && !data && hosts.length === 0
            ? <LoadingState label="Loading hosts…" />
            : <AlarmsSection
                hosts={alarmHosts}
                vcByShort={vcByShort}
                onOpenDevice={openDeviceCard}
                deviceLoading={deviceLoading}
              />
        )}

        {(section === 'fi' || section === 'chassis') && view === 'alarms' && (
          <EquipmentAlarmsSection
            key={section}
            kind={section}
            items={section === 'fi' ? equipment?.fis : equipment?.chassis}
            loading={equipLoading}
            error={equipError}
            onReload={loadEquipment}
            onOpenDevice={openEquipmentDeviceCard}
          />
        )}

        {/* ---------------------------- Claude Usage ---------------------------- */}
        {section === 'usage' && (
          <div className="space-y-5 ai-fade-in">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                <Sparkles className="h-5 w-5 text-violet-400" />
                <span className="ai-gradient-text">Claude</span> Usage
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Overall Claude API consumption and spend across all diagnostics — servers, FIs &amp; chassis.
              </p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <UsageStat
                icon={Sparkles} tile="bg-gradient-to-br from-violet-500 to-indigo-500"
                label="Model"
                value={prettyModel(usage?.model)}
                sub={(
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                    usage?.configured
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500 dark:text-emerald-400'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-500 dark:text-amber-400'
                  }`}>
                    {usage?.configured ? 'Active' : 'Not Configured'}
                  </span>
                )}
              />
              <UsageStat
                icon={Activity} tile="bg-blue-500"
                label="Analyses"
                value={(usage?.analyses ?? 0).toLocaleString()}
                sub="root-cause reports generated"
              />
              <UsageStat
                icon={FileText} tile="bg-cyan-500"
                label="Input Tokens"
                value={(usage?.input_tokens ?? 0).toLocaleString()}
                sub="$3.00 per 1M tokens"
              />
              <UsageStat
                icon={ScrollText} tile="bg-emerald-500"
                label="Output Tokens"
                value={(usage?.output_tokens ?? 0).toLocaleString()}
                sub="$15.00 per 1M tokens"
              />
              <UsageStat
                icon={DollarSign} tile="bg-violet-500"
                label="Total Spend"
                value={`$${(usage?.cost ?? 0).toFixed(2)}`}
                sub={usage?.analyses
                  ? `$${(usage.cost / usage.analyses).toFixed(2)} per analysis`
                  : 'no analyses yet'}
              />
            </div>

            {/* Metering info banner */}
            {showMeterInfo && (
              <div className="ai-surface rounded-2xl p-5 relative border border-blue-500/20">
                <button
                  onClick={() => setShowMeterInfo(false)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  <Info className="h-4 w-4 text-blue-400" />
                  How usage is metered
                </p>
                <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-1.5 list-disc list-inside">
                  <li>Claude runs only when you click <span className="font-semibold">Analyze with Claude</span> on a collected bundle — no other part of the app uses the API key.</li>
                  <li>Each analysis sends the collected faults, SEL, events, host logs and (when available) TAC bundle sections as input tokens; the structured report comes back as output tokens.</li>
                  <li>Totals are stored on the persistent data volume, so they survive pod crashes, restarts and redeployments.</li>
                </ul>
              </div>
            )}

            {/* Charts row */}
            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr_1fr] gap-4">
              <ChartCard
                title="Usage Trends"
                right={(
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 rounded bg-blue-500" /> Input Tokens</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 rounded bg-emerald-500" /> Output Tokens</span>
                  </div>
                )}
              >
                {trendData.every(d => d.input === 0 && d.output === 0) ? (
                  <div className="h-[220px] flex items-center justify-center text-sm text-slate-500">
                    No analyses in the last 7 days.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tokIn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="tokOut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}K` : v)}
                        axisLine={false} tickLine={false} width={42}
                      />
                      <ReTooltip
                        contentStyle={{ background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                        formatter={(v, n) => [Number(v).toLocaleString(), n]}
                      />
                      <Area type="monotone" dataKey="input" name="Input Tokens" stroke="#3b82f6" strokeWidth={2} fill="url(#tokIn)" dot={{ r: 3, strokeWidth: 0, fill: '#3b82f6' }} />
                      <Area type="monotone" dataKey="output" name="Output Tokens" stroke="#10b981" strokeWidth={2} fill="url(#tokOut)" dot={{ r: 3, strokeWidth: 0, fill: '#10b981' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Token Breakdown">
                <div className="flex flex-col items-center gap-5 py-2">
                  <div className="relative w-48 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={tokenSplit} dataKey="value" nameKey="name"
                          innerRadius={64} outerRadius={88} strokeWidth={0}
                          startAngle={90} endAngle={-270}
                        >
                          {tokenSplit.map(s => <Cell key={s.name} fill={s.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {((usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0)).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500">Total Tokens</p>
                    </div>
                  </div>
                  <div className="flex items-start justify-center gap-8">
                    {tokenSplit.map(s => {
                      const total = tokenSplit.reduce((a, b) => a + b.value, 0);
                      return (
                        <div key={s.name} className="flex items-start gap-2.5">
                          <span className="mt-1.5 w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                          <div className="text-sm">
                            <p className="text-slate-600 dark:text-slate-300">{s.name}</p>
                            <p className="text-slate-500 font-mono">
                              {s.value.toLocaleString()} ({total ? ((s.value / total) * 100).toFixed(1) : 0}%)
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ChartCard>

              <ChartCard title="Model Usage">
                <div className="flex flex-col items-center gap-5 py-6">
                  <ClaudeSpark className="h-24 w-24" />
                  <div className="text-center">
                    <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {prettyModel(usage?.model || 'claude-sonnet-5')}
                    </p>
                    <p className="text-sm text-slate-500 font-mono mt-1.5">100% of analyses</p>
                  </div>
                  <p className="text-sm text-slate-500 text-center leading-relaxed max-w-[17rem] -mt-2">
                    All analyses run on Claude Sonnet 5 — this page never calls any other model.
                  </p>
                </div>
              </ChartCard>
            </div>

            {/* Recent analyses + top hosts */}
            <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
              <ChartCard
                title="Recent Analyses"
                right={(
                  <button
                    onClick={() => navigate('/host-diagnostics?section=reports')}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-300/50 dark:border-slate-700/50 hover:bg-white/40 dark:hover:bg-white/5 transition-colors"
                  >
                    View history
                  </button>
                )}
              >
                {recentAnalyses.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No analyses yet.</p>
                ) : (
                  <div className="overflow-x-auto -mx-5 px-5">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 border-b border-white/10">
                          <th className="text-left py-2 pr-4 font-medium">Host</th>
                          <th className="text-left py-2 pr-4 font-medium">Status</th>
                          <th className="text-left py-2 pr-4 font-medium">Duration</th>
                          <th className="text-left py-2 pr-4 font-medium">Tokens</th>
                          <th className="text-left py-2 pr-4 font-medium">Cost</th>
                          <th className="text-left py-2 pr-4 font-medium">Completed</th>
                          <th className="py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {recentAnalyses.map(h => (
                          <tr
                            key={h.id}
                            onClick={() => openHistorySummary(h.id)}
                            className="cursor-pointer hover:bg-white/20 dark:hover:bg-white/5 transition-colors"
                          >
                            <td className="py-2.5 pr-4">
                              <span className="font-mono text-slate-800 dark:text-slate-100">{h.host}</span>
                            </td>
                            <td className="py-2.5 pr-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 dark:text-emerald-400 whitespace-nowrap">
                                <CheckCircle2 className="h-3 w-3" />
                                Completed
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                              {fmtDuration(h.usage?.duration_secs) || '—'}
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                              {((h.usage?.input_tokens || 0) + (h.usage?.output_tokens || 0)).toLocaleString()}
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-slate-500 font-mono whitespace-nowrap">
                              {h.usage?.cost != null ? `$${h.usage.cost.toFixed(2)}` : '—'}
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-slate-500 whitespace-nowrap">
                              {relTime(h.analyzed_at || h.collected_at)}
                            </td>
                            <td className="py-2.5 text-right">
                              {historyLoading === h.id
                                ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-400 inline" />
                                : <ChevronRight className="h-3.5 w-3.5 text-slate-500 inline" />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ChartCard>

              <ChartCard title="Top Hosts by Spend">
                {topHosts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No analyses yet.</p>
                ) : (
                  <div className="space-y-4 py-1">
                    {topHosts.map(t => {
                      const max = topHosts[0].cost || 1;
                      return (
                        <div key={t.host} className="flex items-center gap-4">
                          <span className="w-40 text-sm font-mono text-slate-600 dark:text-slate-300 truncate flex-shrink-0" title={t.host}>
                            {t.host}
                          </span>
                          <div className="flex-1 h-5 rounded-md bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-md bg-violet-500"
                              style={{ width: `${Math.max(6, (t.cost / max) * 100)}%` }}
                            />
                          </div>
                          <span className="w-14 text-right text-sm font-mono text-slate-500 flex-shrink-0">
                            ${t.cost.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ChartCard>
            </div>
          </div>
        )}

        {/* ----------------------------- History ----------------------------- */}
        {view === 'reports' && (
          <div className="space-y-5 ai-fade-in">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Analysis History</h2>
                <p className="text-sm text-slate-500 mt-0.5">Browse and revisit previous AI root-cause analyses.</p>
              </div>
              <SearchInput
                className="w-full sm:w-72"
                value={reportQuery}
                onChange={setReportQuery}
                placeholder="Search analyses…"
              />
            </div>

            {/* Severity pills + sort */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {REPORT_PILLS.map(p => {
                  const active = reportFilter === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => setReportFilter(p.key)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors
                        ${p.key === 'all' && active
                          ? 'bg-violet-600 border-violet-600 text-white shadow-[0_2px_10px_rgba(124,58,237,0.3)]'
                          : active
                            ? 'bg-white/60 dark:bg-white/15 border-white/30 text-slate-900 dark:text-white'
                            : 'bg-white/70 dark:bg-white/[0.06] border-slate-300/70 dark:border-white/[0.1] text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/[0.1]'}`}
                    >
                      {p.dot && <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />}
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <Select value={reportSort} onChange={setReportSort}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </Select>
            </div>

            {/* Timeline */}
            {filteredReports.length === 0 ? (
              <div className="ai-surface rounded-2xl p-10 text-center text-sm text-slate-500">
                {history.length === 0
                  ? 'No analyses yet — collect logs for a server from the Servers tab to create one.'
                  : 'No analyses match your search or filter.'}
              </div>
            ) : (
              reportGroups.map(g => (
                <div key={g.key}>
                  <p className="text-xs font-semibold text-slate-500 mb-2">{g.label}</p>
                  <div className="ai-surface rounded-2xl divide-y divide-white/5 overflow-hidden">
                    {g.items.map(h => {
                      const bucketKey = sevBucket(h);
                      const bucket = SEV_BUCKETS[bucketKey];
                      const BucketIcon = bucket.icon;
                      const duration = fmtDuration(h.usage?.duration_secs);
                      const badgeVariant = bucketKey === 'critical' ? 'critical'
                        : bucketKey === 'warning' ? 'warning'
                        : bucketKey === 'healthy' ? 'success' : 'neutral';
                      return (
                        <div
                          key={h.id}
                          onClick={() => openHistorySummary(h.id)}
                          className="group flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-violet-500/[0.06] dark:hover:bg-violet-500/[0.08] transition-colors"
                        >
                          <span className="w-16 text-xs font-mono tabular-nums text-slate-500 flex-shrink-0">
                            {fmtClock(h.analyzed_at || h.collected_at)}
                          </span>
                          <span className={`p-1.5 rounded-full flex-shrink-0 ${bucket.ring}`}>
                            {historyLoading === h.id
                              ? <RefreshCw className="h-4 w-4 animate-spin text-violet-400" />
                              : <BucketIcon className={`h-4 w-4 ${bucket.iconCls}`} />}
                          </span>
                          <span
                            className="font-mono font-semibold text-sm text-slate-900 dark:text-white flex-shrink-0 max-w-[10rem] sm:max-w-[13rem] truncate"
                            title={h.host}
                          >
                            {h.host}
                          </span>
                          <span className="hidden sm:inline-flex flex-shrink-0">
                            <Badge dot variant={badgeVariant}>
                              {h.analyzed ? (h.severity || 'Info') : 'Not analyzed'}
                            </Badge>
                          </span>
                          <span className="flex-1 min-w-0 text-xs text-slate-500 dark:text-slate-400 truncate">
                            {h.root_cause || (h.analyzed ? '' : 'Logs collected — not analyzed yet')}
                          </span>
                          <span className="hidden md:block text-[11px] text-slate-500 flex-shrink-0 whitespace-nowrap">
                            {(h.sources || []).join(' + ')}{duration ? ` · ${duration}` : ''}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteHistoryRecord(h.id); }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                            title="Delete this analysis"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Results */}
        {section === 'servers' && view === 'list' && bundle && (
          <div ref={resultsRef} className="space-y-4 mt-8 scroll-mt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <ScrollText className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Diagnostics — {bundle.host}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {fmtLocal(bundle.window_start)} → {fmtLocal(bundle.window_end)}
                </p>
              </div>
            </div>

            {/* Partial/sample data banner */}
            {(bundle.notice || bundle.mock) && (
              <div className="ai-surface rounded-xl p-3 border border-amber-500/30 bg-amber-500/10 flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-amber-300 font-medium">
                  {bundle.notice || 'Sample data — backend collection logic not implemented yet.'}
                </p>
              </div>
            )}

            {/* Blade identity */}
            {bundle.blade && (
              <div className="ai-surface rounded-xl p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="font-semibold text-slate-200 font-mono">{bundle.blade.name}</span>
                </span>
                <span>Model: <span className="text-slate-200 font-mono">{bundle.blade.model}</span></span>
                <span>Serial: <span className="text-slate-200 font-mono">{bundle.blade.serial}</span></span>
                <span>Profile: <span className="text-slate-200 font-mono">{bundle.blade.server_profile}</span></span>
                {bundle.blade.mgmt_ip && (
                  <span>CIMC IP: <span className="text-slate-200 font-mono">{bundle.blade.mgmt_ip}</span></span>
                )}
              </div>
            )}

            {/* TAC tech-support bundle */}
            {hasIntersight && (
              <div className="ai-surface rounded-2xl p-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <Package className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">TAC Log Bundle</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Generate the diagnostic bundle Cisco TAC uses — collection runs on the blade via Intersight (~5–15 min)
                      </p>
                    </div>
                  </div>
                  {(!tac || (tac.existing && TAC_TERMINAL.includes(tac.status))) && (
                    <button
                      onClick={handleGenerateTac}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
                    >
                      <Package className="h-4 w-4" />
                      {tac?.existing ? 'Generate New Bundle' : 'Generate TAC Bundle'}
                    </button>
                  )}
                </div>

                {tac?.existing && (
                  <p className="text-xs text-slate-400">
                    Found an existing bundle in Intersight from {fmtLocal(tac.created)} — no need to regenerate it.
                  </p>
                )}

                {tac?.creating && (
                  <p className="flex items-center gap-2 text-xs text-slate-400">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Requesting bundle from Intersight…
                  </p>
                )}
                {tac?.error && (
                  <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10">
                    <p className="text-xs text-red-400 font-medium">TAC bundle error: {tac.error}</p>
                  </div>
                )}
                {tac?.statusMoid && !TAC_TERMINAL.includes(tac.status) && (
                  <p className="flex items-center gap-2 text-xs text-slate-300">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                    Collecting on the blade — status: <span className="font-semibold text-emerald-300">{tac.status}</span>.
                    This page checks every 10 seconds; you can keep working meanwhile.
                  </p>
                )}
                {tac?.status === 'Completed' && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 border border-emerald-500/30 bg-emerald-500/10">
                    <p className="text-xs text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5" />
                      Bundle ready: <span className="font-mono">{tac.fileName}</span>
                      {tac.fileSize ? ` (${(tac.fileSize / (1024 * 1024)).toFixed(1)} MB)` : ''}
                    </p>
                    <a
                      href={mockDownloadHref()}
                      download={tac.fileName || 'techsupport-bundle.txt'}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </div>
                )}
                {tac?.status && TAC_TERMINAL.includes(tac.status) && tac.status !== 'Completed' && (
                  <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10">
                    <p className="text-xs text-red-400 font-medium">
                      Bundle collection ended with status {tac.status}{tac.reason ? ` — ${tac.reason}` : ''}.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {hasIntersight && (
                <SummaryCard icon={ScrollText} label="SEL Entries" value={bundle.sel_entries.length} color="text-cyan-400" />
              )}
              {hasIntersight && (
                <SummaryCard icon={AlertTriangle} label="Faults in Window" value={bundle.faults.length} color="text-orange-400" />
              )}
              {hasVcenter && (
                <SummaryCard icon={Activity} label="vCenter Events" value={bundle.vcenter_events.length} color="text-blue-400" />
              )}
              <SummaryCard
                icon={bundle.host_online === null ? HelpCircle : bundle.host_online ? CheckCircle2 : XCircle}
                label={hasIntersight ? 'Blade Power' : 'Host Status'}
                value={bundle.host_online === null ? 'Unknown' : bundle.host_online ? 'Online' : 'Offline'}
                color={bundle.host_online === null ? 'text-slate-400' : bundle.host_online ? 'text-green-400' : 'text-red-400'}
              />
            </div>

            {/* Analyze */}
            <div className="ai-surface rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Sparkles className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Root Cause Analysis</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {tac?.status === 'Completed'
                        ? 'Send the collected logs and the TAC bundle to Claude for a root-cause summary'
                        : 'Send the collected logs to Claude for a root-cause summary'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="ai-gradient-btn flex items-center gap-2 px-5 py-2.5 rounded-xl disabled:opacity-50 text-white text-sm font-semibold"
                >
                  {analyzing
                    ? <RefreshCw className="h-4 w-4 animate-spin" />
                    : <ClaudeSpark className="h-4 w-4" color="#ffffff" />}
                  {analyzing ? 'Analyzing…' : 'Analyze with Claude'}
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  What happened? <span className="font-normal">(optional — gives Claude background to focus the analysis)</span>
                </label>
                <textarea
                  value={analysisContext}
                  onChange={e => setAnalysisContext(e.target.value)}
                  rows={2}
                  placeholder="e.g. AriaOps alerted at 2:14 AM that the host went unresponsive and HA restarted its VMs. No maintenance was scheduled."
                  className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 resize-y"
                />
              </div>

              {analysisError && (
                <div className="rounded-xl p-4 border border-red-500/30 bg-red-500/10">
                  <p className="text-sm text-red-400 font-medium">Analysis error: {analysisError}</p>
                </div>
              )}

              {analysis && (
                <AnalysisReport
                  analysis={analysis}
                  host={bundle.host}
                  windowStart={fmtLocal(bundle.window_start)}
                  windowEnd={fmtLocal(bundle.window_end)}
                  sources={bundle.sources}
                  model={bundle.blade?.model}
                  faultCount={bundle.faults?.length}
                  usage={analysis.usage}
                />
              )}
            </div>

            {/* Log tabs */}
            <div className="flex gap-2 flex-wrap">
              {visibleLogTabs.map(tab => {
                const Icon = tab.icon;
                const count =
                  tab.key === 'sel'    ? bundle.sel_entries.length :
                  tab.key === 'faults' ? bundle.faults.length :
                  tab.key === 'events' ? bundle.vcenter_events.length :
                  bundle.host_logs.length;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveLogTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border
                      ${activeLogTab === tab.key
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="ai-surface rounded-2xl overflow-hidden">
              {activeLogTab === 'sel' && hasIntersight && bundle.sel_error && (
                <div className="px-4 pt-4">
                  <div className="rounded-xl p-3 border border-amber-500/30 bg-amber-500/10">
                    <p className="text-xs text-amber-300 font-medium">{bundle.sel_error}</p>
                  </div>
                </div>
              )}
              {activeLogTab === 'sel' && hasIntersight && bundle.sel_source === 'bundle' && (
                <div className="px-4 pt-4">
                  <div className="rounded-xl p-3 border border-cyan-500/30 bg-cyan-500/10">
                    <p className="text-xs text-cyan-300 font-medium">
                      SEL loaded from the TAC bundle — entries newer than the bundle's creation time are not included.
                      Generate a new bundle to refresh it.
                    </p>
                  </div>
                </div>
              )}
              {activeLogTab === 'sel' && hasIntersight && (
                <LogTable
                  columns={['Timestamp', 'Severity', 'Description']}
                  rows={bundle.sel_entries}
                  renderRow={e => (
                    <>
                      <td className="px-4 py-3 text-xs font-mono text-slate-300 whitespace-nowrap">{fmtLocal(e.timestamp)}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><SeverityBadge severity={e.severity} /></td>
                      <td className="px-4 py-3 text-xs text-slate-300">{e.description}</td>
                    </>
                  )}
                />
              )}
              {activeLogTab === 'faults' && hasIntersight && (
                <LogTable
                  columns={['Created', 'Severity', 'Code', 'Component', 'Description']}
                  rows={bundle.faults}
                  renderRow={f => (
                    <>
                      <td className="px-4 py-3 text-xs font-mono text-slate-300 whitespace-nowrap">{fmtLocal(f.created)}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><SeverityBadge severity={f.severity} /></td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-300 whitespace-nowrap">{f.code}</td>
                      <td className="px-4 py-3 text-xs font-mono text-cyan-300 whitespace-nowrap max-w-[16rem] truncate" title={f.affected_mo}>
                        {(f.affected_mo || '').split('/').slice(3).join('/') || f.affected_mo || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">{f.description}</td>
                    </>
                  )}
                />
              )}
              {activeLogTab === 'events' && hasVcenter && (
                <LogTable
                  columns={['Timestamp', 'Event', 'Message']}
                  rows={bundle.vcenter_events}
                  renderRow={ev => (
                    <>
                      <td className="px-4 py-3 text-xs font-mono text-slate-300 whitespace-nowrap">{fmtLocal(ev.timestamp)}</td>
                      <td className="px-4 py-3 text-xs font-mono text-cyan-300 whitespace-nowrap">{ev.event_type}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{ev.message}</td>
                    </>
                  )}
                />
              )}
              {activeLogTab === 'logs' && hasVcenter && (
                <div className="p-4 space-y-4">
                  {bundle.host_logs_source === 'arialog' && (
                    <div className="rounded-xl p-3 border border-cyan-500/30 bg-cyan-500/10">
                      <p className="text-xs text-cyan-300 font-medium">
                        Host logs loaded from AriaOps for Logs (syslog) — available even while the host is down.
                      </p>
                    </div>
                  )}
                  {bundle.vcenter_error && bundle.host_logs.length === 0 && (
                    <div className="rounded-xl p-3 border border-amber-500/30 bg-amber-500/10">
                      <p className="text-xs text-amber-300 font-medium">{bundle.vcenter_error}</p>
                    </div>
                  )}
                  {bundle.host_logs.length === 0 ? (
                    <p className="text-center text-slate-500 text-sm py-6">
                      No host logs available.
                    </p>
                  ) : bundle.host_logs.map((log, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Server className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-300 font-mono">{log.file}</span>
                        <span className="text-[10px] text-slate-500">({log.lines} lines in window)</span>
                      </div>
                      <pre className="rounded-xl bg-black/40 border border-white/10 p-3 text-[11px] leading-relaxed text-slate-300 font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre">
{log.preview}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* History summary popup */}
      {historyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setHistoryModal(null)}
        >
          <div
            className="ai-surface rounded-2xl w-full max-w-4xl max-h-[88vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {historyModal.analysis ? (
              <div className="sticky top-0 z-20 flex justify-end px-3 pt-3 -mb-12">
                <button
                  onClick={() => setHistoryModal(null)}
                  className="p-2 rounded-lg bg-black/40 backdrop-blur text-slate-400 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="sticky top-0 ai-surface flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-indigo-500/20 flex-shrink-0">
                    <Clock className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white font-mono">{historyModal.host}</h2>
                    <p className="text-xs text-slate-500">
                      Collected {fmtLocal(historyModal.collected_at)} · {(historyModal.sources || []).join(' + ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setHistoryModal(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10 flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}

            <div className="p-4 sm:p-6">
              {historyModal.analysis ? (
                <AnalysisReport
                  analysis={historyModal.analysis}
                  host={historyModal.host}
                  collectedAt={fmtLocal(historyModal.collected_at)}
                  windowStart={fmtLocal(historyModal.window_start)}
                  windowEnd={fmtLocal(historyModal.window_end)}
                  sources={historyModal.sources}
                  model={historyModal.bundle?.blade?.model}
                  faultCount={historyModal.bundle?.faults?.length}
                  usage={historyModal.analysis.usage}
                  onOpenFull={() => openHistoryRecord(historyModal.id)}
                />
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">
                    Window: {fmtLocal(historyModal.window_start)} → {fmtLocal(historyModal.window_end)}
                  </p>
                  <div className="rounded-xl p-4 border border-slate-500/30 bg-slate-500/10">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No Claude analysis was run for this collection. Open the full results to review the raw logs or run an analysis.
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => openHistoryRecord(historyModal.id)}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/5 border border-white/10"
                    >
                      Open Full Results
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collection-in-progress overlay */}
      {collecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="ai-surface rounded-2xl p-8 max-w-md w-full mx-4 text-center space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Collecting {collecting.sources.length === 2
                  ? 'Intersight & vCenter'
                  : collecting.sources[0] === 'intersight' ? 'Intersight' : 'vCenter'} logs
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-mono">{collecting.host}</p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {collecting.sources.includes('intersight') && 'Querying Intersight faults, SEL and TAC bundles. '}
              {collecting.sources.includes('vcenter') && 'Querying vCenter events and AriaOps syslog. '}
              This usually takes 15–60 seconds.
            </p>
          </div>
        </div>
      )}

      {/* Analysis-in-progress overlay */}
      {analyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="ai-surface rounded-2xl p-8 max-w-md w-full mx-4 text-center space-y-4">
            <div className="relative mx-auto w-14 h-14 rounded-full ai-glow">
              <div className="absolute inset-0 rounded-full border-b-2 border-violet-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-violet-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                <span className="ai-gradient-text">Claude</span> is analyzing…
              </h3>
              {bundle && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-mono">{bundle.host}</p>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Correlating {bundle?.sources?.includes('intersight') ? 'faults, SEL, ' : ''}events and host logs
              {tac?.status === 'Completed' ? ' plus the TAC bundle' : ''} into a root-cause summary.
              This usually takes 30–60 seconds.
            </p>
          </div>
        </div>
      )}

      {/* Ask Claude host picker */}
      {askClaudeOpen && (
        <AskClaudeModal
          alarmHosts={alarmHosts}
          hosts={hosts}
          onClose={() => setAskClaudeOpen(false)}
          onPick={(h) => {
            setAskClaudeOpen(false);
            navigate('/host-diagnostics?section=servers');
            openCollect(h, ['intersight', 'vcenter']);
          }}
        />
      )}

      {/* Collect confirmation modal */}
      {pendingCollect && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setPendingCollect(null)}
        >
          <div
            className="relative w-full max-w-md ai-surface rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPendingCollect(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="bg-cyan-500/10 p-2.5 rounded-xl">
                <Stethoscope className="h-6 w-6 text-cyan-400" />
              </div>
              <h2 className="text-lg font-bold">Collect Diagnostics</h2>
            </div>

            <div className="bg-white/40 dark:bg-white/5 border border-slate-300/40 dark:border-slate-700/40 rounded-xl p-4 mb-5 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Server Profile</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{pendingCollect.host.server_profile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Blade</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {pendingCollect.host.vcenter_only ? 'vCenter only — no Intersight blade' : pendingCollect.host.blade_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{pendingCollect.host.vcenter_only ? 'Cluster' : 'Domain'}</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {pendingCollect.host.vcenter_only
                    ? (pendingCollect.host.cluster || '—')
                    : pendingCollect.host.domain}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Management IP</span>
                <span className="font-mono text-slate-700 dark:text-slate-200">{pendingCollect.host.mgmt_ip || '—'}</span>
              </div>
            </div>

            {/* Log sources */}
            <div className="mb-5 space-y-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Log Sources
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SOURCE_CHOICES.map(c => {
                  const Icon = c.icon;
                  const selected = pendingSources.join() === c.sources.join();
                  const disabled = pendingCollect.host.vcenter_only && c.sources.includes('intersight');
                  return (
                    <button
                      key={c.key}
                      onClick={() => !disabled && setPendingSources(c.sources)}
                      disabled={disabled}
                      title={disabled ? 'Not managed by Intersight' : c.desc}
                      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-xs font-medium transition-colors
                        ${selected
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-500 dark:text-cyan-300'
                          : 'bg-white/40 dark:bg-white/5 border-slate-300/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10'}
                        disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <Icon className="h-4 w-4" />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time range — adjust per collection */}
            <div className="mb-5 space-y-3">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Time Range
              </label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500 flex-shrink-0" />
                <select
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/50"
                >
                  {TIME_RANGES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              {range === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                      Start ({LOCAL_TZ_LABEL})
                    </label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                      End ({LOCAL_TZ_LABEL})
                    </label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                </div>
              )}
            </div>

            {pendingSources.includes('intersight') ? (
              <div className="space-y-3 mb-5">
                <p className="text-xs text-slate-500">
                  CIMC credentials — used to pull the SEL from the blade for this request only,
                  never stored. Leave the password blank to skip the SEL and collect faults only.
                </p>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Username"
                    value={cimcUser}
                    onChange={(e) => setCimcUser(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="CIMC admin password"
                    value={cimcPassword}
                    onChange={(e) => setCimcPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const pc = pendingCollect;
                        setPendingCollect(null);
                        collectFor(pc.host, pendingSources);
                      }
                    }}
                    className="w-full pl-10 pr-10 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mb-5">
                vCenter collection uses the app's service account — no credentials needed.
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPendingCollect(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const pc = pendingCollect;
                  setPendingCollect(null);
                  collectFor(pc.host, pendingSources);
                }}
                disabled={range === 'custom' && (!startTime || !endTime)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white"
              >
                <Search className="h-4 w-4" />
                Collect Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device detail card — same card as the global search, with live alerts */}
      {deviceDetail && (
        <DeviceDetailModal
          device={deviceDetail}
          fis={deviceIndexRef.current?.fis || []}
          onClose={() => setDeviceDetail(null)}
        />
      )}
    </>
  );
}

function LogTable({ columns, rows, renderRow }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map(col => (
              <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500 text-sm">
                No entries found in the selected window.
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="transition-colors hover:bg-white/5">
              {renderRow(row)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
