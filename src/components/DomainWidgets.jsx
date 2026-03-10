import { useState } from 'react';
import { Globe, Box, Cpu, ChevronDown, ChevronRight, Network } from 'lucide-react';

function DomainWidgets({ domains }) {
  const [expandedDomains, setExpandedDomains] = useState({});

  const toggleDomain = (domain) => {
    setExpandedDomains((prev) => ({ ...prev, [domain]: !prev[domain] }));
  };

  if (!domains || domains.length === 0) return null;

  return (
    <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 dark:border-white/5">
        <div className="flex items-center space-x-2">
          <Globe className="h-5 w-5 text-cyan-500" />
          <h2 className="text-lg font-semibold">Domain Overview</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {domains.map((domain) => {
          const isExpanded = expandedDomains[domain.domain_name];
          const portUtil = domain.total_ports > 0
            ? Math.round((domain.used_ports / domain.total_ports) * 100)
            : 0;

          return (
            <div
              key={domain.domain_name}
              className="bg-white/20 dark:bg-white/5 rounded-xl border border-white/10 dark:border-white/5 overflow-hidden"
            >
              <button
                onClick={() => toggleDomain(domain.domain_name)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="font-medium text-sm">{domain.domain_name}</span>
                </div>
              </button>

              {/* Stats row */}
              <div className="px-4 pb-3 grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center space-x-1">
                    <Box className="h-3 w-3 text-blue-400" />
                    <span className="text-lg font-bold">{domain.chassis_count}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Chassis</p>
                </div>
                <div>
                  <span className="text-lg font-bold text-amber-400">{domain.empty_slots}</span>
                  <p className="text-[10px] text-slate-500">Empty Slots</p>
                </div>
                <div>
                  <span className="text-lg font-bold text-red-400">{domain.unused_blades}</span>
                  <p className="text-[10px] text-slate-500">Unused Blades</p>
                </div>
                <div>
                  <div className="flex items-center justify-center space-x-1">
                    <Network className="h-3 w-3 text-emerald-400" />
                    <span className="text-lg font-bold">{domain.fi_count}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">FIs</p>
                </div>
              </div>

              {/* Port utilization */}
              <div className="px-4 pb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500">Port Utilization</span>
                  <span className="font-mono text-slate-400">
                    {domain.used_ports}/{domain.total_ports} ({portUtil}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      portUtil >= 85
                        ? 'bg-red-500'
                        : portUtil >= 60
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${portUtil}%` }}
                  />
                </div>
              </div>

              {/* Expanded: chassis details */}
              {isExpanded && domain.chassis && (
                <div className="border-t border-white/5 px-4 py-3 space-y-2">
                  {domain.chassis.map((ch) => (
                    <div key={ch.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <Box className="h-3 w-3 text-cyan-400" />
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{ch.name}</span>
                      </div>
                      <div className="flex items-center space-x-3 text-slate-500">
                        {ch.empty_slots > 0 && (
                          <span className="text-amber-400">{ch.empty_slots} empty</span>
                        )}
                        {ch.unused_blades?.length > 0 && (
                          <span className="text-red-400">{ch.unused_blades.length} unused</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DomainWidgets;
