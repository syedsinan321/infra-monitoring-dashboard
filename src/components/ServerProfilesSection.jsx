import { useState } from 'react';
import { FileText, ChevronDown, ChevronRight, Box, Cpu } from 'lucide-react';

function formatDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function ServerProfilesSection({ profiles, blades, chassis }) {
  const [expandedChassis, setExpandedChassis] = useState({});

  const toggleChassis = (chassisId) => {
    setExpandedChassis((prev) => ({
      ...prev,
      [chassisId]: !prev[chassisId],
    }));
  };

  const getBladeForProfile = (profile) => {
    if (!profile.assigned_server) return null;
    return blades.find((blade) => blade.moid === profile.assigned_server.moid);
  };

  // Group profiles by chassis
  const groupProfilesByChassis = () => {
    const groups = {};
    const unassigned = [];

    profiles.forEach((profile) => {
      const blade = getBladeForProfile(profile);
      if (blade && blade.chassis_name) {
        const chassisName = blade.chassis_name;
        if (!groups[chassisName]) {
          groups[chassisName] = {
            name: chassisName,
            profiles: [],
          };
        }
        groups[chassisName].profiles.push({ ...profile, blade });
      } else if (!profile.assigned_server) {
        unassigned.push(profile);
      } else {
        if (!groups['Other']) {
          groups['Other'] = {
            name: 'Other',
            profiles: [],
          };
        }
        groups['Other'].profiles.push({ ...profile, blade: null });
      }
    });

    if (unassigned.length > 0) {
      groups['Unassigned'] = {
        name: 'Unassigned',
        profiles: unassigned.map((p) => ({ ...p, blade: null })),
      };
    }

    return groups;
  };

  const chassisGroups = groupProfilesByChassis();
  const sortedChassisNames = Object.keys(chassisGroups).sort((a, b) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

  const assignedProfiles = profiles.filter((p) => p.assigned_server);
  const unassignedProfiles = profiles.filter((p) => !p.assigned_server);

  return (
    <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Server Profiles</h2>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-slate-500 dark:text-slate-400">{assignedProfiles.length} Assigned</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
              <span className="text-slate-500 dark:text-slate-400">{unassignedProfiles.length} Unassigned</span>
            </span>
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/10 dark:divide-white/5">
        {profiles.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
            No server profiles found
          </div>
        ) : (
          sortedChassisNames.map((chassisName) => {
            const group = chassisGroups[chassisName];
            const isExpanded = expandedChassis[chassisName];
            const isUnassigned = chassisName === 'Unassigned';

            return (
              <div key={chassisName}>
                <button
                  onClick={() => toggleChassis(chassisName)}
                  className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/20 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                    <Box className={`h-4 w-4 ${isUnassigned ? 'text-gray-500' : 'text-blue-400'}`} />
                    <span className="font-medium">{chassisName}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      isUnassigned 
                        ? 'bg-gray-600/20 text-gray-400' 
                        : 'bg-green-600/20 text-green-400'
                    }`}>
                      {group.profiles.length} profile{group.profiles.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="bg-white/20 dark:bg-white/5">
                    <table className="w-full">
                      <thead className="bg-white/30 dark:bg-white/5">
                        <tr>
                          <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Profile Name
                          </th>
                          <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Blade / Slot
                          </th>
                          <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Blade Model
                          </th>
                          <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Config State
                          </th>
                          <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Platform
                          </th>
                          <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Created
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10 dark:divide-white/5">
                        {group.profiles.map((item) => (
                          <tr key={item.moid} className="hover:bg-white/20 dark:hover:bg-white/5">
                            <td className="px-6 py-3">
                              <div>
                                <p className="font-medium text-sm">{item.name}</p>
                                {item.description && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              {item.blade ? (
                                <div className="flex items-center space-x-2">
                                  <Cpu className="h-4 w-4 text-blue-400" />
                                  <div>
                                    <p className="text-sm font-medium">{item.blade.name || `Blade ${item.blade.slot_id}`}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Slot {item.blade.slot_id}</p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">
                              {item.blade?.model || '—'}
                            </td>
                            <td className="px-6 py-3">
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  item.config_context?.config_state === 'Applied'
                                    ? 'bg-green-600/20 text-green-400'
                                    : item.config_context?.config_state === 'Applying'
                                    ? 'bg-yellow-600/20 text-yellow-400'
                                    : 'bg-gray-600/20 text-gray-400'
                                }`}
                              >
                                {item.config_context?.config_state || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">
                              {item.target_platform || 'N/A'}
                            </td>
                            <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">
                              {formatDate(item.create_time)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

export default ServerProfilesSection;
