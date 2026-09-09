import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RotateCcw, RefreshCw, Server, Info, X, AlertTriangle, CheckCircle2,
  User, KeyRound, Eye, EyeOff, CheckSquare, Square, MinusSquare,
} from 'lucide-react';
import { fetchCimcHosts, rebootCimc } from '../api';
import {
  PageHeader, Button, Badge, Card, SearchInput, Select, Toolbar, Input,
  Pagination, Table, THead, TBody, Th, Tr, Td, LoadingState, ErrorBanner, EmptyState,
} from '../components/ui';
import { DcName } from '../dcColors';

function RebootCimcPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDC, setFilterDC] = useState('all');
  const [filterDomain, setFilterDomain] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  // Selection is a map of moid -> host, so it survives filtering/paging.
  const [selected, setSelected] = useState({});

  // Confirmation dialog: list of hosts to reboot (1 for row action, N for batch)
  const [confirmHosts, setConfirmHosts] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({}); // moid -> { state, message }
  const [finished, setFinished] = useState(false);

  // CIMC credentials — held in memory for this session only, never persisted.
  const [cimcUser, setCimcUser] = useState('admin');
  const [cimcPassword, setCimcPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credError, setCredError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchCimcHosts();
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

  const hosts = useMemo(() => data?.hosts || [], [data]);

  const datacenters = useMemo(
    () => [...new Set(hosts.map(h => h.datacenter).filter(Boolean))].sort(),
    [hosts]
  );

  const domains = useMemo(() => {
    const pool = filterDC === 'all' ? hosts : hosts.filter(h => h.datacenter === filterDC);
    return [...new Set(pool.map(h => h.domain).filter(Boolean))].sort();
  }, [hosts, filterDC]);

  const filteredHosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return hosts.filter((h) => {
      if (filterDC !== 'all' && h.datacenter !== filterDC) return false;
      if (filterDomain !== 'all' && h.domain !== filterDomain) return false;
      if (!q) return true;
      return (
        h.blade_name?.toLowerCase().includes(q) ||
        h.server_profile?.toLowerCase().includes(q) ||
        h.domain?.toLowerCase().includes(q) ||
        h.mgmt_ip?.toLowerCase().includes(q)
      );
    });
  }, [hosts, filterDC, filterDomain, searchQuery]);

  useEffect(() => { setPage(1); }, [searchQuery, filterDC, filterDomain, perPage]);

  const totalPages = Math.max(1, Math.ceil(filteredHosts.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageHosts = filteredHosts.slice((safePage - 1) * perPage, safePage * perPage);

  const selectedList = Object.values(selected);
  const pageAllSelected = pageHosts.length > 0 && pageHosts.every(h => selected[h.moid]);
  const pageSomeSelected = pageHosts.some(h => selected[h.moid]);

  const toggleHost = (host) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[host.moid]) delete next[host.moid];
      else next[host.moid] = host;
      return next;
    });
  };

  const togglePage = () => {
    setSelected(prev => {
      const next = { ...prev };
      if (pageAllSelected) {
        pageHosts.forEach(h => delete next[h.moid]);
      } else {
        pageHosts.forEach(h => { next[h.moid] = h; });
      }
      return next;
    });
  };

  const openConfirm = (hostList) => {
    setCredError('');
    setProgress({});
    setFinished(false);
    setConfirmHosts(hostList);
  };

  const closeConfirm = () => {
    if (running) return;
    // After a batch, drop successfully rebooted hosts from the selection so a
    // retry only targets the failures.
    if (finished) {
      setSelected(prev => {
        const next = { ...prev };
        Object.entries(progress).forEach(([moid, p]) => {
          if (p.state === 'ok') delete next[moid];
        });
        return next;
      });
    }
    setConfirmHosts(null);
    setProgress({});
    setFinished(false);
    setCredError('');
  };

  const handleReboot = async () => {
    if (!confirmHosts?.length) return;
    if (!cimcPassword) {
      setCredError('Enter the CIMC admin password before rebooting.');
      return;
    }
    setCredError('');
    setRunning(true);
    setProgress(Object.fromEntries(confirmHosts.map(h => [h.moid, { state: 'pending' }])));

    // Sequential on purpose — clear per-host progress and no thundering herd
    // against Intersight.
    for (const host of confirmHosts) {
      setProgress(prev => ({ ...prev, [host.moid]: { state: 'running' } }));
      try {
        const res = await rebootCimc(host, { username: cimcUser || 'admin', password: cimcPassword });
        setProgress(prev => ({
          ...prev,
          [host.moid]: { state: 'ok', message: res.message || 'CIMC reboot initiated.' },
        }));
      } catch (err) {
        setProgress(prev => ({
          ...prev,
          [host.moid]: { state: 'error', message: err.message },
        }));
      }
    }

    setRunning(false);
    setFinished(true);
  };

  const doneCount = Object.values(progress).filter(p => p.state === 'ok' || p.state === 'error').length;
  const okCount = Object.values(progress).filter(p => p.state === 'ok').length;
  const failCount = Object.values(progress).filter(p => p.state === 'error').length;

  return (
    <>
      <PageHeader
        title="Reboot CIMC"
        subtitle={`${hosts.length} online host${hosts.length === 1 ? '' : 's'} with a server profile attached`}
        actions={(
          <Button
            size="sm" icon={RefreshCw} loading={loading}
            onClick={() => { setLoading(true); loadData(); }}
          >
            Refresh
          </Button>
        )}
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Non-disruptive note */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-500/25 bg-blue-500/10 p-4">
          <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
            <span className="font-semibold">Not disruptive to the ESXi host.</span>{' '}
            Rebooting the CIMC only restarts the blade's management controller — the hypervisor,
            running VMs, and workloads stay online throughout.
          </p>
        </div>

        {loading && !data && <LoadingState label="Loading hosts…" />}
        {error && <ErrorBanner message={error} />}

        {data && (
          <>
            {/* Search + filters */}
            <Toolbar>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search hosts, blades, domains, or IPs…"
              />
              <Select value={filterDC} onChange={(v) => { setFilterDC(v); setFilterDomain('all'); }}>
                <option value="all">All Datacenters</option>
                {datacenters.map(dc => <option key={dc} value={dc}>{dc}</option>)}
              </Select>
              <Select value={filterDomain} onChange={setFilterDomain}>
                <option value="all">All Domains</option>
                {domains.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Toolbar>

            {/* Host Table */}
            <Card className="overflow-hidden">
              {filteredHosts.length === 0 ? (
                <EmptyState
                  icon={Server}
                  title="No hosts match your search"
                  hint="Try clearing the search or switching filters."
                />
              ) : (
                <>
                  <Table>
                    <THead>
                      <Th className="w-10">
                        <button onClick={togglePage} className="align-middle" title="Select page">
                          {pageAllSelected
                            ? <CheckSquare className="h-4 w-4 text-blue-500" />
                            : pageSomeSelected
                              ? <MinusSquare className="h-4 w-4 text-blue-500" />
                              : <Square className="h-4 w-4 text-slate-400" />}
                        </button>
                      </Th>
                      <Th>Server Profile</Th>
                      <Th>Blade Name</Th>
                      <Th>Domain</Th>
                      <Th>Datacenter</Th>
                      <Th>Management IP</Th>
                      <Th align="right">Action</Th>
                    </THead>
                    <TBody>
                      {pageHosts.map((host) => {
                        const isSelected = !!selected[host.moid];
                        return (
                          <Tr
                            key={host.moid}
                            className={isSelected ? 'bg-blue-500/[0.06] dark:bg-blue-500/[0.08]' : ''}
                          >
                            <Td>
                              <button onClick={() => toggleHost(host)} className="align-middle">
                                {isSelected
                                  ? <CheckSquare className="h-4 w-4 text-blue-500" />
                                  : <Square className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />}
                              </button>
                            </Td>
                            <Td className="font-medium text-slate-800 dark:text-slate-100">{host.server_profile}</Td>
                            <Td className="text-slate-600 dark:text-slate-300">
                              <span className="flex items-center gap-2">
                                <Server className="h-3.5 w-3.5 text-slate-400" />
                                {host.blade_name}
                              </span>
                            </Td>
                            <Td className="text-slate-600 dark:text-slate-300"><DcName value={host.domain} /></Td>
                            <Td><DcName value={host.datacenter} /></Td>
                            <Td className="font-mono tabular-nums text-slate-500">{host.mgmt_ip || '—'}</Td>
                            <Td align="right">
                              <Button size="sm" icon={RotateCcw} onClick={() => openConfirm([host])}>
                                Reboot
                              </Button>
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

      {/* Selection action bar */}
      {selectedList.length > 0 && !confirmHosts && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 ml-[135px]">
          <div className="flex items-center gap-4 px-5 py-3 rounded-xl border border-slate-200/80 dark:border-white/[0.12] bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
            <span className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">{selectedList.length}</span>{' '}
              host{selectedList.length === 1 ? '' : 's'} selected
            </span>
            <button
              onClick={() => setSelected({})}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Clear
            </button>
            <Button variant="primary" size="sm" icon={RotateCcw} onClick={() => openConfirm(selectedList)}>
              Reboot Selected ({selectedList.length})
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation / progress dialog */}
      {confirmHosts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={closeConfirm}
        >
          <Card
            className="relative w-full max-w-lg p-6 shadow-2xl bg-white/95 dark:bg-slate-900/95 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeConfirm}
              disabled={running}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-1">
              <div className="bg-amber-500/15 p-2.5 rounded-xl">
                <RotateCcw className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Reboot {confirmHosts.length === 1 ? 'CIMC' : `${confirmHosts.length} CIMCs`}
                </h2>
                <p className="text-xs text-slate-500">
                  Management controller only — ESXi and workloads are unaffected
                </p>
              </div>
            </div>

            {/* Host list */}
            <div className="mt-4 rounded-xl border border-slate-200/70 dark:border-white/[0.08] divide-y divide-slate-200/60 dark:divide-white/[0.05] max-h-56 overflow-y-auto">
              {confirmHosts.map((h) => {
                const p = progress[h.moid];
                return (
                  <div key={h.moid} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{h.server_profile}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {h.blade_name} · {h.domain}{h.mgmt_ip ? ` · ${h.mgmt_ip}` : ''}
                      </p>
                    </div>
                    {!p && <Badge variant="neutral">queued</Badge>}
                    {p?.state === 'pending' && <Badge variant="neutral">queued</Badge>}
                    {p?.state === 'running' && (
                      <span className="flex items-center gap-1.5 text-xs text-amber-500 dark:text-amber-400">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> rebooting…
                      </span>
                    )}
                    {p?.state === 'ok' && (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-500 dark:text-emerald-400" title={p.message}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> initiated
                      </span>
                    )}
                    {p?.state === 'error' && (
                      <span className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 max-w-[14rem]" title={p.message}>
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{p.message}</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress bar while running / after finish */}
            {(running || finished) && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span>{doneCount} of {confirmHosts.length} completed</span>
                  {finished && (
                    <span>
                      <span className="text-emerald-500 font-medium">{okCount} ok</span>
                      {failCount > 0 && <span className="text-red-500 font-medium"> · {failCount} failed</span>}
                    </span>
                  )}
                </div>
                <div className="h-1.5 rounded-full bg-slate-200/70 dark:bg-white/[0.07] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${failCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${(doneCount / confirmHosts.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Credentials + confirm (before the run starts) */}
            {!running && !finished && (
              <>
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-slate-500">
                    CIMC admin credentials — used for this reboot only, never stored.
                  </p>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                    <Input
                      type="text"
                      autoComplete="off"
                      placeholder="Username"
                      value={cimcUser}
                      onChange={(e) => setCimcUser(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="CIMC admin password"
                      value={cimcPassword}
                      onChange={(e) => setCimcPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleReboot(); }}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {credError && <p className="text-xs text-red-500 dark:text-red-400">{credError}</p>}
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  <Button variant="ghost" onClick={closeConfirm}>Cancel</Button>
                  <Button variant="primary" icon={RotateCcw} onClick={handleReboot}>
                    Reboot {confirmHosts.length === 1 ? 'CIMC' : `${confirmHosts.length} CIMCs`}
                  </Button>
                </div>
              </>
            )}

            {/* Success / summary state */}
            {finished && (
              <>
                <div className={`mt-4 flex items-start gap-3 rounded-xl p-4 border ${
                  failCount === 0
                    ? 'border-emerald-500/25 bg-emerald-500/10'
                    : 'border-amber-500/25 bg-amber-500/10'
                }`}>
                  {failCount === 0
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />}
                  <div className="text-sm leading-relaxed">
                    <p className={failCount === 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}>
                      {failCount === 0
                        ? `${okCount === 1 ? 'CIMC reboot' : `All ${okCount} CIMC reboots`} initiated successfully.`
                        : `${okCount} initiated, ${failCount} failed — failed hosts stay selected so you can retry.`}
                    </p>
                    {okCount > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        Check Intersight — rebooted blades show as <span className="font-semibold">Discovering</span> in about 2–3 minutes.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  {failCount > 0 && (
                    <Button
                      icon={RotateCcw}
                      onClick={() => {
                        const failed = confirmHosts.filter(h => progress[h.moid]?.state === 'error');
                        openConfirm(failed);
                      }}
                    >
                      Retry Failed ({failCount})
                    </Button>
                  )}
                  <Button variant="primary" onClick={closeConfirm}>Done</Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

export default RebootCimcPage;
