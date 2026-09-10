import type {
    DefaultRouteRow,
    FailoverMetricRow,
    PrefixReferenceRow,
} from '../types';

export const FAILOVER_METRIC_ROWS: FailoverMetricRow[] = [
  {
    situation: 'Operacao normal (MPLS)',
    metric: '10',
    behavior: 'Rota preferencial ativa',
  },
  {
    situation: 'Contingencia (VPN)',
    metric: '20',
    behavior: 'Acionada automaticamente',
  },
];

export const FAILOVER_STEPS = [
  'Health-check detecta falha entre 10 e 15 segundos.',
  'Convergencia para VPN backup em 15 a 30 segundos.',
  'Servicos IPv4 mantidos com menor banda no modo contingencia.',
  'Servicos IPv6 ficam indisponiveis durante operacao em backup.',
];

export const PREFIX_REFERENCE_ROWS: PrefixReferenceRow[] = [
  { prefix: '/24', mask: '255.255.255.0', hosts: '254', usage: 'Departamento grande' },
  { prefix: '/25', mask: '255.255.255.128', hosts: '126', usage: 'Departamento medio' },
  { prefix: '/26', mask: '255.255.255.192', hosts: '62', usage: 'Departamento pequeno' },
  { prefix: '/27', mask: '255.255.255.224', hosts: '30', usage: 'Gerencia / Infra' },
  { prefix: '/28', mask: '255.255.255.240', hosts: '14', usage: 'Servidores' },
  { prefix: '/30', mask: '255.255.255.252', hosts: '2', usage: 'Link ponto-a-ponto' },
];

export const DEFAULT_ROUTE_ROWS: DefaultRouteRow[] = [
  {
    protocol: 'IPv4',
    route: '0.0.0.0/0',
    primary: 'MPLS',
    backup: 'VPN IPsec por metrica',
  },
  {
    protocol: 'IPv6',
    route: '::/0',
    primary: 'MPLS dual-stack',
    backup: 'Sem backup no enlace IPv4-only',
  },
];
