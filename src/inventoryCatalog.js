import {
  Package, Server, HardDrive, Network, Cpu, MemoryStick, Zap, Cable, Boxes,
} from 'lucide-react';

/* Hardware catalog — the one definition of what a spare can be. Shared by the
   Inventory page (section headings, dropdowns) and the Excel importer (so an
   uploaded "Type" cell resolves to the same set the UI offers). */
export const TYPES = [
  { value: 'blade',   label: 'Blade Server',        section: 'Blade Servers',        icon: Server },
  { value: 'chassis', label: 'Chassis',             section: 'Chassis',              icon: Boxes },
  { value: 'fi',      label: 'Fabric Interconnect', section: 'Fabric Interconnects', icon: Network },
  { value: 'dimm',    label: 'DIMM / Memory',       section: 'DIMMs & Memory',       icon: MemoryStick },
  { value: 'cpu',     label: 'CPU',                 section: 'CPUs',                 icon: Cpu },
  { value: 'drive',   label: 'Drive / SSD',         section: 'Drives & Storage',     icon: HardDrive },
  { value: 'nic',     label: 'NIC / Adapter',       section: 'NICs & Adapters',      icon: Cable },
  { value: 'psu',     label: 'Power Supply',        section: 'Power Supplies',       icon: Zap },
  { value: 'other',   label: 'Other',               section: 'Other Hardware',       icon: Package },
];

export const DC_OPTIONS = ['SITE1', 'SITE2'];

export const typeMeta = t =>
  TYPES.find(x => x.value === t)
  || { value: t, label: t || 'Other', section: t ? `${t[0].toUpperCase()}${t.slice(1)}` : 'Other Hardware', icon: Package };

export const qtyOf = i => Math.max(1, parseInt(i.quantity, 10) || 1);
