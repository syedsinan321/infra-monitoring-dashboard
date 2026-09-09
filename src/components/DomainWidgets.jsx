import { useState } from 'react';
import { Server, HardDrive, Network, Activity, ChevronDown, ChevronRight, Layers } from 'lucide-react';

function DomainWidgets({ domains }) {
  const [expandedDomains, setExpandedDomains] = useState({});
  const [expandedUnusedBlades, setExpandedUnusedBlades] = useState({});

  if (!domains || domains.length === 0) {
    return null;
  }

  const toggleDomain = (domainName) => {
    setExpandedDomains((prev) => ({
      ...prev,
      [domainName]: !prev[domainName],
    }));
  };

  const toggleUnusedBlades = (domainName) => {
    setExpandedUnusedBlades((prev) => ({
      ...prev,
      [domainName]: !prev[domainName],
    }));
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-3">
          <div className="bg-cyan-500/10 p-2 rounded-lg">
            <Layers className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Domain Overview</h2>
            <p className="text-sm text-slate-500">{domains.length} active domains</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {domains.map((domain) => {
          const slotUtilization = domain.total_slots > 0 
            ? ((domain.used_slots / domain.total_slots) * 100).toFixed(0)
            : 0;
          const portHealth = domain.total_ports > 0
            ? ((domain.ports_up / domain.total_ports) * 100).toFixed(0)
            : 0;
          const isExpanded = expandedDomains[domain.name];
          const chassisWithEmptySlots = (domain.chassis_details || [])
            .filter(ch => ch.empty_slots > 0)
            .sort((a, b) => b.empty_slots - a.empty_slots);

          return (
            <div
              key={domain.name}
              className="group relative liquid-glass liquid-glass-shimmer rounded-2xl p-4 hover:border-cyan-500/30 transition-all duration-300 card-hover"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm truncate" title={domain.name}>
                  {domain.name}
                </h3>
                <span className={`w-2 h-2 rounded-full ${
                  domain.ports_up > 0 ? 'bg-green-500' : 'bg-gray-500'
                }`} />
              </div>

              <div className="space-y-3">
                {/* Chassis & Slots */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
                    <Server className="h-4 w-4" />
                    <span className="text-xs">Chassis</span>
                  </div>
                  <span className="text-sm font-medium">{domain.chassis_count}</span>
                </div>

                {/* Empty Slots - Clickable */}
                <button
                  onClick={() => toggleDomain(domain.name)}
                  className="w-full flex items-center justify-between hover:bg-white/20 dark:hover:bg-white/5 rounded px-1 py-0.5 -mx-1 transition-colors"
                >
                  <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <HardDrive className="h-4 w-4" />
                    <span className="text-xs">Empty Slots</span>
                  </div>
                  <span className={`text-sm font-medium ${
                    domain.empty_slots > 10 ? 'text-green-400' : 
                    domain.empty_slots > 0 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {domain.empty_slots}
                  </span>
                </button>

                {/* Expanded Chassis Details */}
                {isExpanded && chassisWithEmptySlots.length > 0 && (
                  <div className="bg-white/20 dark:bg-white/5 rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Chassis with empty slots:</div>
                    {chassisWithEmptySlots.map((ch) => (
                      <div
                        key={ch.name}
                        className="flex items-center justify-between text-xs py-1 border-b border-white/10 dark:border-white/5 last:border-0"
                      >
                        <span className="text-slate-700 dark:text-slate-300 truncate" title={ch.name}>
                          {ch.name.split('-').pop()}
                        </span>
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-0.5">
                            {Array.from({ length: 8 }, (_, i) => (
                              <div
                                key={i}
                                className={`w-1.5 h-3 rounded-sm ${
                                  i < ch.used_slots ? 'bg-blue-500' : 'bg-slate-300 dark:bg-gray-600'
                                }`}
                                title={i < ch.used_slots ? 'Blade installed' : 'Empty slot'}
                              />
                            ))}
                          </div>
                          <span className={`font-medium ${
                            ch.empty_slots >= 6 ? 'text-green-400' :
                            ch.empty_slots >= 3 ? 'text-yellow-400' : 'text-gray-400'
                          }`}>
                            {ch.empty_slots}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Unused Blades - Clickable */}
                <button
                  onClick={() => toggleUnusedBlades(domain.name)}
                  className="w-full flex items-center justify-between hover:bg-white/20 dark:hover:bg-white/5 rounded px-1 py-0.5 -mx-1 transition-colors"
                >
                  <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
                    {expandedUnusedBlades[domain.name] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Server className="h-4 w-4" />
                    <span className="text-xs">Unused Blades</span>
                  </div>
                  <span className={`text-sm font-medium ${
                    domain.unused_blades > 0 ? 'text-amber-400' : 'text-green-400'
                  }`}>
                    {domain.unused_blades || 0}
                  </span>
                </button>

                {/* Expanded Unused Blade Details */}
                {expandedUnusedBlades[domain.name] && (domain.unused_blade_details || []).length > 0 && (
                  <div className="bg-white/20 dark:bg-white/5 rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Blades without profiles:</div>
                    {(domain.unused_blade_details || []).map((blade, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 border-b border-white/10 dark:border-white/5 last:border-0"
                      >
                        <span className="text-slate-700 dark:text-slate-300 truncate" title={blade.chassis_name}>
                          {blade.chassis_name?.split('-').pop() || '?'} / Slot {blade.slot_id}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 truncate ml-2" title={blade.model}>
                          {blade.model}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Slot Utilization Bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1">
                    <span>Slot Usage</span>
                    <span>{domain.used_slots}/{domain.total_slots}</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        slotUtilization > 90 ? 'bg-red-500' :
                        slotUtilization > 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${slotUtilization}%` }}
                    />
                  </div>
                </div>

                {/* FIs */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
                    <Network className="h-4 w-4" />
                    <span className="text-xs">FIs</span>
                  </div>
                  <span className="text-sm font-medium">{domain.fi_count}</span>
                </div>

                {/* Port Types Breakdown */}
                {domain.port_types && (
                  <div className="space-y-1.5 pt-2 border-t border-white/10 dark:border-white/5">
                    <div className="text-xs text-gray-500 mb-1">Ports:</div>
                    
                    {/* Server Ports */}
                    {domain.port_types.server?.total > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Server</span>
                        <span className="text-cyan-400 font-medium">
                          {domain.port_types.server.total}
                        </span>
                      </div>
                    )}
                    
                    {/* Ethernet Uplink Ports */}
                    {domain.port_types.eth_uplink?.total > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Eth Uplink</span>
                        <span className="text-blue-400 font-medium">
                          {domain.port_types.eth_uplink.total}
                        </span>
                      </div>
                    )}
                    
                    {/* FC Uplink Ports */}
                    {domain.port_types.fc_uplink?.total > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">FC Uplink</span>
                        <span className="text-purple-400 font-medium">
                          {domain.port_types.fc_uplink.total}
                        </span>
                      </div>
                    )}
                    
                    {/* Unconfigured Ports */}
                    {domain.port_types.unconfigured?.total > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Unconfigured</span>
                        <span className="text-gray-500 font-medium">
                          {domain.port_types.unconfigured.total}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DomainWidgets;
