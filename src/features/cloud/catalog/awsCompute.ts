import { readIdList } from '../engines/addressing';
import {
  APIGW_TYPE,
  apiRoutes,
  clusterIssue,
  ECR_TYPE,
  ecrOf,
  ECS_CLUSTER_TYPE,
  ECS_SERVICE_TYPE,
  EKS_CLUSTER_TYPE,
  EKS_NODEGROUP_TYPE,
  fargateMemoryOptions,
  LAMBDA_TYPE,
} from '../engines/compute';
import { securityGroupsOf } from '../engines/connections';
import {
  certificateCovers,
  certificateOf,
  dnsNameOf,
  publishIssues,
} from '../engines/edge';
import {
  reachabilityIssue,
  sameRegion,
  securityIssues,
} from '../engines/secrets';
import {
  azCountOf,
  subnetsPerAz,
  subnetTier,
  VPC_TYPE,
  closest,
} from '../network';
import type { CloudConnection, CloudResource } from '../types';
import { certificateField, dnsFields } from './awsEdge';
import {
  joinIssues,
  noSgWarning,
  securityGroupsField,
  subnetsField,
} from './awsResources';
import {
  alarmFields,
  logGroupField,
  observabilityIssues,
} from './awsObservability';
import { cognitoAuthField, instanceAccessFields } from './awsSecurity';
import type {
  CloudCatalogEntry,
  CloudCatalogContext,
  CloudField,
  LocalizedText,
} from './types';

/**
 * Computação (F7 onda 7C, parte 1 — `sprint-cloud-f7c1-computacao.md`):
 * ECR, Lambda, API Gateway HTTP, ECS (cluster + serviço Fargate) e EKS
 * (cluster + node group gerenciado).
 */

const same = (text: string): LocalizedText => ({
  pt: text,
  en: text,
  es: text,
});
const SUBNETS = ['aws.subnet.public', 'aws.subnet.private'];

/** Subnets da mesma camada, uma por AZ (como o ASG). */
const subnetsLikeParent = ({ state, parent }: CloudCatalogContext) => {
  if (!parent) return [];
  const vpc = closest(state.resources, parent.id, VPC_TYPE);
  return vpc
    ? subnetsPerAz(state.resources, vpc.id, subnetTier(parent), parent.id)
    : [];
};

const twoAzIssue = (count: number): LocalizedText => ({
  pt: `Use subnets em pelo menos 2 AZs (hoje: ${count}).`,
  en: `Use subnets in at least 2 AZs (now: ${count}).`,
  es: `Usa subnets en al menos 2 AZ (hoy: ${count}).`,
});

const archField: CloudField = {
  key: 'architecture',
  section: 'config',
  type: 'select',
  label: { pt: 'Arquitetura', en: 'Architecture', es: 'Arquitectura' },
  options: [
    { value: 'arm64', label: same('arm64 (Graviton)') },
    { value: 'x86_64', label: same('x86_64') },
  ],
  help: {
    pt: 'arm64 custa menos; a imagem/pacote precisa ser compilado para ela.',
    en: 'arm64 costs less; the image/package must be built for it.',
    es: 'arm64 cuesta menos; la imagen/paquete debe compilarse para ella.',
  },
};

const clusterField = (label: LocalizedText): CloudField => ({
  key: 'clusterId',
  section: 'config',
  type: 'select',
  optionsSource: 'clusters',
  label,
});

const sizeFields: CloudField[] = [
  {
    key: 'minSize',
    section: 'operation',
    type: 'number',
    min: 0,
    max: 1000,
    step: 1,
    label: { pt: 'Mínimo', en: 'Minimum', es: 'Mínimo' },
  },
  {
    key: 'desiredSize',
    section: 'operation',
    type: 'number',
    min: 0,
    max: 1000,
    step: 1,
    label: { pt: 'Desejado', en: 'Desired', es: 'Deseado' },
  },
  {
    key: 'maxSize',
    section: 'operation',
    type: 'number',
    min: 1,
    max: 1000,
    step: 1,
    label: { pt: 'Máximo', en: 'Maximum', es: 'Máximo' },
  },
];

