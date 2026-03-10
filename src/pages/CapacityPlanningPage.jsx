import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import {
  BarChart3, RefreshCw, Server, Building2, Cpu, MemoryStick, HardDrive, Clock,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from 'recharts';
import { fetchCapacity } from '../api';

const STATUS_COLORS = {
  ok:       { bar: '#22c55e', bg: 'bg-green-500/20',  text: 'text-green-400' },
  warning:  { bar: '#eab308', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  critical: { bar: '#ef4444', bg: 'bg-red-500/20',    text: 'text-red-400' },
};

const SERIES_COLORS = [
  '#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b',
  '#ef4444','#ec4899','#14b8a6','#6366f1','#f97316',
];

function getStatus(pct) {
  if (pct >= 85) return 'critical';
  if (pct >= 70) return 'warning';
  return 'ok';
}

function UtilBar({ pct, label }) {
  const status = getStatus(pct);
  return (
    <div className="flex items-center space-x-2">
      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            status === 'critical' ? 'bg-red-500' : status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-mono min-w-[3rem] text-right ${STATUS_COLORS[status].text}`}>
        {label}
      </span>
    </div>
  );
}

function ClusterChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-2xl text-xs">
      <p className="font-semibold text-slate-900 dark:text-white mb-1">{d.name}</p>
      <p className="text-slate-500">{d.datacenter}</p>
      <div className="mt-2 space-y-1">
        {d.cpu_pct !== undefined && <p>CPU: <span className={STATUS_COLORS[getStatus(d.cpu_pct)].text}>{d.cpu_pct}%</span></p>}
        {d.memory_pct !== undefined && <p>Memory: <span className={STATUS_COLORS[getStatus(d.memory_pct)].text}>{d.memory_pct}%</span></p>}
        {d.num_hosts !== undefined && <p>Hosts: {d.num_hosts}</p>}
      </div>
    </div>
  );
}

function TimeSeriesChart({ title, series, icon: Icon, color }) {
  const { theme } = useTheme();
  const chartTickLabel = theme === 'dark' ? '#cbd5e1' : '#1e293b';
  const chartGrid = theme === 'dark' ? '#334155' : '#b8c4d0';

  if (!series || series.length === 0) {
    return (
      <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-6 flex items-center justify-center min-h-[300px]">
        <p className="text-sm text-slate-500">No data available</p>
      </div>
    );
  }

  // Build chart data from samples
  const chartData = [];
  const allTimestamps = new Set();
  series.forEach((s) => {
    (s.samples || []).forEach((pt) => allTimestamps.add(pt.t));
  });
  const sortedTimestamps = [...allTimestamps].sort();
  
  sortedTimestamps.forEach((t) => {
    const point = { t, time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    series.forEach((s) => {
      const sample = (s.samples || []).find((pt) => pt.t === t);
      point[s.name] = sample ? sample.v : null;
    });
    chartData.push(point);
  });

  return (
    <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-6">
      <div className="flex items-center space-x-2.5 mb-4">
        <div className={`${color.bg} p-1.5 rounded-lg`}>
          <Icon className={`h-4 w-4 ${color.text}`} />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-wide">{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
          <XAxis
            dataKey="time"
            tick={{ fill: chartTickLabel, fontSize: 10 }}
            interval={Math.max(0, Math.floor(chartData.length / 6))}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: chartTickLabel, fontSize: 10 }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: theme === 'dark' ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
              border: `1px solid ${theme === 'dark' ? '#334155' : '#cbd5e1'}`,
              borderRadius: 12,
              fontSize: 11,
            }}
          />
          {series.slice(0, 10).map((s, i) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              dot={false}
              strokeWidth={1.5}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-2">
        {series.slice(0, 10).map((s, i) => (
          <span key={s.name} className="flex items-center space-x-1 text-[10px] text-slate-400">
            <span className="w-2 h-2 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
            <span className="truncate max-w-[120px]">{s.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TopHostTable({ title, hosts, pctKey, valueKey, capacityKey, valueLabel, formatValue, icon: Icon, color }) {
  if (!hosts || hosts.length === 0) return null;
  return (
    <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/10 dark:border-white/5 flex items-center space-x-2.5">
        <div className={`${color.bg} p-1.5 rounded-lg`}>
          <Icon className={`h-4 w-4 ${color.text}`} />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-wide">{title}</h3>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
              <th className="text-left py-2 px-3 font-medium">#</th>
              <th className="text-left py-2 px-3 font-medium">Host</th>
              <th className="text-right py-2 px-3 font-medium">{valueLabel}</th>
              <th className="text-left py-2 px-3 font-medium" style={{ minWidth: 120 }}>Utilization</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 dark:divide-white/5">
            {hosts.slice(0, 25).map((h, idx) => (
              <tr key={idx} className="hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                <td className="py-2 px-3 text-slate-500 font-mono">{idx + 1}</td>
                <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-200 truncate max-w-[180px]" title={h.host_name}>{h.host_name}</td>
                <td className="py-2 px-3 text-right text-slate-400 font-mono">{formatValue(h[valueKey])}</td>
                <td className="py-2 px-3"><UtilBar pct={h[pctKey]} label={`${h[pctKey]}%`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopVMTable({ title, vms, valueKey, capacityKey, valueLabel, formatValue, icon: Icon, color }) {
  if (!vms || vms.length === 0) return null;
  return (
    <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/10 dark:border-white/5 flex items-center space-x-2.5">
        <div className={`${color.bg} p-1.5 rounded-lg`}>
          <Icon className={`h-4 w-4 ${color.text}`} />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-wide">{title}</h3>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
              <th className="text-left py-2 px-3 font-medium">#</th>
              <th className="text-left py-2 px-3 font-medium">VM</th>
              <th className="text-right py-2 px-3 font-medium">{valueLabel}</th>
              <th className="text-left py-2 px-3 font-medium" style={{ minWidth: 120 }}>Utilization</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 dark:divide-white/5">
            {vms.slice(0, 25).map((v, idx) => {
              const pct = v[capacityKey] > 0 ? Math.round((v[valueKey] / v[capacityKey]) * 100) : 0;
              return (
                <tr key={idx} className="hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                  <td className="py-2 px-3 text-slate-500 font-mono">{idx + 1}</td>
                  <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-200 truncate max-w-[180px]" title={v.vm_name}>{v.vm_name}</td>
                  <td className="py-2 px-3 text-right text-slate-400 font-mono">{formatValue(v[valueKey])}</td>
                  <td className="py-2 px-3"><UtilBar pct={pct} label={`${pct}%`} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CapacityPlanningPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filterDC, setFilterDC] = useState('all');
  const [cpuChartSort, setCpuChartSort] = useState('desc');
  const [cpuChartMode, setCpuChartMode] = useState('top10');
  const [memChartSort, setMemChartSort] = useState('desc');
  const [memChartMode, setMemChartMode] = useState('top10');
  const { theme } = useTheme();

  const loadData = useCallback(async () => {
    try {
      const result = await fetchCapacity();
      setData(result);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredClusters = useMemo(() => {
    if (!data?.clusters) return [];
    if (filterDC === 'all') return data.clusters;
    return data.clusters.filter((c) => c.datacenter === filterDC);
  }, [data, filterDC]);

  const groupedByDC = useMemo(() => {
    const groups = {};
    filteredClusters.forEach((c) => {
      if (!groups[c.datacenter]) groups[c.datacenter] = [];
      groups[c.datacenter].push(c);
    });
    return groups;
  }, [filteredClusters]);

  const cpuChartData = useMemo(() => {
    let sorted = [...filteredClusters].sort((a, b) =>
      cpuChartSort === 'desc' ? b.cpu_pct - a.cpu_pct : a.cpu_pct - b.cpu_pct
    );
    return cpuChartMode === 'top10' ? sorted.slice(0, 10) : sorted;
  }, [filteredClusters, cpuChartSort, cpuChartMode]);

  const memChartData = useMemo(() => {
    let sorted = [...filteredClusters].sort((a, b) =>
      memChartSort === 'desc' ? b.memory_pct - a.memory_pct : a.memory_pct - b.memory_pct
    );
    return memChartMode === 'top10' ? sorted.slice(0, 10) : sorted;
  }, [filteredClusters, memChartSort, memChartMode]);

  const filteredTotalHosts = useMemo(() => {
    if (filterDC === 'all') return data?.summary?.total_hosts || 0;
    return filteredClusters.reduce((sum, c) => sum + (c.num_hosts || 0), 0);
  }, [data, filterDC, filteredClusters]);

  const filteredTotalVMs = useMemo(() => {
    if (filterDC === 'all') return data?.summary?.total_vms || 0;
    return (data?.all_vms || []).filter((v) => v.datacenter === filterDC).length;
  }, [data, filterDC]);

  const filteredDsClusters = useMemo(() => {
    const ds = data?.ds_clusters || [];
    if (filterDC === 'all') return ds;
    return ds.filter((d) => d.datacenter === filterDC);
  }, [data, filterDC]);

  const chartTickLabel = theme === 'dark' ? '#cbd5e1' : '#1e293b';
  const chartTickAxis = theme === 'dark' ? '#94a3b8' : '#475569';
  const chartGrid = theme === 'dark' ? '#334155' : '#b8c4d0';
  const chartCursor = theme === 'dark' ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.06)';

  const fmtMhz = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)} GHz` : `${v} MHz`;
  const fmtMB = (v) => v >= 1024 ? `${(v / 1024).toFixed(1)} GB` : `${v} MB`;

  return (
    <>
      {/* Header */}
      <div className="liquid-glass liquid-glass-shimmer rounded-2xl mx-4 sm:mx-6 lg:mx-8 mt-6 relative overflow-hidden">
        <div className="relative w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-500/10 p-2.5 rounded-xl">
                  <BarChart3 className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Capacity Planning</h1>
                  <p className="text-sm text-slate-500">
                    {filteredClusters.length} clusters &bull; {filteredTotalHosts} hosts &bull; {filteredTotalVMs} VMs
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
                className="p-2 hover:bg-white/20 dark:hover:bg-white/5 rounded-lg transition-colors"
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            <span className="ml-3 text-slate-500 dark:text-slate-400">Cache is warming up, please wait...</span>
          </div>
        )}

        {data && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <select
                value={filterDC}
                onChange={(e) => setFilterDC(e.target.value)}
                className="px-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="all">All Datacenters</option>
                {(data.summary?.datacenters || []).map((dc) => (
                  <option key={dc} value={dc}>{dc}</option>
                ))}
              </select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-5">
                <div className="flex items-center space-x-3">
                  <div className="bg-cyan-500/10 p-2.5 rounded-xl">
                    <Server className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{filteredTotalHosts}</p>
                    <p className="text-xs text-slate-500 mt-0.5">ESXi Hosts</p>
                  </div>
                </div>
              </div>
              <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-5">
                <div className="flex items-center space-x-3">
                  <div className="bg-emerald-500/10 p-2.5 rounded-xl">
                    <Building2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{filteredTotalVMs}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Powered-On VMs</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ Cluster Overview ═══ */}
            <div className="mb-10">
              <div className="flex items-center space-x-4 mb-8">
                <div className="h-[2px] flex-1 bg-gradient-to-r from-blue-500/60 to-transparent" />
                <h2 className="text-xl font-extrabold uppercase tracking-widest text-slate-900 dark:text-white whitespace-nowrap border border-blue-500/30 dark:border-blue-400/30 bg-blue-50/60 dark:bg-blue-500/10 px-6 py-2 rounded-lg">Cluster Overview</h2>
                <div className="h-[2px] flex-1 bg-gradient-to-l from-blue-500/60 to-transparent" />
              </div>

              {/* Per-DC cluster tables */}
              <div className={`grid gap-6 mb-8 ${filterDC === 'all' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                {Object.entries(groupedByDC)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dc, clusters]) => (
                    <div key={dc} className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden flex flex-col">
                      <div className="px-4 py-3 border-b border-white/10 dark:border-white/5 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-cyan-400" />
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{dc}</h3>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          <span className="text-slate-900 dark:text-white font-medium">{clusters.length}</span> clusters
                        </span>
                      </div>
                      <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                            <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                              <th className="text-left py-2 px-3 font-medium">Cluster</th>
                              <th className="text-center py-2 px-2 font-medium">Hosts</th>
                              <th className="text-left py-2 px-2 font-medium" style={{ minWidth: 120 }}>CPU</th>
                              <th className="text-left py-2 px-2 font-medium" style={{ minWidth: 120 }}>Memory</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10 dark:divide-white/5">
                            {[...clusters].sort((a, b) => b.cpu_pct - a.cpu_pct).map((c, idx) => (
                              <tr key={idx} className="hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                                <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-200 truncate max-w-[140px]" title={c.name}>{c.name}</td>
                                <td className="py-2 px-2 text-center">
                                  <span className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-full font-medium">{c.num_hosts}</span>
                                </td>
                                <td className="py-2 px-2"><UtilBar pct={c.cpu_pct} label={`${c.cpu_pct}%`} /></td>
                                <td className="py-2 px-2"><UtilBar pct={c.memory_pct} label={`${c.memory_pct}%`} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
              </div>

              {/* CPU Bar Chart + Time Series */}
              {filteredClusters.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-wide">Clusters by CPU Utilization</h2>
                      <div className="flex items-center gap-2">
                        <select value={cpuChartSort} onChange={(e) => setCpuChartSort(e.target.value)} className="px-2 py-1 bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-lg text-xs text-slate-700 dark:text-white focus:outline-none">
                          <option value="desc">Highest</option>
                          <option value="asc">Lowest</option>
                        </select>
                        <select value={cpuChartMode} onChange={(e) => setCpuChartMode(e.target.value)} className="px-2 py-1 bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-lg text-xs text-slate-700 dark:text-white focus:outline-none">
                          <option value="top10">Top 10</option>
                          <option value="all">All</option>
                        </select>
                      </div>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
                      <ResponsiveContainer width="100%" height={Math.max(250, cpuChartData.length * 36)}>
                        <BarChart data={cpuChartData} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: chartTickAxis, fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                          <YAxis type="category" dataKey="name" width={160} tick={{ fill: chartTickLabel, fontSize: 11 }} tickFormatter={(v) => v.length > 22 ? v.slice(0, 20) + '...' : v} />
                          <Tooltip content={<ClusterChartTooltip />} cursor={{ fill: chartCursor }} />
                          <Bar dataKey="cpu_pct" radius={[0, 4, 4, 0]} maxBarSize={22}>
                            {cpuChartData.map((c, i) => (
                              <Cell key={i} fill={STATUS_COLORS[getStatus(c.cpu_pct)].bar} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <TimeSeriesChart
                    title="Cluster CPU Utilization Over Time"
                    series={data.cluster_cpu_series || []}
                    icon={Cpu}
                    color={{ bg: 'bg-blue-500/10', text: 'text-blue-400' }}
                  />
                </div>
              )}

              {/* Memory Bar Chart + Time Series */}
              {filteredClusters.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-wide">Clusters by Memory Utilization</h2>
                      <div className="flex items-center gap-2">
                        <select value={memChartSort} onChange={(e) => setMemChartSort(e.target.value)} className="px-2 py-1 bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-lg text-xs text-slate-700 dark:text-white focus:outline-none">
                          <option value="desc">Highest</option>
                          <option value="asc">Lowest</option>
                        </select>
                        <select value={memChartMode} onChange={(e) => setMemChartMode(e.target.value)} className="px-2 py-1 bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-lg text-xs text-slate-700 dark:text-white focus:outline-none">
                          <option value="top10">Top 10</option>
                          <option value="all">All</option>
                        </select>
                      </div>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
                      <ResponsiveContainer width="100%" height={Math.max(250, memChartData.length * 36)}>
                        <BarChart data={memChartData} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: chartTickAxis, fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                          <YAxis type="category" dataKey="name" width={160} tick={{ fill: chartTickLabel, fontSize: 11 }} tickFormatter={(v) => v.length > 22 ? v.slice(0, 20) + '...' : v} />
                          <Tooltip content={<ClusterChartTooltip />} cursor={{ fill: chartCursor }} />
                          <Bar dataKey="memory_pct" radius={[0, 4, 4, 0]} maxBarSize={22}>
                            {memChartData.map((c, i) => (
                              <Cell key={i} fill={STATUS_COLORS[getStatus(c.memory_pct)].bar} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <TimeSeriesChart
                    title="Cluster Memory Utilization Over Time"
                    series={data.cluster_mem_series || []}
                    icon={MemoryStick}
                    color={{ bg: 'bg-purple-500/10', text: 'text-purple-400' }}
                  />
                </div>
              )}

              {/* Datastore clusters */}
              {filteredDsClusters.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-white/10 dark:border-white/5 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="bg-indigo-500/10 p-1.5 rounded-lg">
                          <HardDrive className="h-4 w-4 text-indigo-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-wide">Top Datastore Clusters</h3>
                      </div>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                          <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                            <th className="text-left py-2.5 px-5 font-medium">#</th>
                            <th className="text-left py-2.5 px-3 font-medium">Name</th>
                            <th className="text-left py-2.5 px-3 font-medium">DC</th>
                            <th className="text-right py-2.5 px-3 font-medium">Capacity</th>
                            <th className="text-right py-2.5 px-3 font-medium">Free</th>
                            <th className="text-left py-2.5 px-3 font-medium" style={{ minWidth: 180 }}>Utilization</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10 dark:divide-white/5">
                          {filteredDsClusters.map((ds, idx) => (
                            <tr key={idx} className="hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                              <td className="py-2.5 px-5 text-xs text-slate-500 font-mono">{idx + 1}</td>
                              <td className="py-2.5 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[220px]" title={ds.name}>{ds.name}</td>
                              <td className="py-2.5 px-3 text-xs text-slate-500 dark:text-slate-400">{ds.datacenter}</td>
                              <td className="py-2.5 px-3 text-xs text-slate-400 font-mono text-right">{ds.capacity_gb >= 1024 ? `${(ds.capacity_gb / 1024).toFixed(1)} TB` : `${ds.capacity_gb} GB`}</td>
                              <td className="py-2.5 px-3 text-xs text-slate-400 font-mono text-right">{ds.free_gb >= 1024 ? `${(ds.free_gb / 1024).toFixed(1)} TB` : `${ds.free_gb} GB`}</td>
                              <td className="py-2.5 px-3"><UtilBar pct={ds.used_pct} label={`${ds.used_pct}%`} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <TimeSeriesChart
                    title="Datastore Cluster Storage Over Time"
                    series={data.ds_cluster_series || []}
                    icon={HardDrive}
                    color={{ bg: 'bg-indigo-500/10', text: 'text-indigo-400' }}
                  />
                </div>
              )}
            </div>

            {/* ═══ Hosts Overview ═══ */}
            <div className="mb-10">
              <div className="flex items-center space-x-4 mb-8">
                <div className="h-[2px] flex-1 bg-gradient-to-r from-cyan-500/60 to-transparent" />
                <h2 className="text-xl font-extrabold uppercase tracking-widest text-slate-900 dark:text-white whitespace-nowrap border border-cyan-500/30 dark:border-cyan-400/30 bg-cyan-50/60 dark:bg-cyan-500/10 px-6 py-2 rounded-lg">Hosts Overview</h2>
                <div className="h-[2px] flex-1 bg-gradient-to-l from-cyan-500/60 to-transparent" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <TopHostTable title="Top Hosts by CPU Utilization" hosts={data.top_cpu_hosts} pctKey="cpu_pct" valueKey="cpu_usage_mhz" capacityKey="cpu_capacity_mhz" valueLabel="CPU Usage" formatValue={fmtMhz} icon={Cpu} color={{ bg: 'bg-cyan-500/10', text: 'text-cyan-400' }} />
                <TimeSeriesChart title="Top Host CPU Over Time" series={data.host_cpu_series || []} icon={Cpu} color={{ bg: 'bg-cyan-500/10', text: 'text-cyan-400' }} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TopHostTable title="Top Hosts by Memory Utilization" hosts={data.top_mem_hosts} pctKey="memory_pct" valueKey="memory_usage_mb" capacityKey="memory_total_mb" valueLabel="Memory Usage" formatValue={fmtMB} icon={MemoryStick} color={{ bg: 'bg-amber-500/10', text: 'text-amber-400' }} />
                <TimeSeriesChart title="Top Host Memory Over Time" series={data.host_mem_series || []} icon={MemoryStick} color={{ bg: 'bg-amber-500/10', text: 'text-amber-400' }} />
              </div>
            </div>

            {/* ═══ VM Congestion ═══ */}
            <div className="mb-10">
              <div className="flex items-center space-x-4 mb-8">
                <div className="h-[2px] flex-1 bg-gradient-to-r from-orange-500/60 to-transparent" />
                <h2 className="text-xl font-extrabold uppercase tracking-widest text-slate-900 dark:text-white whitespace-nowrap border border-orange-500/30 dark:border-orange-400/30 bg-orange-50/60 dark:bg-orange-500/10 px-6 py-2 rounded-lg">VM Congestion</h2>
                <div className="h-[2px] flex-1 bg-gradient-to-l from-orange-500/60 to-transparent" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TimeSeriesChart title="Top VMs by CPU Ready" series={data.cpu_ready_series || []} icon={Clock} color={{ bg: 'bg-orange-500/10', text: 'text-orange-400' }} />
                <TimeSeriesChart title="Top VMs by Co-Stop" series={data.costop_series || []} icon={Clock} color={{ bg: 'bg-red-500/10', text: 'text-red-400' }} />
              </div>
            </div>

            {/* ═══ VM Utilization ═══ */}
            <div className="mb-10">
              <div className="flex items-center space-x-4 mb-8">
                <div className="h-[2px] flex-1 bg-gradient-to-r from-emerald-500/60 to-transparent" />
                <h2 className="text-xl font-extrabold uppercase tracking-widest text-slate-900 dark:text-white whitespace-nowrap border border-emerald-500/30 dark:border-emerald-400/30 bg-emerald-50/60 dark:bg-emerald-500/10 px-6 py-2 rounded-lg">VM Utilization</h2>
                <div className="h-[2px] flex-1 bg-gradient-to-l from-emerald-500/60 to-transparent" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <TopVMTable title="Top VMs by CPU Utilization" vms={data.top_cpu_vms} valueKey="cpu_usage_mhz" capacityKey="cpu_capacity_mhz" valueLabel="CPU Usage" formatValue={fmtMhz} icon={Cpu} color={{ bg: 'bg-blue-500/10', text: 'text-blue-400' }} />
                <TimeSeriesChart title="Top VM CPU Over Time" series={data.vm_cpu_series || []} icon={Cpu} color={{ bg: 'bg-blue-500/10', text: 'text-blue-400' }} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TopVMTable title="Top VMs by Memory Utilization" vms={data.top_mem_vms} valueKey="memory_usage_mb" capacityKey="memory_mb" valueLabel="Memory Usage" formatValue={fmtMB} icon={MemoryStick} color={{ bg: 'bg-purple-500/10', text: 'text-purple-400' }} />
                <TimeSeriesChart title="Top VM Memory Over Time" series={data.vm_mem_series || []} icon={MemoryStick} color={{ bg: 'bg-purple-500/10', text: 'text-purple-400' }} />
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default CapacityPlanningPage;
