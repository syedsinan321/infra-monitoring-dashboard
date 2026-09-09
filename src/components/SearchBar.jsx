import { useState, useMemo, useRef } from 'react';
import { Search, X, Server, Box, Network, FileText, Router, List, CheckCircle, XCircle, Loader2, Download, ChevronDown, ChevronUp, Upload, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import mockFetch from '../mockFetch';

function SearchBar({ chassis, blades, fabricInterconnects, networkSwitches, profiles }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showBulkLookup, setShowBulkLookup] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const fileInputRef = useRef(null);

  // Search across all device types
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return { chassis: [], blades: [], fis: [], switches: [], profiles: [] };
    }

    const query = searchQuery.toLowerCase().trim();

    // Search chassis by name or serial
    const matchedChassis = (chassis || []).filter((c) =>
      (c.name && c.name.toLowerCase().includes(query)) ||
      (c.serial && c.serial.toLowerCase().includes(query))
    );

    // Search blades by name, serial, or chassis name
    const matchedBlades = (blades || []).filter((b) =>
      (b.name && b.name.toLowerCase().includes(query)) ||
      (b.serial && b.serial.toLowerCase().includes(query)) ||
      (b.chassis_name && b.chassis_name.toLowerCase().includes(query))
    );

    // Search FIs by name, serial, or display_name
    const matchedFIs = (fabricInterconnects || []).filter((fi) =>
      (fi.name && fi.name.toLowerCase().includes(query)) ||
      (fi.serial && fi.serial.toLowerCase().includes(query)) ||
      (fi.display_name && fi.display_name.toLowerCase().includes(query))
    );

    // Search network switches by name, serial, or display_name
    const matchedSwitches = (networkSwitches || []).filter((sw) =>
      (sw.name && sw.name.toLowerCase().includes(query)) ||
      (sw.serial && sw.serial.toLowerCase().includes(query)) ||
      (sw.display_name && sw.display_name.toLowerCase().includes(query))
    );

    // Search profiles by name
    const matchedProfiles = (profiles || []).filter((p) =>
      (p.name && p.name.toLowerCase().includes(query))
    );

    return {
      chassis: matchedChassis.slice(0, 5),
      blades: matchedBlades.slice(0, 10),
      fis: matchedFIs.slice(0, 5),
      switches: matchedSwitches.slice(0, 5),
      profiles: matchedProfiles.slice(0, 10),
    };
  }, [searchQuery, chassis, blades, fabricInterconnects, networkSwitches, profiles]);

  const totalResults = 
    searchResults.chassis.length + 
    searchResults.blades.length + 
    searchResults.fis.length + 
    searchResults.switches.length +
    searchResults.profiles.length;

  const hasResults = totalResults > 0;

  const clearSearch = () => {
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleBulkLookup = async () => {
    const serialNumbers = bulkInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (serialNumbers.length === 0) {
      setBulkError('Please enter at least one serial number');
      return;
    }

    setBulkLoading(true);
    setBulkError(null);

    try {
      const response = await mockFetch('/api/serial-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial_numbers: serialNumbers }),
      });

      if (!response.ok) throw new Error('Failed to lookup serial numbers');
      const data = await response.json();
      setBulkResults(data);
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!bulkResults?.results) return;
    const headers = ['Serial Number', 'Found', 'Type', 'Name', 'Model', 'Status'];
    const rows = bulkResults.results.map((r) => [
      r.serial, r.found ? 'Yes' : 'No', r.type || '', r.name || '', r.model || '', r.status || ''
    ]);
    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'serial_lookup_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearBulkLookup = () => {
    setBulkInput('');
    setBulkResults(null);
    setBulkError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(e.target.result);
        const worksheet = workbook.worksheets[0];
        const jsonData = [];
        worksheet.eachRow({ includeEmpty: false }, (row) => {
          jsonData.push(row.values.slice(1));
        });
        const serialNumbers = jsonData
          .flat()
          .map((cell) => String(cell || '').trim())
          .filter((val) => val.length > 0 && val.toLowerCase() !== 'serial' && val.toLowerCase() !== 'serial number' && val.toLowerCase() !== 'sn');
        if (serialNumbers.length === 0) {
          setBulkError('No serial numbers found in the file');
          return;
        }
        setBulkInput(serialNumbers.join('\n'));
        setBulkError(null);
      } catch (err) {
        setBulkError('Failed to parse Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex space-x-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by serial number or device name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              className="w-full pl-12 pr-12 py-3 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowBulkLookup(!showBulkLookup)}
            className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-medium transition-all duration-300 ${
              showBulkLookup
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-purple-500/20'
                : 'bg-white/30 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-white/20 dark:border-white/10 hover:border-purple-500/30 hover:text-purple-400'
            }`}
          >
            <List className="h-5 w-5" />
            <span className="hidden sm:inline">Bulk Lookup</span>
            {showBulkLookup ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

      {/* Search Results Dropdown */}
      {isOpen && searchQuery.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-3 liquid-glass rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
          {!hasResults ? (
            <div className="px-4 py-6 text-center text-slate-500">
              No devices found matching "{searchQuery}"
            </div>
          ) : (
            <div className="divide-y divide-white/10 dark:divide-white/5">
              {/* Chassis Results */}
              {searchResults.chassis.length > 0 && (
                <div className="p-3">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center">
                    <Box className="h-3 w-3 mr-1" />
                    Chassis ({searchResults.chassis.length})
                  </h4>
                  <div className="space-y-2">
                    {searchResults.chassis.map((c) => (
                      <div key={c.moid} className="flex items-center justify-between p-2 bg-white/20 dark:bg-white/5 rounded hover:bg-white/30 dark:hover:bg-white/10">
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Serial: {c.serial || 'N/A'}</p>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{c.model}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blades Results */}
              {searchResults.blades.length > 0 && (
                <div className="p-3">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center">
                    <Server className="h-3 w-3 mr-1" />
                    Blades ({searchResults.blades.length})
                  </h4>
                  <div className="space-y-2">
                    {searchResults.blades.map((b) => (
                      <div key={b.moid} className="flex items-center justify-between p-2 bg-white/20 dark:bg-white/5 rounded hover:bg-white/30 dark:hover:bg-white/10">
                        <div>
                          <p className="text-sm font-medium">{b.name || `Blade Slot ${b.slot_id}`}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Serial: {b.serial || 'N/A'} | Chassis: {b.chassis_name || 'N/A'}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{b.model}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FI Results */}
              {searchResults.fis.length > 0 && (
                <div className="p-3">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center">
                    <Network className="h-3 w-3 mr-1" />
                    Fabric Interconnects ({searchResults.fis.length})
                  </h4>
                  <div className="space-y-2">
                    {searchResults.fis.map((fi) => (
                      <div key={fi.moid} className="flex items-center justify-between p-2 bg-white/20 dark:bg-white/5 rounded hover:bg-white/30 dark:hover:bg-white/10">
                        <div>
                          <p className="text-sm font-medium">{fi.display_name || fi.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Serial: {fi.serial || 'N/A'}</p>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{fi.model}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Network Switches Results */}
              {searchResults.switches.length > 0 && (
                <div className="p-3">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center">
                    <Router className="h-3 w-3 mr-1" />
                    Network Switches ({searchResults.switches.length})
                  </h4>
                  <div className="space-y-2">
                    {searchResults.switches.map((sw) => (
                      <div key={sw.moid} className="flex items-center justify-between p-2 bg-white/20 dark:bg-white/5 rounded hover:bg-white/30 dark:hover:bg-white/10">
                        <div>
                          <p className="text-sm font-medium">{sw.display_name || sw.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Serial: {sw.serial || 'N/A'}</p>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{sw.model}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Server Profiles Results */}
              {searchResults.profiles.length > 0 && (
                <div className="p-3">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2 flex items-center">
                    <FileText className="h-3 w-3 mr-1" />
                    Server Profiles ({searchResults.profiles.length})
                  </h4>
                  <div className="space-y-2">
                    {searchResults.profiles.map((p) => (
                      <div key={p.moid} className="flex items-center justify-between p-2 bg-white/20 dark:bg-white/5 rounded hover:bg-white/30 dark:hover:bg-white/10">
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {p.assigned_server ? 'Assigned' : 'Unassigned'} | {p.target_platform || 'N/A'}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          p.config_context?.config_state === 'Applied' 
                            ? 'bg-green-600/20 text-green-400' 
                            : 'bg-gray-600/20 text-gray-400'
                        }`}>
                          {p.config_context?.config_state || 'N/A'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
      </div>

      {/* Bulk Serial Number Lookup */}
      {showBulkLookup && (
        <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Serial Numbers (one per line, or comma/semicolon separated)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/20 dark:bg-white/5 hover:bg-white/30 dark:hover:bg-white/10 border border-white/20 dark:border-white/10 hover:border-emerald-500/30 rounded-lg text-xs font-medium text-slate-400 hover:text-emerald-400 transition-all duration-300"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Import Excel</span>
                  </button>
                </div>
              </div>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="Enter serial numbers...&#10;FCH12345ABC&#10;FCH67890XYZ&#10;&#10;Or click 'Import Excel' to upload a file"
                className="w-full h-32 px-3 py-2 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none font-mono text-sm"
              />
              <div className="flex space-x-2 mt-3">
                <button
                  onClick={handleBulkLookup}
                  disabled={bulkLoading || !bulkInput.trim()}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition-all duration-300 text-sm shadow-lg shadow-purple-500/20"
                >
                  {bulkLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /><span>Searching...</span></>
                  ) : (
                    <><Search className="h-4 w-4" /><span>Lookup</span></>
                  )}
                </button>
                <button
                  onClick={clearBulkLookup}
                  className="px-4 py-2.5 bg-white/20 dark:bg-white/5 hover:bg-white/30 dark:hover:bg-white/10 border border-white/20 dark:border-white/10 rounded-lg font-medium transition-all duration-300 text-sm text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              </div>
              {bulkError && (
                <div className="mt-3 p-2 bg-red-600/20 border border-red-600/50 rounded text-red-400 text-sm">
                  {bulkError}
                </div>
              )}
            </div>

            {/* Results Section */}
            <div>
              {bulkResults ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="font-semibold text-green-400">{bulkResults.summary.found}</span>
                        <span className="text-gray-400">Found</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <XCircle className="h-4 w-4 text-red-400" />
                        <span className="font-semibold text-red-400">{bulkResults.summary.not_found}</span>
                        <span className="text-gray-400">Not Found</span>
                      </span>
                    </div>
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center space-x-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      <span>CSV</span>
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-gray-700 rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-700/50 sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left text-gray-400">Serial</th>
                          <th className="px-2 py-1 text-left text-gray-400">Status</th>
                          <th className="px-2 py-1 text-left text-gray-400">Type</th>
                          <th className="px-2 py-1 text-left text-gray-400">Name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700/50">
                        {bulkResults.results.map((r, idx) => (
                          <tr key={idx} className={r.found ? 'bg-green-900/10' : 'bg-red-900/10'}>
                            <td className="px-2 py-1 font-mono">{r.serial}</td>
                            <td className="px-2 py-1">
                              {r.found ? (
                                <span className="text-green-400 flex items-center space-x-1">
                                  <CheckCircle className="h-3 w-3" /><span>Found</span>
                                </span>
                              ) : (
                                <span className="text-red-400 flex items-center space-x-1">
                                  <XCircle className="h-3 w-3" /><span>Not Found</span>
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1 text-gray-400">{r.type || '—'}</td>
                            <td className="px-2 py-1 text-gray-300 truncate max-w-[100px]">{r.name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  <div className="text-center py-8">
                    <List className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Enter serial numbers and click Lookup</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchBar;
