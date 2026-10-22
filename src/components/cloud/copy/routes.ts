import type { AppLanguage } from '../../../types/i18n';

/** Textos de `routes` no Studio Cloud (parte de `cloudCopy.ts`). */
export type RoutesCopy = {
  tab: string;
  hint: string;
  empty: string;
  columns: {
    table: string;
    subnets: string;
    destination: string;
    target: string;
    origin: string;
  };
  origin: { auto: string; manual: string };
  targets: {
    local: string;
    igw: string;
    nat: string;
    vpce: string;
    missing: string;
  };
  crossAz: string;
  noEgress: string;
  addTitle: string;
  destinationLabel: string;
  targetLabel: string;
  tableLabel: string;
  add: string;
  remove: string;
};

export const routesCopy: Record<AppLanguage, RoutesCopy> = {
  pt: {
    tab: 'Rotas',
    hint: 'As rotas automáticas seguem a topologia (IGW, NAT, endpoints). Acrescente rotas manuais se precisar.',
    empty:
      'Nenhuma route table ainda: elas aparecem quando a VPC tiver subnets.',
    columns: {
      table: 'Route table',
      subnets: 'Subnets',
      destination: 'Destino',
      target: 'Alvo',
      origin: 'Origem',
    },
    origin: { auto: 'Automática', manual: 'Manual' },
    targets: {
      local: 'local',
      igw: 'Internet Gateway',
      nat: 'NAT Gateway',
      vpce: 'Endpoint',
      missing: 'Falta o Internet Gateway',
    },
    crossAz: 'outra AZ',
    noEgress: 'sem NAT: não sai para a internet',
    addTitle: 'Rota manual',
    destinationLabel: 'Destino (CIDR)',
    targetLabel: 'Alvo',
    tableLabel: 'Route table',
    add: 'Adicionar rota',
    remove: 'Remover rota',
  },
  en: {
    tab: 'Routes',
    hint: 'Automatic routes follow the topology (IGW, NAT, endpoints). Add manual routes if needed.',
    empty: 'No route tables yet: they appear once the VPC has subnets.',
    columns: {
      table: 'Route table',
      subnets: 'Subnets',
      destination: 'Destination',
      target: 'Target',
      origin: 'Origin',
    },
    origin: { auto: 'Automatic', manual: 'Manual' },
    targets: {
      local: 'local',
      igw: 'Internet Gateway',
      nat: 'NAT Gateway',
      vpce: 'Endpoint',
      missing: 'Internet Gateway missing',
    },
    crossAz: 'other AZ',
    noEgress: 'no NAT: no internet egress',
    addTitle: 'Manual route',
    destinationLabel: 'Destination (CIDR)',
    targetLabel: 'Target',
    tableLabel: 'Route table',
    add: 'Add route',
    remove: 'Remove route',
  },
  es: {
    tab: 'Rutas',
    hint: 'Las rutas automáticas siguen la topología (IGW, NAT, endpoints). Agrega rutas manuales si hace falta.',
    empty: 'Aún no hay route tables: aparecen cuando la VPC tenga subnets.',
    columns: {
      table: 'Route table',
      subnets: 'Subnets',
      destination: 'Destino',
      target: 'Destino de salto',
      origin: 'Origen',
    },
    origin: { auto: 'Automática', manual: 'Manual' },
    targets: {
      local: 'local',
      igw: 'Internet Gateway',
      nat: 'NAT Gateway',
      vpce: 'Endpoint',
      missing: 'Falta el Internet Gateway',
    },
    crossAz: 'otra AZ',
    noEgress: 'sin NAT: no sale a internet',
    addTitle: 'Ruta manual',
    destinationLabel: 'Destino (CIDR)',
    targetLabel: 'Destino de salto',
    tableLabel: 'Route table',
    add: 'Agregar ruta',
    remove: 'Quitar ruta',
  },
};
