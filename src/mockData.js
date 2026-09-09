// Static mock data layer for the Platform Dashboard demo build.
// Everything here is fabricated but shaped to match what the real
// Vantage / vCenter / AriaOps-backed API used to return, so the
// UI components render exactly as they did against the live backend.
//
// State that used to live server-side (spare inventory, alert rules/history,
// TPM keys, audit log) is kept as in-memory arrays here so CRUD operations
// feel functional for the lifetime of a browser session. Nothing persists
// across a reload — that's expected for a static demo.

// ---------------------------------------------------------------------------
// Small deterministic helpers
// ---------------------------------------------------------------------------

// Mongo-ObjectId-style 24 hex char moid. A shared realistic-looking prefix
// plus an incrementing suffix — NOTE: the counter must stay well under
// Number.MAX_SAFE_INTEGER, or += arithmetic silently no-ops from float
// precision loss and every "unique" id collides.
let hexSeq = 0;
function hexId() {
  hexSeq += 1;
  return `6512a3f9656c6a2d${hexSeq.toString(16).padStart(8, '0')}`;
}

let uuidCounter = 0;
function uid(prefix = '') {
  uuidCounter += 1;
  return `${prefix}${uuidCounter.toString(16).padStart(8, '0')}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
function isoMinutesAgo(mins) {
  return new Date(Date.now() - mins * 60 * 1000).toISOString();
}
function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}
function isoDateDaysAgo(days) {
  return isoDaysAgo(days).slice(0, 10);
}
function pick(arr, i) {
  return arr[i % arr.length];
}

// ---------------------------------------------------------------------------
// Fleet topology: domains, chassis, blades, fabric interconnects, switches
// ---------------------------------------------------------------------------

const BLADE_MODELS_BY_GEN = {
  M7: 'UCSX-210C-M7',
  M6: 'UCSX-210C-M6',
  M5: 'UCSB-B200-M5',
};

const DOMAINS = [
  { name: 'site1prducs01', dc: 'SITE1', chassisCount: 3, model: 'UCSX-9508', fiModel: 'UCS-FI-6454' },
  { name: 'site2prducs01', dc: 'SITE2', chassisCount: 2, model: 'UCSX-9508', fiModel: 'UCS-FI-64108' },
];

const chassisList = [];
const bladesList = [];
const fabricInterconnects = [];
const networkSwitches = [];
const serverProfiles = [];

let slotAssignCounter = 0;
const hostNameCounters = {};
DOMAINS.forEach((domain) => {
  for (let c = 1; c <= domain.chassisCount; c += 1) {
    const chassisName = `${domain.name}-${c}`;
    const chassisMoid = hexId();
    const totalSlots = 8;
    // Vary occupancy a bit so the fleet doesn't look perfectly uniform.
    const usedSlots = c === domain.chassisCount ? 5 : totalSlots - (c % 2);
    chassisList.push({
      moid: chassisMoid,
      name: chassisName,
      model: domain.model,
      serial: `FOX${(2400 + slotAssignCounter).toString()}G${c}${DOMAINS.indexOf(domain)}H`,
      chassis_id: String(c),
      connection_status: 'Connected',
      oper_state: usedSlots < totalSlots ? 'OK' : 'OK',
      total_slots: totalSlots,
      used_slots: usedSlots,
      available_slots: totalSlots - usedSlots,
      registered_device_moid: hexId(),
    });

    for (let slot = 1; slot <= usedSlots; slot += 1) {
      slotAssignCounter += 1;
      const gen = slotAssignCounter % 9 === 0 ? 'M5' : slotAssignCounter % 3 === 0 ? 'M6' : 'M7';
      const bladeMoid = hexId();
      const degraded = slotAssignCounter % 17 === 0;
      // Profile name mirrors the ESXi hostname running on this blade, so the
      // Dashboard's vCenter-health join (profile name -> host short name)
      // actually lines up, just like it did against the real fleet.
      const hostIdx = hostNameCounters[domain.dc] || 1;
      hostNameCounters[domain.dc] = hostIdx + 1;
      const profileName = `esx-${domain.dc.toLowerCase()}-${String(hostIdx).padStart(2, '0')}`;
      bladesList.push({
        moid: bladeMoid,
        name: `Blade-${slot}`,
        model: BLADE_MODELS_BY_GEN[gen],
        serial: `FCH${(2100 + slotAssignCounter).toString()}V${(100 + slotAssignCounter).toString()}`,
        slot_id: String(slot),
        chassis_id: String(c),
        chassis_moid: chassisMoid,
        chassis_name: chassisName,
        oper_power_state: degraded ? 'off' : 'on',
        oper_state: degraded ? 'thermal-warning' : 'ok',
        num_cpus: gen === 'M5' ? 2 : 2,
        num_cpu_cores: gen === 'M5' ? 24 : 32,
        total_memory: gen === 'M5' ? 524288 : 1048576,
        assigned_server_profile: profileName,
        management_mode: 'Vantage',
        mgmt_ip: `10.${DOMAINS.indexOf(domain) + 20}.${c}.${10 + slot}`,
      });

      serverProfiles.push({
        moid: hexId(),
        name: profileName,
        description: `Auto-generated profile for ${chassisName} slot ${slot}`,
        config_context: {
          config_state: degraded ? 'Applying' : 'Applied',
          oper_state: degraded ? 'associating' : 'associated',
        },
        assigned_server: { moid: bladeMoid, object_type: 'compute.Blade' },
        target_platform: 'FIAttached',
        create_time: isoDaysAgo(200 - slotAssignCounter),
        mod_time: isoDaysAgo(5 + (slotAssignCounter % 20)),
      });
    }

    // A couple of unassigned "spare" profiles per domain for realism.
    if (c === 1) {
      serverProfiles.push({
        moid: hexId(),
        name: `${domain.name}-spare-profile-01`,
        description: 'Unassigned spare profile, staged for next hardware refresh',
        config_context: { config_state: 'Not Assigned', oper_state: 'unassigned' },
        assigned_server: null,
        target_platform: 'FIAttached',
        create_time: isoDaysAgo(60),
        mod_time: isoDaysAgo(60),
      });
    }
  }

  ['A', 'B'].forEach((switchId, idx) => {
    fabricInterconnects.push({
      moid: hexId(),
      name: `${domain.name}-fi-${switchId.toLowerCase()}`,
      model: domain.fiModel,
      serial: `FLM${(2600 + idx).toString()}${DOMAINS.indexOf(domain)}0${switchId}`,
      switch_id: switchId,
      oper_evac_state: 'disabled',
      admin_evac_state: 'disabled',
      ethernet_mode: 'end-host',
      fc_mode: 'switch',
      out_of_band_ip_address: `10.${DOMAINS.indexOf(domain) + 20}.0.${switchId === 'A' ? 1 : 2}`,
      total_ports: 54,
      used_ports: 30 + idx * 4,
      registered_device_moid: hexId(),
      domain_name: domain.name,
      display_name: `${domain.name} FI-${switchId}`,
      device_type: 'fabric_interconnect',
    });
  });

  if (domain.dc === 'SITE1') {
    ['01', '02'].forEach((n, idx) => {
      networkSwitches.push({
        moid: hexId(),
        domain_name: domain.name,
        name: `site1sansw${n}`,
        display_name: `site1sansw${n}`,
        model: 'MDS-9148T',
        serial: `FDO${2700 + idx}${idx}ABC`,
        switch_id: idx === 0 ? 'A' : 'B',
        oper_evac_state: 'disabled',
        fc_mode: 'switch',
        out_of_band_ip_address: `10.20.1.${10 + idx}`,
        device_type: 'network_switch',
      });
    });
  }
});

// One FI intentionally shown with a warning state so the dashboard "issues"
// list and status badges have something real to demonstrate.
fabricInterconnects[fabricInterconnects.length - 1].oper_evac_state = 'enabled';

function computeServerGenerations() {
  const gens = { M7: 0, M6: 0, M5: 0, M4: 0, Other: 0 };
  bladesList.forEach((b) => {
    if (b.model.includes('M7')) gens.M7 += 1;
    else if (b.model.includes('M6')) gens.M6 += 1;
    else if (b.model.includes('M5')) gens.M5 += 1;
    else if (b.model.includes('M4')) gens.M4 += 1;
    else gens.Other += 1;
  });
  return gens;
}

function computeDatacenterGenerations() {
  const out = { SITE1: { M7: 0, M6: 0, M5: 0, M4: 0, Other: 0 }, SITE2: { M7: 0, M6: 0, M5: 0, M4: 0, Other: 0 }, Other: { M7: 0, M6: 0, M5: 0, M4: 0, Other: 0 } };
  bladesList.forEach((b) => {
    const domain = DOMAINS.find((d) => b.chassis_name.startsWith(d.name));
    const bucket = domain ? out[domain.dc] : out.Other;
    if (b.model.includes('M7')) bucket.M7 += 1;
    else if (b.model.includes('M6')) bucket.M6 += 1;
    else if (b.model.includes('M5')) bucket.M5 += 1;
    else bucket.Other += 1;
  });
  return out;
}

function buildDomainWidgets() {
  return DOMAINS.map((domain) => {
    const domainChassis = chassisList.filter((ch) => ch.name.startsWith(domain.name));
    const domainBlades = bladesList.filter((b) => b.chassis_name.startsWith(domain.name));
    const domainFis = fabricInterconnects.filter((fi) => fi.domain_name === domain.name);
    const totalSlots = domainChassis.reduce((s, c) => s + c.total_slots, 0);
    const usedSlots = domainChassis.reduce((s, c) => s + c.used_slots, 0);
    const totalPorts = domainFis.reduce((s, fi) => s + fi.total_ports, 0);
    const portsUp = domainFis.reduce((s, fi) => s + fi.used_ports, 0);
    return {
      name: domain.name,
      chassis_count: domainChassis.length,
      total_slots: totalSlots,
      used_slots: usedSlots,
      empty_slots: totalSlots - usedSlots,
      blade_count: domainBlades.length,
      fi_count: domainFis.length,
      total_ports: totalPorts,
      ports_up: portsUp,
      ports_down: totalPorts - portsUp,
      chassis_details: domainChassis.map((c) => ({
        name: c.name, chassis_id: c.chassis_id, total_slots: c.total_slots,
        used_slots: c.used_slots, empty_slots: c.available_slots, model: c.model,
      })),
      unused_blades: totalSlots - usedSlots,
      unused_blade_details: domainChassis.flatMap((c) => {
        const gaps = [];
        for (let s = c.used_slots + 1; s <= c.total_slots; s += 1) {
          gaps.push({ chassis_name: c.name, slot_id: String(s), model: null, serial: null });
        }
        return gaps;
      }),
      port_types: {
        server: { total: Math.round(totalPorts * 0.4), up: Math.round(portsUp * 0.4) },
        eth_uplink: { total: Math.round(totalPorts * 0.3), up: Math.round(portsUp * 0.3) },
        fc_uplink: { total: Math.round(totalPorts * 0.15), up: Math.round(portsUp * 0.15) },
        unconfigured: { total: Math.round(totalPorts * 0.1), up: 0 },
        other: { total: Math.round(totalPorts * 0.05), up: Math.round(portsUp * 0.05) },
      },
    };
  });
}

export function buildDashboardData() {
  const totalSlots = chassisList.reduce((s, c) => s + c.total_slots, 0);
  const usedSlots = chassisList.reduce((s, c) => s + c.used_slots, 0);
  const assignedProfiles = serverProfiles.filter((p) => p.assigned_server).length;
  return {
    summary: {
      total_chassis: chassisList.length,
      total_blades: bladesList.length,
      total_slots: totalSlots,
      used_slots: usedSlots,
      available_slots: totalSlots - usedSlots,
      total_fis: fabricInterconnects.length,
      total_network_switches: networkSwitches.length,
      total_profiles: serverProfiles.length,
      assigned_profiles: assignedProfiles,
      unassigned_profiles: serverProfiles.length - assignedProfiles,
      server_generations: computeServerGenerations(),
      datacenter_generations: computeDatacenterGenerations(),
    },
    domains: buildDomainWidgets(),
    chassis: chassisList,
    blades: bladesList,
    fabric_interconnects: fabricInterconnects,
    network_switches: networkSwitches,
    server_profiles: serverProfiles,
  };
}

// Every ESXi hostname running on an occupied blade, grouped by datacenter —
// the single source of truth other sections (ESXi host list, VM inventory,
// host inventory, diagnostics, crash reports) key off of so names line up
// everywhere in the demo.
export const ESXI_HOSTS_BY_DC = {};
bladesList.forEach((b) => {
  const domain = DOMAINS.find((d) => b.chassis_name.startsWith(d.name));
  const dc = domain ? domain.dc : 'SITE1';
  (ESXI_HOSTS_BY_DC[dc] = ESXI_HOSTS_BY_DC[dc] || []).push({
    host_name: `${b.assigned_server_profile}.example.com`,
    short: b.assigned_server_profile,
    dc,
    blade: b,
  });
});

// ---------------------------------------------------------------------------
// ESXi hosts (vCenter) — one entry per occupied blade, joined by hostname
// ---------------------------------------------------------------------------

const VCENTER_BY_DC = { SITE1: 'vcenter-site1.example.com', SITE2: 'vcenter-site2.example.com' };
const CLUSTER_SPLIT = { SITE1: ['site1-prd-cluster01', 'site1-dev-cluster01'], SITE2: ['site2-prd-cluster01'] };

export const ESXI_HOST_RECORDS = [];
Object.entries(ESXI_HOSTS_BY_DC).forEach(([dc, hosts]) => {
  hosts.forEach((h, i) => {
    const clusters = CLUSTER_SPLIT[dc];
    const cluster = clusters.length > 1 && i >= Math.ceil(hosts.length * 0.7) ? clusters[1] : clusters[0];
    const gen = h.blade.model.includes('M5') ? '7.0.3' : '8.0.3';
    const build = h.blade.model.includes('M5') ? '22348816' : '23825572';
    const troubled = h.blade.oper_state !== 'ok';
    const maintenance = !troubled && i === 2 && dc === 'SITE2';
    const yellow = !troubled && !maintenance && i === 4 && dc === 'SITE1';
    ESXI_HOST_RECORDS.push({
      host_name: h.host_name,
      datacenter: dc,
      cluster,
      version: gen,
      build,
      connection_state: troubled ? 'notResponding' : 'connected',
      power_state: troubled ? 'poweredOff' : 'poweredOn',
      maintenance_mode: maintenance,
      overall_status: troubled ? 'red' : yellow ? 'yellow' : 'green',
      serial: h.blade.serial,
      hw_model: h.blade.model,
      hw_vendor: 'Cisco Systems Inc',
      vcenter: VCENTER_BY_DC[dc],
    });
  });
});

export function esxiHostListPayload() {
  return { hosts: ESXI_HOST_RECORDS, errors: null };
}

export function esxiClustersPayload() {
  const byKey = new Map();
  ESXI_HOST_RECORDS.forEach((h) => {
    const key = `${h.datacenter}|${h.cluster}|${h.version}|${h.build}`;
    if (!byKey.has(key)) {
      byKey.set(key, { datacenter: h.datacenter, cluster: h.cluster, version: h.version, build: h.build, host_count: 0 });
    }
    byKey.get(key).host_count += 1;
  });
  const clusters = [...byKey.values()];
  return {
    clusters,
    summary: {
      total_hosts: ESXI_HOST_RECORDS.length,
      total_clusters: new Set(ESXI_HOST_RECORDS.map((h) => h.cluster)).size,
      datacenters: [...new Set(ESXI_HOST_RECORDS.map((h) => h.datacenter))],
    },
    errors: null,
    source: 'live',
  };
}

// ---------------------------------------------------------------------------
// VM inventory — shared by VMware Tools, VM Backup Status, OpenShift Licensing
// ---------------------------------------------------------------------------

const GUEST_OS_POOL = [
  { os: 'Red Hat Enterprise Linux 9 (64-bit)', kind: 'rhel' },
  { os: 'Red Hat Enterprise Linux 8 (64-bit)', kind: 'rhel' },
  { os: 'Microsoft Windows Server 2022 (64-bit)', kind: 'windows' },
  { os: 'Microsoft Windows Server 2019 (64-bit)', kind: 'windows' },
  { os: 'Ubuntu Linux (64-bit)', kind: 'rhel' },
];

const APP_NAME_POOL = ['app', 'db', 'web', 'lb', 'cache', 'batch', 'mgmt', 'util'];

export const VM_RECORDS = [];
let vmSeq = 0;
ESXI_HOST_RECORDS.forEach((host, hostIdx) => {
  const vmsOnHost = 2 + (hostIdx % 3);
  for (let i = 0; i < vmsOnHost; i += 1) {
    vmSeq += 1;
    const dcTag = host.datacenter.toLowerCase();
    const app = pick(APP_NAME_POOL, vmSeq);
    const guest = pick(GUEST_OS_POOL, vmSeq + hostIdx);
    const isOcp = host.cluster.includes('prd') && vmSeq % 5 === 0;
    const name = isOcp
      ? `ocp-${dcTag}-worker-${String(vmSeq).padStart(2, '0')}`
      : `${dcTag}-${app}${String(vmSeq).padStart(2, '0')}`;
    const toolsCurrent = vmSeq % 11 !== 0;
    const powerOff = vmSeq % 23 === 0;
    VM_RECORDS.push({
      vm_name: name,
      datacenter: host.datacenter,
      cluster: host.cluster,
      os: isOcp ? 'Red Hat Enterprise Linux CoreOS' : guest.os,
      guest_os: isOcp ? 'Red Hat Enterprise Linux CoreOS' : guest.os,
      os_type: guest.kind,
      tools_version: powerOff ? '0' : toolsCurrent ? '12416' : '10346',
      power_state: powerOff ? 'poweredOff' : 'poweredOn',
      uptime_seconds: powerOff ? 0 : 86400 * (3 + (vmSeq % 45)),
      boot_time: powerOff ? null : isoDaysAgo(3 + (vmSeq % 45)),
      vcpus: isOcp ? 8 : 2 + (vmSeq % 4) * 2,
      current_host: host.host_name,
      isOcp,
    });
  }
});

export function esxiVmsPayload() {
  return {
    vms: VM_RECORDS.map(({ isOcp, ...v }) => v),
    summary: { total_vms: VM_RECORDS.length, datacenters: [...new Set(VM_RECORDS.map((v) => v.datacenter))] },
    errors: null,
    source: 'live',
  };
}

// ---------------------------------------------------------------------------
// Host inventory (host_inventory.py) — active + a couple of removed hosts
// ---------------------------------------------------------------------------

export const HOST_INVENTORY_RECORDS = ESXI_HOST_RECORDS.map((h, i) => ({
  host_name: h.host_name,
  datacenter: h.datacenter,
  cluster: h.cluster,
  cpu_count: h.hw_model.includes('M5') ? 24 : 32,
  vcenter: h.vcenter,
  first_seen: isoDaysAgo(300 - i),
  cluster_since: isoDaysAgo(180 - (i % 60)),
  last_seen: isoMinutesAgo(5 + (i % 30)),
}));
// A couple of historical hosts that were decommissioned and dropped from the
// live fleet, still tracked here with a `removed` timestamp.
['esx-site1-97.example.com', 'esx-site2-88.example.com'].forEach((host_name, i) => {
  HOST_INVENTORY_RECORDS.push({
    host_name,
    datacenter: host_name.includes('site2') ? 'SITE2' : 'SITE1',
    cluster: host_name.includes('site2') ? 'site2-prd-cluster01' : 'site1-prd-cluster01',
    cpu_count: 32,
    vcenter: VCENTER_BY_DC[host_name.includes('site2') ? 'SITE2' : 'SITE1'],
    first_seen: isoDaysAgo(500),
    cluster_since: isoDaysAgo(480),
    last_seen: isoDaysAgo(40 + i * 10),
    removed: isoDaysAgo(35 + i * 10),
  });
});

export function hostInventoryPayload() {
  return {
    hosts: HOST_INVENTORY_RECORDS,
    total: HOST_INVENTORY_RECORDS.length,
    last_sync: isoMinutesAgo(12),
    errors: null,
  };
}

// ---------------------------------------------------------------------------
// Blade firmware compliance
// ---------------------------------------------------------------------------

export function bladeFirmwarePayload() {
  const genFirmware = { M7: '5.2(2.240053)', M6: '5.1(1.230040)', M5: '4.3(3.240012)' };
  const genFor = (model) => (model.includes('M7') ? 'M7' : model.includes('M6') ? 'M6' : 'M5');
  const groups = new Map();
  bladesList.forEach((b) => {
    const gen = genFor(b.model);
    const version = genFirmware[gen];
    if (!groups.has(version)) groups.set(version, { version, count: 0, model_counts: {}, sample_blades: [], gen });
    const g = groups.get(version);
    g.count += 1;
    g.model_counts[b.model] = (g.model_counts[b.model] || 0) + 1;
    if (g.sample_blades.length < 5) {
      g.sample_blades.push({
        name: b.name, model: b.model, serial: b.serial, slot_id: b.slot_id,
        chassis_id: b.chassis_id, firmware_version: version,
      });
    }
  });
  const STATUS_BY_GEN = {
    M7: { support_status: 'Active', status_label: 'Supported', eol_info: null, recommended_version: null },
    M6: { support_status: 'Active', status_label: 'Supported', eol_info: null, recommended_version: '5.2(2.240053)' },
    M5: {
      support_status: 'EOL Announced', status_label: 'EOL Announced',
      eol_info: {
        eol_announcement: '2025-06-01', end_sw_maintenance: '2026-06-01',
        last_date_of_support: '2029-06-01',
        note: 'UCSB-B200-M5 blades reached End-of-Life announcement; plan refresh before last-support date.',
        source: 'Cisco EoL/EoS bulletin (mock)',
      },
      recommended_version: '5.2(2.240053)',
    },
  };
  const firmware_groups = [...groups.values()].map((g) => ({
    version: g.version,
    count: g.count,
    model_counts: g.model_counts,
    sample_blades: g.sample_blades,
    ...STATUS_BY_GEN[g.gen],
    known_bugs: g.gen === 'M5' ? [
      { id: 'CSCwm12345', status: 'fixed_later', description: 'Intermittent DIMM correctable-error storm under sustained load.', first_affected: '4.3(2f)', resolved_in: '4.3(3.240012)', url: 'https://bst.cisco.com/CSCwm12345' },
    ] : [],
  }));
  return {
    firmware_groups,
    total_blades: bladesList.length,
    is_standardized: firmware_groups.length === 1,
    blades: bladesList.map((b) => ({
      name: b.name, model: b.model, serial: b.serial, slot_id: b.slot_id,
      chassis_id: b.chassis_id, firmware_version: genFirmware[genFor(b.model)],
    })),
  };
}

export function bladeFirmwareExportPayload() {
  const rows = bladesList.map((b) => {
    const domain = DOMAINS.find((d) => b.chassis_name.startsWith(d.name));
    const gen = b.model.includes('M7') ? '5.2(2.240053)' : b.model.includes('M6') ? '5.1(1.230040)' : '4.3(3.240012)';
    return {
      cluster: domain ? CLUSTER_SPLIT[domain.dc][0] : '—',
      domain: domain ? domain.name : '—',
      profile: b.assigned_server_profile,
      blade: b.name,
      firmware: gen,
    };
  });
  return { rows, total: rows.length };
}

// ---------------------------------------------------------------------------
// FI port stats
// ---------------------------------------------------------------------------

export function fiPortStatsPayload() {
  return {
    fabric_interconnects: fabricInterconnects.map((fi) => {
      const ethTotal = Math.round(fi.total_ports * 0.7);
      const fcTotal = fi.total_ports - ethTotal;
      const ethUp = Math.round(fi.used_ports * 0.7);
      const fcUp = fi.used_ports - ethUp;
      return {
        fi_name: fi.display_name,
        model: fi.model,
        firmware: '4.3(3.240012)',
        health: fi.oper_evac_state === 'disabled' ? 'OK' : 'Warning',
        eth_total: ethTotal, eth_configured: ethTotal, eth_up: ethUp,
        fc_total: fcTotal, fc_configured: fcTotal, fc_up: fcUp,
        total_ports: fi.total_ports, configured_ports: fi.total_ports,
        ports_up: fi.used_ports, available_ports: fi.total_ports - fi.used_ports,
        utilization_pct: Math.round((fi.used_ports / fi.total_ports) * 1000) / 10,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// CIMC hosts (Reboot CIMC + Host Diagnostics "servers" tab)
// ---------------------------------------------------------------------------

export function cimcHostsPayload() {
  const hosts = bladesList
    .filter((b) => b.assigned_server_profile && b.oper_power_state === 'on')
    .map((b) => {
      const domain = DOMAINS.find((d) => b.chassis_name.startsWith(d.name));
      return {
        moid: b.moid,
        domain: domain ? domain.name : 'unknown',
        server_profile: b.assigned_server_profile,
        blade_name: b.name,
        mgmt_ip: b.mgmt_ip,
        model: b.model,
        datacenter: domain ? domain.dc : 'Other',
      };
    });
  // Also surface the one degraded (powered-off) blade so Host Diagnostics can
  // show it flagged, matching what "cimc/hosts" would include for it in the
  // real API (powered off blades with a profile still resolve there too, so
  // the operator can see and act on the issue).
  bladesList
    .filter((b) => b.assigned_server_profile && b.oper_power_state !== 'on')
    .forEach((b) => {
      const domain = DOMAINS.find((d) => b.chassis_name.startsWith(d.name));
      hosts.push({
        moid: b.moid,
        domain: domain ? domain.name : 'unknown',
        server_profile: b.assigned_server_profile,
        blade_name: b.name,
        mgmt_ip: b.mgmt_ip,
        model: b.model,
        datacenter: domain ? domain.dc : 'Other',
      });
    });
  return { hosts, total: hosts.length };
}

// ---------------------------------------------------------------------------
// Spare inventory — mutable, backs the Inventory page CRUD
// ---------------------------------------------------------------------------

export const spareInventoryStore = [
  { id: uid('spare-'), type: 'blade', dc: 'SITE1', model: 'UCSX-210C-M7', serial: 'FCH2601V9ZZ', notes: 'Cold spare, rack B12 shelf 3', quantity: 2, added: isoDateDaysAgo(120) },
  { id: uid('spare-'), type: 'dimm', dc: 'SITE1', model: 'UCSX-MR-X64G2RW', serial: '', notes: '64GB RDIMM, boxed', quantity: 8, added: isoDateDaysAgo(90) },
  { id: uid('spare-'), type: 'drive', dc: 'SITE2', model: 'UCS-M2-960GB', serial: '', notes: 'M.2 boot drives', quantity: 6, added: isoDateDaysAgo(75) },
  { id: uid('spare-'), type: 'psu', dc: 'SITE1', model: 'UCSX-9508-750DC', serial: '', notes: 'Chassis PSU, shelf 1', quantity: 3, added: isoDateDaysAgo(60) },
  { id: uid('spare-'), type: 'nic', dc: 'SITE2', model: 'UCSC-M-V25-04', serial: '', notes: 'VIC mezz cards', quantity: 4, added: isoDateDaysAgo(45) },
  { id: uid('spare-'), type: 'fi', dc: 'SITE1', model: 'UCS-FI-6454', serial: 'FLM2699A9Z', notes: 'Cold-spare fabric interconnect', quantity: 1, added: isoDateDaysAgo(200) },
  { id: uid('spare-'), type: 'cpu', dc: 'SITE1', model: 'Intel Xeon Gold 6448Y', serial: '', notes: '', quantity: 4, added: isoDateDaysAgo(30) },
  { id: uid('spare-'), type: 'other', dc: 'SITE2', model: 'Rack rail kit', serial: '', notes: 'Spare rail kits, misc', quantity: 5, added: isoDateDaysAgo(15) },
];

// ---------------------------------------------------------------------------
// Audit log — mutable, appended to as demo actions happen
// ---------------------------------------------------------------------------

const AUDIT_ACTORS = ['jmartinez@example.com', 'asharma@example.com', 'rkowalski@example.com', 'svc-automation@example.com', 'tlindgren@example.com'];
const AUDIT_ACTIONS = [
  ['cimc_reboot', 'esx-site1-04', 'Reboot requested via Reboot CIMC page'],
  ['tpm_keys_auth', null, 'TPM Keys page unlocked'],
  ['tpm_keys_collect', null, 'Started TPM key collection run'],
  ['host_inventory_sync', null, 'Manual host inventory sync'],
  ['diagnostics_collect', 'esx-site1-11', 'Collected diagnostics bundle (Vantage + vCenter)'],
  ['diagnostics_analyze', 'esx-site1-11', 'Ran AI root-cause analysis'],
  ['diagnostics_techsupport', 'esx-site2-06', 'Requested TAC tech-support bundle'],
  ['spare_inventory_add', 'UCSX-210C-M7', 'Added spare hardware line item'],
  ['spare_inventory_edit', 'UCSX-MR-X64G2RW', 'Edited spare hardware quantity'],
  ['spare_inventory_delete', 'Rack rail kit', 'Removed spare hardware line item'],
  ['integration_toggle', 'vantage_domain:SITE2', 'Toggled integration visibility'],
  ['diagnostics_history_delete', null, 'Deleted a diagnostics history record'],
  ['webhook_history_delete', null, 'Deleted an AriaOps webhook firing record'],
];
export const auditLogStore = AUDIT_ACTIONS.map(([action, target, detail], i) => ({
  id: i + 1,
  ts: isoDaysAgo(i * 1.7 + 0.2),
  actor: pick(AUDIT_ACTORS, i),
  actor_ip: `10.${20 + (i % 2)}.4.${50 + i}`,
  action,
  target,
  target_detail: target,
  status: i === 8 ? 'error' : 'ok',
  detail: i === 8 ? `${detail} — failed: quantity must be a positive integer` : detail,
}));
let auditLogSeq = auditLogStore.length;
export function appendAuditLog({ actor = 'demo-user@example.com', action, target = null, status = 'ok', detail = '' }) {
  auditLogSeq += 1;
  auditLogStore.unshift({
    id: auditLogSeq, ts: new Date().toISOString(), actor, actor_ip: '10.20.4.99',
    action, target, target_detail: target, status, detail,
  });
}

// ---------------------------------------------------------------------------
// Decommissioned hardware
// ---------------------------------------------------------------------------

export function decommissionedPayload() {
  const items = [
    {
      serial: 'FCH2044V3PH', model: 'UCSB-B200-M4', name: 'Blade-3', domain: 'site1prducs01',
      chassis_id: 2, slot_id: 3, chassis_name: 'site1prducs01-2', presence: null,
      flag: 'slot_reoccupied', severity: 'critical',
      detail: 'Serial no longer present — slot now occupied by a different blade.',
      replacement: { serial: bladesList[7]?.serial, model: bladesList[7]?.model, name: bladesList[7]?.name },
    },
    {
      serial: 'FCH1998V2AA', model: 'UCSB-B200-M4', name: 'Blade-6', domain: 'site2prducs01',
      chassis_id: 1, slot_id: 6, chassis_name: 'site2prducs01-1', presence: 'Equipped',
      flag: 'recommissioned', severity: 'warning',
      detail: 'Marked decommissioned previously, but the serial is active again in Vantage.',
      replacement: null,
    },
    {
      serial: 'FCH1877V1CD', model: 'UCSX-210C-M6', name: 'Blade-8', domain: 'site1prducs01',
      chassis_id: 3, slot_id: 8, chassis_name: 'site1prducs01-3', presence: 'Equipped',
      flag: 'still_racked', severity: 'info',
      detail: 'Flagged for decommission but still physically racked and powered.',
      replacement: null,
    },
    {
      serial: 'FCH1756V0EF', model: 'UCSB-B200-M4', name: 'Blade-2', domain: 'site2prducs01',
      chassis_id: 2, slot_id: 2, chassis_name: 'site2prducs01-2', presence: null,
      flag: 'removed', severity: 'ok',
      detail: 'Fully removed from Vantage and the slot remains empty.',
      replacement: null,
    },
  ];
  const by_domain = {};
  items.forEach((it) => { by_domain[it.domain] = (by_domain[it.domain] || 0) + 1; });
  return {
    items,
    summary: {
      total: items.length,
      stale: items.filter((i) => ['critical', 'warning'].includes(i.severity)).length,
      still_racked: items.filter((i) => i.flag === 'still_racked').length,
      by_domain,
    },
  };
}

// ---------------------------------------------------------------------------
// TPM keys — mutable, with a simulated background collection job
// ---------------------------------------------------------------------------

export const tpmKeyStore = ESXI_HOST_RECORDS.slice(0, 18).map((h, i) => {
  const present = i % 9 !== 8;
  const enabled = present ? i % 6 !== 5 : null;
  return {
    hostname: h.host_name.split('.')[0],
    group: h.datacenter.toLowerCase(),
    vcenter: h.vcenter,
    tpm_present: present,
    recovery_key: present ? Array.from({ length: 8 }, (_, k) => String(100000 + ((i + 1) * (k + 1) * 37) % 900000)).join('-') : null,
    recovery_id: present ? `${hexId().slice(0, 8)}-${hexId().slice(8, 12)}-${hexId().slice(12, 16)}-${hexId().slice(16, 20)}-${hexId().slice(20, 24)}` : null,
    tpm_version: present ? '2.0' : null,
    tpm_enabled: enabled,
    manufacturer: present ? 'Infineon' : null,
    collected_at: isoDaysAgo(2 + (i % 5)),
  };
});
export const tpmMissingHosts = ESXI_HOST_RECORDS.slice(18, 20).map((h) => ({ name: h.host_name.split('.')[0], group: h.datacenter.toLowerCase() }));
export let tpmLastImport = isoDaysAgo(2);
export const tpmCollectJob = { running: false, started_at: null, finished_at: isoDaysAgo(2), status: 'done', imported_count: tpmKeyStore.length, error_count: 0, errors: [], log_lines: [], target_count: tpmKeyStore.length };

export function tpmKeysPayload() {
  return {
    tpm_keys: tpmKeyStore, total: tpmKeyStore.length,
    missing_hosts: tpmMissingHosts, missing_count: tpmMissingHosts.length,
    last_import: tpmLastImport,
  };
}

export function startTpmCollectJob() {
  if (tpmCollectJob.running) return { status: 'already_running', started_at: tpmCollectJob.started_at, target_count: tpmCollectJob.target_count };
  tpmCollectJob.running = true;
  tpmCollectJob.status = 'running';
  tpmCollectJob.started_at = new Date().toISOString();
  tpmCollectJob.finished_at = null;
  tpmCollectJob.imported_count = 0;
  tpmCollectJob.log_lines = ['Connecting to vCenter inventory…', 'Enumerating ESXi hosts…'];
  // Resolve "instantly" behind the scenes — the status endpoint below
  // simulates a short in-flight window before flipping to done.
  tpmCollectJob._readyAt = Date.now() + 6000;
  return { status: 'started', started_at: tpmCollectJob.started_at, target_count: tpmKeyStore.length };
}

export function tpmCollectStatusPayload() {
  if (tpmCollectJob.running && tpmCollectJob._readyAt && Date.now() >= tpmCollectJob._readyAt) {
    tpmCollectJob.running = false;
    tpmCollectJob.status = 'done';
    tpmCollectJob.finished_at = new Date().toISOString();
    tpmCollectJob.imported_count = tpmKeyStore.length;
    tpmCollectJob.log_lines.push('Collected TPM status from all reachable hosts.', 'Done.');
    tpmLastImport = tpmCollectJob.finished_at;
  }
  const base = {
    running: tpmCollectJob.running,
    started_at: tpmCollectJob.started_at,
    finished_at: tpmCollectJob.finished_at,
    status: tpmCollectJob.status,
    imported_count: tpmCollectJob.imported_count,
    error_count: tpmCollectJob.error_count,
    errors: tpmCollectJob.errors,
    log_lines: tpmCollectJob.log_lines,
    target_count: tpmCollectJob.target_count,
  };
  if (tpmCollectJob.status === 'done') {
    return { ...base, tpm_keys: tpmKeyStore, total: tpmKeyStore.length, last_import: tpmLastImport };
  }
  return base;
}

export function uploadTpmKeysPayload() {
  // Treat an upload as re-affirming the current data set (this is a static
  // demo — there's no real file to parse).
  tpmLastImport = new Date().toISOString();
  return {
    tpm_keys: tpmKeyStore, total: tpmKeyStore.length,
    imported: tpmKeyStore.map((k) => k.hostname), imported_count: tpmKeyStore.length,
    import_errors: [], last_import: tpmLastImport,
  };
}

// ---------------------------------------------------------------------------
// VM backup status (Rubrik)
// ---------------------------------------------------------------------------

export function backupStatusPayload() {
  const vms = VM_RECORDS.filter((v) => v.power_state === 'poweredOn').map((v, i) => {
    const result = i % 13 === 0 ? 'FAILED' : i % 17 === 0 ? 'NO_DATA' : i % 29 === 0 ? 'UNKNOWN' : 'SUCCESS';
    const lastBackup = result === 'NO_DATA' ? null : isoDaysAgo(result === 'FAILED' ? 3 : 0.5);
    return {
      vm_name: v.vm_name,
      guest_os: v.guest_os,
      os_type: v.os_type,
      datacenter: v.datacenter,
      vcenter: VCENTER_BY_DC[v.datacenter],
      rubrik_field_value: result === 'NO_DATA' ? null : `gold-sla-${v.datacenter.toLowerCase()}`,
      last_backup_time: lastBackup ? new Date(lastBackup).toUTCString() : null,
      last_backup_epoch: lastBackup ? Math.floor(new Date(lastBackup).getTime() / 1000) : null,
      backup_result: result,
    };
  });
  const count = (r) => vms.filter((v) => v.backup_result === r).length;
  return {
    vms,
    summary: {
      total: vms.length, success: count('SUCCESS'), failed: count('FAILED'),
      no_data: count('NO_DATA'), unknown: count('UNKNOWN'),
      windows: vms.filter((v) => v.os_type === 'windows').length,
      rhel: vms.filter((v) => v.os_type === 'rhel').length,
      datacenters: [...new Set(vms.map((v) => v.datacenter))],
    },
    errors: null,
    source: 'live',
  };
}

// ---------------------------------------------------------------------------
// Integrations health (Settings page)
// ---------------------------------------------------------------------------

export const integrationToggles = {
  vantage: true, 'vantage_domain:SITE1': true, 'vantage_domain:SITE2': true,
  arialog: true, smtp: true, teams: true, ariaops_webhook: true, arialog_alerting: false,
};
ESXI_HOST_RECORDS.slice(0, 1); // (keeps ordering deterministic — no-op)
Object.keys(VCENTER_BY_DC).forEach((dc) => { integrationToggles[`vcenter:${VCENTER_BY_DC[dc]}`] = true; });

export function integrationsHealthPayload() {
  const defs = [
    { key: 'vantage', name: 'Vantage', category: 'Infrastructure', detail: 'Connected — API reachable, fleet data current.', latency_ms: 210 },
    { key: 'vantage_domain:SITE1', name: 'Vantage — SITE1 domain', category: 'Infrastructure', detail: 'SITE1 UCS domain visible and polling normally.', latency_ms: 180 },
    { key: 'vantage_domain:SITE2', name: 'Vantage — SITE2 domain', category: 'Infrastructure', detail: 'SITE2 UCS domain visible and polling normally.', latency_ms: 195 },
    { key: `vcenter:${VCENTER_BY_DC.SITE1}`, name: `vCenter — ${VCENTER_BY_DC.SITE1}`, category: 'Infrastructure', detail: 'Session valid, host/VM inventory syncing.', latency_ms: 260 },
    { key: `vcenter:${VCENTER_BY_DC.SITE2}`, name: `vCenter — ${VCENTER_BY_DC.SITE2}`, category: 'Infrastructure', detail: 'Session valid, host/VM inventory syncing.', latency_ms: 275 },
    { key: 'arialog', name: 'AriaOps for Logs', category: 'Logging', detail: 'Query API reachable, credentials valid.', latency_ms: 340 },
    { key: 'smtp', name: 'SMTP relay', category: 'Notifications', detail: 'Relay accepting mail for alert/report delivery.', latency_ms: 90 },
    { key: 'teams', name: 'Microsoft Teams webhook', category: 'Notifications', detail: 'Webhook URL configured and last post succeeded.', latency_ms: 150 },
    { key: 'ariaops_webhook', name: 'AriaOps inbound webhook', category: 'Notifications', detail: 'Listener healthy, last firing accepted.', latency_ms: 40 },
    { key: 'arialog_alerting', name: 'AriaOps for Logs alerting', category: 'Notifications', detail: 'Feature disabled pending rule redesign.', latency_ms: null },
  ];
  const integrations = defs.map((d) => {
    const enabled = integrationToggles[d.key] !== false;
    const status = !enabled ? 'disabled' : d.key === 'arialog_alerting' ? 'not_configured' : 'ok';
    return { ...d, status, enabled };
  });
  return { checked_at: new Date().toISOString(), integrations };
}

export function setIntegrationToggle(key, enabled) {
  integrationToggles[key] = enabled;
  return { key, enabled };
}

export const settingsStore = { teamsWebhookUrl: '', teamsWebhookOverridden: false };

// ---------------------------------------------------------------------------
// OpenShift licensing (vCPU entitlement tracking)
// ---------------------------------------------------------------------------

export function ocpVcpuSummaryPayload() {
  const ocpVms = VM_RECORDS.filter((v) => v.isOcp);
  const clusterMap = new Map();
  ocpVms.forEach((v) => {
    const env = v.cluster.includes('prd') ? 'prd' : v.cluster.includes('dev') ? 'dev' : 'test';
    const key = v.cluster;
    if (!clusterMap.has(key)) {
      clusterMap.set(key, { cluster: key, datacenter: v.datacenter, environment: env, total_vcpus: 0, total_workers: 0 });
    }
    const c = clusterMap.get(key);
    c.total_vcpus += v.vcpus;
    c.total_workers += 1;
  });
  const clusters = [...clusterMap.values()];
  const vms = ocpVms.map((v) => ({ name: v.vm_name, vcpus: v.vcpus, cluster: v.cluster, datacenter: v.datacenter }));
  const by_dc = {};
  clusters.forEach((c) => {
    const dc = by_dc[c.datacenter] = by_dc[c.datacenter] || { total_vcpus: 0, total_workers: 0, clusters: 0, envs: {} };
    dc.total_vcpus += c.total_vcpus;
    dc.total_workers += c.total_workers;
    dc.clusters += 1;
    dc.envs[c.environment] = dc.envs[c.environment] || { vcpus: 0, count: 0 };
    dc.envs[c.environment].vcpus += c.total_vcpus;
    dc.envs[c.environment].count += c.total_workers;
  });
  return {
    clusters, vms,
    summary: {
      total_vcpus: clusters.reduce((a, c) => a + c.total_vcpus, 0),
      total_workers: clusters.reduce((a, c) => a + c.total_workers, 0),
      total_clusters: clusters.length,
      by_dc,
      powered_off_excluded: VM_RECORDS.filter((v) => v.isOcp === false && v.power_state !== 'poweredOn').length,
      non_ocp_excluded: VM_RECORDS.filter((v) => !v.isOcp).length,
    },
    errors: null,
    source: 'live',
  };
}

export function ocpVcpuHistoryPayload(days = 30) {
  const summary = ocpVcpuSummaryPayload();
  const series = summary.clusters.map((c) => {
    const data = [];
    for (let d = days; d >= 0; d -= 1) {
      const jitter = Math.sin(d / 4) * 4 + (d % 3);
      data.push({
        ts: isoDaysAgo(d),
        total_vcpus: Math.max(8, Math.round(c.total_vcpus - jitter)),
        total_workers: c.total_workers,
      });
    }
    return { cluster: c.cluster, datacenter: c.datacenter, environment: c.environment, data };
  });
  return { series, days, total_snapshots: series.reduce((a, s) => a + s.data.length, 0) };
}

// ---------------------------------------------------------------------------
// Architecture topology (fabric-topology export + equipment health)
// ---------------------------------------------------------------------------

export function fabricTopologyPayload() {
  const domains = DOMAINS.map((domain) => {
    const domainFis = fabricInterconnects.filter((fi) => fi.domain_name === domain.name);
    const domainChassis = chassisList.filter((c) => c.name.startsWith(domain.name));
    return {
      name: `${domain.dc}-${domain.name.slice(-1) === '1' ? 'A' : 'A'}`,
      datacenter: domain.dc,
      fabric_interconnects: domainFis.map((fi) => ({
        id: fi.switch_id, model: fi.model, serial: fi.serial, name: fi.name,
        mgmt_ip: fi.out_of_band_ip_address, ethernet_mode: fi.ethernet_mode, fc_mode: fi.fc_mode,
        oper_evac_state: fi.oper_evac_state,
        ports: Array.from({ length: 8 }, (_, i) => ({
          slot: 1, port: i + 1, aggr: i < 4 ? 1 : null,
          role: i < 4 ? 'server' : i < 6 ? 'eth_uplink' : 'fc_uplink',
          speed: '25G', state: fi.oper_evac_state === 'disabled' && i !== 7 ? 'up' : 'down', admin_state: 'enabled',
        })),
      })),
      chassis: domainChassis.map((c) => {
        const chassisBlades = bladesList.filter((b) => b.chassis_moid === c.moid);
        return {
          chassis_id: Number(c.chassis_id), name: c.name, model: c.model, serial: c.serial,
          oper_state: c.oper_state, connection_status: c.connection_status,
          blade_count: chassisBlades.length, blades_powered_on: chassisBlades.filter((b) => b.oper_power_state === 'on').length,
          blades: chassisBlades.map((b) => ({ slot: Number(b.slot_id), name: b.name, model: b.model, power: b.oper_power_state })),
          ioms: [{ iom_id: 1, connected_fi: 'A' }, { iom_id: 2, connected_fi: 'B' }],
        };
      }),
      links: domainFis.flatMap((fi) => domainChassis.map((c) => ({
        fi: fi.switch_id, fi_slot: 1, fi_port: Number(c.chassis_id), fi_aggr: 1,
        role: 'server', speed: '25G', state: 'up', admin_state: 'enabled',
        chassis_id: Number(c.chassis_id), chassis_name: c.name,
        iom_id: fi.switch_id === 'A' ? 1 : 2, iom_slot: 1, iom_port: Number(c.chassis_id),
      }))),
    };
  });
  return { generated_at: new Date().toISOString(), unmatched_iom_ports: [], domains };
}

function mockAlarms(seedNonZero) {
  if (!seedNonZero) return { alarms: [], alarm_counts: { Critical: 0, Major: 0, Warning: 0, Info: 0 } };
  return {
    alarms: [{ severity: 'Warning', code: 'F1234', description: 'Elevated inlet temperature detected.', created: isoDaysAgo(1), affected_mo: 'sys/chassis-1', acknowledged: false }],
    alarm_counts: { Critical: 0, Major: 0, Warning: 1, Info: 0 },
  };
}

export function diagnosticsEquipmentPayload() {
  return {
    fis: fabricInterconnects.map((fi, i) => ({
      moid: fi.moid, name: fi.name, display_name: fi.display_name, model: fi.model, serial: fi.serial,
      domain_name: fi.domain_name, switch_id: fi.switch_id, out_of_band_ip_address: fi.out_of_band_ip_address,
      oper_evac_state: fi.oper_evac_state, total_ports: fi.total_ports, used_ports: fi.used_ports,
      ...mockAlarms(fi.oper_evac_state !== 'disabled'),
    })),
    chassis: chassisList.map((c, i) => ({
      moid: c.moid, name: c.name, display_name: c.name, model: c.model, serial: c.serial,
      domain_name: DOMAINS.find((d) => c.name.startsWith(d.name))?.name, chassis_id: c.chassis_id,
      connection_status: 'A,B', oper_state: c.oper_state, total_slots: c.total_slots, used_slots: c.used_slots,
      ...mockAlarms(false),
    })),
    appliance: {
      moid: hexId(), serial: 'WZP26150ABC', hostname: 'vantage-assist-01.example.com',
      connection_status: 'Connected', connection_status_changed: isoDaysAgo(45), connector_version: '1.0.9-2026',
      alarms: [], alarm_counts: { Critical: 0, Major: 0, Warning: 0, Info: 0 },
    },
    assist: null,
  };
}

// ---------------------------------------------------------------------------
// Serial / hardware lookup
// ---------------------------------------------------------------------------

export function serialLookupPayload(serialNumbers) {
  const decommissioned = decommissionedPayload().items;
  const spares = spareInventoryStore;
  const results = serialNumbers.map((query) => {
    const q = query.trim().toLowerCase();
    const matches = [];
    chassisList.forEach((c) => {
      if (c.serial.toLowerCase() === q || c.name.toLowerCase() === q) {
        matches.push({ type: 'Chassis', name: c.name, model: c.model, serial: c.serial, status: c.oper_state, location: DOMAINS.find((d) => c.name.startsWith(d.name))?.name, in_use: true });
      }
    });
    bladesList.forEach((b) => {
      if (b.serial.toLowerCase() === q || (b.assigned_server_profile || '').toLowerCase() === q || b.name.toLowerCase() === q) {
        matches.push({
          type: 'Blade Server', name: b.name, model: b.model, serial: b.serial,
          status: b.oper_power_state === 'on' ? 'Powered on' : 'Powered off', power: b.oper_power_state,
          location: `${b.chassis_name} slot ${b.slot_id}`, profile: b.assigned_server_profile, in_use: true,
        });
      }
    });
    fabricInterconnects.forEach((fi) => {
      if (fi.serial.toLowerCase() === q || fi.name.toLowerCase() === q) {
        matches.push({ type: 'Fabric Interconnect', name: fi.display_name, model: fi.model, serial: fi.serial, status: fi.oper_evac_state === 'disabled' ? 'Active' : 'Evacuating', location: fi.domain_name, in_use: true });
      }
    });
    ESXI_HOST_RECORDS.forEach((h) => {
      if (h.serial.toLowerCase() === q || h.host_name.toLowerCase().startsWith(q)) {
        matches.push({ type: 'ESXi Host', name: h.host_name, model: h.hw_model, serial: h.serial, status: h.connection_state === 'connected' ? 'Connected' : 'Unreachable', location: h.cluster, in_use: true, source: 'vCenter' });
      }
    });
    decommissioned.forEach((d) => {
      if ((d.serial || '').toLowerCase() === q || (d.name || '').toLowerCase() === q) {
        matches.push({ type: 'Blade Server', name: d.name, model: d.model, serial: d.serial, status: 'Decommissioned', location: d.chassis_name, in_use: false, source: 'Decommissioned', flag: d.flag, severity: d.severity });
      }
    });
    spares.forEach((s) => {
      if ((s.serial || '').toLowerCase() === q || s.model.toLowerCase() === q) {
        matches.push({ type: typeMetaLabel(s.type), name: s.model, model: s.model, serial: s.serial || null, status: `In stock (spare shelf) x${s.quantity}`, location: s.dc, in_use: false, source: 'Spare inventory', quantity: s.quantity, notes: s.notes });
      }
    });
    const first = matches[0];
    return {
      serial: query, query, found: matches.length > 0, matches,
      type: first?.type, name: first?.name, model: first?.model, status: first?.status,
    };
  });
  return {
    results,
    summary: {
      total_searched: results.length,
      found: results.filter((r) => r.found).length,
      not_found: results.filter((r) => !r.found).length,
    },
  };
}

function typeMetaLabel(type) {
  const map = {
    blade: 'Blade Server', chassis: 'Chassis', fi: 'Fabric Interconnect', dimm: 'DIMM',
    cpu: 'CPU', drive: 'Drive', nic: 'NIC', psu: 'Power Supply', other: 'Other',
  };
  return map[type] || 'Other';
}

// ---------------------------------------------------------------------------
// Host Diagnostics — alerts, collect, analyze, TAC bundle, history, usage
// ---------------------------------------------------------------------------

function findHostAlertContext(hostShort) {
  const blade = bladesList.find((b) => b.assigned_server_profile === hostShort);
  const vc = ESXI_HOST_RECORDS.find((h) => h.host_name.split('.')[0] === hostShort);
  return { blade, vc };
}

export function hostAlertsPayload(hostShort) {
  const { blade, vc } = findHostAlertContext(hostShort);
  const troubled = blade && blade.oper_state !== 'ok';
  return {
    host: hostShort,
    vantage: blade ? {
      blade: blade.name,
      alarms: troubled ? [{
        severity: 'Warning', code: 'F0181', description: 'Elevated temperature on CPU 2 — thermal margin below threshold.',
        created: isoDaysAgo(0.4), affected_mo: `sys/chassis-${blade.chassis_id}/blade-${blade.slot_id}`, acknowledged: false,
      }] : [],
    } : null,
    vantage_error: null,
    vcenter: vc ? {
      found: true,
      in_maintenance: !!vc.maintenance_mode,
      config_issues: vc.overall_status === 'yellow' ? ['Host hardware sensor alarm: power supply redundancy degraded'] : [],
      overall_status: vc.overall_status,
      alarms: vc.overall_status === 'red' ? [{
        name: 'Host connection failure', description: 'vCenter lost contact with this host.', status: 'red',
        time: isoMinutesAgo(20), acknowledged: false,
      }] : [],
    } : { found: false, in_maintenance: false, config_issues: [], overall_status: 'gray', alarms: [] },
    vcenter_error: null,
  };
}

function mockFaults(troubled) {
  if (!troubled) return [];
  return [{
    created: isoDaysAgo(0.4), severity: 'Warning', code: 'F0181',
    description: 'Elevated temperature on CPU 2 — thermal margin below threshold.',
    affected_mo: 'sys/chassis-3/blade-2',
  }];
}

export function collectDiagnosticsPayload({ host, hours = 24, sources = ['vantage', 'vcenter'] }) {
  const { blade, vc } = findHostAlertContext(host);
  const troubled = blade && blade.oper_state !== 'ok';
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - (hours || 24) * 3600 * 1000);
  const bundle = {
    mock: false,
    notice: 'Sample fleet — collected from the demo Vantage/vCenter fixtures, not a live device.',
    sel_live: false,
    sel_source: 'bundle',
    sel_error: null,
    host,
    sources,
    window_start: windowStart.toISOString(),
    window_end: windowEnd.toISOString(),
    host_online: !troubled,
    blade: blade ? {
      moid: blade.moid, name: blade.name, model: blade.model, serial: blade.serial,
      server_profile: blade.assigned_server_profile, mgmt_ip: blade.mgmt_ip,
      oper_state: blade.oper_state, oper_power_state: blade.oper_power_state,
    } : null,
    faults: sources.includes('vantage') ? mockFaults(troubled) : [],
    sel_entries: sources.includes('vantage') ? (troubled ? [
      { timestamp: isoDaysAgo(0.4), severity: 'Warning', description: 'CPU2 THERMAL MARGIN sensor: reading above upper non-critical threshold' },
      { timestamp: isoDaysAgo(0.39), severity: 'Critical', description: 'Host power off requested by policy (thermal protection)' },
    ] : [
      { timestamp: isoDaysAgo(2), severity: 'Info', description: 'BIOS POST completed normally' },
    ]) : [],
    tac_bundles: [],
    vcenter_error: sources.includes('vcenter') && !vc ? 'Host not found in configured vCenters' : null,
    vcenter_events: sources.includes('vcenter') ? (troubled ? [
      { timestamp: isoDaysAgo(0.39), event_type: 'com.vmware.vc.HardwareSensorGroupStatus', message: 'Host hardware sensor group status changed to red' },
      { timestamp: isoDaysAgo(0.39), event_type: 'esx.problem.hardware.cpu.thermal', message: 'CPU thermal condition detected' },
      { timestamp: isoDaysAgo(0.38), event_type: 'com.vmware.vc.HA.HostFailedEvent', message: 'vSphere HA detected a failure on the host' },
    ] : [
      { timestamp: isoDaysAgo(1), event_type: 'esx.audit.host.ntp.disabled', message: 'NTP service state check passed' },
    ]) : [],
    host_logs: sources.includes('vcenter') ? [{
      file: 'vmkernel.log', lines: 4,
      preview: troubled
        ? '2026-08-16T04:12:03Z cpu2:1000123)WARNING: Thermal throttling engaged on CPU package 1\n2026-08-16T04:12:41Z cpu2:1000123)ALERT: Emergency power-off triggered by thermal policy\n'
        : '2026-08-16T02:00:01Z cpu0:1000045)Vmkernel heartbeat nominal\n2026-08-16T02:00:01Z cpu0:1000045)No warnings in window\n',
    }] : [],
    host_logs_source: sources.includes('vcenter') ? 'vcenter' : null,
  };
  const record = saveDiagnosticsHistory({ host, kind: 'server', sources, bundle });
  bundle.history_id = record.id;
  return bundle;
}

const AI_MODEL_NAME = 'claude-sonnet-5';
let usageTotals = { analyses: 6, input_tokens: 298450, output_tokens: 24310, cost: 1.284, model: AI_MODEL_NAME };

function buildAnalysis(host, bundle) {
  const troubled = (bundle.faults || []).length > 0 || (bundle.sel_entries || []).some((e) => e.severity === 'Critical');
  const usage = { model: AI_MODEL_NAME, input_tokens: 24000 + Math.round(Math.random() * 8000), output_tokens: 3800 + Math.round(Math.random() * 1200), cost: 0.14 + Math.random() * 0.08, duration_secs: 28 + Math.random() * 20 };
  usageTotals = {
    analyses: usageTotals.analyses + 1,
    input_tokens: usageTotals.input_tokens + usage.input_tokens,
    output_tokens: usageTotals.output_tokens + usage.output_tokens,
    cost: Math.round((usageTotals.cost + usage.cost) * 1000) / 1000,
    model: AI_MODEL_NAME,
  };
  usage.cost = Math.round(usage.cost * 1000) / 1000;
  if (!troubled) {
    return {
      mock: false, host, tac_bundle_used: false, severity: 'Info', confidence: 'High', confidence_pct: 92,
      root_cause: 'No fault indicators found in the collected window — host is operating normally.',
      root_cause_label: 'No anomaly detected',
      summary: `Reviewed Vantage faults, SEL entries, and vCenter events for ${host} across the requested window. No hardware faults, thermal events, or HA-triggering conditions were present. All sensors report within nominal range and the host remained online throughout.`,
      key_findings: ['No Vantage faults in window', 'No Critical/Major SEL entries', 'vCenter reports host healthy and connected', 'No HA or vMotion events tied to this host'],
      impact: 'None — no service impact detected.',
      vm_downtime: '0',
      recovery: 'No action required.',
      alert_disposition: 'No issue found',
      incident_duration: 'n/a',
      references: [],
      evidence: [
        { timestamp: bundle.window_end, source: 'Vantage', title: 'No active faults', detail: 'Fault query returned zero entries for the selected window.', category: 'other', status: 'ok' },
        { timestamp: bundle.window_end, source: 'vcenter', title: 'Host overall status green', detail: 'vCenter reports the host connected with no triggered alarms.', category: 'vcenter', status: 'ok' },
      ],
      reasoning: ['Checked Vantage fault/SEL feed for the window — empty.', 'Cross-checked vCenter events — no hardware or HA events.', 'Concluded the host is healthy for this window.'],
      recommendations: [{ action: 'No action needed', note: 'Continue routine monitoring.', priority: 'P3', duration: 'n/a', risk: 'None' }],
      usage, usage_totals: usageTotals,
    };
  }
  return {
    mock: false, host, tac_bundle_used: false, severity: 'Critical', confidence: 'High', confidence_pct: 88,
    root_cause: 'A CPU thermal excursion tripped the platform\'s emergency thermal-protection policy, forcing the blade to power off and triggering an HA restart of its VMs elsewhere in the cluster.',
    root_cause_label: 'CPU thermal shutdown',
    summary: `${host} reported rising CPU package temperature that crossed the upper non-critical threshold, then a critical thermal event roughly 30 seconds later that triggered an automatic power-off per Cisco's thermal protection policy. vCenter observed the host disconnect and vSphere HA restarted the affected VMs on healthy hosts within the same cluster. No airflow or fan faults were logged, which points toward either a blocked front intake, a failed/degraded fan, or a rack-level cooling issue rather than a component defect.`,
    key_findings: [
      'CPU2 thermal margin sensor crossed upper non-critical threshold',
      'Critical SEL entry: emergency power-off triggered by thermal policy',
      'vCenter hardware sensor group status flipped to red immediately before disconnect',
      'vSphere HA restarted affected VMs on other cluster hosts within ~2 minutes',
      'No fan-fault or PSU-fault SEL entries recorded — points to airflow rather than a failed component',
    ],
    impact: 'Host powered off unexpectedly; VMs running on it were restarted by vSphere HA on other hosts.',
    vm_downtime: '2-4 min per VM (HA restart)',
    recovery: 'Host was powered back on after cooling; recommend a physical inspection of chassis airflow and fan health before returning it to full production load.',
    alert_disposition: 'Confirmed hardware/environmental event',
    incident_duration: '~35 minutes (thermal excursion to full recovery)',
    references: ['Cisco UCS Thermal Protection Policy documentation', 'CSCwm12345 — DIMM/thermal correctable-error advisory (informational, not confirmed cause)'],
    evidence: [
      { timestamp: isoDaysAgo(0.4), source: 'Vantage SEL', title: 'Thermal margin warning', detail: 'CPU2 THERMAL MARGIN sensor above upper non-critical threshold.', category: 'sensors', status: 'warning' },
      { timestamp: isoDaysAgo(0.39), source: 'Vantage SEL', title: 'Emergency power-off', detail: 'Host power off requested by policy (thermal protection).', category: 'cimc', status: 'critical' },
      { timestamp: isoDaysAgo(0.39), source: 'vcenter', title: 'Hardware sensor group status red', detail: 'com.vmware.vc.HardwareSensorGroupStatus event fired for the host.', category: 'vcenter', status: 'critical' },
      { timestamp: isoDaysAgo(0.38), source: 'vcenter', title: 'HA restart triggered', detail: 'vSphere HA detected a host failure and restarted affected VMs.', category: 'vcenter', status: 'warning' },
      { timestamp: isoDaysAgo(0.4), source: 'vmkernel.log', title: 'Thermal throttling engaged', detail: 'vmkernel logged thermal throttling on CPU package 1 shortly before shutdown.', category: 'vmkernel', status: 'warning' },
    ],
    reasoning: [
      'Vantage SEL shows a thermal warning followed within a minute by a critical thermal-triggered power-off.',
      'vCenter events corroborate the timeline: hardware sensor alarm, then host disconnect, then HA restart.',
      'No PSU or fan-specific fault codes were present, which argues against a straightforward component failure.',
      'Given the timing and lack of a component fault code, environmental/airflow causes are the leading explanation.',
    ],
    recommendations: [
      { action: 'Physically inspect chassis airflow and fan trays', note: 'Check for blocked intake, dust buildup, or a fan running below expected RPM.', priority: 'P1', duration: '30 min', risk: 'Low' },
      { action: 'Review rack-level cooling for the affected row', note: 'Confirm hot-aisle/cold-aisle containment is intact and CRAC units are within spec.', priority: 'P2', duration: '1 hr', risk: 'None' },
      { action: 'Re-run diagnostics after 24 hours of normal load', note: 'Confirm the thermal margin sensor stays within range under production load.', priority: 'P3', duration: 'n/a', risk: 'None' },
    ],
    usage, usage_totals: usageTotals,
  };
}

