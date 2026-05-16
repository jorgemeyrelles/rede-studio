import type { NodeCategory } from '../types';
import type { QosClass, QosTrust } from '../types/entities';

export const SCHEMA_VERSION = 4;

/** P2 — paleta de cores para VLANs (CSS hex, index circular) */
export const VLAN_COLOR_PALETTE: string[] = [
  '#38bdf8', // sky-400
  '#34d399', // emerald-400
  '#f59e0b', // amber-400
  '#f472b6', // pink-400
  '#a78bfa', // violet-400
  '#fb923c', // orange-400
  '#22d3ee', // cyan-400
  '#86efac', // green-300
  '#fbbf24', // amber-300
  '#e879f9', // fuchsia-400
];

/** P13 — DSCP padrão por classe de tráfego QoS */
export const DSCP_BY_QOSCLASS: Record<QosClass, number> = {
  voice: 46,    // EF
  video: 34,    // AF41
  critical: 26, // AF31
  infra: 16,    // CS2
  default: 0,   // CS0 / BE
  low: 8,       // CS1
};

/** P13 — rótulo exibido na UI por classe QoS */
export const QOSCLASS_LABEL: Record<QosClass, string> = {
  voice: '🟠 Voice',
  video: '🟡 Video',
  critical: '🔴 Critical',
  infra: '🔵 Infra',
  default: '⚪ Best-Effort',
  low: '⬇ Low (backup)',
};

/** P14 — trust boundary padrão por categoria de nó */
export const DEFAULT_QOS_TRUST: Partial<Record<NodeCategory, QosTrust>> = {
  router: 'trusted',
  firewall: 'trusted',
  switch: 'trusted',
  'load-balancer': 'trusted',
  server: 'partial',
  dns: 'partial',
  dhcp: 'partial',
  voip: 'trusted',
  pc: 'untrusted',
  printer: 'untrusted',
  nas: 'untrusted',
  'access-point': 'partial',
};

export const CATEGORY_CODE_MAP: Record<NodeCategory, string> = {
  wan: 'WAN',
  router: 'RTR',
  firewall: 'FW',
  switch: 'SW',
  'load-balancer': 'LB',
  'access-point': 'AP',
  ids: 'IDS',
  ips: 'IPS',
  proxy: 'PX',
  modem: 'MDM',
  dns: 'DNS',
  dhcp: 'DHCP',
  nas: 'NAS',
  printer: 'PRN',
  'printer-3d': 'PR3D',
  voip: 'VOIP',
  pc: 'PC',
  smartphone: 'SPH',
  server: 'SRV',
  sdwan: 'SDW',
  vpn: 'VPN',
  ipsec: 'IPSEC',
  wireguard: 'WG',
  mpls: 'MPLS',
  gre: 'GRE',
};

export const CATEGORY_HOST_BASE_MAP: Record<NodeCategory, number> = {
  wan: 1,
  router: 10,
  firewall: 20,
  switch: 30,
  'load-balancer': 40,
  'access-point': 50,
  ids: 60,
  ips: 70,
  proxy: 80,
  modem: 90,
  dns: 100,
  dhcp: 110,
  nas: 120,
  printer: 130,
  'printer-3d': 135,
  voip: 140,
  pc: 150,
  smartphone: 155,
  server: 160,
  sdwan: 170,
  vpn: 180,
  ipsec: 190,
  wireguard: 200,
  mpls: 210,
  gre: 220,
};
