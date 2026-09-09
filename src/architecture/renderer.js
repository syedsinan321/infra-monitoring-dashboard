/* Cisco Intersight architecture diagram renderer.
 *
 * Ported from the standalone Desktop HTML: vanilla DOM + SVG, no React state.
 * mountArchitecture(root, data) builds the whole diagram inside `root` and
 * returns a cleanup function. `data` is the /api/fabric-topology payload.
 */

const ICONS = {
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 18.5H7a4.5 4.5 0 1 1 .6-8.96A6 6 0 0 1 19 11.2a3.7 3.7 0 0 1-1.5 7.3z"/></svg>',
  appliance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="6" rx="1.5"/><rect x="3.5" y="13" width="17" height="6" rx="1.5"/><path d="M7 8h.01M7 16h.01M11 8h3M11 16h3"/></svg>',
  assist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12h8M8 12a3 3 0 1 1 0-6h1M16 12a3 3 0 1 0 0 6h-1"/><path d="M12 4v3M12 17v3"/></svg>',
  fi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13M14 5l3 3-3 3"/><path d="M20 16H7M10 13l-3 3 3 3"/></svg>',
  chassis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="4" width="17" height="16" rx="1.5"/><path d="M3.5 9.3h17M3.5 14.6h17M12 4v16"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.3 3.8 5.2 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.2-3.8-8.5s1.3-6.2 3.8-8.5z"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12h4l2.5-6 4 12 2.5-6h4"/></svg>',
  server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M8 7.5h.01M8 16.5h.01"/></svg>',
};

const NODE_INFO = {
  intersight: {
    title: 'Cisco Intersight', sub: 'SaaS Cloud Platform', icon: 'cloud',
    desc: "Cisco's cloud-hosted infrastructure management platform. Every UCS domain below is claimed here, giving one control plane for inventory, health, firmware, server profiles and automation — instead of logging into each domain separately.",
    usedFor: 'Single pane of glass: lifecycle management, monitoring, alarms, firmware upgrades and API access (this dashboard app talks to its REST API).',
  },
  appliance: {
    title: 'Intersight Virtual Appliance', sub: 'Private / Connected Mode', icon: 'appliance',
    desc: "An on-premises VM that runs the Intersight platform inside the datacenter. The Fabric Interconnects' device connectors register to it locally; it then syncs securely to Cisco's cloud (Connected Mode) so data never requires direct device-to-internet access.",
    usedFor: 'Keeps management traffic on-prem, satisfies security requirements, and is the claim point for all UCS domains.',
  },
  assist: {
    title: 'Intersight Assist', sub: 'Integration Gateway', icon: 'assist',
    desc: 'A helper appliance that lets Intersight manage targets that have no built-in device connector — for example VMware vCenter or storage arrays. Assist polls those targets locally and relays the data to Intersight.',
    usedFor: 'Extends Intersight visibility beyond UCS hardware (hypervisors, storage, network devices).',
  },
  fi: {
    desc: 'The Fabric Interconnect is the heart of a UCS domain: all server data traffic, chassis uplinks and hardware management flow through it. FIs are always deployed as an A/B pair — every chassis connects to both, so either fabric can carry the load alone.',
    usedFor: 'Converged LAN/SAN switching for every blade, plus the management plane (its device connector is what registers the whole domain into Intersight).',
  },
  chassis: {
    desc: "A modular chassis housing the domain's compute nodes (blades). Its I/O modules (IFMs/IOMs) at the rear are its only connection to the world — each one cables to a different Fabric Interconnect, so the chassis always has redundant paths.",
    usedFor: 'Provides power, cooling and fabric connectivity to up to 8 blade servers; managed entirely through the FIs — the chassis itself has no standalone management.',
  },
};

const MARKUP = `
  <div class="arch-toolbar">
    <label class="domain-select">UCS Domain
      <select id="domainSelect" aria-label="Select UCS domain"></select>
    </label>
    <span class="snap-chip"><span class="dot"></span><span id="snapTime">—</span></span>
  </div>

  <section class="kpis" id="kpiRow"></section>

  <div class="main">
    <section class="canvas" id="canvas" aria-label="Architecture diagram">
      <svg id="wires" aria-hidden="true"></svg>

      <div class="zone" id="zoneCloud">
        <div class="zone-label">Cloud / Management</div>
        <div class="zone-row">
          <div class="node" data-node="intersight" tabindex="0" id="n-intersight">
            <div class="node-head">
              <span class="node-icon" data-ic="cloud"></span>
              <div>
                <div class="node-title"><span class="sdot ok"></span>Cisco Intersight</div>
                <div class="node-sub">SaaS Cloud Platform</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="zone" id="zoneMgmt">
        <div class="zone-label">Management Gateway</div>
        <div class="zone-row">
          <div class="node" data-node="appliance" tabindex="0" id="n-appliance">
            <div class="node-head">
              <span class="node-icon" data-ic="appliance"></span>
              <div>
                <div class="node-title"><span class="sdot na" id="dot-appliance"></span>Intersight Virtual Appliance</div>
                <div class="node-sub">Private / Connected Mode</div>
              </div>
            </div>
          </div>
          <div class="node" data-node="assist" tabindex="0" id="n-assist">
            <div class="node-head">
              <span class="node-icon" data-ic="assist"></span>
              <div>
                <div class="node-title"><span class="sdot na" id="dot-assist"></span>Intersight Assist</div>
                <div class="node-sub">Integration Gateway</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="zone" id="zoneFi">
        <div class="zone-label">Fabric Interconnect Pair</div>
        <div class="fi-pair" id="fiPair"></div>
      </div>

      <div class="zone" id="zoneChassis">
        <div class="zone-label" id="chassisLabel">Chassis</div>
        <div class="chassis-grid" id="chassisGrid"></div>
      </div>

      <div class="legend" id="legend">
        <span class="item"><span class="line" style="border-color: var(--mgmt)"></span>Management link</span>
        <span class="item"><span class="line" style="border-color: var(--fab-a)"></span>Fabric A</span>
        <span class="item"><span class="line" style="border-color: var(--fab-b)"></span>Fabric B</span>
        <span class="item"><span class="sw" style="background: var(--fab-a)"></span>Server port · up</span>
        <span class="item"><span class="sw" style="background: var(--crit)"></span>Link down</span>
        <span class="item"><span class="sw" style="border-color: var(--fab-a)"></span>Uplink / configured</span>
        <span class="item"><span class="sw unused"></span>Unconfigured</span>
      </div>
    </section>

    <aside class="panel" id="panel" aria-live="polite"></aside>
  </div>

  <footer class="pagefoot" id="pagefoot"></footer>
`;

