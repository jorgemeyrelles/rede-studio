import type {
  TechFieldSchema,
  TechKind,
  TechProfileContext,
  TechValue,
} from '../types';

export const TECH_PROFILE_VERSION = 1;

export const TECH_SCHEMA: Record<TechKind, TechFieldSchema[]> = {
  router: [
    {
      key: 'gatewayDefault',
      label: 'Gateway Padrao',
      labels: {
        pt: 'Gateway Padrão',
        en: 'Default Gateway',
        es: 'Gateway Predeterminado',
      },
      type: 'boolean',
    },
    {
      key: 'routingMode',
      label: 'Roteamento',
      labels: { pt: 'Roteamento', en: 'Routing', es: 'Enrutamiento' },
      type: 'select',
      options: ['static', 'ospf', 'bgp', 'mixed'],
    },
    {
      key: 'natMode',
      label: 'NAT',
      labels: { pt: 'NAT', en: 'NAT', es: 'NAT' },
      type: 'select',
      options: ['none', 'snat', 'dnat', 'pat', 'hybrid'],
    },
    {
      key: 'stateMode',
      label: 'Estado',
      labels: { pt: 'Estado', en: 'State', es: 'Estado' },
      type: 'select',
      options: ['stateful', 'stateless', 'n-a'],
    },
    {
      key: 'wanUplink',
      label: 'Uplink WAN',
      labels: { pt: 'Uplink WAN', en: 'WAN Uplink', es: 'Enlace WAN' },
      type: 'text',
    },
  ],
  firewall: [
    {
      key: 'gatewayDefault',
      label: 'Gateway Padrao',
      labels: {
        pt: 'Gateway Padrão',
        en: 'Default Gateway',
        es: 'Gateway Predeterminado',
      },
      type: 'boolean',
    },
    {
      key: 'natMode',
      label: 'NAT',
      labels: { pt: 'NAT', en: 'NAT', es: 'NAT' },
      type: 'select',
      options: ['none', 'snat', 'dnat', 'pat', 'hybrid'],
    },
    {
      key: 'stateMode',
      label: 'Modo de Inspecao',
      labels: {
        pt: 'Modo de Inspeção',
        en: 'Inspection Mode',
        es: 'Modo de Inspección',
      },
      type: 'select',
      options: ['stateful', 'stateless'],
    },
    {
      key: 'defaultPolicy',
      label: 'Politica Padrao',
      labels: {
        pt: 'Política Padrão',
        en: 'Default Policy',
        es: 'Política Predeterminada',
      },
      type: 'select',
      options: ['deny', 'allow'],
    },
    {
      key: 'idsIpsIntegration',
      label: 'Integracao IDS/IPS',
      labels: {
        pt: 'Integração IDS/IPS',
        en: 'IDS/IPS Integration',
        es: 'Integración IDS/IPS',
      },
      type: 'select',
      options: ['none', 'ids', 'ips', 'both'],
    },
  ],
  vpn: [
    {
      key: 'tunnelType',
      label: 'Tipo de Tunel',
      labels: { pt: 'Tipo de Túnel', en: 'Tunnel Type', es: 'Tipo de Túnel' },
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
    {
      key: 'encryptionSuite',
      label: 'Criptografia',
      labels: { pt: 'Criptografia', en: 'Encryption', es: 'Cifrado' },
      type: 'text',
    },
    {
      key: 'authMethod',
      label: 'Autenticacao',
      labels: { pt: 'Autenticação', en: 'Authentication', es: 'Autenticación' },
      type: 'select',
      options: ['psk', 'certificate', 'eap', 'keypair', 'none'],
    },
    {
      key: 'ikeVersion',
      label: 'IKE',
      labels: { pt: 'IKE', en: 'IKE', es: 'IKE' },
      type: 'select',
      options: ['ikev1', 'ikev2', 'n-a'],
    },
    {
      key: 'remotePeer',
      label: 'Peer Remoto',
      labels: { pt: 'Peer Remoto', en: 'Remote Peer', es: 'Par Remoto' },
      type: 'text',
    },
    {
      key: 'dpdKeepalive',
      label: 'DPD/Keepalive',
      labels: { pt: 'DPD/Keepalive', en: 'DPD/Keepalive', es: 'DPD/Keepalive' },
      type: 'boolean',
    },
    {
      key: 'failoverPolicy',
      label: 'Failover',
      labels: { pt: 'Failover', en: 'Failover', es: 'Failover' },
      type: 'select',
      options: ['manual', 'active-passive', 'active-active'],
    },
  ],
  ids: [
    {
      key: 'inspectionMode',
      label: 'Modo',
      labels: { pt: 'Modo', en: 'Mode', es: 'Modo' },
      type: 'select',
      options: ['ids', 'ips'],
    },
    {
      key: 'signatureProfile',
      label: 'Perfil de Assinatura',
      labels: {
        pt: 'Perfil de Assinatura',
        en: 'Signature Profile',
        es: 'Perfil de Firma',
      },
      type: 'select',
      options: ['balanced', 'strict', 'custom'],
    },
    {
      key: 'anomalyDetection',
      label: 'Deteccao de Anomalia',
      labels: {
        pt: 'Detecção de Anomalia',
        en: 'Anomaly Detection',
        es: 'Detección de Anomalía',
      },
      type: 'boolean',
    },
    {
      key: 'responseAction',
      label: 'Acao',
      labels: { pt: 'Ação', en: 'Action', es: 'Acción' },
      type: 'select',
      options: ['alert', 'drop', 'quarantine'],
    },
    {
      key: 'feedUpdate',
      label: 'Atualizacao de Feed',
      labels: {
        pt: 'Atualização de Feed',
        en: 'Feed Update',
        es: 'Actualización de Feed',
      },
      type: 'select',
      options: ['auto', 'manual'],
    },
  ],
  'access-point': [
    {
      key: 'ssid',
      label: 'SSID',
      labels: { pt: 'SSID', en: 'SSID', es: 'SSID' },
      type: 'text',
    },
    {
      key: 'band',
      label: 'Banda',
      labels: { pt: 'Banda', en: 'Band', es: 'Banda' },
      type: 'select',
      options: ['2.4GHz', '5GHz', '6GHz', 'dual-band'],
    },
    {
      key: 'channelWidth',
      label: 'Largura de Canal',
      labels: {
        pt: 'Largura de Canal',
        en: 'Channel Width',
        es: 'Ancho de Canal',
      },
      type: 'select',
      options: ['20MHz', '40MHz', '80MHz', '160MHz'],
    },
    {
      key: 'wirelessSecurity',
      label: 'Seguranca',
      labels: { pt: 'Segurança', en: 'Security', es: 'Seguridad' },
      type: 'select',
      options: ['wpa2-psk', 'wpa3-psk', 'wpa2-enterprise', 'wpa3-enterprise'],
    },
    {
      key: 'authServer',
      label: 'Servidor AAA',
      labels: { pt: 'Servidor AAA', en: 'AAA Server', es: 'Servidor AAA' },
      type: 'text',
      visibleWhen: {
        wirelessSecurity: [
          'wpa2-enterprise',
          'wpa3-enterprise',
        ] satisfies TechValue[],
      },
    },
    {
      key: 'vlanMapping',
      label: 'Mapeamento VLAN',
      labels: {
        pt: 'Mapeamento VLAN',
        en: 'VLAN Mapping',
        es: 'Asignación VLAN',
      },
      type: 'text',
    },
    {
      key: 'controllerMode',
      label: 'Modo de Controle',
      labels: {
        pt: 'Modo de Controle',
        en: 'Controller Mode',
        es: 'Modo de Controlador',
      },
      type: 'select',
      options: ['standalone', 'managed'],
    },
    {
      key: 'guestIsolation',
      label: 'Isolamento Cliente',
      labels: {
        pt: 'Isolamento de Cliente',
        en: 'Guest Isolation',
        es: 'Aislamiento de Invitados',
      },
      type: 'boolean',
    },
  ],
  printer: [
    {
      key: 'printerProtocol',
      label: 'Protocolo',
      labels: { pt: 'Protocolo', en: 'Protocol', es: 'Protocolo' },
      type: 'select',
      options: ['tcp-ip', 'ipp', 'lpr'],
    },
    {
      key: 'queueName',
      label: 'Fila',
      labels: { pt: 'Fila', en: 'Queue', es: 'Cola' },
      type: 'text',
    },
    {
      key: 'dhcpReserved',
      label: 'DHCP Reservado',
      labels: {
        pt: 'DHCP Reservado',
        en: 'DHCP Reserved',
        es: 'DHCP Reservado',
      },
      type: 'boolean',
    },
    {
      key: 'snmpEnabled',
      label: 'SNMP',
      labels: { pt: 'SNMP', en: 'SNMP', es: 'SNMP' },
      type: 'boolean',
    },
  ],
  generic: [
    {
      key: 'role',
      label: 'Funcao',
      labels: { pt: 'Função', en: 'Role', es: 'Función' },
      type: 'text',
    },
  ],
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
