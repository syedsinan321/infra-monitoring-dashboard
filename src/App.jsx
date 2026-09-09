import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import { fetchDashboard } from './api';
import { SidebarProvider } from './SidebarContext';
import Layout from './components/Layout';
import Header from './components/Header';
import ErrorMessage from './components/ErrorMessage';
import DashboardPage from './pages/DashboardPage';
import ArchitecturePage from './pages/ArchitecturePage';
import VMwareToolsPage from './pages/VMwareToolsPage';
import VMToolsPage from './pages/VMToolsPage';
import TPMKeysPage from './pages/TPMKeysPage';
import HostInventoryPage from './pages/HostInventoryPage';
import InventoryPage from './pages/InventoryPage';
import DecommissionedPage from './pages/DecommissionedPage';
import BladeFirmwarePage from './pages/BladeFirmwarePage';
import HostCrashReportPage from './pages/HostCrashReportPage';
import HostDiagnosticsPage from './pages/HostDiagnosticsPage';
import OpenShiftLicensingPage from './pages/OpenShiftLicensingPage';
import VMBackupStatusPage from './pages/VMBackupStatusPage';
import RebootCimcPage from './pages/RebootCimcPage';
import AuditLogPage from './pages/AuditLogPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async (refresh = false) => {
    try {
      setError(null);
      const dashboardData = await fetchDashboard(refresh);
      setData(dashboardData);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Hourly background poll that pauses while the tab is hidden — an idle tab
  // used to drive ~54k Vantage calls/day at the old 30s cadence. On focus
  // we refetch immediately (usually served by the backend cache) and restart
  // the hour. The Refresh button forces a live Vantage fetch.
  useEffect(() => {
    const POLL_MS = 3600000;
    let interval = null;
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const start = () => { if (!interval) interval = setInterval(() => loadData(), POLL_MS); };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        loadData();
        stop();
        start();
      }
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadData]);

  const handleManualRefresh = () => {
    setLoading(true);
    loadData(true);
  };

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <SidebarProvider>
        <Layout>
          <ScrollToTop />
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <Header
                    lastUpdated={lastUpdated}
                    onRefresh={handleManualRefresh}
                    loading={loading}
                  />
                  <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
                    {loading && !data && (
                      <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                        <span className="ml-3 text-slate-500 dark:text-slate-400">Loading dashboard data...</span>
                      </div>
                    )}
                    {error && <ErrorMessage message={error} onRetry={handleManualRefresh} />}
                    {data && <DashboardPage data={data} />}
                  </main>
                </>
              }
            />
            <Route
              path="/architecture/vantage"
              element={<ErrorBoundary><ArchitecturePage /></ErrorBoundary>}
            />
            <Route
              path="/vmware-tools"
              element={<ErrorBoundary><VMwareToolsPage /></ErrorBoundary>}
            />
            <Route
              path="/vm-tools"
              element={<ErrorBoundary><VMToolsPage /></ErrorBoundary>}
            />
            <Route
              path="/tpm-keys"
              element={<ErrorBoundary><TPMKeysPage /></ErrorBoundary>}
            />
            <Route
              path="/inventory"
              element={<ErrorBoundary><InventoryPage /></ErrorBoundary>}
            />
            <Route
              path="/decommissioned"
              element={<ErrorBoundary><DecommissionedPage /></ErrorBoundary>}
            />
            <Route
              path="/blade-firmware"
              element={<ErrorBoundary><BladeFirmwarePage /></ErrorBoundary>}
            />
            <Route
              path="/host-inventory"
              element={<ErrorBoundary><HostInventoryPage /></ErrorBoundary>}
            />
            <Route
              path="/host-crash-report"
              element={<ErrorBoundary><HostCrashReportPage /></ErrorBoundary>}
            />
            <Route
              path="/host-diagnostics"
              element={<ErrorBoundary><HostDiagnosticsPage /></ErrorBoundary>}
            />
            <Route
              path="/openshift-licensing"
              element={<ErrorBoundary><OpenShiftLicensingPage /></ErrorBoundary>}
            />
            <Route
              path="/backup-status"
              element={<ErrorBoundary><VMBackupStatusPage /></ErrorBoundary>}
            />
            <Route
              path="/reboot-cimc"
              element={<ErrorBoundary><RebootCimcPage /></ErrorBoundary>}
            />
            <Route
              path="/audit-log"
              element={<ErrorBoundary><AuditLogPage /></ErrorBoundary>}
            />
            <Route
              path="/settings"
              element={<ErrorBoundary><SettingsPage /></ErrorBoundary>}
            />
          </Routes>
        </Layout>
      </SidebarProvider>
    </Router>
  );
}

export default App;
