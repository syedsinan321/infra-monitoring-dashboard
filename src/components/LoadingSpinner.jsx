import { Server } from 'lucide-react';

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="relative text-center">
        {/* Logo with pulse effect */}
        <div className="relative inline-block mb-6">
          <div className="animate-pulse">
            <Server className="h-16 w-16 text-blue-400" />
          </div>
        </div>

        {/* Loading bar */}
        <div className="w-48 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-loading-bar" 
               style={{ animation: 'loading-bar 1.5s ease-in-out infinite' }} />
        </div>

        <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium">Loading infrastructure data...</p>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-600">Preparing dashboard</p>
      </div>

      <style>{`
        @keyframes loading-bar {
          0% { width: 0%; margin-left: 0; }
          50% { width: 70%; margin-left: 15%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}

export default LoadingSpinner;
