import type { NodeTechProfile } from './techProfile.type';
import type { AclAction, LinkKind, NodeCategory } from './primitives';

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
};

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
  /** Fase 2 — rede lógica à qual esta VLAN pertence */
  networkId?: string;
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
  /** Fase 1 — zona de segurança do nó (wan/dmz/lan/guest/vpn) */
  zone?: string;
  /** Fase 2 — rede lógica à qual este nó pertence */
  networkId?: string;
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
