import { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { SidebarProvider } from './SidebarContext';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';
import DashboardPage from './pages/DashboardPage';
import HostInventoryPage from './pages/HostInventoryPage';
import CapacityPlanningPage from './pages/CapacityPlanningPage';
import VMwareToolsPage from './pages/VMwareToolsPage';
import VMToolsPage from './pages/VMToolsPage';
import TPMKeysPage from './pages/TPMKeysPage';
import { fetchDashboard } from './api';

function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchDashboard();
      setDashboardData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={loadDashboard} />;

  return (
    <HashRouter>
      <SidebarProvider>
        <Layout>
          <Routes>
            <Route
              path="/"
              element={
                <DashboardPage
                  data={dashboardData}
                  onRefresh={loadDashboard}
                />
              }
            />
            <Route path="/host-inventory" element={<HostInventoryPage />} />
            <Route path="/capacity" element={<CapacityPlanningPage />} />
            <Route path="/esxi-versions" element={<VMwareToolsPage />} />
            <Route path="/vmware-tools" element={<VMToolsPage />} />
            <Route path="/tpm-keys" element={<TPMKeysPage />} />
          </Routes>
        </Layout>
      </SidebarProvider>
    </HashRouter>
  );
}

export default App;
