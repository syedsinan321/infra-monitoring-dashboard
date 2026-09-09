import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Monitor, Download, X, CheckSquare, Square, Building2, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchVMs } from '../api';
import {
  PageHeader, Button, Badge, KpiCard, Card, CardHeader, SearchInput, Select, Toolbar,
  Table, THead, TBody, Th, Tr, Td, GroupRow, GroupBody,
  LoadingState, ErrorBanner, EmptyState,
} from '../components/ui';
import { dcTextClass } from '../dcColors';

const OS_CATEGORY_COLORS = {
  'Microsoft Windows': '#3b82f6',
  'RHEL': '#ef4444',
  'Ubuntu Linux': '#f97316',
  'SUSE Linux': '#22c55e',
  'VMware Photon': '#8b5cf6',
  'Other Linux': '#06b6d4',
  'Other': '#64748b',
};

const OS_CATEGORY_COLOR_DEFAULT = '#94a3b8';

const RADIAN = Math.PI / 180;
function renderOsLabel({ cx, cy, midAngle, outerRadius, percent, os }) {
  if (percent < 0.03) return null;
  const color = OS_CATEGORY_COLORS[os] || OS_CATEGORY_COLOR_DEFAULT;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 8) * cos;
  const sy = cy + (outerRadius + 8) * sin;
  const mx = cx + (outerRadius + 36) * cos;
  const my = cy + (outerRadius + 36) * sin;
  const ex = mx + (cos >= 0 ? 24 : -24);
  const ey = my;
  const anchor = cos >= 0 ? 'start' : 'end';
  const tx = ex + (cos >= 0 ? 5 : -5);
  const shortOS = os.length > 16 ? os.slice(0, 15) + '…' : os;
  return (
    <g>
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#94a3b8" fill="none" strokeWidth={1.5} />
      <circle cx={ex} cy={ey} r={2.5} fill="#94a3b8" />
      <text x={tx} y={ey - 3} textAnchor={anchor} fontSize={13} fontWeight="700" fill={color}>
        {(percent * 100).toFixed(1)}%
      </text>
      <text x={tx} y={ey + 13} textAnchor={anchor} fontSize={11} fontWeight="500" fill="#cbd5e1">
        {shortOS}
      </text>
    </g>
  );
}

function categorizeOS(osName, vmName) {
  const os = (osName || '').toLowerCase();
  const name = (vmName || '').toLowerCase();
  if (name.includes('vcls') || os.includes('photon')) return 'VMware Photon';
  if (os.includes('windows')) return 'Microsoft Windows';
  if (os.includes('red hat') || os.includes('rhel') || os.includes('redhat')) return 'RHEL';
  if (os.includes('ubuntu')) return 'Ubuntu Linux';
  if (os.includes('suse')) return 'SUSE Linux';
  if (os.includes('linux') || os.includes('centos') || os.includes('debian') || os.includes('fedora') || os.includes('oracle') || os.includes('rocky') || os.includes('alma')) return 'Other Linux';
  return 'Other';
}

function OsChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const color = OS_CATEGORY_COLORS[d.os] || OS_CATEGORY_COLOR_DEFAULT;
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-2xl max-w-xs">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">{d.os}</p>
      </div>
      <p className="text-xs text-purple-400 mb-3">{d.count} VM{d.count !== 1 ? 's' : ''}</p>
      <div className="space-y-1.5 mb-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Datacenters</p>
        {d.datacenters.map((dc) => (
          <div key={dc.name} className="flex justify-between text-xs">
            <span className={dcTextClass(dc.name) || 'text-slate-300'}>{dc.name}</span>
            <span className="text-cyan-400 font-medium">{dc.count}</span>
          </div>
        ))}
      </div>
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

