import { Box, Cpu, Network, FileText, TrendingUp, Building2 } from 'lucide-react';

function SummaryCards({ summary }) {
  if (!summary) return null;

  const cards = [
    {
      label: 'Chassis',
      value: summary.total_chassis,
      subtitle: `${summary.domains?.length || 0} domains`,
      icon: Box,
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Blade Servers',
      value: summary.total_blades,
      subtitle: `${summary.assigned_blades} assigned · ${summary.unassigned_blades} free`,
      icon: Cpu,
      color: 'cyan',
      gradient: 'from-cyan-500 to-cyan-600',
    },
    {
      label: 'Fabric Interconnects',
      value: summary.total_fis,
      subtitle: `${summary.domains?.length || 0} domains`,
      icon: Network,
      color: 'emerald',
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      label: 'Server Profiles',
      value: summary.total_profiles,
      subtitle: `${summary.assigned_profiles} assigned · ${summary.unassigned_profiles} unassigned`,
      icon: FileText,
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-5 overflow-hidden card-hover"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                  <p className="text-3xl font-bold mt-1">{card.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{card.subtitle}</p>
                </div>
                <div className={`bg-${card.color}-500/10 p-2.5 rounded-xl`}>
                  <Icon className={`h-5 w-5 text-${card.color}-400`} />
                </div>
              </div>
              <div className="flex items-center space-x-1 mt-3">
                <TrendingUp className="h-3 w-3 text-green-400" />
                <span className="text-xs text-green-400 font-medium">Healthy</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Server Generation Breakdown */}
      {summary.gen_breakdown && (
        <div className="relative liquid-glass liquid-glass-shimmer rounded-2xl p-5 overflow-hidden">
          <div className="flex items-center space-x-2 mb-4">
            <Building2 className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold">Server Generations by Domain</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(summary.gen_breakdown).map(([dc, gens]) => (
              <div key={dc} className="bg-white/20 dark:bg-white/5 rounded-xl p-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 truncate">{dc}</p>
                <div className="space-y-1">
                  {Object.entries(gens).map(([gen, count]) => (
                    <div key={gen} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{gen}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SummaryCards;
