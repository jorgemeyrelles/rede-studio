export type NodeCategory =
  | 'wan'
  | 'vpn'
  | 'ipsec'
  | 'wireguard'
  | 'mpls'
  | 'gre'
  | 'sdwan'
  | 'router'
  | 'firewall'
  | 'switch'
  | 'load-balancer'
  | 'access-point'
  | 'ids'
  | 'ips'
  | 'proxy'
  | 'modem'
  | 'dns'
  | 'dhcp'
  | 'nas'
  | 'printer'
  | 'printer-3d'
  | 'voip'
  | 'pc'
  | 'smartphone'
  | 'server';

export type LinkKind = 'lan' | 'wan' | 'vpn' | 'ipsec' | 'other';

export type AclAction = 'ALLOW' | 'DENY';
