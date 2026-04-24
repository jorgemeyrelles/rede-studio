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
    sourceVlanId?: number;
    sourceIp?: string;
    destinationScope: AclEndpointScope;
    destinationVlanId?: number;
    destinationIp?: string;
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
