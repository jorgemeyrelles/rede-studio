import type { AclAction, LinkKind, NodeCategory } from './primitives';
import type {
  AclEndpointScope,
  AddressFamily,
  CertificateType,
  CustomServiceProto,
  FwPolicyAction,
  IpsecSaState,
  LayerTier,
  NatType,
  NetworkPurpose,
  SessionProto,
  SessionState,
  SslVpnAuthMode,
} from './entities';
import type { TechValue } from './techProfile.type';

export type AddNodePayload = {
  siteId: string;
  layerId: string;
  category: NodeCategory;
};

export type AddLayerPayload = {
  siteId: string;
  /** Fase 1 — papel arquitetural; preenchido pelo modal TierPicker */
  tier?: LayerTier;
  /** Nome personalizado; se omitido, usa nome padrão baseado no tier */
  name?: string;
  /** Fase 2 — rede lógica à qual esta camada pertence */
  networkId?: string;
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

export type UpdateLayerTierPayload = {
  id: string;
  tier: LayerTier | undefined;
  name?: string;
};

export type UpdateNodeZonePayload = {
  id: string;
  zone: string | undefined;
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
    // Fase 3 — QoS
    dscpMark: number | undefined;
    trafficClass:
      | 'critical'
      | 'voice'
      | 'video'
      | 'bulk'
      | 'best-effort'
      | undefined;
    guaranteedBwKbps: number | undefined;
    maxBwKbps: number | undefined;
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

// ── Fase 2 — SiteNetwork ──────────────────────────────────────────────────────

export type AddSiteNetworkPayload = {
  siteId: string;
  name: string;
  purpose: NetworkPurpose;
  addressFamily: AddressFamily;
  thirdOctet: number;
  cidr: number;
};

export type RemoveSiteNetworkPayload = {
  id: string;
};

// ── Fase 2 — Subnet ───────────────────────────────────────────────────────────

export type AddSubnetPayload = {
  siteId: string;
  networkId: string;
  vlanId?: number;
  name: string;
  cidr: number;
  networkAddress: string;
};

export type RemoveSubnetPayload = {
  id: string;
};

export type AddSiteVlanPayload = {
  siteId: string;
  vlanId: number;
  name?: string;
  capacity: number;
  startRadical: string;
  /** Fase 2 — rede lógica à qual esta VLAN pertence */
  networkId?: string;
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

// ── Fase 3 — CustomService ────────────────────────────────────────────────────

export type AddCustomServicePayload = {
  name: string;
  protocol: CustomServiceProto;
  dstPort?: string;
  srcPort?: string;
  icmpType?: number;
  description?: string;
};

export type UpdateCustomServicePayload = {
  id: string;
  changes: Partial<Omit<AddCustomServicePayload, 'name'> & { name: string }>;
};

export type RemoveCustomServicePayload = { id: string };

// ── Fase 3 — Certificate ─────────────────────────────────────────────────────

export type AddCertificatePayload = {
  name: string;
  type: CertificateType;
  cn?: string;
  issuer?: string;
  expiresAt?: string;
  fingerprint?: string;
  description?: string;
};

export type UpdateCertificatePayload = {
  id: string;
  changes: Partial<Omit<AddCertificatePayload, 'name'> & { name: string }>;
};

export type RemoveCertificatePayload = { id: string };

// ── Fase 3 — IPsec SA ────────────────────────────────────────────────────────

export type AddIpsecSaPayload = {
  linkId: string;
  name: string;
  phase: 1 | 2;
  state?: IpsecSaState;
  encAlg?: string;
  hashAlg?: string;
  dhGroup?: number;
  lifetimeSec?: number;
  localId?: string;
  remoteId?: string;
};

export type UpdateIpsecSaPayload = {
  id: string;
  changes: Partial<Omit<AddIpsecSaPayload, 'linkId'>>;
};

export type RemoveIpsecSaPayload = { id: string };

// ── Fase 3 — SSL-VPN Profile ─────────────────────────────────────────────────

export type AddSslVpnProfilePayload = {
  linkId: string;
  name: string;
  authMode?: SslVpnAuthMode;
  ipPool?: string;
  dns1?: string;
  dns2?: string;
  splitTunnelRoutes?: string[];
  serverCertId?: string;
  mfaEnabled?: boolean;
  description?: string;
};

export type UpdateSslVpnProfilePayload = {
  id: string;
  changes: Partial<Omit<AddSslVpnProfilePayload, 'linkId'>>;
};

export type RemoveSslVpnProfilePayload = { id: string };

// ── Fase 3 — Firewall Policy ─────────────────────────────────────────────────

export type AddFwPolicyPayload = {
  nodeId: string;
  name: string;
  srcInterface?: string;
  dstInterface?: string;
  srcAddress?: string;
  dstAddress?: string;
  service?: string;
  action?: FwPolicyAction;
  logTraffic?: boolean;
  natEnabled?: boolean;
  srcZone?: string;
  dstZone?: string;
};

export type UpdateFwPolicyPayload = {
  id: string;
  changes: Partial<
    Omit<AddFwPolicyPayload, 'nodeId'> & { enabled: boolean; priority: number }
  >;
};

export type RemoveFwPolicyPayload = { id: string };

// ── Fase 3 — NAT Rule ────────────────────────────────────────────────────────

export type AddNatRulePayload = {
  nodeId: string;
  name: string;
  type: NatType;
  originalAddr: string;
  translatedAddr: string;
  originalPort?: string;
  translatedPort?: string;
  protocol?: 'tcp' | 'udp' | 'any';
};

export type UpdateNatRulePayload = {
  id: string;
  changes: Partial<Omit<AddNatRulePayload, 'nodeId'> & { enabled: boolean }>;
};

export type RemoveNatRulePayload = { id: string };

// ── Fase 3 — Active Session ──────────────────────────────────────────────────

export type AddActiveSessionPayload = {
  nodeId: string;
  srcIp: string;
  srcPort?: number;
  dstIp: string;
  dstPort?: number;
  protocol: SessionProto;
  state?: SessionState;
  txBytes?: number;
  rxBytes?: number;
  ttlSec?: number;
  srcVlan?: number;
};

export type ClearActiveSessionsPayload = { nodeId: string };

// ── Fase 3 — QoS na AclRule (UpdateAclRulePayload já existente é expandido) ──
// O campo `changes` de UpdateAclRulePayload precisa incluir os novos campos QoS.
// Substitui a declaração original:
export type UpdateAclRuleQoSPayload = {
  id: string;
  dscpMark?: number;
  trafficClass?: 'critical' | 'voice' | 'video' | 'bulk' | 'best-effort';
  guaranteedBwKbps?: number;
  maxBwKbps?: number;
};

export type SetAclChildOverridePayload = {
  /** ID da AclRule pai */
  ruleId: string;
  /** ID composto da linha de expansão */
  childId: string;
  /** Ação de sobrescrita. null = remover a sobrescrita (voltar ao padrão da regra pai) */
  action: import('./entities').AclAction | null;
};
