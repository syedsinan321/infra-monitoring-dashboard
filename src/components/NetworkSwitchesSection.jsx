import { useState } from 'react';
import { Wifi, ChevronDown, ChevronRight } from 'lucide-react';

function NetworkSwitchesSection({ switches }) {
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (group) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  // Group by domain_name
  const grouped = {};
  switches.forEach((sw) => {
    const group = sw.domain_name || 'Unknown';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(sw);
  });

  const sortedGroups = Object.keys(grouped).sort();

  return (
    <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wifi className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold">Network Switches</h2>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {switches.length} switches
          </span>
        </div>
      </div>

      <div className="divide-y divide-white/10 dark:divide-white/5">
        {sortedGroups.map((group) => {
          const groupSwitches = grouped[group];
          const isExpanded = expandedGroups[group];

          return (
            <div key={group}>
              <button
                onClick={() => toggleGroup(group)}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/20 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <Wifi className="h-4 w-4 text-purple-400" />
                  <span className="font-medium">{group}</span>
                </div>
                <span className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded text-xs">
                  {groupSwitches.length} switch{groupSwitches.length !== 1 ? 'es' : ''}
                </span>
              </button>

              {isExpanded && (
                <div className="bg-white/20 dark:bg-white/5">
                  <table className="w-full">
                    <thead className="bg-white/30 dark:bg-white/5">
                      <tr>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Serial</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Model</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">FC Mode</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">OOB IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 dark:divide-white/5">
                      {groupSwitches.map((sw) => (
                        <tr key={sw.moid} className="hover:bg-white/20 dark:hover:bg-white/5">
                          <td className="px-6 py-3 text-sm font-medium">{sw.display_name || sw.name}</td>
                          <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400 font-mono">{sw.serial}</td>
                          <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">{sw.model}</td>
                          <td className="px-6 py-3">
                            <span className="px-2 py-0.5 bg-purple-600/20 text-purple-400 rounded text-xs">{sw.fc_mode}</span>
                          </td>
                          <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400 font-mono">{sw.oob_ip}</td>
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

export default NetworkSwitchesSection;