export function analyzeDiagnosticsPayload({ host, bundle }) {
  const analysis = buildAnalysis(host, bundle);
  updateDiagnosticsHistoryAnalysis(bundle.history_id, analysis);
  return analysis;
}

export function findEquipmentDevice(kind, moid) {
  if (kind === 'chassis') return chassisList.find((c) => c.moid === moid);
  return fabricInterconnects.find((fi) => fi.moid === moid);
}

export function collectEquipmentPayload({ kind, moid, hours = 24 }) {
  const device = findEquipmentDevice(kind, moid);
  const name = device ? (device.display_name || device.name) : 'unknown-device';
  const troubled = kind === 'fi' && device && device.oper_evac_state !== 'disabled';
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - (hours || 24) * 3600 * 1000);
  const bundle = {
    host: name, kind, moid, sources: ['vantage'],
    window_start: windowStart.toISOString(), window_end: windowEnd.toISOString(),
    tac_bundles: [],
    device: device ? {
      name: device.name, display_name: device.display_name || device.name, model: device.model, serial: device.serial,
      domain_name: device.domain_name, switch_id: device.switch_id, chassis_id: device.chassis_id,
      oper_state: device.oper_state, connection_status: device.connection_status,
      ethernet_mode: device.ethernet_mode, fc_mode: device.fc_mode, out_of_band_ip_address: device.out_of_band_ip_address,
    } : {},
    faults: troubled ? [{ created: isoDaysAgo(0.1), severity: 'Warning', code: 'F0522', description: 'Fabric interconnect evacuation in progress — traffic draining to peer.', affected_mo: `sys/switch-${device.switch_id}` }] : [],
    sel_entries: [], vcenter_events: [], host_logs: [],
  };
  const record = saveDiagnosticsHistory({ host: name, kind, sources: ['vantage'], bundle });
  bundle.history_id = record.id;
  return bundle;
}

