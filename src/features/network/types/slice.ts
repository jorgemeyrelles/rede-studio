import type { AclAction, LinkKind, NodeCategory } from './primitives';
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
  }>;
};

export type UpdateSitePayload = {
  id: string;
  changes: Partial<{
    name: string;
    ipOctet: number;
    cidr: number;
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
