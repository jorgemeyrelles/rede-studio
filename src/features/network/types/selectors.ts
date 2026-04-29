import type { AclAction } from './primitives';
import type { AclEndpointScope } from './entities';

export type RouteType = 'Direta' | 'Estática' | 'Default' | 'VPN' | 'BGP';

export type RouteRow = {
  siteId: string;
  siteName: string;
  tipo: RouteType;
  vlan: string;
  redeDest: string;
  gateway: string;
  iface: string;
  reservedSiteRange?: string;
  reservedSiteCount?: number;
  reserveMarginPercent?: number;
  /** Fase 1 — zona inferida pelo tipo de rota */
  zone: string;
  /** Fase 2 — nome da rede lógica (SiteNetwork); '—' até Fase 2 */
  networkName: string;
};

export type FirewallRuleRow = {
  id: string;
  aclRuleId: string;
  priority: number;
  source: 'topology' | 'manual';
  acao: AclAction;
  origem: string;
  destino: string;
  vlan: string;
  servico: string;
  enabled: boolean;
  managed: boolean;
  stateful: boolean;
  bidirectional: boolean;
  passthrough: boolean;
  natExempt: boolean;
  protocol: string;
  isReturnRule?: boolean;
  hasConflict: boolean;
  missingReturn: boolean;
  isDerivedAllocation: boolean;
  sourceNodeId: string;
  destinationNodeId: string;
  sourceNodeSiteId?: string;
  destinationNodeSiteId?: string;
  sourceScope: AclEndpointScope;
  sourceVlanId?: number;
  sourceIp?: string;
  destinationScope: AclEndpointScope;
  destinationVlanId?: number;
  destinationIp?: string;
  parentRuleId?: string;
  fwNatMode?: 'pat' | 'snat' | 'dnat' | 'hybrid' | 'none';
  ipsecAuthBadge?: 'PSK' | 'PKI' | 'EAP' | 'keypair' | '⚠ sem IKE';
};

export type FirewallGroupedResult = {
  manualRules: FirewallRuleRow[];
  topologyRules: FirewallRuleRow[];
  natExemptRules: FirewallRuleRow[];
};

// ── Routing Protocol Table ────────────────────────────────────────────────────

export type BgpNeighborEntry = {
  ip: string;
  remoteAsn: string;
};

export type RoutingProtocolRow = {
  nodeId: string;
  nodeLabel: string;
  siteId: string;
  siteName: string;
  mode: 'static' | 'ospf' | 'bgp' | 'mixed';
  // OSPF
  ospfArea?: string;
  ospfHello?: number;
  ospfDead?: number;
  // BGP
  bgpAsn?: string;
  bgpNeighborsParsed?: BgpNeighborEntry[];
  bgpNeighborsRaw?: string;
  bgpPrefixListIn?: string;
  bgpPrefixListOut?: string;
  bgpMd5?: boolean;
  // Warnings
  warnings: string[];
};
