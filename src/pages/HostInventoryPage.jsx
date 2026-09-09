import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, Server } from 'lucide-react';
import { fetchHostInventory, syncHostInventory } from '../api';
import {
  PageHeader, Button, Badge, KpiCard, Card, SearchInput, Select, Toolbar,
  Pagination, Table, THead, TBody, Th, Tr, Td, LoadingState, ErrorBanner, EmptyState,
} from '../components/ui';
import { DcName } from '../dcColors';

function HostInventoryPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDC, setFilterDC] = useState('all');
  const [filterCluster, setFilterCluster] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active');
  const [sortField, setSortField] = useState('first_seen');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const location = useLocation();

  // Sidebar deep links: "Hosts" shows active hosts, "Host Lifecycle"
  // (?view=lifecycle) shows the full history including removed hosts.
  const lifecycleView = new URLSearchParams(location.search).get('view') === 'lifecycle';
  useEffect(() => {
    setFilterStatus(lifecycleView ? 'all' : 'active');
  }, [lifecycleView]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchHostInventory();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await syncHostInventory();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'first_seen' || field === 'cluster_since' ? 'desc' : 'asc');
    }
  };

  const hosts = useMemo(() => data?.hosts || [], [data]);

  const datacenters = useMemo(
    () => [...new Set(hosts.map((h) => h.datacenter).filter(Boolean))].sort(),
    [hosts]
  );

  const clusters = useMemo(() => {
    const filtered = filterDC === 'all' ? hosts : hosts.filter((h) => h.datacenter === filterDC);
    return [...new Set(filtered.map((h) => h.cluster).filter(Boolean))].sort();
  }, [hosts, filterDC]);

  const filteredHosts = useMemo(() => {
    const result = hosts.filter((h) => {
      const matchesDC = filterDC === 'all' || h.datacenter === filterDC;
      const matchesCluster = filterCluster === 'all' || h.cluster === filterCluster;
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && !h.removed) ||
        (filterStatus === 'removed' && h.removed);
      const matchesSearch =
        !searchQuery ||
        h.host_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.datacenter?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.cluster?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(h.cpu_count || '').includes(searchQuery);
      return matchesDC && matchesCluster && matchesStatus && matchesSearch;
    });

    result.sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'first_seen' || sortField === 'last_seen' || sortField === 'cluster_since') {
        aVal = a[sortField] || '';
        bVal = b[sortField] || '';
      } else if (sortField === 'cpu_count') {
        aVal = a[sortField] || 0;
        bVal = b[sortField] || 0;
      } else {
        aVal = (a[sortField] || '').toLowerCase();
        bVal = (b[sortField] || '').toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [hosts, filterDC, filterCluster, filterStatus, searchQuery, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterDC, filterCluster, filterStatus, perPage]);

  const totalPages = Math.max(1, Math.ceil(filteredHosts.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageHosts = filteredHosts.slice((safePage - 1) * perPage, safePage * perPage);

  const activeCount = hosts.filter((h) => !h.removed).length;
  const removedCount = hosts.filter((h) => h.removed).length;

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const daysSince = (iso) => {
    if (!iso) return null;
    return Math.floor((new Date() - new Date(iso)) / (1000 * 60 * 60 * 24));
  };

  const sortProps = (field) => ({
    sortable: true,
    active: sortField === field,
    dir: sortDir,
    onSort: () => toggleSort(field),
  });

  return (
    <>
      <PageHeader
        title={lifecycleView ? 'Host Lifecycle' : 'Hosts'}
        subtitle={lifecycleView
          ? 'Full host history — first seen, age, and removals across vCenter'
          : `${activeCount} active hosts tracked${removedCount > 0 ? ` · ${removedCount} removed` : ''}`}
        actions={(
          <>
            {data?.last_sync && (
              <span className="hidden sm:inline text-xs text-slate-500">
                Last sync {formatDateTime(data.last_sync)}
              </span>
            )}
            <Button variant="primary" size="sm" icon={RefreshCw} loading={syncing} onClick={handleSync}>
              {syncing ? 'Syncing…' : 'Sync Now'}
            </Button>
          </>
        )}
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {loading && !data && <LoadingState label="Loading host inventory…" />}
        {error && <ErrorBanner message={error} />}

        {data && (
          <>
            {/* Search + filters */}
            <Toolbar>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search hosts, clusters, datacenters…"
              />
              <Select value={filterDC} onChange={(v) => { setFilterDC(v); setFilterCluster('all'); }}>
                <option value="all">All Datacenters</option>
                {datacenters.map((dc) => <option key={dc} value={dc}>{dc}</option>)}
              </Select>
              <Select value={filterCluster} onChange={setFilterCluster}>
                <option value="all">All Clusters</option>
                {clusters.map((cl) => <option key={cl} value={cl}>{cl}</option>)}
              </Select>
              <Select value={filterStatus} onChange={setFilterStatus}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="removed">Removed</option>
              </Select>
            </Toolbar>

            {/* KPI cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard label="Total Tracked" value={data.total || 0} sub="hosts in registry" />
              <KpiCard
                label="Active" value={activeCount}
                valueClass="text-emerald-600 dark:text-emerald-400"
                sub="currently in vCenter" subTone="positive"
              />
              <KpiCard
                label="Removed" value={removedCount}
                valueClass={removedCount > 0 ? 'text-red-500 dark:text-red-400' : ''}
                sub="no longer present" subTone={removedCount > 0 ? 'negative' : 'muted'}
              />
              <KpiCard label="Datacenters" value={datacenters.length} sub="reporting hosts" />
            </div>

            {/* Table */}
            <Card className="overflow-hidden">
              {filteredHosts.length === 0 ? (
                <EmptyState
                  icon={Server}
                  title={data.total === 0 ? 'No hosts tracked yet' : 'No hosts match your filters'}
                  hint={data.total === 0
                    ? 'Click "Sync Now" to populate the registry from vCenter.'
                    : 'Try clearing the search or switching filters.'}
                />
              ) : (
                <>
                  <Table>
                    <THead>
                      <Th {...sortProps('host_name')}>Host Name</Th>
                      <Th {...sortProps('datacenter')}>Datacenter</Th>
                      <Th {...sortProps('cluster')}>Cluster</Th>
                      <Th align="center" {...sortProps('cluster_since')}>In Cluster Since</Th>
                      <Th align="center" {...sortProps('cpu_count')}>CPU Cores</Th>
                      <Th align="center" {...sortProps('first_seen')}>First Seen</Th>
                      <Th align="center" {...sortProps('last_seen')}>Last Seen</Th>
                      <Th align="center">Status</Th>
                    </THead>
                    <TBody>
                      {pageHosts.map((host) => {
                        const days = daysSince(host.first_seen);
                        const clusterDays = daysSince(host.cluster_since);
                        return (
                          <Tr key={host.host_name} className={host.removed ? 'opacity-60' : ''}>
                            <Td className="font-medium text-slate-800 dark:text-slate-100">{host.host_name}</Td>
                            <Td><DcName value={host.datacenter} /></Td>
                            <Td className="text-slate-600 dark:text-slate-300">{host.cluster}</Td>
                            <Td align="center">
                              <div className="text-slate-600 dark:text-slate-300">{formatDate(host.cluster_since)}</div>
                              {clusterDays !== null && (
                                <div className="text-[11px] text-slate-400">{clusterDays === 0 ? 'Today' : `${clusterDays}d ago`}</div>
                              )}
                            </Td>
                            <Td align="center" className="font-mono tabular-nums text-slate-500">{host.cpu_count || '—'}</Td>
                            <Td align="center">
                              <div className="text-slate-600 dark:text-slate-300">{formatDate(host.first_seen)}</div>
                              {days !== null && (
                                <div className="text-[11px] text-slate-400">{days === 0 ? 'Today' : `${days}d ago`}</div>
                              )}
                            </Td>
                            <Td align="center" className="text-slate-600 dark:text-slate-300">{formatDate(host.last_seen)}</Td>
                            <Td align="center">
                              <Badge dot variant={host.removed ? 'critical' : 'success'}>
                                {host.removed ? 'Removed' : 'Active'}
                              </Badge>
                            </Td>
                          </Tr>
                        );
                      })}
                    </TBody>
                  </Table>
                  <Pagination
                    page={safePage} perPage={perPage} total={filteredHosts.length}
                    onPage={setPage} onPerPage={setPerPage} label="hosts"
                  />
                </>
              )}
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default HostInventoryPage;
