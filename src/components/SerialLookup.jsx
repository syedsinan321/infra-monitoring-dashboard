import { useState } from 'react';
import { Search, CheckCircle, XCircle, Loader2, Upload, Trash2, Download } from 'lucide-react';
import mockFetch from '../mockFetch';

function SerialLookup() {
  const [serialInput, setSerialInput] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLookup = async () => {
    const serialNumbers = serialInput
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (serialNumbers.length === 0) {
      setError('Please enter at least one serial number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await mockFetch('/api/serial-lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serial_numbers: serialNumbers }),
      });

      if (!response.ok) {
        throw new Error('Failed to lookup serial numbers');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSerialInput('');
    setResults(null);
    setError(null);
  };

  const handleExportCSV = () => {
    if (!results || !results.results) return;

    const headers = ['Serial Number', 'Found', 'Type', 'Name', 'Model', 'Status'];
    const rows = results.results.map((r) => [
      r.serial,
      r.found ? 'Yes' : 'No',
      r.type || '',
      r.name || '',
      r.model || '',
      r.status || '',
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

  return (
    <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 dark:border-white/5">
        <div className="flex items-center space-x-2">
          <Search className="h-5 w-5 text-purple-500" />
          <h2 className="text-lg font-semibold">Bulk Serial Number Lookup</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Enter serial numbers to check if they exist in Intersight
        </p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Serial Numbers (one per line, or comma/semicolon separated)
            </label>
            <textarea
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
              placeholder="Enter serial numbers here...&#10;FCH12345ABC&#10;FCH67890XYZ&#10;WMP123456"
              className="w-full h-48 px-4 py-3 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono text-sm"
            />

            <div className="flex space-x-3 mt-4">
              <button
                onClick={handleLookup}
                disabled={loading || !serialInput.trim()}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    <span>Lookup</span>
                  </>
                )}
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-600/20 border border-red-600/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Results Section */}
          <div>
            {results && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-sm">
                        <span className="font-semibold text-green-400">{results.summary.found}</span> Found
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <XCircle className="h-4 w-4 text-red-400" />
                      <span className="text-sm">
                        <span className="font-semibold text-red-400">{results.summary.not_found}</span> Not Found
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center space-x-1 px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    <span>Export CSV</span>
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto border border-white/20 dark:border-white/10 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-white/40 dark:bg-white/5 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Serial</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 dark:divide-white/5">
                      {results.results.map((result, idx) => (
                        <tr key={idx} className={result.found ? 'bg-green-900/10' : 'bg-red-900/10'}>
                          <td className="px-3 py-2 font-mono text-xs">{result.serial}</td>
                          <td className="px-3 py-2">
                            {result.found ? (
                              <span className="inline-flex items-center space-x-1 text-green-400">
                                <CheckCircle className="h-3 w-3" />
                                <span>Found</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-red-400">
                                <XCircle className="h-3 w-3" />
                                <span>Not Found</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{result.type || '—'}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={result.name}>
                            {result.name || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {!results && !loading && (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Upload className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Enter serial numbers and click Lookup</p>
                  <p className="text-sm mt-1">Results will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SerialLookup;
