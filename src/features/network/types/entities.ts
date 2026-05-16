import type { AclAction, LinkKind, NodeCategory } from './primitives';
import type { NodeTechProfile } from './techProfile.type';

/** Papel arquitetural de uma camada no modelo OSI físico / lógico */
export type LayerTier =
  | 'edge'
  | 'distribution'
  | 'access'
  | 'endpoint'
  | 'dmz'
  | 'management'
  | 'custom';

/** Família de endereçamento de uma rede lógica */
export type AddressFamily =
  | '200.x' // padrão legado do projeto
  | '10.x'
  | '172.x'
  | '192.168.x';

/** Modo de pilha IP aplicado a uma LAN (governança de transição). */
export type NetworkStackMode = 'ipv4' | 'dual-stack' | 'ipv6-ready';

/** Política esperada de gateway por LAN. */
export type NetworkGatewayMode = 'ipv4-only' | 'dual-gateway';

/** Política de registros DNS para os ativos da LAN. */
export type NetworkDnsPolicy = 'a-only' | 'a-aaaa';

/** Preferência operacional de tráfego na LAN durante transição para IPv6. */
export type NetworkTrafficPreference =
  | 'ipv4-preferred'
  | 'balanced'
  | 'ipv6-preferred'
  | 'ipv6-strict';

/** Modo de entrega de endereçamento ao host na VLAN (descritivo). */
export type AddressAllocationMode =
  | 'dhcpv4'
  | 'dhcpv6'
  | 'slaac'
  | 'dual-dhcp-slaac'
  | 'static-ipv4'
  | 'static-ipv6'
  | 'static-dual';

/** Forma de oferta de DHCP para uma VLAN. */
export type DhcpScopeProviderType = 'node' | 'relay' | 'external';

/** Política de autoconfiguração IPv6 atrelada ao escopo DHCP da VLAN. */
export type DhcpScopeIpv6Mode =
  | 'none'
  | 'slaac'
  | 'dhcpv6-stateless'
  | 'dhcpv6-stateful';

/**
 * P13 — Classe de tráfego para QoS (por VLAN ou por regra).
 * Determina DSCP padrão e prioridade de fila.
 */
export type QosClass =
  | 'voice'     // DSCP EF 46 — voz/tempo-real, menor latência
  | 'video'     // DSCP AF41 34 — videoconferência
  | 'critical'  // DSCP AF31 26 — sistemas críticos
  | 'infra'     // DSCP CS2 16 — DNS, DHCP, AD, NTP
  | 'default'   // DSCP CS0 0  — best effort
  | 'low';      // DSCP CS1 8  — backup, impressão pesada

/** P14 — Nível de confiança QoS de um nó (trust boundary). */
export type QosTrust = 'trusted' | 'untrusted' | 'partial';

/** Propósito semântico de uma rede lógica */
export type NetworkPurpose =
  | 'principal'
  | 'dmz'
  | 'gestao'
  | 'cliente'
  | 'backup'
  | 'custom';

/**
 * Fase 2 — Rede lógica de um site. Agrupa VLANs e sub-redes sob um
 * espaço de endereçamento coerente (addressFamily + 3º octeto).
 */
export type SiteNetwork = {
  id: string;
  siteId: string;
  name: string;
  purpose: NetworkPurpose;
  /** Família de endereçamento — determina o 1º/2º octeto */
  addressFamily: AddressFamily;
  /** 3º octeto dentro da família escolhida */
  thirdOctet: number;
  /** CIDR do bloco total da rede (ex: 24 → /24) */
  cidr: number;
  /** V2-A — governança de stack IP (sem alterar motor de roteamento). */
  stackMode?: NetworkStackMode;
  /** V2-A — expectativa operacional de gateway (somente v4 ou dual). */
  gatewayMode?: NetworkGatewayMode;
  /** V2-A — política de DNS da LAN (A ou A+AAAA). */
  dnsPolicy?: NetworkDnsPolicy;
  /** V2-A — prefixo IPv6 planejado para a LAN (documentação). */
  ipv6Prefix?: string;
  /** V2-A — tamanho padrão de prefixo IPv6 por VLAN (boas práticas: /64). */
  ipv6VlanPrefixLength?: number;
  /** V2-D — preferência de tráfego e fallback entre famílias de IP. */
  trafficPreference?: NetworkTrafficPreference;
};

/**
 * Fase 2 — Sub-rede dentro de uma VLAN (ou diretamente de uma SiteNetwork).
 * Subdivide um bloco VLAN em segmentos menores.
 */
export type Subnet = {
  id: string;
  siteId: string;
  networkId: string;
  /** vlanId à qual pertence; undefined = sub-rede direta da rede */
  vlanId?: number;
  name: string;
  /** CIDR da sub-rede (ex: 26 → /26) */
  cidr: number;
  /** IP de rede da sub-rede (ex: '200.10.1.0') */
  networkAddress: string;
  /** Prefixo IPv6 planejado para a sub-rede (somente documentação). */
  ipv6Prefix?: string;
};

