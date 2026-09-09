import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Server, ChevronRight, HardDrive, Power, PowerOff, Layers, FileText, X, ExternalLink } from 'lucide-react';
import { Badge } from './ui';

function getSlotUtilization(used, total) {
  if (!total) return 0;
  return (used / total) * 100;
}

function SlotCard({ slotNumber, blade }) {
  if (!blade) {
    return (
      <div className="rounded-lg p-2 border border-dashed border-slate-300/70 dark:border-white/[0.12] bg-slate-100/40 dark:bg-white/[0.03]">
        <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
          <HardDrive className="h-3 w-3" />
          <span className="text-xs">Slot {slotNumber}</span>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Empty</p>
      </div>
    );
  }

  const hasProfile = !!blade.assigned_server_profile;
  return (
    <div
      title={`${blade.name} · ${blade.serial}`}
      className={`rounded-lg p-2 border ${
        hasProfile
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-500/40'
          : 'bg-amber-50 dark:bg-amber-900/15 border-amber-300 dark:border-amber-500/30'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <HardDrive className={`h-3 w-3 ${hasProfile ? 'text-blue-400' : 'text-amber-400'}`} />
          <span className="text-xs font-medium">Slot {slotNumber}</span>
        </div>
        {blade.oper_power_state === 'on' ? (
          <Power className="h-3 w-3 text-green-500" />
        ) : (
          <PowerOff className="h-3 w-3 text-gray-500" />
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{blade.model}</p>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {blade.num_cpus}CPU • {blade.num_cpu_cores}C • {Math.round((blade.total_memory || 0) / 1024)}GB
      </div>
      {hasProfile ? (
        <div className="mt-1">
          <span className="px-1.5 py-0.5 bg-blue-600/20 text-blue-500 dark:text-blue-400 rounded text-xs truncate flex items-center gap-1">
            <FileText className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="truncate">{blade.assigned_server_profile}</span>
          </span>
        </div>
      ) : (
        <div className="mt-1">
          <span className="px-1.5 py-0.5 bg-amber-600/10 text-amber-500/80 rounded text-xs block">
            No Profile — Free
          </span>
        </div>
      )}
    </div>
  );
}

function ChassisSection({ chassis, blades }) {
  const [modalDomain, setModalDomain] = useState(null);

  // Group chassis by domain (chassis "site1prducs01-3" -> domain "site1prducs01")
  const domainGroups = useMemo(() => {
    const groups = {};
    chassis.forEach((ch) => {
      const name = ch.name || '';
      const parts = name.split('-');
      let domain = name;
      if (parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1])) {
        domain = parts.slice(0, -1).join('-');
      }

      if (!groups[domain]) {
        groups[domain] = { name: domain, chassis: [], totalSlots: 0, usedSlots: 0, profiledSlots: 0 };
      }
      groups[domain].chassis.push(ch);
      groups[domain].totalSlots += ch.total_slots || 8;
      groups[domain].usedSlots += ch.used_slots || 0;
    });

    Object.values(groups).forEach((group) => {
      group.profiledSlots = group.chassis.reduce((sum, ch) => {
        const chassisBlades = blades.filter((b) => b.chassis_moid === ch.moid);
        return sum + chassisBlades.filter((b) => b.assigned_server_profile).length;
      }, 0);
      group.chassis.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [chassis, blades]);

  const getBladesForChassis = (chassisMoid) =>
    blades.filter((blade) => blade.chassis_moid === chassisMoid);

  return (
    <>
      <div className="relative ai-surface rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/70 dark:border-white/[0.07]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold tracking-tight">Chassis & Blade Utilization</h2>
            </div>
            <div className="flex items-center space-x-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                <span>Profiled</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                <span>Blade (No Profile)</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600 border border-dashed border-slate-400 dark:border-slate-500" />
                <span>Empty Slot</span>
              </span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200/60 dark:divide-white/[0.05]">
          {domainGroups.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
              No chassis found in your Vantage environment
            </div>
          ) : (
            domainGroups.map((domain) => {
              const domainUtilization = getSlotUtilization(domain.usedSlots, domain.totalSlots);

              return (
                <button
                  key={domain.name}
                  onClick={() => setModalDomain(domain)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors group"
                  title="Open chassis detail"
                >
                  <div className="flex items-center space-x-4">
                    <Layers className="h-6 w-6 text-cyan-400" />
                    <div className="text-left">
                      <p className="font-medium group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                        {domain.name}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {domain.chassis.length} chassis
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <p className="text-sm text-slate-500 dark:text-slate-400">Utilization</p>
                      <p className="font-medium">
                        <span className="text-blue-400">{domain.profiledSlots}</span>
                        <span className="text-slate-500 dark:text-slate-400"> Profiled</span>
                        <span className="text-slate-400 dark:text-slate-500 mx-1">/</span>
                        <span className="text-amber-400">{domain.usedSlots - domain.profiledSlots}</span>
                        <span className="text-slate-500 dark:text-slate-400"> Free</span>
                        <span className="text-slate-400 dark:text-slate-500 mx-1">/</span>
                        <span className="text-slate-500 dark:text-slate-300">{domain.totalSlots - domain.usedSlots}</span>
                        <span className="text-slate-500 dark:text-slate-400"> Empty</span>
                      </p>
                    </div>
                    <div className="w-36">
                      <div className="h-2 bg-white/30 dark:bg-white/10 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${getSlotUtilization(domain.profiledSlots, domain.totalSlots)}%` }}
                        />
                        <div
                          className="h-full bg-amber-500 transition-all"
                          style={{ width: `${getSlotUtilization(domain.usedSlots - domain.profiledSlots, domain.totalSlots)}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <p className="text-xs text-blue-400">
                          {getSlotUtilization(domain.profiledSlots, domain.totalSlots).toFixed(0)}% profiled
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {domainUtilization.toFixed(0)}% populated
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Domain drill-down popup — portaled to <body> so the containing
          card's backdrop-filter can't trap the fixed overlay */}
      {modalDomain && createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setModalDomain(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[88vh] overflow-y-auto rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header */}
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200/70 dark:border-white/[0.07] bg-white/95 dark:bg-slate-900/95 backdrop-blur">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-cyan-500/15 flex-shrink-0">
                  <Layers className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white truncate">
                    {modalDomain.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {modalDomain.chassis.length} chassis · {modalDomain.usedSlots} of {modalDomain.totalSlots} slots populated
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {modalDomain.chassis.every(c => (c.oper_state || '').toUpperCase() === 'OK') ? (
                  <Badge dot variant="success">All chassis healthy</Badge>
                ) : (
                  <Badge dot variant="warning">Chassis issues</Badge>
                )}
                <Badge variant="info">{modalDomain.profiledSlots} Profiled</Badge>
                <Badge variant="warning">{modalDomain.usedSlots - modalDomain.profiledSlots} Free</Badge>
                <Badge variant="neutral">{modalDomain.totalSlots - modalDomain.usedSlots} Empty</Badge>
                <button
                  onClick={() => setModalDomain(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Per-chassis slot maps */}
            <div className="p-5 space-y-4">
              {modalDomain.chassis.map((ch) => {
                const chassisBlades = getBladesForChassis(ch.moid);
                const profiledBlades = chassisBlades.filter((b) => b.assigned_server_profile).length;
                const freeBlades = (ch.used_slots || 0) - profiledBlades;
                const emptySlots = (ch.total_slots || 0) - (ch.used_slots || 0);
                const healthy = (ch.oper_state || '').toUpperCase() === 'OK';

                return (
                  <div
                    key={ch.moid}
                    className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Server className="h-4 w-4 text-blue-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{ch.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {ch.model} · {ch.serial}
                            {ch.connection_status ? ` · Fabric ${ch.connection_status}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs tabular-nums">
                          <span className="text-blue-400 font-medium">{profiledBlades}</span>
                          <span className="text-slate-500"> Profiled · </span>
                          <span className="text-amber-400 font-medium">{freeBlades}</span>
                          <span className="text-slate-500"> Free · </span>
                          <span className="text-slate-600 dark:text-slate-300 font-medium">{emptySlots}</span>
                          <span className="text-slate-500"> Empty</span>
                        </span>
                        <Badge dot variant={healthy ? 'success' : 'warning'}>
                          {ch.oper_state || 'Unknown'}
                        </Badge>
                        <a
                          href={`https://us-east-1.vantage.example.com/an/infrastructure-service/an/network/chassis/${ch.moid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium
                            border border-slate-300/70 dark:border-white/[0.1] text-slate-600 dark:text-slate-300
                            hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="Open this chassis in Vantage"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Vantage
                        </a>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                      {Array.from({ length: ch.total_slots || 8 }, (_, i) => {
                        const slotNumber = i + 1;
                        const blade = chassisBlades.find((b) => b.slot_id === slotNumber);
                        return <SlotCard key={slotNumber} slotNumber={slotNumber} blade={blade} />;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default ChassisSection;