function ToggleChip({ checked, onToggle, children, activeCls }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        checked
          ? activeCls
          : 'bg-white/70 dark:bg-white/[0.06] border-slate-300/70 dark:border-white/[0.1] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      }`}
    >
      {checked ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      <span>{children}</span>
    </button>
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
  const [filterCategory, setFilterCategory] = useState(null);
  const [expandedDCs, setExpandedDCs] = useState({});
  const [sortField, setSortField] = useState('vm_name');
  const [sortDir, setSortDir] = useState('asc');
  const [lastUpdated, setLastUpdated] = useState(null);
  const initialLoad = useRef(true);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOSList, setExportOSList] = useState([]);
  const [exportHideAppliances, setExportHideAppliances] = useState(false);
  const [exportHideOpenShift, setExportHideOpenShift] = useState(false);
  const [exportModalSize, setExportModalSize] = useState({ width: 720, height: 600 });

  const startResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = exportModalSize.width;
    const startH = exportModalSize.height;
    const onMove = (ev) => {
      setExportModalSize({
        width: Math.max(480, startW + ev.clientX - startX),
        height: Math.max(400, startH + ev.clientY - startY),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const [hideAppliances, setHideAppliances] = useState(false);
  const [hideOpenShift, setHideOpenShift] = useState(false);

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);
      const result = await fetchVMs(forceRefresh);
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
        vm.os.toLowerCase().includes(q) ||
        vm.tools_version.toLowerCase().includes(q) ||
        vm.datacenter.toLowerCase().includes(q);
      const osLower = (vm.os || '').toLowerCase();
      const nameLower = (vm.vm_name || '').toLowerCase();
      const isVCLS = nameLower.startsWith('vcls');
      const isAppliance = !isVCLS && (
        ['vmware vcenter', 'vmware vrealize', 'vmware aria', 'nsx', 'photon os',
          'vmware identity', 'vmware cloud', 'vrealize', 'vrops', 'vra', 'vro',
          'other (64-bit)', 'other linux', 'vmware esxi'].some((p) => osLower.includes(p)) ||
        ['vcsa', 'vcenter', 'nsx', 'vrops', 'vra', 'vro', 'aria', 'log-insight',
          'loginsight', 'vrli', 'srm', 'veeam', 'zerto', 'avi-', 'avi_'].some((p) => nameLower.includes(p))
      );
      const isOpenShift =
        ['red hat enterprise linux coreos', 'coreos'].some((p) => osLower.includes(p)) ||
        (vm.cluster || '').toUpperCase().includes('OPENSHIFT');
      if (hideAppliances && isAppliance) return false;
      if (hideOpenShift && isOpenShift) return false;
      if (!isVCLS && vm.power_state !== 'poweredOn') return false;
      return matchesDC && matchesOS && matchesTools && matchesSearch;
    });
  }, [data, filterDC, filterOS, filterTools, searchQuery, hideAppliances, hideOpenShift]);

  const tableVMs = useMemo(() => {
    if (!filterCategory) return filteredVMs;
    return filteredVMs.filter((vm) => categorizeOS(vm.os, vm.vm_name) === filterCategory);
  }, [filteredVMs, filterCategory]);

  const groupedByDC = useMemo(() => {
    const groups = {};
    tableVMs.forEach((vm) => {
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
  }, [tableVMs, sortField, sortDir]);

  const osChartData = useMemo(() => {
    if (!filteredVMs.length) return [];
    const groups = {};
    filteredVMs.forEach((vm) => {
      const category = categorizeOS(vm.os, vm.vm_name);
      if (!groups[category]) groups[category] = { vms: [], dcCounts: {} };
      groups[category].vms.push(vm.vm_name);
      groups[category].dcCounts[vm.datacenter] = (groups[category].dcCounts[vm.datacenter] || 0) + 1;
    });
    return Object.entries(groups)
      .map(([os, info]) => ({
        os,
        count: info.vms.length,
        datacenters: Object.entries(info.dcCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([name, count]) => ({ name, count })),
        sampleVMs: info.vms.slice(0, 5),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredVMs]);

  const exportFilteredVMs = useMemo(() => {
    if (!data?.vms) return [];
    return data.vms.filter((vm) => {
      const osLower = (vm.os || '').toLowerCase();
      const nameLower = (vm.vm_name || '').toLowerCase();
      const isVCLS = nameLower.startsWith('vcls');
      const isAppliance = !isVCLS && (
        ['vmware vcenter', 'vmware vrealize', 'vmware aria', 'nsx', 'photon os',
          'vmware identity', 'vmware cloud', 'vrealize', 'vrops', 'vra', 'vro',
          'other (64-bit)', 'other linux', 'vmware esxi'].some((p) => osLower.includes(p)) ||
        ['vcsa', 'vcenter', 'nsx', 'vrops', 'vra', 'vro', 'aria', 'log-insight',
          'loginsight', 'vrli', 'srm', 'veeam', 'zerto', 'avi-', 'avi_'].some((p) => nameLower.includes(p))
      );
      const isOpenShift =
        ['red hat enterprise linux coreos', 'coreos'].some((p) => osLower.includes(p)) ||
        (vm.cluster || '').toUpperCase().includes('OPENSHIFT');
      if (exportHideAppliances && isAppliance) return false;
      if (exportHideOpenShift && isOpenShift) return false;
      if (!isVCLS && vm.power_state !== 'poweredOn') return false;
      return true;
    });
  }, [data, exportHideAppliances, exportHideOpenShift]);

  const openExportModal = () => {
    setExportOSList([...uniqueOSList]);
    setExportHideAppliances(hideAppliances);
    setExportHideOpenShift(hideOpenShift);
    setShowExportModal(true);
  };

  const toggleExportOS = (os) => {
    setExportOSList((prev) => prev.includes(os) ? prev.filter((x) => x !== os) : [...prev, os]);
  };

  const handleExport = () => {
    const rows = (data?.vms || []).filter((vm) => {
      if (!exportOSList.includes(vm.os)) return false;
      const osLower = (vm.os || '').toLowerCase();
      const nameLower = (vm.vm_name || '').toLowerCase();
      const isVCLS = nameLower.startsWith('vcls');
      const isAppliance = !isVCLS && (
        ['vmware vcenter', 'vmware vrealize', 'vmware aria', 'nsx', 'photon os',
          'vmware identity', 'vmware cloud', 'vrealize', 'vrops', 'vra', 'vro',
          'other (64-bit)', 'other linux', 'vmware esxi'].some((p) => osLower.includes(p)) ||
        ['vcsa', 'vcenter', 'nsx', 'vrops', 'vra', 'vro', 'aria', 'log-insight',
          'loginsight', 'vrli', 'srm', 'veeam', 'zerto', 'avi-', 'avi_'].some((p) => nameLower.includes(p))
      );
      const isOpenShift =
        ['red hat enterprise linux coreos', 'coreos'].some((p) => osLower.includes(p)) ||
        (vm.cluster || '').toUpperCase().includes('OPENSHIFT');
      if (exportHideAppliances && isAppliance) return false;
      if (exportHideOpenShift && isOpenShift) return false;
      if (vm.power_state !== 'poweredOn') return false;
      return true;
    });
    const header = ['Datacenter', 'VM', 'OS', 'Tools Version'];
    const lines = rows.map((vm) =>
      [vm.datacenter, vm.vm_name, vm.os, vm.tools_version || '']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vmware-tools-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const sortProps = (field) => ({
    sortable: true,
    active: sortField === field,
    dir: sortDir,
    onSort: () => handleSort(field),
  });

  return (
    <>
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card
            className="p-6 shadow-2xl flex flex-col relative bg-white/95 dark:bg-slate-900/95"
            style={{ width: exportModalSize.width, height: exportModalSize.height, maxWidth: '95vw', maxHeight: '90vh' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold tracking-tight">Export VMware Tools</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <ToggleChip
                checked={exportHideAppliances}
                onToggle={() => setExportHideAppliances((v) => !v)}
                activeCls="bg-orange-500/15 border-orange-500/40 text-orange-500 dark:text-orange-400"
              >
                Hide Appliances
              </ToggleChip>
              <ToggleChip
                checked={exportHideOpenShift}
                onToggle={() => setExportHideOpenShift((v) => !v)}
                activeCls="bg-red-500/15 border-red-500/40 text-red-500 dark:text-red-400"
              >
                Hide OpenShift VMs
              </ToggleChip>
            </div>
            <p className="text-sm text-slate-500 mb-3">Select OS type(s) to include in the export:</p>
            <div className="space-y-1 mb-4 overflow-y-auto flex-1">
              <button
                onClick={() =>
                  exportOSList.length === uniqueOSList.length
                    ? setExportOSList([])
                    : setExportOSList([...uniqueOSList])
                }
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors text-left"
              >
                {exportOSList.length === uniqueOSList.length
                  ? <CheckSquare className="h-4 w-4 text-blue-500 shrink-0" />
                  : <Square className="h-4 w-4 text-slate-400 shrink-0" />}
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Select All</span>
              </button>
              <div className="border-t border-slate-200/70 dark:border-white/[0.07] pt-1">
                {uniqueOSList.map((os) => (
                  <button
                    key={os}
                    onClick={() => toggleExportOS(os)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors text-left"
                  >
                    {exportOSList.includes(os)
                      ? <CheckSquare className="h-4 w-4 text-blue-500 shrink-0" />
                      : <Square className="h-4 w-4 text-slate-400 shrink-0" />}
                    <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 truncate">{os}</span>
                    <span className="ml-auto text-xs text-slate-400 shrink-0">
                      {exportFilteredVMs.filter((vm) => vm.os === os).length} VMs
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mt-auto pt-2">
              <Button className="flex-1" onClick={() => setShowExportModal(false)}>Cancel</Button>
              <Button
                className="flex-1" variant="primary" icon={Download}
                disabled={exportOSList.length === 0} onClick={handleExport}
              >
                Export CSV
              </Button>
            </div>
            <div
              onMouseDown={startResize}
              className="absolute bottom-1 right-1 w-4 h-4 cursor-se-resize opacity-40 hover:opacity-80 transition-opacity"
              title="Drag to resize"
            >
              <svg viewBox="0 0 10 10" className="w-full h-full text-slate-400" fill="currentColor">
                <path d="M0 10 L10 0 L10 10 Z" />
              </svg>
            </div>
          </Card>
        </div>
      )}

      <PageHeader
        title="VMware Tools"
        subtitle={`${data?.summary?.total_vms || 0} VMs across ${data?.summary?.datacenters?.length || 0} datacenters`}
        actions={(
          <>
            {lastUpdated && (
              <span className="hidden sm:inline text-xs text-slate-500">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {data && <Button size="sm" icon={Download} onClick={openExportModal}>Export</Button>}
            <Button
              size="sm" variant="ghost" icon={RefreshCw} loading={loading}
              onClick={() => { setLoading(true); loadData(true); }}
              title="Refresh now"
            />
          </>
        )}
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {loading && !data && <LoadingState label="Loading VM data…" />}
        {error && <ErrorBanner message={error} />}

        {data && !loading && (
          <>
            {/* Search + filters */}
            <Toolbar>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search VMs, OS, tools version…"
              />
              <Select value={filterDC} onChange={setFilterDC}>
                <option value="all">All Datacenters</option>
                {(data.summary?.datacenters || []).map((dc) => <option key={dc} value={dc}>{dc}</option>)}
              </Select>
              <Select value={filterOS} onChange={setFilterOS} className="max-w-[16rem]">
                <option value="all">All OS</option>
                {uniqueOSList.map((os) => <option key={os} value={os}>{os}</option>)}
              </Select>
              <Select value={filterTools} onChange={setFilterTools}>
                <option value="all">All Tools Versions</option>
                <option value="missing">Missing / Not Installed</option>
                {uniqueToolsList.map((tv) => <option key={tv} value={tv}>{tv}</option>)}
              </Select>
            </Toolbar>

            <div className="flex flex-wrap gap-2">
              <ToggleChip
                checked={hideAppliances}
                onToggle={() => setHideAppliances((v) => !v)}
                activeCls="bg-orange-500/15 border-orange-500/40 text-orange-500 dark:text-orange-400"
              >
                Hide Appliances
              </ToggleChip>
              <ToggleChip
                checked={hideOpenShift}
                onToggle={() => setHideOpenShift((v) => !v)}
                activeCls="bg-red-500/15 border-red-500/40 text-red-500 dark:text-red-400"
              >
                Hide OpenShift VMs
              </ToggleChip>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard label="Total VMs" value={filteredVMs.length} sub="matching filters" />
              <KpiCard label="Datacenters" value={Object.keys(groupedByDC).length} sub="with matching VMs" />
              <KpiCard label="OS Categories" value={osChartData.length} sub="in current view" />
              <KpiCard
                label="Missing Tools"
                value={filteredVMs.filter((v) => !v.tools_version || v.tools_version === '0').length}
                sub="no tools installed"
                subTone={filteredVMs.some((v) => !v.tools_version || v.tools_version === '0') ? 'warning' : 'positive'}
              />
            </div>

            {/* OS distribution */}
            {osChartData.length > 0 && (
              <Card className="p-5">
                <CardHeader title="OS Distribution" sub="Click a segment or legend row to filter the table below" />
                <div className="mt-4 flex flex-col sm:flex-row gap-6 items-center">
                  <div className="flex-1 min-w-0">
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={osChartData}
                          dataKey="count"
                          nameKey="os"
                          cx="50%"
                          cy="50%"
                          outerRadius={88}
                          innerRadius={48}
                          paddingAngle={2}
                          cursor="pointer"
                          label={renderOsLabel}
                          labelLine={false}
                          onClick={(d) => setFilterCategory((prev) => prev === d.os ? null : d.os)}
                        >
                          {osChartData.map((entry, i) => {
                            const active = filterCategory === null || filterCategory === entry.os;
                            return (
                              <Cell
                                key={i}
                                fill={OS_CATEGORY_COLORS[entry.os] || OS_CATEGORY_COLOR_DEFAULT}
                                opacity={active ? 1 : 0.3}
                                stroke={filterCategory === entry.os ? '#fff' : 'none'}
                                strokeWidth={filterCategory === entry.os ? 2 : 0}
                              />
                            );
                          })}
                        </Pie>
                        <Tooltip content={<OsChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full sm:w-60 space-y-1.5 shrink-0">
                    {osChartData.map((entry, i) => {
                      const pct = ((entry.count / filteredVMs.length) * 100).toFixed(1);
                      const color = OS_CATEGORY_COLORS[entry.os] || OS_CATEGORY_COLOR_DEFAULT;
                      const isSelected = filterCategory === entry.os;
                      const isDimmed = filterCategory !== null && !isSelected;
                      return (
                        <div
                          key={i}
                          onClick={() => setFilterCategory((prev) => prev === entry.os ? null : entry.os)}
                          className={`flex items-center justify-between gap-3 cursor-pointer rounded-lg px-2.5 py-1.5 transition-all ${
                            isSelected
                              ? 'bg-slate-200/70 dark:bg-white/10 ring-1 ring-slate-300 dark:ring-white/25'
                              : 'hover:bg-slate-100/70 dark:hover:bg-white/5'
                          } ${isDimmed ? 'opacity-40' : ''}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className={`text-sm truncate ${isSelected ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                              {entry.os}
                            </span>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{entry.count}</span>
                            <span className="text-xs text-slate-500 ml-1.5 tabular-nums">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}

            {/* Active category filter badge */}
            {filterCategory && (
              <div className="flex items-center gap-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: OS_CATEGORY_COLORS[filterCategory] || OS_CATEGORY_COLOR_DEFAULT }} />
                <span className="text-sm text-slate-500">
                  Showing <span className="font-medium text-slate-900 dark:text-white">{filterCategory}</span>
                </span>
                <button
                  onClick={() => setFilterCategory(null)}
                  className="ml-1 p-0.5 rounded hover:bg-slate-200/70 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                  title="Clear filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Table grouped by datacenter */}
            <Card className="overflow-hidden">
              {Object.keys(groupedByDC).length === 0 ? (
                <EmptyState
                  icon={Monitor}
                  title="No VMs match your search"
                  hint="Try clearing the search, filters, or the chart category selection."
                />
              ) : (
                <>
                  {Object.entries(groupedByDC)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([dc, vms]) => (
                      <div key={dc} className="border-b border-slate-200/70 dark:border-white/[0.07] last:border-0">
                        <GroupRow
                          expanded={!!expandedDCs[dc]}
                          onToggle={() => toggleDC(dc)}
                          icon={Building2}
                          title={dc}
                          titleClass={dcTextClass(dc)}
                          meta={<span><span className="font-semibold text-slate-700 dark:text-slate-200">{vms.length}</span> VMs</span>}
                        />
                        <GroupBody expanded={!!expandedDCs[dc]}>
                          <div className="px-2 pb-2">
                            <div className="max-h-[600px] overflow-y-auto">
                              <Table>
                                <THead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur">
                                  <Th {...sortProps('vm_name')}>VM</Th>
                                  <Th {...sortProps('os')}>OS</Th>
                                  <Th align="center" {...sortProps('tools_version')}>Tools Version</Th>
                                </THead>
                                <TBody>
                                  {vms.map((vm, idx) => (
                                    <Tr key={idx}>
                                      <Td className="font-medium text-slate-800 dark:text-slate-100">{vm.vm_name}</Td>
                                      <Td className="text-slate-600 dark:text-slate-300">{vm.os || '—'}</Td>
                                      <Td align="center">
                                        <Badge
                                          variant={!vm.tools_version || vm.tools_version === '0' ? 'critical' : 'success'}
                                          className="font-mono"
                                        >
                                          {vm.tools_version || '—'}
                                        </Badge>
                                      </Td>
                                    </Tr>
                                  ))}
                                </TBody>
                              </Table>
                            </div>
                          </div>
                        </GroupBody>
                      </div>
                    ))}
                  <div className="px-4 py-3 border-t border-slate-200/70 dark:border-white/[0.07] text-xs text-slate-500">
                    Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{tableVMs.length}</span> VMs across{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{Object.keys(groupedByDC).length}</span> datacenters
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

export default VMToolsPage;
