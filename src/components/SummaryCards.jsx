import { Server, Cpu, Network, FileText, TrendingUp, ArrowUpRight } from 'lucide-react';

function SummaryCards({ summary }) {
  const cards = [
    {
      title: 'Chassis',
      value: summary.total_chassis,
      icon: Server,
      gradient: 'from-blue-500 to-blue-600',
      bgGlow: 'bg-blue-500/10',
      iconBg: 'bg-blue-500/20',
      subtitle: `${summary.total_slots} total slots`,
      trend: null,
    },
    {
      title: 'Blade Servers',
      value: summary.total_blades,
      icon: Cpu,
      gradient: 'from-emerald-500 to-emerald-600',
      bgGlow: 'bg-emerald-500/10',
      iconBg: 'bg-emerald-500/20',
      subtitle: `${summary.available_slots} slots available`,
      trend: summary.available_slots > 0 ? 'positive' : null,
      serverGenerations: summary.server_generations,
      datacenterGenerations: summary.datacenter_generations,
    },
    {
      title: 'Fabric Interconnects',
      value: summary.total_fis,
      icon: Network,
      gradient: 'from-violet-500 to-purple-600',
      bgGlow: 'bg-violet-500/10',
      iconBg: 'bg-violet-500/20',
      subtitle: 'Active FI pairs',
      trend: null,
    },
    {
      title: 'Server Profiles',
      value: summary.total_profiles,
      icon: FileText,
      gradient: 'from-amber-500 to-orange-500',
      bgGlow: 'bg-amber-500/10',
      iconBg: 'bg-amber-500/20',
      subtitle: `${summary.assigned_profiles} assigned`,
      secondaryValue: summary.unassigned_profiles,
      secondaryLabel: 'unassigned',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((card) => (
        <div
          key={card.title}
          className="group relative liquid-glass liquid-glass-shimmer rounded-2xl p-6 card-hover overflow-hidden"
        >
          {/* Background glow effect */}
          <div className={`absolute -top-12 -right-12 w-32 h-32 ${card.bgGlow} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
          
          <div className="relative">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className={`${card.iconBg} p-3 rounded-xl`}>
                <card.icon className="h-6 w-6 text-white opacity-90" />
              </div>
              {card.trend === 'positive' && (
                <div className="flex items-center space-x-1 text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-1 rounded-full">
                  <TrendingUp className="h-3 w-3" />
                  <span>Available</span>
                </div>
              )}
            </div>

            {/* Title */}
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{card.title}</p>
            
            {/* Value */}
            <div className="flex items-baseline space-x-2">
              <p className={`text-4xl font-bold bg-gradient-to-br ${card.gradient} bg-clip-text text-transparent`}>
                {card.value}
              </p>
              {card.secondaryValue !== undefined && (
                <span className="text-sm text-slate-500 dark:text-slate-500">
                  / <span className="text-amber-400">{card.secondaryValue}</span> {card.secondaryLabel}
                </span>
              )}
            </div>
            
            {/* Subtitle */}
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-2 flex items-center">
              {card.subtitle}
              <ArrowUpRight className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>

            {/* Server Generations Breakdown by Datacenter */}
            {card.datacenterGenerations && Object.keys(card.datacenterGenerations).length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10 dark:border-white/5 space-y-2">
                {['SITE1', 'SITE2', 'Other'].map((dc) => {
                  const dcData = card.datacenterGenerations[dc];
                  if (!dcData) return null;
                  const dcTotal = Object.values(dcData).reduce((a, b) => a + b, 0);
                  return (
                    <div key={dc} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{dc}</span>
                        <span className="text-xs text-slate-500">{dcTotal} servers</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {['M7', 'M6', 'M5', 'M4', 'Other'].map((gen) => {
                          const count = dcData[gen];
                          if (!count) return null;
                          const colors = {
                            M7: 'bg-cyan-500/20 text-cyan-400',
                            M6: 'bg-blue-500/20 text-blue-400',
                            M5: 'bg-emerald-500/20 text-emerald-400',
                            M4: 'bg-amber-500/20 text-amber-400',
                            Other: 'bg-slate-500/20 text-slate-400',
                          };
                          return (
                            <span
                              key={gen}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[gen]}`}
                            >
                              {gen}: {count}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom accent line */}
          <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
        </div>
      ))}
    </div>
  );
}

export default SummaryCards;
