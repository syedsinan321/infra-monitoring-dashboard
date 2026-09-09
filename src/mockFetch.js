// Drop-in replacement for window.fetch that serves every `/api/...` route
// this app used to call against the (now-deleted) FastAPI backend, entirely
// from the in-memory mock data in mockData.js. Every caller in the app was
// already written against the Fetch Response interface (`res.ok`, `res.json()`,
// `res.status`), so swapping `fetch(` for `mockFetch(` at each call site is
// enough — no other code needed to change.
import * as M from './mockData.js';

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    blob: async () => new Blob([JSON.stringify(data)], { type: 'application/json' }),
  };
}

function parseBody(options) {
  if (!options || options.body == null) return {};
  if (typeof options.body !== 'string') return {}; // FormData etc. — not needed by any mock route
  try { return JSON.parse(options.body); } catch { return {}; }
}

function findDeviceHost(hostShort) {
  const blade = M.bladesList.find((b) => b.assigned_server_profile === hostShort);
  return blade;
}

// Route table: [method, RegExp with named groups, handler(ctx) => [status, data]]
const ROUTES = [
  ['GET', /^\/api\/dashboard$/, () => [200, M.buildDashboardData()]],
  ['GET', /^\/api\/diagnostics\/equipment$/, () => [200, M.diagnosticsEquipmentPayload()]],
  ['GET', /^\/api\/fabric-topology$/, () => [200, M.fabricTopologyPayload()]],
  ['GET', /^\/api\/vmware\/esxi-host-list$/, () => [200, M.esxiHostListPayload()]],
  ['GET', /^\/api\/blade-firmware\/export$/, () => [200, M.bladeFirmwareExportPayload()]],
  ['GET', /^\/api\/vmware\/esxi-hosts$/, () => [200, M.esxiClustersPayload()]],
  ['GET', /^\/api\/vmware\/vms$/, () => [200, M.esxiVmsPayload()]],
  ['GET', /^\/api\/fi-port-stats$/, () => [200, M.fiPortStatsPayload()]],
  ['POST', /^\/api\/tpm-keys\/auth$/, (ctx) => [200, { valid: parseBody(ctx.options).password === 'demo' }]],
  ['GET', /^\/api\/tpm-keys$/, () => [200, M.tpmKeysPayload()]],
  ['POST', /^\/api\/tpm-keys\/collect$/, () => [200, M.startTpmCollectJob()]],
  ['GET', /^\/api\/tpm-keys\/collect\/status$/, () => [200, M.tpmCollectStatusPayload()]],
  ['POST', /^\/api\/tpm-keys\/upload$/, () => [200, M.uploadTpmKeysPayload()]],
  ['GET', /^\/api\/openshift\/vcpu-summary$/, () => [200, M.ocpVcpuSummaryPayload()]],
  ['GET', /^\/api\/openshift\/vcpu-history$/, (ctx) => [200, M.ocpVcpuHistoryPayload(Number(ctx.query.get('days')) || 30)]],
  ['GET', /^\/api\/host-inventory$/, () => [200, M.hostInventoryPayload()]],
  ['POST', /^\/api\/host-inventory\/sync$/, () => [200, M.hostInventoryPayload()]],
  ['GET', /^\/api\/integrations\/health$/, () => [200, M.integrationsHealthPayload()]],
  ['POST', /^\/api\/integrations\/toggle$/, (ctx) => {
    const body = parseBody(ctx.options);
    if (!(body.key in M.integrationToggles)) return [400, { detail: `Unknown integration key: ${body.key}` }];
    return [200, M.setIntegrationToggle(body.key, !!body.enabled)];
  }],
  ['GET', /^\/api\/settings\/teams-webhook$/, () => [200, { url: M.settingsStore.teamsWebhookUrl, overridden: M.settingsStore.teamsWebhookOverridden }]],
  ['POST', /^\/api\/settings\/teams-webhook$/, (ctx) => {
    const body = parseBody(ctx.options);
    const url = body.url || '';
    if (url && !/^https?:\/\//.test(url)) return [400, { detail: 'Webhook URL must start with http:// or https://' }];
    M.settingsStore.teamsWebhookUrl = url;
    M.settingsStore.teamsWebhookOverridden = !!url;
    return [200, { url: M.settingsStore.teamsWebhookUrl, overridden: M.settingsStore.teamsWebhookOverridden }];
  }],
  ['GET', /^\/api\/audit$/, (ctx) => {
    const { query } = ctx;
    let events = M.auditLogStore;
    const action = query.get('action'); if (action) events = events.filter((e) => e.action === action);
    const actor = query.get('actor'); if (actor) events = events.filter((e) => e.actor === actor);
    const status = query.get('status'); if (status) events = events.filter((e) => e.status === status);
    const limit = Number(query.get('limit')) || 200;
    return [200, { events: events.slice(0, limit), total: events.length }];
  }],
  ['GET', /^\/api\/backup-status$/, () => [200, M.backupStatusPayload()]],
  ['GET', /^\/api\/blade-firmware$/, () => [200, M.bladeFirmwarePayload()]],
  ['GET', /^\/api\/cimc\/hosts$/, () => [200, M.cimcHostsPayload()]],
  ['POST', /^\/api\/cimc\/reboot$/, (ctx) => {
    const body = parseBody(ctx.options);
    M.appendAuditLog({ action: 'cimc_reboot', target: body.blade_name, detail: `Reboot requested for ${body.blade_name} (${body.mgmt_ip || 'no mgmt ip'})` });
    return [200, { status: 'ok', message: `Reboot command accepted for ${body.blade_name} (mock — no real device contacted).`, http_status: 200 }];
  }],
  ['GET', /^\/api\/decommissioned$/, () => [200, M.decommissionedPayload()]],
  ['GET', /^\/api\/spare-inventory$/, () => [200, { items: M.spareInventoryStore }]],
  ['POST', /^\/api\/spare-inventory$/, (ctx) => {
    const body = parseBody(ctx.options);
    const item = { id: M.uid('spare-'), added: new Date().toISOString().slice(0, 10), ...body, serial: (body.serial || '').toUpperCase() };
    M.spareInventoryStore.push(item);
    M.appendAuditLog({ action: 'spare_inventory_add', target: item.model, detail: `Added ${item.quantity}x ${item.model}` });
    return [200, item];
  }],
  ['PUT', /^\/api\/spare-inventory\/(?<id>[^/]+)$/, (ctx) => {
    const body = parseBody(ctx.options);
    const item = M.spareInventoryStore.find((i) => i.id === ctx.params.id);
    if (!item) return [404, { detail: 'Item not found' }];
    Object.assign(item, body, { serial: (body.serial || item.serial || '').toUpperCase() });
    M.appendAuditLog({ action: 'spare_inventory_edit', target: item.model, detail: `Edited ${item.model}` });
    return [200, item];
  }],
  ['DELETE', /^\/api\/spare-inventory\/(?<id>[^/]+)$/, (ctx) => {
    const idx = M.spareInventoryStore.findIndex((i) => i.id === ctx.params.id);
    const item = M.spareInventoryStore[idx];
    if (idx >= 0) M.spareInventoryStore.splice(idx, 1);
    M.appendAuditLog({ action: 'spare_inventory_delete', target: item?.model || ctx.params.id, detail: `Removed ${item?.model || 'item'}` });
    return [200, { deleted: ctx.params.id }];
  }],

  // Host Diagnostics + Host Crash Report (previously raw fetch() call sites)
  ['GET', /^\/api\/diagnostics\/host-alerts$/, (ctx) => [200, M.hostAlertsPayload(ctx.query.get('host'))]],
  ['POST', /^\/api\/diagnostics\/equipment\/collect$/, (ctx) => [200, M.collectEquipmentPayload(parseBody(ctx.options))]],
  ['POST', /^\/api\/diagnostics\/equipment\/techsupport$/, (ctx) => {
    const body = parseBody(ctx.options);
    const device = M.findEquipmentDevice(body.kind, body.moid);
    const host = device ? (device.display_name || device.name) : 'unknown-device';
    return [200, M.createEquipmentTechsupportJob({ serial: device?.serial || 'UNKNOWN', host })];
  }],
  ['POST', /^\/api\/diagnostics\/equipment\/analyze$/, (ctx) => [200, M.analyzeEquipmentPayload(parseBody(ctx.options))]],
  ['POST', /^\/api\/diagnostics\/techsupport$/, (ctx) => {
    const body = parseBody(ctx.options);
    const blade = findDeviceHost(body.host);
    return [200, M.createTechsupportJob({ serial: blade?.serial || 'UNKNOWN', host: body.host })];
  }],
  ['GET', /^\/api\/diagnostics\/techsupport\/(?<statusMoid>[^/]+)$/, (ctx) => [200, M.techsupportStatusPayload(ctx.params.statusMoid)]],
  ['GET', /^\/api\/diagnostics\/history$/, () => [200, M.diagnosticsHistoryListPayload()]],
  ['GET', /^\/api\/diagnostics\/history\/(?<id>[^/]+)$/, (ctx) => {
    const record = M.diagnosticsHistoryRecordPayload(ctx.params.id);
    return record ? [200, record] : [404, { detail: 'History record not found' }];
  }],
  ['DELETE', /^\/api\/diagnostics\/history\/(?<id>[^/]+)$/, (ctx) => [200, M.deleteDiagnosticsHistoryRecord(ctx.params.id)]],
  ['GET', /^\/api\/diagnostics\/usage$/, () => [200, M.diagnosticsUsagePayload()]],
  ['POST', /^\/api\/diagnostics\/collect$/, (ctx) => {
    const body = parseBody(ctx.options);
    M.appendAuditLog({ action: 'diagnostics_collect', target: body.host, detail: `Collected diagnostics for ${body.host}` });
    return [200, M.collectDiagnosticsPayload(body)];
  }],
  ['POST', /^\/api\/diagnostics\/analyze$/, (ctx) => {
    const body = parseBody(ctx.options);
    M.appendAuditLog({ action: 'diagnostics_analyze', target: body.host, detail: `Ran AI analysis for ${body.host}` });
    return [200, M.analyzeDiagnosticsPayload(body)];
  }],
  ['POST', /^\/api\/vmware\/host-crash-report$/, (ctx) => [200, M.hostCrashReportPayload(parseBody(ctx.options).host)]],
  ['GET', /^\/api\/webhook\/history$/, () => [200, M.webhookHistoryListPayload()]],
  ['GET', /^\/api\/webhook\/history\/(?<id>[^/]+)$/, (ctx) => {
    const record = M.webhookHistoryRecordPayload(ctx.params.id);
    return record ? [200, record] : [404, { detail: 'Webhook record not found' }];
  }],
  ['DELETE', /^\/api\/webhook\/history\/(?<id>[^/]+)$/, (ctx) => {
    M.appendAuditLog({ action: 'webhook_history_delete', target: ctx.params.id, detail: 'Deleted webhook history record' });
    return [200, M.deleteWebhookHistoryRecord(ctx.params.id)];
  }],
  ['POST', /^\/api\/serial-lookup$/, (ctx) => [200, M.serialLookupPayload(parseBody(ctx.options).serial_numbers || [])]],

  // deviceIndex.js (kept for completeness, though loadDeviceIndex builds locally now)
  ['GET', /^\/api\/blades$/, () => [200, { blades: M.bladesList, total: M.bladesList.length }]],
  ['GET', /^\/api\/fabric-interconnects$/, () => [200, { fabric_interconnects: M.fabricInterconnects, total: M.fabricInterconnects.length }]],
];

function randomDelay() {
  return 150 + Math.round(Math.random() * 250);
}

export default function mockFetch(url, options) {
  const parsed = new URL(String(url), 'http://mock.local');
  const method = (options?.method || 'GET').toUpperCase();
  const pathname = parsed.pathname;

  for (const [routeMethod, regex, handler] of ROUTES) {
    if (routeMethod !== method) continue;
    const match = regex.exec(pathname);
    if (!match) continue;
    const ctx = { options, query: parsed.searchParams, params: match.groups || {} };
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const [status, data] = handler(ctx);
          resolve(jsonResponse(status, data));
        } catch (err) {
          resolve(jsonResponse(500, { detail: err?.message || 'Mock backend error' }));
        }
      }, randomDelay());
    });
  }

  return new Promise((resolve) => {
    setTimeout(() => resolve(jsonResponse(404, { detail: `No mock route for ${method} ${pathname}` })), randomDelay());
  });
}
