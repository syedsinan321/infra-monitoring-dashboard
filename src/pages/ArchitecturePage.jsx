import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { PageHeader, Button } from '../components/ui';
import ErrorMessage from '../components/ErrorMessage';
import { fetchFabricTopology, fetchDiagnosticsEquipment } from '../api';
import mountArchitecture from '../architecture/renderer';
import '../architecture/architecture.css';

function ArchitecturePage() {
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const rootRef = useRef(null);
  const cleanupRef = useRef(null);

  const load = useCallback(async (refresh = false) => {
    try {
      setLoading(true);
      setError(null);
      // Live FI/chassis alarm health rides alongside the (cached) topology —
      // fail-soft so the diagram still renders if the alarm fetch dies.
      const healthPromise = fetchDiagnosticsEquipment().catch(() => null);
      const topology = await fetchFabricTopology(refresh);
      setData(topology);
      setHealth(await healthPromise);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The diagram is a self-contained vanilla-DOM renderer (shared lineage with
  // the standalone HTML export) — mount it into the ref'd div per data load.
  useEffect(() => {
    if (!data || !rootRef.current) return;
    cleanupRef.current?.();
    cleanupRef.current = mountArchitecture(rootRef.current, data, health);
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [data, health]);

  return (
    <>
      <PageHeader
        title="Cisco Intersight Architecture"
        subtitle="How Intersight manages this environment — from the cloud down to every chassis port. Click any card for details."
        actions={(
          <>
            {data?.generated_at && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                Data as of {new Date(data.generated_at).toLocaleString()}
              </span>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={RefreshCw}
              loading={loading}
              onClick={() => load(true)}
              title="Pull live topology from Intersight now (~10s)"
            >
              Refresh
            </Button>
          </>
        )}
      />
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            <span className="ml-3 text-slate-500 dark:text-slate-400">
              Loading topology from Intersight…
            </span>
          </div>
        )}
        {error && <ErrorMessage message={error} onRetry={() => load()} />}
        <div ref={rootRef} className="arch-root" style={{ display: data ? undefined : 'none' }} />
      </main>
    </>
  );
}

export default ArchitecturePage;
