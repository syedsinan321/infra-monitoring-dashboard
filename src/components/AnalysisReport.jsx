import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Bell, Calendar, Check, CheckCircle2, ChevronDown,
  ChevronUp, Clock, Copy, Download, FileText, Info, Server, XCircle,
} from 'lucide-react';

/*
 * AnalysisReport — enterprise incident-report layout:
 * header card → overview card (verdict + stat strip) → evidence timeline
 * (filterable, expandable) → recommended actions + references → footer.
 * Neutral dark grays; green/amber/red/blue reserved for status.
 */

const SEVERITY_META = {
  Critical: { icon: XCircle,        cls: 'text-red-400' },
  Major:    { icon: AlertTriangle,  cls: 'text-orange-400' },
  Warning:  { icon: AlertTriangle,  cls: 'text-amber-400' },
  Info:     { icon: Info,           cls: 'text-sky-400' },
};

const STATUS_DOT = {
  ok: 'bg-green-400',
  info: 'bg-sky-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
};

const SOURCE_CHIP = {
  'cisco-bug':   'text-violet-300 border-violet-500/40 bg-violet-500/10',
  'sel-obfl':    'text-green-300 border-green-500/40 bg-green-500/10',
  'dimm-health': 'text-green-300 border-green-500/40 bg-green-500/10',
  'sensors':     'text-sky-300 border-sky-500/40 bg-sky-500/10',
  'cimc':        'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
  'vcenter':     'text-blue-300 border-blue-500/40 bg-blue-500/10',
  'vmkernel':    'text-purple-300 border-purple-500/40 bg-purple-500/10',
  'other':       'text-slate-300 border-slate-500/40 bg-slate-500/10',
};

function Card({ className = '', children }) {
  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-200">
      {children}
    </h3>
  );
}

function fmtTime(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return {
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
  };
}

