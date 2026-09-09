import {
  bladesList, fabricInterconnects, cimcHostsPayload, esxiHostListPayload, decommissionedPayload,
} from './mockData';

/**
 * Build the merged device index used by the global search bar and the
 * device detail card: Vantage blades enriched with CIMC + vCenter info,
 * vCenter-only hosts, and fabric interconnects. Built entirely from the
 * static mock fleet — no network round trip needed for a static demo.
 */
export async function loadDeviceIndex() {
  const blades = bladesList;
  const cimcByMoid = new Map((cimcHostsPayload().hosts || []).map(h => [h.moid, h]));
  const vcHosts = esxiHostListPayload().hosts || [];
  const vcByShort = new Map(vcHosts.map(h => [(h.host_name || '').split('.')[0].toLowerCase(), h]));
  const fis = fabricInterconnects;

  const entries = [];
  const profileSeen = new Set();
  for (const b of blades) {
    const cimc = cimcByMoid.get(b.moid) || {};
    const profile = b.assigned_server_profile || cimc.server_profile || null;
    if (profile) profileSeen.add(profile.toLowerCase());
    const vc = profile ? vcByShort.get(profile.toLowerCase()) : null;
    entries.push({
      type: 'host',
      key: b.moid,
      name: profile || b.name,
      profile,
      blade: b.name,
      serial: b.serial,
      model: b.model,
      slot: b.slot_id,
      chassis: b.chassis_id,
      power: b.oper_power_state,
      cpus: b.num_cpus,
      cores: b.num_cpu_cores,
      memory: b.total_memory,
      ip: b.mgmt_ip || cimc.mgmt_ip,
      domain: cimc.domain,
      dc: cimc.datacenter || vc?.datacenter,
      vc,
    });
  }
  for (const h of vcHosts) {
    const short = (h.host_name || '').split('.')[0];
    if (profileSeen.has(short.toLowerCase())) continue;
    entries.push({
      type: 'host',
      key: `vc-${h.host_name}`,
      name: short,
      profile: short,
      vcenterOnly: true,
      dc: h.datacenter,
      vc: h,
    });
  }
  for (const f of fis) {
    entries.push({
      type: 'fi',
      key: f.moid,
      name: f.display_name || f.name,
      fiName: f.name,
      serial: f.serial,
      model: f.model,
      switchId: f.switch_id,
      ip: f.out_of_band_ip_address,
      domain: f.domain_name,
      evac: f.oper_evac_state,
      totalPorts: f.total_ports,
      usedPorts: f.used_ports,
    });
  }
  // Decommissioned blades live only in Vantage's identity MOs — compute/Blades
  // drops them — so searching a serial off a pulled blade would otherwise come up
  // empty. Added last so a live device with the same serial always ranks first.
  for (const d of decommissionedPayload().items || []) {
    entries.push({
      type: 'decommissioned',
      key: `decom-${d.domain}-${d.serial}`,
      name: d.name || d.serial,
      serial: d.serial,
      model: d.model,
      domain: d.domain,
      chassis: d.chassis_id,
      slot: d.slot_id,
      flag: d.flag,
      severity: d.severity,
      replacement: d.replacement,
    });
  }

  return { entries, fis };
}
