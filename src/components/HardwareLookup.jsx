import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ScanSearch, X, Search, Loader2, Trash2, Download, FileText, Copy, Check,
  CheckCircle, XCircle, Maximize2, Minimize2, ServerOff, Package,
} from 'lucide-react';
import { Card, Badge } from './ui';
import { dcTextClass } from '../dcColors';
import mockFetch from '../mockFetch';

const COLUMNS = ['Query', 'Type', 'Name', 'Serial', 'Model', 'Location', 'Status', 'Assignment'];

/* Compact type labels so the table fits without horizontal scrolling
   (exports keep the full names). */
const TYPE_SHORT = {
  'Blade Server': 'Blade',
  'Fabric Interconnect': 'FI',
  'Network Switch': 'Switch',
  'ESXi Host': 'ESXi',
  Chassis: 'Chassis',
};

/** Flatten API results into one exportable row per match (or per miss). */
function toRows(results) {
  const rows = [];
  for (const r of results) {
    if (!r.found) {
      rows.push({ query: r.query ?? r.serial, found: false });
      continue;
    }
    for (const m of r.matches || []) {
      rows.push({
        query: r.query ?? r.serial,
        found: true,
        type: m.type,
        name: m.name,
        serial: m.serial,
        model: m.model,
        location: m.location,
        detail: m.status,          // underlying oper/power state, shown as tooltip
        inUse: !!m.in_use,         // blades: has a server profile; other gear: deployed
        assignment: m.profile || '—',
        source: m.source || null,  // 'Spare inventory' | 'Decommissioned' | 'vCenter' | null
      });
    }
  }
  return rows;
}

/* Results are split by where the match came from — a live blade, a shelf spare and
   a decommissioned identity mean very different things, and reading them off one
   undifferentiated table invites treating a stale record as installed hardware. */
const GROUPS = [
  {
    key: 'live',
    title: 'In Intersight',
    hint: 'live hardware Intersight is managing',
    match: r => !r.source || r.source === 'vCenter',
    tone: 'emerald',
    icon: CheckCircle,
  },
  {
    key: 'decommissioned',
    title: 'Decommissioned',
    hint: 'removed from a UCS domain — not managed, may still be racked',
    match: r => r.source === 'Decommissioned',
    tone: 'amber',
    icon: ServerOff,
  },
  {
    key: 'spare',
    title: 'Spare inventory',
    hint: 'tracked by hand on the Inventory page, never seen by Intersight',
    match: r => r.source === 'Spare inventory',
    tone: 'blue',
    icon: Package,
  },
];

const TONE = {
  emerald: { icon: 'text-emerald-500 dark:text-emerald-400', border: 'border-slate-200/70 dark:border-white/[0.08]', head: 'bg-slate-50/60 dark:bg-white/[0.03]' },
  amber:   { icon: 'text-amber-500', border: 'border-amber-500/25', head: 'bg-amber-500/[0.06]' },
  blue:    { icon: 'text-blue-500 dark:text-blue-400', border: 'border-blue-500/25', head: 'bg-blue-500/[0.06]' },
};

function rowCells(row) {
  return [
    row.query,
    row.found ? row.type || '' : 'NOT FOUND',
    row.name || '',
    row.serial || '',
    row.model || '',
    row.location || '',
    row.found ? (row.inUse ? 'In use' : 'Not in use') : '',
    row.assignment || '',
  ];
}

