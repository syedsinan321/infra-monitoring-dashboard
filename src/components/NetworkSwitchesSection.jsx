import { useState } from 'react';
import { Router, ChevronDown, ChevronRight } from 'lucide-react';

function NetworkSwitchesSection({ networkSwitches }) {
  const [expanded, setExpanded] = useState(false);

  if (!networkSwitches || networkSwitches.length === 0) {
    return null;
  }

  // Group switches by name (e.g., site1sansw01, site1sansw02)
  const switchGroups = {};
  networkSwitches.forEach((sw) => {
    const name = sw.domain_name || sw.name || 'Unknown';
    if (!switchGroups[name]) {
      switchGroups[name] = [];
    }
    switchGroups[name].push(sw);
  });

  const sortedNames = Object.keys(switchGroups).sort();

  return (
    <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 dark:border-white/5">
        <div className="flex items-center space-x-2">
          <Router className="h-5 w-5 text-cyan-500" />
          <h2 className="text-lg font-semibold">Network Switches (SAN/MDS)</h2>
          <span className="ml-2 px-2 py-1 bg-cyan-600/20 text-cyan-400 rounded text-xs">
            {networkSwitches.length} switch{networkSwitches.length !== 1 ? 'es' : ''}
          </span>
        </div>
      </div>

      <div className="divide-y divide-white/10 dark:divide-white/5">
        {sortedNames.map((name) => {
          const switches = switchGroups[name];
          const isExpanded = expanded === name;

          return (
            <div key={name}>
              <button
                onClick={() => setExpanded(isExpanded ? false : name)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/20 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  )}
                  <Router className="h-6 w-6 text-cyan-400" />
                  <div className="text-left">
                    <p className="font-medium">{name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {switches.length} unit{switches.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {switches.map((sw) => (
                    <span
                      key={sw.moid}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sw.oper_evac_state === 'disabled'
                          ? 'bg-green-600/20 text-green-400'
                          : 'bg-yellow-600/20 text-yellow-400'
                      }`}
                    >
                      {sw.switch_id || 'SW'}
                    </span>
                  ))}
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-4">
                  <div className="ml-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {switches.map((sw) => (
                      <div
                        key={sw.moid}
                        className="bg-white/30 dark:bg-white/5 rounded-lg p-4 border border-white/20 dark:border-white/10"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-cyan-600/20 rounded-lg">
                              <Router className="h-5 w-5 text-cyan-400" />
                            </div>
                            <div>
                              <h3 className="font-medium">{sw.display_name || sw.name}</h3>
                              <p className="text-sm text-slate-500 dark:text-slate-400">{sw.serial}</p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              sw.oper_evac_state === 'disabled'
                                ? 'bg-green-600/20 text-green-400'
                                : 'bg-yellow-600/20 text-yellow-400'
                            }`}
                          >
                            {sw.oper_evac_state === 'disabled' ? 'Active' : sw.oper_evac_state || 'N/A'}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs">Model</p>
                            <p className="font-medium text-sm">{sw.model || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs">FC Mode</p>
                            <p className="font-medium text-sm">{sw.fc_mode || 'N/A'}</p>
                          </div>
                          {sw.out_of_band_ip_address && (
                            <div className="col-span-2">
                              <p className="text-slate-500 dark:text-slate-400 text-xs">OOB IP</p>
                              <p className="font-mono text-cyan-400 text-sm">{sw.out_of_band_ip_address}</p>
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
        })}
      </div>
    </div>
  );
}

export default NetworkSwitchesSection;
