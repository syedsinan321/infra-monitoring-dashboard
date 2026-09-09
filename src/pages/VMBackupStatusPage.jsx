import { useState, useEffect, useMemo, useCallback } from 'react';
import { ShieldCheck, RefreshCw, Monitor, Server } from 'lucide-react';
import { fetchBackupStatus } from '../api';
import {
  PageHeader, Button, Badge, KpiCard, Card, CardHeader, SearchInput, Select, Toolbar,
  Pagination, Table, THead, TBody, Th, Tr, Td, LoadingState, ErrorBanner, EmptyState,
} from '../components/ui';
import { DcName } from '../dcColors';

const RESULT_BADGE = {
  SUCCESS: { variant: 'success',  label: 'Success' },
  FAILED:  { variant: 'critical', label: 'Failed' },
  NO_DATA: { variant: 'neutral',  label: 'No Data' },
  UNKNOWN: { variant: 'warning',  label: 'Unknown' },
};

const SEGMENTS = [
  { key: 'success', label: 'Success', color: 'bg-emerald-500', legend: '#10b981' },
  { key: 'failed',  label: 'Failed',  color: 'bg-red-500',     legend: '#ef4444' },
  { key: 'unknown', label: 'Unknown', color: 'bg-amber-400',   legend: '#f59e0b' },
  { key: 'no_data', label: 'No Data', color: 'bg-slate-400',   legend: '#94a3b8' },
];

function complianceTone(pct) {
  if (pct >= 95) return 'positive';
  if (pct >= 85) return 'warning';
  return 'negative';
}

