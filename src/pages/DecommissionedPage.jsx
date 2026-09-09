import { useState, useEffect, useMemo } from 'react';
import {
  ServerOff, AlertTriangle, PackageOpen, Archive, RefreshCw, Loader2, ArrowRight,
} from 'lucide-react';
import { fetchDecommissioned } from '../api';
import {
  PageHeader, Button, Badge, KpiCard, Card, SearchInput, Select, Toolbar,
  Table, THead, TBody, Th, Tr, Td, LoadingState, ErrorBanner, EmptyState,
} from '../components/ui';
import { DcName } from '../dcColors';

/* Each flag the backend can assign, with how it should read in the UI.
   Order here is the order the legend renders in. */
const FLAGS = {
  slot_reoccupied: {
    label: 'Stale — slot reused',
    variant: 'critical',
    icon: AlertTriangle,
    blurb: 'A different blade now sits in this slot. The old record was never removed from Vantage.',
  },
  recommissioned: {
    label: 'Stale — serial active',
    variant: 'warning',
    icon: RefreshCw,
    blurb: 'This serial is live again elsewhere, so the decommissioned identity is leftover.',
  },
  still_racked: {
    label: 'Still racked',
    variant: 'info',
    icon: PackageOpen,
    blurb: 'Hardware is physically in the slot but unmanaged — pull it, or clear the record.',
  },
  removed: {
    label: 'Removed',
    variant: 'neutral',
    icon: Archive,
    blurb: 'Hardware has been pulled. History only.',
  },
};

const flagMeta = f => FLAGS[f] || { label: f || 'Unknown', variant: 'neutral', icon: Archive, blurb: '' };

export default function DecommissionedPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('all');
  const [flag, setFlag] = useState('all');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDecommissioned());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const items = data?.items || [];
  const summary = data?.summary || {};

  const domains = useMemo(
    () => [...new Set(items.map(i => i.domain).filter(Boolean))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i => {
      if (domain !== 'all' && i.domain !== domain) return false;
      if (flag !== 'all' && i.flag !== flag) return false;
      if (!q) return true;
      return [i.serial, i.model, i.name, i.domain, i.chassis_name]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [items, search, domain, flag]);

  // Which flags are actually present — no point offering an empty filter.
  const presentFlags = useMemo(
    () => Object.keys(FLAGS).filter(f => items.some(i => i.flag === f)),
    [items],
  );

  if (loading) return <LoadingState label="Loading decommissioned servers…" />;

  return (
    <>
      <PageHeader
        title="Decommissioned"
        subtitle="Blades decommissioned out of a UCS domain, checked against live inventory for stale records"
        actions={
          <Button onClick={load} disabled={loading}>
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      <div className="mx-4 sm:mx-6 lg:mx-8 py-6 space-y-6">
        {error && <ErrorBanner message={error} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Decommissioned" value={summary.total ?? 0} />
          <KpiCard
            label="Stale records"
            value={summary.stale ?? 0}
            sub={summary.stale ? 'Need cleanup in Vantage' : 'None — records are current'}
            subTone={summary.stale ? 'negative' : 'positive'}
            valueClass={summary.stale ? 'text-red-500 dark:text-red-400' : ''}
          />
          <KpiCard
            label="Still racked"
            value={summary.still_racked ?? 0}
            sub="Physically present, unmanaged"
          />
          <KpiCard label="Domains affected" value={Object.keys(summary.by_domain || {}).length} />
        </div>

        {/* Why a stale record matters — the reason this page exists. */}
        {summary.stale > 0 && (
          <Card className="p-4 border-red-500/25 bg-red-500/[0.04]">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-sm text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-red-600 dark:text-red-400">
                  {summary.stale} stale {summary.stale === 1 ? 'record' : 'records'} found
                </p>
                <p className="mt-1 text-[13px]">
                  A decommissioned blade still occupies a slot that live hardware has since taken over.
                  Until the record is removed from Vantage it keeps surfacing in hardware lookups as
                  though it were still installed.
                </p>
              </div>
            </div>
          </Card>
        )}

        <Toolbar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search serial, model, name, domain..."
          />
          <Select value={domain} onChange={setDomain}>
            <option value="all">All domains</option>
            {domains.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Select value={flag} onChange={setFlag}>
            <option value="all">All states</option>
            {presentFlags.map(f => <option key={f} value={f}>{FLAGS[f].label}</option>)}
          </Select>
        </Toolbar>

        <Card>
          {filtered.length === 0 ? (
            <EmptyState
              icon={ServerOff}
              title={items.length ? 'No matches' : 'Nothing decommissioned'}
              hint={
                items.length
                  ? 'No decommissioned servers match these filters.'
                  : 'No blades have been decommissioned out of any UCS domain.'
              }
            />
          ) : (
            <Table>
              <THead>
                <Th>State</Th>
                <Th>Serial</Th>
                <Th>Model</Th>
                <Th>Name</Th>
                <Th>Domain</Th>
                <Th>Location</Th>
                <Th>Now in slot</Th>
              </THead>
              <TBody>
                {filtered.map(i => {
                  const meta = flagMeta(i.flag);
                  const Icon = meta.icon;
                  return (
                    <Tr key={`${i.domain}-${i.serial}`}>
                      <Td>
                        <Badge variant={meta.variant} dot>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </Badge>
                      </Td>
                      <Td className="font-mono text-[12px]">{i.serial || '—'}</Td>
                      <Td>{i.model || '—'}</Td>
                      <Td className="text-slate-500">{i.name || '—'}</Td>
                      <Td><DcName value={i.domain} /></Td>
                      <Td className="text-slate-500 whitespace-nowrap">
                        {i.chassis_id ? `chassis ${i.chassis_id} · slot ${i.slot_id}` : '—'}
                      </Td>
                      <Td>
                        {i.replacement ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px]">
                            <ArrowRight className="h-3 w-3 text-red-500" />
                            <span className="font-mono">{i.replacement.serial}</span>
                            <span className="text-slate-500">{i.replacement.model}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>

        {/* Legend — these states aren't self-evident from the label alone. */}
        <Card className="p-4">
          <p className="micro-label text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-3">
            What these states mean
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
            {Object.entries(FLAGS).map(([key, m]) => (
              <div key={key} className="flex items-start gap-2.5">
                <Badge variant={m.variant} dot className="shrink-0 mt-0.5">{m.label}</Badge>
                <p className="text-[12px] text-slate-500 leading-relaxed">{m.blurb}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
