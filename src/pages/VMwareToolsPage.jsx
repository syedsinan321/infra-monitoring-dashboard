import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { Monitor, Search, RefreshCw, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { fetchEsxiHosts } from '../api';

function VMwareToolsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterDC, setFilterDC] = useState('all');
  const [filterVersion, setFilterVersion] = useState('all');
  const [filterBuild, setFilterBuild] = useState('all');
  const [expandedDCs, setExpandedDCs] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const initialLoad = useRef(true);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchEsxiHosts();
      setData(result);
      setLastUpdated(new Date());
      if (initialLoad.current) {
        const expanded = {};
        (result.summary?.datacenters || []).forEach((dc) => {
          expanded[dc] = true;
        });
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
  }, [loadData]);

  const toggleDC = (dc) => {
    setExpandedDCs((prev) => ({ ...prev, [dc]: !prev[dc] }));
  };

  const uniqueVersions = useMemo(() => {
    if (!data?.clusters) return [];
    return [...new Set(data.clusters.map((c) => c.version).filter(Boolean))].sort();
  }, [data]);

  const uniqueBuilds = useMemo(() => {
    if (!data?.clusters) return [];
    return [...new Set(data.clusters.map((c) => c.build).filter(Boolean))].sort();
  }, [data]);

  const filteredClusters = useMemo(() => {
    if (!data?.clusters) return [];
    return data.clusters.filter((c) => {
      const matchDC = filterDC === 'all' || c.datacenter === filterDC;
      const matchVersion = filterVersion === 'all' || c.version === filterVersion;
      const matchBuild = filterBuild === 'all' || c.build === filterBuild;
      return matchDC && matchVersion && matchBuild;
    });
  }, [data, filterDC, filterVersion, filterBuild]);

  const groupedByDC = useMemo(() => {
    const groups = {};
    filteredClusters.forEach((c) => {
      if (!groups[c.datacenter]) groups[c.datacenter] = [];
      groups[c.datacenter].push(c);
    });
    return groups;
  }, [filteredClusters]);

  const totalHosts = filteredClusters.reduce((s, c) => s + c.host_count, 0);

  return (
    <>
      {/* Header */}
      <div className="liquid-glass liquid-glass-shimmer rounded-2xl mx-4 sm:mx-6 lg:mx-8 mt-6 relative overflow-hidden">
        <div className="relative w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="bg-green-500/10 p-2.5 rounded-xl">
                  <Monitor className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">ESXi Build Versions</h1>
                  <p className="text-sm text-slate-500">
                    {totalHosts} hosts across {filteredClusters.length} clusters
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {lastUpdated && (
                <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={() => { setLoading(true); loadData(); }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Refresh now"
              >
                <RefreshCw className={`h-4 w-4 text-slate-500 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
            <span className="ml-3 text-slate-500 dark:text-slate-400">Loading ESXi version data...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl p-4 text-red-600 dark:text-red-400">
            Error: {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <select
                value={filterDC}
                onChange={(e) => setFilterDC(e.target.value)}
                className="px-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-green-500/50"
              >
                <option value="all">All Datacenters</option>
                {(data.summary?.datacenters || []).map((dc) => (
                  <option key={dc} value={dc}>{dc}</option>
                ))}
              </select>
              <select
                value={filterVersion}
                onChange={(e) => setFilterVersion(e.target.value)}
                className="px-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-green-500/50"
              >
                <option value="all">All Versions</option>
                {uniqueVersions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <select
                value={filterBuild}
                onChange={(e) => setFilterBuild(e.target.value)}
                className="px-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-green-500/50"
              >
                <option value="all">All Builds</option>
                {uniqueBuilds.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-500/10 p-2 rounded-lg">
                    <Monitor className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalHosts}</p>
                    <p className="text-xs text-slate-500">Total Hosts</p>
                  </div>
                </div>
              </div>
              <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-500/10 p-2 rounded-lg">
                    <Building2 className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{filteredClusters.length}</p>
                    <p className="text-xs text-slate-500">Clusters</p>
                  </div>
                </div>
              </div>
              <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-500/10 p-2 rounded-lg">
                    <Monitor className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{uniqueVersions.length}</p>
                    <p className="text-xs text-slate-500">Unique Versions</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Table grouped by datacenter */}
            <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
              {Object.keys(groupedByDC).length === 0 ? (
                <div className="px-6 py-8 text-center text-slate-500">
                  No clusters match your filters
                </div>
              ) : (
                Object.entries(groupedByDC)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dc, clusters]) => (
                    <div key={dc} className="border-b border-slate-200 dark:border-slate-700/50 last:border-0">
                      <button
                        onClick={() => toggleDC(dc)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          {expandedDCs[dc] ? (
                            <ChevronDown className="h-5 w-5 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-slate-400" />
                          )}
                          <Building2 className="h-5 w-5 text-cyan-400" />
                          <span className="font-semibold text-lg">{dc}</span>
                        </div>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          <span className="text-slate-900 dark:text-white font-medium">{clusters.length}</span> clusters &bull;{' '}
                          <span className="text-slate-900 dark:text-white font-medium">{clusters.reduce((s, c) => s + c.host_count, 0)}</span> hosts
                        </span>
                      </button>

                      {expandedDCs[dc] && (
                        <div className="px-6 pb-4">
                          <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                                <th className="text-left py-2 px-3 font-medium">Cluster</th>
                                <th className="text-left py-2 px-3 font-medium">Version</th>
                                <th className="text-left py-2 px-3 font-medium">Build</th>
                                <th className="text-center py-2 px-3 font-medium">Hosts</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10 dark:divide-white/5">
                              {clusters.map((c, idx) => (
                                <tr key={idx} className="hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                                  <td className="py-2 px-3">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{c.cluster}</span>
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                                      {c.version}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{c.build}</span>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-full text-sm font-medium">
                                      {c.host_count}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default VMwareToolsPage;
