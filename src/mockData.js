// ─── Generic placeholder data for the Infrastructure Dashboard ───
// All data here is fictional and for demonstration purposes only.

// ─── Dashboard Data ──────────────────────────────────────────────

const DOMAINS = ['dc1-prod', 'dc1-nonprod', 'dc2-prod', 'dc2-nonprod'];

function generateChassis() {
  const chassis = [];
  let id = 1;
  DOMAINS.forEach((domain) => {
    const count = domain.includes('prod') && !domain.includes('non') ? 4 : 2;
    for (let i = 1; i <= count; i++) {
      const slotCount = 8;
      const occupiedSlots = Math.floor(Math.random() * 4) + 4; // 4-8
      const blades = [];
      for (let s = 1; s <= occupiedSlots; s++) {
        blades.push({
          moid: `blade-${id}-${s}`,
          name: `${domain}-blade-${i}-${s}`,
          slot_id: s,
          model: s % 2 === 0 ? 'UCSB-B200-M6' : 'UCSB-B200-M5',
          serial: `SN${String(id * 100 + s).padStart(8, '0')}`,
          num_cpus: 2,
          num_cpu_cores: s % 2 === 0 ? 40 : 28,
          total_memory: s % 2 === 0 ? 512 : 256,
          chassis_id: `chassis-${id}`,
          chassis_name: `${domain}-ucs-${i}`,
          domain_name: domain,
          assigned_profile: s <= occupiedSlots - 1 ? `profile-${domain}-${i}-${s}` : null,
          oper_state: 'OK',
          admin_state: 'InService',
        });
      }
      chassis.push({
        moid: `chassis-${id}`,
        name: `${domain}-ucs-${i}`,
        model: 'UCSB-5108-AC2',
        serial: `CH${String(id).padStart(8, '0')}`,
        slot_count: slotCount,
        blades,
        domain_name: domain,
        oper_state: 'OK',
      });
      id++;
    }
  });
  return chassis;
}

function generateFabricInterconnects() {
  const fis = [];
  let id = 1;
  DOMAINS.forEach((domain) => {
    ['A', 'B'].forEach((side) => {
      fis.push({
        moid: `fi-${id}`,
        name: `${domain}-fi-${side}`,
        model: 'UCS-FI-6454',
        serial: `FI${String(id).padStart(8, '0')}`,
        domain_name: domain,
        switch_id: side,
        ethernet_mode: 'end-host',
        fc_mode: 'end-host',
        oob_ip: `10.${10 + id}.1.${side === 'A' ? 1 : 2}`,
        oper_state: 'OK',
        firmware: '4.2(3e)',
        total_ports: 54,
        used_ports: Math.floor(Math.random() * 20) + 20,
      });
      id++;
    });
  });
  return fis;
}

function generateNetworkSwitches() {
  const switches = [];
  let id = 1;
  ['dc1-san', 'dc2-san'].forEach((domain) => {
    ['A', 'B'].forEach((side) => {
      switches.push({
        moid: `switch-${id}`,
        name: `${domain}-mds-${side}`,
        display_name: `${domain}-mds-${side}`,
        model: 'DS-C9148T-24P-K9',
        serial: `SW${String(id).padStart(8, '0')}`,
        domain_name: domain,
        fc_mode: 'switch',
        oob_ip: `10.20.${id}.1`,
        oper_state: 'OK',
      });
      id++;
    });
  });
  return switches;
}

function generateServerProfiles(chassis) {
  const profiles = [];
  let id = 1;
  chassis.forEach((ch) => {
    ch.blades.forEach((blade) => {
      if (blade.assigned_profile) {
        profiles.push({
          moid: `profile-${id}`,
          name: blade.assigned_profile,
          description: `Server profile for ${blade.name}`,
          assigned_server: { moid: blade.moid },
          config_context: { config_state: Math.random() > 0.1 ? 'Applied' : 'Applying' },
          target_platform: 'FIAttached',
          create_time: new Date(2024, Math.floor(Math.random() * 6), Math.floor(Math.random() * 28) + 1).toISOString(),
        });
        id++;
      }
    });
  });
  // Add some unassigned profiles
  for (let i = 0; i < 3; i++) {
    profiles.push({
      moid: `profile-unassigned-${i}`,
      name: `template-profile-${i + 1}`,
      description: 'Unassigned server profile template',
      assigned_server: null,
      config_context: { config_state: 'N/A' },
      target_platform: 'FIAttached',
      create_time: new Date(2024, 0, 15).toISOString(),
    });
  }
  return profiles;
}

