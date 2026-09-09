import type { MatrixLayerRow, MatrixVlanRow, MatrixWanRow } from '../types';

export const MATRIX_LAYER_ROWS: MatrixLayerRow[] = [
  {
    layer: 'Core',
    equipment: 'Cisco Catalyst 9500 (L3)',
    role: 'Inter-VLAN routing e gateway padrao',
    scope: 'Bloco 10.10.0.0/16',
  },
  {
    layer: 'Distribuicao',
    equipment: '4 x Cisco Catalyst 9300 (L3)',
    role: 'Segmentacao, politicas e agregacao por blocos',
    scope: 'Servidores, usuarios, wireless e convidados',
  },
  {
    layer: 'Acesso',
    equipment: '20 x Cisco Catalyst 9200 (L2)',
    role: 'Conexao de endpoints finais',
    scope: 'Aproximadamente 1.000 usuarios',
  },
  {
    layer: 'Seguranca',
    equipment: 'FortiGate 600F (HA Active-Passive)',
    role: 'Firewall de borda, VPN IPsec, inspeção e failover',
    scope: 'Perimetro corporativo da Matriz',
  },
];

export const MATRIX_WAN_ROWS: MatrixWanRow[] = [
  {
    link: 'Primario',
    technology: 'MPLS Operadora A',
    speed: '100 Mbps',
    sla: '99,9%',
    ipv4: '203.0.113.1/30',
    ipv6: '2001:db8:a001::1/126',
    usage: 'Comunicacao principal com filiais',
  },
  {
    link: 'Secundario',
    technology: 'Internet dedicada Operadora B',
    speed: '50 Mbps',
    sla: '99,5%',
    ipv4: '198.51.100.1/30',
    ipv6: 'Nao suportado',
    usage: 'Backup por VPN IPsec IKEv2',
  },
];

export const MATRIX_VLAN_ROWS: MatrixVlanRow[] = [
  { vlan: '10', name: 'Servidores Producao', subnet: '10.10.10.0', prefix: '/24', hosts: '254' },
  { vlan: '20', name: 'Servidores Dev/Homolog', subnet: '10.10.20.0', prefix: '/24', hosts: '254' },
  { vlan: '30', name: 'TI / Infraestrutura', subnet: '10.10.30.0', prefix: '/24', hosts: '254' },
  { vlan: '40', name: 'Desenvolvimento', subnet: '10.10.40.0', prefix: '/23', hosts: '510' },
  { vlan: '50', name: 'Administrativo', subnet: '10.10.50.0', prefix: '/23', hosts: '510' },
  { vlan: '60', name: 'Comercial / Suporte', subnet: '10.10.60.0', prefix: '/23', hosts: '510' },
  { vlan: '70', name: 'Wi-Fi Corporativo', subnet: '10.10.70.0', prefix: '/24', hosts: '254' },
  { vlan: '80', name: 'Wi-Fi Visitantes', subnet: '10.10.80.0', prefix: '/24', hosts: '254' },
  { vlan: '99', name: 'Gerencia de Rede', subnet: '10.10.99.0', prefix: '/27', hosts: '30' },
];
