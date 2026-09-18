import type { AclEndpointScope, LayerTier, LinkDuplexMode } from './entities';
import type { AclAction } from './primitives';

/** P8 — linha de rota derivada de sub-rede ou interface VLAN de gateway */
export type SubnetRouteRow = {
  /** Site ao qual a rota pertence */
  siteId: string;
  siteName: string;
  /** VLAN associada */
  vlanId: number;
  vlanName: string;
  /** Sub-rede de destino — ex: '200.10.10.0/26' */
  destination: string;
  /** Prefixo IPv6 planejado para a rota (quando existir). */
  destinationIpv6?: string;
  /** IP do gateway — vazio se não houver interface VLAN configurada */
  gateway: string;
  /** Gateway IPv6 — vazio quando não configurado */
  gatewayIpv6?: string;
  /** ID do nó gateway (router/firewall) — vazio se não atribuído */
  gatewayNodeId: string;
  gatewayNodeLabel: string;
  /** Nome da sub-rede (se derivada de Subnet) */
  subnetName: string;
};

export type RouteType = 'Direta' | 'Estática' | 'Default' | 'VPN' | 'BGP';

export type RouteRow = {
  siteId: string;
  siteName: string;
  tipo: RouteType;
  vlan: string;
  redeDest: string;
  redeDestIpv6?: string;
  gateway: string;
  gatewayIpv6?: string;
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
  duplexMode: LinkDuplexMode;
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
  linkId?: string;
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

export type BgpNeighborCandidate = {
  nodeId: string;
  nodeLabel: string;
  ip: string;
  remoteAsn?: string;
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
  bgpNeighborCandidates?: BgpNeighborCandidate[];
  bgpPrefixListIn?: string;
  bgpPrefixListOut?: string;
  bgpMd5?: boolean;
  // Warnings
  warnings: string[];
};

export type NetworkReadinessRow = {
  siteId: string;
  siteName: string;
  networkId: string;
  networkName: string;
  level: 'ready' | 'warning' | 'critical';
  issues: string[];
};

/**
 * Sprint equipamentos Fase 6 — linha da tabela única de inventário de
 * equipamentos de sustentação de rede (`selectEquipmentInventory`).
 */
export type EquipmentInventoryRow = {
  id: string;
  nome: string;
  marca: string;
  modelo: string;
  funcao: string;
  site: string;
  lan: string;
  /**
   * Valor bruto do tier da camada (`undefined` quando o nó não tem
   * camada/tier associado) — o rótulo traduzido é resolvido na UI/PDF via
   * `getTierLabel(tier, language, lan)` (Studio i18n), nunca aqui: este é um
   * selector Redux puro, sem acesso ao idioma corrente.
   */
  tier: LayerTier | undefined;
  /**
   * Sprint equipamentos Fase 12 — `true` para linhas derivadas de
   * `node.hostAllocations[i]` (i >= 1), quando o nó representa mais de uma
   * unidade física do mesmo equipamento (mesma marca/modelo/função/site/lan/
   * tier do nó pai). `undefined`/`false` para a linha "pai" (1 por nó).
   */
  isDerivedAllocation?: boolean;
};
