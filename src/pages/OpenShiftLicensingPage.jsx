import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Server, Building2, RefreshCw, Layers, ChevronDown, ChevronRight, Download } from 'lucide-react';
import ExcelJS from 'exceljs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import { fetchOcpVcpuSummary, fetchOcpVcpuHistory } from '../api';
import {
  PageHeader, Button, Badge, KpiCard, Card, CardHeader, SearchInput,
  Table, THead, TBody, Th, Tr, Td, GroupBody,
  LoadingState, ErrorBanner, EmptyState,
} from '../components/ui';
import { classifyDC } from '../dcColors';

const ENV_COLORS = {
  prd: '#ef4444',
  dev: '#3b82f6',
  test: '#f59e0b',
};

const DC_ENV_COLORS = {
  'SITE2-prd':  '#ef4444',
  'SITE2-dev':  '#3b82f6',
  'SITE2-test': '#f59e0b',
  'SITE1-prd':   '#f97316',
  'SITE1-dev':   '#a855f7',
  'SITE1-test':  '#10b981',
};

function OpenShiftLicensingPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [expandedDCs, setExpandedDCs] = useState({});
  const [expandedClusters, setExpandedClusters] = useState({});
  const [vmSearch, setVmSearch] = useState('');
  const [history, setHistory] = useState(null);
  const [historyDays, setHistoryDays] = useState(30);
  const initialLoad = useRef(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchOcpVcpuSummary();
      setData(result);
      setLastUpdated(new Date());
      initialLoad.current = false;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchOcpVcpuHistory(historyDays).then(setHistory).catch(() => {});
  }, [historyDays]);

  const chartData = useMemo(() => {
    if (!data?.clusters) return [];
    return data.clusters.map((c) => ({
      name: c.cluster.replace('-OPENSHIFT-', '-OCP-'),
      total: c.total_vcpus,
      workers: c.total_workers,
      environment: c.environment,
      datacenter: c.datacenter,
    }));
  }, [data]);

  const vmsByDcCluster = useMemo(() => {
    if (!data?.vms) return {};
    const grouped = {};
    data.vms.forEach((vm) => {
      const dc = vm.datacenter;
      const cl = vm.cluster;
      if (!grouped[dc]) grouped[dc] = {};
      if (!grouped[dc][cl]) grouped[dc][cl] = [];
      grouped[dc][cl].push(vm);
    });
    return grouped;
  }, [data]);

  const filteredVmsByDcCluster = useMemo(() => {
    if (!vmSearch.trim()) return vmsByDcCluster;
    const q = vmSearch.toLowerCase();
    const filtered = {};
    Object.entries(vmsByDcCluster).forEach(([dc, clusters]) => {
      Object.entries(clusters).forEach(([cl, vms]) => {
        const matched = vms.filter((v) => v.name.toLowerCase().includes(q));
        if (matched.length) {
          if (!filtered[dc]) filtered[dc] = {};
          filtered[dc][cl] = matched;
        }
      });
    });
    return filtered;
  }, [vmsByDcCluster, vmSearch]);

  const toggleDC = (dc) => setExpandedDCs((p) => ({ ...p, [dc]: !p[dc] }));
  const toggleCluster = (key) => setExpandedClusters((p) => ({ ...p, [key]: !p[key] }));

  const dcBreakdown = useMemo(() => {
    if (!data?.summary?.by_dc) return [];
    return Object.entries(data.summary.by_dc).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const historyChartData = useMemo(() => {
    if (!history?.series?.length) return { points: [], lines: [] };
    const tsMap = {};
    const lineMap = {};

    history.series.forEach((s) => {
      const key = `${s.datacenter} ${s.environment}`;
      if (!lineMap[key]) lineMap[key] = { key, dc: s.datacenter, env: s.environment };
      s.data.forEach((pt) => {
        const hour = pt.ts.slice(0, 13);
        if (!tsMap[hour]) tsMap[hour] = { hour };
        tsMap[hour][key] = (tsMap[hour][key] || 0) + pt.total_vcpus;
      });
    });

    const points = Object.values(tsMap)
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .map(({ hour, ...rest }) => ({
        time: new Date(hour + ':00:00Z').toLocaleString([], {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
        }),
        ...rest,
      }));

    const lines = Object.values(lineMap).sort((a, b) => a.key.localeCompare(b.key));
    return { points, lines };
  }, [history]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl p-3 shadow-xl">
        <p className="text-sm font-semibold text-white mb-1.5">{label}</p>
        <div className="flex items-center justify-between gap-6 text-xs">
          <span className="text-slate-300">vCPUs</span>
          <span className="text-white font-bold">{payload[0]?.value?.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-6 text-xs mt-1">
          <span className="text-slate-300">Workers</span>
          <span className="text-slate-400">{payload[0]?.payload?.workers}</span>
        </div>
      </div>
    );
  };

  const exportToExcel = useCallback(async () => {
    if (!data) return;

    const summaryRows = data.clusters.map((c) => ({
      Cluster: c.cluster,
      Datacenter: c.datacenter,
      Environment: c.environment,
      'Total Workers': c.total_workers,
      'Total vCPUs': c.total_vcpus,
    }));
    summaryRows.push({
      Cluster: 'TOTAL',
      Datacenter: '',
      Environment: '',
      'Total Workers': data.summary.total_workers,
      'Total vCPUs': data.summary.total_vcpus,
    });

    const vmRows = (data.vms || []).map((vm) => ({
      'Worker Node': vm.name,
      Cluster: vm.cluster,
      Datacenter: vm.datacenter,
      vCPUs: vm.vcpus,
    }));

    const wb = new ExcelJS.Workbook();

    const addSheet = (workbook, name, rows) => {
      const ws = workbook.addWorksheet(name);
      ws.columns = Object.keys(rows[0] || {}).map((key) => ({
        header: key,
        key,
        width: Math.max(key.length, ...rows.map((r) => String(r[key] ?? '').length)) + 2,
      }));
      ws.addRows(rows);
    };

    addSheet(wb, 'Cluster Summary', summaryRows);
    addSheet(wb, 'Worker Nodes', vmRows);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OpenShift_vCPU_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <>
      <PageHeader
        title="OpenShift Licensing"
        subtitle={`${data?.summary?.total_workers || 0} worker nodes across ${data?.summary?.total_clusters || 0} clusters`}
        actions={(
          <>
            {lastUpdated && (
              <span className="hidden sm:inline text-xs text-slate-500">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {data && <Button size="sm" icon={Download} onClick={exportToExcel}>Export</Button>}
            <Button
              size="sm" variant="ghost" icon={RefreshCw} loading={loading}
              onClick={() => { setLoading(true); loadData(); }}
              title="Refresh now"
            />
          </>
        )}
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {loading && !data && <LoadingState label="Loading OpenShift vCPU data…" />}
        {error && <ErrorBanner message={error} />}

        {data && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard label="Total vCPUs" value={data.summary.total_vcpus.toLocaleString()} sub="licensed worker capacity" />
              <KpiCard label="Worker Nodes" value={data.summary.total_workers.toLocaleString()} sub="powered-on workers" />
              <KpiCard label="OCP Clusters" value={data.summary.total_clusters} sub="tracked clusters" />
              <KpiCard label="Datacenters" value={dcBreakdown.length} sub="running OpenShift" />
            </div>

            {/* Per-DC breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dcBreakdown.map(([dc, info]) => (
                <Card key={dc} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{dc}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">{info.clusters} clusters</span>
                      <span className="text-lg font-semibold tabular-nums text-rose-500 dark:text-rose-400">
                        {info.total_vcpus.toLocaleString()}
                        <span className="text-xs font-normal text-slate-500 ml-1">vCPUs</span>
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {['prd', 'dev', 'test'].map((env) => {
                      const envData = info.envs?.[env];
                      return (
                        <div key={env} className="rounded-lg border border-slate-200/60 dark:border-white/[0.06] bg-slate-500/[0.04] dark:bg-white/[0.03] p-3 text-center">
                          <p className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: ENV_COLORS[env] }}>{env}</p>
                          <p className="text-xl font-semibold tabular-nums" style={{ color: ENV_COLORS[env] }}>
                            {(envData?.vcpus || 0).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{envData?.count || 0} workers</p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>

            {/* Bar Chart */}
            <Card className="p-5">
              <CardHeader title="vCPUs by Cluster" />
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                      tickLine={false}
                      angle={-25}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]} name="vCPUs">
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={DC_ENV_COLORS[`${entry.datacenter}-${entry.environment}`] || '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Worker Count History */}
            <Card className="p-5">
              <CardHeader
                title="Worker Node Count History"
                action={(
                  <div className="flex items-center gap-1.5">
                    {[7, 14, 30].map((d) => (
                      <button
                        key={d}
                        onClick={() => setHistoryDays(d)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          historyDays === d
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                            : 'text-slate-500 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] border border-transparent'
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                )}
              />
              <div className="mt-4">
                {historyChartData.points.length === 0 ? (
                  <EmptyState
                    title="No historical data yet"
                    hint="Snapshots are taken every hour — check back soon."
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={historyChartData.points} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                        tickLine={false}
                        allowDecimals={false}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15,23,42,0.95)',
                          border: '1px solid rgba(71,85,105,0.5)',
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        itemStyle={{ color: '#e2e8f0' }}
                        formatter={(val, name) => [`${val.toLocaleString()} vCPUs`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {historyChartData.lines.map(({ key, dc, env }) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          name={key}
                          stroke={DC_ENV_COLORS[`${dc}-${env}`] || '#94a3b8'}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              {history?.total_snapshots > 0 && (
                <p className="text-[10px] text-slate-500 mt-2 text-right">
                  {history.total_snapshots.toLocaleString()} snapshots stored
                </p>
              )}
            </Card>

            {/* Cluster Detail */}
            <Card className="overflow-hidden">
              <CardHeader className="px-5 pt-5 pb-3" title="Cluster Detail" />
              <Table>
                <THead>
                  <Th>Cluster</Th>
                  <Th align="center">DC</Th>
                  <Th align="center">Env</Th>
                  <Th align="center">Workers</Th>
                  <Th align="center">Total vCPUs</Th>
                </THead>
                <TBody>
                  {data.clusters.map((c) => (
                    <Tr key={c.cluster}>
                      <Td className="font-medium text-slate-800 dark:text-slate-100">{c.cluster}</Td>
                      <Td align="center">
                        <Badge variant={{ SITE1: 'site1', SITE2: 'site2' }[classifyDC(c.datacenter)] || 'info'}>
                          {c.datacenter}
                        </Badge>
                      </Td>
                      <Td align="center">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border"
                          style={{
                            backgroundColor: `${ENV_COLORS[c.environment]}14`,
                            borderColor: `${ENV_COLORS[c.environment]}40`,
                            color: ENV_COLORS[c.environment],
                          }}
                        >
                          {c.environment}
                        </span>
                      </Td>
                      <Td align="center" className="tabular-nums font-medium">{c.total_workers}</Td>
                      <Td align="center" className="tabular-nums font-semibold text-rose-500 dark:text-rose-400">
                        {c.total_vcpus.toLocaleString()}
                      </Td>
                    </Tr>
                  ))}
                  <tr className="bg-slate-100/60 dark:bg-white/[0.03] font-semibold">
                    <Td className="text-sm">TOTAL</Td>
                    <Td align="center" />
                    <Td align="center" />
                    <Td align="center" className="tabular-nums">{data.summary.total_workers}</Td>
                    <Td align="center" className="tabular-nums text-rose-500 dark:text-rose-400">
                      {data.summary.total_vcpus.toLocaleString()}
                    </Td>
                  </tr>
                </TBody>
              </Table>
              {(data.summary.powered_off_excluded > 0 || data.summary.non_ocp_excluded > 0) && (
                <div className="px-5 py-3 border-t border-slate-200/70 dark:border-white/[0.07] text-xs text-slate-500">
                  {data.summary.powered_off_excluded > 0 && (
                    <span>{data.summary.powered_off_excluded} powered-off worker VMs excluded. </span>
                  )}
                  {data.summary.non_ocp_excluded > 0 && (
                    <span>{data.summary.non_ocp_excluded} non-OpenShift worker VMs excluded.</span>
                  )}
                </div>
              )}
            </Card>

            {/* Collapsible Worker Node Detail */}
            <Card className="overflow-hidden">
              <button
                onClick={() => {
                  setDetailOpen((p) => !p);
                  if (!detailOpen) {
                    const dcs = {};
                    const cls = {};
                    Object.keys(vmsByDcCluster).forEach((dc) => {
                      dcs[dc] = true;
                      Object.keys(vmsByDcCluster[dc]).forEach((cl) => { cls[`${dc}|${cl}`] = true; });
                    });
                    setExpandedDCs(dcs);
                    setExpandedClusters(cls);
                  }
                }}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${detailOpen ? '' : '-rotate-90'}`} />
                  <Server className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Worker Node Details</span>
                </div>
                <span className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{data.summary.total_workers}</span> VMs
                </span>
              </button>

              <GroupBody expanded={detailOpen}>
                <div className="px-5 pb-5">
                  <SearchInput
                    className="mb-4"
                    value={vmSearch}
                    onChange={setVmSearch}
                    placeholder="Search worker nodes…"
                  />

                  {Object.keys(filteredVmsByDcCluster).length === 0 ? (
                    <p className="text-center py-6 text-slate-500 text-sm">No worker nodes match your search</p>
                  ) : (
                    Object.entries(filteredVmsByDcCluster)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([dc, clusters]) => {
                        const dcVmCount = Object.values(clusters).reduce((s, vms) => s + vms.length, 0);
                        const dcVcpuCount = Object.values(clusters).reduce((s, vms) => s + vms.reduce((ss, v) => ss + v.vcpus, 0), 0);
                        return (
                          <div key={dc} className="mb-2">
                            <button
                              onClick={() => toggleDC(dc)}
                              className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                {expandedDCs[dc]
                                  ? <ChevronDown className="h-4 w-4 text-slate-400" />
                                  : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                <Building2 className="h-4 w-4 text-slate-400" />
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">{dc}</span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span><span className="font-semibold text-slate-700 dark:text-slate-200">{dcVmCount}</span> workers</span>
                                <span><span className="font-semibold text-rose-500 dark:text-rose-400">{dcVcpuCount.toLocaleString()}</span> vCPUs</span>
                              </div>
                            </button>

                            {expandedDCs[dc] && (
                              <div className="ml-4">
                                {Object.entries(clusters)
                                  .sort(([a], [b]) => a.localeCompare(b))
                                  .map(([cl, vms]) => {
                                    const clKey = `${dc}|${cl}`;
                                    const clVcpus = vms.reduce((s, v) => s + v.vcpus, 0);
                                    return (
                                      <div key={cl} className="mb-1">
                                        <button
                                          onClick={() => toggleCluster(clKey)}
                                          className="w-full flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-colors"
                                        >
                                          <div className="flex items-center gap-2">
                                            {expandedClusters[clKey]
                                              ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                                              : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
                                            <Layers className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cl}</span>
                                          </div>
                                          <div className="flex items-center gap-4 text-xs text-slate-500">
                                            <span><span className="font-semibold text-slate-700 dark:text-slate-200">{vms.length}</span> workers</span>
                                            <span><span className="font-semibold text-rose-500 dark:text-rose-400">{clVcpus.toLocaleString()}</span> vCPUs</span>
                                          </div>
                                        </button>

                                        {expandedClusters[clKey] && (
                                          <div className="ml-6 mb-2">
                                            <table className="w-full">
                                              <thead>
                                                <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                                                  <th className="text-left py-1.5 px-2 font-medium">Worker Node</th>
                                                  <th className="text-center py-1.5 px-2 font-medium w-20">vCPUs</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-200/50 dark:divide-white/[0.04]">
                                                {vms.map((vm) => (
                                                  <tr key={vm.name} className="hover:bg-slate-100/50 dark:hover:bg-white/[0.03] transition-colors">
                                                    <td className="py-1.5 px-2">
                                                      <span className="text-xs font-mono text-slate-600 dark:text-slate-300">{vm.name}</span>
                                                    </td>
                                                    <td className="py-1.5 px-2 text-center">
                                                      <span className="text-xs font-medium tabular-nums text-rose-500 dark:text-rose-400">{vm.vcpus}</span>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </GroupBody>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default OpenShiftLicensingPage;
