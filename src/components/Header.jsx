import { RefreshCw, Clock } from 'lucide-react';
import { PageHeader, Button } from './ui';

function Header({ lastUpdated, onRefresh, loading }) {
  return (
    <PageHeader
      title="Dashboard"
      subtitle="Real-time overview of your infrastructure environment"
      actions={(
        <>
          {lastUpdated && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Updated {lastUpdated.toLocaleTimeString()} · auto-refresh hourly
            </span>
          )}
          <Button variant="primary" size="sm" icon={RefreshCw} loading={loading} onClick={onRefresh}>
            Refresh
          </Button>
        </>
      )}
    />
  );
}

export default Header;
