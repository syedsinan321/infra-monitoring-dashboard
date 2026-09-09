import { AlertCircle, RefreshCw } from 'lucide-react';

function ErrorMessage({ message, onRetry }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full relative liquid-glass rounded-xl p-6 text-center" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
        <div className="flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <div>
            <p className="text-red-600 dark:text-red-400 font-semibold text-lg mb-2">Something went wrong</p>
            <p className="text-red-500/70 dark:text-red-300/70 text-sm mb-4">{message}</p>
          </div>
        </div>
        <button
          onClick={onRetry}
          className="flex items-center space-x-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Retry</span>
        </button>
      </div>
    </div>
  );
}

export default ErrorMessage;
