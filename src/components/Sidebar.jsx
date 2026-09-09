import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Server, Activity, Wrench,
  ChevronDown, ChevronLeft, ChevronRight, Sun, Moon, Settings,
} from 'lucide-react';
import PlatformLogo from './PlatformLogo';
import GlobalSearch from './GlobalSearch';
import ClaudeSpark from './ClaudeSpark';
import { useSidebar } from '../SidebarContext';
import { useTheme } from '../ThemeContext';

/**
 * Navigation model. Groups collapse; children are query-aware so two entries
 * can share a route (Hosts vs Host Lifecycle both live on /host-inventory).
 */
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-500 dark:text-blue-400' },
  {
    label: 'Infrastructure',
    icon: Server,
    color: 'text-sky-500 dark:text-sky-400',
    children: [
      {
        to: '/host-inventory?view=lifecycle',
        label: 'Host Lifecycle',
        match: l => l.pathname === '/host-inventory',
      },
      { to: '/inventory', label: 'Inventory' },
      { to: '/decommissioned', label: 'Decommissioned' },
      { to: '/blade-firmware', label: 'Blade Firmware' },
      { to: '/vmware-tools', label: 'ESXi Versions' },
      { to: '/vm-tools', label: 'VMware Tools' },
      { to: '/openshift-licensing', label: 'OpenShift Licensing' },
    ],
  },
  {
    label: 'Monitoring',
    icon: Activity,
    color: 'text-emerald-500 dark:text-emerald-400',
    children: [
      { to: '/backup-status', label: 'Backup Status' },
      { to: '/host-crash-report', label: 'VM Crash Reports' },
    ],
  },
  {
    label: 'Operations',
    icon: Wrench,
    color: 'text-amber-500 dark:text-amber-400',
    children: [
      { to: '/reboot-cimc', label: 'Reboot CIMC' },
      { to: '/tpm-keys', label: 'TPM Keys' },
      { to: '/audit-log', label: 'Audit Log' },
    ],
  },
  {
    label: 'AI Diagnostics',
    icon: ClaudeSpark,
    color: 'text-violet-500 dark:text-violet-400',
    children: [
      {
        to: '/host-diagnostics?section=servers',
        label: 'Servers',
        // Legacy alarms/reports deep links open inside the Servers entity
        match: l => l.pathname === '/host-diagnostics'
          && !l.search.includes('section=fi')
          && !l.search.includes('section=chassis')
          && !l.search.includes('section=usage'),
      },
      {
        to: '/host-diagnostics?section=fi',
        label: 'FI',
        match: l => l.pathname === '/host-diagnostics' && l.search.includes('section=fi'),
      },
      {
        to: '/host-diagnostics?section=chassis',
        label: 'Chassis',
        match: l => l.pathname === '/host-diagnostics' && l.search.includes('section=chassis'),
      },
      {
        to: '/host-diagnostics?section=usage',
        label: 'Claude Usage',
        match: l => l.pathname === '/host-diagnostics' && l.search.includes('section=usage'),
      },
    ],
  },
];

const ROW_IDLE =
  'text-slate-800 dark:text-slate-100 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/5';
const ROW_ACTIVE =
  'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 font-semibold';

function Sidebar() {
  const location = useLocation();
  const { collapsed, toggleCollapsed } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const [openGroups, setOpenGroups] = useState({});

  const childActive = c =>
    c.match ? c.match(location) : location.pathname === c.to;

  const groupActive = item => item.children.some(childActive);

  return (
    <aside
      className={`fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-300 ease-in-out
        liquid-glass border-0 border-r overflow-hidden
        ${collapsed ? 'w-[68px]' : 'w-[270px]'}`}
      style={{ borderColor: 'var(--glass-border-subtle)' }}
    >
      {/* Logo / Brand */}
      <div className="flex items-center px-4 py-5" style={{ borderBottom: '1px solid var(--glass-border-subtle)' }}>
        <div className="flex-shrink-0">
          <PlatformLogo className="h-8 w-auto" />
        </div>
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <h1 className="text-sm font-bold tracking-tight leading-tight">
              <span className="gradient-text">Platform</span>
              <span className="text-slate-900 dark:text-white ml-1">Dashboard</span>
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Infrastructure Monitoring</p>
          </div>
        )}
      </div>

      {/* Global host search */}
      <div className="px-3 pt-3">
        <GlobalSearch collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;

          // Plain link
          if (!item.children) {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={`flex items-center rounded-lg transition-colors text-base font-bold
                  ${collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'}
                  ${active ? ROW_ACTIVE : ROW_IDLE}`}
              >
                <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${item.color || ''}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          }

          // Collapsible group
          const isActive = groupActive(item);
          const expanded = !collapsed && (openGroups[item.label] ?? isActive);
          // Highlighted groups (e.g. Architecture) keep a soft cyan wash even when idle.
          const highlightCls = item.highlight
            ? 'ring-1 ring-inset ring-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10'
            : '';

          if (collapsed) {
            // Collapsed rail: clicking a group re-opens the sidebar on that group.
            return (
              <button
                key={item.label}
                title={item.label}
                onClick={() => {
                  setOpenGroups(g => ({ ...g, [item.label]: true }));
                  toggleCollapsed();
                }}
                className={`w-full flex items-center justify-center px-2 py-2.5 rounded-lg transition-colors
                  ${isActive ? ROW_ACTIVE : ROW_IDLE} ${highlightCls}`}
              >
                <Icon className={`h-[18px] w-[18px] ${item.color || ''}`} />
              </button>
            );
          }

          return (
            <div key={item.label}>
              <button
                onClick={() => setOpenGroups(g => ({ ...g, [item.label]: !expanded }))}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-base font-bold transition-colors
                  ${isActive && !expanded ? ROW_ACTIVE : ROW_IDLE} ${highlightCls}`}
              >
                <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${item.color || ''}`} />
                <span className="flex-1 text-left truncate">
                  {item.label}
                  {item.badge && <span className="ml-1.5">{item.badge}</span>}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
                />
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-200 ease-out
                  ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  <div className="mt-0.5 mb-1 space-y-0.5">
                    {item.children.map(child => {
                      const active = childActive(child);
                      return (
                        <Link
                          key={child.label}
                          to={child.to}
                          className={`flex items-center gap-2.5 rounded-lg pl-10 pr-3 py-1.5 text-sm transition-colors
                            ${active ? ROW_ACTIVE : ROW_IDLE}`}
                        >
                          <span className="truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom: settings + theme + collapse */}
      <div
        className={`px-3 py-3 flex gap-1 ${collapsed ? 'flex-col' : 'flex-row'}`}
        style={{ borderTop: '1px solid var(--glass-border-subtle)' }}
      >
        <Link
          to="/settings"
          title="Settings"
          aria-label="Settings"
          className={`flex-1 flex items-center justify-center p-2 rounded-lg transition-colors
            ${location.pathname === '/settings'
              ? 'text-blue-600 dark:text-blue-300 bg-blue-500/10 dark:bg-blue-500/15'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/20 dark:hover:bg-white/5'}`}
        >
          <Settings className="h-4 w-4" />
        </Link>
        <button
          onClick={toggleTheme}
          className="flex-1 flex items-center justify-center p-2 hover:bg-white/20 dark:hover:bg-white/5 rounded-lg transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          onClick={toggleCollapsed}
          className="flex-1 flex items-center justify-center p-2 hover:bg-white/20 dark:hover:bg-white/5 rounded-lg transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
