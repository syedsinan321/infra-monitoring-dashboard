import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Server, Network, ServerOff } from 'lucide-react';
import { loadDeviceIndex } from '../deviceIndex';
import DeviceDetailModal from './DeviceDetailModal';

/**
 * Inline dashboard search — same index and device detail card as the
 * sidebar's ⌘K search, but embedded with a live results dropdown.
 */
export default function DashboardSearch() {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [detail, setDetail] = useState(null);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadDeviceIndex().then(setIndex).catch(() => {});
  }, []);

  // Close the dropdown when clicking anywhere else
  useEffect(() => {
    function onDocClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const q = query.trim().toLowerCase();
  const results = !q || !index ? [] : index.entries.filter(e =>
    e.name?.toLowerCase().includes(q) ||
    e.profile?.toLowerCase().includes(q) ||
    e.blade?.toLowerCase().includes(q) ||
    e.fiName?.toLowerCase().includes(q) ||
    e.serial?.toLowerCase().includes(q) ||
    e.model?.toLowerCase().includes(q) ||
    e.domain?.toLowerCase().includes(q) ||
    e.ip?.includes(q)
  ).slice(0, 10);

  function pick(entry) {
    setOpen(false);
    // The detail card is built around live device data (power, CIMC, vCenter);
    // a decommissioned identity has none of that, so send the user to the page
    // that can actually explain its state.
    if (entry.type === 'decommissioned') {
      navigate('/decommissioned');
      return;
    }
    setDetail(entry);
  }

  function onKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && results[highlight]) {
      pick(results[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setHighlight(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder="Search hosts, blades, FIs, serials, domains, or IPs…"
        className="w-full pl-11 pr-4 py-3 rounded-xl text-sm bg-white/70 dark:bg-white/[0.06]
          border border-slate-300/70 dark:border-white/[0.1] text-slate-900 dark:text-white
          placeholder-slate-400 dark:placeholder-slate-500
          focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/15 transition-colors"
      />

      {open && q && (
        <div className="absolute left-0 right-0 top-full mt-2 z-30 rounded-xl border border-slate-200/80 dark:border-white/[0.1]
          bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-2xl overflow-hidden">
          {!index ? (
            <p className="px-4 py-4 text-center text-sm text-slate-500">Loading devices…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-slate-500">No devices match “{query}”.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-200/60 dark:divide-white/[0.05]">
              {results.map((h, i) => (
                <button
                  key={h.key}
                  onClick={() => pick(h)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                    ${i === highlight ? 'bg-blue-500/10' : ''}`}
                >
                  {h.type === 'fi'
                    ? <Network className="h-4 w-4 text-purple-400 flex-shrink-0" />
                    : h.type === 'decommissioned'
                      ? <ServerOff className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      : <Server className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 font-mono truncate">{h.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {h.type === 'decommissioned'
                        ? [h.serial, h.model, h.domain,
                           h.chassis ? `chassis ${h.chassis} · slot ${h.slot}` : null,
                          ].filter(Boolean).join(' · ')
                        : [h.blade, h.serial, h.domain, h.ip, h.model].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0
                    ${h.type === 'fi'
                      ? 'border-purple-500/30 text-purple-500 dark:text-purple-400'
                      : h.type === 'decommissioned'
                        ? 'border-amber-500/40 text-amber-600 dark:text-amber-400'
                        : h.vcenterOnly
                          ? 'border-blue-500/30 text-blue-500 dark:text-blue-400'
                          : 'border-cyan-500/30 text-cyan-500 dark:text-cyan-400'}`}>
                    {h.type === 'fi'
                      ? 'Fabric Interconnect'
                      : h.type === 'decommissioned'
                        ? 'Decommissioned'
                        : h.vcenterOnly ? 'vCenter only' : `${h.dc ? h.dc + ' · ' : ''}Host`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {detail && (
        <DeviceDetailModal
          device={detail}
          fis={index?.fis || []}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