export type Site = {
  id: string;
  name: string;
  ipOctet: number;
  cidr: number;
  reserveMarginPercent: number;
  /** P5 — família de endereçamento padrão do site (herda para suas LANs) */
  addressFamily?: AddressFamily;
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
  /** Fase 1 — papel arquitetural da camada */
  tier?: LayerTier;
  /** Fase 2 — rede lógica à qual esta camada pertence */
  networkId?: string;
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
  /** P2 — cor atribuída automaticamente pela paleta do site */
  color?: string;
  /** Fase 2 — rede lógica à qual esta VLAN pertence */
  networkId?: string;
  /** P13 — classe de tráfego QoS desta VLAN */
  qosClass?: QosClass;
  /** V2-B — prefixo IPv6 planejado para a VLAN. */
  ipv6Prefix?: string;
  /** V2-B — estratégia de alocação de endereço para hosts da VLAN. */
  addressAllocation?: AddressAllocationMode;
};

export type NodeItem = {
  id: string;
  siteId?: string;
  layerId?: string;
  label: string;
  category: NodeCategory;
  ip: string;
  ipv6?: string;
  originalIp?: string;
  originalIpv6?: string;
  hostCount: number;
  hostAllocations: Array<{ id: string; ip: string }>;
  cidr: number;
  vlans: number[];
  x: number;
  y: number;
  description: string;
  techProfile?: NodeTechProfile;
  /** Fase 1 — zona de segurança do nó (wan/dmz/lan/guest/vpn) */
  zone?: string;
  /** Fase 2 — rede lógica à qual este nó pertence */
  networkId?: string;
  /** P14 — nível de confiança QoS (trust boundary) */
  qosTrust?: QosTrust;
};

export type LinkItem = {
  id: string;
  from: string;
  to: string;
  kind: LinkKind;
  /** Controle lógico de direção de tráfego na topologia (ida e volta). */
  bidirectional?: boolean;
  /** Modo físico de transmissão esperado para o enlace. */
  duplexMode?: LinkDuplexMode;
  generateAcl?: boolean;
  statefulOverride?: 'inherited' | 'force-stateful' | 'force-stateless';
  description?: string;
  /** P15 — marcação DSCP explícita no link (0–63) */
  dscp?: number;
  /** P15 — o nó de destino confia na marcação DSCP recebida */
  trustIngress?: boolean;
  /** P17 — política QoS para links WAN/inter-site */
  wanQosPolicy?: WanQosPolicy;
};

/**
 * P17 — Política QoS para links WAN (inter-site, VPN, MPLS).
 * Define classes garantidas/suprimidas, banda e comportamento de túnel.
 */
export type WanQosPolicy = {
  /** Banda total do link em kbps */
  totalBandwidthKbps?: number;
  /** Classes de tráfego com banda garantida na WAN */
  guaranteedClasses: QosClass[];
  /** Classes de tráfego suprimidas/limitadas na WAN */
  suppressedClasses: QosClass[];
  /** Há encapsulamento VPN/IPsec no link */
  ipsecEncap: boolean;
  /** Copiar DSCP para o cabeçalho externo do túnel (preserva prioridade) */
  dscpCopyToOuter: boolean;
};

/** Modo de operação de duplex para o enlace. */
export type LinkDuplexMode = 'full' | 'half';

export type AclEndpointScope =
  | 'node'
  | 'vlan'
  | 'ip'
  | 'ip-list'
  | 'any'
  | 'subnet'
  | 'zone';

// ── Fase 3 — Serviço personalizado ────────────────────────────────────────────
/** Protocolo suportado num serviço customizado */
export type CustomServiceProto =
  | 'tcp'
  | 'udp'
  | 'tcp-udp'
  | 'icmp'
  | 'gre'
  | 'esp'
  | 'other';

/**
 * Serviço de rede nomeado (análogo a objetos "service" do FortiGate/Cisco).
 * Pode ser referenciado pelo campo `service` das AclRules.
 */
export type CustomService = {
  id: string;
  name: string;
  protocol: CustomServiceProto;
  /** Porta ou range de destino, ex: '443', '8000-8080' */
  dstPort?: string;
  /** Porta ou range de origem */
  srcPort?: string;
  /** Tipo ICMP (0-255) */
  icmpType?: number;
  description?: string;
};

// ── Fase 3 — Certificado ─────────────────────────────────────────────────────
export type CertificateType = 'local' | 'ca' | 'remote' | 'crl';

