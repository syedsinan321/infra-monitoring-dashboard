import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, Activity, Monitor, Wrench, KeyRound, ClipboardList, ShieldCheck } from 'lucide-react';

const NAV_SECTIONS = [
  {
    title: 'General',
    titleColor: 'text-blue-400',
    glowStyle: '0 0 12px rgba(59,130,246,0.35), 0 0 4px rgba(59,130,246,0.25), inset 0 0 8px rgba(59,130,246,0.08)',
    items: [
      {
        to: '/',
        label: 'Dashboard',
        description: 'Infrastructure overview',
        icon: Activity,
        colorBg: 'bg-blue-500/20',
        colorBgHover: 'group-hover:bg-blue-500/30',
        colorIcon: 'text-blue-500 dark:text-blue-400',
        colorArrow: 'group-hover:text-blue-500 dark:group-hover:text-blue-400',
      },
      {
        to: '/host-inventory',
        label: 'Host Registry',
        description: 'Host first-seen tracking',
        icon: ClipboardList,
        colorBg: 'bg-indigo-500/20',
        colorBgHover: 'group-hover:bg-indigo-500/30',
        colorIcon: 'text-indigo-500 dark:text-indigo-400',
        colorArrow: 'group-hover:text-indigo-500 dark:group-hover:text-indigo-400',
      },
    ],
  },
  {
    title: 'Metrics',
    titleColor: 'text-emerald-400',
    glowStyle: '0 0 12px rgba(16,185,129,0.35), 0 0 4px rgba(16,185,129,0.25), inset 0 0 8px rgba(16,185,129,0.08)',
    items: [
      {
        to: '/vmware-tools',
        label: 'ESXi Build Version',
        description: 'Cluster & host inventory',
        icon: Monitor,
        colorBg: 'bg-green-500/20',
        colorBgHover: 'group-hover:bg-green-500/30',
        colorIcon: 'text-green-500 dark:text-green-400',
        colorArrow: 'group-hover:text-green-500 dark:group-hover:text-green-400',
      },
      {
        to: '/vm-tools',
        label: 'VMware Tools',
        description: 'VM tools version inventory',
        icon: Wrench,
        colorBg: 'bg-purple-500/20',
        colorBgHover: 'group-hover:bg-purple-500/30',
        colorIcon: 'text-purple-500 dark:text-purple-400',
        colorArrow: 'group-hover:text-purple-500 dark:group-hover:text-purple-400',
      },
      {
        to: '/backup-status',
        label: 'VM Backup Status',
        description: 'Rubrik backup status for Windows & RHEL',
        icon: ShieldCheck,
        colorBg: 'bg-emerald-500/20',
        colorBgHover: 'group-hover:bg-emerald-500/30',
        colorIcon: 'text-emerald-500 dark:text-emerald-400',
        colorArrow: 'group-hover:text-emerald-500 dark:group-hover:text-emerald-400',
      },
    ],
  },
  {
    title: 'Security',
    titleColor: 'text-orange-400',
    glowStyle: '0 0 12px rgba(249,115,22,0.35), 0 0 4px rgba(249,115,22,0.25), inset 0 0 8px rgba(249,115,22,0.08)',
    items: [
      {
        to: '/tpm-keys',
        label: 'TPM Keys',
        description: 'Trusted Platform Module inventory',
        icon: KeyRound,
        colorBg: 'bg-orange-500/20',
        colorBgHover: 'group-hover:bg-orange-500/30',
        colorIcon: 'text-orange-500 dark:text-orange-400',
        colorArrow: 'group-hover:text-orange-500 dark:group-hover:text-orange-400',
      },
    ],
  },
];

function NavigationMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const location = useLocation();

  const toggleMenu = () => {
    if (!menuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: rect.left });
    }
    setMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        buttonRef.current && !buttonRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Close on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="p-2 hover:bg-white/20 dark:hover:bg-white/5 rounded-lg transition-colors"
        aria-label="Toggle navigation menu"
      >
        {menuOpen ? (
          <X className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        ) : (
          <Menu className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        )}
      </button>

      {menuOpen && (
        <div
          ref={dropdownRef}
          className="fixed w-64 liquid-glass rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/30 overflow-hidden"
          style={{ top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
        >
          <div className="p-2">
            {NAV_SECTIONS.map((section, sIdx) => {
              const visibleItems = section.items.filter((item) => item.to !== location.pathname);
              if (visibleItems.length === 0) return null;
              return (
                <div key={section.title} className={sIdx > 0 ? 'mt-2' : ''}>
                  <div
                    className="mx-1 mb-1 px-3 py-1.5 rounded-lg bg-white/15 dark:bg-white/5 border border-white/10 dark:border-white/5"
                    style={{ boxShadow: section.glowStyle }}
                  >
                    <p className={`text-xs font-bold uppercase tracking-wider ${section.titleColor}`}>
                      {section.title}
                    </p>
                  </div>
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-white/30 dark:hover:bg-white/5 transition-colors group"
                      >
                        <div className={`${item.colorBg} p-2 rounded-lg ${item.colorBgHover} transition-colors`}>
                          <Icon className={`h-4 w-4 ${item.colorIcon}`} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{item.label}</p>
                          <p className="text-xs text-slate-500">{item.description}</p>
                        </div>
                        <ArrowRight className={`h-4 w-4 text-slate-400 dark:text-slate-600 ${item.colorArrow} transition-colors`} />
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export default NavigationMenu;
