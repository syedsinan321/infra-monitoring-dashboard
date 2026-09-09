// This is a static frontend demo — there is no backend. Every call below
// still speaks the original REST-ish `/api/...` contract, but `mockFetch`
// (src/mockFetch.js) intercepts it and answers from the in-memory mock
// fleet in src/mockData.js instead of hitting the network.
import mockFetch from './mockFetch';

const API_BASE_URL = '/api';

export async function fetchDashboard(refresh = false) {
  const url = refresh ? `${API_BASE_URL}/dashboard?refresh=true` : `${API_BASE_URL}/dashboard`;
  const response = await mockFetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }
  return response.json();
}

export async function fetchDiagnosticsEquipment() {
  const response = await mockFetch(`${API_BASE_URL}/diagnostics/equipment`);
  if (!response.ok) {
    throw new Error('Failed to fetch equipment health');
  }
  return response.json();
}

export async function fetchFabricTopology(refresh = false) {
  const url = refresh ? `${API_BASE_URL}/fabric-topology?refresh=true` : `${API_BASE_URL}/fabric-topology`;
  const response = await mockFetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch fabric topology');
  }
  return response.json();
}

export async function fetchEsxiHostList() {
  const response = await mockFetch(`${API_BASE_URL}/vmware/esxi-host-list`);
  if (!response.ok) {
    throw new Error('Failed to fetch ESXi host list');
  }
  return response.json();
}

export async function fetchBladeFirmwareExport() {
  const response = await mockFetch(`${API_BASE_URL}/blade-firmware/export`);
  if (!response.ok) {
    throw new Error('Failed to fetch firmware export data');
  }
  return response.json();
}

export async function fetchEsxiHosts() {
  const response = await mockFetch(`${API_BASE_URL}/vmware/esxi-hosts`);
  if (!response.ok) {
    throw new Error('Failed to fetch ESXi hosts data');
  }
  return response.json();
}

export async function fetchVMs(refresh = false) {
  const url = refresh ? `${API_BASE_URL}/vmware/vms?refresh=true` : `${API_BASE_URL}/vmware/vms`;
  const response = await mockFetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch VM data');
  }
  return response.json();
}

export async function fetchFiPortStats() {
  const response = await mockFetch(`${API_BASE_URL}/fi-port-stats`);
  if (!response.ok) {
    throw new Error('Failed to fetch FI port statistics');
  }
  return response.json();
}

export async function authenticateTpmPage(password) {
  const response = await mockFetch(`${API_BASE_URL}/tpm-keys/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    throw new Error('Authentication request failed');
  }
  return response.json();
}

export async function fetchTpmKeys({ sync = false } = {}) {
  const url = sync ? `${API_BASE_URL}/tpm-keys?sync=true` : `${API_BASE_URL}/tpm-keys`;
  const response = await mockFetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch TPM keys data');
  }
  return response.json();
}

export async function startTpmCollect() {
  const response = await mockFetch(`${API_BASE_URL}/tpm-keys/collect`, {
    method: 'POST',
  });
  if (!response.ok) {
    const body = await response.text();
    let detail = '';
    try { detail = JSON.parse(body).detail; } catch {
      // Proxy/gateway returned HTML (e.g. 504 Gateway Timeout)
      detail = response.status === 504
        ? 'Gateway timeout — the server took too long to respond. Please try again.'
        : `Server error (HTTP ${response.status})`;
    }
    throw new Error(detail);
  }
  return response.json();
}

export async function getTpmCollectStatus() {
  const response = await mockFetch(`${API_BASE_URL}/tpm-keys/collect/status`);
  if (!response.ok) {
    throw new Error('Failed to get collection status');
  }
  return response.json();
}

export async function uploadTpmKeys(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await mockFetch(`${API_BASE_URL}/tpm-keys/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error('Failed to upload TPM keys');
  }
  return response.json();
}

export async function fetchOcpVcpuSummary() {
  const response = await mockFetch(`${API_BASE_URL}/openshift/vcpu-summary`);
  if (!response.ok) {
    throw new Error('Failed to fetch OpenShift vCPU data');
  }
  return response.json();
}

