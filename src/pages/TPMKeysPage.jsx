import { useState, useEffect, useMemo, useCallback } from 'react';
import { KeyRound, Search, RefreshCw, ChevronUp, ChevronDown, ShieldCheck, ShieldX, ShieldAlert, Server, AlertTriangle, Upload, Copy, Check, Play, Terminal, ChevronRight, Lock } from 'lucide-react';
import { fetchTpmKeys, startTpmCollect, getTpmCollectStatus, uploadTpmKeys, authenticateTpmPage } from '../api';

function TPMKeysPage() {
  const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem('tpm_auth') === 'true');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collecting, setCollecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDC, setFilterDC] = useState('all');
  const [filterTpm, setFilterTpm] = useState('all');
  const [sortField, setSortField] = useState('hostname');
  const [sortDir, setSortDir] = useState('asc');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const loadData = useCallback(async ({ sync = false } = {}) => {
    try {
      setError(null);
      const result = await fetchTpmKeys({ sync });
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) loadData();
  }, [loadData, authenticated]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const result = await authenticateTpmPage(authPassword);
      if (result.valid) {
        sessionStorage.setItem('tpm_auth', 'true');
        setAuthenticated(true);
      } else {
        setAuthError('Incorrect password');
      }
    } catch (err) {
      setAuthError('Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImportResult(null);
    try {
      const result = await uploadTpmKeys(file);
      setImportResult({
        success: true,
        importedCount: result.imported_count || 0,
        errors: result.import_errors || [],
      });
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setImportResult({ success: false, error: err.message });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const [collectTarget, setCollectTarget] = useState(0);
  const [collectLogs, setCollectLogs] = useState([]);
  const [logsExpanded, setLogsExpanded] = useState(true);

  const handleCollect = async () => {
    setCollecting(true);
    setImportResult(null);
    setCollectLogs([]);
    try {
      const start = await startTpmCollect();
      if (start.status === 'done') {
        setCollecting(false);
        setImportResult({ success: true, importedCount: 0, errors: [], message: start.message || 'All hosts already collected' });
        return;
      }
      setCollectTarget(start.target_count || 0);
      const poll = async () => {
        try {
          const status = await getTpmCollectStatus();
          if (status.log_lines) setCollectLogs(status.log_lines);
          if (status.status === 'running') {
            setTimeout(poll, 5000);
            return;
          }
          setCollecting(false);
          setCollectTarget(0);
          if (status.status === 'done') {
            setImportResult({ success: true, importedCount: status.imported_count || 0, errors: status.errors || [] });
            loadData();
          } else {
            setImportResult({ success: false, error: status.errors?.[0]?.error || 'Collection failed' });
          }
        } catch (err) {
          setCollecting(false);
          setCollectTarget(0);
          setImportResult({ success: false, error: err.message });
        }
      };
      setTimeout(poll, 5000);
    } catch (err) {
      setCollecting(false);
      setCollectTarget(0);
      setImportResult({ success: false, error: err.message });
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-0 group-hover:opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-orange-400" />
      : <ChevronDown className="h-3 w-3 text-orange-400" />;
  };

  const groupOptions = useMemo(() => {
    if (!data?.tpm_keys) return [];
    return [...new Set(data.tpm_keys.map((t) => t.group).filter(Boolean))].sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data?.tpm_keys) return [];
    let list = data.tpm_keys;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) =>
        (t.hostname || '').toLowerCase().includes(q) ||
        (t.recovery_key || '').toLowerCase().includes(q)
      );
    }
    if (filterDC !== 'all') list = list.filter((t) => t.group === filterDC);
    if (filterTpm !== 'all') {
      if (filterTpm === 'present') list = list.filter((t) => t.tpm_present);
      if (filterTpm === 'absent') list = list.filter((t) => !t.tpm_present);
      if (filterTpm === 'enabled') list = list.filter((t) => t.tpm_enabled === true);
    }
    list = [...list].sort((a, b) => {
      const aVal = (a[sortField] || '').toString().toLowerCase();
      const bVal = (b[sortField] || '').toString().toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [data, searchQuery, filterDC, filterTpm, sortField, sortDir]);

  const stats = useMemo(() => {
    if (!data?.tpm_keys) return { total: 0, withTpm: 0, enabled: 0, withKeys: 0 };
    const tpms = data.tpm_keys;
    return {
      total: tpms.length,
      withTpm: tpms.filter((t) => t.tpm_present).length,
      enabled: tpms.filter((t) => t.tpm_enabled === true).length,
      withKeys: tpms.filter((t) => t.recovery_key).length,
    };
  }, [data]);

  const tpmBadge = (tpm) => {
    if (tpm.tpm_present && tpm.tpm_enabled) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
          <ShieldCheck className="h-3 w-3" /> Enabled
        </span>
      );
    }
    if (tpm.tpm_present && tpm.tpm_enabled === false) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
          <ShieldAlert className="h-3 w-3" /> Disabled
        </span>
      );
    }
    if (tpm.tpm_present) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
          <ShieldCheck className="h-3 w-3" /> Present
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
        <ShieldX className="h-3 w-3" /> Not Found
      </span>
    );
  };

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-8 w-full max-w-sm text-center">
          <div className="bg-orange-500/20 p-3 rounded-xl w-fit mx-auto mb-4">
            <Lock className="h-6 w-6 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">TPM Recovery Keys</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Enter password to access this page</p>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 mb-4">
            <p className="text-xs text-blue-400">This is a mock demo — any password will work.</p>
          </div>
          <form onSubmit={handleAuth}>
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full px-4 py-2.5 bg-white/40 dark:bg-white/5 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 outline-none transition-all mb-3"
            />
            {authError && <p className="text-sm text-red-400 mb-3">{authError}</p>}
            <button
              type="submit"
              disabled={authLoading || !authPassword}
              className="w-full px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              {authLoading ? 'Verifying...' : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="relative mx-auto mb-4 w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-orange-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-orange-500 animate-spin" />
          </div>
          <p className="text-slate-400">Loading TPM keys data...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 max-w-md text-center">
          <p className="text-red-400 font-medium mb-2">Failed to load TPM keys</p>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button onClick={loadData} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500/20 p-2.5 rounded-xl">
            <KeyRound className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">TPM Keys</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Recovery keys from ESXi hosts
              {data?.last_import && (
                <span className="ml-2 text-slate-400">
                  — Last import: {new Date(data.last_import).toLocaleString()}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-slate-500 mr-1">Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <button
            onClick={() => { setLoading(true); loadData({ sync: true }); }}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm text-slate-600 dark:text-slate-300"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleCollect}
            disabled={collecting}
            className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Play className={`h-4 w-4 ${collecting ? 'animate-pulse' : ''}`} />
            {collecting ? `Collecting ${collectTarget} hosts...` : 'Collect Keys'}
          </button>
          <label className={`flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm text-slate-600 dark:text-slate-300 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload className={`h-4 w-4 ${uploading ? 'animate-pulse' : ''}`} />
            {uploading ? 'Importing...' : 'Import JSON'}
            <input type="file" accept=".json" onChange={handleUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Live Collection Log */}
      {(collecting || collectLogs.length > 0) && (
        <div className="mb-6 bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden">
          <button
            onClick={() => setLogsExpanded(!logsExpanded)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <Terminal className="h-4 w-4 text-orange-500" />
            <span>Collection Log</span>
            {collecting && <span className="ml-2 text-xs text-orange-400 animate-pulse">● Running</span>}
            <span className="ml-auto text-xs text-slate-500">{collectLogs.length} lines</span>
            <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${logsExpanded ? 'rotate-90' : ''}`} />
          </button>
          {logsExpanded && (
            <div className="px-4 pb-3 max-h-64 overflow-y-auto font-mono text-xs leading-relaxed">
              {collectLogs.length === 0 ? (
                <p className="text-slate-500 py-2">Waiting for output...</p>
              ) : (
                collectLogs.map((line, i) => (
                  <p key={i} className={
                    line.includes('fatal:') || line.includes('ERROR') ? 'text-red-400' :
                    line.includes('ok:') || line.includes('changed:') ? 'text-emerald-400' :
                    line.includes('TASK') || line.includes('PLAY') ? 'text-orange-400 font-semibold' :
                    'text-slate-400'
                  }>{line}</p>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Missing Hosts Banner */}
      {data?.missing_count > 0 && (
        <div className="mb-6 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-500 mb-1">
                {data.missing_count} host{data.missing_count !== 1 ? 's' : ''} in inventory not yet collected
              </p>
              <p className="text-xs text-slate-500">Click "Collect Keys" to run the Ansible playbook automatically.</p>
            </div>
          </div>
        </div>
      )}

      {/* Import Result Toast */}
      {importResult && (
        <div className={`mb-6 rounded-xl p-4 border ${importResult.success ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          {importResult.success ? (
            <p className="text-sm font-medium text-emerald-500">
              {importResult.message || `Import complete — ${importResult.importedCount} host${importResult.importedCount !== 1 ? 's' : ''} imported`}
            </p>
          ) : (
            <p className="text-sm font-medium text-red-400">Import failed: {importResult.error}</p>
          )}
          <button onClick={() => setImportResult(null)} className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">Dismiss</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Server className="h-4 w-4 text-orange-400" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hosts Scanned</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">TPM Present</span>
          </div>
          <p className="text-2xl font-bold text-emerald-500">{stats.withTpm}</p>
        </div>
        <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="h-4 w-4 text-purple-400" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Recovery Keys</span>
          </div>
          <p className="text-2xl font-bold text-purple-400">{stats.withKeys}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by hostname or recovery key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/40 dark:bg-white/5 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 outline-none transition-all"
          />
        </div>
        <select value={filterDC} onChange={(e) => setFilterDC(e.target.value)} className="px-3 py-2 bg-white/40 dark:bg-white/5 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/30 outline-none">
          <option value="all">All Groups</option>
          {groupOptions.map((g) => (<option key={g} value={g}>{g}</option>))}
        </select>
        <select value={filterTpm} onChange={(e) => setFilterTpm(e.target.value)} className="px-3 py-2 bg-white/40 dark:bg-white/5 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500/30 outline-none">
          <option value="all">All TPM Status</option>
          <option value="present">TPM Present</option>
          <option value="absent">No TPM</option>
          <option value="enabled">TPM Enabled</option>
        </select>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500">Showing {filtered.length} of {data?.total || 0} hosts</p>
      </div>

      {/* Table */}
      <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/50">
                {[
                  { key: 'hostname', label: 'Host' },
                  { key: 'group', label: 'Group' },
                  { key: 'tpm_present', label: 'TPM Status' },
                  { key: 'recovery_key', label: 'Recovery Key' },
                  { key: 'collected_at', label: 'Collected' },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="group px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      <SortIcon field={col.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
              {filtered.map((tpm, idx) => (
                <tr key={tpm.hostname || idx} className="hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-white">{tpm.hostname || '—'}</p>
                    <p className="text-xs text-slate-400 truncate max-w-[200px]">{tpm.model || ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20">
                      {tpm.group || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{tpmBadge(tpm)}</td>
                  <td className="px-4 py-3">
                    {tpm.recovery_key ? (
                      <div className="flex items-center gap-1.5">
                        <code className="font-mono text-xs text-orange-400 bg-orange-500/5 px-1.5 py-0.5 rounded max-w-[280px] truncate block">
                          {tpm.recovery_key}
                        </code>
                        <button
                          onClick={() => copyToClipboard(tpm.recovery_key, tpm.hostname)}
                          className="flex-shrink-0 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                          title="Copy recovery key"
                        >
                          {copiedKey === tpm.hostname
                            ? <Check className="h-3 w-3 text-emerald-400" />
                            : <Copy className="h-3 w-3 text-slate-400" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {tpm.collected_at ? new Date(tpm.collected_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    {data?.total === 0
                      ? 'No TPM data yet. Click "Collect Keys" to scan all ESXi hosts.'
                      : 'No hosts match your filters'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TPMKeysPage;