export type Certificate = {
  id: string;
  name: string;
  type: CertificateType;
  /** Subject CN */
  cn?: string;
  /** Emissor */
  issuer?: string;
  /** Data de validade ISO-8601 */
  expiresAt?: string;
  /** Huella/fingerprint SHA-256 (exibição) */
  fingerprint?: string;
  description?: string;
};

// ── Fase 3 — IPsec SA (Security Association) ─────────────────────────────────
export type IpsecSaState = 'established' | 'rekeying' | 'down' | 'connecting';

export type IpsecSA = {
  id: string;
  /** linkId ao qual esta SA pertence */
  linkId: string;
  name: string;
  phase: 1 | 2;
  state: IpsecSaState;
  /** Algoritmo de cifra (ex: aes256) */
  encAlg?: string;
  /** Algoritmo de hash/integridade (ex: sha256) */
  hashAlg?: string;
  /** Grupo Diffie-Hellman */
  dhGroup?: number;
  /** Lifetime em segundos */
  lifetimeSec?: number;
  /** Bytes transmitidos */
  txBytes?: number;
  /** Bytes recebidos */
  rxBytes?: number;
  localId?: string;
  remoteId?: string;
};

// ── Fase 3 — SSL-VPN Profile ──────────────────────────────────────────────────
export type SslVpnAuthMode = 'certificate' | 'password' | 'ldap' | 'radius';

export type SslVpnProfile = {
  id: string;
  /** linkId ao qual este perfil pertence */
  linkId: string;
  name: string;
  authMode: SslVpnAuthMode;
  /** CIDR do pool de IPs para clientes, ex: '10.0.50.0/24' */
  ipPool?: string;
  /** DNS primário para clientes */
  dns1?: string;
  dns2?: string;
  /** Rotas anunciadas para o cliente (split tunnel), ex: ['10.0.0.0/8'] */
  splitTunnelRoutes?: string[];
  /** Certificado de servidor (id de Certificate) */
  serverCertId?: string;
  /** MFA habilitado */
  mfaEnabled?: boolean;
  description?: string;
};

// ── Fase 3 — Firewall Policy ─────────────────────────────────────────────────
export type FwPolicyAction = 'accept' | 'deny' | 'ipsec';

export type FirewallPolicy = {
  id: string;
  /** nodeId do firewall ao qual pertence */
  nodeId: string;
  name: string;
  srcInterface?: string;
  dstInterface?: string;
  /** IPs/objetos de origem */
  srcAddress?: string;
  /** IPs/objetos de destino */
  dstAddress?: string;
  service?: string;
  action: FwPolicyAction;
  logTraffic?: boolean;
  natEnabled?: boolean;
  /** Zona de origem */
  srcZone?: string;
  /** Zona de destino */
  dstZone?: string;
  enabled: boolean;
  priority: number;
};

// ── Fase 3 — NAT Rule ────────────────────────────────────────────────────────
export type NatType = 'snat' | 'dnat' | 'pat';

export type FirewallNatRule = {
  id: string;
  /** nodeId do firewall ao qual pertence */
  nodeId: string;
  name: string;
  type: NatType;
  /** IP/rede original */
  originalAddr: string;
  /** IP/rede traduzido */
  translatedAddr: string;
  /** Porta original (DNAT/PAT) */
  originalPort?: string;
  /** Porta traduzida */
  translatedPort?: string;
  /** Protocolo */
  protocol?: 'tcp' | 'udp' | 'any';
  enabled: boolean;
};

// ── Fase 3 — Sessão Ativa ────────────────────────────────────────────────────
export type SessionState =
  | 'ESTABLISHED'
  | 'SYN_SENT'
  | 'TIME_WAIT'
  | 'UDP'
  | 'ICMP';
export type SessionProto = 'tcp' | 'udp' | 'icmp';

export type ActiveSession = {
  id: string;
  /** nodeId do firewall que origina a sessão */
  nodeId: string;
  srcIp: string;
  srcPort?: number;
  dstIp: string;
  dstPort?: number;
  protocol: SessionProto;
  state: SessionState;
  /** Bytes transmitidos */
  txBytes?: number;
  /** Bytes recebidos */
  rxBytes?: number;
  /** Expiração em segundos */
  ttlSec?: number;
  /** VLAN de origem */
  srcVlan?: number;
};

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
  // ── Fase 3 — QoS / DSCP ───────────────────────────────────────────────────
  /** Marcação DSCP (0-63), undefined = não marcar */
  dscpMark?: number;
  /** Classe de tráfego para scheduling */
  trafficClass?: 'critical' | 'voice' | 'video' | 'bulk' | 'best-effort';
  /** Largura de banda garantida em kbps */
  guaranteedBwKbps?: number;
  /** Largura de banda máxima em kbps */
  maxBwKbps?: number;
  /**
   * Sobrescritas de ação por linha de expansão (IP/VLAN individual).
   * Chave: ID composto da linha de expansão (ex: "ruleId|sv10|dv20").
   * Valor: AclAction ("ALLOW" | "DENY") que sobrescreve a ação da regra pai.
   */
  childOverrides?: Record<string, AclAction>;
};

