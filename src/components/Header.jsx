import { RefreshCw, Server } from 'lucide-react';

function Header({ onRefresh, lastUpdated, autoRefresh }) {
  return (
    <div className="liquid-glass liquid-glass-shimmer rounded-2xl mx-4 sm:mx-6 lg:mx-8 mt-6 relative overflow-hidden">
      <div className="relative w-full px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
                <Server className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Infrastructure Dashboard</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Unified infrastructure monitoring
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {lastUpdated && (
              <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
                {autoRefresh && (
                  <span className="flex items-center space-x-1 text-green-500">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span>Auto</span>
                  </span>
                )}
              </div>
            )}
            <button
              onClick={onRefresh}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;