export function analyzeEquipmentPayload({ bundle }) {
  const analysis = buildAnalysis(bundle.host, bundle);
  analysis.severity = bundle.faults?.length ? 'Warning' : 'Info';
  updateDiagnosticsHistoryAnalysis(bundle.history_id, analysis);
  return analysis;
}

export function diagnosticsUsagePayload() {
  return { ...usageTotals, configured: true };
}

// TAC tech-support bundle status simulator: Pending -> Running -> Completed
// over ~30s of wall-clock time so the page's 10s poll loop has something to
// show, without making anyone wait for a real device collection.
const tacJobs = new Map();
export function createTechsupportJob({ serial, host }) {
  const statusMoid = hexId();
  tacJobs.set(statusMoid, { startedAt: Date.now(), serial, host });
  return { bundle_moid: hexId(), status_moid: statusMoid, host, blade_name: host, serial };
}
export function createEquipmentTechsupportJob({ serial, host }) {
  const statusMoid = hexId();
  tacJobs.set(statusMoid, { startedAt: Date.now(), serial, host });
  return { bundle_moid: hexId(), status_moid: statusMoid, host, serial };
}
export function techsupportStatusPayload(statusMoid) {
  const job = tacJobs.get(statusMoid);
  const elapsed = job ? Date.now() - job.startedAt : 999999;
  let status = 'Pending';
  if (elapsed > 20000) status = 'Completed';
  else if (elapsed > 8000) status = 'Running';
  return {
    status_moid: statusMoid, status, reason: '',
    file_name: status === 'Completed' ? `techsupport_${(job?.serial || 'device').toLowerCase()}.tar.gz` : null,
    file_size: status === 'Completed' ? 48318925 : 0,
    download_ready: status === 'Completed',
  };
}

