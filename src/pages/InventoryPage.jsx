import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Package, Plus, Trash2, Loader2, X, Pencil, Check, Upload, Info, AlertTriangle, Download,
} from 'lucide-react';
import {
  fetchSpareInventory, addSpareInventoryItem, updateSpareInventoryItem, deleteSpareInventoryItem,
} from '../api';
import {
  PageHeader, Button, Badge, KpiCard, Card, SearchInput, Select, Toolbar,
  Table, THead, TBody, Th, Tr, Td, LoadingState, ErrorBanner, EmptyState, Modal,
} from '../components/ui';
import { DcName, DC_TEXT } from '../dcColors';
import { TYPES, DC_OPTIONS, typeMeta, qtyOf } from '../inventoryCatalog';
import { COLUMN_SPEC, parseInventoryWorkbook, downloadInventoryTemplate } from '../inventoryImport';

const emptyRow = () => ({ type: 'blade', dc: 'SITE1', model: '', serial: '', quantity: 1, notes: '' });

/** Column reference for Excel import — rendered straight from COLUMN_SPEC, so
    what's documented here is exactly what the parser accepts. */
function ImportHelpModal({ open, onClose, onDownload, downloading }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Info}
      title="Excel import — accepted columns"
      sub="First worksheet, one item per row. Header order doesn't matter."
      maxWidth="max-w-3xl"
      actions={(
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
          <Button size="sm" variant="primary" icon={downloading ? Loader2 : Download} disabled={downloading} onClick={onDownload}>
            {downloading ? 'Building…' : 'Download template'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-4">
          <p className="text-[13px] font-medium text-blue-600 dark:text-blue-400">
            Easiest path: download the template
          </p>
          <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
            It arrives with the headers already in place and dropdowns on Type and Datacenter, so
            those can't be mistyped. Fill in the rows, save, and upload it back. The columns below
            are only worth reading if you'd rather build your own sheet.
          </p>
        </div>

        <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
          Add a header row, then one row per item. Only <strong>Model</strong> is required —
          everything else falls back to a sensible default. Header names are matched loosely, so
          <span className="font-mono text-xs"> Serial #</span>,
          <span className="font-mono text-xs"> serial_number</span> and
          <span className="font-mono text-xs"> SN</span> all work.
        </p>

        <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] overflow-hidden">
          <Table>
            <THead>
              <Th>Column</Th>
              <Th>Also accepts</Th>
              <Th>Example</Th>
              <Th>Notes</Th>
            </THead>
            <TBody>
              {COLUMN_SPEC.map(c => (
                <Tr key={c.key}>
                  <Td className="whitespace-nowrap">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{c.label}</span>
                    {c.required
                      ? <Badge variant="critical" className="ml-2">required</Badge>
                      : <Badge variant="neutral" className="ml-2">optional</Badge>}
                  </Td>
                  <Td className="text-slate-500 font-mono text-[11px]">
                    {c.aliases.filter(a => a !== c.label.toLowerCase()).slice(0, 4).join(', ')}
                  </Td>
                  <Td className="font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{c.example}</Td>
                  <Td className="text-slate-500 text-[12px]">{c.help}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>

        <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] p-4">
          <p className="micro-label text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2">
            Example sheet
          </p>
          <div className="overflow-x-auto">
            <table className="text-xs font-mono border-collapse">
              <thead>
                <tr className="text-slate-500">
                  {COLUMN_SPEC.map(c => (
                    <th key={c.key} className="border border-slate-300/50 dark:border-white/[0.1] px-2 py-1 text-left font-semibold">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-slate-600 dark:text-slate-300">
                <tr>
                  {COLUMN_SPEC.map(c => (
                    <td key={c.key} className="border border-slate-300/50 dark:border-white/[0.1] px-2 py-1 whitespace-nowrap">{c.example}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[12px] text-slate-500">
          Uploading doesn't save anything on its own — the rows land in the Add hardware form
          first so you can correct them, then you press Save. The template's second sheet is
          reference only; just the "Inventory" sheet is read.
        </p>
      </div>
    </Modal>
  );
}

const inputCls = `w-full px-2.5 py-1.5 rounded-lg text-sm bg-white/70 dark:bg-white/[0.06]
  border border-slate-300/70 dark:border-white/[0.1] text-slate-900 dark:text-white
  placeholder-slate-400 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/15 transition-colors`;

function AddHardwareForm({ onAdd, onCancel, initialRows, importNote }) {
  const [rows, setRows] = useState(() => (initialRows?.length ? initialRows : [emptyRow()]));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const firstRef = useRef(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  const setField = (idx, field, value) =>
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  const validRows = rows.filter(r => r.model.trim());

  const submit = async e => {
    e.preventDefault();
    if (!validRows.length) { setErr('Each item needs at least a Model.'); return; }
    setSaving(true);
    setErr('');
    try {
      await onAdd(validRows.map(r => ({ ...r, quantity: qtyOf(r) })));
    } catch (error) {
      setErr(error.message);
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Add hardware</p>
          <button type="button" onClick={onCancel} className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Imported rows are staged here, never written straight through — the
            user gets a chance to fix a bad column mapping before saving. */}
        {importNote && (
          <div className="rounded-lg border border-blue-500/25 bg-blue-500/[0.06] px-3 py-2.5">
            <p className="text-[13px] font-medium text-blue-600 dark:text-blue-400">{importNote.summary}</p>
            {importNote.warnings?.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 max-h-24 overflow-y-auto">
                {importNote.warnings.map((w, i) => (
                  <li key={i} className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />{w}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid grid-cols-[160px_90px_1fr_1fr_70px_1fr_28px] gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-0.5">
          <span>Type</span>
          <span>DC</span>
          <span>Model <span className="text-red-400 normal-case">*</span></span>
          <span className="normal-case font-medium">Serial (optional)</span>
          <span>Qty</span>
          <span>Notes</span>
          <span />
        </div>

        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-[160px_90px_1fr_1fr_70px_1fr_28px] gap-2 items-center">
              <select value={row.type} onChange={e => setField(idx, 'type', e.target.value)} className={inputCls}>
                {TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={row.dc} onChange={e => setField(idx, 'dc', e.target.value)} className={inputCls}>
                {DC_OPTIONS.map(dc => <option key={dc} value={dc}>{dc}</option>)}
              </select>
              <input
                ref={idx === 0 ? firstRef : null}
                type="text" placeholder="UCSX-210C-M7 / UCSX-MR-X64G2RW…"
                value={row.model} onChange={e => setField(idx, 'model', e.target.value)}
                className={inputCls}
              />
              <input
                type="text" placeholder="FCH2109V1PH"
                value={row.serial} onChange={e => setField(idx, 'serial', e.target.value)}
                className={`${inputCls} font-mono`}
              />
              <input
                type="number" min="1"
                value={row.quantity} onChange={e => setField(idx, 'quantity', e.target.value)}
                className={`${inputCls} text-center`}
              />
              <input
                type="text" placeholder="Rack B12, shelf 3…"
                value={row.notes} onChange={e => setField(idx, 'notes', e.target.value)}
                className={inputCls}
              />
              <button
                type="button" onClick={() => setRows(prev => prev.filter((_, i) => i !== idx))}
                disabled={rows.length === 1}
                className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button" onClick={() => setRows(prev => [...prev, emptyRow()])}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add another row
        </button>

        {err && <p className="text-xs text-red-500 dark:text-red-400">{err}</p>}

        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" variant="primary" size="sm" icon={saving ? Loader2 : Plus} disabled={saving}>
            {saving ? 'Saving…' : `Save ${validRows.length || ''} item${validRows.length !== 1 ? 's' : ''}`}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  // Inline row edit: which row is open, its working copy, and save state.
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [editError, setEditError] = useState('');
  // Excel import: staged rows + the summary shown above the form.
  const [helpOpen, setHelpOpen] = useState(false);
  const [importRows, setImportRows] = useState(null);
  const [importNote, setImportNote] = useState(null);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef(null);

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadInventoryTemplate();
    } catch (e) {
      setError(`Couldn't build the template: ${e.message}`);
    } finally {
      setDownloading(false);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDC, setFilterDC] = useState('all');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const result = await fetchSpareInventory();
        setItems(result.items || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAdd = async rows => {
    const created = await Promise.all(rows.map(r => addSpareInventoryItem(r)));
    setItems(prev => [...prev, ...created]);
    closeForm();
  };

  const closeForm = () => {
    setShowForm(false);
    setImportRows(null);
    setImportNote(null);
  };

  const handleFile = async e => {
    const file = e.target.files?.[0];
    // Reset immediately so picking the same file twice still fires onChange.
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    setError(null);
    try {
      const { rows, errors, skipped, sheetName, matched } = await parseInventoryWorkbook(file);
      if (rows.length === 0) {
        setError(`No usable rows in "${file.name}". ${errors[0] || 'Every row was blank or missing a Model.'}`);
        return;
      }
      const warnings = [...errors];
      if (skipped) warnings.push(`${skipped} blank row${skipped === 1 ? '' : 's'} ignored.`);
      setImportRows(rows);
      setImportNote({
        summary: `${rows.length} row${rows.length === 1 ? '' : 's'} loaded from "${file.name}"`
          + ` (sheet "${sheetName}", matched: ${matched.join(', ')}). Review and save.`,
        warnings,
      });
      setShowForm(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const startEdit = item => {
    setEditError('');
    setEditingId(item.id);
    setEditDraft({
      type: item.type || 'other',
      dc: item.dc || '',
      model: item.model || '',
      serial: item.serial || '',
      quantity: qtyOf(item),
      notes: item.notes || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
    setEditError('');
  };

  const setDraftField = (field, value) => setEditDraft(prev => ({ ...prev, [field]: value }));

  const saveEdit = async id => {
    if (!editDraft.model.trim()) { setEditError('Model is required.'); return; }
    setSavingId(id);
    setEditError('');
    try {
      const updated = await updateSpareInventoryItem(id, {
        ...editDraft, quantity: qtyOf(editDraft),
      });
      // Type can change, which moves the row to a different section — replacing
      // in place is enough, the section grouping re-derives from items.
      setItems(prev => prev.map(i => (i.id === id ? updated : i)));
      cancelEdit();
    } catch (e) {
      setEditError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async id => {
    setDeletingId(id);
    try {
      await deleteSpareInventoryItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter(i => {
      if (filterDC !== 'all' && i.dc !== filterDC) return false;
      if (filterType !== 'all' && (i.type || 'other') !== filterType) return false;
      if (!q) return true;
      return (
        i.model?.toLowerCase().includes(q)
        || i.serial?.toLowerCase().includes(q)
        || i.notes?.toLowerCase().includes(q)
        || typeMeta(i.type).label.toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery, filterDC, filterType]);

  /* Group by hardware type, in catalog order — one titled section each. */
  const sections = useMemo(() => {
    const order = TYPES.map(t => t.value);
    const map = new Map();
    for (const it of filtered) {
      const key = it.type || 'other';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return [...map.entries()].sort(
      (a, b) => ((order.indexOf(a[0]) + 100) % 100) - ((order.indexOf(b[0]) + 100) % 100),
    );
  }, [filtered]);

  const units = arr => arr.reduce((a, i) => a + qtyOf(i), 0);
  const totalUnits = units(items);
  const dcUnits = dc => units(items.filter(i => i.dc === dc));
  const typeCount = new Set(items.map(i => i.type || 'other')).size;

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Spare hardware on hand — tracked outside Vantage, searchable in Bulk lookup"
        actions={(
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFile}
              className="hidden"
            />
            <button
              onClick={() => setHelpOpen(true)}
              title="What columns does the spreadsheet need?"
              aria-label="Excel import column reference"
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
            >
              <Info className="h-4 w-4" />
            </button>
            <Button
              size="sm"
              icon={downloading ? Loader2 : Download}
              disabled={downloading}
              onClick={handleDownloadTemplate}
            >
              {downloading ? 'Building…' : 'Template'}
            </Button>
            <Button
              size="sm"
              icon={importing ? Loader2 : Upload}
              disabled={importing}
              onClick={() => fileRef.current?.click()}
            >
              {importing ? 'Reading…' : 'Import Excel'}
            </Button>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowForm(true)}>
              Add hardware
            </Button>
          </div>
        )}
      />

      <ImportHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onDownload={handleDownloadTemplate}
        downloading={downloading}
      />

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {loading && <LoadingState label="Loading inventory…" />}
        {error && <ErrorBanner message={error} />}

        {!loading && (
          <>
            {showForm && (
              <AddHardwareForm
                // Remount when an import lands so the form picks up the new rows.
                key={importRows ? `import-${importRows.length}-${importNote?.summary}` : 'manual'}
                onAdd={handleAdd}
                onCancel={closeForm}
                initialRows={importRows}
                importNote={importNote}
              />
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard label="Total Units" value={totalUnits} sub={`${items.length} line item${items.length !== 1 ? 's' : ''}`} />
              <KpiCard label="SITE1 Units" value={dcUnits('SITE1')} valueClass={DC_TEXT.SITE1} sub="on hand in SITE1" />
              <KpiCard label="SITE2 Units" value={dcUnits('SITE2')} valueClass={DC_TEXT.SITE2} sub="on hand in SITE2" />
              <KpiCard label="Hardware Types" value={typeCount} sub="categories stocked" />
            </div>

            {/* Search + filters */}
            <Toolbar>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search models, serials, notes…"
              />
              <Select value={filterDC} onChange={setFilterDC}>
                <option value="all">All Datacenters</option>
                {DC_OPTIONS.map(dc => <option key={dc} value={dc}>{dc}</option>)}
              </Select>
              <Select value={filterType} onChange={setFilterType}>
                <option value="all">All Types</option>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Toolbar>

            {/* Sections — one title bar per hardware type */}
            {sections.length === 0 ? (
              <Card className="overflow-hidden">
                <EmptyState
                  icon={Package}
                  title={items.length === 0 ? 'No spare hardware recorded' : 'Nothing matches your filters'}
                  hint={items.length === 0
                    ? 'Track blades, DIMMs, FIs, drives — anything on hand that isn’t in Vantage yet.'
                    : 'Try clearing the search or switching filters.'}
                />
              </Card>
            ) : (
              sections.map(([type, typeItems]) => {
                const meta = typeMeta(type);
                const Icon = meta.icon;
                return (
                  <Card key={type} className="overflow-hidden">
                    {/* Title bar */}
                    <div className="px-5 py-3 flex items-center gap-3 border-b border-slate-200/70 dark:border-white/[0.07] bg-slate-50/60 dark:bg-white/[0.03]">
                      <div className="p-1.5 rounded-lg bg-blue-500/10">
                        <Icon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{meta.section}</p>
                      <Badge variant="neutral">{typeItems.length} line item{typeItems.length !== 1 ? 's' : ''}</Badge>
                      <Badge variant="info">{units(typeItems)} unit{units(typeItems) !== 1 ? 's' : ''}</Badge>
                    </div>
                    <Table>
                      <THead>
                        <Th>Model</Th>
                        <Th>Datacenter</Th>
                        <Th>Serial</Th>
                        <Th align="center">Qty</Th>
                        <Th>Notes</Th>
                        <Th align="center">Added</Th>
                        <Th align="right"> </Th>
                      </THead>
                      <TBody>
                        {typeItems.map(item => (
                          editingId === item.id ? (
                            <Tr key={item.id} className="bg-blue-500/[0.04]">
                              <Td>
                                {/* Type rides along with Model: it has no column of
                                    its own (rows are grouped by it), and parking it
                                    under "Added" would sit a picker under a date header. */}
                                <div className="space-y-1.5">
                                  <select
                                    value={editDraft.type}
                                    onChange={e => setDraftField('type', e.target.value)}
                                    className={`${inputCls} text-[11px] py-1`}
                                  >
                                    {TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                  <input
                                    autoFocus
                                    value={editDraft.model}
                                    onChange={e => setDraftField('model', e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') cancelEdit(); }}
                                    className={inputCls}
                                  />
                                </div>
                                {editError && <p className="mt-1 text-[11px] text-red-500 dark:text-red-400">{editError}</p>}
                              </Td>
                              <Td>
                                <select value={editDraft.dc} onChange={e => setDraftField('dc', e.target.value)} className={inputCls}>
                                  {DC_OPTIONS.map(dc => <option key={dc} value={dc}>{dc}</option>)}
                                </select>
                              </Td>
                              <Td>
                                <input
                                  value={editDraft.serial}
                                  onChange={e => setDraftField('serial', e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') cancelEdit(); }}
                                  className={`${inputCls} font-mono`}
                                />
                              </Td>
                              <Td align="center">
                                <input
                                  type="number" min="1"
                                  value={editDraft.quantity}
                                  onChange={e => setDraftField('quantity', e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') cancelEdit(); }}
                                  className={`${inputCls} text-center w-20`}
                                />
                              </Td>
                              <Td>
                                <input
                                  value={editDraft.notes}
                                  onChange={e => setDraftField('notes', e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') cancelEdit(); }}
                                  className={inputCls}
                                />
                              </Td>
                              {/* Added is set once at stock-in and never edited. */}
                              <Td align="center" className="text-xs text-slate-500">{item.added}</Td>
                              <Td align="right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => saveEdit(item.id)}
                                    disabled={savingId === item.id}
                                    title="Save changes"
                                    className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
                                  >
                                    {savingId === item.id
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <Check className="h-3.5 w-3.5" />}
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    disabled={savingId === item.id}
                                    title="Cancel"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-500/10 transition-colors"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </Td>
                            </Tr>
                          ) : (
                            <Tr key={item.id} className="group">
                              <Td className="font-medium text-slate-800 dark:text-slate-100">{item.model}</Td>
                              <Td><DcName value={item.dc} /></Td>
                              <Td className="font-mono text-xs text-slate-600 dark:text-slate-300">
                                {item.serial || <span className="opacity-40 font-sans">—</span>}
                              </Td>
                              <Td align="center" className="font-semibold tabular-nums text-slate-900 dark:text-white">{qtyOf(item)}</Td>
                              <Td className="text-slate-500 max-w-[260px] truncate" title={item.notes || undefined}>
                                {item.notes || <span className="opacity-40">—</span>}
                              </Td>
                              <Td align="center" className="text-xs text-slate-500">{item.added}</Td>
                              <Td align="right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => startEdit(item)}
                                    title="Edit this item"
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item.id)}
                                    disabled={deletingId === item.id}
                                    title="Remove from inventory"
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-all"
                                  >
                                    {deletingId === item.id
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <Trash2 className="h-3.5 w-3.5" />}
                                  </button>
                                </div>
                              </Td>
                            </Tr>
                          )
                        ))}
                      </TBody>
                    </Table>
                  </Card>
                );
              })
            )}
          </>
        )}
      </main>
    </>
  );
}

export default InventoryPage;
