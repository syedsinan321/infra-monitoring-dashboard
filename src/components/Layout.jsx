import Sidebar from './Sidebar';
import FiberBackground from './FiberBackground';
import { useSidebar } from '../SidebarContext';

function Layout({ children }) {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen liquid-bg text-slate-900 dark:text-white">
      <FiberBackground />
      <Sidebar />
      <div
        className="relative z-10 transition-all duration-300 min-h-screen"
        style={{ marginLeft: collapsed ? 68 : 270 }}
      >
        {children}
      </div>
    </div>
  );
}

export default Layout;
