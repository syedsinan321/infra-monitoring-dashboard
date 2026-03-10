import { useState, useMemo } from 'react';
import { Box, ChevronDown, ChevronRight, Cpu, Server } from 'lucide-react';

function ChassisSection({ chassis, blades }) {
  const [expandedDomains, setExpandedDomains] = useState({});
  const [expandedChassis, setExpandedChassis] = useState({});

  const toggleDomain = (domain) => {
    setExpandedDomains((prev) => ({ ...prev, [domain]: !prev[domain] }));
  };

  const toggleChassis = (chassisId) => {
    setExpandedChassis((prev) => ({ ...prev, [chassisId]: !prev[chassisId] }));
  };

  const groupedByDomain = useMemo(() => {
    const groups = {};
    chassis.forEach((ch) => {
      const domain = ch.domain_name || 'Unknown';
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(ch);
    });
    return groups;
  }, [chassis]);

  const sortedDomains = Object.keys(groupedByDomain).sort();

  return (
    <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Box className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Chassis & Blade Utilization</h2>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {chassis.length} chassis · {blades.length} blades
          </span>
        </div>
      </div>

      <div className="divide-y divide-white/10 dark:divide-white/5">
        {sortedDomains.map((domain) => {
          const domainChassis = groupedByDomain[domain];
          const isDomainExpanded = expandedDomains[domain];
          const domainBladeCount = domainChassis.reduce((sum, ch) => sum + ch.blades.length, 0);

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
                  <Server className="h-4 w-4 text-blue-400" />
                  <span className="font-medium">{domain}</span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-slate-500 dark:text-slate-400">
                  <span>{domainChassis.length} chassis</span>
                  <span>{domainBladeCount} blades</span>
                </div>
              </button>

              {isDomainExpanded && (
                <div className="bg-white/20 dark:bg-white/5">
                  {domainChassis
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((ch) => {
                      const isChassisExpanded = expandedChassis[ch.moid];
                      const usedSlots = ch.blades.length;
                      const totalSlots = ch.slot_count || 8;
                      const utilPct = Math.round((usedSlots / totalSlots) * 100);

                      return (
                        <div key={ch.moid} className="border-t border-white/5">
                          <button
                            onClick={() => toggleChassis(ch.moid)}
                            className="w-full px-8 py-2.5 flex items-center justify-between hover:bg-white/20 dark:hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              {isChassisExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                              )}
                              <Box className="h-4 w-4 text-cyan-400" />
                              <span className="text-sm font-medium">{ch.name}</span>
                              <span className="text-xs text-slate-500">({ch.model})</span>
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700/40 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      utilPct >= 85
                                        ? 'bg-red-500'
                                        : utilPct >= 60
                                        ? 'bg-amber-500'
                                        : 'bg-green-500'
                                    }`}
                                    style={{ width: `${utilPct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-400 font-mono">
                                  {usedSlots}/{totalSlots}
                                </span>
                              </div>
                            </div>
                          </button>

                          {isChassisExpanded && ch.blades.length > 0 && (
                            <div className="px-8 pb-3">
                              <table className="w-full">
                                <thead>
                                  <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                                    <th className="text-left py-1.5 px-3 font-medium">Slot</th>
                                    <th className="text-left py-1.5 px-3 font-medium">Blade</th>
                                    <th className="text-left py-1.5 px-3 font-medium">Model</th>
                                    <th className="text-center py-1.5 px-3 font-medium">CPUs</th>
                                    <th className="text-center py-1.5 px-3 font-medium">Cores</th>
                                    <th className="text-center py-1.5 px-3 font-medium">Memory</th>
                                    <th className="text-left py-1.5 px-3 font-medium">Profile</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {ch.blades
                                    .sort((a, b) => a.slot_id - b.slot_id)
                                    .map((blade) => (
                                      <tr
                                        key={blade.moid}
                                        className="hover:bg-white/10 dark:hover:bg-white/5 transition-colors text-xs"
                                      >
                                        <td className="py-1.5 px-3 font-mono text-slate-400">
                                          {blade.slot_id}
                                        </td>
                                        <td className="py-1.5 px-3 font-medium text-slate-700 dark:text-slate-200">
                                          {blade.name}
                                        </td>
                                        <td className="py-1.5 px-3 text-slate-500 dark:text-slate-400">
                                          {blade.model}
                                        </td>
                                        <td className="py-1.5 px-3 text-center text-slate-400">
                                          {blade.num_cpus}
                                        </td>
                                        <td className="py-1.5 px-3 text-center text-slate-400">
                                          {blade.num_cpu_cores}
                                        </td>
                                        <td className="py-1.5 px-3 text-center text-slate-400">
                                          {blade.total_memory} GB
                                        </td>
                                        <td className="py-1.5 px-3">
                                          {blade.assigned_profile ? (
                                            <span className="px-2 py-0.5 bg-green-600/20 text-green-400 rounded text-[10px]">
                                              {blade.assigned_profile}
                                            </span>
                                          ) : (
                                            <span className="text-slate-500">—</span>
                                          )}
                                        </td>
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChassisSection;
