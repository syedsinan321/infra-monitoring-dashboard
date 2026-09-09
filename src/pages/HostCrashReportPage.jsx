import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, ArrowRightLeft, PowerOff, Search, ServerCrash, RefreshCw,
  Star, Trash2, History, Clock, Webhook, ChevronRight, X,
} from 'lucide-react';
import {
  PageHeader, Button, Badge, KpiCard, Card, CardHeader, Input,
  Table, THead, TBody, Th, Tr, Td, EmptyState, ErrorBanner, LoadingState,
} from '../components/ui';
import mockFetch from '../mockFetch';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Use browser's local timezone label for display
const LOCAL_TZ_LABEL = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Reports and searches persist per-browser so the page works as a workflow,
// not a one-shot form. Snapshots reopen instantly without re-querying vCenter.
const LS_HISTORY = 'crashReportHistory';
const LS_SAVED = 'crashReportSaved';
const LS_SEARCHES = 'crashReportSearches';
const HISTORY_CAP = 10;
const SEARCH_CAP = 6;

function lsGet(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded — drop oldest snapshots rather than crash.
  }
}

function localToUtcIso(localDateTimeStr) {
  if (!localDateTimeStr) return null;
  return new Date(localDateTimeStr).toISOString();
}

function fmtLocal(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  });
}