const chassisData = generateChassis();
const bladesData = chassisData.flatMap((ch) => ch.blades);
const fisData = generateFabricInterconnects();
const switchesData = generateNetworkSwitches();
const profilesData = generateServerProfiles(chassisData);

function generateSummary() {
  const totalBlades = bladesData.length;
  const assignedBlades = bladesData.filter((b) => b.assigned_profile).length;
  return {
    total_chassis: chassisData.length,
    total_blades: totalBlades,
    assigned_blades: assignedBlades,
    unassigned_blades: totalBlades - assignedBlades,
    total_fis: fisData.length,
    total_profiles: profilesData.length,
    assigned_profiles: profilesData.filter((p) => p.assigned_server).length,
    unassigned_profiles: profilesData.filter((p) => !p.assigned_server).length,
    domains: DOMAINS,
    gen_breakdown: {
      'dc1-prod': { M5: 8, M6: 8 },
      'dc1-nonprod': { M5: 4, M6: 4 },
      'dc2-prod': { M5: 8, M6: 8 },
      'dc2-nonprod': { M5: 4, M6: 4 },
    },
  };
}

export const dashboardData = {
  summary: generateSummary(),
  chassis: chassisData,
  blades: bladesData,
  fabric_interconnects: fisData,
  network_switches: switchesData,
  profiles: profilesData,
};

// ─── Domain Widgets Data ─────────────────────────────────────────

export const domainWidgetsData = DOMAINS.map((domain) => {
  const domainChassis = chassisData.filter((c) => c.domain_name === domain);
  const domainBlades = bladesData.filter((b) => b.domain_name === domain);
  const totalSlots = domainChassis.reduce((sum, c) => sum + c.slot_count, 0);
  const usedSlots = domainBlades.length;
  const emptySlots = totalSlots - usedSlots;
  const unusedBlades = domainBlades.filter((b) => !b.assigned_profile).length;
  const domainFIs = fisData.filter((fi) => fi.domain_name === domain);

  return {
    domain_name: domain,
    chassis_count: domainChassis.length,
    empty_slots: emptySlots,
    unused_blades: unusedBlades,
    fi_count: domainFIs.length,
    total_ports: domainFIs.reduce((sum, fi) => sum + fi.total_ports, 0),
    used_ports: domainFIs.reduce((sum, fi) => sum + fi.used_ports, 0),
    chassis: domainChassis.map((c) => ({
      name: c.name,
      empty_slots: c.slot_count - c.blades.length,
      unused_blades: c.blades.filter((b) => !b.assigned_profile),
    })),
  };
});

// ─── Host Inventory Data ─────────────────────────────────────────

const DCS = ['DC-East', 'DC-West'];
const CLUSTERS_MAP = {
  'DC-East': ['prod-cluster-01', 'prod-cluster-02', 'dev-cluster-01'],
  'DC-West': ['prod-cluster-01', 'dr-cluster-01'],
};

function generateHostInventory() {
  const hosts = [];
  let id = 1;
  DCS.forEach((dc) => {
    CLUSTERS_MAP[dc].forEach((cluster) => {
      const hostCount = Math.floor(Math.random() * 6) + 4;
      for (let i = 1; i <= hostCount; i++) {
        const firstSeen = new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
        hosts.push({
          host_name: `esxi-${dc.toLowerCase().replace('-', '')}-${cluster.split('-')[0]}-${String(i).padStart(2, '0')}`,
          datacenter: dc,
          cluster,
          cpu_count: [28, 40, 56, 64][Math.floor(Math.random() * 4)],
          first_seen: firstSeen.toISOString(),
          last_seen: new Date().toISOString(),
          removed: i === hostCount && Math.random() > 0.7,
        });
        id++;
      }
    });
  });
  return hosts;
}

const hostInventoryHosts = generateHostInventory();

export const hostInventoryData = {
  hosts: hostInventoryHosts,
  total: hostInventoryHosts.length,
  last_sync: new Date().toISOString(),
};

// ─── Capacity Planning Data ──────────────────────────────────────

