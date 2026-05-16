import type {
    FilialDepartmentRow,
    FilialUserGrowthRow,
    FilialWanRow,
} from '../types';

export const FILIAL_USER_GROWTH_ROWS: FilialUserGrowthRow[] = [
  { scenario: 'Usuarios atuais', quantity: '200' },
  { scenario: 'Projecao em 3 anos', quantity: '300 (+50%)' },
  { scenario: 'Reserva operacional', quantity: '+20%' },
  { scenario: 'Dimensionamento alvo', quantity: '360 usuarios' },
];

export const FILIAL_DEPARTMENT_ROWS: FilialDepartmentRow[] = [
  {
    department: 'Desenvolvimento',
    current: '80',
    projected: '120',
    withReserve: '144',
    recommendedPrefix: '/24 (254 hosts)',
  },
  {
    department: 'Suporte',
    current: '60',
    projected: '90',
    withReserve: '108',
    recommendedPrefix: '/25 (126 hosts)',
  },
  {
    department: 'Administrativo',
    current: '40',
    projected: '60',
    withReserve: '72',
    recommendedPrefix: '/25 (126 hosts)',
  },
  {
    department: 'TI / Infraestrutura',
    current: '20',
    projected: '30',
    withReserve: '36',
    recommendedPrefix: '/26 (62 hosts)',
  },
  {
    department: 'Servidores locais',
    current: '4',
    projected: '6-8',
    withReserve: '8',
    recommendedPrefix: '/28 (14 hosts)',
  },
];

export const FILIAL_WAN_ROWS: FilialWanRow[] = [
  {
    link: 'Primario',
    technology: 'MPLS Operadora A',
    bandwidth: '100 Mbps simetrico',
    sla: '99,9%',
    protocol: 'Dual-stack IPv4 + IPv6',
    addressing: '203.0.113.5/30 | 2001:db8:a002::1/126',
    notes: 'Rota preferencial (metrica 10)',
  },
  {
    link: 'Backup',
    technology: 'Internet Operadora B + VPN IPsec',
    bandwidth: '50 Mbps',
    sla: '99,5%',
    protocol: 'IPv4 only',
    addressing: '198.51.100.5/30 -> 198.51.100.1/30',
    notes: 'Metrica 20 | AES-256-GCM, SHA-384, DH Group 20',
  },
];

export const FILIAL_FUNCTIONAL_REQUIREMENTS = [
  'Wi-Fi corporativo para funcionarios.',
  'Wi-Fi visitantes totalmente isolado da rede interna.',
  'VLAN de gerencia para switches, APs e equipamentos de rede.',
  'VLAN exclusiva para servidores com capacidade de expansao (6-8 servidores).',
];
