import { useState, useMemo } from 'react';
import { Search, X, Upload, Download, ClipboardList } from 'lucide-react';
import { bulkSerialLookup } from '../api';

function SearchBar({ chassis, blades, fabricInterconnects, switches, profiles }) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('search');
  const [bulkInput, setBulkInput] = useState('');
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const allDevices = useMemo(() => {
    const devices = [];
    (chassis || []).forEach((c) => devices.push({ type: 'Chassis', name: c.name, serial: c.serial, model: c.model, domain: c.domain_name }));
    (blades || []).forEach((b) => devices.push({ type: 'Blade', name: b.name, serial: b.serial, model: b.model, domain: b.domain_name }));
    (fabricInterconnects || []).forEach((fi) => devices.push({ type: 'FI', name: fi.name, serial: fi.serial, model: fi.model, domain: fi.domain_name }));
    (switches || []).forEach((sw) => devices.push({ type: 'Switch', name: sw.name, serial: sw.serial, model: sw.model, domain: sw.domain_name }));
    (profiles || []).forEach((p) => devices.push({ type: 'Profile', name: p.name, serial: '—', model: p.target_platform || '—', domain: '—' }));
    return devices;
  }, [chassis, blades, fabricInterconnects, switches, profiles]);

  const searchResults = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return allDevices
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.serial.toLowerCase().includes(q) ||
          d.model.toLowerCase().includes(q) ||
          d.domain.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [query, allDevices]);

  const handleBulkLookup = async () => {
    const serials = bulkInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (serials.length === 0) return;
    setBulkLoading(true);
    try {
      const results = await bulkSerialLookup(serials);
      setBulkResults(results);
    } catch {
      setBulkResults([]);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setBulkInput(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportCSV = () => {
    if (!bulkResults?.length) return;
    const header = 'Serial,Type,Name,Model,Domain,Status\n';
    const rows = bulkResults
      .map((r) => `${r.serial},${r.type},${r.name},${r.model},${r.domain},${r.status}`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'serial_lookup_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-white/10 dark:border-white/5">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'search'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Search className="h-4 w-4 inline mr-2" />
          Search
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'bulk'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <ClipboardList className="h-4 w-4 inline mr-2" />
          Bulk Serial Lookup
        </button>
      </div>

      {activeTab === 'search' && (
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search chassis, blades, FIs, switches, profiles..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-200" />
              </button>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 max-h-64 overflow-y-auto divide-y divide-white/5">
              {searchResults.map((r, i) => (
                <div key={i} className="py-2 px-2 flex items-center justify-between text-sm hover:bg-white/10 rounded-lg">
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{r.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{r.serial}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-500">{r.domain}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      r.type === 'Chassis' ? 'bg-blue-600/20 text-blue-400' :
                      r.type === 'Blade' ? 'bg-cyan-600/20 text-cyan-400' :
                      r.type === 'FI' ? 'bg-emerald-600/20 text-emerald-400' :
                      r.type === 'Switch' ? 'bg-purple-600/20 text-purple-400' :
                      'bg-orange-600/20 text-orange-400'
                    }`}>
                      {r.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {query.length >= 2 && searchResults.length === 0 && (
            <p className="mt-3 text-sm text-slate-500 text-center py-4">No results found</p>
          )}
        </div>
      )}

      {activeTab === 'bulk' && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Enter serial numbers (one per line or comma-separated)</p>
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer text-xs text-slate-400 transition-colors">
                <Upload className="h-3 w-3" />
                <span>Upload</span>
                <input type="file" accept=".txt,.csv" onChange={handleFileUpload} className="hidden" />
              </label>
              {bulkResults?.length > 0 && (
                <button
                  onClick={exportCSV}
                  className="flex items-center space-x-1 px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs transition-colors"
                >
                  <Download className="h-3 w-3" />
                  <span>Export CSV</span>
                </button>
              )}
            </div>
          </div>

          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder="SN00000001&#10;SN00000002&#10;SN00000003"
            rows={4}
            className="w-full px-3 py-2 bg-white/20 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 font-mono"
          />

          <button
            onClick={handleBulkLookup}
            disabled={bulkLoading || !bulkInput.trim()}
            className="w-full py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {bulkLoading ? 'Looking up...' : 'Lookup Serials'}
          </button>

          {bulkResults && (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur">
                  <tr className="text-slate-500 uppercase tracking-wider">
                    <th className="text-left py-2 px-2 font-medium">Serial</th>
                    <th className="text-left py-2 px-2 font-medium">Type</th>
                    <th className="text-left py-2 px-2 font-medium">Name</th>
                    <th className="text-left py-2 px-2 font-medium">Model</th>
                    <th className="text-left py-2 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {bulkResults.map((r, i) => (
                    <tr key={i} className="hover:bg-white/10">
                      <td className="py-1.5 px-2 font-mono text-slate-400">{r.serial}</td>
                      <td className="py-1.5 px-2 text-slate-500">{r.type}</td>
                      <td className="py-1.5 px-2 font-medium text-slate-700 dark:text-slate-200">{r.name}</td>
                      <td className="py-1.5 px-2 text-slate-500">{r.model}</td>
                      <td className="py-1.5 px-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          r.status === 'Found' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
