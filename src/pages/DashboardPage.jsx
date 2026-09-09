import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, Sparkles, RotateCcw, ServerCrash, ShieldCheck, ScanSearch,
  AlertTriangle, X, Loader2, Network,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardHeader, Badge, KpiCard, SectionLabel, Select } from '../components/ui';
import { classifyDC } from '../dcColors';
import { fetchEsxiHostList } from '../api';
import { loadDeviceIndex } from '../deviceIndex';
import DeviceDetailModal from '../components/DeviceDetailModal';
import VantageTopologyModal from '../components/VantageTopologyModal';
import DashboardSearch from '../components/DashboardSearch';
import HardwareLookup from '../components/HardwareLookup';
import DomainWidgets from '../components/DomainWidgets';
import ChassisSection from '../components/ChassisSection';
import FabricInterconnectSection from '../components/FabricInterconnectSection';

const HEALTH_COLORS = {
  Healthy:  '#10b981',
  Warning:  '#f59e0b',
  Critical: '#ef4444',
  Standby:  '#64748b',
};

// Visual identity per datacenter, used everywhere on the page.
const DC_META = {
  SITE1:  { dot: 'bg-sky-400',    text: 'text-sky-500 dark:text-sky-400' },
  SITE2: { dot: 'bg-violet-400', text: 'text-violet-500 dark:text-violet-400' },
};

const QUICK_ACTIONS = [
  {
    to: '/host-diagnostics', label: 'Run AI Diagnostics', icon: Sparkles, featured: true,
    desc: 'Collect logs & analyze root cause', tile: 'bg-violet-500/15', color: 'text-violet-500 dark:text-violet-400',
  },
  {
    to: '/reboot-cimc', label: 'Reboot CIMC', icon: RotateCcw,
    desc: 'Restart blade management controllers', tile: 'bg-amber-500/15', color: 'text-amber-500 dark:text-amber-400',
  },
  {
    to: '/host-crash-report', label: 'View Crash Reports', icon: ServerCrash,
    desc: 'VM restart & vMotion analysis', tile: 'bg-red-500/15', color: 'text-red-500 dark:text-red-400',
  },
  {
    to: '/backup-status', label: 'Backup Status', icon: ShieldCheck,
    desc: 'Rubrik VM backup health', tile: 'bg-emerald-500/15', color: 'text-emerald-500 dark:text-emerald-400',
  },
];

