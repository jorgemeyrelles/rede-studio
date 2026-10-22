import type { AppLanguage } from '../../../types/i18n';

/** Textos de `security` no Studio Cloud (parte de `cloudCopy.ts`). */
export type SecurityCopy = {
  sgTab: string;
  naclTab: string;
  vpcLabel: string;
  needVpc: string;
  newSg: string;
  newNacl: string;
  sgEmpty: string;
  naclEmpty: string;
  configure: string;
  columns: {
    direction: string;
    protocol: string;
    ports: string;
    peer: string;
    description: string;
    number: string;
    action: string;
  };
  directions: { ingress: string; egress: string };
  protocols: { tcp: string; udp: string; icmp: string; all: string };
  actions: { allow: string; deny: string };
  peerCidr: string;
  addRule: string;
  preset: string;
  removeRule: string;
  risky: string;
  allPorts: string;
  defaultDeny: string;
  naclSubnets: string;
  naclNoSubnets: string;
  rulesCount: (count: number) => string;
};

export const securityCopy: Record<AppLanguage, SecurityCopy> = {
  pt: {
    sgTab: 'Security groups',
    naclTab: 'NACLs',
    vpcLabel: 'VPC',
    needVpc: 'Crie uma VPC antes.',
    newSg: 'Novo security group',
    newNacl: 'Nova NACL',
    sgEmpty: 'Nenhum security group nesta VPC.',
    naclEmpty:
      'Nenhuma NACL personalizada: as subnets usam a NACL padrão (permite tudo).',
    configure: 'Abrir no inspetor',
    columns: {
      direction: 'Direção',
      protocol: 'Protocolo',
      ports: 'Portas',
      peer: 'Origem / destino',
      description: 'Descrição',
      number: 'Nº',
      action: 'Ação',
    },
    directions: { ingress: 'Entrada', egress: 'Saída' },
    protocols: { tcp: 'TCP', udp: 'UDP', icmp: 'ICMP', all: 'Todos' },
    actions: { allow: 'Permitir', deny: 'Negar' },
    peerCidr: 'CIDR…',
    addRule: 'Adicionar regra',
    preset: 'Preset…',
    removeRule: 'Remover regra',
    risky: 'Aberta para a internet',
    allPorts: 'todas',
    defaultDeny: 'nega o restante (fixa)',
    naclSubnets: 'Subnets',
    naclNoSubnets: 'nenhuma — escolha a NACL no inspetor da subnet',
    rulesCount: (count) => `${count} ${count === 1 ? 'regra' : 'regras'}`,
  },
  en: {
    sgTab: 'Security groups',
    naclTab: 'NACLs',
    vpcLabel: 'VPC',
    needVpc: 'Create a VPC first.',
    newSg: 'New security group',
    newNacl: 'New NACL',
    sgEmpty: 'No security groups in this VPC.',
    naclEmpty: 'No custom NACLs: subnets use the default NACL (allow all).',
    configure: 'Open in inspector',
    columns: {
      direction: 'Direction',
      protocol: 'Protocol',
      ports: 'Ports',
      peer: 'Source / destination',
      description: 'Description',
      number: 'No.',
      action: 'Action',
    },
    directions: { ingress: 'Inbound', egress: 'Outbound' },
    protocols: { tcp: 'TCP', udp: 'UDP', icmp: 'ICMP', all: 'All' },
    actions: { allow: 'Allow', deny: 'Deny' },
    peerCidr: 'CIDR…',
    addRule: 'Add rule',
    preset: 'Preset…',
    removeRule: 'Remove rule',
    risky: 'Open to the internet',
    allPorts: 'all',
    defaultDeny: 'denies the rest (fixed)',
    naclSubnets: 'Subnets',
    naclNoSubnets: 'none — pick the NACL in the subnet inspector',
    rulesCount: (count) => `${count} ${count === 1 ? 'rule' : 'rules'}`,
  },
  es: {
    sgTab: 'Security groups',
    naclTab: 'NACL',
    vpcLabel: 'VPC',
    needVpc: 'Crea una VPC antes.',
    newSg: 'Nuevo security group',
    newNacl: 'Nueva NACL',
    sgEmpty: 'No hay security groups en esta VPC.',
    naclEmpty:
      'No hay NACL personalizadas: las subnets usan la NACL predeterminada (permite todo).',
    configure: 'Abrir en el inspector',
    columns: {
      direction: 'Dirección',
      protocol: 'Protocolo',
      ports: 'Puertos',
      peer: 'Origen / destino',
      description: 'Descripción',
      number: 'N.º',
      action: 'Acción',
    },
    directions: { ingress: 'Entrada', egress: 'Salida' },
    protocols: { tcp: 'TCP', udp: 'UDP', icmp: 'ICMP', all: 'Todos' },
    actions: { allow: 'Permitir', deny: 'Denegar' },
    peerCidr: 'CIDR…',
    addRule: 'Agregar regla',
    preset: 'Preset…',
    removeRule: 'Quitar regla',
    risky: 'Abierta a internet',
    allPorts: 'todos',
    defaultDeny: 'deniega el resto (fija)',
    naclSubnets: 'Subnets',
    naclNoSubnets: 'ninguna — elige la NACL en el inspector de la subnet',
    rulesCount: (count) => `${count} ${count === 1 ? 'regla' : 'reglas'}`,
  },
};
