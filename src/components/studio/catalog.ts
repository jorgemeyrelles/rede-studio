import type { NodeCategory } from '../../features/network/types';

export type NodeVisual = {
  category: NodeCategory;
  label: string;
  short: string;
};

export const NODE_VISUALS: NodeVisual[] = [
  { category: 'router', label: 'Router', short: 'RTR' },
  { category: 'firewall', label: 'Firewall', short: 'FW' },
  { category: 'switch', label: 'Switch', short: 'SW' },
  { category: 'load-balancer', label: 'Load Balancer', short: 'LB' },
  { category: 'access-point', label: 'Access Point', short: 'AP' },
  { category: 'ids', label: 'IDS', short: 'IDS' },
  { category: 'ips', label: 'IPS', short: 'IPS' },
  { category: 'proxy', label: 'Proxy', short: 'PX' },
  { category: 'modem', label: 'Modem', short: 'MDM' },
  { category: 'dns', label: 'DNS', short: 'DNS' },
  { category: 'dhcp', label: 'DHCP', short: 'DHCP' },
  { category: 'nas', label: 'NAS', short: 'NAS' },
  { category: 'printer', label: 'Printer', short: 'PRN' },
  { category: 'voip', label: 'VoIP Gateway', short: 'VOIP' },
  { category: 'pc', label: 'Workstation', short: 'PC' },
  { category: 'server', label: 'Server', short: 'SRV' },
  { category: 'sdwan', label: 'SD-WAN', short: 'SDW' },
  { category: 'vpn', label: 'VPN', short: 'VPN' },
  { category: 'ipsec', label: 'IPsec Tunnel', short: 'IPSEC' },
  { category: 'wireguard', label: 'WireGuard', short: 'WG' },
  { category: 'mpls', label: 'MPLS', short: 'MPLS' },
  { category: 'gre', label: 'GRE Tunnel', short: 'GRE' },
  { category: 'wan', label: 'WAN/Internet', short: 'WAN' },
];

export const NODE_OPTION_CATEGORIES: NodeCategory[] = [
  'router',
  'firewall',
  'switch',
  'load-balancer',
  'access-point',
  'ids',
  'ips',
  'proxy',
  'modem',
  'dns',
  'dhcp',
  'nas',
  'printer',
  'voip',
  'pc',
  'server',
  'sdwan',
  'vpn',
  'ipsec',
  'wireguard',
  'mpls',
  'gre',
];

export const RELATION_OPTION_CATEGORIES: NodeCategory[] = [
  'vpn',
  'ipsec',
  'wireguard',
  'sdwan',
  'mpls',
  'gre',
];

export function getNodeVisual(category: NodeCategory) {
  return (
    NODE_VISUALS.find((item) => item.category === category) ?? {
      category,
      label: category,
      short: category.toUpperCase(),
    }
  );
}

export function getNodeIconName(category: NodeCategory): string {
  if (category === 'wan') return 'cloud';
  if (category === 'router') return 'router';
  if (category === 'switch') return 'switch';
  if (category === 'firewall') return 'firewall';
  if (category === 'pc') return 'pc';
  if (category === 'server' || category === 'nas') return 'server';
  if (category === 'printer') return 'printer';
  if (category === 'access-point') return 'ap';
  if (category === 'voip') return 'phone';
  if (
    category === 'vpn' ||
    category === 'ipsec' ||
    category === 'wireguard' ||
    category === 'mpls' ||
    category === 'gre' ||
    category === 'sdwan'
  ) {
    return 'vpn';
  }
  return 'policy';
}

export function getNodeIconSrc(category: NodeCategory): string {
  return `/images/network/${getNodeIconName(category)}.svg`;
}
