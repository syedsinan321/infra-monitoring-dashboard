import { useState, useMemo } from 'react';
import { FileText, Server, Search, Filter, CheckCircle, XCircle, ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';

function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ServerProfilesPage({ profiles, blades, chassis }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, assigned, unassigned
  const [expandedProfiles, setExpandedProfiles] = useState({});
  const [expandedChassis, setExpandedChassis] = useState({});
  const [sectionsExpanded, setSectionsExpanded] = useState({
    assigned: true,
    unassigned: true,
  });

  // Build blade lookup map
  const bladeMap = useMemo(() => {
    const map = {};
    (blades || []).forEach(blade => {
      map[blade.moid] = blade;
    });
    return map;
  }, [blades]);

  // Build chassis lookup map
  const chassisMap = useMemo(() => {
    const map = {};
    (chassis || []).forEach(ch => {
      map[ch.moid] = ch;
    });
    return map;
  }, [chassis]);

  // Enrich profiles with blade and chassis info
  const enrichedProfiles = useMemo(() => {
    return (profiles || []).map(profile => {
      const assignedServer = profile.assigned_server;
      let blade = null;
      let chassisInfo = null;

      if (assignedServer?.moid) {
        blade = bladeMap[assignedServer.moid];
        if (blade?.chassis_moid) {
          chassisInfo = chassisMap[blade.chassis_moid];
        }
      }

      return {
        ...profile,
        blade,
        chassisInfo,
      };
    });
  }, [profiles, bladeMap, chassisMap]);

  // Filter and search profiles
  const filteredProfiles = useMemo(() => {
    return enrichedProfiles.filter(profile => {
      // Filter by status
      if (filterStatus === 'assigned' && !profile.assigned_server) return false;
      if (filterStatus === 'unassigned' && profile.assigned_server) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = profile.name?.toLowerCase().includes(query);
        const matchesBlade = profile.blade?.name?.toLowerCase().includes(query);
        const matchesChassis = profile.chassisInfo?.name?.toLowerCase().includes(query);
        const matchesSerial = profile.blade?.serial?.toLowerCase().includes(query);
        return matchesName || matchesBlade || matchesChassis || matchesSerial;
      }

      return true;
    });
  }, [enrichedProfiles, filterStatus, searchQuery]);

  // Group profiles by chassis
  const profilesByAssignment = useMemo(() => {
    const assigned = filteredProfiles.filter(p => p.assigned_server);
    const unassigned = filteredProfiles.filter(p => !p.assigned_server);

    // Group assigned by chassis
    const byChassisMap = {};
    assigned.forEach(profile => {
      const chassisName = profile.chassisInfo?.name || 'Unknown Chassis';
      if (!byChassisMap[chassisName]) {
        byChassisMap[chassisName] = [];
      }
      byChassisMap[chassisName].push(profile);
    });

    // Sort chassis names
    const byChassis = Object.entries(byChassisMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chassisName, profiles]) => ({
        chassisName,
        profiles: profiles.sort((a, b) => (a.blade?.slot_id || 0) - (b.blade?.slot_id || 0)),
      }));

    return { assigned, unassigned, byChassis };
  }, [filteredProfiles]);

  const toggleSection = (section) => {
    setSectionsExpanded(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleChassis = (chassisName) => {
    setExpandedChassis(prev => ({
      ...prev,
      [chassisName]: !prev[chassisName],
    }));
  };

  const toggleProfile = (profileName) => {
    setExpandedProfiles(prev => ({
      ...prev,
      [profileName]: !prev[profileName],
    }));
  };

  const stats = {
    total: profiles?.length || 0,
    assigned: enrichedProfiles.filter(p => p.assigned_server).length,
    unassigned: enrichedProfiles.filter(p => !p.assigned_server).length,
  };

  return (
    <>
        {/* Header */}
        <header className="relative">
          <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl mx-4 sm:mx-6 lg:mx-8 mt-6 overflow-hidden">

          <div className="relative w-full px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-2.5 rounded-xl">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">Server Profiles</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Profile to Blade Assignments</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 px-3 py-2 bg-white/20 dark:bg-white/5 rounded-lg border border-white/20 dark:border-white/10">
                  <span className="text-2xl font-bold text-amber-400">{stats.total}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Total</span>
                </div>
                <div className="flex items-center space-x-2 px-3 py-2 bg-white/20 dark:bg-white/5 rounded-lg border border-white/20 dark:border-white/10">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span className="text-lg font-bold text-emerald-400">{stats.assigned}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Assigned</span>
                </div>
                <div className="flex items-center space-x-2 px-3 py-2 bg-white/20 dark:bg-white/5 rounded-lg border border-white/20 dark:border-white/10">
                  <XCircle className="h-4 w-4 text-slate-500" />
                  <span className="text-lg font-bold text-slate-500 dark:text-slate-400">{stats.unassigned}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">Unassigned</span>
                </div>
              </div>
            </div>
          </div>

          </div>
        </header>

        {/* Main Content */}
        <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
          {/* Search and Filter */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="text"
                placeholder="Search profiles, blades, chassis, or serial numbers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 bg-white/40 dark:bg-white/5 border border-slate-300/50 dark:border-slate-700/50 backdrop-blur-sm rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
              >
                <option value="all">All Profiles</option>
                <option value="assigned">Assigned Only</option>
                <option value="unassigned">Unassigned Only</option>
              </select>
            </div>
          </div>

          {/* Expand/Collapse All Controls */}
          <div className="flex items-center justify-end space-x-2 mb-4">
            <span className="text-sm text-slate-500 mr-2">Sections:</span>
            <button
              onClick={() => {
                setSectionsExpanded({ assigned: true, unassigned: true });
                // Expand all chassis
                const allChassis = {};
                profilesByAssignment.byChassis.forEach(({ chassisName }) => {
                  allChassis[chassisName] = true;
                });
                setExpandedChassis(allChassis);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600/50 rounded-lg text-xs font-medium transition-colors"
            >
              <ChevronsUpDown className="h-3 w-3" />
              <span>Expand All</span>
            </button>
            <button
              onClick={() => {
                setSectionsExpanded({ assigned: false, unassigned: false });
                setExpandedChassis({});
                setExpandedProfiles({});
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600/50 rounded-lg text-xs font-medium transition-colors"
            >
              <ChevronsUpDown className="h-3 w-3" />
              <span>Collapse All</span>
            </button>
          </div>

          {/* Assigned Profiles by Chassis */}
          {(filterStatus === 'all' || filterStatus === 'assigned') && profilesByAssignment.byChassis.length > 0 && (
            <div className="mb-8 relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleSection('assigned')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {sectionsExpanded.assigned ? (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  )}
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  <span className="font-semibold text-slate-900 dark:text-white">Assigned Profiles by Chassis</span>
                  <span className="text-sm text-slate-500">({profilesByAssignment.assigned.length})</span>
                </div>
              </button>

              {sectionsExpanded.assigned && (
              <div className="px-4 pb-4 space-y-4">
                {profilesByAssignment.byChassis.map(({ chassisName, profiles }) => (
                  <div key={chassisName} className="relative liquid-glass rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleChassis(chassisName)}
                      className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        {expandedChassis[chassisName] ? (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        )}
                        <Server className="h-5 w-5 text-blue-400" />
                        <span className="font-medium">{chassisName}</span>
                        <span className="text-sm text-slate-500">({profiles.length} profiles)</span>
                      </div>
                    </button>

                    {expandedChassis[chassisName] && (
                    <div className="divide-y divide-white/10 dark:divide-white/5">
                      {profiles.map((profile) => (
                        <div key={profile.name} className="hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                          <button
                            onClick={() => toggleProfile(profile.name)}
                            className="w-full px-4 py-3 flex items-center justify-between text-left"
                          >
                            <div className="flex items-center space-x-4">
                              {expandedProfiles[profile.name] ? (
                                <ChevronDown className="h-4 w-4 text-slate-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-500" />
                              )}
                              <div>
                                <p className="font-medium text-amber-400">{profile.name}</p>
                                <p className="text-sm text-slate-500">
                                  Slot {profile.blade?.slot_id} → {profile.blade?.name}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-sm">
                              <span className="text-slate-400">{profile.blade?.model}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                profile.blade?.oper_power_state === 'on'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-slate-500/20 text-slate-400'
                              }`}>
                                {profile.blade?.oper_power_state || 'Unknown'}
                              </span>
                            </div>
                          </button>

                          {expandedProfiles[profile.name] && (
                            <div className="px-4 pb-4 pl-12">
                              <div className="bg-white/30 dark:bg-white/5 backdrop-blur-sm rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">Blade Serial</p>
                                  <p className="font-mono text-slate-700 dark:text-slate-300">{profile.blade?.serial || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">Blade Model</p>
                                  <p className="text-slate-700 dark:text-slate-300">{profile.blade?.model || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">Chassis</p>
                                  <p className="text-slate-700 dark:text-slate-300">{chassisName}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">Slot</p>
                                  <p className="text-slate-700 dark:text-slate-300">{profile.blade?.slot_id || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">Power State</p>
                                  <p className={profile.blade?.oper_power_state === 'on' ? 'text-emerald-400' : 'text-slate-400'}>
                                    {profile.blade?.oper_power_state || 'Unknown'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">CPU Cores</p>
                                  <p className="text-slate-700 dark:text-slate-300">{profile.blade?.num_cpu_cores || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">Memory (GB)</p>
                                  <p className="text-slate-700 dark:text-slate-300">{profile.blade?.total_memory ? Math.round(profile.blade.total_memory / 1024) : 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">Profile Status</p>
                                  <p className="text-amber-400">Assigned</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">Profile Created</p>
                                  <p className="text-slate-700 dark:text-slate-300">{formatDate(profile.create_time)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500 text-xs mb-1">Last Modified</p>
                                  <p className="text-slate-700 dark:text-slate-300">{formatDate(profile.mod_time)}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                ))}
              </div>
              )}
            </div>
          )}

          {/* Unassigned Profiles */}
          {(filterStatus === 'all' || filterStatus === 'unassigned') && profilesByAssignment.unassigned.length > 0 && (
            <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleSection('unassigned')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {sectionsExpanded.unassigned ? (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  )}
                  <XCircle className="h-5 w-5 text-slate-500" />
                  <span className="font-semibold text-slate-900 dark:text-white">Unassigned Profiles</span>
                  <span className="text-sm text-slate-500">({profilesByAssignment.unassigned.length})</span>
                </div>
              </button>

              {sectionsExpanded.unassigned && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profilesByAssignment.unassigned.map((profile) => (
                    <div
                      key={profile.name}
                      className="bg-white/30 dark:bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/20 dark:border-white/10 hover:border-white/30 dark:hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="bg-white/30 dark:bg-white/10 p-2 rounded-lg">
                          <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 dark:text-slate-300">{profile.name}</p>
                          <p className="text-xs text-slate-500">Not assigned to any blade</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>
          )}

          {/* No results */}
          {filteredProfiles.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No profiles found matching your criteria</p>
            </div>
          )}
        </main>
    </>
  );
}

export default ServerProfilesPage;