export default function mountArchitecture(root, DATA, HEALTH) {
  root.innerHTML = MARKUP;
  const $ = s => root.querySelector(s);
  const $$ = s => root.querySelectorAll(s);
  root.querySelectorAll('.node-icon[data-ic]').forEach(el => { el.innerHTML = ICONS[el.dataset.ic]; });

  const tooltip = document.createElement('div');
  tooltip.className = 'arch-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  document.body.appendChild(tooltip);

  /* ── helpers ─────────────────────────────────────────────── */
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtWhen = iso => { try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' }); } catch { return iso; } };
  const portLabel = l => l.fi_aggr ? `${l.fi_aggr}/${l.fi_port}` : `${l.fi_port}`;
  const fiPortName = l => `${l.fi_slot}/${portLabel(l)}`;
  const linkKey = l => `${l.fi}|${l.fi_slot}|${l.fi_aggr || 0}|${l.fi_port}`;

  const state = { domain: DATA.domains[0]?.name, selected: { type: 'intersight' } };
  const dom = () => DATA.domains.find(d => d.name === state.domain) || DATA.domains[0];

  /* Live Intersight alarm health (same noise-filtered source as the AI
     Diagnostics FI/Chassis tabs), keyed by device serial. Optional — the
     diagram renders from topology data alone when HEALTH wasn't loaded. */
  const healthBySerial = new Map();
  for (const list of [HEALTH?.fis, HEALTH?.chassis]) {
    for (const dev of list || []) if (dev.serial) healthBySerial.set(dev.serial, dev);
  }
  function alarmHealth(serial) {
    const dev = healthBySerial.get(serial);
    if (!dev) return null;
    const c = dev.alarm_counts || {};
    const crit = (c.Critical || 0) + (c.Major || 0);
    const warn = c.Warning || 0;
    return { alarms: dev.alarms || [], crit, warn, dot: crit ? 'crit' : warn ? 'warn' : 'ok' };
  }
  /* Appliance/Assist are looked up directly off HEALTH (not by serial like
     alarmHealth above) — in practice they share one physical serial number,
     which would collide in healthBySerial. */
  function mgmtHealth(dev) {
    if (!dev) return null;
    const c = dev.alarm_counts || {};
    const crit = (c.Critical || 0) + (c.Major || 0);
    const warn = c.Warning || 0;
    const connected = dev.connection_status === 'Connected';
    const dot = !connected ? 'crit' : crit ? 'crit' : warn ? 'warn' : 'ok';
    return { ...dev, alarms: dev.alarms || [], crit, warn, connected, dot };
  }
  const alarmLine = a => `<p style="margin:6px 0; font-size:12px">
    <span style="color:var(--${a.severity === 'Critical' || a.severity === 'Major' ? 'crit' : 'warn'})">●</span>
    <b>${esc(a.severity)}</b> · ${esc(a.affected_mo || '')} — ${esc(a.description)}</p>`;
  const alarmSection = ah => ah === null ? '' : `
    <div class="psec"><h3>Active Intersight alarms</h3>${
      ah.alarms.length
        ? ah.alarms.slice(0, 5).map(alarmLine).join('') +
          (ah.alarms.length > 5 ? `<p style="font-size:12px">…and ${ah.alarms.length - 5} more in the AI Diagnostics tab.</p>` : '')
        : '<p>None — matches the AI Diagnostics view. Live from Intersight, filtered to actionable alarms (unused ports don’t count).</p>'
    }</div>`;

  function stats(d) {
    const linksDown = d.links.filter(l => l.state !== 'up');
    const chBad = d.chassis.filter(c => (c.oper_state || '').toUpperCase() !== 'OK');
    const totalBlades = d.chassis.reduce((n, c) => n + (c.blade_count || 0), 0);
    const bladesOn = d.chassis.reduce((n, c) => n + (c.blades_powered_on || 0), 0);
    const units = d.links.length + d.chassis.length + d.fabric_interconnects.length;
    const bad = linksDown.length + chBad.length;
    const health = units ? Math.round(100 * (units - bad) / units) : 100;
    return { linksDown, chBad, totalBlades, bladesOn, health };
  }
  function globalStats() {
    let ch = 0, fi = 0, links = 0, blades = 0, down = 0, chBad = 0;
    const issueDomains = [];
    for (const d of DATA.domains) {
      const s = stats(d);
      ch += d.chassis.length; fi += d.fabric_interconnects.length; links += d.links.length;
      blades += s.totalBlades; down += s.linksDown.length; chBad += s.chBad.length;
      if (s.linksDown.length || s.chBad.length) issueDomains.push(d.name);
    }
    return { ch, fi, links, blades, down, chBad, badDomains: issueDomains.length, issueDomains };
  }

  let linksByFiPort = new Map();
  let linksByChassis = new Map();
  function indexLinks(d) {
    linksByFiPort = new Map(); linksByChassis = new Map();
    for (const l of d.links) {
      linksByFiPort.set(linkKey(l), l);
      if (!linksByChassis.has(l.chassis_id)) linksByChassis.set(l.chassis_id, []);
      linksByChassis.get(l.chassis_id).push(l);
    }
  }

  /* ── KPI row ─────────────────────────────────────────────── */
  function renderKpis() {
    const d = dom(), s = stats(d), g = globalStats();
    const cards = [
      { id: 'domains', label: 'Domains', value: DATA.domains.length, icon: 'globe',
        dot: g.badDomains ? 'warn' : 'ok', note: g.badDomains ? `${g.badDomains} with issues` : 'All healthy' },
      { id: 'chassis', label: 'Chassis', value: d.chassis.length, icon: 'chassis',
        dot: s.chBad.length ? 'crit' : 'ok', note: s.chBad.length ? `${s.chBad.length} degraded` : 'All online' },
      { id: 'fi', label: 'Fabric Interconnects', value: d.fabric_interconnects.length, icon: 'fi',
        dot: s.linksDown.length ? 'warn' : 'ok', note: s.linksDown.length ? 'Check fabric links' : 'Healthy' },
      { id: 'health', label: 'Health', value: s.health + '%', icon: 'pulse',
        dot: s.health === 100 ? 'ok' : s.health >= 95 ? 'warn' : 'crit',
        note: s.health === 100 ? 'No critical issues' : `${s.linksDown.length + s.chBad.length} issue${s.linksDown.length + s.chBad.length === 1 ? '' : 's'} in this domain` },
    ];
    $('#kpiRow').innerHTML = cards.map(c => `
      <div class="kpi" data-tipid="kpi:${c.id}">
        <div>
          <div class="label">${c.label}</div>
          <div class="value">${c.value}</div>
          <div class="note"><span class="dot" style="background: var(--${c.dot})"></span>${esc(c.note)}</div>
        </div>
        <span class="icon">${ICONS[c.icon]}</span>
      </div>`).join('');
  }

  /* ── FI cards ────────────────────────────────────────────── */
  function frontPanelPorts(fi) {
    const by = new Map();
    for (const p of fi.ports || []) {
      const fp = p.aggr || p.port;
      const key = `${p.slot}:${fp}`;
      if (!by.has(key)) by.set(key, { slot: p.slot, num: fp, lanes: [] });
      by.get(key).lanes.push(p);
    }
    return [...by.values()].sort((a, b) => (a.slot - b.slot) || (a.num - b.num));
  }
  function chipClass(fp, fab) {
    // red is reserved for a real cabled link that is down; a server-configured
    // port with no peer in Intersight is "configured, not connected" (outline)
    const fabLower = fab.toLowerCase();
    const laneKey = p => `${fab}|${p.slot}|${p.aggr || 0}|${p.port}`;
    const linkedLanes = fp.lanes.filter(p => linksByFiPort.has(laneKey(p)));
    const isConfigured = fp.lanes.some(p => p.role && p.role !== 'unknown');
    let cls;
    if (linkedLanes.length) {
      const anyDown = linkedLanes.some(p => linksByFiPort.get(laneKey(p)).state !== 'up');
      cls = anyDown ? 'down' : `srv-${fabLower}`;
    } else if (isConfigured) cls = `uplink-${fabLower}`;
    else cls = 'unused';
    if (fp.lanes.length > 1) cls += ' brk';
    return cls;
  }
  function chipTip(fp, fi) {
    const lines = fp.lanes.map(p => {
      const link = linksByFiPort.get(`${fi.id}|${p.slot}|${p.aggr || 0}|${p.port}`);
      const name = p.aggr ? `Lane ${p.port}` : `Port ${p.slot}/${p.port}`;
      if (link) return `<div class="t-line"><b>${name}</b> → Chassis ${link.chassis_id} · IOM ${link.iom_id} / port ${link.iom_port} · ${esc(link.speed)} · ${esc(link.state)}</div>`;
      if (!p.role || p.role === 'unknown') return `<div class="t-line"><b>${name}</b> — Unconfigured</div>`;
      const conn = p.state === 'up' ? `up · ${esc(p.speed)}` : `${esc(p.state)} · not connected`;
      return `<div class="t-line"><b>${name}</b> — ${esc(p.role)} · ${conn}</div>`;
    });
    const head = fp.lanes.length > 1
      ? `FI-${fi.id} port ${fp.slot}/${fp.num} · 4×25G breakout`
      : `FI-${fi.id} port ${fp.slot}/${fp.num}`;
    return `<div class="t-title">${head}</div>${lines.join('')}`;
  }
  function renderFis() {
    const d = dom();
    $('#fiPair').innerHTML = d.fabric_interconnects.map(fi => {
      const fab = fi.id;
      const fps = frontPanelPorts(fi);
      const srvLinks = d.links.filter(l => l.fi === fab);
      const downCount = srvLinks.filter(l => l.state !== 'up').length;
      const usedCount = fps.filter(fp => fp.lanes.some(l => (l.role || 'unknown') !== 'unknown')).length;
      const ah = alarmHealth(fi.serial);
      const fiDot = ah?.crit ? 'crit' : (downCount || ah?.warn) ? 'warn' : 'ok';
      const alarmNote = ah?.alarms.length
        ? `<br>${ah.alarms.length} active alarm${ah.alarms.length === 1 ? '' : 's'}`
        : '';
      const chips = fps.map((fp, i) => {
        const keys = fp.lanes
          .filter(p => linksByFiPort.has(`${fab}|${p.slot}|${p.aggr || 0}|${p.port}`))
          .map(p => `${fab}|${p.slot}|${p.aggr || 0}|${p.port}`);
        const keyAttr = keys.length ? ` data-linkkeys="${keys.join(',')}"` : '';
        return `<span class="pchip ${chipClass(fp, fab)}" data-tipid="fi:${fab}:${i}"${keyAttr}>${fp.num}</span>`;
      }).join('');
      return `
      <div class="node fi-card" data-node="fi" data-fab="${fab}" tabindex="0" id="n-fi-${fab}">
        <div class="node-head">
          <span class="node-icon">${ICONS.fi}</span>
          <div>
            <div class="node-title"><span class="sdot ${fiDot}"></span>Fabric ${fab}
              <span class="fab-tag">FI-${fab}</span></div>
            <div class="node-sub">${esc(fi.model)} · ${esc(fi.serial)}</div>
          </div>
          <div class="fi-meta">${usedCount}/${fps.length} ports configured<br>${srvLinks.length - downCount}/${srvLinks.length} server links up${alarmNote}</div>
        </div>
        <div class="portgrid">${chips}</div>
      </div>`;
    }).join('');
  }

  /* ── chassis cards ───────────────────────────────────────── */
  function chassisHealth(c) {
    const links = linksByChassis.get(c.chassis_id) || [];
    const down = links.filter(l => l.state !== 'up').length;
    const operOk = (c.oper_state || '').toUpperCase() === 'OK';
    const ah = alarmHealth(c.serial);
    if (!operOk) return { dot: 'crit', text: `Oper state: ${c.oper_state || 'unknown'}`, down, ah };
    if (ah?.crit) return { dot: 'crit', text: `${ah.crit} critical alarm${ah.crit === 1 ? '' : 's'}`, down, ah };
    if (down) return { dot: 'warn', text: `${down} link${down === 1 ? '' : 's'} down`, down, ah };
    if (ah?.warn) return { dot: 'warn', text: `${ah.warn} alarm${ah.warn === 1 ? '' : 's'}`, down, ah };
    return { dot: 'ok', text: 'Online', down, ah };
  }
  function renderChassis() {
    const d = dom();
    $('#chassisLabel').textContent = `Chassis (${d.chassis.length})`;
    $('#chassisGrid').innerHTML = d.chassis.map(c => {
      const h = chassisHealth(c);
      const links = (linksByChassis.get(c.chassis_id) || []);
      const byIom = new Map();
      for (const l of links) {
        if (!byIom.has(l.iom_id)) byIom.set(l.iom_id, []);
        byIom.get(l.iom_id).push(l);
      }
      const rows = [...byIom.keys()].sort((a, b) => a - b).map(iomId => {
        const ls = byIom.get(iomId).slice().sort((a, b) => a.iom_port - b.iom_port);
        const fab = (ls[0].fi || '?');
        const chips = ls.map(l => {
          const cls = l.state === 'up' ? `srv-${fab.toLowerCase()}` : 'down';
          return `<span class="pchip ${cls}" data-tipid="ch:${c.chassis_id}:${l.iom_id}:${l.iom_port}" data-linkkeys="${linkKey(l)}">${l.iom_port}</span>`;
        }).join('');
        return `<div class="ch-row"><span class="lbl ${fab.toLowerCase()}">IOM ${iomId} · FI ${fab}</span><span class="chips">${chips}</span></div>`;
      }).join('');
      return `
      <div class="node ch-card" data-node="chassis" data-chassis="${c.chassis_id}" tabindex="0" id="n-ch-${c.chassis_id}">
        <div class="node-head">
          <span class="node-icon">${ICONS.chassis}</span>
          <div style="min-width:0">
            <div class="node-title"><span class="sdot ${h.dot}"></span>Chassis ${c.chassis_id}</div>
            <div class="node-sub" title="${esc(c.model)} · ${esc(c.name)}">${esc(c.model)} · ${esc(c.name)}</div>
          </div>
        </div>
        <div class="ch-rows">${rows || '<div class="ch-row"><span class="lbl">No cabled ports found</span></div>'}</div>
        <div class="ch-foot">${ICONS.server.replace('<svg ', '<svg width="12" height="12" ')} ${c.blade_count ?? 0} blade${(c.blade_count ?? 0) === 1 ? '' : 's'} · ${c.blades_powered_on ?? 0} powered on</div>
      </div>`;
    }).join('');
  }

  /* ── tooltips ────────────────────────────────────────────── */
  const issueLineLink = l => `<div class="t-line" style="padding-left:10px"><span style="color:var(--crit)">●</span> <b>FI-${l.fi} ${fiPortName(l)} ↔ Chassis ${l.chassis_id} · IOM ${l.iom_id}/${l.iom_port}</b> — ${esc(l.speed)} link ${esc(l.state)} (admin ${esc(l.admin_state)})</div>`;
  const issueLineChassis = c => `<div class="t-line" style="padding-left:10px"><span style="color:var(--crit)">●</span> <b>Chassis ${c.chassis_id}</b> · ${esc(c.name)} — oper state ${esc(c.oper_state || 'unknown')}${c.connection_status ? ` · connected via ${esc(c.connection_status)}` : ''}</div>`;

  function kpiTip(which) {
    const d = dom(), s = stats(d);
    if (which === 'domains') {
      const lines = [];
      for (const dd of DATA.domains) {
        const ss = stats(dd);
        if (!ss.linksDown.length && !ss.chBad.length) continue;
        lines.push(`<div class="t-line"><b>${esc(dd.name)}</b> (${esc(dd.datacenter)})</div>`);
        ss.linksDown.forEach(l => lines.push(issueLineLink(l)));
        ss.chBad.forEach(c => lines.push(issueLineChassis(c)));
      }
      return `<div class="t-title">Issues across all ${DATA.domains.length} domains</div>` +
        (lines.length ? lines.join('') : '<div class="t-line">Every domain is healthy: all chassis operable, all fabric links up.</div>');
    }
    if (which === 'chassis') {
      return `<div class="t-title">Chassis health — ${esc(d.name)}</div>` +
        (s.chBad.length ? s.chBad.map(issueLineChassis).join('')
          : `<div class="t-line">All ${d.chassis.length} chassis report oper state OK with management paths via both FIs.</div>`);
    }
    if (which === 'fi') {
      return `<div class="t-title">Fabric links — ${esc(d.name)}</div>` +
        (s.linksDown.length ? s.linksDown.map(issueLineLink).join('')
          : `<div class="t-line">All ${d.links.length} server links up across FI-A and FI-B.</div>`);
    }
    if (which === 'health') {
      const lines = [...s.linksDown.map(issueLineLink), ...s.chBad.map(issueLineChassis)];
      return `<div class="t-title">Health — ${esc(d.name)}</div>` +
        (lines.length ? lines.join('')
          : `<div class="t-line">No issues in this domain right now: ${d.links.length} links up, ${d.chassis.length} chassis OK, both FIs healthy.</div>`);
    }
    return '';
  }

  function tipHtmlFor(id) {
    const d = dom();
    const [kind, ...rest] = id.split(':');
    if (kind === 'kpi') return kpiTip(rest[0]);
    if (kind === 'fi') {
      const [fab, idx] = rest;
      const fi = d.fabric_interconnects.find(f => f.id === fab);
      if (!fi) return '';
      const fp = frontPanelPorts(fi)[+idx];
      return fp ? chipTip(fp, fi) : '';
    }
    if (kind === 'ch') {
      const [chId, iomId, iomPort] = rest.map(Number);
      const l = (linksByChassis.get(chId) || []).find(x => x.iom_id === iomId && x.iom_port === iomPort);
      if (!l) return '';
      return `<div class="t-title">Chassis ${chId} · IOM ${l.iom_id} / port ${l.iom_port}</div>
        <div class="t-line">↔ <b>FI-${l.fi} port ${fiPortName(l)}</b>${l.fi_aggr ? ' (breakout lane)' : ''}</div>
        <div class="t-line"><b>${esc(l.speed)}</b> · ${esc(l.role)} · ${esc(l.state)}${l.state !== 'up' ? ' · admin ' + esc(l.admin_state) : ''}</div>`;
    }
    return '';
  }
  const onMouseMove = e => {
    const chip = e.target.closest?.('[data-tipid]');
    if (!chip) { tooltip.style.display = 'none'; return; }
    const html = tipHtmlFor(chip.dataset.tipid);
    if (!html) { tooltip.style.display = 'none'; return; }
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    const pad = 14, tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + tw > window.innerWidth - 8) x = e.clientX - tw - pad;
    if (y + th > window.innerHeight - 8) y = e.clientY - th - pad;
    tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
  };
  const onMouseLeave = () => { tooltip.style.display = 'none'; };
  root.addEventListener('mousemove', onMouseMove);
  root.addEventListener('mouseleave', onMouseLeave);

  /* ── wires (dashed connectors) ───────────────────────────── */
  const wiresSvg = $('#wires');
  function drawWires() {
    const canvas = $('#canvas');
    if (!canvas || !canvas.isConnected) return;
    const cw = canvas.clientWidth, chh = canvas.scrollHeight;
    wiresSvg.setAttribute('viewBox', `0 0 ${cw} ${chh}`);
    wiresSvg.setAttribute('width', cw); wiresSvg.setAttribute('height', chh);
    const cr = canvas.getBoundingClientRect();
    const R = el => { const r = el.getBoundingClientRect(); return { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height, cx: r.left - cr.left + r.width / 2, bottom: r.bottom - cr.top, top: r.top - cr.top }; };
    const paths = [];
    const P = (dAttr, cls, meta) => paths.push({ d: dAttr, cls, meta });

    const cloud = $('#n-intersight'), app = $('#n-appliance'), asst = $('#n-assist');
    const fiA = $('#n-fi-A'), fiB = $('#n-fi-B');
    if (cloud && app && asst) {
      const c = R(cloud), a = R(app), s = R(asst);
      const midY = (c.bottom + Math.min(a.top, s.top)) / 2;
      P(`M ${c.cx} ${c.bottom} V ${midY} H ${a.cx} V ${a.top}`, 'mgmt', 'mgmt');
      P(`M ${c.cx} ${c.bottom} V ${midY} H ${s.cx} V ${s.top}`, 'mgmt', 'mgmt');
      if (fiA && fiB) {
        const fa = R(fiA), fb = R(fiB);
        const gapY = (a.bottom + Math.min(fa.top, fb.top)) / 2;
        P(`M ${a.cx - 14} ${a.bottom} V ${gapY} H ${fa.cx} V ${fa.top}`, 'mgmt', 'mgmt');
        P(`M ${a.cx + 14} ${a.bottom} V ${gapY} H ${fb.cx} V ${fb.top}`, 'mgmt', 'mgmt');
      }
    }

    const cards = [...root.querySelectorAll('#chassisGrid .ch-card')];
    if (fiA && fiB && cards.length) {
      const fa = R(fiA), fb = R(fiB);
      const rows = new Map();
      for (const el of cards) {
        const r = R(el);
        const key = Math.round(r.top / 10) * 10;
        if (!rows.has(key)) rows.set(key, { top: r.top, cards: [] });
        rows.get(key).cards.push({ el, r });
      }
      const rowList = [...rows.values()].sort((a, b) => a.top - b.top);
      const leftX = Math.min(...cards.map(el => R(el).x)) - 10;
      const rightX = Math.max(...cards.map(el => { const r = R(el); return r.x + r.w; })) + 10;
      let prevA = { x: fa.cx, y: fa.bottom }, prevB = { x: fb.cx, y: fb.bottom };
      rowList.forEach((row, i) => {
        const busA = row.top - 22, busB = row.top - 12;
        P(`M ${prevA.x} ${prevA.y} V ${busA}`, 'fa', { fab: 'A' });
        P(`M ${prevB.x} ${prevB.y} V ${busB}`, 'fb', { fab: 'B' });
        /* rails: fabric A hugs the left margin, fabric B the right — asymmetric
           so the two never form a closed rectangle around the grid */
        const axs = row.cards.map(({ r }) => r.x + r.w * 0.33);
        const bxs = row.cards.map(({ r }) => r.x + r.w * 0.67);
        let aEnd = Math.max(...axs) + 6, bStart = Math.min(...bxs) - 6;
        const aStart = i === 0 ? Math.min(leftX, prevA.x) : leftX;
        const bEnd = i === 0 ? Math.max(rightX, prevB.x) : rightX;
        if (i === 0) { aEnd = Math.max(aEnd, prevA.x); bStart = Math.min(bStart, prevB.x); }
        P(`M ${aStart} ${busA} H ${aEnd}`, 'fa', { fab: 'A' });
        P(`M ${bStart} ${busB} H ${bEnd}`, 'fb', { fab: 'B' });
        for (const { el, r } of row.cards) {
          const xa = r.x + r.w * 0.33, xb = r.x + r.w * 0.67;
          P(`M ${xa} ${busA} V ${r.top}`, 'fa', { fab: 'A', chassis: el.dataset.chassis });
          P(`M ${xb} ${busB} V ${r.top}`, 'fb', { fab: 'B', chassis: el.dataset.chassis });
        }
        if (i < rowList.length - 1) {
          prevA = { x: leftX, y: busA };
          prevB = { x: rightX, y: busB };
        }
      });
    }

    // Each connector gets a twin "light" path on top: solid wire underneath,
    // bright dots travelling along it toward the target.
    wiresSvg.innerHTML = paths.map(p =>
      `<path class="wire ${p.cls}" d="${p.d}" data-meta='${JSON.stringify(typeof p.meta === 'string' ? { kind: p.meta } : p.meta)}'/>`
      + `<path class="wire-light" d="${p.d}"/>`).join('');
    applyWireHighlight();
  }

  function applyWireHighlight() {
    const sel = state.selected;
    wiresSvg.querySelectorAll('.wire').forEach(w => {
      const meta = JSON.parse(w.dataset.meta || '{}');
      w.classList.remove('lit', 'dim');
      let lit = null;
      if (sel.type === 'fi') lit = meta.fab === sel.fab;
      else if (sel.type === 'chassis') lit = meta.chassis === String(sel.chassis);
      else if (sel.type === 'intersight' || sel.type === 'appliance' || sel.type === 'assist') lit = meta.kind === 'mgmt';
      if (lit === null) return;
      w.classList.add(lit ? 'lit' : 'dim');
    });
  }

  /* ── right detail panel ──────────────────────────────────── */
  const kvRow = (k, v) => `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  const statusBlock = (dotCls, word, note) => `
    <div class="psec">
      <h3>Status</h3>
      <div class="status-line"><span class="sdot ${dotCls}"></span>${esc(word)}</div>
      ${note ? `<div class="status-note">${note}</div>` : ''}
    </div>`;
  const updatedBlock = () => `
    <div class="psec">
      <h3>Data as of</h3>
      <div class="kv"><span class="v">${esc(fmtWhen(DATA.generated_at))}</span><span class="snap-pill"><span class="dot"></span>CACHED</span></div>
      <div class="hint">Topology is cached for 24 hours — use the Refresh button (top right) to pull live from Intersight.</div>
    </div>`;

  function panelFor() {
    const d = dom(), s = stats(d), g = globalStats(), sel = state.selected;

    if (sel.type === 'appliance' || sel.type === 'assist') {
      const info = NODE_INFO[sel.type];
      const dev = sel.type === 'appliance' ? HEALTH?.appliance : HEALTH?.assist;
      const mh = mgmtHealth(dev);
      const statusHtml = mh
        ? statusBlock(mh.dot,
            !mh.connected ? 'Not connected'
              : mh.crit ? `${mh.crit} critical alarm${mh.crit === 1 ? '' : 's'}`
              : mh.warn ? `${mh.warn} active alarm${mh.warn === 1 ? '' : 's'}`
              : 'Connected',
            `${esc(dev.hostname || '')}${dev.connection_status_changed ? ` · since ${fmtWhen(dev.connection_status_changed)}` : ''}`)
        : statusBlock('na', 'Reference component', 'Health for this component isn’t captured in the topology data — shown here to explain the management path.');
      return panelShell(info.icon, info.title, info.sub, `
        ${statusHtml}
        ${mh ? alarmSection(mh) : ''}
        <div class="psec"><h3>What it is</h3><p>${info.desc}</p></div>
        <div class="psec"><h3>Used for</h3><p>${info.usedFor}</p></div>
        ${updatedBlock()}`);
    }

    if (sel.type === 'fi') {
      const fi = d.fabric_interconnects.find(f => f.id === sel.fab);
      if (!fi) return panelDefault(d, s, g);
      const fps = frontPanelPorts(fi);
      const myLinks = d.links.filter(l => l.fi === fi.id);
      const down = myLinks.filter(l => l.state !== 'up');
      const uplinks = fps.filter(fp => fp.lanes.some(l => /uplink/i.test(l.role || ''))).length;
      const unconf = fps.filter(fp => fp.lanes.every(l => !l.role || l.role === 'unknown')).length;
      const byCh = new Map();
      for (const l of myLinks) { byCh.set(l.chassis_id, (byCh.get(l.chassis_id) || 0) + 1); }
      const chRows = [...byCh.keys()].sort((a, b) => a - b)
        .map(id => kvRow(`Chassis ${id}`, `${byCh.get(id)} port${byCh.get(id) === 1 ? '' : 's'}`)).join('');
      const ah = alarmHealth(fi.serial);
      const fiDot = ah?.crit ? 'crit' : (down.length || ah?.warn) ? 'warn' : 'ok';
      const fiWord = ah?.crit ? `${ah.crit} critical alarm${ah.crit === 1 ? '' : 's'}`
        : down.length ? `${down.length} server link${down.length === 1 ? '' : 's'} down`
        : ah?.warn ? `${ah.warn} active alarm${ah.warn === 1 ? '' : 's'}`
        : 'Healthy';
      return panelShell('fi', `Fabric Interconnect ${fi.id}`, `${esc(fi.model)} · ${esc(fi.serial)}`, `
        ${statusBlock(fiDot, fiWord,
          `${myLinks.length - down.length}/${myLinks.length} server links up · traffic evacuation ${esc(fi.oper_evac_state || 'off')}${ah ? ` · ${ah.alarms.length} live Intersight alarm${ah.alarms.length === 1 ? '' : 's'}` : ''}`)}
        ${alarmSection(ah)}
        <div class="psec"><h3>What it is</h3><p>${NODE_INFO.fi.desc}</p></div>
        <div class="psec"><h3>Details</h3>
          ${kvRow('Model', esc(fi.model))}
          ${kvRow('Serial', esc(fi.serial))}
          ${fi.mgmt_ip ? kvRow('Mgmt IP', esc(fi.mgmt_ip)) : ''}
          ${fi.ethernet_mode ? kvRow('Ethernet mode', esc(fi.ethernet_mode)) : ''}
          ${fi.fc_mode ? kvRow('FC mode', esc(fi.fc_mode)) : ''}
        </div>
        <div class="psec"><h3>Ethernet ports</h3>
          ${kvRow('Front-panel ports', fps.length)}
          ${kvRow('Server links (to chassis)', `${myLinks.length} · ${myLinks.length - down.length} up`)}
          ${kvRow('Uplink ports', uplinks)}
          ${kvRow('Unconfigured', unconf)}
        </div>
        <div class="psec"><h3>Connects to</h3>${chRows || '<p>No chassis links found.</p>'}</div>
        <div class="psec"><h3>Domain</h3><div class="kv"><span class="v">${esc(d.name)}</span><span class="v" style="color:var(--ink-3)">${esc(d.datacenter)}</span></div></div>
        ${updatedBlock()}`);
    }

    if (sel.type === 'chassis') {
      const c = d.chassis.find(x => String(x.chassis_id) === String(sel.chassis));
      if (!c) return panelDefault(d, s, g);
      const h = chassisHealth(c);
      const links = (linksByChassis.get(c.chassis_id) || []).slice()
        .sort((a, b) => (a.state === 'up') - (b.state === 'up') || (a.iom_id - b.iom_id) || (a.iom_port - b.iom_port));
      const focus = new Set(sel.focus || []);
      const rows = links.map(l => `
        <div class="linkrow${focus.has(linkKey(l)) ? ' hl' : ''}">
          <span class="sdot ${l.state === 'up' ? 'ok' : 'crit'}"></span>
          <span>IOM ${l.iom_id}/${l.iom_port} ↔ FI-${l.fi} ${fiPortName(l)}</span>
          <span class="spd">${esc(l.speed)}</span>
        </div>`).join('');
      return panelShell('chassis', `Chassis ${c.chassis_id}`, `${esc(c.model)} · ${esc(c.name)}`, `
        ${statusBlock(h.dot, h.dot === 'ok' ? 'Online' : h.text,
          `Oper state ${esc(c.oper_state || 'unknown')} · management path via FI ${esc(c.connection_status || '?')}${h.down ? ` · ${h.down} fabric link${h.down === 1 ? '' : 's'} down` : ''}${h.ah ? ` · ${h.ah.alarms.length} live Intersight alarm${h.ah.alarms.length === 1 ? '' : 's'}` : ''}`)}
        ${alarmSection(h.ah ?? null)}
        <div class="psec"><h3>What it is</h3><p>${NODE_INFO.chassis.desc}</p></div>
        <div class="psec"><h3>Resources</h3>
          ${kvRow('Serial', esc(c.serial || '—'))}
          ${kvRow('Blades installed', `${c.blade_count ?? 0}`)}
          ${kvRow('Blades powered on', `${c.blades_powered_on ?? 0}`)}
          ${kvRow('I/O modules', c.ioms.length ? c.ioms.map(i => `IOM ${i.iom_id}→FI ${i.connected_fi}`).join(' · ') : '—')}
        </div>
        <div class="psec"><h3>Port connections (${links.length})</h3><div class="linklist">${rows || '<p>None found.</p>'}</div></div>
        <div class="psec"><h3>Domain</h3><div class="kv"><span class="v">${esc(d.name)}</span><span class="v" style="color:var(--ink-3)">${esc(d.datacenter)}</span></div></div>
        ${updatedBlock()}`);
    }

    return panelDefault(d, s, g);
  }
  function panelDefault(d, s, g) {
    const info = NODE_INFO.intersight;
    const issues = [];
    if (g.down) issues.push(`${g.down} fabric link${g.down === 1 ? '' : 's'} down`);
    if (g.chBad) issues.push(`${g.chBad} chassis degraded`);
    const allBad = g.issueDomains.length === DATA.domains.length;
    const issueNote = issues.length
      ? `<span data-tipid="kpi:domains" style="cursor:help; text-decoration:underline dotted; text-underline-offset:3px">${esc(issues.join(' · '))} in ${esc(g.issueDomains.join(', '))}</span>${allBad ? '' : ' · other domains healthy'}`
      : 'All systems operational as of the last data pull';
    return panelShell('cloud', info.title, info.sub, `
      ${statusBlock(issues.length ? 'warn' : 'ok',
        issues.length ? 'Operational — minor issues' : 'Healthy',
        issueNote)}
      <div class="psec"><h3>Description</h3><p>${info.desc}</p></div>
      <div class="psec"><h3>Used for</h3><p>${info.usedFor}</p></div>
      <div class="psec"><h3>Connected resources (all domains)</h3>
        ${kvRow('UCS domains', DATA.domains.length)}
        ${kvRow('Chassis', g.ch)}
        ${kvRow('Fabric Interconnects', g.fi)}
        ${kvRow('Blade servers', g.blades)}
        ${kvRow('Cabled fabric links', g.links)}
      </div>
      <div class="psec"><h3>Viewing domain</h3>
        <div class="kv"><span class="v">${esc(d.name)}</span><span class="v" style="color:var(--ink-3)">${esc(d.datacenter)}</span></div>
        ${kvRow('Chassis in domain', d.chassis.length)}
        ${kvRow('Blades in domain', s.totalBlades + ' · ' + s.bladesOn + ' on')}
        ${kvRow('Fabric links', d.links.length + (s.linksDown.length ? ` · ${s.linksDown.length} down` : ' · all up'))}
      </div>
      ${updatedBlock()}
      <div class="hint">Tip: click any card to inspect it. Hover a port number to see its cable — click it to trace the cable to the other end.</div>`);
  }
  function panelShell(icon, title, sub, body) {
    return `
      <div class="panel-head">
        <span class="node-icon">${ICONS[icon]}</span>
        <div><h2>${esc(title)}</h2><div class="sub">${sub}</div></div>
      </div>${body}`;
  }
  function renderPanel() { $('#panel').innerHTML = panelFor(); }

  /* ── selection ───────────────────────────────────────────── */
  function applySelection() {
    $$('.node').forEach(n => n.classList.remove('selected'));
    const sel = state.selected;
    let el = null;
    if (sel.type === 'intersight') el = $('#n-intersight');
    else if (sel.type === 'appliance') el = $('#n-appliance');
    else if (sel.type === 'assist') el = $('#n-assist');
    else if (sel.type === 'fi') el = $(`#n-fi-${sel.fab}`);
    else if (sel.type === 'chassis') el = $(`#n-ch-${sel.chassis}`);
    if (el) el.classList.add('selected');
    const focus = new Set(sel.focus || []);
    $$('.pchip').forEach(ch => {
      const keys = (ch.dataset.linkkeys || '').split(',').filter(Boolean);
      ch.classList.toggle('focus', keys.some(k => focus.has(k)));
    });
    renderPanel();
    const hlRow = $('#panel .linkrow.hl');
    if (hlRow) hlRow.scrollIntoView({ block: 'nearest' });
    applyWireHighlight();
  }
  $('#canvas').addEventListener('click', e => {
    /* port chips first: clicking a cabled port traces it to the other end */
    const chip = e.target.closest('.pchip');
    if (chip && chip.dataset.linkkeys) {
      const links = chip.dataset.linkkeys.split(',').map(k => linksByFiPort.get(k)).filter(Boolean);
      if (links.length) {
        // breakout chips can carry several lanes — follow the chassis most of them go to
        const byCh = new Map();
        for (const l of links) {
          if (!byCh.has(l.chassis_id)) byCh.set(l.chassis_id, []);
          byCh.get(l.chassis_id).push(l);
        }
        const [chId, chLinks] = [...byCh.entries()].sort((a, b) => b[1].length - a[1].length)[0];
        state.selected = { type: 'chassis', chassis: String(chId), focus: chLinks.map(linkKey) };
        applySelection();
        $(`#n-ch-${chId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
    }
    const node = e.target.closest('.node');
    if (!node) return;
    const t = node.dataset.node;
    let next;
    if (t === 'fi') next = { type: 'fi', fab: node.dataset.fab };
    else if (t === 'chassis') next = { type: 'chassis', chassis: node.dataset.chassis };
    else next = { type: t };
    const same = JSON.stringify(next) === JSON.stringify(state.selected);
    state.selected = same ? { type: 'intersight' } : next;
    applySelection();
  });
  $('#canvas').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('node')) {
      e.preventDefault(); e.target.click();
    }
  });

  /* ── domain selector & boot ──────────────────────────────── */
  function renderMgmtDots() {
    const paint = (id, mh) => { const el = $(`#${id}`); if (el) el.className = `sdot ${mh ? mh.dot : 'na'}`; };
    paint('dot-appliance', mgmtHealth(HEALTH?.appliance));
    paint('dot-assist', mgmtHealth(HEALTH?.assist));
  }
  function renderAll() {
    indexLinks(dom());
    renderKpis(); renderFis(); renderChassis(); renderMgmtDots();
    applySelection();
    requestAnimationFrame(drawWires);
  }
  const domainSel = $('#domainSelect');
  domainSel.innerHTML = DATA.domains.map(d => `<option value="${esc(d.name)}">${esc(d.name)} (${esc(d.datacenter)})</option>`).join('');
  domainSel.value = state.domain;
  domainSel.addEventListener('change', () => { state.domain = domainSel.value; state.selected = { type: 'intersight' }; renderAll(); });

  $('#snapTime').textContent = 'Data as of ' + fmtWhen(DATA.generated_at);
  $('#pagefoot').textContent = `Read-only view of ${DATA.domains.length} UCS domains from the Intersight API · data as of ${fmtWhen(DATA.generated_at)} · cached for 24 hours — Refresh pulls it live.`;

  let resizeRaf = 0;
  const onResize = () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(drawWires); };
  window.addEventListener('resize', onResize);

  renderAll();

  return function cleanup() {
    window.removeEventListener('resize', onResize);
    root.removeEventListener('mousemove', onMouseMove);
    root.removeEventListener('mouseleave', onMouseLeave);
    cancelAnimationFrame(resizeRaf);
    tooltip.remove();
    root.innerHTML = '';
  };
}
