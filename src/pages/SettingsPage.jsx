import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Settings as SettingsIcon, Pencil } from 'lucide-react';
import {
  fetchIntegrationsHealth, postIntegrationToggle,
  fetchTeamsWebhookSetting, postTeamsWebhookSetting,
} from '../api';
import {
  PageHeader, Button, Badge, Card, CardHeader, KpiCard, LoadingState, ErrorBanner, Toggle,
  ConfirmDialog, Input,
} from '../components/ui';

const STATUS_META = {
  ok:             { variant: 'success',  label: 'Live' },
  error:          { variant: 'critical', label: 'Error' },
  configured:     { variant: 'success',  label: 'Configured' },
  not_configured: { variant: 'neutral',  label: 'Not Configured' },
  disabled:       { variant: 'neutral',  label: 'Disabled' },
};

const CATEGORY_ORDER = ['Infrastructure', 'Logging', 'Notifications', 'Unknown'];

export default function SettingsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [togglingKeys, setTogglingKeys] = useState(() => new Set());
  const [toggleError, setToggleError] = useState(null);
  const [pendingDisable, setPendingDisable] = useState(null); // item awaiting confirm

  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookOverridden, setWebhookOverridden] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookError, setWebhookError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchIntegrationsHealth();
      setData(result);
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

  const applyToggle = async (item, next) => {
    setToggleError(null);
    setTogglingKeys(prev => new Set(prev).add(item.key));
    try {
      await postIntegrationToggle(item.key, next);
      await load();
    } catch (err) {
      setToggleError(err.message);
    } finally {
      setTogglingKeys(prev => {
        const copy = new Set(prev);
        copy.delete(item.key);
        return copy;
      });
    }
  };

  const handleToggle = (item, next) => {
    if (!next) {
      setPendingDisable(item);
      return;
    }
    applyToggle(item, next);
  };

  const confirmDisable = () => {
    const item = pendingDisable;
    setPendingDisable(null);
    if (item) applyToggle(item, false);
  };

  const openWebhookModal = async () => {
    setWebhookError(null);
    setWebhookModalOpen(true);
    setWebhookLoading(true);
    try {
      const result = await fetchTeamsWebhookSetting();
      setWebhookUrl(result.url || '');
      setWebhookOverridden(result.overridden);
    } catch (err) {
      setWebhookError(err.message);
    } finally {
      setWebhookLoading(false);
    }
  };

  const saveWebhook = async (nextUrl) => {
    setWebhookError(null);
    setWebhookSaving(true);
    try {
      await postTeamsWebhookSetting(nextUrl);
      setWebhookModalOpen(false);
      await load();
    } catch (err) {
      setWebhookError(err.message);
    } finally {
      setWebhookSaving(false);
    }
  };

  const integrations = data?.integrations || [];

  const counts = useMemo(() => {
    const c = { ok: 0, error: 0, configured: 0, not_configured: 0, disabled: 0 };
    integrations.forEach(i => { c[i.status] = (c[i.status] || 0) + 1; });
    return c;
  }, [integrations]);

  const grouped = useMemo(() => {
    const groups = {};
    integrations.forEach(i => {
      const cat = i.category || 'Unknown';
      (groups[cat] = groups[cat] || []).push(i);
    });
    return CATEGORY_ORDER
      .filter(cat => groups[cat])
      .map(cat => ({ category: cat, items: groups[cat] }));
  }, [integrations]);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Live status of every platform this app integrates with"
        actions={(
          <Button
            variant="primary" size="sm" icon={RefreshCw}
            loading={refreshing} disabled={loading}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        )}
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {loading && <LoadingState label="Checking integrations…" />}
        {error && !loading && <ErrorBanner message={error} />}
        {toggleError && <ErrorBanner message={toggleError} />}

        {!loading && data && (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
              <KpiCard
                label="Live" value={counts.ok}
                sub="responding normally" subTone="positive"
              />
              <KpiCard
                label="Errors" value={counts.error}
                valueClass={counts.error > 0 ? 'text-red-500 dark:text-red-400' : ''}
                sub={counts.error > 0 ? 'need attention' : 'none'}
                subTone={counts.error > 0 ? 'negative' : 'positive'}
              />
              <KpiCard
                label="Configured" value={counts.configured}
                sub="not actively probed" subTone="positive"
              />
              <KpiCard
                label="Not Configured" value={counts.not_configured}
                sub="no credentials set"
              />
              <KpiCard
                label="Disabled" value={counts.disabled}
                sub="turned off in Settings"
              />
            </div>

            {grouped.map(({ category, items }) => (
              <Card key={category} className="p-5">
                <CardHeader title={category} />
                <div className="mt-3 divide-y divide-slate-200/60 dark:divide-white/[0.05]">
                  {items.map(item => {
                    const meta = STATUS_META[item.status] || STATUS_META.not_configured;
                    const isToggling = togglingKeys.has(item.key);
                    return (
                      <div key={item.key} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{item.detail}</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {item.key === 'teams' && (
                            <Button variant="secondary" size="sm" icon={Pencil} onClick={openWebhookModal}>
                              Edit
                            </Button>
                          )}
                          {item.latency_ms != null && (
                            <span className="text-xs text-slate-400 tabular-nums hidden sm:inline">
                              {item.latency_ms}ms
                            </span>
                          )}
                          <Badge dot variant={meta.variant}>{meta.label}</Badge>
                          <Toggle
                            checked={item.enabled}
                            disabled={isToggling}
                            onChange={next => handleToggle(item, next)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}

            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <SettingsIcon className="h-3 w-3" />
              Checked {new Date(data.checked_at).toLocaleString()}. Teams and inbound webhooks are
              shown as "Configured" rather than actively probed, since a live check would have a
              visible side effect (posting a message / can't be dialed out to).
            </p>
          </>
        )}
      </main>

      <ConfirmDialog
        open={!!pendingDisable}
        title={`Turn off ${pendingDisable?.name}?`}
        message="This stops it from being queried anywhere in the app."
        confirmLabel="Turn Off"
        onConfirm={confirmDisable}
        onCancel={() => setPendingDisable(null)}
      />

      {webhookModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={e => { if (e.target === e.currentTarget && !webhookSaving) setWebhookModalOpen(false); }}
        >
          <Card className="max-w-md w-full bg-white/95 dark:bg-slate-900/95 p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Microsoft Teams webhook URL
            </h2>
            <p className="text-xs text-slate-500 mt-1.5">
              Used to post VM crash alert cards to Teams. Changing this takes effect immediately —
              no redeploy needed.
            </p>

            {webhookLoading ? (
              <div className="mt-4"><LoadingState label="Loading…" /></div>
            ) : (
              <>
                <Input
                  className="mt-4"
                  placeholder="https://…"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  disabled={webhookSaving}
                />
                {webhookOverridden && (
                  <p className="text-xs text-slate-400 mt-1.5">Overridden from the .env default.</p>
                )}
                {webhookError && <div className="mt-3"><ErrorBanner message={webhookError} /></div>}

                <div className="mt-5 flex justify-between gap-2">
                  {webhookOverridden ? (
                    <Button
                      variant="secondary" size="sm" disabled={webhookSaving}
                      onClick={() => saveWebhook('')}
                    >
                      Reset to default
                    </Button>
                  ) : <span />}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary" size="sm" disabled={webhookSaving}
                      onClick={() => setWebhookModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary" size="sm" loading={webhookSaving}
                      onClick={() => saveWebhook(webhookUrl)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>,
        document.body,
      )}
    </>
  );
}