function generateCapacityData() {
  const clusters = [];
  const allHosts = [];
  const allVMs = [];
  const topCpuVms = [];
  const topMemVms = [];
  const topCpuHosts = [];
  const topMemHosts = [];
  const dsClusters = [];
  let hostId = 1;
  let vmId = 1;

  DCS.forEach((dc) => {
    CLUSTERS_MAP[dc].forEach((clusterName) => {
      const numHosts = Math.floor(Math.random() * 6) + 4;
      const cpuPct = Math.floor(Math.random() * 60) + 20;
      const memPct = Math.floor(Math.random() * 60) + 25;
      const totalCpuMhz = numHosts * 48000;
      const usedCpuMhz = Math.floor(totalCpuMhz * cpuPct / 100);
      const totalMemGb = numHosts * 512;
      const usedMemGb = Math.floor(totalMemGb * memPct / 100);

      clusters.push({
        name: clusterName,
        datacenter: dc,
        cpu_pct: cpuPct,
        memory_pct: memPct,
        num_hosts: numHosts,
        num_effective_hosts: numHosts,
        total_cpu_mhz: totalCpuMhz,
        used_cpu_mhz: usedCpuMhz,
        total_memory_gb: totalMemGb,
        used_memory_gb: usedMemGb,
        total_cores: numHosts * 40,
      });

      for (let h = 1; h <= numHosts; h++) {
        const hCpuPct = Math.floor(Math.random() * 70) + 15;
        const hMemPct = Math.floor(Math.random() * 70) + 20;
        const hCpuCap = 48000;
        const hMemTotal = 524288;
        allHosts.push({
          host_name: `esxi-${dc.toLowerCase().replace('-', '')}-${clusterName.split('-')[0]}-${String(h).padStart(2, '0')}`,
          datacenter: dc,
          cluster: clusterName,
          cpu_pct: hCpuPct,
          memory_pct: hMemPct,
          cpu_usage_mhz: Math.floor(hCpuCap * hCpuPct / 100),
          cpu_capacity_mhz: hCpuCap,
          memory_usage_mb: Math.floor(hMemTotal * hMemPct / 100),
          memory_total_mb: hMemTotal,
        });
        hostId++;
      }

      const numVMs = Math.floor(Math.random() * 15) + 10;
      for (let v = 1; v <= numVMs; v++) {
        const vCpuCap = [2000, 4000, 8000, 16000][Math.floor(Math.random() * 4)];
        const vMemMb = [2048, 4096, 8192, 16384, 32768][Math.floor(Math.random() * 5)];
        const vCpuPct = Math.floor(Math.random() * 90) + 5;
        const vMemPct = Math.floor(Math.random() * 90) + 10;
        allVMs.push({
          vm_name: `vm-${dc.toLowerCase().replace('-', '')}-${clusterName.split('-')[0]}-${String(v).padStart(3, '0')}`,
          datacenter: dc,
          num_cpu: [2, 4, 8, 16][Math.floor(Math.random() * 4)],
          cpu_usage_mhz: Math.floor(vCpuCap * vCpuPct / 100),
          cpu_capacity_mhz: vCpuCap,
          memory_usage_mb: Math.floor(vMemMb * vMemPct / 100),
          memory_mb: vMemMb,
        });
        vmId++;
      }
    });

    // Datastore clusters
    ['ds-cluster-prod', 'ds-cluster-backup'].forEach((dsName, idx) => {
      const capGb = (idx === 0 ? 50 : 30) * 1024;
      const usedPct = Math.floor(Math.random() * 40) + 40;
      const usedGb = Math.floor(capGb * usedPct / 100);
      dsClusters.push({
        name: `${dc}-${dsName}`,
        datacenter: dc,
        capacity_gb: capGb,
        used_gb: usedGb,
        free_gb: capGb - usedGb,
        used_pct: usedPct,
      });
    });
  });

  // Generate time series samples
  const now = new Date();
  const generateSamples = (basePct, count = 48) => {
    const samples = [];
    for (let i = count; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 30 * 60 * 1000);
      const noise = (Math.random() - 0.5) * 10;
      samples.push({
        t: t.toISOString(),
        v: Math.max(0, Math.min(100, Math.round(basePct + noise))),
      });
    }
    return samples;
  };

  const clusterCpuSeries = clusters.slice(0, 10).map((c) => ({
    name: c.name,
    current_pct: c.cpu_pct,
    avg_pct: c.cpu_pct,
    samples: generateSamples(c.cpu_pct),
  }));

  const clusterMemSeries = clusters.slice(0, 10).map((c) => ({
    name: c.name,
    current_pct: c.memory_pct,
    avg_pct: c.memory_pct,
    samples: generateSamples(c.memory_pct),
  }));

  const sortedHostsCpu = [...allHosts].sort((a, b) => b.cpu_pct - a.cpu_pct);
  const sortedHostsMem = [...allHosts].sort((a, b) => b.memory_pct - a.memory_pct);
  const sortedVmsCpu = [...allVMs].sort((a, b) => (b.cpu_usage_mhz / b.cpu_capacity_mhz) - (a.cpu_usage_mhz / a.cpu_capacity_mhz));
  const sortedVmsMem = [...allVMs].sort((a, b) => (b.memory_usage_mb / b.memory_mb) - (a.memory_usage_mb / a.memory_mb));

  const hostCpuSeries = sortedHostsCpu.slice(0, 10).map((h) => ({
    name: h.host_name,
    current_pct: h.cpu_pct,
    avg_pct: h.cpu_pct,
    samples: generateSamples(h.cpu_pct),
  }));
  const hostMemSeries = sortedHostsMem.slice(0, 10).map((h) => ({
    name: h.host_name,
    current_pct: h.memory_pct,
    avg_pct: h.memory_pct,
    samples: generateSamples(h.memory_pct),
  }));
  const vmCpuSeries = sortedVmsCpu.slice(0, 10).map((v) => ({
    name: v.vm_name,
    vm_name: v.vm_name,
    current_pct: Math.round((v.cpu_usage_mhz / v.cpu_capacity_mhz) * 100),
    avg_pct: Math.round((v.cpu_usage_mhz / v.cpu_capacity_mhz) * 100),
    samples: generateSamples(Math.round((v.cpu_usage_mhz / v.cpu_capacity_mhz) * 100)),
  }));
  const vmMemSeries = sortedVmsMem.slice(0, 10).map((v) => ({
    name: v.vm_name,
    vm_name: v.vm_name,
    current_pct: Math.round((v.memory_usage_mb / v.memory_mb) * 100),
    avg_pct: Math.round((v.memory_usage_mb / v.memory_mb) * 100),
    samples: generateSamples(Math.round((v.memory_usage_mb / v.memory_mb) * 100)),
  }));

  // CPU Ready / Co-Stop series
  const cpuReadySeries = sortedVmsCpu.slice(0, 10).map((v) => ({
    name: v.vm_name,
    vm_name: v.vm_name,
    current_pct: +(Math.random() * 8).toFixed(1),
    avg_pct: +(Math.random() * 6).toFixed(1),
    samples: generateSamples(Math.random() * 5, 48),
  }));

  const costopSeries = sortedVmsCpu.slice(0, 10).map((v) => ({
    name: v.vm_name,
    vm_name: v.vm_name,
    current_pct: +(Math.random() * 4).toFixed(1),
    avg_pct: +(Math.random() * 3).toFixed(1),
    samples: generateSamples(Math.random() * 3, 48),
  }));

  const dsClusterSeries = dsClusters.map((ds) => ({
    name: ds.name,
    current_pct: ds.used_pct,
    avg_pct: ds.used_pct,
    samples: generateSamples(ds.used_pct),
  }));

  return {
    summary: {
      total_hosts: allHosts.length,
      total_vms: allVMs.length,
      datacenters: DCS,
    },
    clusters,
    all_hosts: allHosts,
    all_vms: allVMs,
    top_cpu_vms: sortedVmsCpu.slice(0, 25),
    top_mem_vms: sortedVmsMem.slice(0, 25),
    top_cpu_hosts: sortedHostsCpu.slice(0, 25),
    top_mem_hosts: sortedHostsMem.slice(0, 25),
    ds_clusters: dsClusters,
    cluster_cpu_series: clusterCpuSeries,
    cluster_mem_series: clusterMemSeries,
    host_cpu_series: hostCpuSeries,
    host_mem_series: hostMemSeries,
    vm_cpu_series: vmCpuSeries,
    vm_mem_series: vmMemSeries,
    cpu_ready_series: cpuReadySeries,
    costop_series: costopSeries,
    ds_cluster_series: dsClusterSeries,
  };
}

