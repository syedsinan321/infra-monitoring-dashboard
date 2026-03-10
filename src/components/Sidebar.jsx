import { Link, useLocation } from 'react-router-dom';
import { useSidebar } from '../SidebarContext';
import ThemeToggle from './ThemeToggle';
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Monitor,
  Wrench,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  Server,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard', desc: 'Infrastructure overview' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { path: '/host-inventory', icon: ClipboardList, label: 'Host Inventory', desc: 'ESXi host tracking' },
    ],
  },
  {
    title: 'VMware',
    items: [
      { path: '/capacity', icon: BarChart3, label: 'Capacity Planning', desc: 'Resource utilization' },
      { path: '/esxi-versions', icon: Monitor, label: 'ESXi Versions', desc: 'Build compliance' },
      { path: '/vmware-tools', icon: Wrench, label: 'VMware Tools', desc: 'Tools version audit' },
    ],
  },
  {
    title: 'Security',
    items: [
      { path: '/tpm-keys', icon: KeyRound, label: 'TPM Keys', desc: 'Recovery key vault' },
    ],
  },
];

function Sidebar() {
  const { collapsed, toggleCollapsed } = useSidebar();
  const location = useLocation();

  return (
    <aside
      className="fixed left-0 top-0 h-full z-30 flex flex-col transition-all duration-300 overflow-hidden"
      style={{ width: collapsed ? 68 : 270 }}
    >
      {/* Glass background */}
      <div className="absolute inset-0 liquid-glass border-r border-white/10 dark:border-white/5" />

      {/* Ambient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"
          style={{ top: '10%', left: '-20%', animation: 'sidebarOrb1 20s ease-in-out infinite' }}
        />
        <div
          className="absolute w-28 h-28 bg-purple-500/15 rounded-full blur-3xl"
          style={{ top: '50%', right: '-15%', animation: 'sidebarOrb2 25s ease-in-out infinite' }}
        />
        <div
          className="absolute w-24 h-24 bg-cyan-500/15 rounded-full blur-3xl"
          style={{ bottom: '15%', left: '10%', animation: 'sidebarOrb3 18s ease-in-out infinite' }}
        />
        <div
          className="absolute w-20 h-20 bg-emerald-500/10 rounded-full blur-3xl"
          style={{ top: '30%', left: '40%', animation: 'sidebarOrb4 22s ease-in-out infinite' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-5 flex items-center justify-between border-b border-white/10 dark:border-white/5">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2 rounded-xl">
                <Server className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold gradient-text">Infrastructure</h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Dashboard</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto bg-gradient-to-br from-blue-500 to-cyan-500 p-2 rounded-xl">
              <Server className="h-5 w-5 text-white" />
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center rounded-xl transition-all duration-200 group relative ${
                        collapsed ? 'justify-center p-3' : 'px-3 py-2.5'
                      } ${
                        isActive
                          ? 'bg-blue-500/15 text-blue-400 dark:text-blue-300'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-white/20 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                      {!collapsed && (
                        <div className="ml-3 min-w-0">
                          <p className="text-sm font-medium truncate">{item.label}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-500 truncate">{item.desc}</p>
                        </div>
                      )}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-400 rounded-r-full" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 dark:border-white/5 px-3 py-4 space-y-3">
          {!collapsed && <ThemeToggle />}
          <button
            onClick={toggleCollapsed}
            className={`flex items-center rounded-lg transition-colors text-sm text-slate-400 hover:text-slate-200 hover:bg-white/10 ${
              collapsed ? 'justify-center p-2 w-full' : 'px-3 py-2 w-full'
            }`}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
