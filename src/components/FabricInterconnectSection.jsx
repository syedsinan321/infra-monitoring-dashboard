import { useState, useMemo } from 'react';
import { Network, ChevronDown, ChevronRight, Server } from 'lucide-react';

function FabricInterconnectSection({ fabricInterconnects }) {
  const [expandedDomains, setExpandedDomains] = useState({});

  const toggleDomain = (domain) => {
    setExpandedDomains((prev) => ({ ...prev, [domain]: !prev[domain] }));
  };

  const groupedByDomain = useMemo(() => {
    const groups = {};
    fabricInterconnects.forEach((fi) => {
      const domain = fi.domain_name || 'Unknown';
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(fi);
    });
    return groups;
  }, [fabricInterconnects]);

  const sortedDomains = Object.keys(groupedByDomain).sort();

  return (
    <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Network className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold">Fabric Interconnects</h2>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {fabricInterconnects.length} FIs
          </span>
        </div>
      </div>

      <div className="divide-y divide-white/10 dark:divide-white/5">
        {sortedDomains.map((domain) => {
          const domainFIs = groupedByDomain[domain];
          const isDomainExpanded = expandedDomains[domain];

          return (
            <div key={domain}>
              <button
                onClick={() => toggleDomain(domain)}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/20 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {isDomainExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <Server className="h-4 w-4 text-emerald-400" />
                  <span className="font-medium">{domain}</span>
                </div>
                <span className="px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded text-xs">
                  {domainFIs.length} FI{domainFIs.length !== 1 ? 's' : ''}
                </span>
              </button>

              {isDomainExpanded && (
                <div className="bg-white/20 dark:bg-white/5">
                  <table className="w-full">
                    <thead className="bg-white/30 dark:bg-white/5">
                      <tr>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Serial</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Model</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ethernet</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">FC Mode</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">OOB IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 dark:divide-white/5">
                      {domainFIs.map((fi) => (
                        <tr key={fi.moid} className="hover:bg-white/20 dark:hover:bg-white/5">
                          <td className="px-6 py-3 text-sm font-medium">{fi.name}</td>
                          <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400 font-mono">{fi.serial}</td>
                          <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">{fi.model}</td>
                          <td className="px-6 py-3">
                            <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded text-xs">{fi.ethernet_mode}</span>
                          </td>
                          <td className="px-6 py-3">
                            <span className="px-2 py-0.5 bg-purple-600/20 text-purple-400 rounded text-xs">{fi.fc_mode}</span>
                          </td>
                          <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400 font-mono">{fi.oob_ip}</td>
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
    </div>
  );
}

export default FabricInterconnectSection;