function DcLabel({ dc }) {
  const meta = DC_META[dc] || { dot: 'bg-slate-400', text: 'text-slate-500' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${meta.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {dc}
    </span>
  );
}

/** Compact SITE1 / SITE2 comparison table used inside the inventory cards. */
function DcTable({ dcs, rows }) {
  return (
    <div className="mt-3">
      <div
        className="grid gap-x-5 gap-y-0"
        style={{ gridTemplateColumns: `1fr repeat(${dcs.length}, auto)` }}
      >
        <span />
        {dcs.map(dc => <div key={dc} className="text-right pb-1.5"><DcLabel dc={dc} /></div>)}
        {rows.map(row => (
          [
            <span key={`${row.label}-l`} className="text-[13px] text-slate-500 py-1.5 border-t border-slate-200/60 dark:border-white/[0.06]">
              {row.label}
            </span>,
            ...dcs.map(dc => (
              <span
                key={`${row.label}-${dc}`}
                className={`text-[13px] font-medium tabular-nums text-right py-1.5 border-t border-slate-200/60 dark:border-white/[0.06]
                  ${row.tone?.[dc] === 'warning' ? 'text-amber-600 dark:text-amber-400'
                    : row.tone?.[dc] === 'positive' ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-900 dark:text-white'}`}
              >
                {row.values[dc] ?? '—'}
              </span>
            )),
          ]
        ))}
      </div>
    </div>
  );
}

function CapacityBar({ pct, tone = 'bg-blue-500' }) {
  return (
    <div className="h-1.5 rounded-full bg-slate-200/70 dark:bg-white/[0.07] overflow-hidden">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

/* Lists the hosts/chassis behind a Warning/Critical donut slice, with the
   reason(s) each one was flagged. Click-through opens the device card. */
function HealthIssuesModal({ title, items, onClose, onOpenDevice }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Card className="max-w-xl mx-auto bg-white/95 dark:bg-slate-900/95 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200/70 dark:border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/15">
              <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {items.length} affected · click a host for live alarms & config issues
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="divide-y divide-slate-200/60 dark:divide-white/[0.05] max-h-[60vh] overflow-y-auto">
          {items.map((it, i) => {
            const red = it.severity === 'Alert' || it.severity === 'Critical';
            return (
              <button
                key={i}
                onClick={it.chassis ? undefined : () => onOpenDevice(it)}
                disabled={!!it.chassis}
                className="w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-slate-100/60 dark:hover:bg-white/[0.04] disabled:cursor-default disabled:hover:bg-transparent transition-colors"
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${red ? 'bg-red-400' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-mono text-slate-800 dark:text-slate-100 truncate">{it.name}</p>
                  {(it.blade || it.cluster) && (
                    <p className="text-xs text-slate-500 truncate">{it.blade || it.cluster}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {it.reasons.map(r => (
                      <span
                        key={r}
                        className={`px-2 py-0.5 rounded-md border text-[11px] ${red
                          ? 'bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-300'
                          : 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-300'}`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                {!it.chassis && <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />}
              </button>
            );
          })}
        </div>
      </Card>
    </div>,
    document.body,
  );
}

/* One row of the grouped Details card — hairline dividers come from the parent. */
function DetailSection({ title, count, expanded, onToggle, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
          />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
          {count != null && <Badge variant="neutral">{count}</Badge>}
        </div>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="px-5 pb-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function DashboardPage({ data }) {
  const [expanded, setExpanded] = useState({});
  const [lookupOpen, setLookupOpen] = useState(false);
  const [topologyOpen, setTopologyOpen] = useState(false);
  // View-only filter — narrows what's rendered without touching Settings'
  // per-datacenter Vantage toggle (that one hides data app-wide; this is
  // just for looking at one DC at a time).
  const [dcFilter, setDcFilter] = useState('all');
  // All vCenter hosts (incl. rack mounts) — feeds the donuts' health rollup
  // and the "vCenter hosts" strip. Fail-soft: null keeps Vantage-only view.
  const [vcHosts, setVcHosts] = useState(null);
  const [vcState, setVcState] = useState('loading');      // 'loading' | 'ready' | 'error'
  const [healthModal, setHealthModal] = useState(null);   // { title, items }
  const [healthDevice, setHealthDevice] = useState(null); // { device, fis }
  const toggle = key => setExpanded(e => ({ ...e, [key]: !e[key] }));

  useEffect(() => {
    let cancelled = false;
    fetchEsxiHostList()
      .then(d => {
        if (cancelled) return;
        setVcHosts(d.hosts || []);
        setVcState('ready');
      })
      .catch(() => { if (!cancelled) setVcState('error'); });
    return () => { cancelled = true; };
  }, []);

  // Host short name -> vCenter health rollup (for joining onto blades).
  const vcHealth = useMemo(() => {
    if (!vcHosts) return null;
    const map = {};
    for (const h of vcHosts) {
      map[(h.host_name || '').split('.')[0].toLowerCase()] = {
        overall: h.overall_status,
        conn: h.connection_state,
        mm: h.maintenance_mode,
      };
    }
    return map;
  }, [vcHosts]);

  // Every vCenter host bucketed per DC — includes rack mounts and non-UCS
  // hosts that never appear in the blade donuts.
  const vcSummary = useMemo(() => {
    if (!vcHosts) return null;
    const per = {};
    for (const h of vcHosts) {
      const dc = classifyDC(h.datacenter || h.host_name) || h.datacenter || 'Other';
      const s = (per[dc] = per[dc] || { total: 0, healthy: 0, warning: 0, alert: 0, issues: [] });
      s.total += 1;
      const reasons = [];
      let sev = null;
      if (h.connection_state && h.connection_state !== 'connected') {
        sev = 'Alert';
        reasons.push(`vCenter connection: ${h.connection_state}`);
      } else if (h.overall_status === 'red') {
        sev = 'Alert';
        reasons.push('vCenter overall status red — active alarms');
      } else {
        if (h.maintenance_mode) { sev = 'Warning'; reasons.push('In maintenance mode'); }
        if (h.power_state && h.power_state !== 'poweredOn') { sev = 'Warning'; reasons.push(`Power state: ${h.power_state}`); }
        if (h.overall_status === 'yellow') { sev = 'Warning'; reasons.push('vCenter overall status yellow — alarm or configuration issue'); }
      }
      if (sev === 'Alert') s.alert += 1;
      else if (sev === 'Warning') s.warning += 1;
      else s.healthy += 1;
      if (sev) {
        s.issues.push({
          severity: sev,
          name: (h.host_name || '').split('.')[0],
          cluster: h.cluster,
          reasons,
        });
      }
    }
    const orderedDcs = Object.keys(per).sort((a, b) =>
      a === 'SITE1' ? -1 : b === 'SITE1' ? 1 : a.localeCompare(b));
    return { per, dcs: orderedDcs };
  }, [vcHosts]);

  // Open the full device card (live alarms + config issues) for a flagged host.
  const openIssueDevice = async item => {
    try {
      const idx = await loadDeviceIndex();
      const short = s => (s || '').split('.')[0].toLowerCase();
      const key = short(item.name);
      const bkey = (item.blade || '').toLowerCase();
      const entry = idx.entries.find(e =>
        short(e.name) === key || short(e.profile) === key || (bkey && e.blade?.toLowerCase() === bkey));
      if (entry) setHealthDevice({ device: entry, fis: idx.fis || [] });
    } catch { /* index unavailable — keep the list open */ }
  };

  const s = data.summary || {};
  const blades   = data.blades || [];
  const chassis  = data.chassis || [];
  const fis      = data.fabric_interconnects || [];
  const profiles = data.server_profiles || [];
  const domains  = data.domains || [];

  const agg = useMemo(() => {
    const isOn = b => (b.oper_power_state || '').toLowerCase() === 'on';
    const chassisDC = new Map(chassis.map(c => [c.moid, classifyDC(c.name)]));
    const bladeDC = b => chassisDC.get(b.chassis_moid) || classifyDC(b.name) || 'SITE1';

    const mk = () => ({
      blades: 0, on: 0, offProfile: 0, spares: 0, degraded: 0,
      chassis: 0, chassisOk: 0, slotsTotal: 0, slotsUsed: 0,
      fis: 0, portsUp: 0, portsDown: 0,
      assigned: 0, unassigned: 0,
      hHealthy: 0, hWarning: 0, hCritical: 0, hStandby: 0,
      outsideVc: 0, // active blades whose host isn't in any configured vCenter
    });
    const byDC = {};
    const issues = []; // what's behind every Warning/Critical donut slice
    const get = dc => (byDC[dc] = byDC[dc] || mk());

    for (const b of blades) {
      const dcName = bladeDC(b);
      const d = get(dcName);
      d.blades += 1;
      const degraded = b.oper_state && !['ok', ''].includes(b.oper_state.toLowerCase());
      if (degraded) d.degraded += 1;
      if (isOn(b)) d.on += 1;
      else if (b.assigned_server_profile) d.offProfile += 1;
      else d.spares += 1;
      if (b.assigned_server_profile) d.assigned += 1;

      // Donut bucket: Vantage hardware state + the host's vCenter rollup
      // (profile name ≙ ESXi host short name). Reasons feed the popup.
      const vc = vcHealth?.[(b.assigned_server_profile || '').toLowerCase()];
      if (vcHealth && b.assigned_server_profile && !vc) d.outsideVc += 1;
      const vcDisconnected = vc?.conn && vc.conn !== 'connected';
      const reasons = [];
      if (degraded) reasons.push(`Vantage hardware state: ${b.oper_state}`);
      if (vcDisconnected) reasons.push(`vCenter connection: ${vc.conn}`);
      if (vc?.overall === 'red') reasons.push('vCenter overall status red — active alarms');
      if (degraded || vcDisconnected || vc?.overall === 'red') {
        d.hCritical += 1;
        issues.push({ dc: dcName, severity: 'Critical', name: b.assigned_server_profile || b.name, blade: b.name, reasons });
      } else if (vc?.overall === 'yellow' || vc?.mm || (!isOn(b) && b.assigned_server_profile)) {
        if (vc?.overall === 'yellow') reasons.push('vCenter overall status yellow — alarm or configuration issue');
        if (vc?.mm) reasons.push('In maintenance mode');
        if (!isOn(b) && b.assigned_server_profile) reasons.push('Powered off with a profile assigned');
        d.hWarning += 1;
        issues.push({ dc: dcName, severity: 'Warning', name: b.assigned_server_profile || b.name, blade: b.name, reasons });
      } else if (isOn(b)) d.hHealthy += 1;
      else d.hStandby += 1;
    }
    for (const c of chassis) {
      const dcName = classifyDC(c.name) || 'SITE1';
      const d = get(dcName);
      d.chassis += 1;
      if (!c.oper_state || c.oper_state.toUpperCase() === 'OK') d.chassisOk += 1;
      else {
        issues.push({
          dc: dcName, severity: 'Critical', name: c.name, chassis: true,
          reasons: [`Chassis oper state: ${c.oper_state}`],
        });
      }
      d.slotsTotal += c.total_slots || 0;
      d.slotsUsed += c.used_slots || 0;
    }
    for (const dom of domains) {
      const d = get(classifyDC(dom.name) || 'SITE1');
      d.fis += dom.fi_count || 0;
      d.portsUp += dom.ports_up || 0;
      d.portsDown += dom.ports_down || 0;
    }
    for (const p of profiles) {
      if (!p.assigned_server) get(classifyDC(p.name) || 'SITE1').unassigned += 1;
    }

    // SITE1 leads everywhere (KPI splits, donuts, table columns) per the design.
    const dcs = Object.keys(byDC).sort((a, b) =>
      a === 'SITE1' ? -1 : b === 'SITE1' ? 1 : a.localeCompare(b));
    return { byDC, dcs, issues };
  }, [blades, chassis, domains, profiles, vcHealth]);

  const { byDC, dcs: allDcs, issues } = agg;
  const dcs = dcFilter === 'all' ? allDcs : allDcs.filter(dc => dc === dcFilter);
  const vcDcs = !vcSummary ? [] : (dcFilter === 'all' ? vcSummary.dcs : vcSummary.dcs.filter(dc => dc === dcFilter));

  // Same view filter applied to the raw Details-section lists, so the
  // collapsed drill-down (domains/chassis/FIs) stays consistent with the
  // KPIs/donuts/tables above instead of always showing both datacenters.
  const filteredDomains = dcFilter === 'all' ? domains : domains.filter(d => classifyDC(d.name) === dcFilter);
  const filteredChassis = dcFilter === 'all' ? chassis : chassis.filter(c => classifyDC(c.name) === dcFilter);
  const filteredChassisMoids = new Set(filteredChassis.map(c => c.moid));
  const filteredBlades = dcFilter === 'all' ? blades : blades.filter(b => filteredChassisMoids.has(b.chassis_moid));
  const filteredFis = dcFilter === 'all' ? fis : fis.filter(fi => classifyDC(fi.domain_name) === dcFilter);

  const sum = key => dcs.reduce((a, dc) => a + (byDC[dc][key] || 0), 0);
  // When a single DC is selected, totals should reflect just that DC instead
  // of the grand total — the per-DC split label only makes sense when both
  // datacenters are being shown side by side.
  const scoped = (allValue, keyOrFn) => {
    if (dcFilter === 'all') return allValue;
    return typeof keyOrFn === 'function'
      ? dcs.reduce((a, dc) => a + keyOrFn(byDC[dc]), 0)
      : sum(keyOrFn);
  };
  // Per-DC KPI sub-split, each half in its datacenter's accent color.
  const dcSplit = valueFor => (
    <span className="inline-flex items-center gap-3">
      {dcs.map(dc => (
        <span key={dc} className={`font-semibold tabular-nums ${DC_META[dc]?.text || ''}`}>
          {dc} {(valueFor(dc) ?? 0).toLocaleString()}
        </span>
      ))}
    </span>
  );
  const split = key => dcSplit(dc => byDC[dc][key]);

  const healthFor = dc => {
    const d = byDC[dc];
    if (!d) return [];
    return [
      { name: 'Healthy',  value: d.hHealthy },
      { name: 'Warning',  value: d.hWarning },
      { name: 'Critical', value: d.hCritical + (d.chassis - d.chassisOk) },
      { name: 'Standby',  value: d.hStandby },
    ];
  };

  const dcGens = s.datacenter_generations || {};
  const genNames = [...new Set(Object.values(dcGens).flatMap(g => Object.keys(g)))]
    .sort((a, b) => (dcGens.SITE1?.[b] || 0) + (dcGens.SITE2?.[b] || 0) - ((dcGens.SITE1?.[a] || 0) + (dcGens.SITE2?.[a] || 0)));

  return (
    <div className="space-y-8">
      <button
        onClick={() => setTopologyOpen(true)}
        className="topology-glow group w-full flex items-center justify-between gap-4 rounded-2xl px-6 py-4
          bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-cyan-500/15
          border border-cyan-400/30 hover:border-cyan-400/60
          transition-all hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 rounded-xl p-2.5 bg-cyan-500/20 text-cyan-600 dark:text-cyan-300">
            <Network className="h-5 w-5" />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              Vantage Topology <span>✨</span>
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
              See the live UCS fabric — cloud down to every chassis port
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-cyan-600 dark:text-cyan-300 flex-shrink-0 transition-transform group-hover:translate-x-1" />
      </button>
      {topologyOpen && <VantageTopologyModal onClose={() => setTopologyOpen(false)} />}

      <div className="flex items-stretch gap-3">
        <div className="flex-1 min-w-0"><DashboardSearch /></div>
        <Select value={dcFilter} onChange={setDcFilter} className="flex-shrink-0">
          <option value="all">Both Datacenters</option>
          <option value="SITE1">SITE1 Only</option>
          <option value="SITE2">SITE2 Only</option>
        </Select>
        <button
          onClick={() => setLookupOpen(true)}
          title="Bulk lookup — check if devices exist anywhere in the infrastructure"
          className="flex items-center gap-2 px-4 rounded-xl text-sm font-medium flex-shrink-0
            bg-white/70 dark:bg-white/[0.06] border border-slate-300/70 dark:border-white/[0.1]
            text-slate-700 dark:text-slate-200
            hover:border-blue-500/60 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
        >
          <ScanSearch className="h-4 w-4" />
          Bulk lookup
        </button>
      </div>
      {lookupOpen && <HardwareLookup onClose={() => setLookupOpen(false)} />}

      {/* KPI row — every total split by datacenter */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total blades" value={scoped(s.total_blades ?? blades.length, 'blades')}
          sub={dcFilter === 'all' ? split('blades') : undefined}
        />
        <KpiCard
          label="Chassis" value={scoped(s.total_chassis ?? chassis.length, 'chassis')}
          sub={dcFilter === 'all' ? split('chassis') : undefined}
        />
        <KpiCard
          label="Fabric interconnects" value={scoped(s.total_fis ?? fis.length, 'fis')}
          sub={dcFilter === 'all' ? split('fis') : undefined}
        />
        <KpiCard
          label="Server profiles"
          value={scoped(s.total_profiles ?? profiles.length, d => d.assigned + d.unassigned)}
          sub={dcFilter === 'all' ? dcSplit(dc => byDC[dc].assigned + byDC[dc].unassigned) : undefined}
        />
      </div>

      {/* Infrastructure health — one donut per datacenter */}
      <Card className="p-5">
        <CardHeader title="Infrastructure health" sub="Blade power, hardware state & vCenter health, by datacenter" />

        {/* Source: Vantage — physical UCS blades (spares included) */}
        <div className="mt-4 flex items-center gap-2">
          <Badge variant="info">Vantage</Badge>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">UCS blades</span>
          <span className="text-xs text-slate-500">— physical hardware, spares included</span>
        </div>
        <div className={`mt-3 grid grid-cols-1 gap-6 ${
          dcs.length > 1 ? 'md:grid-cols-2 md:divide-x divide-slate-200/60 dark:divide-white/[0.06]' : ''
        }`}>
          {dcs.map(dc => {
            const health = healthFor(dc);
            const total = health.reduce((a, h) => a + h.value, 0);
            return (
              <div
                key={dc}
                className={`flex items-center gap-6 md:px-6 first:md:pl-0 last:md:pr-0 ${dcs.length === 1 ? 'justify-center' : ''}`}
              >
                <div className="relative w-36 h-36 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={health.filter(h => h.value > 0)}
                        dataKey="value" nameKey="name"
                        innerRadius={46} outerRadius={64} strokeWidth={0}
                        startAngle={90} endAngle={-270}
                      >
                        {health.filter(h => h.value > 0).map(h => (
                          <Cell key={h.name} fill={HEALTH_COLORS[h.name]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">{total}</p>
                    <p className="text-[10px] text-slate-500">Blades</p>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-2"><DcLabel dc={dc} /></div>
                  <div className="space-y-1.5">
                    {health.map(h => {
                      const clickable = (h.name === 'Warning' || h.name === 'Critical') && h.value > 0;
                      return (
                        <div
                          key={h.name}
                          onClick={clickable ? () => setHealthModal({
                            title: `${h.name} — ${dc} blades`,
                            items: issues.filter(i => i.dc === dc && i.severity === h.name),
                          }) : undefined}
                          title={clickable ? `See what's causing ${h.name.toLowerCase()} in ${dc}` : undefined}
                          className={`flex items-center gap-2 rounded-md px-1 -mx-1 transition-colors
                            ${clickable ? 'cursor-pointer hover:bg-slate-100/60 dark:hover:bg-white/[0.05]' : ''}`}
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: HEALTH_COLORS[h.name] }} />
                          <span className="text-[13px] text-slate-600 dark:text-slate-300 flex-1">{h.name}</span>
                          <span className="text-[13px] font-semibold tabular-nums text-slate-900 dark:text-white">{h.value}</span>
                          <span className="text-xs text-slate-500 tabular-nums w-12 text-right">
                            {total ? ((h.value / total) * 100).toFixed(1) : 0}%
                          </span>
                          {clickable
                            ? <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            : <span className="w-3.5 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* All vCenter hosts — includes rack mounts the blade donuts can't see.
            While loading, show the section shell + spinner so users know this
            (and the donut refinement) is still on its way. */}
        {!vcSummary && (
          <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-white/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <span className="ui-badge inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium bg-cyan-500/10 border-cyan-500/25 text-cyan-600 dark:text-cyan-400">
                vCenter
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">ESXi hosts</span>
            </div>
            {vcState === 'error' ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                vCenter health unavailable right now — the donuts above show the Vantage-only view.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking vCenter host health (alarms, config issues, rack mounts)… the blade donuts
                above will refine once this loads.
              </p>
            )}
          </div>
        )}
        {vcSummary && (
          <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-white/[0.06]">
            {/* Source: vCenter — ESXi hosts only (a different population than
                the blades above: no spares, no non-ESXi blades, plus rack mounts) */}
            <div className="flex items-center gap-2 mb-3">
              <span className="ui-badge inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium bg-cyan-500/10 border-cyan-500/25 text-cyan-600 dark:text-cyan-400">
                vCenter
              </span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">ESXi hosts</span>
            </div>
            <div className={`grid grid-cols-1 gap-3 ${vcDcs.length > 1 ? 'md:grid-cols-2' : ''}`}>
              {vcDcs.map(dc => {
                const s = vcSummary.per[dc];
                const chip = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors';
                return (
                  <div key={dc} className={`flex items-center gap-2.5 flex-wrap ${vcDcs.length === 1 ? 'justify-center' : ''}`}>
                    <DcLabel dc={dc} />
                    <span className="text-xs text-slate-500 tabular-nums">{s.total} hosts</span>
                    <span className={`${chip} bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400`}>
                      {s.healthy} healthy
                    </span>
                    <button
                      disabled={!s.warning}
                      onClick={() => setHealthModal({
                        title: `Warning — ${dc} vCenter hosts`,
                        items: s.issues.filter(i => i.severity === 'Warning'),
                      })}
                      className={`${chip} bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400
                        ${s.warning ? 'cursor-pointer hover:bg-amber-500/20' : 'opacity-50 cursor-default'}`}
                    >
                      {s.warning} warning
                    </button>
                    <button
                      disabled={!s.alert}
                      onClick={() => setHealthModal({
                        title: `Alert — ${dc} vCenter hosts`,
                        items: s.issues.filter(i => i.severity === 'Alert'),
                      })}
                      className={`${chip} bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400
                        ${s.alert ? 'cursor-pointer hover:bg-red-500/20' : 'opacity-50 cursor-default'}`}
                    >
                      {s.alert} alert
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Why the two totals differ */}
            <p className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/[0.06] text-xs text-slate-500 leading-relaxed">
              Note: these are different populations, so the totals won't match. Vantage counts physical
              UCS blades — including spares and blades running outside these vCenters
              {dcs.some(dc => byDC[dc].outsideVc > 0) && (
                <>
                  {' '}(
                  {dcs.map((dc, i) => (
                    <span key={dc}>
                      {i > 0 && ' · '}
                      <span className={`font-medium ${DC_META[dc]?.text || ''}`}>{dc} {byDC[dc].outsideVc}</span>
                    </span>
                  ))}
                  {' '}on bare metal or other vCenters)
                </>
              )}
              . vCenter counts registered ESXi hosts only, rack mounts included.
            </p>
          </div>
        )}
      </Card>

      {healthModal && (
        <HealthIssuesModal
          title={healthModal.title}
          items={healthModal.items}
          onClose={() => setHealthModal(null)}
          onOpenDevice={openIssueDevice}
        />
      )}
      {healthDevice && (
        <DeviceDetailModal
          device={healthDevice.device}
          fis={healthDevice.fis}
          onClose={() => setHealthDevice(null)}
        />
      )}

      {/* Quick actions */}
      <div>
        <SectionLabel className="mb-3">Quick actions</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map(a => {
            const Icon = a.icon;
            return (
              <Link key={a.to} to={a.to}>
                <Card hover className={`p-4 h-full ${a.featured ? 'qa-featured' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`qa-tile p-2.5 rounded-lg flex-shrink-0 ${a.tile}`}>
                      <Icon className={`h-4 w-4 ${a.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{a.label}</p>
                      <p className="qa-desc text-xs text-slate-500 truncate">{a.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 ml-auto flex-shrink-0" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Inventory summaries — SITE1 / SITE2 columns in every card */}
      <div>
        <SectionLabel className="mb-3">Inventory summary</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="p-5">
            <p className="micro-label text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Blade servers</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {scoped(s.total_blades ?? blades.length, 'blades')}
            </p>
            <DcTable
              dcs={dcs}
              rows={[
                { label: 'Blades', values: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].blades])) },
                {
                  label: 'Powered on',
                  values: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].on])),
                  tone: Object.fromEntries(dcs.map(dc => [dc, 'positive'])),
                },
                {
                  label: 'Off with profile',
                  values: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].offProfile])),
                  tone: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].offProfile > 0 ? 'warning' : undefined])),
                },
                { label: 'Spares', values: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].spares])) },
                ...genNames.map(g => ({
                  label: g,
                  values: Object.fromEntries(dcs.map(dc => [dc, dcGens[dc]?.[g] ?? 0])),
                })),
              ]}
            />
          </Card>

          <Card className="p-5">
            <p className="micro-label text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Chassis</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {scoped(s.total_chassis ?? chassis.length, 'chassis')}
            </p>
            <DcTable
              dcs={dcs}
              rows={[
                { label: 'Chassis', values: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].chassis])) },
                {
                  label: 'Healthy',
                  values: Object.fromEntries(dcs.map(dc => [dc, `${byDC[dc].chassisOk}/${byDC[dc].chassis}`])),
                  tone: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].chassisOk === byDC[dc].chassis ? 'positive' : 'warning'])),
                },
                { label: 'Slots used', values: Object.fromEntries(dcs.map(dc => [dc, `${byDC[dc].slotsUsed}/${byDC[dc].slotsTotal}`])) },
                { label: 'Slots free', values: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].slotsTotal - byDC[dc].slotsUsed])) },
              ]}
            />
            <div className="mt-3 space-y-2">
              {dcs.map(dc => (
                <div key={dc}>
                  <div className="flex items-center justify-between mb-1">
                    <DcLabel dc={dc} />
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      {byDC[dc].slotsTotal ? Math.round((byDC[dc].slotsUsed / byDC[dc].slotsTotal) * 100) : 0}% used
                    </span>
                  </div>
                  <CapacityBar
                    pct={byDC[dc].slotsTotal ? (byDC[dc].slotsUsed / byDC[dc].slotsTotal) * 100 : 0}
                    tone={dc === 'SITE2' ? 'bg-violet-500' : 'bg-sky-500'}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="micro-label text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Fabric interconnects</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {scoped(s.total_fis ?? fis.length, 'fis')}
            </p>
            <DcTable
              dcs={dcs}
              rows={[
                { label: 'FIs', values: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].fis])) },
                {
                  label: 'UCS domains',
                  values: Object.fromEntries(dcs.map(dc => [dc, domains.filter(d => classifyDC(d.name) === dc).length])),
                },
                {
                  label: 'Ports up',
                  values: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].portsUp])),
                  tone: Object.fromEntries(dcs.map(dc => [dc, 'positive'])),
                },
                {
                  label: 'Ports down',
                  values: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].portsDown])),
                  tone: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].portsDown > 0 ? 'warning' : undefined])),
                },
              ]}
            />
          </Card>

          <Card className="p-5">
            <p className="micro-label text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Server profiles</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {scoped(s.total_profiles ?? profiles.length, d => d.assigned + d.unassigned)}
            </p>
            <DcTable
              dcs={dcs}
              rows={[
                {
                  label: 'Assigned',
                  values: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].assigned])),
                  tone: Object.fromEntries(dcs.map(dc => [dc, 'positive'])),
                },
                {
                  label: 'Unassigned',
                  values: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].unassigned])),
                  tone: Object.fromEntries(dcs.map(dc => [dc, byDC[dc].unassigned > 0 ? 'warning' : undefined])),
                },
              ]}
            />
            <div className="mt-3 space-y-2">
              {dcs.map(dc => {
                const total = byDC[dc].assigned + byDC[dc].unassigned;
                return (
                  <div key={dc}>
                    <div className="flex items-center justify-between mb-1">
                      <DcLabel dc={dc} />
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {total ? Math.round((byDC[dc].assigned / total) * 100) : 0}% associated
                      </span>
                    </div>
                    <CapacityBar
                      pct={total ? (byDC[dc].assigned / total) * 100 : 0}
                      tone={dc === 'SITE2' ? 'bg-violet-500' : 'bg-sky-500'}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Detailed inventory — everything from the previous dashboard, on demand */}
      <div>
        <SectionLabel className="mb-3">Details</SectionLabel>
        <Card className="overflow-hidden divide-y divide-slate-200/60 dark:divide-white/[0.06]">
          <DetailSection
            title="Domain Overview" count={filteredDomains.length}
            expanded={!!expanded.domains} onToggle={() => toggle('domains')}
          >
            <DomainWidgets domains={filteredDomains} />
          </DetailSection>
          <DetailSection
            title="Chassis" count={filteredChassis.length}
            expanded={!!expanded.chassis} onToggle={() => toggle('chassis')}
          >
            <ChassisSection chassis={filteredChassis} blades={filteredBlades} />
          </DetailSection>
          <DetailSection
            title="Fabric Interconnects" count={filteredFis.length}
            expanded={!!expanded.fis} onToggle={() => toggle('fis')}
          >
            <FabricInterconnectSection fabricInterconnects={filteredFis} />
          </DetailSection>
        </Card>
      </div>
    </div>
  );
}

export default DashboardPage;