/** Subnets em ≥ 2 AZs + SG + escopo + alcance (cargas nas subnets). */
function workloadIssues(
  resource: CloudResource,
  resources: CloudResource[],
  needsSg: boolean,
  connections: CloudConnection[] = [],
): Record<string, LocalizedText> {
  const issues: Record<string, LocalizedText> = {
    ...securityIssues(resources, resource),
    ...observabilityIssues(resource, resources),
  };
  const azs = azCountOf(resources, readIdList(resource.config.subnetIds));
  if (azs < 2) issues.subnetIds = twoAzIssue(azs);
  if (needsSg && securityGroupsOf(resource).length === 0)
    issues['*'] = noSgWarning;
  const unreachable = reachabilityIssue(resources, resource, connections);
  if (unreachable) issues['*'] = joinIssues(issues['*'], unreachable);
  return issues;
}

// ── ECR ──────────────────────────────────────────────────────────────────
const ecr: CloudCatalogEntry = {
  type: ECR_TYPE,
  layer: 5,
  kind: 'node',
  category: 'compute',
  optional: true,
  label: {
    pt: 'ECR — repositório',
    en: 'ECR — repository',
    es: 'ECR — repositorio',
  },
  summary: {
    pt: 'Imagens de contêiner para ECS e EKS.',
    en: 'Container images for ECS and EKS.',
    es: 'Imágenes de contenedor para ECS y EKS.',
  },
  namePrefix: { pt: 'repo', en: 'repo', es: 'repo' },
  parents: ['aws.region'],
  defaults: { tagMutability: 'IMMUTABLE', scanOnPush: true, storageGb: 5 },
  fields: [
    {
      key: 'tagMutability',
      section: 'config',
      type: 'select',
      label: {
        pt: 'Tags das imagens',
        en: 'Image tags',
        es: 'Tags de las imágenes',
      },
      options: [
        {
          value: 'IMMUTABLE',
          label: { pt: 'Imutáveis', en: 'Immutable', es: 'Inmutables' },
        },
        {
          value: 'MUTABLE',
          label: { pt: 'Mutáveis', en: 'Mutable', es: 'Mutables' },
        },
      ],
    },
    {
      key: 'scanOnPush',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Procurar vulnerabilidades ao enviar',
        en: 'Scan for vulnerabilities on push',
        es: 'Buscar vulnerabilidades al enviar',
      },
    },
    {
      key: 'storageGb',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1,
      unit: 'GB',
      label: {
        pt: 'Imagens armazenadas',
        en: 'Stored images',
        es: 'Imágenes almacenadas',
      },
    },
  ],
};

// ── Lambda ───────────────────────────────────────────────────────────────
const inVpc = (config: Record<string, unknown>) =>
  Array.isArray(config.subnetIds);

