import type { NodeTechProfile } from './techProfile.type';
import type { AclAction, LinkKind, NodeCategory } from './primitives';

export type Site = {
  id: string;
  name: string;
  ipOctet: number;
  cidr: number;
  reserveMarginPercent: number;
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

export type SiteVlan = {
  id: string;
  siteId: string;
  vlanId: number;
  name: string;
  capacity: number;
  startRadical: string;
  startIp: string;
  endIp: string;
};

export type NodeItem = {
  id: string;
  siteId?: string;
  layerId?: string;
  label: string;
  category: NodeCategory;
  ip: string;
  originalIp?: string;
  hostCount: number;
  hostAllocations: Array<{ id: string; ip: string }>;
  cidr: number;
  vlans: number[];
  x: number;
  y: number;
  description: string;
  techProfile?: NodeTechProfile;
};

export type LinkItem = {
  id: string;
  from: string;
  to: string;
  kind: LinkKind;
  generateAcl?: boolean;
  statefulOverride?: 'inherited' | 'force-stateful' | 'force-stateless';
  description?: string;
};

export type AclEndpointScope = 'node' | 'vlan' | 'ip' | 'ip-list' | 'any';

export type AclRule = {
  id: string;
  linkId?: string;
  sourceNodeId: string;
  destinationNodeId: string;
  sourceScope: AclEndpointScope;
  sourceVlanId?: number;
  sourceIp?: string;
  sourceIpList?: string[];
  destinationScope: AclEndpointScope;
  destinationVlanId?: number;
  destinationIp?: string;
  destinationIpList?: string[];
  action: AclAction;
  service: string;
  enabled: boolean;
  managed: boolean;
  priority: number;
  source: 'topology' | 'manual';
  parentRuleId?: string;
  stateful: boolean;
  bidirectional: boolean;
  returnRuleId?: string;
  isReturnRule?: boolean;
  passthrough: boolean;
  natExempt: boolean;
  protocol: 'tcp' | 'udp' | 'icmp' | 'any';
};

export type NetworkState = {
  sites: Site[];
  layers: Layer[];
  nodes: NodeItem[];
  links: LinkItem[];
  aclRules: AclRule[];
  siteVlans: SiteVlan[];
  counters: {
    site: number;
    layer: number;
    node: number;
    link: number;
  };
  ui: {
    inspectorNodeId: string | null;
    activeLinkId: string | null;
    zoom: number;
    vlanAssignment: {
      siteId: string;
      vlanId: number;
    } | null;
  };
  meta: {
    schemaVersion: number;
    projectName: string;
    persistWarning: string | null;
    lastSavedAt: string | null;
  };
};
