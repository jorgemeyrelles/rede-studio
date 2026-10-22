import type { AppLanguage } from '../../types/i18n';
import { terraformCopy, type TerraformCopy } from './copy/terraform';
import { costCopy, type CostCopy } from './copy/cost';
import { routesCopy, type RoutesCopy } from './copy/routes';
import { securityCopy, type SecurityCopy } from './copy/security';
import { connectionCopy, type ConnectionCopy } from './copy/connection';
import { validationCopy, type ValidationCopy } from './copy/validation';
import type { CloudCategory } from '../../features/cloud/catalog';

/**
 * Textos de interface do Studio Cloud. Os rótulos de produto e de campo
 * ficam no catálogo (`features/cloud/catalog`), junto da definição de cada
 * elemento; aqui só o "chrome" (paleta, canvas, inspetor, abas). As áreas
 * maiores (terraform, custo, rotas, segurança, conexões, validação) ficam
 * em `copy/<área>.ts`, nos 3 idiomas, e entram aqui por referência.
 */
export type CloudCopy = {
  studioHint: string;
  paletteTitle: string;
  paletteHint: string;
  nextStep: string;
  layers: [string, string, string, string, string, string];
  /** Seções da paleta. */
  categories: Record<CloudCategory, string>;
  canvasLabel: string;
  emptyTitle: string;
  emptyBody: string;
  emptyCta: string;
  fitView: string;
  fitToContent: string;
  fitDone: string;
  connectFrom: string;
  routesToggle: string;
  routesToggleHint: string;
  zoomIn: string;
  zoomOut: string;
  inspectorTitle: string;
  inspectorEmpty: string;
  nameLabel: string;
  sectionConfig: string;
  sectionOperation: string;
  deleteResource: string;
  deletedToast: string;
  undo: string;
  redo: string;
  dismiss: string;
  listAdd: string;
  regenerate: string;
  chooseGroups: string;
  chooseRoles: string;
  searchCatalog: string;
  searchPolicies: string;
  addPolicy: string;
  noMatches: string;
  catalogLoading: string;
  catalogUnavailable: string;
  outsideCatalog: string;
  noPolicies: string;
  trustedBy: string;
  policyCount: (count: number) => string;
  iamInfo: string;
  iamUsersTitle: string;
  iamGroupsTitle: string;
  iamRolesTitle: string;
  editInInspector: string;
  none: string;
  tagsSection: string;
  tagsHint: string;
  inheritedFrom: (name: string) => string;
  inheritOption: (value: string) => string;
  resetInherit: string;
  listRemove: string;
  listEmpty: string;
  invalidFormat: string;
  regionNoPrices: string;
  iamSummary: (users: number, groups: number, roles: number) => string;
  mfaOn: string;
  childrenCount: (count: number) => string;
  suggest: string;
  capacity: (usable: number, first: string, last: string) => string;
  zoneInUse: string;
  tiers: Record<'public' | 'private' | 'isolated', string>;
  planSubnets: string;
  planHint: string;
  planTiersLabel: string;
  planPrefixLabel: string;
  planAzsLabel: string;
  planPreview: string;
  planStatus: Record<'create' | 'exists' | 'noSpace', string>;
  planStatusColumn: string;
  planCreate: (count: number) => string;
  planNothing: string;
  planNeedsCidr: string;
  planNeedsAz: string;
  cancel: string;
  tablesLabel: string;
  ipamTab: string;
  ipamVpcFilter: string;
  ipamAllVpcs: string;
  ipamColumns: {
    vpc: string;
    az: string;
    subnet: string;
    tier: string;
    cidr: string;
    usable: string;
    used: string;
    free: string;
    range: string;
  };
  ipamUsedHint: string;
  ipamVpcTotal: (allocated: number, size: number, free: number) => string;
  ipamEmpty: string;
  ipamEditCidr: (name: string) => string;
  ipamRouteTable: string;
  ipamNacl: string;
  naclDefault: string;
  tabGroups: {
    addressing: string;
    traffic: string;
    security: string;
    operation: string;
    terraform: string;
    cost: string;
    validation: string;
  };
  validation: ValidationCopy;
  a11y: {
    /** Textos de acessibilidade do React Flow (`ariaLabelConfig`). */
    nodeDescription: string;
    edgeDescription: string;
    node: (type: string, name: string) => string;
    edge: (from: string, to: string, label: string) => string;
  };
  connectTo: {
    label: string;
    placeholder: string;
    help: string;
    none: string;
  };
  terraform: TerraformCopy;
  cost: CostCopy;
  routes: RoutesCopy;
  security: SecurityCopy;
  refsEmpty: {
    vpcSecurityGroups: string;
    vpcSubnets: string;
    projectVpcs: string;
    regionSecrets: string;
    backupTargets: string;
  };
  /** Rótulo da senha mestre gerenciada pelo RDS na lista de segredos. */
  rdsManagedSecret: string;
  /** Primeira opção dos seletores de associação (zona, certificado, WAF). */
  noneOption: string;
  /** Valor escolhido que não vale mais para este recurso (outra região, excluído). */
  outOfScope: string;
  privateZone: string;
  instanceSpec: (vcpu: number, memoryGiB: number) => string;
  perHour: string;
  /** Selo do nó: certificado TLS. */
  badgeCertificate: string;
  badgeSecrets: string;
  /** Tipo Graviton desabilitado no seletor quando o SO é Windows. */
  armNoWindows: string;
  noRegionPrices: string;
  connection: ConnectionCopy;
  resourcesTab: string;
  resourcesEmpty: string;
  resourceColumns: {
    resource: string;
    type: string;
    subnet: string;
    privateIp: string;
    publicIp: string;
    sgs: string;
    dns: string;
  };
  dynamicIp: (count: number) => string;
  assignNextIp: string;
  publicIpKinds: { eip: string; auto: string; none: string; dns: string };
  connectionsTab: string;
  connectionsEmpty: string;
  connectionColumns: {
    from: string;
    to: string;
    kind: string;
    direction: string;
    port: string;
    encrypted: string;
    gbMonth: string;
  };
  locate: string;
  split: string;
  merge: string;
  yes: string;
  no: string;
  operationTab: string;
  operationEmpty: string;
  operationColumns: {
    resource: string;
    size: string;
    quantity: string;
    multiAz: string;
    backup: string;
    monitoring: string;
    tags: string;
  };
  projectEnvironment: string;
  bulkTags: (count: number) => string;
  applyTag: string;
  selectRow: (name: string) => string;
  fromConnection: string;
};

