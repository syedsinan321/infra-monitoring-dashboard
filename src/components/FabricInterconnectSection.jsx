import { useState, useMemo } from 'react';
import { Network, Wifi, ChevronDown, ChevronRight, Layers } from 'lucide-react';

function FabricInterconnectSection({ fabricInterconnects }) {
  const [expandedDomains, setExpandedDomains] = useState({});

  // Group FIs by domain
  const domainGroups = useMemo(() => {
    const groups = {};
    fabricInterconnects.forEach((fi) => {
      // Extract domain from display_name (e.g., "site1nonprducs01 FI-A" -> "site1nonprducs01")
      let domain = null;
      if (fi.display_name) {
        const parts = fi.display_name.split(' FI-');
        if (parts.length >= 1 && parts[0]) {
          domain = parts[0];
        }
      }
      
      // Skip FIs without a valid domain (don't show Unknown)
      if (!domain || domain === 'Unknown') {
        return;
      }
      
      if (!groups[domain]) {
        groups[domain] = {
          name: domain,
          fis: [],
        };
      }
      groups[domain].fis.push(fi);
    });
    
    // Sort FIs within each domain by switch_id (A before B)
    Object.values(groups).forEach((group) => {
      group.fis.sort((a, b) => (a.switch_id || '').localeCompare(b.switch_id || ''));
    });
    
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [fabricInterconnects]);

  const toggleDomain = (domainName) => {
    setExpandedDomains((prev) => ({
      ...prev,
      [domainName]: !prev[domainName],
    }));
  };

  return (
    <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 dark:border-white/5">
        <div className="flex items-center space-x-2">
          <Network className="h-5 w-5 text-purple-500" />
          <h2 className="text-lg font-semibold">Fabric Interconnects</h2>
        </div>
      </div>

      <div className="divide-y divide-white/10 dark:divide-white/5">
        {domainGroups.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
            No Fabric Interconnects found in your Vantage environment
          </div>
        ) : (
          domainGroups.map((domain) => {
            const isDomainExpanded = expandedDomains[domain.name];

            return (
              <div key={domain.name} className="bg-white/20 dark:bg-white/5">
                {/* Domain Header */}
                <button
                  onClick={() => toggleDomain(domain.name)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/20 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    {isDomainExpanded ? (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    )}
                    <Layers className="h-6 w-6 text-purple-400" />
                    <div className="text-left">
                      <p className="font-medium">{domain.name} FI</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {domain.fis.length} Fabric Interconnect{domain.fis.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {domain.fis.map((fi) => (
                      <span
                        key={fi.moid}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          fi.oper_evac_state === 'disabled'
                            ? 'bg-green-600/20 text-green-400'
                            : 'bg-yellow-600/20 text-yellow-400'
                        }`}
                      >
                        FI-{fi.switch_id}
                      </span>
                    ))}
                  </div>
                </button>

                {/* Expanded Domain - Show FI Details */}
                {isDomainExpanded && (
                  <div className="px-6 pb-4">
                    <div className="ml-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {domain.fis.map((fi) => (
                        <div
                          key={fi.moid}
                          className="bg-white/30 dark:bg-white/5 rounded-lg p-4 border border-white/20 dark:border-white/10"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-purple-600/20 rounded-lg">
                                <Network className="h-5 w-5 text-purple-400" />
                              </div>
                              <div>
                                <h3 className="font-medium">FI-{fi.switch_id}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{fi.serial}</p>
                              </div>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                fi.oper_evac_state === 'disabled'
                                  ? 'bg-green-600/20 text-green-400'
                                  : 'bg-yellow-600/20 text-yellow-400'
                              }`}
                            >
                              {fi.oper_evac_state === 'disabled' ? 'Active' : fi.oper_evac_state}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-slate-500 dark:text-slate-400 text-xs">Model</p>
                              <p className="font-medium text-sm">{fi.model}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 dark:text-slate-400 text-xs">Ethernet Mode</p>
                              <p className="font-medium text-sm">{fi.ethernet_mode || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 dark:text-slate-400 text-xs">FC Mode</p>
                              <p className="font-medium text-sm">{fi.fc_mode || 'N/A'}</p>
                            </div>
                            {fi.out_of_band_ip_address && (
                              <div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs">OOB IP</p>
                                <p className="font-mono text-blue-400 text-sm">{fi.out_of_band_ip_address}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default FabricInterconnectSection;