// Diagnostics history — mutable
export const diagnosticsHistoryStore = [];
export function saveDiagnosticsHistory({ host, kind, sources, bundle }) {
  const record = {
    id: uid('diag-'), host, kind, sources, collected_at: new Date().toISOString(),
    window_start: bundle.window_start, window_end: bundle.window_end,
    bundle, analysis: null, analyzed: false, analyzed_at: null, severity: null, root_cause: null, usage: null,
  };
  diagnosticsHistoryStore.unshift(record);
  return record;
}
export function updateDiagnosticsHistoryAnalysis(id, analysis) {
  const record = diagnosticsHistoryStore.find((r) => r.id === id);
  if (!record) return;
  record.analysis = analysis;
  record.analyzed = true;
  record.analyzed_at = new Date().toISOString();
  record.severity = analysis.severity;
  record.root_cause = analysis.root_cause;
  record.usage = analysis.usage;
}
export function diagnosticsHistoryListPayload() {
  return diagnosticsHistoryStore.map((r) => ({
    id: r.id, host: r.host, kind: r.kind, sources: r.sources, collected_at: r.collected_at,
    window_start: r.window_start, window_end: r.window_end, analyzed: r.analyzed, analyzed_at: r.analyzed_at,
    severity: r.severity, root_cause: r.root_cause, usage: r.usage,
  }));
}
export function diagnosticsHistoryRecordPayload(id) {
  return diagnosticsHistoryStore.find((r) => r.id === id) || null;
}
export function deleteDiagnosticsHistoryRecord(id) {
  const idx = diagnosticsHistoryStore.findIndex((r) => r.id === id);
  if (idx >= 0) diagnosticsHistoryStore.splice(idx, 1);
  return { deleted: id };
}