const lambda: CloudCatalogEntry = {
  type: LAMBDA_TYPE,
  layer: 5,
  kind: 'node',
  category: 'compute',
  optional: true,
  label: { pt: 'Lambda', en: 'Lambda', es: 'Lambda' },
  summary: {
    pt: 'Função sem servidor. Na Região (sem VPC) ou numa subnet privada (acessa RDS, cache…).',
    en: 'Serverless function. In the Region (no VPC) or in a private subnet (reaches RDS, cache…).',
    es: 'Función sin servidor. En la Región (sin VPC) o en una subnet privada (accede a RDS, caché…).',
  },
  namePrefix: { pt: 'funcao', en: 'function', es: 'funcion' },
  parents: ['aws.region', 'aws.subnet.private'],
  inspectorHint: {
    pt: 'O código não sai do Studio: o Terraform espera o pacote em lambda/<nome>.zip.',
    en: 'The code does not come from the Studio: Terraform expects the package at lambda/<name>.zip.',
    es: 'El código no sale del Studio: Terraform espera el paquete en lambda/<nombre>.zip.',
  },
  defaults: {
    runtime: 'nodejs22.x',
    architecture: 'arm64',
    memoryMb: 512,
    timeoutSec: 30,
    secretIds: [],
    invocationsMillionsMonth: 1,
    avgDurationMs: 200,
  },
  // Criada numa subnet: entra na VPC com as subnets da camada (uma por AZ) e SGs.
  derive: (context) =>
    context.parent && context.parent.type !== 'aws.region'
      ? { subnetIds: subnetsLikeParent(context), securityGroupIds: [] }
      : {},
  validate: (resource, resources, connections) =>
    inVpc(resource.config)
      ? workloadIssues(resource, resources, true, connections)
      : {
          ...securityIssues(resources, resource),
          ...observabilityIssues(resource, resources),
        },
  fields: [
    {
      key: 'runtime',
      section: 'config',
      type: 'select',
      label: { pt: 'Runtime', en: 'Runtime', es: 'Runtime' },
      options: [
        'nodejs22.x',
        'python3.13',
        'java21',
        'dotnet8',
        'provided.al2023',
      ].map((value) => ({ value, label: same(value) })),
    },
    archField,
    {
      key: 'memoryMb',
      section: 'config',
      type: 'number',
      min: 128,
      max: 10240,
      step: 64,
      unit: 'MB',
      label: { pt: 'Memória', en: 'Memory', es: 'Memoria' },
    },
    {
      key: 'timeoutSec',
      section: 'config',
      type: 'number',
      min: 1,
      max: 900,
      step: 1,
      unit: 's',
      label: { pt: 'Tempo limite', en: 'Timeout', es: 'Tiempo límite' },
    },
    { ...subnetsField(same('')), help: undefined, visibleWhen: inVpc },
    { ...securityGroupsField, visibleWhen: inVpc },
    instanceAccessFields[1],
    {
      key: 'invocationsMillionsMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 0.5,
      unit: 'mi',
      label: {
        pt: 'Invocações por mês (milhões)',
        en: 'Invocations per month (millions)',
        es: 'Invocaciones por mes (millones)',
      },
    },
    {
      key: 'avgDurationMs',
      section: 'operation',
      type: 'number',
      min: 1,
      max: 900000,
      step: 10,
      unit: 'ms',
      label: {
        pt: 'Duração média',
        en: 'Average duration',
        es: 'Duración media',
      },
    },
    logGroupField({
      pt: 'Vazio = padrão da AWS. Com grupo, a retenção e a chave são as dele.',
      en: 'Empty = AWS default. With a group, its retention and key apply.',
      es: 'Vacío = predeterminado de AWS. Con grupo, aplican su retención y su clave.',
    }),
    ...alarmFields,
  ],
};

// ── API Gateway (HTTP API) ───────────────────────────────────────────────
const apigw: CloudCatalogEntry = {
  type: APIGW_TYPE,
  layer: 5,
  kind: 'node',
  category: 'edge',
  optional: true,
  label: {
    pt: 'API Gateway (HTTP)',
    en: 'API Gateway (HTTP)',
    es: 'API Gateway (HTTP)',
  },
  summary: {
    pt: 'Porta de entrada de APIs. As rotas são as conexões que saem dela (Lambda, ALB/NLB internos).',
    en: 'API front door. Routes are the connections leaving it (Lambda, internal ALB/NLB).',
    es: 'Puerta de entrada de APIs. Las rutas son las conexiones que salen de ella (Lambda, ALB/NLB internos).',
  },
  namePrefix: { pt: 'api', en: 'api', es: 'api' },
  parents: ['aws.region'],
  inspectorHint: {
    pt: 'Rota: arraste daqui até uma Lambda ou um ALB/NLB interno e dê um caminho (/pedidos/*); sem caminho = rota padrão. HTTP API não aceita WAF.',
    en: 'Route: drag from here to a Lambda or an internal ALB/NLB and give it a path (/orders/*); no path = default route. HTTP APIs do not support WAF.',
    es: 'Ruta: arrastra desde aquí a una Lambda o a un ALB/NLB interno y dale una ruta (/pedidos/*); sin ruta = ruta predeterminada. HTTP API no admite WAF.',
  },
  defaults: {
    certificateId: '',
    dnsZoneId: '',
    dnsRecord: 'api',
    cognitoUserPoolId: '',
    requestsMillionsMonth: 1,
  },
  validate: (resource, resources, connections) => {
    const issues: Record<string, LocalizedText> = {
      ...publishIssues(resources, resource),
      ...securityIssues(resources, resource),
      ...observabilityIssues(resource, resources),
    };
    // Domínio próprio exige certificado da Região que cubra o nome.
    const fqdn = dnsNameOf(resources, resource);
    const cert = certificateOf(resources, resource);
    if (
      fqdn &&
      !issues.certificateId &&
      !(cert && certificateCovers(cert, fqdn))
    ) {
      issues.certificateId = {
        pt: `Para publicar ${fqdn}, escolha um certificado da Região que cubra esse nome.`,
        en: `To publish ${fqdn}, pick a Region certificate that covers that name.`,
        es: `Para publicar ${fqdn}, elige un certificado de la Región que cubra ese nombre.`,
      };
      delete issues.dnsRecord;
    }
    if (connections && apiRoutes(resources, connections, resource).length === 0)
      issues['*'] = {
        pt: 'Sem rotas: arraste uma conexão da API até uma Lambda ou um ALB/NLB interno.',
        en: 'No routes: drag a connection from the API to a Lambda or an internal ALB/NLB.',
        es: 'Sin rutas: arrastra una conexión desde la API a una Lambda o a un ALB/NLB interno.',
      };
    return issues;
  },
  fields: [
    certificateField(),
    ...dnsFields,
    cognitoAuthField(),
    {
      key: 'requestsMillionsMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1,
      unit: 'mi',
      label: {
        pt: 'Requisições por mês (milhões)',
        en: 'Requests per month (millions)',
        es: 'Solicitudes por mes (millones)',
      },
    },
    logGroupField({
      pt: 'Log de acesso do stage (uma linha JSON por requisição).',
      en: 'Stage access log (one JSON line per request).',
      es: 'Log de acceso del stage (una línea JSON por solicitud).',
    }),
  ],
};

