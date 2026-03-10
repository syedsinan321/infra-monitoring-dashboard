import { useState, useEffect, useMemo, useCallback } from 'react';
import { ClipboardList, Search, RefreshCw, Server, Building2, ChevronDown, ChevronUp, ArrowUpDown, Calendar, Clock, Cpu } from 'lucide-react';
import { fetchHostInventory, syncHostInventory } from '../api';

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
      setSortDir(field === 'first_seen' ? 'desc' : 'asc');
    }
  };

  const hosts = useMemo(() => {
    if (!data?.hosts) return [];
    return data.hosts;
  }, [data]);

  const datacenters = useMemo(() => {
    return [...new Set(hosts.map((h) => h.datacenter).filter(Boolean))].sort();
  }, [hosts]);

  const clusters = useMemo(() => {
    const filtered = filterDC === 'all' ? hosts : hosts.filter((h) => h.datacenter === filterDC);
    return [...new Set(filtered.map((h) => h.cluster).filter(Boolean))].sort();
  }, [hosts, filterDC]);

  const filteredHosts = useMemo(() => {
    let result = hosts.filter((h) => {
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
      if (sortField === 'first_seen' || sortField === 'last_seen') {
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

  const activeCount = hosts.filter((h) => !h.removed).length;
  const removedCount = hosts.filter((h) => h.removed).length;

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const daysSince = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    const now = new Date();
    return Math.floor((now - d) / (1000 * 60 * 60 * 24));
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-slate-400 ml-1 inline" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3 text-blue-400 ml-1 inline" />
    ) : (
      <ChevronDown className="h-3 w-3 text-blue-400 ml-1 inline" />
    );
  };

  return (
    <>
      {/* Header */}
      <div className="liquid-glass liquid-glass-shimmer rounded-2xl mx-4 sm:mx-6 lg:mx-8 mt-6 relative overflow-hidden">
        <div className="relative w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-500/10 p-2.5 rounded-xl">
                  <ClipboardList className="h-6 w-6 text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Host Inventory</h1>
                  <p className="text-sm text-slate-500">
                    {activeCount} active hosts tracked
                    {removedCount > 0 && ` · ${removedCount} removed`}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {data?.last_sync && (
                <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Last sync {formatDateTime(data.last_sync)}
                </span>
              )}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center space-x-2 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                title="Sync now"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync Now'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            <span className="ml-3 text-slate-500 dark:text-slate-400">Loading host inventory...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl p-4 text-red-600 dark:text-red-400 mb-6">
            Error: {error}
          </div>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-indigo-500/10 p-2 rounded-lg">
                    <Server className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data.total || 0}</p>
                    <p className="text-xs text-slate-500">Total Tracked</p>
                  </div>
                </div>
              </div>
              <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-500/10 p-2 rounded-lg">
                    <Server className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{activeCount}</p>
                    <p className="text-xs text-slate-500">Active</p>
                  </div>
                </div>
              </div>
              <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-red-500/10 p-2 rounded-lg">
                    <Server className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{removedCount}</p>
                    <p className="text-xs text-slate-500">Removed</p>
                  </div>
                </div>
              </div>
              <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-cyan-500/10 p-2 rounded-lg">
                    <Building2 className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{datacenters.length}</p>
                    <p className="text-xs text-slate-500">Datacenters</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search hosts, clusters..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                />
              </div>
              <select value={filterDC} onChange={(e) => { setFilterDC(e.target.value); setFilterCluster('all'); }} className="px-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50">
                <option value="all">All Datacenters</option>
                {datacenters.map((dc) => (<option key={dc} value={dc}>{dc}</option>))}
              </select>
              <select value={filterCluster} onChange={(e) => setFilterCluster(e.target.value)} className="px-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50">
                <option value="all">All Clusters</option>
                {clusters.map((cl) => (<option key={cl} value={cl}>{cl}</option>))}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="removed">Removed</option>
              </select>
            </div>

            {/* Host Table */}
            <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/10 dark:border-white/5">
                      <th className="text-left py-3 px-4 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 select-none" onClick={() => toggleSort('host_name')}>Host Name <SortIcon field="host_name" /></th>
                      <th className="text-left py-3 px-4 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 select-none" onClick={() => toggleSort('datacenter')}>Datacenter <SortIcon field="datacenter" /></th>
                      <th className="text-left py-3 px-4 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 select-none" onClick={() => toggleSort('cluster')}>Cluster <SortIcon field="cluster" /></th>
                      <th className="text-center py-3 px-4 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 select-none" onClick={() => toggleSort('cpu_count')}><Cpu className="h-3 w-3 inline mr-1" />CPU Cores <SortIcon field="cpu_count" /></th>
                      <th className="text-center py-3 px-4 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 select-none" onClick={() => toggleSort('first_seen')}><Calendar className="h-3 w-3 inline mr-1" />First Seen <SortIcon field="first_seen" /></th>
                      <th className="text-center py-3 px-4 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 select-none" onClick={() => toggleSort('last_seen')}><Clock className="h-3 w-3 inline mr-1" />Last Seen <SortIcon field="last_seen" /></th>
                      <th className="text-center py-3 px-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 dark:divide-white/5">
                    {filteredHosts.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-500">No hosts match your filters.</td></tr>
                    ) : (
                      filteredHosts.map((host) => {
                        const days = daysSince(host.first_seen);
                        return (
                          <tr key={host.host_name} className={`hover:bg-white/20 dark:hover:bg-white/5 transition-colors ${host.removed ? 'opacity-60' : ''}`}>
                            <td className="py-2.5 px-4"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">{host.host_name}</span></td>
                            <td className="py-2.5 px-4"><span className="text-sm text-slate-600 dark:text-slate-300">{host.datacenter}</span></td>
                            <td className="py-2.5 px-4"><span className="text-sm text-slate-600 dark:text-slate-300">{host.cluster}</span></td>
                            <td className="py-2.5 px-4 text-center"><span className="text-sm text-slate-500 dark:text-slate-400 font-mono">{host.cpu_count || '—'}</span></td>
                            <td className="py-2.5 px-4 text-center">
                              <div className="text-sm text-slate-600 dark:text-slate-300">{formatDate(host.first_seen)}</div>
                              {days !== null && <div className="text-[11px] text-slate-400">{days === 0 ? 'Today' : `${days}d ago`}</div>}
                            </td>
                            <td className="py-2.5 px-4 text-center"><div className="text-sm text-slate-600 dark:text-slate-300">{formatDate(host.last_seen)}</div></td>
                            <td className="py-2.5 px-4 text-center">
                              {host.removed ? (
                                <span className="inline-flex items-center px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full text-xs font-medium">Removed</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-xs font-medium">Active</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {filteredHosts.length > 0 && (
                <div className="px-4 py-3 border-t border-white/10 dark:border-white/5 text-xs text-slate-500">
                  Showing {filteredHosts.length} of {data.total} hosts
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default HostInventoryPage;
