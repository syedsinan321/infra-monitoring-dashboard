import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Server, Network, Boxes, X, ArrowLeft, Stethoscope, LayoutGrid,
  AlertTriangle, CheckCircle2, RefreshCw,
} from 'lucide-react';
import mockFetch from '../mockFetch';

const API_BASE = import.meta.env.VITE_API_URL || '';

const norm = s => (s || '').toLowerCase().replace(/-/g, '');

function fmtMemory(mib) {
  if (!mib) return null;
  const gib = mib / 1024;
  return gib >= 1024 ? `${(gib / 1024).toFixed(1)} TiB` : `${Math.round(gib)} GiB`;
}

function fmtTime(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  return d.toLocaleString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const SEV_CHIP = {
  Critical: 'bg-red-500/15 border-red-500/30 text-red-400',
  Major:    'bg-orange-500/15 border-orange-500/30 text-orange-400',
  Warning:  'bg-amber-500/15 border-amber-500/30 text-amber-400',
  Info:     'bg-slate-500/15 border-slate-500/30 text-slate-400',
};

// vCenter triggered-alarm overallStatus values: red / yellow / green / gray
const VC_STATUS_DOT = {
  red:    'bg-red-400',
  yellow: 'bg-amber-400',
  green:  'bg-emerald-400',
  gray:   'bg-slate-400',
};

function Row({ label, value, mono = true }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between items-baseline gap-4 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-slate-500 dark:text-slate-400 flex-shrink-0">{label}</span>
      <span className={`text-sm text-slate-800 dark:text-slate-100 text-right break-words min-w-0 ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function PowerRow({ state }) {
  if (!state) return null;
  const on = state.toLowerCase() === 'on';
  return (
    <div className="flex justify-between items-center gap-4 py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-slate-500 dark:text-slate-400 flex-shrink-0">Power State</span>
      <span className="flex items-center gap-1.5 text-sm text-slate-800 dark:text-slate-100">
        <span className={`w-2 h-2 rounded-full ${on ? 'bg-green-400' : 'bg-red-400'}`} />
        {state.charAt(0).toUpperCase() + state.slice(1)}
      </span>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 dark:bg-white/[0.03] p-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-1.5 rounded-lg bg-blue-500/15">
          <Icon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
        </div>
        <h3 className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function GroupLabel({ children }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-3 mb-1.5 first:mt-1">
      {children}
    </p>
  );
}

function AllClear({ children }) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-emerald-500 dark:text-emerald-400 py-1">
      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
      {children}
    </p>
  );
}

/**
 * Live errors/alerts for the host: current Vantage alarms on the blade +
 * triggered vCenter alarms. Fetched when the card opens; fails soft per side.
 */
function AlertsSection({ device }) {
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setAlerts(null);
    setError(null);
    const name = device.profile || device.name;
    const hint = device.vc?.vcenter ? `&vcenter=${encodeURIComponent(device.vc.vcenter)}` : '';
    mockFetch(`${API_BASE}/api/diagnostics/host-alerts?host=${encodeURIComponent(name)}${hint}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (!cancelled) setAlerts(d); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [device]);

  return (
    <Section icon={AlertTriangle} title="Active Alerts">
      {!alerts && !error && (
        <p className="flex items-center gap-2 text-sm text-slate-500 py-2">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Checking Vantage & vCenter…
        </p>
      )}
      {error && (
        <p className="text-sm text-amber-500 dark:text-amber-400 py-2">Could not load alerts: {error}</p>
      )}
      {alerts && (
        <>
          <GroupLabel>Vantage</GroupLabel>
          {alerts.vantage_error ? (
            <p className="text-sm text-amber-500 dark:text-amber-400">Lookup failed: {alerts.vantage_error}</p>
          ) : alerts.vantage === null ? (
            <p className="text-sm text-slate-500">Not managed by Vantage.</p>
          ) : alerts.vantage.alarms.length === 0 ? (
            <AllClear>No active Vantage alarms</AllClear>
          ) : (
            <div className="space-y-2">
              {alerts.vantage.alarms.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                  <span className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${SEV_CHIP[a.severity] || SEV_CHIP.Info}`}>
                    {a.severity}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-100 break-words">
                      {a.code && <span className="font-mono text-xs text-slate-500 mr-1.5">{a.code}</span>}
                      {a.description}
                      {a.acknowledged && <span className="text-xs text-slate-500"> · acknowledged</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[fmtTime(a.created), a.affected_mo].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <GroupLabel>vCenter</GroupLabel>
          {alerts.vcenter_error ? (
            <p className="text-sm text-amber-500 dark:text-amber-400">Lookup failed: {alerts.vcenter_error}</p>
          ) : !alerts.vcenter?.found ? (
            <p className="text-sm text-slate-500">Host not found in vCenter.</p>
          ) : (
            <>
              {alerts.vcenter.in_maintenance && (
                <p className="text-sm text-amber-500 dark:text-amber-400 mb-1.5">Host is in maintenance mode.</p>
              )}
              {alerts.vcenter.config_issues?.length > 0 && (
                <div className="space-y-2 mb-2">
                  {alerts.vcenter.config_issues.map((msg, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                      <p className="text-sm text-slate-800 dark:text-slate-100 break-words">
                        {msg} <span className="text-xs text-slate-500">· configuration issue</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {alerts.vcenter.alarms.length === 0 ? (
                alerts.vcenter.config_issues?.length > 0 ? null : (
                  ['yellow', 'red'].includes(alerts.vcenter.overall_status) ? (
                    <p className="text-sm text-amber-500 dark:text-amber-400">
                      No triggered alarms, but vCenter reports overall status “{alerts.vcenter.overall_status}”
                      — check hardware sensors / Configuration Issues in vSphere.
                    </p>
                  ) : (
                    <AllClear>No triggered vCenter alarms</AllClear>
                  )
                )
              ) : (
                <div className="space-y-2">
                  {alerts.vcenter.alarms.map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${VC_STATUS_DOT[a.status] || VC_STATUS_DOT.gray}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800 dark:text-slate-100 break-words">
                          {a.name}
                          {a.acknowledged && <span className="text-xs text-slate-500"> · acknowledged</span>}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{fmtTime(a.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Section>
  );
}

/**
 * FI/Chassis alerts — unlike AlertsSection (hosts), the equipment list this
 * modal is opened from already carries live alarms, so this just renders
 * what was passed in rather than issuing its own fetch.
 */
function EquipmentAlertsSection({ alarms = [], counts = {} }) {
  return (
    <Section icon={AlertTriangle} title="Active Alerts">
      {alarms.length === 0 ? (
        <AllClear>No active alarms</AllClear>
      ) : (
        <>
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            {['Critical', 'Major', 'Warning', 'Info'].filter(s => counts[s] > 0).map(s => (
              <span key={s} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SEV_CHIP[s]}`}>
                {counts[s]} {s}
              </span>
            ))}
          </div>
          <div className="space-y-2">
            {alarms.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <span className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${SEV_CHIP[a.severity] || SEV_CHIP.Info}`}>
                  {a.severity}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-100 break-words">
                    {a.code && <span className="font-mono text-xs text-slate-500 mr-1.5">{a.code}</span>}
                    {a.description}
                    {a.acknowledged && <span className="text-xs text-slate-500"> · acknowledged</span>}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[fmtTime(a.created), a.affected_mo].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

/**
 * Device detail card — used by the global search bar and by clicking a
 * server name on the Host Diagnostics page. Portaled to <body> so ancestor
 * backdrop-filters can't trap the fixed overlay.
 */
function DeviceDetailModal({ device, fis = [], onClose, onBack, onOpenDiagnostics }) {
  function domainFis(domain) {
    if (!domain) return [];
    return fis
      .filter(f => norm(f.domain_name) === norm(domain))
      .sort((a, b) => (a.switch_id || '').localeCompare(b.switch_id || ''));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="liquid-glass rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 liquid-glass flex items-center justify-between px-5 py-4 border-b border-white/10 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-blue-500 flex-shrink-0">
              {device.type === 'fi'
                ? <Network className="h-5 w-5 text-white" />
                : device.type === 'chassis'
                ? <Boxes className="h-5 w-5 text-white" />
                : <Server className="h-5 w-5 text-white" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white break-all leading-tight">{device.name}</h2>
              <p className="text-sm text-slate-500">
                {device.type === 'fi' ? 'Fabric Interconnect'
                  : device.type === 'chassis' ? 'Chassis'
                  : device.vcenterOnly ? 'ESXi Host (vCenter only)' : 'ESXi Host / UCS Blade'}
                {device.model ? ` · ${device.model}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/10 flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {device.type === 'host' ? (
            <>
              <Section icon={Server} title="Compute">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                  <div>
                    <Row label="Server Profile" value={device.profile || '— (no profile)'} />
                    <Row label="Blade Name" value={device.vcenterOnly ? 'vCenter only — no Vantage blade' : device.blade} />
                    <Row label="Blade Serial" value={device.serial} />
                    <Row label="Model" value={device.model} />
                    <Row label="Chassis / Slot" value={device.chassis ? `Chassis ${device.chassis} · Slot ${device.slot}` : null} />
                  </div>
                  <div>
                    <Row label="CPUs" value={device.cpus ? `${device.cpus} sockets · ${device.cores} cores` : null} />
                    <Row label="Memory" value={fmtMemory(device.memory)} />
                    <PowerRow state={device.power} />
                    <Row label="Management IP" value={device.ip} />
                  </div>
                </div>
              </Section>

              <AlertsSection device={device} />

              {device.domain && (
                <Section icon={Network} title="UCS Domain">
                  <Row label="Domain" value={device.domain} />
                  {domainFis(device.domain).map(f => (
                    <Row
                      key={f.moid}
                      label={`FI-${f.switch_id}`}
                      value={`${f.display_name || f.name} · SN ${f.serial}${f.out_of_band_ip_address ? ` · ${f.out_of_band_ip_address}` : ''}`}
                    />
                  ))}
                </Section>
              )}

              <Section icon={LayoutGrid} title="vCenter">
                {device.vc ? (
                  <>
                    <Row label="Host" value={device.vc.host_name} />
                    <Row label="Cluster" value={device.vc.cluster} />
                    <Row label="Datacenter" value={device.vc.datacenter} />
                    <Row label="ESXi Version" value={device.vc.version ? `${device.vc.version} (build ${device.vc.build})` : null} />
                    <Row label="vCenter" value={device.vc.vcenter} />
                  </>
                ) : (
                  <p className="text-sm text-slate-500 py-2">Not found in vCenter{device.profile ? ` as “${device.profile}”` : ''}.</p>
                )}
              </Section>

              {(onBack || onOpenDiagnostics) && (
                <div className="flex flex-wrap justify-end gap-3 pt-1">
                  {onBack && (
                    <button
                      onClick={onBack}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/5 border border-white/10"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Results
                    </button>
                  )}
                  {onOpenDiagnostics && (
                    <button
                      onClick={onOpenDiagnostics}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-cyan-500 hover:bg-cyan-600 text-white"
                    >
                      <Stethoscope className="h-4 w-4" />
                      Open in Host Diagnostics
                    </button>
                  )}
                </div>
              )}
            </>
          ) : device.type === 'chassis' ? (
            <>
              <Section icon={Boxes} title="Chassis">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                  <div>
                    <Row label="Name" value={device.name} />
                    <Row label="UCS Domain" value={device.domain} />
                    <Row label="Chassis ID" value={device.chassisId} />
                    <Row label="Model" value={device.model} />
                  </div>
                  <div>
                    <Row label="Serial" value={device.serial} />
                    <Row label="Connection Status" value={device.connectionStatus || 'None'} mono={false} />
                    <Row label="Oper State" value={device.operState} mono={false} />
                    <Row label="Slots" value={device.totalSlots ? `${device.usedSlots} used / ${device.totalSlots} total` : null} />
                  </div>
                </div>
              </Section>
              <EquipmentAlertsSection alarms={device.alarms} counts={device.alarmCounts} />
              {onBack && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={onBack}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/5 border border-white/10"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Results
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <Section icon={Network} title="Fabric Interconnect">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                  <div>
                    <Row label="Name" value={device.name} />
                    <Row label="UCS Domain" value={device.domain} />
                    <Row label="Switch ID" value={device.switchId} />
                    <Row label="Model" value={device.model} />
                  </div>
                  <div>
                    <Row label="Serial" value={device.serial} />
                    <Row label="Out-of-Band IP" value={device.ip} />
                    <Row label="Evacuation State" value={device.evac} mono={false} />
                    <Row label="Ports" value={device.totalPorts ? `${device.usedPorts} used / ${device.totalPorts} total` : null} />
                  </div>
                </div>
              </Section>
              {device.alarms && <EquipmentAlertsSection alarms={device.alarms} counts={device.alarmCounts} />}
              {onBack && (
                <div className="flex justify-end pt-1">
                  <button
                    onClick={onBack}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-white/5 border border-white/10"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Results
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default DeviceDetailModal;