function fmtShort(dateLike) {
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const STATUS_BADGE = {
  CRASHED:     { variant: 'critical', label: 'Crashed / HA Restart' },
  VMOTION:     { variant: 'info',     label: 'Live Migrated' },
  POWERED_OFF: { variant: 'neutral',  label: 'Powered Off' },
};

const FILTER_PILLS = [
  { key: 'ALL', label: (r) => `All (${r.total})` },
  { key: 'CRASHED', label: (r) => `Crashed (${r.crashed_count})` },
  { key: 'VMOTION', label: (r) => `Migrated (${r.vmotion_count})` },
  { key: 'POWERED_OFF', label: (r) => `Powered Off (${r.off_count})` },
];

// Webhook crash reports classify VMs slightly differently than manual runs.
const WH_VM_BADGE = {
  CRASHED:     { variant: 'critical', label: 'Crashed / HA' },
  EVACUATED:   { variant: 'info',     label: 'Evacuated (DRS)' },
  POWERED_OFF: { variant: 'neutral',  label: 'Powered Off' },
};

function critVariant(criticality) {
  const c = (criticality || '').toUpperCase();
  if (c.includes('CRITICAL') || c.includes('IMMEDIATE')) return 'critical';
  if (c.includes('WARNING')) return 'warning';
  if (c.includes('INFO')) return 'info';
  return 'neutral';
}

export default function HostCrashReportPage() {
  const [host, setHost] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [viewing, setViewing] = useState(null); // { id, ranAt, live } of the shown report
  const [sortField, setSortField] = useState('status');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [history, setHistory] = useState(() => lsGet(LS_HISTORY));
  const [saved, setSaved] = useState(() => lsGet(LS_SAVED));
  const [searches, setSearches] = useState(() => lsGet(LS_SEARCHES));

  // AriaOps webhook firing history (persisted server-side on the data volume)
  const [pageTab, setPageTab] = useState('reports');
  const [webhookList, setWebhookList] = useState([]);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookError, setWebhookError] = useState(null);
  const [webhookDetail, setWebhookDetail] = useState(null);
  const [webhookDetailLoading, setWebhookDetailLoading] = useState(null);

  const loadWebhookList = useCallback(async () => {
    setWebhookLoading(true);
    setWebhookError(null);
    try {
      const res = await mockFetch(`${API_BASE}/api/webhook/history`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = await res.json();
      if (Array.isArray(list)) setWebhookList(list);
    } catch (err) {
      setWebhookError(err.message);
    } finally {
      setWebhookLoading(false);
    }
  }, []);

  useEffect(() => { loadWebhookList(); }, [loadWebhookList]);
  useEffect(() => { if (pageTab === 'webhook') loadWebhookList(); }, [pageTab, loadWebhookList]);

  async function openWebhookRecord(id) {
    setWebhookDetailLoading(id);
    try {
      const res = await mockFetch(`${API_BASE}/api/webhook/history/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setWebhookDetail(await res.json());
    } catch (err) {
      setWebhookError(err.message);
    } finally {
      setWebhookDetailLoading(null);
    }
  }

  async function deleteWebhookRecord(id) {
    try {
      const res = await mockFetch(`${API_BASE}/api/webhook/history/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      setWebhookList(l => l.filter(r => r.id !== id));
      if (webhookDetail?.id === id) setWebhookDetail(null);
    } catch (err) {
      setWebhookError(err.message);
    }
  }

  useEffect(() => { lsSet(LS_HISTORY, history); }, [history]);
  useEffect(() => { lsSet(LS_SAVED, saved); }, [saved]);
  useEffect(() => { lsSet(LS_SEARCHES, searches); }, [searches]);

  const savedIds = new Set(saved.map(r => r.id));

  async function runReport(runHost, runStart, runEnd) {
    if (!runHost || !runStart || !runEnd) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setViewing(null);
    setFilterStatus('ALL');

    // Remember the search parameters regardless of outcome.
    setSearches(prev => {
      const key = `${runHost}|${runStart}|${runEnd}`;
      const next = [{ host: runHost, start: runStart, end: runEnd, at: new Date().toISOString() },
        ...prev.filter(s => `${s.host}|${s.start}|${s.end}` !== key)];
      return next.slice(0, SEARCH_CAP);
    });

    try {
      const res = await mockFetch(`${API_BASE}/api/vmware/host-crash-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: runHost,
          start_time: localToUtcIso(runStart),
          end_time: localToUtcIso(runEnd),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const payload = await res.json();
      const record = {
        id: (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
        ranAt: new Date().toISOString(),
        host: runHost,
        start: runStart,
        end: runEnd,
        result: payload,
      };
      setResult(payload);
      setViewing({ id: record.id, ranAt: record.ranAt, live: true });
      setHistory(prev => [record, ...prev].slice(0, HISTORY_CAP));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    runReport(host, startTime, endTime);
  }

  function openRecord(record) {
    setHost(record.host);
    setStartTime(record.start);
    setEndTime(record.end);
    setError(null);
    setResult(record.result);
    setViewing({ id: record.id, ranAt: record.ranAt, live: false });
    setFilterStatus('ALL');
  }

  function toggleSaved(record) {
    setSaved(prev => savedIds.has(record.id)
      ? prev.filter(r => r.id !== record.id)
      : [record, ...prev]);
  }

  function deleteRecord(id) {
    setHistory(prev => prev.filter(r => r.id !== id));
    setSaved(prev => prev.filter(r => r.id !== id));
    if (viewing?.id === id) {
      setViewing(null);
      setResult(null);
    }
  }

  // The record currently shown (from history or saved), for the Save toggle.
  const viewingRecord = viewing
    ? history.find(r => r.id === viewing.id) || saved.find(r => r.id === viewing.id)
    : null;

  function toggleSort(field) {
    if (sortField === field) setSortAsc(a => !a);
    else { setSortField(field); setSortAsc(true); }
  }

  const sortedVms = result
    ? [...result.vms]
        .filter(v => filterStatus === 'ALL' || v.status === filterStatus)
        .sort((a, b) => {
          const av = a[sortField] || '';
          const bv = b[sortField] || '';
          return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        })
    : [];

  const sortProps = (field) => ({
    sortable: true,
    active: sortField === field,
    dir: sortAsc ? 'asc' : 'desc',
    onSort: () => toggleSort(field),
  });

  const RecordRow = ({ record, showDelete = true }) => {
    const isSaved = savedIds.has(record.id);
    const isOpen = viewing?.id === record.id;
    return (
      <div
        onClick={() => openRecord(record)}
        className={`group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
          ${isOpen ? 'bg-blue-500/10 dark:bg-blue-500/10' : 'hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'}`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium font-mono text-slate-800 dark:text-slate-100 truncate">{record.host}</p>
          <p className="text-[11px] text-slate-500 truncate">
            {fmtShort(record.start)} → {fmtShort(record.end)} · ran {fmtShort(record.ranAt)}
          </p>
        </div>
        {record.result.crashed_count > 0
          ? <Badge dot variant="critical">{record.result.crashed_count} crashed</Badge>
          : <Badge dot variant="success">clean</Badge>}
        <button
          onClick={(e) => { e.stopPropagation(); toggleSaved(record); }}
          className={`p-1.5 rounded-lg transition-colors ${isSaved
            ? 'text-amber-500 dark:text-amber-400'
            : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-amber-500'}`}
          title={isSaved ? 'Remove from saved' : 'Save this report'}
        >
          <Star className="h-3.5 w-3.5" fill={isSaved ? 'currentColor' : 'none'} />
        </button>
        {showDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); deleteRecord(record.id); }}
            className="p-1.5 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-colors"
            title="Delete this report"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="VM Crash Reports"
        subtitle="Identify VMs affected by a host failure — crashed, vMotioned, or powered off"
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Page tabs */}
        <div className="flex items-center gap-6 border-b border-slate-200/70 dark:border-white/[0.07] px-1 -mb-1">
          {[
            { key: 'reports', label: 'Reports' },
            { key: 'webhook', label: `AriaOps Webhook${webhookList.length ? ` (${webhookList.length})` : ''}` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setPageTab(t.key)}
              className={`relative -mb-px pb-3 pt-1 text-sm font-medium border-b-2 transition-colors
                ${pageTab === t.key
                  ? 'border-blue-500 text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {pageTab === 'reports' && (<>
        {/* New report + saved reports */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 items-start">
          <Card className="p-5">
            <CardHeader title="New Report" sub="Query vCenter events for a host and time window" />

            {/* Previous searches */}
            {searches.length > 0 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recent:</span>
                {searches.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setHost(s.host); setStartTime(s.start); setEndTime(s.end); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium
                      bg-white/70 dark:bg-white/[0.06] border border-slate-300/70 dark:border-white/[0.1]
                      text-slate-600 dark:text-slate-300 hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title={`${fmtShort(s.start)} → ${fmtShort(s.end)}`}
                  >
                    <Clock className="h-3 w-3" />
                    {s.host}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                    Host Name
                  </label>
                  <Input
                    type="text"
                    value={host}
                    onChange={e => setHost(e.target.value)}
                    placeholder="e.g. prdesx133"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                    Start Time ({LOCAL_TZ_LABEL})
                  </label>
                  <Input
                    type="datetime-local"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                    End Time ({LOCAL_TZ_LABEL})
                  </label>
                  <Input
                    type="datetime-local"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" variant="primary" icon={loading ? RefreshCw : Search} loading={loading}>
                  {loading ? 'Querying vCenter…' : 'Run Report'}
                </Button>
                {result && viewing?.live && (
                  <p className="text-xs text-slate-500">
                    Scanned {result.total} VMs on <span className="font-semibold text-slate-700 dark:text-slate-200">{result.host}</span>
                    {' '}· Host is <span className={result.host_online ? 'text-emerald-500 font-semibold' : 'text-red-500 font-semibold'}>
                      {result.host_online ? 'online' : 'offline'}
                    </span>
                  </p>
                )}
              </div>
            </form>
          </Card>

          {/* Saved reports */}
          <Card className="overflow-hidden">
            <CardHeader
              className="px-4 pt-4 pb-2"
              title="Saved Reports"
              action={saved.length > 0 && <Badge variant="neutral">{saved.length}</Badge>}
            />
            {saved.length === 0 ? (
              <p className="px-4 pb-4 text-xs text-slate-500">
                No saved reports yet — run a report and click the star to keep it here permanently.
              </p>
            ) : (
              <div className="divide-y divide-slate-200/60 dark:divide-white/[0.05] max-h-56 overflow-y-auto">
                {saved.map(r => <RecordRow key={r.id} record={r} showDelete={false} />)}
              </div>
            )}
          </Card>
        </div>

        {error && <ErrorBanner message={error} />}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Snapshot banner for reopened reports */}
            {viewing && !viewing.live && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3">
                <p className="text-sm text-blue-600 dark:text-blue-300">
                  Viewing a snapshot from <span className="font-semibold">{fmtLocal(viewing.ranAt)}</span> — results are not live.
                </p>
                <Button size="sm" icon={RefreshCw} onClick={() => {
                  const r = viewingRecord;
                  if (r) runReport(r.host, r.start, r.end);
                }}>
                  Re-run Report
                </Button>
              </div>
            )}

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard label="Total VMs" value={result.total} sub={`on ${result.host}`} />
              <KpiCard
                label="Crashed / HA" value={result.crashed_count}
                valueClass={result.crashed_count > 0 ? 'text-red-500 dark:text-red-400' : ''}
                sub={result.crashed_count > 0 ? 'restarted by HA' : 'none detected'}
                subTone={result.crashed_count > 0 ? 'negative' : 'positive'}
              />
              <KpiCard label="Live Migrated" value={result.vmotion_count} sub="moved by vMotion" />
              <KpiCard label="Powered Off" value={result.off_count} sub="down in the window" />
            </div>

            {/* Filter pills + save */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2 flex-wrap">
                {FILTER_PILLS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setFilterStatus(p.key)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors
                      ${filterStatus === p.key
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-white/70 dark:bg-white/[0.06] border-slate-300/70 dark:border-white/[0.1] text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/[0.1]'}`}
                  >
                    {p.label(result)}
                  </button>
                ))}
              </div>
              {viewingRecord && (
                <Button
                  size="sm"
                  icon={Star}
                  onClick={() => toggleSaved(viewingRecord)}
                  className={savedIds.has(viewingRecord.id) ? 'text-amber-500 dark:text-amber-400' : ''}
                >
                  {savedIds.has(viewingRecord.id) ? 'Saved' : 'Save Report'}
                </Button>
              )}
            </div>

            {/* Table */}
            <Card className="overflow-hidden">
              {sortedVms.length === 0 ? (
                <EmptyState icon={ServerCrash} title="No VMs match the current filter" />
              ) : (
                <Table>
                  <THead>
                    <Th {...sortProps('name')}>VM Name</Th>
                    <Th {...sortProps('status')}>Status</Th>
                    <Th {...sortProps('boot_time')}>Boot Time</Th>
                    <Th {...sortProps('current_host')}>Current Host</Th>
                    <Th {...sortProps('last_event')}>Last Event</Th>
                  </THead>
                  <TBody>
                    {sortedVms.map(vm => {
                      const meta = STATUS_BADGE[vm.status] || STATUS_BADGE.POWERED_OFF;
                      return (
                        <Tr key={vm.name} className={vm.status === 'CRASHED' ? 'bg-red-500/5' : ''}>
                          <Td className="font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-nowrap">{vm.name}</Td>
                          <Td><Badge dot variant={meta.variant}>{meta.label}</Badge></Td>
                          <Td className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtLocal(vm.boot_time)}</Td>
                          <Td className="text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{vm.current_host || '—'}</Td>
                          <Td className="text-xs text-slate-500 whitespace-nowrap max-w-xs truncate">
                            {vm.last_event.replace('vim.event.', '')}
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              )}
            </Card>
          </div>
        )}

        {/* Report history */}
        <Card className="overflow-hidden">
          <CardHeader
            className="px-4 pt-4 pb-2"
            title="Report History"
            sub="Recent reports run from this browser — click to reopen instantly"
            action={history.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="neutral">{history.length}</Badge>
                <button
                  onClick={() => setHistory([])}
                  className="text-[11px] text-slate-500 hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          />
          {history.length === 0 ? (
            <EmptyState
              icon={History}
              title="No reports yet"
              hint="Run a report above — the last 10 are kept here automatically, and starred ones are kept forever."
            />
          ) : (
            <div className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
              {history.map(r => <RecordRow key={r.id} record={r} />)}
            </div>
          )}
        </Card>
        </>)}

        {/* ------------------------- AriaOps Webhook tab ------------------------- */}
        {pageTab === 'webhook' && (
          <div className="space-y-4">
            {webhookError && <ErrorBanner message={webhookError} />}

            <Card className="overflow-hidden">
                <CardHeader
                  className="px-4 pt-4 pb-2"
                  title="AriaOps Webhook Firings"
                  sub="Crash reports generated automatically when AriaOps detected a host failure — recorded from now on, stored on the data volume"
                  action={(
                    <Button size="sm" icon={RefreshCw} loading={webhookLoading} onClick={loadWebhookList}>
                      Refresh
                    </Button>
                  )}
                />
                {webhookLoading && webhookList.length === 0 ? (
                  <LoadingState label="Loading webhook history…" />
                ) : webhookList.length === 0 ? (
                  <EmptyState
                    icon={Webhook}
                    title="No webhook firings recorded yet"
                    hint="Earlier firings weren't persisted (only emailed), so history starts collecting from now. The next AriaOps host-down alert will appear here automatically with its full crash report."
                  />
                ) : (
                  <div className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
                    {webhookList.map(r => (
                      <div
                        key={r.id}
                        onClick={() => openWebhookRecord(r.id)}
                        className="group flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors"
                      >
                        {webhookDetailLoading === r.id
                          ? <RefreshCw className="h-4 w-4 animate-spin text-blue-400 flex-shrink-0" />
                          : <Webhook className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium font-mono text-slate-800 dark:text-slate-100 truncate">
                            {r.host}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {fmtLocal(r.received_at)} · {r.alert_name || 'ESXi Host Alert'}
                          </p>
                        </div>
                        <Badge dot variant={critVariant(r.criticality)}>{r.criticality || '—'}</Badge>
                        {r.status === 'processing' && (
                          <Badge variant="warning">processing…</Badge>
                        )}
                        {r.status === 'error' && (
                          <Badge dot variant="critical">failed</Badge>
                        )}
                        {r.status === 'complete' && (
                          (r.crashed_count ?? 0) > 0
                            ? <Badge dot variant="critical">{r.crashed_count} crashed</Badge>
                            : <Badge dot variant="success">{r.total ?? 0} affected</Badge>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteWebhookRecord(r.id); }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                          title="Delete this record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
          </div>
        )}
      </main>

      {/* Webhook firing popup */}
      {webhookDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setWebhookDetail(null)}
        >
          <Card
            className="w-full max-w-4xl max-h-[85vh] overflow-y-auto shadow-2xl bg-white/95 dark:bg-slate-900/95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header */}
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/70 dark:border-white/[0.07] bg-white/95 dark:bg-slate-900/95 backdrop-blur">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-blue-500/15 flex-shrink-0">
                  <Webhook className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold font-mono tracking-tight text-slate-900 dark:text-white truncate">
                    {webhookDetail.host}
                  </h2>
                  <p className="text-xs text-slate-500 truncate">{webhookDetail.alert_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {webhookDetail.backfilled && <Badge variant="info">Backfilled from email</Badge>}
                <Badge dot variant={critVariant(webhookDetail.criticality)}>{webhookDetail.criticality || '—'}</Badge>
                <button
                  onClick={() => deleteWebhookRecord(webhookDetail.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete this record"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setWebhookDetail(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-slate-500">
                <span>Received <span className="text-slate-700 dark:text-slate-300">{fmtLocal(webhookDetail.received_at)}</span></span>
                {webhookDetail.report?.alert_time && (
                  <span>Alert time <span className="text-slate-700 dark:text-slate-300">{webhookDetail.report.alert_time}</span></span>
                )}
                {webhookDetail.report?.window_start && (
                  <span>Window <span className="text-slate-700 dark:text-slate-300">
                    {webhookDetail.report.window_start} → {webhookDetail.report.window_end}
                  </span></span>
                )}
                <span>Email {webhookDetail.email_sent ? 'sent ✓' : 'not sent'}</span>
                {webhookDetail.teams_sent != null && (
                  <span>Teams {webhookDetail.teams_sent ? 'sent ✓' : 'not sent'}</span>
                )}
              </div>

              {webhookDetail.status === 'processing' && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
                  This firing is still being processed — refresh in a moment.
                </div>
              )}
              {webhookDetail.error && <ErrorBanner message={webhookDetail.error} />}

              {webhookDetail.report && (
                <>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                      <KpiCard
                        label="Total VMs" value={webhookDetail.report.total ?? 0}
                        sub={webhookDetail.report.host_online == null
                          ? 'final host state unknown'
                          : webhookDetail.report.host_online ? 'host back online' : 'host offline'}
                        subTone={webhookDetail.report.host_online == null
                          ? 'muted'
                          : webhookDetail.report.host_online ? 'positive' : 'negative'}
                      />
                      <KpiCard
                        label="Crashed / HA" value={webhookDetail.report.crashed_count ?? 0}
                        valueClass={(webhookDetail.report.crashed_count ?? 0) > 0 ? 'text-red-500 dark:text-red-400' : ''}
                        sub="restarted by HA"
                        subTone={(webhookDetail.report.crashed_count ?? 0) > 0 ? 'negative' : 'positive'}
                      />
                      <KpiCard
                        label="Evacuated" value={webhookDetail.report.evacuated_count ?? 0}
                        sub="proactive DRS moves"
                      />
                      <KpiCard
                        label="Powered Off" value={webhookDetail.report.off_count ?? 0}
                        sub="down in the window"
                      />
                    </div>

                    <Card className="overflow-hidden">
                      {(webhookDetail.report.vms || []).length === 0 ? (
                        <EmptyState icon={ServerCrash} title="No affected VMs found in the crash window" />
                      ) : (
                        <Table>
                          <THead>
                            <Th>VM Name</Th>
                            <Th>Status</Th>
                            <Th>Boot Time</Th>
                            <Th>Current Host</Th>
                            <Th>Events</Th>
                          </THead>
                          <TBody>
                            {webhookDetail.report.vms.map(vm => {
                              const meta = WH_VM_BADGE[vm.status] || WH_VM_BADGE.POWERED_OFF;
                              return (
                                <Tr key={vm.name} className={vm.status === 'CRASHED' ? 'bg-red-500/5' : ''}>
                                  <Td className="font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-nowrap">{vm.name}</Td>
                                  <Td><Badge dot variant={meta.variant}>{meta.label}</Badge></Td>
                                  <Td className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{vm.boot_time || '—'}</Td>
                                  <Td className="text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{vm.current_host || '—'}</Td>
                                  <Td className="text-xs text-slate-500 max-w-xs truncate">
                                    {(vm.events || []).join(', ') || '—'}
                                  </Td>
                                </Tr>
                              );
                            })}
                          </TBody>
                        </Table>
                      )}
                    </Card>

                    {(webhookDetail.report.host_events || []).length > 0 && (
                      <Card className="overflow-hidden">
                        <CardHeader className="px-4 pt-4 pb-2" title="Host Events" sub="vCenter events on the failed host around the alert" />
                        <div className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
                          {webhookDetail.report.host_events.slice(0, 12).map((ev, i) => (
                            <div key={i} className="flex items-start gap-3 px-4 py-2">
                              <span className="w-28 text-[11px] font-mono text-slate-500 flex-shrink-0">{ev.time}</span>
                              <span className="text-[11px] font-mono text-blue-500 dark:text-blue-400 flex-shrink-0">{ev.event}</span>
                              <span className="text-xs text-slate-600 dark:text-slate-300 min-w-0">{ev.message}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