// ── ECS ──────────────────────────────────────────────────────────────────
const ecsCluster: CloudCatalogEntry = {
  type: ECS_CLUSTER_TYPE,
  layer: 5,
  kind: 'node',
  category: 'compute',
  optional: true,
  label: { pt: 'ECS — cluster', en: 'ECS — cluster', es: 'ECS — cluster' },
  summary: {
    pt: 'Agrupa os serviços de contêiner (Fargate). Sem custo próprio.',
    en: 'Groups the container services (Fargate). No cost of its own.',
    es: 'Agrupa los servicios de contenedor (Fargate). Sin costo propio.',
  },
  namePrefix: { pt: 'ecs', en: 'ecs', es: 'ecs' },
  parents: ['aws.region'],
  defaults: { containerInsights: false },
  validate: (resource, resources) =>
    resources.some((r) => r.config.clusterId === resource.id)
      ? {}
      : {
          '*': {
            pt: 'Nenhum serviço neste cluster: crie um serviço ECS numa subnet.',
            en: 'No services in this cluster: create an ECS service in a subnet.',
            es: 'Ningún servicio en este cluster: crea un servicio ECS en una subnet.',
          },
        },
  fields: [
    {
      key: 'containerInsights',
      section: 'operation',
      type: 'boolean',
      label: {
        pt: 'Container Insights (métricas detalhadas)',
        en: 'Container Insights (detailed metrics)',
        es: 'Container Insights (métricas detalladas)',
      },
      help: {
        pt: 'Cobrado pelo CloudWatch por volume de métricas; fica fora da estimativa.',
        en: 'Billed by CloudWatch per metric volume; left out of the estimate.',
        es: 'Cobrado por CloudWatch por volumen de métricas; queda fuera de la estimación.',
      },
    },
  ],
};

const CPU_OPTIONS = [256, 512, 1024, 2048, 4096];