/** One results box: titled header + the shared results table. */
function ResultGroup({ group, rows, expanded }) {
  const tone = TONE[group.tone];
  const Icon = group.icon;
  return (
    <div className={`rounded-xl border ${tone.border} overflow-hidden
      ${expanded ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
      <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${tone.border} ${tone.head} flex-shrink-0`}>
        <Icon className={`h-4 w-4 ${tone.icon}`} />
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {group.title} ({rows.length})
        </p>
        <p className="text-xs text-slate-500">{group.hint}</p>
      </div>
      <div className={`${expanded ? 'flex-1 min-h-0' : 'max-h-[38vh]'} overflow-y-auto overflow-x-hidden`}>
        {/* table-fixed + wrapping cells: everything fits the modal width,
            only vertical scrolling. */}
        <table className="w-full table-fixed text-sm">
          <thead className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur">
            <tr className="text-left">
              {[
                ['Query', 'w-[13%]'],
                ['Device', 'w-[22%]'],
                ['Type', 'w-[8%]'],
                ['Model', 'w-[14%]'],
                ['Location', 'w-[19%]'],
                ['Status', 'w-[9%]'],
                ['Assignment', 'w-[15%]'],
              ].map(([c, w]) => (
                <th key={c} className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${w}`}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300 break-all">{r.query}</td>
                <td className="px-3 py-2">
                  <p className={`font-medium break-words ${dcTextClass(r.name) || 'text-slate-800 dark:text-slate-100'}`}>{r.name || '—'}</p>
                  {r.serial && <p className="font-mono text-[11px] text-slate-500 break-all">{r.serial}</p>}
                </td>
                <td className="px-3 py-2 text-slate-500" title={r.type}>{TYPE_SHORT[r.type] || r.type}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300 break-words">{r.model || '—'}</td>
                <td className={`px-3 py-2 break-words ${dcTextClass(r.location) || 'text-slate-500'}`}>{r.location || '—'}</td>
                <td className="px-3 py-2">
                  <span title={r.detail || undefined}>
                    <Badge dot variant={r.inUse ? 'success' : 'warning'}>
                      {r.inUse ? 'In use' : 'Not in use'}
                    </Badge>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-slate-600 dark:text-slate-300 break-words">{r.assignment}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const csvEscape = v => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Bulk hardware lookup popup — paste serials, names, models or profiles and
 * check whether the devices exist anywhere in the infrastructure, including
 * unused spare blades. Results export as CSV / PDF or copy to clipboard.
 */
export default function HardwareLookup({ onClose }) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const runLookup = async () => {
    const queries = input.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    if (queries.length === 0) {
      setError('Enter at least one serial, name, or model.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await mockFetch('/api/serial-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial_numbers: queries }),
      });
      if (!resp.ok) throw new Error(`Lookup failed (${resp.status})`);
      setResults(await resp.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const rows = results ? toRows(results.results || []) : [];
  const foundRows = rows.filter(r => r.found);
  const missingRows = rows.filter(r => !r.found);
  // Each group's rows, in the order the boxes render. Empty groups drop out.
  const grouped = GROUPS
    .map(g => ({ group: g, rows: foundRows.filter(g.match) }))
    .filter(({ rows: groupRows }) => groupRows.length > 0);
  // Exports mirror the on-screen order: misses first, then each group in turn.
  const orderedRows = [...missingRows, ...grouped.flatMap(({ rows: groupRows }) => groupRows)];

  const exportCSV = () => {
    const csv = [COLUMNS, ...orderedRows.map(rowCells)]
      .map(cells => cells.map(csvEscape).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `hardware_lookup_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyResults = async () => {
    const tsv = [COLUMNS, ...orderedRows.map(rowCells)].map(cells => cells.join('\t')).join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Clipboard unavailable — use CSV export instead.');
    }
  };

  // Dependency-free "PDF": print-styled document → browser's Save as PDF.
  const exportPDF = () => {
    const w = window.open('', '_blank');
    if (!w) { setError('Popup blocked — allow popups to export PDF.'); return; }
    const th = COLUMNS.map(c => `<th>${c}</th>`).join('');
    const trs = orderedRows.map(r =>
      `<tr${r.found ? '' : ' class="miss"'}>${rowCells(r).map(c =>
        `<td>${String(c).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</td>`).join('')}</tr>`
    ).join('');
    w.document.write(`<!doctype html><html><head><title>Hardware lookup — ${new Date().toLocaleString()}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #0f172a; padding: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; } p { color: #475569; font-size: 12px; margin: 0 0 16px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; text-align: left; }
  th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; }
  tr.miss td { color: #b91c1c; }
</style></head><body>
<h1>Hardware lookup results</h1>
<p>${results?.summary?.found ?? 0} found · ${results?.summary?.not_found ?? 0} not found · generated ${new Date().toLocaleString()}</p>
<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
<script>window.onload = () => window.print();</script></body></html>`);
    w.document.close();
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm
        ${expanded ? 'overflow-hidden' : 'overflow-y-auto p-4 sm:p-8'}`}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Expanded: pin to the window edges so it always fills the viewport. */}
      <Card
        className={`bg-white/95 dark:bg-slate-900/95 overflow-hidden flex flex-col
          ${expanded ? 'absolute inset-2 sm:inset-4 max-w-none' : 'relative w-full max-w-6xl mx-auto'}`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-200/70 dark:border-white/[0.07] bg-white/95 dark:bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/15">
              <ScanSearch className="h-5 w-5 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Hardware lookup</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Paste serials, names, models, or profiles — checks Intersight, spare inventory and decommissioned records, with vCenter as fallback.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(x => !x)}
              title={expanded ? 'Restore size' : 'Expand to fill the window'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
            >
              {expanded ? <Minimize2 className="h-[18px] w-[18px]" /> : <Maximize2 className="h-[18px] w-[18px]" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className={`p-6 space-y-5 ${expanded ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
          {/* Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Devices to look up <span className="font-normal normal-case">(one per line, or comma/semicolon separated)</span>
            </label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={'FCH12345ABC\nUCSX-210C-M7\nsite2chassis3'}
              rows={5}
              className="w-full px-4 py-3 rounded-xl font-mono text-sm bg-white/70 dark:bg-white/[0.06]
                border border-slate-300/70 dark:border-white/[0.1] text-slate-900 dark:text-white
                placeholder-slate-400 dark:placeholder-slate-500 resize-y
                focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/15 transition-colors"
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={runLookup}
                disabled={loading || !input.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? 'Searching…' : 'Look up'}
              </button>
              <button
                onClick={() => { setInput(''); setResults(null); setError(null); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 border border-slate-300/70 dark:border-white/[0.1] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Clear
              </button>
              {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
            </div>
          </div>

          {/* Results */}
          {results && (
            <div className={expanded ? 'flex-1 min-h-0 flex flex-col' : ''}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{results.summary.found}</span> found
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                    <span className="font-semibold text-red-500 dark:text-red-400">{results.summary.not_found}</span> not found
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={copyResults} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-300/70 dark:border-white/[0.1] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-300/70 dark:border-white/[0.1] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </button>
                  <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-300/70 dark:border-white/[0.1] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </button>
                </div>
              </div>

              {/* Not found — stacked on top */}
              {missingRows.length > 0 && (
                <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/[0.04] overflow-hidden flex-shrink-0">
                  <div className="px-4 py-2.5 flex items-center gap-2 border-b border-red-500/20 bg-red-500/[0.06]">
                    <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">Not found ({missingRows.length})</p>
                    <p className="text-xs text-slate-500">
                      no match in Intersight, spare inventory, decommissioned records or vCenter — likely not on hand
                    </p>
                  </div>
                  <div className="px-4 py-3 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                    {missingRows.map(m => (
                      <span key={m.query} className="font-mono text-xs px-2 py-1 rounded-md bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-300">
                        {m.query}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* One box per source — live, decommissioned, spares */}
              <div className={`space-y-4 ${expanded ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
                {grouped.map(({ group, rows: groupRows }) => (
                  <ResultGroup
                    key={group.key}
                    group={group}
                    rows={groupRows}
                    // Only let a box grow to fill the expanded modal when it's the
                    // only one on screen; otherwise they'd fight over the height.
                    expanded={expanded && grouped.length === 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>,
    document.body,
  );
}