export const capacityData = generateCapacityData();

// ─── ESXi Build Version Data ─────────────────────────────────────

function generateEsxiHostData() {
  const clustersList = [];
  DCS.forEach((dc) => {
    CLUSTERS_MAP[dc].forEach((cluster) => {
      const version = Math.random() > 0.3 ? '8.0.2' : '7.0.3';
      const build = version === '8.0.2' ? '22380479' : '21424296';
      clustersList.push({
        cluster,
        datacenter: dc,
        version,
        build,
        host_count: Math.floor(Math.random() * 8) + 4,
      });
    });
  });
  return {
    summary: {
      total_hosts: clustersList.reduce((s, c) => s + c.host_count, 0),
      total_clusters: clustersList.length,
      datacenters: DCS,
    },
    clusters: clustersList,
  };
}

export const esxiHostData = generateEsxiHostData();

// ─── VMware Tools Data ───────────────────────────────────────────

function generateVMData() {
  const vms = [];
  const osList = [
    'Microsoft Windows Server 2022 (64-bit)',
    'Microsoft Windows Server 2019 (64-bit)',
    'Red Hat Enterprise Linux 8 (64-bit)',
    'Red Hat Enterprise Linux 9 (64-bit)',
    'Ubuntu Linux (64-bit)',
    'CentOS 7 (64-bit)',
    'Other Linux (64-bit)',
  ];
  const toolsVersions = ['12352', '12340', '12288', '11365', '11333', '0'];
  let id = 1;

  DCS.forEach((dc) => {
    const vmCount = Math.floor(Math.random() * 40) + 30;
    for (let i = 0; i < vmCount; i++) {
      vms.push({
        vm_name: `vm-${dc.toLowerCase().replace('-', '')}-${String(id).padStart(4, '0')}`,
        datacenter: dc,
        os: osList[Math.floor(Math.random() * osList.length)],
        tools_version: toolsVersions[Math.floor(Math.random() * toolsVersions.length)],
      });
      id++;
    }
  });
  return {
    summary: {
      total_vms: vms.length,
      datacenters: DCS,
    },
    vms,
  };
}

