import type { Equipment } from '../types';

function getPublicAssetPath(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

// Equipamentos CISCO recomendados para Matriz SP
export const CISCO_ROUTERS: Equipment[] = [
  {
    id: 'cisco-router-matrix',
    name: 'Cisco Catalyst 8300-2N1S-4T2X',
    model: 'C8300-2N1S-4T2X',
    category: 'router',
    vendor: 'cisco',
    site: 'matriz',
    quantity: 1,
    imagePath: getPublicAssetPath(
      'images/equipamentos/cisco/catalyst-8300.svg',
    ),
    imageUrl:
      'https://www.cisco.com/c/dam/assets/support/product-images/series/routers-catalyst-8300-series-edge-platforms.jpg',
    description: 'Roteador SD-WAN de alta performance para matriz corporativa',
    specifications: [
      { parameter: 'Throughput', value: 'Até 10 Gbps' },
      { parameter: 'Portas', value: '4x Gigabit Ethernet + 2x SFP+' },
      { parameter: 'Segurança', value: 'NGFW, Criptografia Post-Quantum' },
      { parameter: 'Dimensões', value: '435 x 165 x 45 mm' },
      { parameter: 'Consumo', value: '150W' },
    ],
    keyFeatures: [
      'SD-WAN integrado',
      'NextGen Firewall nativo',
      'MPLS e BGP suportados',
      'Redundância dual',
      'Auto-configuração',
    ],
    useCase: 'Matriz SP com uplink WAN de alta velocidade e segurança avançada',
    estimatedCost: 'R$ 45.000 - R$ 55.000',
  },
];

export const CISCO_FIREWALLS: Equipment[] = [
  {
    id: 'cisco-fw-matrix',
    name: 'Cisco Firepower 2100 Series',
    model: 'FPR2130-NGFW-K9',
    category: 'firewall',
    vendor: 'cisco',
    site: 'matriz',
    quantity: 1,
    imagePath: getPublicAssetPath(
      'images/equipamentos/cisco/firepower-2100.svg',
    ),
    imageUrl:
      'https://www.cisco.com/c/dam/assets/support/product-images/series/security-firepower-2100-series.jpg',
    description: 'Firewall de próxima geração para proteção corporativa',
    specifications: [
      { parameter: 'Throughput Firewall', value: 'Até 2.4 Gbps' },
      { parameter: 'Throughput IPS', value: 'Até 750 Mbps' },
      { parameter: 'Portas', value: '4x Gigabit Ethernet + 2x Management' },
      { parameter: 'Segurança', value: 'IPS, IDS, AMP, SSL Inspection' },
      { parameter: 'Dimensões', value: '438 x 168 x 43 mm' },
    ],
    keyFeatures: [
      'Inspeção SSL/TLS',
      'Proteção contra ransomware',
      'Advanced Malware Protection',
      'VLAN e QoS',
      'Redundância ativa-ativo',
    ],
    useCase: 'Proteção da Matriz SP com ACL avançado e detecção de ameaças',
    estimatedCost: 'R$ 35.000 - R$ 45.000',
  },
];

export const CISCO_SWITCHES: Equipment[] = [
  {
    id: 'cisco-switch-matrix',
    name: 'Cisco Catalyst 3650-48TS-L',
    model: 'WS-C3650-48TS-L',
    category: 'switch',
    vendor: 'cisco',
    site: 'matriz',
    quantity: 1,
    imagePath: getPublicAssetPath(
      'images/equipamentos/cisco/catalyst-3650.svg',
    ),
    imageUrl:
      'https://www.cisco.com/c/dam/assets/support/product-images/series/switches-catalyst-3650-series-switches.jpg',
    description: 'Switch gerenciado de camada 3 para distribuição de dados',
    specifications: [
      { parameter: 'Portas', value: '48x Gigabit Ethernet + 4x SFP+' },
      { parameter: 'Throughput', value: 'Até 130 Gbps' },
      { parameter: 'Segurança', value: 'IP Base com VLAN nativa' },
      { parameter: 'StackWise', value: 'Até 4 unidades em stack' },
      { parameter: 'Dimensões', value: '440 x 265 x 45 mm' },
    ],
    keyFeatures: [
      'Roteamento L3 nativo',
      'VLAN e TRUNK',
      'Spanning Tree',
      'IPv6 ready',
      'Energy efficient',
    ],
    useCase:
      'Distribuição e agregação da Matriz SP com suporte a VLANs 10, 20, 30, 40',
    estimatedCost: 'R$ 12.000 - R$ 15.000',
  },
];

export const CISCO_ACCESS_POINTS: Equipment[] = [
  {
    id: 'cisco-ap-matrix',
    name: 'Cisco Catalyst 9120AXE',
    model: 'C9120AXE-4K',
    category: 'access-point',
    vendor: 'cisco',
    site: 'matriz',
    quantity: 2,
    imagePath: getPublicAssetPath(
      'images/equipamentos/cisco/catalyst-9120.svg',
    ),
    imageUrl:
      'https://www.cisco.com/c/dam/assets/support/product-images/series/wireless-catalyst-9120-series-access-points.jpg',
    description: 'Access Point Wi-Fi 6E com alta performance',
    specifications: [
      { parameter: 'Padrão', value: 'Wi-Fi 6E (802.11ax)' },
      { parameter: 'Taxa', value: 'Até 6.8 Gbps' },
      { parameter: 'Antenas', value: '4x4:4 MIMO' },
      { parameter: 'Cobertura', value: 'Até 180m²' },
      { parameter: 'Dimensões', value: '210 x 210 x 38 mm' },
    ],
    keyFeatures: [
      'Wi-Fi 6E suportado',
      'VLAN dinâmica (VLAN 40)',
      'Autenticação WPA3',
      'Band steering automático',
      'Gerenciamento central',
    ],
    useCase: 'Mobilidade corporativa na Matriz SP com cobertura Wi-Fi 6E',
    estimatedCost: 'R$ 3.500 - R$ 4.500 (por unidade)',
  },
];

// Equipamentos FORTINET recomendados
export const FORTINET_ROUTERS: Equipment[] = [
  {
    id: 'fortinet-router-matrix',
    name: 'FortiGate 100F',
    model: 'FG100F',
    category: 'router',
    vendor: 'fortinet',
    site: 'matriz',
    quantity: 1,
    imagePath: getPublicAssetPath(
      'images/equipamentos/fortinet/fortigate-100f.svg',
    ),
    imageUrl:
      'https://www.fortinet.com/content/dam/fortinet/images/product-image/fortigate-100f.jpg',
    description: 'FortiGate com roteamento e firewall integrados para matriz',
    specifications: [
      { parameter: 'Throughput', value: 'Até 10.5 Gbps' },
      { parameter: 'Performance VPN', value: 'Até 2.6 Gbps' },
      { parameter: 'Portas', value: '4x Gigabit + 1x Management' },
      { parameter: 'Segurança', value: 'IPS, AV, Web Filter, Sandbox' },
      { parameter: 'Dimensões', value: '420 x 220 x 44 mm' },
    ],
    keyFeatures: [
      'Roteamento SD-WAN',
      'Criptografia de até 2.6 Gbps',
      'Proteção contra DDoS',
      'Advanced Threat Protection',
      'Redundância ativa-passiva',
    ],
    useCase: 'Roteador/Firewall unificado para Matriz SP',
    estimatedCost: 'R$ 28.000 - R$ 35.000',
  },
  {
    id: 'fortinet-router-filial',
    name: 'FortiGate 40F',
    model: 'FG40F',
    category: 'router',
    vendor: 'fortinet',
    site: 'filial',
    quantity: 1,
    imagePath: getPublicAssetPath(
      'images/equipamentos/fortinet/fortigate-40f.svg',
    ),
    imageUrl:
      'https://www.fortinet.com/content/dam/fortinet/images/product-image/fortigate-40f.jpg',
    description: 'FortiGate compacto para filiais com performance adequada',
    specifications: [
      { parameter: 'Throughput', value: 'Até 3.5 Gbps' },
      { parameter: 'Performance VPN', value: 'Até 1.0 Gbps' },
      { parameter: 'Portas', value: '4x Gigabit + 1x Management' },
      { parameter: 'Segurança', value: 'IPS, AV, Web Filter' },
      { parameter: 'Dimensões', value: '360 x 180 x 38 mm' },
    ],
    keyFeatures: [
      'Roteamento SD-WAN',
      'IPsec e SSL-VPN',
      'Proteção contra ameaças',
      'Gerenciamento remoto',
      'Interface web intuitiva',
    ],
    useCase: 'Roteador/Firewall para Filial CWB com custo otimizado',
    estimatedCost: 'R$ 12.000 - R$ 16.000',
  },
];

export const FORTINET_FIREWALLS: Equipment[] = [
  {
    id: 'fortinet-fw-filial',
    name: 'FortiGate 60F',
    model: 'FG60F',
    category: 'firewall',
    vendor: 'fortinet',
    site: 'filial',
    quantity: 1,
    imagePath: getPublicAssetPath(
      'images/equipamentos/fortinet/fortigate-60f.svg',
    ),
    imageUrl:
      'https://www.fortinet.com/content/dam/fortinet/images/product-image/fortigate-60f.jpg',
    description: 'Firewall NGFW dedicado para filial com alto fluxo de acessos',
    specifications: [
      { parameter: 'Throughput Firewall', value: 'Até 10 Gbps' },
      { parameter: 'Performance IPS', value: 'Até 1.8 Gbps' },
      { parameter: 'Performance VPN', value: 'Até 6.5 Gbps' },
      { parameter: 'Portas', value: '10x Gigabit + 2x SFP' },
      { parameter: 'Dimensões', value: '360 x 180 x 40 mm' },
    ],
    keyFeatures: [
      'NGFW com IPS e AV',
      'IPsec Site-to-Site VPN',
      'Inspeção SSL/TLS',
      'Web Filtering e App Control',
      'FortiManager compatível',
    ],
    useCase: 'Proteção dedicada da Filial CWB com inspeção profunda de pacotes',
    estimatedCost: 'R$ 18.000 - R$ 24.000',
  },
  {
    id: 'fortinet-fw-matrix',
    name: 'FortiGate 200F',
    model: 'FG200F',
    category: 'firewall',
    vendor: 'fortinet',
    site: 'matriz',
    quantity: 1,
    imagePath: getPublicAssetPath(
      'images/equipamentos/fortinet/fortigate-200f.svg',
    ),
    imageUrl:
      'https://www.fortinet.com/content/dam/fortinet/images/product-image/fortigate-200f.jpg',
    description: 'FortiGate enterprise para proteção completa de matriz',
    specifications: [
      { parameter: 'Throughput', value: 'Até 20 Gbps' },
      { parameter: 'Performance IPS', value: 'Até 8 Gbps' },
      { parameter: 'Portas', value: '10x Gigabit + 2x SFP+' },
      { parameter: 'Segurança', value: 'NGFW completo com Sandbox' },
      { parameter: 'Dimensões', value: '440 x 220 x 44 mm' },
    ],
    keyFeatures: [
      'Inspeção em tempo real',
      'Machine Learning integrado',
      'Redundância N+1',
      'Gerenciamento centralizado',
      'Conformidade LGPD',
    ],
    useCase: 'Proteção corporativa avançada para Matriz SP',
    estimatedCost: 'R$ 45.000 - R$ 55.000',
  },
];

export const FORTINET_SWITCHES: Equipment[] = [
  {
    id: 'fortinet-switch-matrix',
    name: 'FortiSwitch 248F',
    model: 'FS-248F',
    category: 'switch',
    vendor: 'fortinet',
    site: 'matriz',
    quantity: 1,
    imagePath: getPublicAssetPath(
      'images/equipamentos/fortinet/fortiswitch-248f.svg',
    ),
    imageUrl:
      'https://www.fortinet.com/content/dam/fortinet/images/product-image/fortiswitch-248f.jpg',
    description: 'Switch gerenciado com recursos de segurança integrados',
    specifications: [
      { parameter: 'Portas', value: '48x Gigabit + 4x SFP+' },
      { parameter: 'Throughput', value: 'Até 176 Gbps' },
      { parameter: 'VLAN', value: 'Até 4094 VLANs' },
      { parameter: 'Segurança', value: 'Port security, Dynamic ACL' },
      { parameter: 'Dimensões', value: '440 x 220 x 44 mm' },
    ],
    keyFeatures: [
      'Integração com FortiGate',
      'VLAN nativa 10, 20, 30, 40',
      'Spanning Tree Protocol',
      'LACP e Static LAG',
      'Energy efficient',
    ],
    useCase: 'Distribuição integrada com segurança na Matriz SP',
    estimatedCost: 'R$ 18.000 - R$ 24.000',
  },
];

// Dados consolidados
export const ALL_EQUIPMENTS: Equipment[] = [
  ...CISCO_ROUTERS,
  ...CISCO_FIREWALLS,
  ...CISCO_SWITCHES,
  ...CISCO_ACCESS_POINTS,
  ...FORTINET_ROUTERS,
  ...FORTINET_FIREWALLS,
  ...FORTINET_SWITCHES,
];

export const ROUTERS = [...CISCO_ROUTERS, ...FORTINET_ROUTERS];
export const FIREWALLS = [...CISCO_FIREWALLS, ...FORTINET_FIREWALLS];
export const SWITCHES = [...CISCO_SWITCHES, ...FORTINET_SWITCHES];
export const ACCESS_POINTS = [...CISCO_ACCESS_POINTS];