export async function fetchOcpVcpuHistory(days = 30) {
  const response = await mockFetch(`${API_BASE_URL}/openshift/vcpu-history?days=${days}`);
  if (!response.ok) {
    throw new Error('Failed to fetch OpenShift vCPU history');
  }
  return response.json();
}

export async function fetchHostInventory() {
  const response = await mockFetch(`${API_BASE_URL}/host-inventory`);
  if (!response.ok) {
    throw new Error('Failed to fetch host inventory');
  }
  return response.json();
}

export async function fetchIntegrationsHealth() {
  const response = await mockFetch(`${API_BASE_URL}/integrations/health`);
  if (!response.ok) {
    throw new Error('Failed to fetch integrations health');
  }
  return response.json();
}

export async function postIntegrationToggle(key, enabled) {
  const response = await mockFetch(`${API_BASE_URL}/integrations/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, enabled }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || 'Failed to update integration toggle');
  }
  return response.json();
}

export async function fetchTeamsWebhookSetting() {
  const response = await mockFetch(`${API_BASE_URL}/settings/teams-webhook`);
  if (!response.ok) {
    throw new Error('Failed to fetch Teams webhook setting');
  }
  return response.json();
}

export async function postTeamsWebhookSetting(url) {
  const response = await mockFetch(`${API_BASE_URL}/settings/teams-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || 'Failed to update Teams webhook setting');
  }
  return response.json();
}

export async function fetchAuditLog({ limit = 200, action, actor, status } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (action) params.set('action', action);
  if (actor) params.set('actor', actor);
  if (status) params.set('status', status);
  const response = await mockFetch(`${API_BASE_URL}/audit?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch audit log');
  }
  return response.json();
}

export async function fetchBackupStatus(refresh = false) {
  const url = refresh ? `${API_BASE_URL}/backup-status?refresh=true` : `${API_BASE_URL}/backup-status`;
  const response = await mockFetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch backup status data');
  }
  return response.json();
}

export async function syncHostInventory() {
  const response = await mockFetch(`${API_BASE_URL}/host-inventory/sync`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to sync host inventory');
  }
  return response.json();
}

export async function fetchBladeFirmware() {
  const response = await mockFetch(`${API_BASE_URL}/blade-firmware`);
  if (!response.ok) {
    throw new Error('Failed to fetch blade firmware data');
  }
  return response.json();
}

export async function fetchCimcHosts() {
  const response = await mockFetch(`${API_BASE_URL}/cimc/hosts`);
  if (!response.ok) {
    throw new Error('Failed to fetch CIMC hosts');
  }
  return response.json();
}

export async function rebootCimc(host, credentials) {
  const response = await mockFetch(`${API_BASE_URL}/cimc/reboot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blade_moid: host.moid,
      blade_name: host.blade_name,
      mgmt_ip: host.mgmt_ip,
      username: credentials.username,
      password: credentials.password,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || `Reboot request failed (HTTP ${response.status})`);
  }
  return body;
}

export async function fetchDecommissioned() {
  const response = await mockFetch(`${API_BASE_URL}/decommissioned`);
  if (!response.ok) {
    throw new Error('Failed to fetch decommissioned servers');
  }
  return response.json();
}

export async function fetchSpareInventory() {
  const response = await mockFetch(`${API_BASE_URL}/spare-inventory`);
  if (!response.ok) {
    throw new Error('Failed to fetch spare inventory');
  }
  return response.json();
}

export async function addSpareInventoryItem(item) {
  const response = await mockFetch(`${API_BASE_URL}/spare-inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!response.ok) {
    throw new Error('Failed to add spare inventory item');
  }
  return response.json();
}

export async function updateSpareInventoryItem(itemId, item) {
  const response = await mockFetch(`${API_BASE_URL}/spare-inventory/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!response.ok) {
    throw new Error('Failed to update spare inventory item');
  }
  return response.json();
}

export async function deleteSpareInventoryItem(itemId) {
  const response = await mockFetch(`${API_BASE_URL}/spare-inventory/${itemId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete spare inventory item');
  }
  return response.json();
}