export const vmToolsData = generateVMData();

// ─── TPM Keys Data ───────────────────────────────────────────────

function generateTpmKeysData() {
  const tpmKeys = [];
  const groups = ['prod-hosts', 'dev-hosts', 'dr-hosts'];
  let id = 1;

  groups.forEach((group) => {
    const count = Math.floor(Math.random() * 10) + 8;
    for (let i = 1; i <= count; i++) {
      const hasTpm = Math.random() > 0.15;
      const enabled = hasTpm && Math.random() > 0.2;
      const hasKey = enabled && Math.random() > 0.1;
      tpmKeys.push({
        hostname: `esxi-${group.split('-')[0]}-${String(id).padStart(2, '0')}`,
        group,
        model: 'UCSC-C220-M5SX',
        tpm_present: hasTpm,
        tpm_enabled: hasTpm ? enabled : null,
        recovery_key: hasKey ? `${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}` : null,
        collected_at: hasKey ? new Date(2024, Math.floor(Math.random() * 6), Math.floor(Math.random() * 28) + 1).toISOString() : null,
      });
      id++;
    }
  });

  return {
    tpm_keys: tpmKeys,
    total: tpmKeys.length,
    last_import: new Date(2024, 5, 15).toISOString(),
    missing_count: 0,
    missing_hosts: [],
  };
}

export const tpmKeysData = generateTpmKeysData();

// ─── Serial Lookup Data ──────────────────────────────────────────

export function lookupSerials(serials) {
  const results = [];
  const allDevices = [
    ...chassisData.map((c) => ({ type: 'Chassis', name: c.name, serial: c.serial, model: c.model, domain: c.domain_name })),
    ...bladesData.map((b) => ({ type: 'Blade', name: b.name, serial: b.serial, model: b.model, domain: b.domain_name })),
    ...fisData.map((fi) => ({ type: 'Fabric Interconnect', name: fi.name, serial: fi.serial, model: fi.model, domain: fi.domain_name })),
    ...switchesData.map((sw) => ({ type: 'Network Switch', name: sw.name, serial: sw.serial, model: sw.model, domain: sw.domain_name })),
  ];

  serials.forEach((serial) => {
    const found = allDevices.find((d) => d.serial.toLowerCase() === serial.toLowerCase());
    if (found) {
      results.push({ serial, ...found, status: 'Found' });
    } else {
      results.push({ serial, type: '—', name: '—', model: '—', domain: '—', status: 'Not Found' });
    }
  });
  return results;
}
