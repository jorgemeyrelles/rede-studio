import type { TechFieldSchema, TechKind, TechProfileContext, TechValue } from '../types';

export const TECH_PROFILE_VERSION = 1;

export const TECH_SCHEMA: Record<TechKind, TechFieldSchema[]> = {
  router: [
    { key: 'gatewayDefault', label: 'Gateway Padrao', type: 'boolean' },
    {
      key: 'routingMode',
      label: 'Roteamento',
      type: 'select',
      options: ['static', 'ospf', 'bgp', 'mixed'],
    },
    {
      key: 'natMode',
      label: 'NAT',
      type: 'select',
      options: ['none', 'snat', 'dnat', 'pat', 'hybrid'],
    },
    {
      key: 'stateMode',
      label: 'Estado',
      type: 'select',
      options: ['stateful', 'stateless', 'n-a'],
    },
    { key: 'wanUplink', label: 'Uplink WAN', type: 'text' },
  ],
  firewall: [
    { key: 'gatewayDefault', label: 'Gateway Padrao', type: 'boolean' },
    {
      key: 'natMode',
      label: 'NAT',
      type: 'select',
      options: ['none', 'snat', 'dnat', 'pat', 'hybrid'],
    },
    {
      key: 'stateMode',
      label: 'Modo de Inspecao',
      type: 'select',
      options: ['stateful', 'stateless'],
    },
    {
      key: 'defaultPolicy',
      label: 'Politica Padrao',
      type: 'select',
      options: ['deny', 'allow'],
    },
    {
      key: 'idsIpsIntegration',
      label: 'Integracao IDS/IPS',
      type: 'select',
      options: ['none', 'ids', 'ips', 'both'],
    },
  ],
  vpn: [
    {
      key: 'tunnelType',
      label: 'Tipo de Tunel',
      type: 'select',
      options: [
        'ipsec-site-to-site',
        'ssl-remote',
        'wireguard',
        'sdwan',
        'mpls',
        'gre',
      ],
    },
    { key: 'encryptionSuite', label: 'Criptografia', type: 'text' },
    {
      key: 'authMethod',
      label: 'Autenticacao',
      type: 'select',
      options: ['psk', 'certificate', 'eap', 'keypair', 'none'],
    },
    {
      key: 'ikeVersion',
      label: 'IKE',
      type: 'select',
      options: ['ikev1', 'ikev2', 'n-a'],
    },
    { key: 'remotePeer', label: 'Peer Remoto', type: 'text' },
    { key: 'dpdKeepalive', label: 'DPD/Keepalive', type: 'boolean' },
    {
      key: 'failoverPolicy',
      label: 'Failover',
      type: 'select',
      options: ['manual', 'active-passive', 'active-active'],
    },
  ],
  ids: [
    {
      key: 'inspectionMode',
      label: 'Modo',
      type: 'select',
      options: ['ids', 'ips'],
    },
    {
      key: 'signatureProfile',
      label: 'Perfil de Assinatura',
      type: 'select',
      options: ['balanced', 'strict', 'custom'],
    },
    {
      key: 'anomalyDetection',
      label: 'Deteccao de Anomalia',
      type: 'boolean',
    },
    {
      key: 'responseAction',
      label: 'Acao',
      type: 'select',
      options: ['alert', 'drop', 'quarantine'],
    },
    {
      key: 'feedUpdate',
      label: 'Atualizacao de Feed',
      type: 'select',
      options: ['auto', 'manual'],
    },
  ],
  'access-point': [
    { key: 'ssid', label: 'SSID', type: 'text' },
    {
      key: 'band',
      label: 'Banda',
      type: 'select',
      options: ['2.4GHz', '5GHz', '6GHz', 'dual-band'],
    },
    {
      key: 'channelWidth',
      label: 'Largura de Canal',
      type: 'select',
      options: ['20MHz', '40MHz', '80MHz', '160MHz'],
    },
    {
      key: 'wirelessSecurity',
      label: 'Seguranca',
      type: 'select',
      options: ['wpa2-psk', 'wpa3-psk', 'wpa2-enterprise', 'wpa3-enterprise'],
    },
    {
      key: 'authServer',
      label: 'Servidor AAA',
      type: 'text',
      visibleWhen: {
        wirelessSecurity: ['wpa2-enterprise', 'wpa3-enterprise'] satisfies TechValue[],
      },
    },
    { key: 'vlanMapping', label: 'Mapeamento VLAN', type: 'text' },
    {
      key: 'controllerMode',
      label: 'Modo de Controle',
      type: 'select',
      options: ['standalone', 'managed'],
    },
    { key: 'guestIsolation', label: 'Isolamento Cliente', type: 'boolean' },
  ],
  printer: [
    {
      key: 'printerProtocol',
      label: 'Protocolo',
      type: 'select',
      options: ['tcp-ip', 'ipp', 'lpr'],
    },
    { key: 'queueName', label: 'Fila', type: 'text' },
    { key: 'dhcpReserved', label: 'DHCP Reservado', type: 'boolean' },
    { key: 'snmpEnabled', label: 'SNMP', type: 'boolean' },
  ],
  generic: [{ key: 'role', label: 'Funcao', type: 'text' }],
};

export const DEFAULT_TECH_FIELDS_BY_KIND: Record<
  TechKind,
  (context: TechProfileContext) => Record<string, TechValue>
> = {
  router: (context) => ({
    gatewayDefault: context.shouldBeGateway,
    routingMode: context.layerOrder === 1 ? 'ospf' : 'static',
    natMode: context.layerOrder === 1 ? 'pat' : 'none',
    stateMode: 'stateful',
    wanUplink: 'ethernet-1g',
  }),
  firewall: (context) => ({
    gatewayDefault: context.shouldBeGateway,
    natMode: 'pat',
    stateMode: 'stateful',
    defaultPolicy: 'deny',
    idsIpsIntegration: 'none',
  }),
  vpn: (context) => ({
    tunnelType:
      {
        vpn: 'ipsec-site-to-site',
        ipsec: 'ipsec-site-to-site',
        wireguard: 'wireguard',
        sdwan: 'sdwan',
        mpls: 'mpls',
        gre: 'gre',
      }[context.category] ?? 'ipsec-site-to-site',
    encryptionSuite: 'aes-256-gcm',
    authMethod: 'psk',
    ikeVersion:
      context.category === 'gre' || context.category === 'mpls'
        ? 'n-a'
        : 'ikev2',
    remotePeer: 'peer.example.net',
    dpdKeepalive: true,
    failoverPolicy: 'active-passive',
  }),
  ids: (context) => ({
    inspectionMode: context.category === 'ips' ? 'ips' : 'ids',
    signatureProfile: 'balanced',
    anomalyDetection: true,
    responseAction: context.category === 'ips' ? 'drop' : 'alert',
    feedUpdate: 'auto',
  }),
  'access-point': () => ({
    ssid: 'CorpWiFi',
    band: 'dual-band',
    channelWidth: '40MHz',
    wirelessSecurity: 'wpa2-enterprise',
    authServer: 'radius.site.local',
    vlanMapping: '40',
    controllerMode: 'managed',
    guestIsolation: true,
  }),
  printer: () => ({
    printerProtocol: 'tcp-ip',
    queueName: 'PRN-CORP',
    dhcpReserved: true,
    snmpEnabled: true,
  }),
  generic: (context) => ({
    role: context.category,
  }),
};