const ecsService: CloudCatalogEntry = {
  type: ECS_SERVICE_TYPE,
  layer: 5,
  kind: 'node',
  category: 'compute',
  optional: true,
  label: {
    pt: 'ECS — serviço Fargate',
    en: 'ECS — Fargate service',
    es: 'ECS — servicio Fargate',
  },
  summary: {
    pt: 'Contêineres sem servidor. Recebe tráfego do ALB (target por IP) e roda nas subnets escolhidas.',
    en: 'Serverless containers. Gets ALB traffic (IP targets) and runs in the chosen subnets.',
    es: 'Contenedores sin servidor. Recibe tráfico del ALB (destino por IP) y corre en las subnets elegidas.',
  },
  namePrefix: { pt: 'svc', en: 'svc', es: 'svc' },
  parents: SUBNETS,
  defaults: {
    ecrRepositoryId: '',
    image: '',
    cpu: '512',
    memoryMb: 1024,
    architecture: 'arm64',
    containerPort: 8080,
    desiredCount: 2,
    securityGroupIds: [],
    secretIds: [],
    hoursPerMonth: 730,
  },
  derive: (context) => {
    const { resources } = context.state;
    const parentId = context.parent?.id ?? '';
    const cluster = resources.find(
      (r) =>
        r.type === ECS_CLUSTER_TYPE && sameRegion(resources, r.id, parentId),
    );
    const repo = resources.find(
      (r) => r.type === ECR_TYPE && sameRegion(resources, r.id, parentId),
    );
    return {
      clusterId: cluster?.id ?? '',
      ecrRepositoryId: repo?.id ?? '',
      subnetIds: subnetsLikeParent(context),
    };
  },
  validate: (resource, resources, connections) => {
    const issues = workloadIssues(resource, resources, true, connections);
    const cluster = clusterIssue(resources, resource);
    if (cluster) issues.clusterId = cluster;
    if (
      !ecrOf(resources, resource) &&
      !String(resource.config.image ?? '').trim()
    )
      issues.image = {
        pt: 'Escolha um repositório ECR ou digite a imagem (ex.: nginx:1.27).',
        en: 'Pick an ECR repository or type the image (e.g. nginx:1.27).',
        es: 'Elige un repositorio ECR o escribe la imagen (ej.: nginx:1.27).',
      };
    const cpu = Number(resource.config.cpu);
    const memory = Number(resource.config.memoryMb);
    const valid = fargateMemoryOptions(cpu);
    if (!valid.includes(memory)) {
      const decimal = (n: number) => String(n).replace('.', ',');
      const [lo, hi] = [valid[0] / 1024, valid[valid.length - 1] / 1024];
      issues.memoryMb = {
        pt: `Com ${decimal(cpu / 1024)} vCPU, o Fargate aceita ${decimal(lo)}–${decimal(hi)} GB.`,
        en: `With ${cpu / 1024} vCPU, Fargate accepts ${lo}–${hi} GB.`,
        es: `Con ${decimal(cpu / 1024)} vCPU, Fargate acepta ${decimal(lo)}–${decimal(hi)} GB.`,
      };
    }
    return issues;
  },
  fields: [
    clusterField({ pt: 'Cluster ECS', en: 'ECS cluster', es: 'Cluster ECS' }),
    {
      key: 'ecrRepositoryId',
      section: 'config',
      type: 'select',
      optionsSource: 'ecrRepositories',
      label: { pt: 'Imagem do ECR', en: 'ECR image', es: 'Imagen de ECR' },
    },
    {
      key: 'image',
      section: 'config',
      type: 'text',
      mono: true,
      placeholder: 'nginx:1.27',
      visibleWhen: (config) => !config.ecrRepositoryId,
      label: {
        pt: 'Ou imagem externa',
        en: 'Or external image',
        es: 'O imagen externa',
      },
    },
    {
      key: 'cpu',
      section: 'config',
      type: 'select',
      label: { pt: 'CPU por tarefa', en: 'CPU per task', es: 'CPU por tarea' },
      options: CPU_OPTIONS.map((value) => ({
        value: String(value),
        label: {
          pt: `${String(value / 1024).replace('.', ',')} vCPU`,
          en: `${value / 1024} vCPU`,
          es: `${String(value / 1024).replace('.', ',')} vCPU`,
        },
      })),
    },
    {
      key: 'memoryMb',
      section: 'config',
      type: 'number',
      min: 512,
      max: 30720,
      step: 512,
      unit: 'MB',
      label: {
        pt: 'Memória por tarefa',
        en: 'Memory per task',
        es: 'Memoria por tarea',
      },
    },
    archField,
    {
      key: 'containerPort',
      section: 'config',
      type: 'number',
      min: 1,
      max: 65535,
      step: 1,
      label: {
        pt: 'Porta do contêiner',
        en: 'Container port',
        es: 'Puerto del contenedor',
      },
    },
    subnetsField({
      pt: 'Uma por AZ, em pelo menos 2 AZs.',
      en: 'One per AZ, in at least 2 AZs.',
      es: 'Una por AZ, en al menos 2 AZ.',
    }),
    securityGroupsField,
    instanceAccessFields[1],
    {
      key: 'desiredCount',
      section: 'operation',
      type: 'number',
      min: 0,
      max: 1000,
      step: 1,
      label: { pt: 'Tarefas', en: 'Tasks', es: 'Tareas' },
    },
    logGroupField({
      pt: 'Vazio = padrão da AWS. Com grupo, a retenção e a chave são as dele.',
      en: 'Empty = AWS default. With a group, its retention and key apply.',
      es: 'Vacío = predeterminado de AWS. Con grupo, aplican su retención y su clave.',
    }),
    ...alarmFields,
  ],
};

