import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Cpu, CheckCircle, AlertTriangle, XCircle, ExternalLink, RefreshCw, Bug, X, Download } from 'lucide-react';
import { fetchBladeFirmware, fetchBladeFirmwareExport } from '../api';

const CHART_COLORS = ['#818CF8', '#2DD4BF', '#F472B6', '#F87171', '#A3E635', '#60A5FA', '#FBBF24'];
const GAP = 3;

function DonutChart({ groups, total }) {
  const r = 52, cx = 72, cy = 72;
  const circ = 2 * Math.PI * r;
  const gapLen = (GAP / 360) * circ;

  const top = groups.slice(0, 4);
  const otherCount = groups.slice(4).reduce((s, g) => s + g.count, 0);
  const items = [
    ...top.map((g, i) => ({ label: g.version, count: g.count, color: CHART_COLORS[i] })),
    ...(otherCount > 0 ? [{ label: 'Other', count: otherCount, color: CHART_COLORS[4] }] : []),
  ];

  let cursor = 0;
  const segments = items.map(item => {
    const full = (item.count / total) * circ;
    const draw = Math.max(0, full - gapLen);
    const seg = { ...item, draw, offset: cursor };
    cursor += full;
    return seg;
  });

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg width="144" height="144" viewBox="0 0 144 144">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="20" />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="20"
              strokeLinecap="butt"
              strokeDasharray={`${seg.draw} ${circ}`}
              strokeDashoffset={-seg.offset}
              style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-slate-900 dark:text-white leading-none">{total}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">blades</span>
        </div>
      </div>

      <div className="space-y-1.5 min-w-0 flex-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-slate-700 dark:text-slate-300 font-mono text-xs truncate flex-1">{seg.label}</span>
            <span className="text-slate-900 dark:text-white font-semibold text-sm shrink-0">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  Active: {
    icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    badge: 'bg-green-500/20 text-green-400 border border-green-500/30',
    dot: 'bg-green-400',
  },
  'EOL Announced': {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    dot: 'bg-amber-400',
  },
  'Out of Support': {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    badge: 'bg-red-500/20 text-red-400 border border-red-500/30',
    dot: 'bg-red-400',
  },
  Unknown: {
    icon: AlertTriangle,
    color: 'text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/20',
    badge: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
    dot: 'bg-slate-400',
  },
};

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* Popup: the matched bugs for one firmware version + the upgrade target
   that clears them. */
function KnownBugsModal({ group, onClose }) {
  const bugs = group.known_bugs || [];
  const openCount = bugs.filter(b => b.status === 'open').length;
  const fixedCount = bugs.length - openCount;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-w-2xl mx-auto rounded-2xl border border-slate-200/80 dark:border-white/[0.1] bg-white/95 dark:bg-slate-900/95 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200/70 dark:border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/15">
              <Bug className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Known bugs — <span className="font-mono">{group.version}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {bugs.length} matched from the Cisco IMM release notes · {group.count} blade{group.count !== 1 ? 's' : ''} on this version
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

        {/* Recommended upgrade */}
        {group.recommended_version ? (
          <div className="mx-5 mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Recommended upgrade: <span className="font-mono">{group.recommended_version}</span> or newer
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Earliest bundle at or above every listed fix — clears all {fixedCount} bug{fixedCount !== 1 ? 's' : ''} with a
              documented fix{openCount > 0 ? `; ${openCount} open bug${openCount !== 1 ? 's have' : ' has'} no fix listed yet` : ''}.
            </p>
          </div>
        ) : bugs.length > 0 && (
          <div className="mx-5 mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
            No fix releases are listed for these bugs yet — watch the release notes for updates.
          </div>
        )}

        {/* Bugs */}
        <div className="p-5 space-y-1.5 max-h-[55vh] overflow-y-auto">
          {bugs.map((b, i) => (
            <div key={`${b.id}-${i}`} className="rounded-lg bg-slate-100/60 dark:bg-white/5 px-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                {b.url ? (
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    {b.id}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">{b.id}</span>
                )}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${b.status === 'open'
                  ? 'bg-red-500/15 text-red-500 dark:text-red-400 border-red-500/30'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'}`}
                >
                  {b.status === 'open' ? 'OPEN' : 'FIXED IN LATER RELEASE'}
                </span>
                {b.resolved_in && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">fix: {b.resolved_in}</span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{b.description}</p>
            </div>
          ))}
        </div>

        <p className="px-5 pb-4 text-[11px] text-slate-500 dark:text-slate-400 italic">
          Matched by version window and hardware series from release-notes HTML — verify each bug ID in
          Cisco Bug Search before planning remediation.
        </p>
      </div>
    </div>,
    document.body,
  );
}

