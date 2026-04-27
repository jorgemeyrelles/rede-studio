import type { AclAction, LinkKind, NodeCategory } from './primitives';
import type { AclEndpointScope } from './entities';
import type { TechValue } from './techProfile.type';

export type AddNodePayload = {
  siteId: string;
  layerId: string;
  category: NodeCategory;
};

export type UpdateNodePayload = {
  id: string;
  changes: Partial<{
    label: string;
    ip: string;
    hostCount: number;
    cidr: number;
    vlans: number[];
    description: string;
  }>;
};

export type AddLinkPayload = {
  from: string;
  to: string;
  kind?: LinkKind;
};

export type UpdateNodeTechFieldPayload = {
  id: string;
  key: string;
  value: TechValue;
};

export type UpdateAclRulePayload = {
  id: string;
  changes: Partial<{
    action: AclAction;
    service: string;
    enabled: boolean;
    sourceScope: AclEndpointScope;
    sourceVlanId: number | undefined;
    sourceIp: string | undefined;
    sourceIpList: string[] | undefined;
    destinationScope: AclEndpointScope;
    destinationVlanId: number | undefined;
    destinationIp: string | undefined;
    destinationIpList: string[] | undefined;
    stateful: boolean;
    bidirectional: boolean;
    protocol: 'tcp' | 'udp' | 'icmp' | 'any';
  }>;
};

export type AddCustomAclRulePayload = {
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
  protocol: 'tcp' | 'udp' | 'icmp' | 'any';
  stateful: boolean;
  bidirectional: boolean;
};

export type RemoveCustomAclRulePayload = {
  id: string;
};

export type ReorderCustomAclRulePayload = {
  id: string;
  direction: 'up' | 'down';
};

export type UpdateLinkPayload = {
  id: string;
  changes: Partial<{
    kind: LinkKind;
    generateAcl: boolean;
    statefulOverride: 'inherited' | 'force-stateful' | 'force-stateless';
    description: string;
  }>;
};

export type UpdateSitePayload = {
  id: string;
  changes: Partial<{
    name: string;
    ipOctet: number;
    cidr: number;
    reserveMarginPercent: number;
  }>;
};

export type AddSiteVlanPayload = {
  siteId: string;
  vlanId: number;
  name?: string;
  capacity: number;
  startRadical: string;
};

export type RemoveSiteVlanPayload = {
  siteId: string;
  vlanId: number;
};

export type SetVlanAssignmentPayload = {
  siteId: string;
  vlanId: number;
} | null;

export type ToggleNodeVlanPayload = {
  nodeId: string;
  siteId: string;
  vlanId: number;
};