// ── EKS ──────────────────────────────────────────────────────────────────
const eksCluster: CloudCatalogEntry = {
  type: EKS_CLUSTER_TYPE,
  layer: 5,
  kind: 'node',
  category: 'compute',
  optional: true,
  label: { pt: 'EKS — cluster', en: 'EKS — cluster', es: 'EKS — cluster' },
  summary: {
    pt: 'Kubernetes gerenciado. O plano de controle fica nas subnets escolhidas; os nós vêm nos node groups.',
    en: 'Managed Kubernetes. The control plane sits in the chosen subnets; nodes come from node groups.',
    es: 'Kubernetes administrado. El plano de control queda en las subnets elegidas; los nodos vienen en node groups.',
  },
  namePrefix: { pt: 'eks', en: 'eks', es: 'eks' },
  parents: [VPC_TYPE],
  defaults: { version: '1.34', endpointAccess: 'both', hoursPerMonth: 730 },
  derive: ({ state, parent }) =>
    parent
      ? {
          subnetIds: subnetsPerAz(state.resources, parent.id, [
            'private',
            'isolated',
          ]),
        }
      : { subnetIds: [] },
  validate: (resource, resources) => {
    const issues: Record<string, LocalizedText> = {};
    const azs = azCountOf(resources, readIdList(resource.config.subnetIds));
    if (azs < 2) issues.subnetIds = twoAzIssue(azs);
    if (!resources.some((r) => r.config.clusterId === resource.id))
      issues['*'] = {
        pt: 'Sem nós: crie um node group numa subnet privada.',
        en: 'No nodes: create a node group in a private subnet.',
        es: 'Sin nodos: crea un node group en una subnet privada.',
      };
    return issues;
  },
  fields: [
    {
      key: 'version',
      section: 'config',
      type: 'select',
      label: {
        pt: 'Versão do Kubernetes',
        en: 'Kubernetes version',
        es: 'Versión de Kubernetes',
      },
      options: [
        { value: '1.35', label: same('1.35') },
        { value: '1.34', label: same('1.34') },
        {
          value: '1.33',
          label: {
            pt: '1.33 (suporte estendido)',
            en: '1.33 (extended support)',
            es: '1.33 (soporte extendido)',
          },
        },
      ],
      help: {
        pt: 'Versões fora do suporte padrão custam mais (suporte estendido).',
        en: 'Versions out of standard support cost more (extended support).',
        es: 'Las versiones fuera del soporte estándar cuestan más (soporte extendido).',
      },
    },
    {
      key: 'endpointAccess',
      section: 'config',
      type: 'select',
      label: {
        pt: 'Endpoint da API',
        en: 'API endpoint',
        es: 'Endpoint de la API',
      },
      options: [
        {
          value: 'both',
          label: {
            pt: 'Público e privado',
            en: 'Public and private',
            es: 'Público y privado',
          },
        },
        {
          value: 'private',
          label: { pt: 'Só privado', en: 'Private only', es: 'Solo privado' },
        },
        {
          value: 'public',
          label: { pt: 'Só público', en: 'Public only', es: 'Solo público' },
        },
      ],
    },
    subnetsField({
      pt: 'Subnets das interfaces do plano de controle (≥ 2 AZs).',
      en: 'Subnets for the control plane interfaces (≥ 2 AZs).',
      es: 'Subnets de las interfaces del plano de control (≥ 2 AZ).',
    }),
  ],
};

