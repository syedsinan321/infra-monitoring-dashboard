import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { Wrench, Search, ChevronDown, ChevronRight, Building2, Monitor, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchVMs } from '../api';

const CHART_COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6',
  '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899',
  '#a855f7', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e',
];

function OsChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-2xl max-w-xs">
      <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2 break-words">{d.os}</p>
      <p className="text-xs text-purple-400 mb-3">{d.count} VM{d.count !== 1 ? 's' : ''}</p>
      {d.sampleVMs.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Sample VMs</p>
          {d.sampleVMs.map((vm) => (
            <p key={vm} className="text-xs text-slate-400 truncate">{vm}</p>
          ))}
          {d.count > d.sampleVMs.length && (
            <p className="text-xs text-slate-600 mt-0.5">+{d.count - d.sampleVMs.length} more</p>
          )}
        </div>
      )}
    </div>
  );
}

function VMToolsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDC, setFilterDC] = useState('all');
  const [filterOS, setFilterOS] = useState('all');
  const [filterTools, setFilterTools] = useState('all');
  const [expandedDCs, setExpandedDCs] = useState({});
  const [sortField, setSortField] = useState('vm_name');
  const [sortDir, setSortDir] = useState('asc');
  const [lastUpdated, setLastUpdated] = useState(null);
  const initialLoad = useRef(true);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchVMs();
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const uniqueOSList = useMemo(() => {
    if (!data?.vms) return [];
    return [...new Set(data.vms.map((vm) => vm.os || '').filter(Boolean))].sort();
  }, [data]);

  const uniqueToolsList = useMemo(() => {
    if (!data?.vms) return [];
    return [...new Set(data.vms.map((vm) => vm.tools_version || '').filter(Boolean))].sort();
  }, [data]);

  const filteredVMs = useMemo(() => {
    if (!data?.vms) return [];
    return data.vms.filter((vm) => {
      const matchesDC = filterDC === 'all' || vm.datacenter === filterDC;
      const matchesOS = filterOS === 'all' || vm.os === filterOS;
      const matchesTools =
        filterTools === 'all' ||
        (filterTools === 'missing' ? (!vm.tools_version || vm.tools_version === '0') : vm.tools_version === filterTools);
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        vm.vm_name.toLowerCase().includes(q) ||
        (vm.os || '').toLowerCase().includes(q) ||
        (vm.tools_version || '').toLowerCase().includes(q) ||
        (vm.datacenter || '').toLowerCase().includes(q);
      return matchesDC && matchesOS && matchesTools && matchesSearch;
    });
  }, [data, filterDC, filterOS, filterTools, searchQuery]);

  const groupedByDC = useMemo(() => {
    const groups = {};
    filteredVMs.forEach((vm) => {
      if (!groups[vm.datacenter]) groups[vm.datacenter] = [];
      groups[vm.datacenter].push(vm);
    });
    Object.values(groups).forEach((vms) => {
      vms.sort((a, b) => {
        const aVal = (a[sortField] || '').toLowerCase();
        const bVal = (b[sortField] || '').toLowerCase();
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    });
    return groups;
  }, [filteredVMs, sortField, sortDir]);

  const osChartData = useMemo(() => {
    if (!filteredVMs.length) return [];
    const groups = {};
    filteredVMs.forEach((vm) => {
      const os = vm.os || 'Unknown';
      if (!groups[os]) groups[os] = { vms: [], dcCounts: {} };
      groups[os].vms.push(vm.vm_name);
      groups[os].dcCounts[vm.datacenter] = (groups[os].dcCounts[vm.datacenter] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([os, info]) => ({
        os,
        count: info.vms.length,
        sampleVMs: info.vms.slice(0, 5),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredVMs]);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 text-slate-600 inline ml-1" />;
    return sortDir === 'asc' ? (
      <ChevronDown className="h-3 w-3 text-cyan-400 inline ml-1" />
    ) : (
      <ChevronRight className="h-3 w-3 text-cyan-400 inline ml-1 rotate-[-90deg]" />
    );
  };

  const { theme } = useTheme();
  const chartTickLabel = theme === 'dark' ? '#cbd5e1' : '#1e293b';
  const chartTickAxis = theme === 'dark' ? '#94a3b8' : '#475569';
  const chartGrid = theme === 'dark' ? '#334155' : '#b8c4d0';
  const chartCursor = theme === 'dark' ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <>
      {/* Header */}
      <div className="liquid-glass liquid-glass-shimmer rounded-2xl mx-4 sm:mx-6 lg:mx-8 mt-6 relative overflow-hidden">
        <div className="relative w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="bg-purple-500/10 p-2.5 rounded-xl">
                  <Wrench className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">VMware Tools</h1>
                  <p className="text-sm text-slate-500">
                    {data?.summary?.total_vms || 0} VMs across{' '}
                    {data?.summary?.datacenters?.length || 0} datacenters
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            <span className="ml-3 text-slate-500 dark:text-slate-400">Loading VM data...</span>
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
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search VMs, OS, tools version..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20"
                />
              </div>
              <select value={filterDC} onChange={(e) => setFilterDC(e.target.value)} className="px-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500/50">
                <option value="all">All Datacenters</option>
                {(data.summary?.datacenters || []).map((dc) => (<option key={dc} value={dc}>{dc}</option>))}
              </select>
              <select value={filterOS} onChange={(e) => setFilterOS(e.target.value)} className="px-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500/50">
                <option value="all">All OS</option>
                {uniqueOSList.map((os) => (<option key={os} value={os}>{os}</option>))}
              </select>
              <select value={filterTools} onChange={(e) => setFilterTools(e.target.value)} className="px-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-purple-500/50">
                <option value="all">All Tools Versions</option>
                <option value="missing">Missing / Not Installed</option>
                {uniqueToolsList.map((tv) => (<option key={tv} value={tv}>{tv}</option>))}
              </select>
            </div>

            {/* OS Distribution Chart */}
            {osChartData.length > 0 && (
              <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-6 mb-6">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">OS Distribution</h2>
                <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
                  <ResponsiveContainer width="100%" height={Math.max(250, osChartData.length * 32)}>
                    <BarChart data={osChartData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
                      <XAxis type="number" tick={{ fill: chartTickAxis, fontSize: 12 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="os" width={220} tick={{ fill: chartTickLabel, fontSize: 11 }} tickFormatter={(v) => v.length > 35 ? v.slice(0, 32) + '...' : v} />
                      <Tooltip content={<OsChartTooltip />} cursor={{ fill: chartCursor }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        {osChartData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-500/10 p-2 rounded-lg"><Monitor className="h-5 w-5 text-purple-400" /></div>
                  <div>
                    <p className="text-2xl font-bold">{filteredVMs.length}</p>
                    <p className="text-xs text-slate-500">Total VMs</p>
                  </div>
                </div>
              </div>
              <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-cyan-500/10 p-2 rounded-lg"><Building2 className="h-5 w-5 text-cyan-400" /></div>
                  <div>
                    <p className="text-2xl font-bold">{Object.keys(groupedByDC).length}</p>
                    <p className="text-xs text-slate-500">Datacenters</p>
                  </div>
                </div>
              </div>
              <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-amber-500/10 p-2 rounded-lg"><Wrench className="h-5 w-5 text-amber-400" /></div>
                  <div>
                    <p className="text-2xl font-bold">{filteredVMs.filter((v) => !v.tools_version || v.tools_version === '0').length}</p>
                    <p className="text-xs text-slate-500">Missing Tools</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Table grouped by datacenter */}
            <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
              {Object.keys(groupedByDC).length === 0 ? (
                <div className="px-6 py-8 text-center text-slate-500">No VMs match your search</div>
              ) : (
                Object.entries(groupedByDC)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dc, vms]) => (
                    <div key={dc} className="border-b border-slate-200 dark:border-slate-700/50 last:border-0">
                      <button
                        onClick={() => toggleDC(dc)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          {expandedDCs[dc] ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
                          <Building2 className="h-5 w-5 text-cyan-400" />
                          <span className="font-semibold text-lg">{dc}</span>
                        </div>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          <span className="text-slate-900 dark:text-white font-medium">{vms.length}</span> VMs
                        </span>
                      </button>

                      {expandedDCs[dc] && (
                        <div className="px-6 pb-4">
                          <div className="max-h-[600px] overflow-y-auto">
                            <table className="w-full">
                              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                                  <th className="text-left py-2 px-3 font-medium cursor-pointer hover:text-slate-300" onClick={() => handleSort('datacenter')}>Datacenter <SortIcon field="datacenter" /></th>
                                  <th className="text-left py-2 px-3 font-medium cursor-pointer hover:text-slate-300" onClick={() => handleSort('vm_name')}>VM <SortIcon field="vm_name" /></th>
                                  <th className="text-left py-2 px-3 font-medium cursor-pointer hover:text-slate-300" onClick={() => handleSort('os')}>OS <SortIcon field="os" /></th>
                                  <th className="text-center py-2 px-3 font-medium cursor-pointer hover:text-slate-300" onClick={() => handleSort('tools_version')}>Tools Version <SortIcon field="tools_version" /></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/10 dark:divide-white/5">
                                {vms.map((vm, idx) => (
                                  <tr key={idx} className="hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                                    <td className="py-2 px-3"><span className="text-xs text-slate-500 dark:text-slate-400">{vm.datacenter}</span></td>
                                    <td className="py-2 px-3"><span className="text-sm font-medium text-slate-700 dark:text-slate-200">{vm.vm_name}</span></td>
                                    <td className="py-2 px-3"><span className="text-sm text-slate-600 dark:text-slate-300">{vm.os || '—'}</span></td>
                                    <td className="py-2 px-3 text-center">
                                      <span className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-0.5 rounded-full text-sm font-mono ${
                                        !vm.tools_version || vm.tools_version === '0'
                                          ? 'bg-red-500/10 text-red-400'
                                          : 'bg-green-500/10 text-green-400'
                                      }`}>
                                        {vm.tools_version || '—'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
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

export default VMToolsPage;