function Stat({ icon: Icon, iconCls, value, label, sub }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-center gap-3.5 px-5 py-4 min-w-0">
      <Icon className={`h-5 w-5 flex-shrink-0 ${iconCls}`} />
      <div className="min-w-0">
        <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
        <p className="text-[11px] text-slate-500 leading-snug">{label}</p>
        {sub && <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 leading-snug mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function TimelineRow({ item, isLast }) {
  const t = fmtTime(item.timestamp);
  const chip = SOURCE_CHIP[item.category] || SOURCE_CHIP.other;
  return (
    <div className="flex gap-4">
      {/* time column */}
      <div className="w-24 flex-shrink-0 text-right pt-0.5">
        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 font-mono">{t ? t.time : '—'}</p>
        {t && <p className="text-[11px] text-slate-500">{t.date}</p>}
      </div>
      {/* rail */}
      <div className="flex flex-col items-center flex-shrink-0">
        <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${STATUS_DOT[item.status] || STATUS_DOT.info}`} />
        {!isLast && <span className="w-px flex-1 bg-slate-200 dark:bg-white/10 my-1" />}
      </div>
      {/* content */}
      <div className={`min-w-0 flex-1 ${isLast ? 'pb-1' : 'pb-5'}`}>
        <div className="flex items-start gap-3 flex-wrap">
          <span className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-semibold flex-shrink-0 ${chip}`}>
            {item.source}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
              {item.title || item.detail}
            </p>
            {item.title && item.detail && (
              <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 max-w-[70ch]">
                {item.detail}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildSummaryText(analysis, host, meta) {
  const lines = [
    `# Host Diagnostics — ${host}`,
    '',
    meta.collectedAt ? `Collected: ${meta.collectedAt}` : null,
    `Window: ${meta.windowStart} → ${meta.windowEnd}`,
    `Severity: ${analysis.severity} · Confidence: ${analysis.confidence}${analysis.confidence_pct ? ` (${analysis.confidence_pct}%)` : ''}`,
    analysis.tac_bundle_used ? 'TAC bundle: analyzed' : null,
    '',
    '## Root Cause',
    analysis.root_cause || '',
    '',
    analysis.summary || '',
  ].filter(l => l !== null);
  if (analysis.key_findings?.length) {
    lines.push('', '## Key Findings', ...analysis.key_findings.map(k => `- ${k}`));
  }
  if (analysis.evidence?.length) {
    lines.push('', '## Timeline');
    for (const e of analysis.evidence) {
      lines.push(`- [${e.timestamp || '—'}] ${e.source}: ${e.title ? `${e.title} — ` : ''}${e.detail}`);
    }
  }
  if (analysis.reasoning?.length) {
    lines.push('', '## Why We Believe This', ...analysis.reasoning.map(r => `- ${r}`));
  }
  if (analysis.recommendations?.length) {
    lines.push('', '## Recommended Actions');
    for (const r of analysis.recommendations) {
      if (typeof r === 'object' && r !== null) {
        lines.push(`- [${r.priority}${r.duration && r.duration !== 'n/a' ? ` · ${r.duration}` : ''} · risk ${r.risk}] ${r.action} — ${r.note}`);
      } else {
        lines.push(`- ${r}`);
      }
    }
  }
  if (analysis.references?.length) {
    lines.push('', '## References', ...analysis.references.map(r => `- ${r}`));
  }
  return lines.join('\n');
}

export default function AnalysisReport({
  analysis, host, collectedAt, windowStart, windowEnd, sources,
  model, faultCount, usage, onOpenFull,
}) {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const meta = { collectedAt, windowStart, windowEnd };

  const sev = SEVERITY_META[analysis.severity] || SEVERITY_META.Info;
  const SevIcon = sev.icon;

  const timeline = useMemo(() => {
    const ev = [...(analysis.evidence || [])];
    ev.sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime() || Infinity;
      const tb = new Date(b.timestamp || 0).getTime() || Infinity;
      return ta - tb;
    });
    if (filter === 'errors') return ev.filter(e => e.status === 'warning' || e.status === 'critical');
    if (filter === 'key') return ev.filter(e => e.status !== 'info');
    return ev;
  }, [analysis.evidence, filter]);

  const visible = expanded ? timeline : timeline.slice(0, 6);
  const hasMore = timeline.length > 6;

  function copySummary() {
    navigator.clipboard.writeText(buildSummaryText(analysis, host, meta)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  function downloadSummary() {
    const blob = new Blob([buildSummaryText(analysis, host, meta)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${host}-analysis-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sourcesLabel = (sources || [])
    .map(s => (s === 'vantage' ? 'Vantage' : s === 'vcenter' ? 'vCenter' : s))
    .join(' + ');

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="p-3 rounded-xl bg-violet-500 flex-shrink-0">
          <Server className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight break-all">{host}</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {collectedAt && <>Collected: {collectedAt}</>}
            {collectedAt && sourcesLabel && <span className="mx-2">·</span>}
            {sourcesLabel}
            {usage && (
              <span className="ml-2 font-mono text-[11px]" title={`Model: ${usage.model}`}>
                · ${usage.cost?.toFixed(2)}
              </span>
            )}
          </p>
        </div>
        {windowStart && (
          <div className="flex items-start gap-3 flex-shrink-0">
            <Calendar className="h-5 w-5 text-slate-500 mt-0.5" />
            <div className="text-[13px] leading-snug">
              <p className="text-slate-500">Window</p>
              <p className="text-slate-800 dark:text-slate-200">{windowStart}</p>
              <p className="text-slate-800 dark:text-slate-200">– {windowEnd}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Overview card */}
      <Card className="p-6 space-y-5">
        <SectionLabel>Overview</SectionLabel>

        <div className="flex flex-wrap gap-6">
          <div className="min-w-0 flex-1 space-y-3" style={{ minWidth: '16rem' }}>
            <div className={`flex items-center gap-2 text-sm font-bold ${sev.cls}`}>
              <SevIcon className="h-4.5 w-4.5 h-5 w-5" />
              {analysis.severity}
            </div>
            <p className="text-xl font-bold leading-snug text-slate-900 dark:text-white max-w-[60ch]">
              {analysis.root_cause}
            </p>
            {analysis.summary && (
              <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400 max-w-[70ch]">
                {analysis.summary}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 rounded-xl border border-slate-200 dark:border-white/10 px-5 py-4 space-y-3 self-start">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Confidence: {analysis.confidence}
              {analysis.confidence_pct != null && (
                <span className="text-slate-500 font-normal"> · {analysis.confidence_pct}%</span>
              )}
            </p>
            {analysis.tac_bundle_used && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500/40 bg-green-500/10 text-green-400 text-[13px] font-semibold">
                <CheckCircle2 className="h-4 w-4" /> TAC bundle analyzed
              </span>
            )}
          </div>
        </div>

        {/* Stat strip */}
        {(model || analysis.alert_disposition || analysis.vm_downtime || analysis.incident_duration) && (
          <div className="rounded-xl border border-slate-200 dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-white/10">
            <Stat icon={Server} iconCls="text-violet-400" value="1" label="Server Affected" sub={model || host} />
            {analysis.alert_disposition && (
              <Stat icon={Bell} iconCls="text-amber-400"
                value={faultCount != null ? String(faultCount) : '1'}
                label={faultCount === 1 || faultCount == null ? 'Core Alert' : 'Alerts'}
                sub={analysis.alert_disposition} />
            )}
            {analysis.vm_downtime && (
              <Stat icon={Activity} iconCls="text-green-400" value={analysis.vm_downtime} label="Downtime" sub={analysis.impact} />
            )}
            {analysis.incident_duration && (
              <Stat icon={Clock} iconCls="text-sky-400" value={analysis.incident_duration} label="Duration" sub={analysis.recovery} />
            )}
          </div>
        )}
      </Card>

      {/* Evidence timeline card */}
      {(analysis.evidence?.length > 0) && (
        <Card className="p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionLabel>Evidence Timeline</SectionLabel>
            <div className="flex items-center gap-1.5">
              {[['all', 'All Events'], ['errors', 'Errors Only'], ['key', 'Key Events']].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors
                    ${filter === k
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            {visible.length === 0 && (
              <p className="text-sm text-slate-500 py-4 text-center">No events match this filter.</p>
            )}
            {visible.map((item, i) => (
              <TimelineRow key={i} item={item} isLast={i === visible.length - 1} />
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              {expanded ? <>Collapse Timeline <ChevronUp className="h-4 w-4" /></> : <>View Full Timeline <ChevronDown className="h-4 w-4" /></>}
            </button>
          )}
        </Card>
      )}

      {/* Recommended actions + references */}
      {(analysis.recommendations?.length > 0 || analysis.references?.length > 0) && (
        <Card className="p-6">
          <div className="flex flex-wrap gap-8">
            <div className="min-w-0 flex-1 space-y-4" style={{ minWidth: '18rem' }}>
              <SectionLabel>Recommended Actions</SectionLabel>
              <div className="space-y-4">
                {(analysis.recommendations || []).map((r, i) => {
                  const isObj = typeof r === 'object' && r !== null;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {isObj ? r.action : r}
                          </p>
                          {isObj && r.priority && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-300 dark:border-white/15 text-slate-500">
                              {r.priority}{r.duration && r.duration !== 'n/a' ? ` · ${r.duration}` : ''}{r.risk ? ` · risk ${r.risk}` : ''}
                            </span>
                          )}
                        </div>
                        {isObj && r.note && (
                          <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 max-w-[70ch]">
                            {r.note}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {analysis.references?.length > 0 && (
              <div className="w-64 flex-shrink-0 rounded-xl border border-slate-200 dark:border-white/10 p-5 self-start">
                <SectionLabel>References</SectionLabel>
                <ul className="mt-3 space-y-2">
                  {analysis.references.map((ref, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-slate-600 dark:text-slate-300">
                      <span className="w-1 h-1 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                      {ref}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Footer actions */}
      <Card className="flex flex-wrap items-center gap-2 px-5 py-4">
        <button onClick={copySummary}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <div className="ml-auto flex items-center gap-3">
          {onOpenFull && (
            <button
              onClick={onOpenFull}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <FileText className="h-4 w-4" />
              Open Full Results
            </button>
          )}
          <button
            onClick={downloadSummary}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white transition-colors"
          >
            <Download className="h-4 w-4" />
            Download Summary
          </button>
        </div>
      </Card>
    </div>
  );
}
