import { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, ScrollText } from 'lucide-react';
import { fetchAuditLog } from '../api';
import {
  PageHeader, Button, Badge, Card, SearchInput, Select, Toolbar,
  Pagination, Table, THead, TBody, Th, Tr, Td, LoadingState, ErrorBanner, EmptyState,
} from '../components/ui';

const ACTIONS = [
  { value: 'cimc_reboot', label: 'CIMC Reboot' },
  { value: 'tpm_keys_auth', label: 'TPM Keys Auth' },
  { value: 'tpm_keys_collect', label: 'TPM Keys Collect' },
  { value: 'tpm_keys_import', label: 'TPM Keys Import' },
  { value: 'tpm_keys_upload', label: 'TPM Keys Upload' },
  { value: 'host_inventory_sync', label: 'Host Inventory Sync' },
  { value: 'diagnostics_collect', label: 'Diagnostics Collect' },
  { value: 'diagnostics_techsupport', label: 'Tech Support Bundle' },
  { value: 'diagnostics_analyze', label: 'Diagnostics Analyze' },
  { value: 'diagnostics_history_delete', label: 'Diagnostics History Delete' },
  { value: 'webhook_history_delete', label: 'Webhook History Delete' },
  { value: 'spare_inventory_add', label: 'Spare Inventory Add' },
  { value: 'spare_inventory_edit', label: 'Spare Inventory Edit' },
  { value: 'spare_inventory_delete', label: 'Spare Inventory Delete' },
  { value: 'integration_toggle', label: 'Integration Toggle' },
];

const ACTION_LABEL = Object.fromEntries(ACTIONS.map(a => [a.value, a.label]));

function actionVariant(action) {
  if (action === 'cimc_reboot') return 'critical';
  if (action.endsWith('_delete')) return 'warning';
  return 'info';
}

export default function AuditLogPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchAuditLog({ limit: 500 });
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const events = data?.events || [];

  const filtered = useMemo(() => {
    let rows = events;
    if (filterAction !== 'all') rows = rows.filter(e => e.action === filterAction);
    if (filterStatus !== 'all') rows = rows.filter(e => e.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(e =>
        (e.actor || '').toLowerCase().includes(q) ||
        (e.target || '').toLowerCase().includes(q) ||
        (e.detail || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [events, filterAction, filterStatus, search]);

  useEffect(() => { setPage(1); }, [filterAction, filterStatus, search, perPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Who did what — reboots, TPM key operations, and deletions across the app"
        actions={(
          <>
            {lastUpdated && (
              <span className="hidden sm:inline text-xs text-slate-500">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="primary" size="sm" icon={RefreshCw}
              loading={refreshing} disabled={loading}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
          </>
        )}
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {loading && <LoadingState label="Loading audit log…" />}
        {error && !loading && <ErrorBanner message={error} />}

        {!loading && data && (
          <>
            <Toolbar>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search actor, target, detail…"
              />
              <Select value={filterAction} onChange={setFilterAction}>
                <option value="all">All Actions</option>
                {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </Select>
              <Select value={filterStatus} onChange={setFilterStatus}>
                <option value="all">All Statuses</option>
                <option value="ok">OK</option>
                <option value="error">Error</option>
              </Select>
            </Toolbar>

            <Card className="overflow-hidden">
              {filtered.length === 0 ? (
                <EmptyState
                  icon={ScrollText}
                  title="No audit events match the current filters"
                  hint="Try clearing the search or switching filters."
                />
              ) : (
                <>
                  <Table>
                    <THead>
                      <Th>Time</Th>
                      <Th>Actor</Th>
                      <Th>Action</Th>
                      <Th>Target</Th>
                      <Th>Status</Th>
                      <Th>Detail</Th>
                    </THead>
                    <TBody>
                      {paginated.map(e => (
                        <Tr key={e.id}>
                          <Td className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {new Date(e.ts).toLocaleString()}
                          </Td>
                          <Td className="font-medium text-slate-800 dark:text-slate-100">
                            {e.actor}
                            {e.actor_ip && (
                              <span className="block text-[11px] font-normal text-slate-500">{e.actor_ip}</span>
                            )}
                          </Td>
                          <Td>
                            <Badge variant={actionVariant(e.action)}>
                              {ACTION_LABEL[e.action] || e.action}
                            </Badge>
                          </Td>
                          <Td className="max-w-[16rem] truncate" title={e.target || ''}>
                            {e.target || <span className="italic text-slate-400">—</span>}
                          </Td>
                          <Td>
                            <Badge dot variant={e.status === 'ok' ? 'success' : 'critical'}>
                              {e.status === 'ok' ? 'OK' : 'Error'}
                            </Badge>
                          </Td>
                          <Td className="max-w-sm truncate text-xs text-slate-500 dark:text-slate-400" title={e.detail || ''}>
                            {e.detail || <span className="italic">—</span>}
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                  <Pagination
                    page={safePage} perPage={perPage} total={filtered.length}
                    onPage={setPage} onPerPage={setPerPage} label="events"
                    perPageOptions={[25, 50, 100]}
                  />
                </>
              )}
            </Card>
          </>
        )}
      </main>
    </>
  );
}