const COPY: Record<AppLanguage, CloudCopy> = {
  pt: {
    studioHint:
      'Rascunho de arquitetura AWS. Comece pela conta e cresça em camadas: região, VPC, zonas, subnets e recursos.',
    paletteTitle: 'Componentes',
    paletteHint: 'Clique para criar dentro do elemento selecionado.',
    nextStep: 'Próximo passo',
    categories: {
      foundation: 'Fundação',
      network: 'Rede',
      edge: 'Borda e entrega',
      compute: 'Computação',
      data: 'Dados',
      security: 'Segurança',
    },
    layers: [
      'Conta e identidade',
      'Região',
      'Rede (VPC)',
      'Zonas e borda',
      'Subnets',
      'Recursos',
    ],
    canvasLabel: 'Canvas da arquitetura cloud',
    emptyTitle: 'A arquitetura começa pela conta',
    emptyBody:
      'A conta AWS é o limite de cobrança e de identidade (IAM). Tudo o que você criar depois fica dentro dela.',
    emptyCta: 'Criar conta AWS',
    fitView: 'Enquadrar',
    fitToContent: 'Ajustar ao conteúdo',
    fitDone: 'Já ajustado ao conteúdo',
    connectFrom: 'Conectar a partir de',
    routesToggle: 'Rotas',
    routesToggleHint:
      'Mostrar as rotas implícitas (IGW, NAT e, com o endpoint selecionado, endpoints)',
    zoomIn: 'Aproximar',
    zoomOut: 'Afastar',
    inspectorTitle: 'Configuração',
    inspectorEmpty: 'Selecione um elemento no canvas para configurar.',
    nameLabel: 'Nome',
    sectionConfig: 'Configuração',
    sectionOperation: 'Operação',
    deleteResource: 'Excluir elemento',
    deletedToast: 'Elemento excluído (com tudo o que havia dentro dele).',
    undo: 'Desfazer',
    redo: 'Refazer',
    dismiss: 'Fechar aviso',
    listAdd: 'Adicionar',
    regenerate: 'Gerar outro',
    chooseGroups: 'Escolher grupos…',
    chooseRoles: 'Escolher roles…',
    searchCatalog: 'Buscar no catálogo',
    searchPolicies: 'Buscar política gerenciada',
    addPolicy: 'Adicionar política…',
    noMatches: 'Nada encontrado.',
    catalogLoading: 'Carregando catálogo…',
    catalogUnavailable: 'Catálogo indisponível (seleções preservadas)',
    outsideCatalog: 'fora do catálogo',
    noPolicies: 'Sem políticas: este grupo/role não concede acesso.',
    trustedBy: 'Assumida por',
    policyCount: (count) =>
      `${count} ${count === 1 ? 'política' : 'políticas'}`,
    iamInfo: 'Identidades (IAM)',
    iamUsersTitle: 'Usuários',
    iamGroupsTitle: 'Grupos',
    iamRolesTitle: 'Roles',
    editInInspector: 'Editar no inspetor',
    none: 'Nenhum.',
    tagsSection: 'Tags',
    tagsHint: 'Vêm da conta. Sobrescreva só se este elemento for diferente.',
    inheritedFrom: (name) => `herdado de ${name}`,
    inheritOption: (value) => `Herdar (${value})`,
    resetInherit: 'Voltar a herdar',
    listRemove: 'Remover',
    listEmpty: 'Nenhum item.',
    invalidFormat: 'Formato inválido.',
    regionNoPrices: 'sem preço carregado',
    iamSummary: (users, groups, roles) =>
      `IAM · ${users} ${users === 1 ? 'usuário' : 'usuários'} · ${groups} ${groups === 1 ? 'grupo' : 'grupos'} · ${roles} ${roles === 1 ? 'role' : 'roles'}`,
    mfaOn: 'MFA',
    childrenCount: (count) => `${count} ${count === 1 ? 'item' : 'itens'}`,
    suggest: 'Sugerir',
    capacity: (usable, first, last) =>
      `${usable} IPs utilizáveis · ${first} – ${last}`,
    zoneInUse: 'em uso',
    tiers: { public: 'Pública', private: 'Privada', isolated: 'Isolada' },
    planSubnets: 'Planejar subnets',
    planHint:
      'Uma subnet por camada em cada AZ. As que já existem ficam como estão.',
    planTiersLabel: 'Camadas',
    planPrefixLabel: 'Tamanho de cada subnet',
    planAzsLabel: 'Zonas',
    planPreview: 'Prévia',
    planStatusColumn: 'Situação',
    planStatus: {
      create: 'Criar',
      exists: 'Já existe',
      noSpace: 'Sem espaço na VPC',
    },
    planCreate: (count) =>
      count === 1 ? 'Criar 1 subnet' : `Criar ${count} subnets`,
    planNothing: 'Nada a criar com essa escolha.',
    planNeedsCidr: 'Defina um CIDR válido para a VPC antes de planejar.',
    planNeedsAz: 'A VPC ainda não tem zonas de disponibilidade.',
    cancel: 'Cancelar',
    tablesLabel: 'Tabelas da arquitetura',
    ipamTab: 'IPs (IPAM)',
    ipamVpcFilter: 'VPC',
    ipamAllVpcs: 'Todas as VPCs',
    ipamColumns: {
      vpc: 'VPC',
      az: 'Zona',
      subnet: 'Subnet',
      tier: 'Tipo',
      cidr: 'CIDR',
      usable: 'Utilizáveis',
      used: 'Usados',
      free: 'Livres',
      range: 'Faixa utilizável',
    },
    ipamUsedHint:
      'Usados: IPs fixos (EC2, RDS, NAT) e dinâmicos (ALB/NLB, Auto Scaling, standby do RDS).',
    ipamVpcTotal: (allocated, size, free) =>
      `${allocated.toLocaleString('pt-BR')} de ${size.toLocaleString('pt-BR')} endereços em subnets · ${free.toLocaleString('pt-BR')} livres na VPC`,
    ipamEmpty:
      'Nenhuma subnet ainda. Crie uma VPC e use "Planejar subnets" no inspetor dela.',
    ipamEditCidr: (name) => `CIDR de ${name}`,
    ipamRouteTable: 'Route table',
    ipamNacl: 'NACL',
    naclDefault: 'Padrão (permite tudo)',
    tabGroups: {
      addressing: 'Endereçamento',
      traffic: 'Tráfego',
      security: 'Segurança',
      operation: 'Operação',
      terraform: 'Terraform',
      cost: 'Custo',
      validation: 'Validação',
    },
    validation: validationCopy.pt,
    a11y: {
      nodeDescription:
        'Enter ou Espaço seleciona. Com o elemento selecionado, as setas movem dentro do container (Shift para passos maiores), Delete exclui e Esc limpa a seleção.',
      edgeDescription:
        'Enter ou Espaço seleciona a conexão. Delete exclui e Esc limpa a seleção.',
      node: (type, name) => `${type}: ${name}`,
      edge: (from, to, label) => `Conexão de ${from} para ${to}, ${label}`,
    },
    connectTo: {
      label: 'Conectar a',
      placeholder: 'Escolha o destino…',
      help: 'O mesmo que arrastar a partir do recurso no canvas: só aparecem destinos que aceitam a conexão.',
      none: 'Nenhum destino aceita conexão deste elemento agora.',
    },
    terraform: terraformCopy.pt,
    cost: costCopy.pt,
    routes: routesCopy.pt,
    security: securityCopy.pt,
    refsEmpty: {
      vpcSecurityGroups: 'Nenhum security group na VPC. Crie na aba Segurança.',
      vpcSubnets: 'Nenhuma subnet na VPC.',
      projectVpcs: 'Nenhuma VPC no projeto.',
      regionSecrets:
        'Nenhum segredo, parâmetro ou RDS nesta Região. Crie pela paleta (Segurança).',
      backupTargets:
        'Nada para proteger nesta Região: crie RDS, Aurora, EFS, DynamoDB ou EC2.',
    },
    rdsManagedSecret: 'senha mestre gerenciada pelo RDS',
    noneOption: 'Nenhum',
    outOfScope: 'fora do alcance',
    privateZone: 'privada',
    instanceSpec: (vcpu, memoryGiB) =>
      `${vcpu} vCPU · ${String(memoryGiB).replace('.', ',')} GiB`,
    perHour: '/h',
    badgeCertificate: 'Certificado',
    badgeSecrets: 'Lê',
    armNoWindows: 'arm64, sem Windows',
    noRegionPrices: 'Região sem preço carregado: lista padrão, sem preço.',
    connection: connectionCopy.pt,
    resourcesTab: 'Recursos e endereços',
    resourcesEmpty:
      'Nenhum recurso com IP ainda. Crie EC2, RDS, ALB ou NAT nas subnets.',
    resourceColumns: {
      resource: 'Recurso',
      type: 'Tipo',
      subnet: 'Subnet',
      privateIp: 'IP privado',
      publicIp: 'IP público',
      sgs: 'Security groups',
      dns: 'DNS interno',
    },
    dynamicIp: (count) => (count === 1 ? 'dinâmico' : `dinâmico ×${count}`),
    assignNextIp: 'Próximo livre',
    publicIpKinds: {
      eip: 'Elastic IP',
      auto: 'automático',
      none: '—',
      dns: 'DNS público',
    },
    connectionsTab: 'Conexões',
    connectionsEmpty:
      'Nenhuma conexão. No canvas, arraste de um dos pontos de um recurso (ou segure o clique sobre ele) até outro.',
    connectionColumns: {
      from: 'Origem',
      to: 'Destino',
      kind: 'Tipo',
      direction: 'Direção',
      port: 'Protocolo / porta',
      encrypted: 'Criptografia',
      gbMonth: 'GB/mês',
    },
    locate: 'Localizar',
    split: 'Separar ida/volta',
    merge: 'Juntar ida/volta',
    yes: 'sim',
    no: 'não',
    operationTab: 'Operação',
    operationEmpty: 'Nenhum recurso ainda.',
    operationColumns: {
      resource: 'Recurso',
      size: 'Tamanho / classe',
      quantity: 'Qtd',
      multiAz: 'Multi-AZ',
      backup: 'Backup',
      monitoring: 'Monitoramento',
      tags: 'Tags',
    },
    projectEnvironment: 'Ambiente do projeto',
    bulkTags: (count) =>
      count === 1 ? '1 selecionado' : `${count} selecionados`,
    applyTag: 'Aplicar',
    selectRow: (name) => `Selecionar ${name}`,
    fromConnection: 'da conexão',
  },
  en: {
    studioHint:
      'AWS architecture draft. Start with the account and grow in layers: region, VPC, zones, subnets and resources.',
    paletteTitle: 'Components',
    paletteHint: 'Click to create inside the selected element.',
    nextStep: 'Next step',
    categories: {
      foundation: 'Foundation',
      network: 'Network',
      edge: 'Edge and delivery',
      compute: 'Compute',
      data: 'Data',
      security: 'Security',
    },
    layers: [
      'Account and identity',
      'Region',
      'Network (VPC)',
      'Zones and edge',
      'Subnets',
      'Resources',
    ],
    canvasLabel: 'Cloud architecture canvas',
    emptyTitle: 'The architecture starts with the account',
    emptyBody:
      'The AWS account is the billing and identity (IAM) boundary. Everything you create next lives inside it.',
    emptyCta: 'Create AWS account',
    fitView: 'Fit',
    fitToContent: 'Fit to content',
    fitDone: 'Already fitted to content',
    connectFrom: 'Connect from',
    routesToggle: 'Routes',
    routesToggleHint:
      'Show implicit routes (IGW, NAT and, with the endpoint selected, endpoints)',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    inspectorTitle: 'Configuration',
    inspectorEmpty: 'Select an element on the canvas to configure it.',
    nameLabel: 'Name',
    sectionConfig: 'Configuration',
    sectionOperation: 'Operation',
    deleteResource: 'Delete element',
    deletedToast: 'Element deleted (with everything inside it).',
    undo: 'Undo',
    redo: 'Redo',
    dismiss: 'Dismiss',
    listAdd: 'Add',
    regenerate: 'Generate another',
    chooseGroups: 'Choose groups…',
    chooseRoles: 'Choose roles…',
    searchCatalog: 'Search the catalog',
    searchPolicies: 'Search managed policy',
    addPolicy: 'Add policy…',
    noMatches: 'Nothing found.',
    catalogLoading: 'Loading catalog…',
    catalogUnavailable: 'Catalog unavailable (selections kept)',
    outsideCatalog: 'not in catalog',
    noPolicies: 'No policies: this group/role grants no access.',
    trustedBy: 'Assumed by',
    policyCount: (count) => `${count} ${count === 1 ? 'policy' : 'policies'}`,
    iamInfo: 'Identities (IAM)',
    iamUsersTitle: 'Users',
    iamGroupsTitle: 'Groups',
    iamRolesTitle: 'Roles',
    editInInspector: 'Edit in inspector',
    none: 'None.',
    tagsSection: 'Tags',
    tagsHint:
      'They come from the account. Override only if this element differs.',
    inheritedFrom: (name) => `inherited from ${name}`,
    inheritOption: (value) => `Inherit (${value})`,
    resetInherit: 'Inherit again',
    listRemove: 'Remove',
    listEmpty: 'No items.',
    invalidFormat: 'Invalid format.',
    regionNoPrices: 'no prices loaded',
    iamSummary: (users, groups, roles) =>
      `IAM · ${users} ${users === 1 ? 'user' : 'users'} · ${groups} ${groups === 1 ? 'group' : 'groups'} · ${roles} ${roles === 1 ? 'role' : 'roles'}`,
    mfaOn: 'MFA',
    childrenCount: (count) => `${count} ${count === 1 ? 'item' : 'items'}`,
    suggest: 'Suggest',
    capacity: (usable, first, last) =>
      `${usable} usable IPs · ${first} – ${last}`,
    zoneInUse: 'in use',
    tiers: { public: 'Public', private: 'Private', isolated: 'Isolated' },
    planSubnets: 'Plan subnets',
    planHint: 'One subnet per tier in each AZ. Existing ones stay as they are.',
    planTiersLabel: 'Tiers',
    planPrefixLabel: 'Size of each subnet',
    planAzsLabel: 'Zones',
    planPreview: 'Preview',
    planStatusColumn: 'Status',
    planStatus: {
      create: 'Create',
      exists: 'Already exists',
      noSpace: 'No room in the VPC',
    },
    planCreate: (count) =>
      count === 1 ? 'Create 1 subnet' : `Create ${count} subnets`,
    planNothing: 'Nothing to create with this choice.',
    planNeedsCidr: 'Set a valid VPC CIDR before planning.',
    planNeedsAz: 'The VPC has no availability zones yet.',
    cancel: 'Cancel',
    tablesLabel: 'Architecture tables',
    ipamTab: 'IPs (IPAM)',
    ipamVpcFilter: 'VPC',
    ipamAllVpcs: 'All VPCs',
    ipamColumns: {
      vpc: 'VPC',
      az: 'Zone',
      subnet: 'Subnet',
      tier: 'Type',
      cidr: 'CIDR',
      usable: 'Usable',
      used: 'Used',
      free: 'Free',
      range: 'Usable range',
    },
    ipamUsedHint:
      'Used: fixed IPs (EC2, RDS, NAT) and dynamic ones (ALB/NLB, Auto Scaling, RDS standby).',
    ipamVpcTotal: (allocated, size, free) =>
      `${allocated.toLocaleString('en-US')} of ${size.toLocaleString('en-US')} addresses in subnets · ${free.toLocaleString('en-US')} free in the VPC`,
    ipamEmpty:
      'No subnets yet. Create a VPC and use "Plan subnets" in its inspector.',
    ipamEditCidr: (name) => `${name} CIDR`,
    ipamRouteTable: 'Route table',
    ipamNacl: 'NACL',
    naclDefault: 'Default (allow all)',
    tabGroups: {
      addressing: 'Addressing',
      traffic: 'Traffic',
      security: 'Security',
      operation: 'Operation',
      terraform: 'Terraform',
      cost: 'Cost',
      validation: 'Validation',
    },
    validation: validationCopy.en,
    a11y: {
      nodeDescription:
        'Enter or Space selects. With the element selected, the arrow keys move it inside its container (Shift for bigger steps), Delete removes it and Escape clears the selection.',
      edgeDescription:
        'Enter or Space selects the connection. Delete removes it and Escape clears the selection.',
      node: (type, name) => `${type}: ${name}`,
      edge: (from, to, label) => `Connection from ${from} to ${to}, ${label}`,
    },
    connectTo: {
      label: 'Connect to',
      placeholder: 'Pick the target…',
      help: 'Same as dragging from the resource on the canvas: only targets that accept the connection are listed.',
      none: 'No target accepts a connection from this element right now.',
    },
    terraform: terraformCopy.en,
    cost: costCopy.en,
    routes: routesCopy.en,
    security: securityCopy.en,
    refsEmpty: {
      vpcSecurityGroups:
        'No security groups in the VPC. Create one in the Security tab.',
      vpcSubnets: 'No subnets in the VPC.',
      projectVpcs: 'No VPCs in the project.',
      regionSecrets:
        'No secrets, parameters or RDS in this Region. Create them from the palette (Security).',
      backupTargets:
        'Nothing to protect in this Region: create RDS, Aurora, EFS, DynamoDB or EC2.',
    },
    rdsManagedSecret: 'master password managed by RDS',
    noneOption: 'None',
    outOfScope: 'out of scope',
    privateZone: 'private',
    instanceSpec: (vcpu, memoryGiB) => `${vcpu} vCPU · ${memoryGiB} GiB`,
    perHour: '/h',
    badgeCertificate: 'Certificate',
    badgeSecrets: 'Reads',
    armNoWindows: 'arm64, no Windows',
    noRegionPrices: 'Region without loaded prices: default list, no price.',
    connection: connectionCopy.en,
    resourcesTab: 'Resources and addresses',
    resourcesEmpty:
      'No resources with an IP yet. Create EC2, RDS, ALB or NAT in the subnets.',
    resourceColumns: {
      resource: 'Resource',
      type: 'Type',
      subnet: 'Subnet',
      privateIp: 'Private IP',
      publicIp: 'Public IP',
      sgs: 'Security groups',
      dns: 'Internal DNS',
    },
    dynamicIp: (count) => (count === 1 ? 'dynamic' : `dynamic ×${count}`),
    assignNextIp: 'Next free',
    publicIpKinds: {
      eip: 'Elastic IP',
      auto: 'automatic',
      none: '—',
      dns: 'Public DNS',
    },
    connectionsTab: 'Connections',
    connectionsEmpty:
      'No connections. On the canvas, drag from one of a resource’s points (or press and hold on it) to another.',
    connectionColumns: {
      from: 'Source',
      to: 'Target',
      kind: 'Type',
      direction: 'Direction',
      port: 'Protocol / port',
      encrypted: 'Encryption',
      gbMonth: 'GB/month',
    },
    locate: 'Locate',
    split: 'Split both ways',
    merge: 'Merge both ways',
    yes: 'yes',
    no: 'no',
    operationTab: 'Operation',
    operationEmpty: 'No resources yet.',
    operationColumns: {
      resource: 'Resource',
      size: 'Size / class',
      quantity: 'Qty',
      multiAz: 'Multi-AZ',
      backup: 'Backup',
      monitoring: 'Monitoring',
      tags: 'Tags',
    },
    projectEnvironment: 'Project environment',
    bulkTags: (count) => (count === 1 ? '1 selected' : `${count} selected`),
    applyTag: 'Apply',
    selectRow: (name) => `Select ${name}`,
    fromConnection: 'from connection',
  },
  es: {
    studioHint:
      'Borrador de arquitectura AWS. Empieza por la cuenta y crece en capas: región, VPC, zonas, subnets y recursos.',
    paletteTitle: 'Componentes',
    paletteHint: 'Haz clic para crear dentro del elemento seleccionado.',
    nextStep: 'Próximo paso',
    categories: {
      foundation: 'Base',
      network: 'Red',
      edge: 'Borde y entrega',
      compute: 'Cómputo',
      data: 'Datos',
      security: 'Seguridad',
    },
    layers: [
      'Cuenta e identidad',
      'Región',
      'Red (VPC)',
      'Zonas y borde',
      'Subnets',
      'Recursos',
    ],
    canvasLabel: 'Lienzo de la arquitectura cloud',
    emptyTitle: 'La arquitectura empieza por la cuenta',
    emptyBody:
      'La cuenta AWS es el límite de facturación e identidad (IAM). Todo lo que crees después queda dentro de ella.',
    emptyCta: 'Crear cuenta AWS',
    fitView: 'Encuadrar',
    fitToContent: 'Ajustar al contenido',
    fitDone: 'Ya ajustado al contenido',
    connectFrom: 'Conectar desde',
    routesToggle: 'Rutas',
    routesToggleHint:
      'Mostrar las rutas implícitas (IGW, NAT y, con el endpoint seleccionado, endpoints)',
    zoomIn: 'Acercar',
    zoomOut: 'Alejar',
    inspectorTitle: 'Configuración',
    inspectorEmpty: 'Selecciona un elemento del lienzo para configurarlo.',
    nameLabel: 'Nombre',
    sectionConfig: 'Configuración',
    sectionOperation: 'Operación',
    deleteResource: 'Eliminar elemento',
    deletedToast: 'Elemento eliminado (con todo lo que tenía dentro).',
    undo: 'Deshacer',
    redo: 'Rehacer',
    dismiss: 'Cerrar aviso',
    listAdd: 'Agregar',
    regenerate: 'Generar otro',
    chooseGroups: 'Elegir grupos…',
    chooseRoles: 'Elegir roles…',
    searchCatalog: 'Buscar en el catálogo',
    searchPolicies: 'Buscar política administrada',
    addPolicy: 'Agregar política…',
    noMatches: 'No se encontró nada.',
    catalogLoading: 'Cargando catálogo…',
    catalogUnavailable: 'Catálogo no disponible (selecciones conservadas)',
    outsideCatalog: 'fuera del catálogo',
    noPolicies: 'Sin políticas: este grupo/rol no concede acceso.',
    trustedBy: 'Asumido por',
    policyCount: (count) =>
      `${count} ${count === 1 ? 'política' : 'políticas'}`,
    iamInfo: 'Identidades (IAM)',
    iamUsersTitle: 'Usuarios',
    iamGroupsTitle: 'Grupos',
    iamRolesTitle: 'Roles',
    editInInspector: 'Editar en el inspector',
    none: 'Ninguno.',
    tagsSection: 'Tags',
    tagsHint:
      'Vienen de la cuenta. Sobrescribe solo si este elemento es distinto.',
    inheritedFrom: (name) => `heredado de ${name}`,
    inheritOption: (value) => `Heredar (${value})`,
    resetInherit: 'Volver a heredar',
    listRemove: 'Quitar',
    listEmpty: 'Ningún elemento.',
    invalidFormat: 'Formato inválido.',
    regionNoPrices: 'sin precios cargados',
    iamSummary: (users, groups, roles) =>
      `IAM · ${users} ${users === 1 ? 'usuario' : 'usuarios'} · ${groups} ${groups === 1 ? 'grupo' : 'grupos'} · ${roles} ${roles === 1 ? 'rol' : 'roles'}`,
    mfaOn: 'MFA',
    childrenCount: (count) =>
      `${count} ${count === 1 ? 'elemento' : 'elementos'}`,
    suggest: 'Sugerir',
    capacity: (usable, first, last) =>
      `${usable} IP utilizables · ${first} – ${last}`,
    zoneInUse: 'en uso',
    tiers: { public: 'Pública', private: 'Privada', isolated: 'Aislada' },
    planSubnets: 'Planificar subnets',
    planHint:
      'Una subnet por capa en cada AZ. Las que ya existen se quedan como están.',
    planTiersLabel: 'Capas',
    planPrefixLabel: 'Tamaño de cada subnet',
    planAzsLabel: 'Zonas',
    planPreview: 'Vista previa',
    planStatusColumn: 'Estado',
    planStatus: {
      create: 'Crear',
      exists: 'Ya existe',
      noSpace: 'Sin espacio en la VPC',
    },
    planCreate: (count) =>
      count === 1 ? 'Crear 1 subnet' : `Crear ${count} subnets`,
    planNothing: 'Nada que crear con esta elección.',
    planNeedsCidr: 'Define un CIDR válido para la VPC antes de planificar.',
    planNeedsAz: 'La VPC aún no tiene zonas de disponibilidad.',
    cancel: 'Cancelar',
    tablesLabel: 'Tablas de la arquitectura',
    ipamTab: 'IP (IPAM)',
    ipamVpcFilter: 'VPC',
    ipamAllVpcs: 'Todas las VPC',
    ipamColumns: {
      vpc: 'VPC',
      az: 'Zona',
      subnet: 'Subnet',
      tier: 'Tipo',
      cidr: 'CIDR',
      usable: 'Utilizables',
      used: 'Usadas',
      free: 'Libres',
      range: 'Rango utilizable',
    },
    ipamUsedHint:
      'Usadas: IP fijas (EC2, RDS, NAT) y dinámicas (ALB/NLB, Auto Scaling, standby de RDS).',
    ipamVpcTotal: (allocated, size, free) =>
      `${allocated.toLocaleString('es')} de ${size.toLocaleString('es')} direcciones en subnets · ${free.toLocaleString('es')} libres en la VPC`,
    ipamEmpty:
      'Aún no hay subnets. Crea una VPC y usa "Planificar subnets" en su inspector.',
    ipamEditCidr: (name) => `CIDR de ${name}`,
    ipamRouteTable: 'Route table',
    ipamNacl: 'NACL',
    naclDefault: 'Predeterminada (permite todo)',
    tabGroups: {
      addressing: 'Direccionamiento',
      traffic: 'Tráfico',
      security: 'Seguridad',
      operation: 'Operación',
      terraform: 'Terraform',
      cost: 'Costo',
      validation: 'Validación',
    },
    validation: validationCopy.es,
    a11y: {
      nodeDescription:
        'Enter o Espacio selecciona. Con el elemento seleccionado, las flechas lo mueven dentro del contenedor (Shift para pasos mayores), Supr lo elimina y Esc limpia la selección.',
      edgeDescription:
        'Enter o Espacio selecciona la conexión. Supr la elimina y Esc limpia la selección.',
      node: (type, name) => `${type}: ${name}`,
      edge: (from, to, label) => `Conexión de ${from} a ${to}, ${label}`,
    },
    connectTo: {
      label: 'Conectar a',
      placeholder: 'Elige el destino…',
      help: 'Lo mismo que arrastrar desde el recurso en el lienzo: solo aparecen destinos que aceptan la conexión.',
      none: 'Ningún destino acepta una conexión de este elemento ahora.',
    },
    terraform: terraformCopy.es,
    cost: costCopy.es,
    routes: routesCopy.es,
    security: securityCopy.es,
    refsEmpty: {
      vpcSecurityGroups:
        'No hay security groups en la VPC. Crea uno en la pestaña Seguridad.',
      vpcSubnets: 'No hay subnets en la VPC.',
      projectVpcs: 'No hay VPC en el proyecto.',
      regionSecrets:
        'No hay secretos, parámetros ni RDS en esta Región. Créalos desde la paleta (Seguridad).',
      backupTargets:
        'Nada que proteger en esta Región: crea RDS, Aurora, EFS, DynamoDB o EC2.',
    },
    rdsManagedSecret: 'contraseña maestra administrada por RDS',
    noneOption: 'Ninguno',
    outOfScope: 'fuera de alcance',
    privateZone: 'privada',
    instanceSpec: (vcpu, memoryGiB) =>
      `${vcpu} vCPU · ${String(memoryGiB).replace('.', ',')} GiB`,
    perHour: '/h',
    badgeCertificate: 'Certificado',
    badgeSecrets: 'Lee',
    armNoWindows: 'arm64, sin Windows',
    noRegionPrices:
      'Región sin precios cargados: lista predeterminada, sin precio.',
    connection: connectionCopy.es,
    resourcesTab: 'Recursos y direcciones',
    resourcesEmpty:
      'Aún no hay recursos con IP. Crea EC2, RDS, ALB o NAT en las subnets.',
    resourceColumns: {
      resource: 'Recurso',
      type: 'Tipo',
      subnet: 'Subnet',
      privateIp: 'IP privada',
      publicIp: 'IP pública',
      sgs: 'Security groups',
      dns: 'DNS interno',
    },
    dynamicIp: (count) => (count === 1 ? 'dinámica' : `dinámica ×${count}`),
    assignNextIp: 'Siguiente libre',
    publicIpKinds: {
      eip: 'Elastic IP',
      auto: 'automática',
      none: '—',
      dns: 'DNS público',
    },
    connectionsTab: 'Conexiones',
    connectionsEmpty:
      'No hay conexiones. En el lienzo, arrastra desde uno de los puntos de un recurso (o mantén presionado sobre él) hasta otro.',
    connectionColumns: {
      from: 'Origen',
      to: 'Destino',
      kind: 'Tipo',
      direction: 'Dirección',
      port: 'Protocolo / puerto',
      encrypted: 'Cifrado',
      gbMonth: 'GB/mes',
    },
    locate: 'Ubicar',
    split: 'Separar ida/vuelta',
    merge: 'Unir ida/vuelta',
    yes: 'sí',
    no: 'no',
    operationTab: 'Operación',
    operationEmpty: 'Aún no hay recursos.',
    operationColumns: {
      resource: 'Recurso',
      size: 'Tamaño / clase',
      quantity: 'Cant.',
      multiAz: 'Multi-AZ',
      backup: 'Backup',
      monitoring: 'Monitoreo',
      tags: 'Tags',
    },
    projectEnvironment: 'Entorno del proyecto',
    bulkTags: (count) =>
      count === 1 ? '1 seleccionado' : `${count} seleccionados`,
    applyTag: 'Aplicar',
    selectRow: (name) => `Seleccionar ${name}`,
    fromConnection: 'de la conexión',
  },
};

export function getCloudCopy(language: AppLanguage): CloudCopy {
  return COPY[language] ?? COPY.pt;
}
