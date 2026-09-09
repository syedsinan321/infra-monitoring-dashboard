import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Building2, RefreshCw, Download, X, CheckSquare, Square, Monitor } from 'lucide-react';
import { fetchEsxiHosts } from '../api';
import {
  PageHeader, Button, Badge, KpiCard, Card, SearchInput, Select, Toolbar,
  Table, THead, TBody, Th, Tr, Td, GroupRow, GroupBody,
  LoadingState, ErrorBanner, EmptyState,
} from '../components/ui';
import { dcTextClass } from '../dcColors';

function VMwareToolsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDC, setFilterDC] = useState('all');
  const [filterVersion, setFilterVersion] = useState('all');
  const [filterBuild, setFilterBuild] = useState('all');
  const [expandedDCs, setExpandedDCs] = useState({});

  const [lastUpdated, setLastUpdated] = useState(null);
  const initialLoad = useRef(true);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportVersions, setExportVersions] = useState([]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchEsxiHosts();
      setData(result);
      setLastUpdated(new Date());
      if (initialLoad.current) {
        const expanded = {};
        (result.summary?.datacenters || []).forEach((dc) => { expanded[dc] = true; });
        setExpandedDCs(expanded);
        initialLoad.current = false;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const toggleDC = (dc) => setExpandedDCs((prev) => ({ ...prev, [dc]: !prev[dc] }));

  const uniqueVersionList = useMemo(() => {
    if (!data?.clusters) return [];
    return [...new Set(data.clusters.map((c) => c.version).filter(Boolean))].sort();
  }, [data]);

  const uniqueBuildList = useMemo(() => {
    if (!data?.clusters) return [];
    return [...new Set(data.clusters.map((c) => c.build).filter(Boolean))].sort();
  }, [data]);

  const filteredClusters = useMemo(() => {
    if (!data?.clusters) return [];
    return data.clusters.filter((c) => {
      const matchesDC = filterDC === 'all' || c.datacenter === filterDC;
      const matchesVersion = filterVersion === 'all' || c.version === filterVersion;
      const matchesBuild = filterBuild === 'all' || c.build === filterBuild;
      const matchesSearch =
        !searchQuery ||
        c.cluster.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.datacenter.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.build.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDC && matchesVersion && matchesBuild && matchesSearch;
    });
  }, [data, filterDC, filterVersion, filterBuild, searchQuery]);

  const groupedByDC = useMemo(() => {
    const groups = {};
    filteredClusters.forEach((c) => {
      if (!groups[c.datacenter]) {
        groups[c.datacenter] = { clusters: [], totalHosts: 0 };
      }
      groups[c.datacenter].clusters.push(c);
      groups[c.datacenter].totalHosts += c.host_count;
    });
    return groups;
  }, [filteredClusters]);

  const totalFilteredHosts = filteredClusters.reduce((sum, c) => sum + c.host_count, 0);

  const openExportModal = () => {
    setExportVersions([...uniqueVersionList]);
    setShowExportModal(true);
  };

  const toggleExportVersion = (v) => {
    setExportVersions((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  };

  const handleExport = () => {
    const rows = (data?.clusters || []).filter((c) => exportVersions.includes(c.version));
    const header = ['Datacenter', 'Cluster', 'ESXi Hosts', 'Version', 'Build'];
    const lines = rows.map((c) =>
      [c.datacenter, c.cluster, c.host_count, c.version, c.build]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esxi-hosts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  return (
    <>
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="p-6 w-full max-w-sm shadow-2xl bg-white/95 dark:bg-slate-900/95">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold tracking-tight">Export ESXi Hosts</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Select ESXi version(s) to include in the export:</p>
            <div className="space-y-1 mb-5 max-h-60 overflow-y-auto">
              <button
                onClick={() =>
                  exportVersions.length === uniqueVersionList.length
                    ? setExportVersions([])
                    : setExportVersions([...uniqueVersionList])
                }
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors text-left"
              >
                {exportVersions.length === uniqueVersionList.length
                  ? <CheckSquare className="h-4 w-4 text-blue-500 shrink-0" />
                  : <Square className="h-4 w-4 text-slate-400 shrink-0" />}
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Select All</span>
              </button>
              <div className="border-t border-slate-200/70 dark:border-white/[0.07] pt-1">
                {uniqueVersionList.map((v) => (
                  <button
                    key={v}
                    onClick={() => toggleExportVersion(v)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors text-left"
                  >
                    {exportVersions.includes(v)
                      ? <CheckSquare className="h-4 w-4 text-blue-500 shrink-0" />
                      : <Square className="h-4 w-4 text-slate-400 shrink-0" />}
                    <span className="text-sm text-slate-700 dark:text-slate-200">{v}</span>
                    <span className="ml-auto text-xs text-slate-400">
                      {(data?.clusters || []).filter((c) => c.version === v).reduce((s, c) => s + c.host_count, 0)} hosts
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => setShowExportModal(false)}>Cancel</Button>
              <Button
                className="flex-1" variant="primary" icon={Download}
                disabled={exportVersions.length === 0} onClick={handleExport}
              >
                Export CSV
              </Button>
            </div>
          </Card>
        </div>
      )}

      <PageHeader
        title="ESXi Versions"
        subtitle={`${data?.summary?.total_hosts || 0} hosts across ${data?.summary?.total_clusters || 0} clusters`}
        actions={(
          <>
            {lastUpdated && (
              <span className="hidden sm:inline text-xs text-slate-500">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {data && (
              <Button size="sm" icon={Download} onClick={openExportModal}>Export</Button>
            )}
            <Button
              size="sm" variant="ghost" icon={RefreshCw} loading={loading}
              onClick={() => { setLoading(true); loadData(); }}
              title="Refresh now"
            />
          </>
        )}
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {loading && !data && <LoadingState label="Loading ESXi host data…" />}
        {error && <ErrorBanner message={error} />}

        {data && !loading && (
          <>
            {/* Search + filters */}
            <Toolbar>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search clusters, versions, builds…"
              />
              <Select value={filterDC} onChange={setFilterDC}>
                <option value="all">All Datacenters</option>
                {(data.summary?.datacenters || []).map((dc) => <option key={dc} value={dc}>{dc}</option>)}
              </Select>
              <Select value={filterVersion} onChange={setFilterVersion}>
                <option value="all">All Versions</option>
                {uniqueVersionList.map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
              <Select value={filterBuild} onChange={setFilterBuild}>
                <option value="all">All Builds</option>
                {uniqueBuildList.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            </Toolbar>

            {/* KPI cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard label="ESXi Hosts" value={totalFilteredHosts} sub="matching filters" />
              <KpiCard label="Clusters" value={filteredClusters.length} sub="matching filters" />
              <KpiCard label="Versions" value={uniqueVersionList.length} sub="distinct ESXi releases" />
              <KpiCard label="Datacenters" value={Object.keys(groupedByDC).length} sub="with matching clusters" />
            </div>

            {/* Table grouped by datacenter */}
            <Card className="overflow-hidden">
              {Object.keys(groupedByDC).length === 0 ? (
                <EmptyState
                  icon={Monitor}
                  title="No clusters match your search"
                  hint="Try clearing the search or switching filters."
                />
              ) : (
                <>
                  {Object.entries(groupedByDC)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([dc, dcData]) => (
                      <div key={dc} className="border-b border-slate-200/70 dark:border-white/[0.07] last:border-0">
                        <GroupRow
                          expanded={!!expandedDCs[dc]}
                          onToggle={() => toggleDC(dc)}
                          icon={Building2}
                          title={dc}
                          titleClass={dcTextClass(dc)}
                          meta={(
                            <>
                              <span><span className="font-semibold text-slate-700 dark:text-slate-200">{dcData.clusters.length}</span> clusters</span>
                              <span><span className="font-semibold text-slate-700 dark:text-slate-200">{dcData.totalHosts}</span> hosts</span>
                            </>
                          )}
                        />
                        <GroupBody expanded={!!expandedDCs[dc]}>
                          <div className="px-2 pb-2">
                            <Table>
                              <THead>
                                <Th>Cluster</Th>
                                <Th align="center">ESXi Hosts</Th>
                                <Th align="center">Version</Th>
                                <Th align="center">Build</Th>
                              </THead>
                              <TBody>
                                {dcData.clusters.map((cluster, idx) => (
                                  <Tr key={idx}>
                                    <Td className="font-medium text-slate-800 dark:text-slate-100">{cluster.cluster}</Td>
                                    <Td align="center">
                                      <Badge variant="success">{cluster.host_count}</Badge>
                                    </Td>
                                    <Td align="center" className="text-slate-600 dark:text-slate-300">{cluster.version}</Td>
                                    <Td align="center" className="font-mono tabular-nums text-slate-500">{cluster.build}</Td>
                                  </Tr>
                                ))}
                              </TBody>
                            </Table>
                          </div>
                        </GroupBody>
                      </div>
                    ))}
                  <div className="px-4 py-3 border-t border-slate-200/70 dark:border-white/[0.07] text-xs text-slate-500">
                    Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredClusters.length}</span> clusters ·{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{totalFilteredHosts}</span> hosts
                  </div>
                </>
              )}
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default VMwareToolsPage;
