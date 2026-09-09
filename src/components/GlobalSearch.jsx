import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, Server, X, Network, ServerOff } from 'lucide-react';
import { loadDeviceIndex } from '../deviceIndex';
import DeviceDetailModal from './DeviceDetailModal';

/**
 * Global device search — indexes Intersight blades, vCenter-only hosts, and
 * fabric interconnects. Selecting a device opens the shared detail card;
 * hosts link onward to Host Diagnostics.
 */
function GlobalSearch({ collapsed }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(null); // null = not loaded yet
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [detail, setDetail] = useState(null); // selected device
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const loadIndex = useCallback(async () => {
    setLoading(true);
    try {
      setIndex(await loadDeviceIndex());
    } finally {
      setLoading(false);
    }
  }, []);

  // Decommissioned identities carry none of the live data the detail card renders
  // (power, CIMC, vCenter), so they get sent to the page that explains their state.
  const pick = useCallback(entry => {
    if (entry.type === 'decommissioned') {
      setOpen(false);
      navigate('/decommissioned');
      return;
    }
    setDetail(entry);
  }, [navigate]);

  const openSearch = useCallback(() => {
    setOpen(true);
    setQuery('');
    setDetail(null);
    setHighlight(0);
    if (index === null) loadIndex();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [index, loadIndex]);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSearch]);

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
  ).slice(0, 12);

  function onInputKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && results[highlight]) {
      pick(results[highlight]);
    }
  }

  return (
    <>
      <button
        onClick={openSearch}
        title="Search devices (⌘K)"
        className={`w-full flex items-center rounded-xl transition-colors text-slate-500 dark:text-slate-400
          hover:bg-white/20 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-200
          border border-white/10 dark:border-white/5 bg-white/10 dark:bg-white/5
          ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2 space-x-2'}`}
      >
        <Search className="h-4 w-4 flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="text-sm flex-1 text-left">Search devices…</span>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-slate-500">⌘K</kbd>
          </>
        )}
      </button>

      {/* Portaled to <body>: the sidebar's backdrop-filter creates a containing
          block that would otherwise trap this fixed overlay inside it. */}
      {open && !detail && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="liquid-glass rounded-2xl w-full max-w-2xl mx-4 overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
              <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setHighlight(0); }}
                onKeyDown={onInputKey}
                placeholder="Host, blade, FI, serial, domain, IP, or model…"
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none"
              />
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading && (
                <p className="px-4 py-6 text-center text-sm text-slate-500">Loading devices…</p>
              )}
              {!loading && q && results.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-slate-500">No devices match “{query}”.</p>
              )}
              {!loading && !q && (
                <p className="px-4 py-6 text-center text-sm text-slate-500">
                  Type to search {index ? index.entries.length.toLocaleString() : ''} devices — hosts, blades & fabric interconnects.
                </p>
              )}
              {results.map((h, i) => (
                <button
                  key={h.key}
                  onClick={() => pick(h)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                    ${i === highlight ? 'bg-cyan-500/10' : ''}`}
                >
                  {h.type === 'fi'
                    ? <Network className="h-4 w-4 text-purple-400 flex-shrink-0" />
                    : h.type === 'decommissioned'
                      ? <ServerOff className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      : <Server className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 font-mono break-all">{h.name}</p>
                    <p className="text-xs text-slate-500">
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
          </div>
        </div>,
        document.body
      )}

      {/* Device detail — shared card, includes live Intersight/vCenter alerts */}
      {open && detail && (
        <DeviceDetailModal
          device={detail}
          fis={index?.fis || []}
          onClose={() => setOpen(false)}
          onBack={() => setDetail(null)}
          onOpenDiagnostics={detail.type === 'host' ? () => {
            setOpen(false);
            navigate(`/host-diagnostics?q=${encodeURIComponent(detail.name)}${detail.dc ? `&dc=${detail.dc}` : ''}`);
          } : undefined}
        />
      )}
    </>
  );
}

export default GlobalSearch;