/** P9 — alias semântico; SiteNetwork e SiteLan são intercambiáveis */
export type SiteLan = SiteNetwork;

/**
 * P16 — Fila de QoS configurada em um dispositivo de rede ativo.
 * Representa uma entrada na política de scheduling do equipamento.
 */
export type QosQueue = {
  id: string;
  /** Nome da fila (ex: 'q0', 'voz', 'crítico') */
  name: string;
  /** Classe de tráfego que alimenta esta fila */
  trafficClass: QosClass;
  /** Percentual mínimo de banda reservada (0–100) */
  minBandwidthPercent?: number;
  /** Tipo de disciplina de fila */
  priority: 'strict' | 'weighted' | 'best-effort';
};

/**
 * P16 — Perfil QoS de saída de um nó ativo (router/firewall/switch L3).
 * Agrupa as filas de scheduling configuradas no equipamento.
 */
export type NodeQosProfile = {
  /** ID do nó (router / firewall / switch) */
  nodeId: string;
  queues: QosQueue[];
};

/**
 * P11 — Interface VLAN num nó ativo (router, firewall, switch L3).
 * Representa a porta lógica que conecta o nó a uma VLAN com IP de gateway.
 */
export type NodeVlanInterface = {
  id: string;
  /** ID do nó (router / firewall / switch) */
  nodeId: string;
  /** ID do site ao qual o nó pertence */
  siteId: string;
  /** VLAN ID 802.1Q */
  vlanId: number;
  /** IP de gateway desta interface (ex: '200.10.10.1') */
  gatewayIp: string;
  /** Gateway IPv6 planejado para a interface VLAN (opcional). */
  gatewayIpv6?: string;
  /** Descrição opcional da interface */
  description?: string;
};

/**
 * Escopo DHCP por VLAN. Define onde o serviço está, faixa/política e dados
 * auxiliares para orquestração em modo dinâmico.
 */
export type DhcpScope = {
  id: string;
  siteId: string;
  vlanId: number;
  /** Modo de alocação da VLAN associado a este escopo. */
  allocationMode: AddressAllocationMode;
  /** Onde o serviço DHCP está posicionado. */
  providerType: DhcpScopeProviderType;
  /** Nó que atua como servidor DHCP (quando providerType='node'). */
  providerNodeId?: string;
  /** Nó que atua como relay/forwarder (quando aplicável). */
  relayNodeId?: string;
  /** Faixa IPv4 do pool DHCP (quando aplicável). */
  poolStartIp?: string;
  poolEndIp?: string;
  /** Exclusões de IP (hosts fixos, gateways, reserva técnica). */
  excludedIps?: string[];
  /** Tempo de concessão em minutos. */
  leaseMinutes?: number;
  /** DNS IPv4 entregue pelo DHCP. */
  dnsServers?: string[];
  /** Política IPv6 da VLAN (RA/SLAAC ou DHCPv6). */
  ipv6Mode?: DhcpScopeIpv6Mode;
  /** DNS IPv6 entregue para hosts dual/ipv6. */
  ipv6DnsServers?: string[];
  notes?: string;
};

export type NetworkState = {
  sites: Site[];
  layers: Layer[];
  nodes: NodeItem[];
  links: LinkItem[];
  aclRules: AclRule[];
  siteVlans: SiteVlan[];
  /** Fase 2 — redes lógicas por site */
  siteNetworks: SiteNetwork[];
  /** Fase 2 — sub-redes dentro de VLANs ou redes */
  subnets: Subnet[];
  /** P11 — interfaces VLAN em roteadores / firewalls / switches */
  nodeVlanInterfaces: NodeVlanInterface[];
  /** Escopos DHCP por VLAN (orquestração L2/L3). */
  dhcpScopes: DhcpScope[];
  /** P16 — perfis QoS por dispositivo de rede ativo */
  nodeQosProfiles: NodeQosProfile[];
  // ── Fase 3 ────────────────────────────────────────────────────────────────
  /** Serviços de rede personalizados (referenciáveis nas ACLs) */
  customServices: CustomService[];
  /** Certificados gerenciados (usados em VPN SSL, IPsec, etc.) */
  certificates: Certificate[];
  /** Security Associations IPsec simuladas por link */
  ipsecSas: IpsecSA[];
  /** Perfis SSL-VPN por link */
  sslVpnProfiles: SslVpnProfile[];
  /** Políticas de firewall por nó */
  fwPolicies: FirewallPolicy[];
  /** Regras de NAT por nó */
  natRules: FirewallNatRule[];
  /** Sessões ativas simuladas por nó de firewall */
  activeSessions: ActiveSession[];
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
