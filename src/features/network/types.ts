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
  | 'voip'
  | 'pc'
  | 'server';

export type LinkKind = 'lan' | 'wan' | 'vpn' | 'ipsec' | 'other';

export type Site = {
  id: string;
  name: string;
  ipOctet: number;
  cidr: number;
};

export type Layer = {
  id: string;
  siteId: string;
  name: string;
  order: number;
  width: number;
  height: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
};

export type NodeItem = {
  id: string;
  siteId?: string;
  layerId?: string;
  label: string;
  category: NodeCategory;
  ip: string;
  cidr: number;
  vlans: number[];
  x: number;
  y: number;
  description: string;
  techProfile?: {
    kind: string;
    version: number;
    fields: Record<string, string | number | boolean>;
  };
};

export type LinkItem = {
  id: string;
  from: string;
  to: string;
  kind: LinkKind;
};

export type AclAction = 'ALLOW' | 'DENY';

export type AclRule = {
  id: string;
  linkId?: string;
  sourceNodeId: string;
  destinationNodeId: string;
  action: AclAction;
  service: string;
  enabled: boolean;
  managed: boolean;
};

export type NetworkState = {
  sites: Site[];
  layers: Layer[];
  nodes: NodeItem[];
  links: LinkItem[];
  aclRules: AclRule[];
  counters: {
    site: number;
    layer: number;
    node: number;
    link: number;
  };
  ui: {
    inspectorNodeId: string | null;
    zoom: number;
  };
  meta: {
    schemaVersion: number;
    projectName: string;
    persistWarning: string | null;
    lastSavedAt: string | null;
  };
};