// Seed a couple of past diagnostics runs so the "Past Analyses" timeline
// isn't empty on first load.
(function seedDiagnosticsHistory() {
  const healthyHost = ESXI_HOST_RECORDS[0]?.host_name.split('.')[0];
  const troubledBlade = bladesList.find((b) => b.oper_state !== 'ok');
  if (healthyHost) {
    const bundle = collectDiagnosticsPayload({ host: healthyHost, hours: 24, sources: ['vantage', 'vcenter'] });
    analyzeDiagnosticsPayload({ host: healthyHost, bundle });
  }
  if (troubledBlade) {
    const bundle = collectDiagnosticsPayload({ host: troubledBlade.assigned_server_profile, hours: 24, sources: ['vantage', 'vcenter'] });
    analyzeDiagnosticsPayload({ host: troubledBlade.assigned_server_profile, bundle });
  }
})();

// ---------------------------------------------------------------------------
// VM Crash Report + AriaOps webhook history
// ---------------------------------------------------------------------------

export function hostCrashReportPayload(host) {
  const { blade } = findHostAlertContext(host);
  const troubled = blade && blade.oper_state !== 'ok';
  const hostVms = VM_RECORDS.filter((v) => v.current_host?.startsWith(host)).slice(0, 6);
  const pool = hostVms.length ? hostVms : VM_RECORDS.slice(0, 4);
  const vms = pool.map((v, i) => {
    const status = troubled ? (i < 2 ? 'CRASHED' : i < 4 ? 'VMOTION' : 'POWERED_OFF') : (i === 0 ? 'VMOTION' : 'POWERED_OFF');
    return {
      name: v.vm_name, status,
      boot_time: status === 'CRASHED' ? isoMinutesAgo(15) : v.boot_time,
      current_host: status === 'VMOTION' ? `esx-${host.includes('site2') ? 'site2' : 'site1'}-${(i % 9) + 1}` : (status === 'CRASHED' ? null : host),
      last_event: status === 'CRASHED' ? 'vim.event.DasVmPoweredOnEvent' : status === 'VMOTION' ? 'vim.event.VmMigratedEvent' : 'vim.event.VmPoweredOffEvent',
    };
  });
  return {
    total: vms.length,
    crashed_count: vms.filter((v) => v.status === 'CRASHED').length,
    vmotion_count: vms.filter((v) => v.status === 'VMOTION').length,
    off_count: vms.filter((v) => v.status === 'POWERED_OFF').length,
    host, host_online: !troubled, vms,
  };
}

