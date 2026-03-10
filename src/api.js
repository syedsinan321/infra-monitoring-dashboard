import {
  dashboardData,
  hostInventoryData,
  capacityData,
  esxiHostData,
  vmToolsData,
  tpmKeysData,
  lookupSerials,
} from './mockData';

// Simulate a small network delay
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export async function fetchDashboard() {
  await delay();
  return dashboardData;
}

export async function fetchHostInventory() {
  await delay();
  return hostInventoryData;
}

export async function syncHostInventory() {
  await delay(500);
  return hostInventoryData;
}

export async function fetchCapacitySummary(_timeRange) {
  await delay();
  return capacityData;
}

export async function fetchCapacity(_timeRange) {
  await delay(200);
  return capacityData;
}

export async function fetchEsxiHosts() {
  await delay();
  return esxiHostData;
}

export async function fetchVMs() {
  await delay();
  return vmToolsData;
}

export async function fetchTpmKeys(_opts) {
  await delay();
  return tpmKeysData;
}

export async function authenticateTpmPage(_password) {
  await delay(200);
  return { valid: true };
}

export async function startTpmCollect() {
  await delay(200);
  return { status: 'done', message: 'All hosts already collected' };
}

export async function getTpmCollectStatus() {
  await delay();
  return { status: 'done', imported_count: 0, errors: [] };
}

export async function uploadTpmKeys(_file) {
  await delay(500);
  return { ...tpmKeysData, imported_count: 0, import_errors: [] };
}

export async function bulkSerialLookup(serials) {
  await delay(300);
  return lookupSerials(serials);
}