function FirmwareGroup({ group, onExport, exporting }) {
  const [bugsOpen, setBugsOpen] = useState(false);
  const cfg = STATUS_CONFIG[group.support_status] || STATUS_CONFIG.Unknown;
  const eol = group.eol_info || {};
  const bugCount = (group.known_bugs || []).length;

  return (
    <div className={`rounded-xl border ${cfg.bg} overflow-hidden`}>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
          <span className="font-mono font-semibold text-slate-900 dark:text-white text-sm">
            {group.version}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
            {group.status_label}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {group.count} blade{group.count !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {bugCount > 0 && (
            <button
              onClick={() => setBugsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400
                hover:bg-amber-500/25 transition-colors"
            >
              <Bug className="h-3.5 w-3.5" />
              {bugCount} known bug{bugCount !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={onExport}
            disabled={exporting}
            title={`Export ${group.version} blades (cluster / domain / profile / firmware) as CSV`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
              text-slate-500 dark:text-slate-400 border border-slate-300/50 dark:border-white/[0.1]
              hover:bg-white/20 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-slate-200
              disabled:opacity-50 transition-colors"
          >
            {exporting
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />}
            CSV
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
          {/* EOL details row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {eol.eol_announcement && (
              <div className="bg-white/10 dark:bg-white/5 rounded-lg px-3 py-2">
                <div className="text-slate-500 dark:text-slate-400 mb-0.5">EOL Announced</div>
                <div className="font-medium text-slate-800 dark:text-slate-200">
                  {formatDate(eol.eol_announcement)}
                </div>
              </div>
            )}
            {eol.end_sw_maintenance && (
              <div className="bg-white/10 dark:bg-white/5 rounded-lg px-3 py-2">
                <div className="text-slate-500 dark:text-slate-400 mb-0.5">End SW Maintenance</div>
                <div className="font-medium text-slate-800 dark:text-slate-200">
                  {formatDate(eol.end_sw_maintenance)}
                </div>
              </div>
            )}
            {eol.last_date_of_support && (
              <div className="bg-white/10 dark:bg-white/5 rounded-lg px-3 py-2">
                <div className="text-slate-500 dark:text-slate-400 mb-0.5">Last Date of Support</div>
                <div className={`font-semibold ${cfg.color}`}>
                  {formatDate(eol.last_date_of_support)}
                </div>
              </div>
            )}
            {!eol.eol_announcement && !eol.end_sw_maintenance && !eol.last_date_of_support && (
              <div className="col-span-3 text-green-400 font-medium">
                ✓ No EOL announced — currently in full support
              </div>
            )}
          </div>

          {/* Note */}
          {eol.note && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">{eol.note}</p>
          )}

          {/* Model breakdown */}
          {Object.keys(group.model_counts || {}).length > 0 && (
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium uppercase tracking-wider">
                Models on this version
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(group.model_counts).map(([model, count]) => (
                  <span
                    key={model}
                    className="px-2.5 py-1 bg-white/20 dark:bg-white/10 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {model} <span className="text-slate-500">×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Source link */}
          {eol.source && (
            <a
              href={eol.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Cisco EOL bulletin
            </a>
          )}
      </div>

      {bugsOpen && <KnownBugsModal group={group} onClose={() => setBugsOpen(false)} />}
    </div>
  );
}

const csvEscape = v => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/* Cluster-sectioned CSV (blank line between vCenter clusters). */
function buildClusterCsv(rows) {
  const lines = ['vCenter Cluster,Intersight Domain,Server Profile,Current Firmware'];
  let prevCluster = null;
  for (const r of rows) {
    if (prevCluster !== null && r.cluster !== prevCluster) lines.push('');
    prevCluster = r.cluster;
    lines.push([r.cluster, r.domain, r.profile, r.firmware].map(csvEscape).join(','));
  }
  return lines.join('\n');
}

function downloadCsv(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function BladeFirmwarePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportingVersion, setExportingVersion] = useState(null);
  const exportRowsRef = useRef(null); // fetched once, shared by all export buttons

  const getExportRows = async () => {
    if (!exportRowsRef.current) {
      const { rows } = await fetchBladeFirmwareExport();
      exportRowsRef.current = rows;
    }
    return exportRowsRef.current;
  };

  const today = () => new Date().toISOString().slice(0, 10);

  // Full fleet: cluster / domain / profile / firmware, sectioned by cluster.
  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadCsv(`blade_firmware_by_cluster_${today()}.csv`, buildClusterCsv(await getExportRows()));
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  // Same format, filtered to a single firmware version.
  const exportVersionCsv = async version => {
    setExportingVersion(version);
    try {
      const rows = (await getExportRows()).filter(r => r.firmware === version);
      const safe = version.replace(/[^\w.-]+/g, '_');
      downloadCsv(`blade_firmware_${safe}_${today()}.csv`, buildClusterCsv(rows));
    } catch (e) {
      setError(e.message);
    } finally {
      setExportingVersion(null);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    exportRowsRef.current = null; // refresh invalidates cached export rows
    try {
      const result = await fetchBladeFirmware();
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/10 p-2 rounded-lg">
              <Cpu className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Blade Firmware Standardization
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {data
                  ? `${data.total_blades} blades · ${data.firmware_groups?.length || 0} distinct version${data.firmware_groups?.length !== 1 ? 's' : ''} · EOL & bug data: Cisco bulletins + IMM release notes`
                  : 'Loading firmware data from Intersight…'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data?.is_standardized && (
              <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-green-500/15 border border-green-500/25 rounded-full text-xs font-medium text-green-400">
                <CheckCircle className="h-3 w-3" />
                Standardized
              </span>
            )}
            <button
              onClick={exportCsv}
              disabled={exporting || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-300/60 dark:border-white/[0.12] hover:bg-white/20 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
              title="Export cluster / domain / profile / firmware as CSV, grouped by vCenter cluster"
            >
              {exporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/20 dark:hover:bg-white/10 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {loading && !data && (
          <div className="flex items-center gap-3 py-4 text-slate-500 dark:text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Fetching firmware data from Intersight…</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {data && !error && (
          <>
            {data.firmware_groups?.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                No firmware data available. Ensure blades are managed in Intersight.
              </div>
            ) : (
              <>
                <DonutChart groups={data.firmware_groups} total={data.total_blades} />
                <div className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
                  <span className="shrink-0 mt-0.5">ℹ</span>
                  <span>Servers built into production are automatically upgraded to <span className="font-mono font-semibold">5.2(2.240053)</span> via the attached firmware policy.</span>
                </div>
                <div className="border-t border-white/10 dark:border-white/5 my-5" />
                <div className="space-y-3">
                  {data.firmware_groups.map(group => (
                    <FirmwareGroup
                      key={group.version}
                      group={group}
                      onExport={() => exportVersionCsv(group.version)}
                      exporting={exportingVersion === group.version}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default BladeFirmwarePanel;