export const webhookHistoryStore = [];
(function seedWebhookHistory() {
  const troubledBlade = bladesList.find((b) => b.oper_state !== 'ok');
  const host = troubledBlade ? troubledBlade.assigned_server_profile : 'esx-site1-01';
  const report = hostCrashReportPayload(host);
  const alertTime = isoDaysAgo(0.4);
  webhookHistoryStore.push({
    id: uid('wh-'), received_at: isoDaysAgo(0.39), host: `${host}.example.com`,
    alert_name: 'ESXi Host Down', criticality: 'critical', alert_id: uid('alert-'), alert_time: alertTime,
    status: 'complete', backfilled: false, email_sent: true, teams_sent: true, error: null,
    report: {
      host: `${host}.example.com`, host_online: report.host_online,
      alert_time: new Date(alertTime).toUTCString(),
      window_start: new Date(new Date(alertTime).getTime() - 30 * 60000).toUTCString(),
      window_end: new Date(new Date(alertTime).getTime() + 30 * 60000).toUTCString(),
      total: report.total,
      crashed_count: report.crashed_count, evacuated_count: report.vmotion_count, off_count: report.off_count,
      vms: report.vms.map((v) => ({
        name: v.name, status: v.status === 'VMOTION' ? 'EVACUATED' : v.status,
        current_host: v.current_host, boot_time: v.boot_time ? new Date(v.boot_time).toUTCString() : null,
        events: [v.last_event.replace('vim.event.', '')],
      })),
      host_events: [
        { time: new Date(alertTime).toLocaleTimeString('en-US'), event: 'HostDisconnectedEvent', message: `${host} disconnected from vCenter.` },
        { time: new Date(new Date(alertTime).getTime() + 60000).toLocaleTimeString('en-US'), event: 'HostConnectionLostEvent', message: 'Management connection lost — investigating.' },
      ],
    },
  });
})();
export function webhookHistoryListPayload() {
  return webhookHistoryStore.map((r) => ({
    id: r.id, received_at: r.received_at, host: r.host, alert_name: r.alert_name, criticality: r.criticality,
    alert_time: r.alert_time, status: r.status, error: r.error, email_sent: r.email_sent, teams_sent: r.teams_sent,
    total: r.report?.total ?? 0, crashed_count: r.report?.crashed_count ?? 0, evacuated_count: r.report?.evacuated_count ?? 0,
    off_count: r.report?.off_count ?? 0, host_online: r.report?.host_online ?? null,
  }));
}
export function webhookHistoryRecordPayload(id) {
  return webhookHistoryStore.find((r) => r.id === id) || null;
}
export function deleteWebhookHistoryRecord(id) {
  const idx = webhookHistoryStore.findIndex((r) => r.id === id);
  if (idx >= 0) webhookHistoryStore.splice(idx, 1);
  return { deleted: id };
}

export { chassisList, bladesList, fabricInterconnects, networkSwitches, serverProfiles, DOMAINS, hexId, uid, isoMinutesAgo, isoDaysAgo, isoDateDaysAgo, pick };