const eksNodegroup: CloudCatalogEntry = {
  type: EKS_NODEGROUP_TYPE,
  layer: 5,
  kind: 'node',
  category: 'compute',
  optional: true,
  label: {
    pt: 'EKS — node group',
    en: 'EKS — node group',
    es: 'EKS — node group',
  },
  summary: {
    pt: 'Nós gerenciados do cluster EKS (instâncias EC2 com escala automática).',
    en: 'Managed EKS cluster nodes (EC2 instances with auto scaling).',
    es: 'Nodos administrados del cluster EKS (instancias EC2 con escalado automático).',
  },
  namePrefix: { pt: 'nos', en: 'nodes', es: 'nodos' },
  parents: SUBNETS,
  defaults: {
    instanceType: 't3.medium',
    capacityType: 'ON_DEMAND',
    minSize: 2,
    desiredSize: 2,
    maxSize: 4,
    diskGb: 20,
    hoursPerMonth: 730,
  },
  derive: (context) => {
    const vpc = context.parent
      ? closest(context.state.resources, context.parent.id, VPC_TYPE)
      : undefined;
    const cluster = context.state.resources.find(
      (r) =>
        r.type === EKS_CLUSTER_TYPE &&
        vpc !== undefined &&
        r.parentId === vpc.id,
    );
    return {
      clusterId: cluster?.id ?? '',
      subnetIds: subnetsLikeParent(context),
    };
  },
  validate: (resource, resources, connections) => {
    const issues = workloadIssues(resource, resources, false, connections);
    const cluster = clusterIssue(resources, resource);
    if (cluster) issues.clusterId = cluster;
    const { minSize, desiredSize, maxSize } = resource.config as Record<
      string,
      number
    >;
    if (!(minSize <= desiredSize && desiredSize <= maxSize))
      issues.desiredSize = {
        pt: 'Precisa valer mínimo ≤ desejado ≤ máximo.',
        en: 'Must satisfy minimum ≤ desired ≤ maximum.',
        es: 'Debe cumplir mínimo ≤ deseado ≤ máximo.',
      };
    if (resource.config.capacityType === 'SPOT')
      issues.capacityType = {
        pt: 'Spot pode ser interrompido a qualquer hora; o custo estimado usa o preço On-Demand (teto).',
        en: 'Spot can be interrupted at any time; the estimate uses the On-Demand price (ceiling).',
        es: 'Spot puede interrumpirse en cualquier momento; la estimación usa el precio On-Demand (techo).',
      };
    return issues;
  },
  fields: [
    clusterField({ pt: 'Cluster EKS', en: 'EKS cluster', es: 'Cluster EKS' }),
    {
      key: 'instanceType',
      section: 'config',
      type: 'select',
      optionsSource: 'ec2InstanceTypes',
      label: {
        pt: 'Tipo de instância',
        en: 'Instance type',
        es: 'Tipo de instancia',
      },
    },
    {
      key: 'capacityType',
      section: 'config',
      type: 'select',
      label: { pt: 'Capacidade', en: 'Capacity', es: 'Capacidad' },
      options: [
        { value: 'ON_DEMAND', label: same('On-Demand') },
        { value: 'SPOT', label: same('Spot') },
      ],
    },
    {
      key: 'diskGb',
      section: 'config',
      type: 'number',
      min: 20,
      max: 16384,
      step: 1,
      unit: 'GB',
      label: { pt: 'Disco por nó', en: 'Disk per node', es: 'Disco por nodo' },
    },
    subnetsField({
      pt: 'Uma por AZ, em pelo menos 2 AZs.',
      en: 'One per AZ, in at least 2 AZs.',
      es: 'Una por AZ, en al menos 2 AZ.',
    }),
    ...sizeFields,
  ],
};

export const AWS_COMPUTE: CloudCatalogEntry[] = [
  ecr,
  lambda,
  apigw,
  ecsCluster,
  ecsService,
  eksCluster,
  eksNodegroup,
];