export default function VMBackupStatusPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [filterDC, setFilterDC] = useState('all');
  const [filterOS, setFilterOS] = useState('all');
  const [filterResult, setFilterResult] = useState('all');
  const [sortField, setSortField] = useState('vm_name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);

  const load = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);
      const result = await fetchBackupStatus(forceRefresh);
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const datacenters = useMemo(() => data?.summary?.datacenters || [], [data]);

  const filtered = useMemo(() => {
    if (!data?.vms) return [];
    let vms = data.vms;
    if (filterDC !== 'all') vms = vms.filter(v => v.datacenter === filterDC);
    if (filterOS !== 'all') vms = vms.filter(v => v.os_type === filterOS);
    if (filterResult !== 'all') vms = vms.filter(v => v.backup_result === filterResult);
    if (search.trim()) {
      const q = search.toLowerCase();
      vms = vms.filter(v =>
        v.vm_name.toLowerCase().includes(q) ||
        v.guest_os.toLowerCase().includes(q) ||
        (v.last_backup_time || '').toLowerCase().includes(q)
      );
    }
    vms = [...vms].sort((a, b) => {
      let av = a[sortField] || '';
      let bv = b[sortField] || '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return vms;
  }, [data, filterDC, filterOS, filterResult, search, sortField, sortDir]);

  useEffect(() => { setPage(1); }, [filterDC, filterOS, filterResult, search, perPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const summary = data?.summary;

  // Compliance math — success over every VM that should be protected.
  const health = useMemo(() => {
    if (!summary) return null;
    const unknown = Math.max(0, summary.total - summary.success - summary.failed - summary.no_data);
    const pct = summary.total ? (summary.success / summary.total) * 100 : 0;
    const perOs = ['windows', 'rhel'].map(os => {
      const vms = (data?.vms || []).filter(v => v.os_type === os);
      const ok = vms.filter(v => v.backup_result === 'SUCCESS').length;
      return { os, ok, total: vms.length, pct: vms.length ? (ok / vms.length) * 100 : 0 };
    });
    return { unknown, pct, perOs, counts: { ...summary, unknown } };
  }, [summary, data]);

  const sortProps = (field) => ({
    sortable: true,
    active: sortField === field,
    dir: sortDir,
    onSort: () => handleSort(field),
  });

  return (
    <>
      <PageHeader
        title="Backup Status"
        subtitle="Rubrik backup health & compliance for Windows and RHEL VMs"
        actions={(
          <>
            {lastUpdated && (
              <span className="hidden sm:inline text-xs text-slate-500">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="primary" size="sm" icon={RefreshCw}
              loading={refreshing} disabled={loading}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
          </>
        )}
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {loading && <LoadingState label="Fetching backup status from vCenter…" />}
        {error && !loading && <ErrorBanner message={error} />}

        {!loading && data && health && (
          <>
            {/* Search + filters */}
            <Toolbar>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search VM name, OS, backup time…"
              />
              <Select value={filterDC} onChange={setFilterDC}>
                <option value="all">All Datacenters</option>
                {datacenters.map(dc => <option key={dc} value={dc}>{dc}</option>)}
              </Select>
              <Select value={filterOS} onChange={setFilterOS}>
                <option value="all">All OS Types</option>
                <option value="windows">Windows</option>
                <option value="rhel">RHEL</option>
              </Select>
              <Select value={filterResult} onChange={setFilterResult}>
                <option value="all">All Statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="NO_DATA">No Data</option>
                <option value="UNKNOWN">Unknown</option>
              </Select>
            </Toolbar>

            {/* KPI cards — compliance first */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard
                label="Backup Compliance"
                value={`${health.pct.toFixed(1)}%`}
                valueClass={health.pct < 85 ? 'text-red-500 dark:text-red-400' : ''}
                sub={`${summary.success.toLocaleString()} of ${summary.total.toLocaleString()} VMs protected`}
                subTone={complianceTone(health.pct)}
              />
              <KpiCard
                label="Protected" value={summary.success.toLocaleString()}
                sub="latest backup succeeded" subTone="positive"
              />
              <KpiCard
                label="Failed" value={summary.failed.toLocaleString()}
                valueClass={summary.failed > 0 ? 'text-red-500 dark:text-red-400' : ''}
                sub={summary.failed > 0 ? 'need remediation' : 'no failures'}
                subTone={summary.failed > 0 ? 'negative' : 'positive'}
              />
              <KpiCard
                label="No Data" value={summary.no_data.toLocaleString()}
                sub="never seen by Rubrik" subTone={summary.no_data > 0 ? 'warning' : 'positive'}
              />
            </div>

            {/* Compliance breakdown */}
            <Card className="p-5">
              <CardHeader
                title="Compliance Overview"
                sub="Backup result distribution across all tracked VMs"
              />
              <div className="mt-4 grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-8">
                <div>
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-200/60 dark:bg-white/[0.06]">
                    {SEGMENTS.map(s => {
                      const count = health.counts[s.key] || 0;
                      if (!count) return null;
                      return (
                        <div
                          key={s.key}
                          className={s.color}
                          style={{ width: `${(count / summary.total) * 100}%` }}
                          title={`${s.label}: ${count}`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                    {SEGMENTS.map(s => {
                      const count = health.counts[s.key] || 0;
                      return (
                        <div key={s.key} className="flex items-center gap-2 text-[13px]">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.legend }} />
                          <span className="text-slate-600 dark:text-slate-300">{s.label}</span>
                          <span className="font-medium tabular-nums text-slate-800 dark:text-slate-100">{count.toLocaleString()}</span>
                          <span className="text-xs text-slate-500 tabular-nums">
                            {summary.total ? ((count / summary.total) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-3">
                  {health.perOs.map(({ os, ok, total, pct }) => (
                    <div key={os}>
                      <div className="flex items-center justify-between text-[13px] mb-1.5">
                        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          {os === 'windows' ? <Monitor className="h-3.5 w-3.5 text-blue-400" /> : <Server className="h-3.5 w-3.5 text-red-400" />}
                          {os === 'windows' ? 'Windows' : 'RHEL'}
                        </span>
                        <span className="tabular-nums text-slate-800 dark:text-slate-100 font-medium">
                          {ok.toLocaleString()}/{total.toLocaleString()}
                          <span className="text-xs text-slate-500 ml-1.5">{pct.toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200/60 dark:bg-white/[0.06] overflow-hidden">
                        <div
                          className={pct >= 95 ? 'h-full bg-emerald-500' : pct >= 85 ? 'h-full bg-amber-400' : 'h-full bg-red-500'}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Table */}
            <Card className="overflow-hidden">
              {filtered.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="No VMs match the current filters"
                  hint="Try clearing the search or switching filters."
                />
              ) : (
                <>
                  <Table>
                    <THead>
                      <Th {...sortProps('vm_name')}>VM Name</Th>
                      <Th {...sortProps('os_type')}>OS</Th>
                      <Th {...sortProps('datacenter')}>Datacenter</Th>
                      <Th {...sortProps('backup_result')}>Backup Status</Th>
                      <Th {...sortProps('last_backup_time')}>Last Backup Time</Th>
                    </THead>
                    <TBody>
                      {paginated.map((vm, i) => {
                        const meta = RESULT_BADGE[vm.backup_result] || RESULT_BADGE.UNKNOWN;
                        return (
                          <Tr key={`${vm.vcenter}-${vm.vm_name}-${i}`}>
                            <Td className="font-medium text-slate-800 dark:text-slate-100 max-w-xs truncate">{vm.vm_name}</Td>
                            <Td>
                              <Badge variant={vm.os_type === 'windows' ? 'info' : 'critical'}>
                                {vm.os_type === 'windows' ? 'Windows' : vm.os_type === 'rhel' ? 'RHEL' : vm.os_type}
                              </Badge>
                            </Td>
                            <Td><DcName value={vm.datacenter} /></Td>
                            <Td><Badge dot variant={meta.variant}>{meta.label}</Badge></Td>
                            <Td className="text-xs text-slate-500 dark:text-slate-400">
                              {vm.last_backup_time || <span className="italic">—</span>}
                            </Td>
                          </Tr>
                        );
                      })}
                    </TBody>
                  </Table>
                  <Pagination
                    page={safePage} perPage={perPage} total={filtered.length}
                    onPage={setPage} onPerPage={setPerPage} label="VMs"
                    perPageOptions={[50, 100, 200]}
                  />
                </>
              )}
            </Card>

            {/* vCenter errors */}
            {data.errors && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
                <p className="font-semibold mb-1">vCenter Warnings</p>
                {data.errors.map((e, i) => (
                  <p key={i} className="opacity-80">{e.vcenter}: {e.error}</p>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
