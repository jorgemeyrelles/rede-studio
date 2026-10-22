import {
  azsOf,
  cidrIssueText,
  nextAzLetter,
  regionAzCount,
  regionZones,
  subnetCidrIssue,
  subnetTier,
  suggestCidrForSubnet,
  suggestCidrForVpc,
  vpcCidrIssue,
} from '../network';
import { natIssue, subnetRoutingIssue } from '../engines/routing';
import { naclIssue, NACL_TYPE, SG_TYPE, sgIssue } from '../engines/security';
import { privateIpIssue, suggestIpInSubnet } from '../engines/addressing';
import type { CloudResource } from '../types';
import { awsRegionZones } from './awsRegions';
import { AWS_EDGE } from './awsEdge';
import { AWS_COMPUTE } from './awsCompute';
import { AWS_DATA } from './awsData';
import {
  AWS_OBSERVABILITY,
  logGroupField,
  observabilityIssues,
} from './awsObservability';
import { bucketOf, isCloudFrontOrigin } from '../engines/observability';
import { AWS_SECURITY } from './awsSecurity';
import { AWS_RESOURCES, privateIpField } from './awsResources';
import type { CloudCatalogEntry, CloudField, LocalizedText } from './types';

/**
 * Catálogo AWS do Studio Cloud, na ordem de crescimento da arquitetura.
 * Sprint Cloud 1 cobre L0–L5; conectividade híbrida (VPN, Direct Connect,
 * TGW, peering) fica para a próxima sprint.
 */

// ── L0 — Conta AWS + IAM ─────────────────────────────────────────────────
const account: CloudCatalogEntry = {
  type: 'aws.account',
  layer: 0,
  kind: 'container',
  category: 'foundation',
  groupColor: 'account',
  label: {
    pt: 'Conta AWS + IAM',
    en: 'AWS account + IAM',
    es: 'Cuenta AWS + IAM',
  },
  summary: {
    pt: 'Limite de cobrança e de identidade. Primeiro passo.',
    en: 'Billing and identity boundary. The first step.',
    es: 'Límite de facturación e identidad. Primer paso.',
  },
  namePrefix: { pt: 'Conta', en: 'Account', es: 'Cuenta' },
  parents: [],
  maxPerParent: 1,
  defaultSize: { width: 960, height: 520 },
  defaults: {
    // accountId: gerado na criação (motor de IDs) — ver o campo abaixo.
    environment: 'dev',
    mfaRequired: true,
    iamUsers: [],
    iamGroups: [],
    iamRoles: [],
    owner: '',
    costCenter: '',
    shieldAdvanced: false,
    guardDuty: false,
    securityHub: false,
    awsConfig: false,
    configBucketId: '',
    guardDutyEventsMillionsMonth: 1,
    guardDutyLogsGbMonth: 10,
    securityChecksMonth: 10000,
    configItemsMonth: 1000,
  },
  validate: (resource, resources, connections) => {
    if (resource.config.awsConfig !== true) return {};
    const bucket = bucketOf(resources, resource, 'configBucketId');
    if (!bucket)
      return {
        configBucketId: {
          pt: 'O Config grava num bucket S3: escolha um do projeto.',
          en: 'Config writes to an S3 bucket: pick one from the project.',
          es: 'Config graba en un bucket S3: elige uno del proyecto.',
        },
      };
    return isCloudFrontOrigin(resources, connections ?? [], bucket)
      ? {
          configBucketId: {
            pt: `${bucket.name} é origem do CloudFront e já tem bucket policy: use outro bucket.`,
            en: `${bucket.name} is a CloudFront origin and already has a bucket policy: use another bucket.`,
            es: `${bucket.name} es origen de CloudFront y ya tiene bucket policy: usa otro bucket.`,
          },
        }
      : {};
  },
  fields: [
    {
      key: 'accountId',
      section: 'config',
      type: 'text',
      mono: true,
      pattern: /^\d{12}$/,
      generator: 'aws.accountId',
      label: { pt: 'ID da conta', en: 'Account ID', es: 'ID de la cuenta' },
      help: {
        pt: 'Gerado no formato AWS (12 dígitos). Edite se já tiver a conta.',
        en: 'Generated in AWS format (12 digits). Edit it if you already have the account.',
        es: 'Generado en formato AWS (12 dígitos). Edítalo si ya tienes la cuenta.',
      },
    },
    {
      key: 'environment',
      section: 'config',
      type: 'select',
      label: {
        pt: 'Ambiente (tag Environment)',
        en: 'Environment (Environment tag)',
        es: 'Entorno (tag Environment)',
      },
      help: {
        pt: 'Padrão do projeto: herdado por tudo que for criado dentro da conta.',
        en: 'Project default: inherited by everything created inside the account.',
        es: 'Predeterminado del proyecto: heredado por todo lo que se cree dentro de la cuenta.',
      },
      options: [
        {
          value: 'dev',
          label: { pt: 'Desenvolvimento', en: 'Development', es: 'Desarrollo' },
        },
        {
          value: 'stage',
          label: { pt: 'Homologação', en: 'Staging', es: 'Preproducción' },
        },
        {
          value: 'prod',
          label: { pt: 'Produção', en: 'Production', es: 'Producción' },
        },
      ],
    },
    {
      key: 'mfaRequired',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Exigir MFA no console',
        en: 'Require console MFA',
        es: 'Exigir MFA en la consola',
      },
      help: {
        pt: 'O Terraform cria uma política que bloqueia quase tudo sem MFA e a anexa aos usuários e grupos da conta.',
        en: 'Terraform creates a policy that blocks almost everything without MFA and attaches it to the account’s users and groups.',
        es: 'Terraform crea una política que bloquea casi todo sin MFA y la adjunta a los usuarios y grupos de la cuenta.',
      },
    },
    {
      key: 'iamUsers',
      section: 'config',
      type: 'list',
      label: { pt: 'Usuários IAM', en: 'IAM users', es: 'Usuarios IAM' },
      itemPlaceholder: {
        pt: 'nome do usuário',
        en: 'user name',
        es: 'nombre de usuario',
      },
    },
    {
      key: 'iamGroups',
      section: 'config',
      type: 'iamTemplates',
      kind: 'GROUP',
      label: { pt: 'Grupos IAM', en: 'IAM groups', es: 'Grupos IAM' },
      help: {
        pt: 'Modelos sobre políticas gerenciadas da AWS. As políticas do modelo entram junto e podem ser ajustadas.',
        en: 'Templates over AWS managed policies. The template policies come along and can be adjusted.',
        es: 'Plantillas sobre políticas administradas de AWS. Las políticas de la plantilla vienen incluidas y se pueden ajustar.',
      },
    },
    {
      key: 'iamRoles',
      section: 'config',
      type: 'iamTemplates',
      kind: 'ROLE',
      label: { pt: 'Roles IAM', en: 'IAM roles', es: 'Roles IAM' },
      help: {
        pt: 'Roles assumidas por serviços (EC2, Lambda, ECS...).',
        en: 'Roles assumed by services (EC2, Lambda, ECS...).',
        es: 'Roles asumidos por servicios (EC2, Lambda, ECS...).',
      },
    },
    {
      key: 'shieldAdvanced',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Shield Advanced',
        en: 'Shield Advanced',
        es: 'Shield Advanced',
      },
      help: {
        pt: 'Proteção DDoS gerenciada para CloudFront, ALBs públicos e zonas Route 53. Assinatura de US$ 3.000/mês com compromisso de 1 ano, feita no console.',
        en: 'Managed DDoS protection for CloudFront, public ALBs and Route 53 zones. US$ 3,000/month subscription with a 1-year commitment, made in the console.',
        es: 'Protección DDoS administrada para CloudFront, ALB públicos y zonas Route 53. Suscripción de US$ 3.000/mes con compromiso de 1 año, hecha en la consola.',
      },
    },
    {
      key: 'guardDuty',
      section: 'config',
      type: 'boolean',
      label: { pt: 'GuardDuty', en: 'GuardDuty', es: 'GuardDuty' },
      help: {
        pt: 'Detecção de ameaças em todas as Regiões do projeto (CloudTrail, Flow Logs, DNS). Cobrado por volume analisado.',
        en: 'Threat detection in every project Region (CloudTrail, Flow Logs, DNS). Billed by analyzed volume.',
        es: 'Detección de amenazas en todas las Regiones del proyecto (CloudTrail, Flow Logs, DNS). Cobrado por volumen analizado.',
      },
    },
    {
      key: 'securityHub',
      section: 'config',
      type: 'boolean',
      label: { pt: 'Security Hub', en: 'Security Hub', es: 'Security Hub' },
      help: {
        pt: 'Verificações de boas práticas (padrão AWS Foundational) em todas as Regiões. Cobrado por verificação.',
        en: 'Best-practice checks (AWS Foundational standard) in every Region. Billed per check.',
        es: 'Verificaciones de buenas prácticas (estándar AWS Foundational) en todas las Regiones. Cobrado por verificación.',
      },
    },
    {
      key: 'awsConfig',
      section: 'config',
      type: 'boolean',
      label: { pt: 'AWS Config', en: 'AWS Config', es: 'AWS Config' },
      help: {
        pt: 'Histórico de configuração de cada recurso, em todas as Regiões. Cobrado por item gravado.',
        en: 'Configuration history of every resource, in every Region. Billed per recorded item.',
        es: 'Historial de configuración de cada recurso, en todas las Regiones. Cobrado por ítem grabado.',
      },
    },
    {
      key: 'configBucketId',
      section: 'config',
      type: 'select',
      optionsSource: 'projectBuckets',
      visibleWhen: (config) => config.awsConfig === true,
      label: {
        pt: 'Bucket do Config',
        en: 'Config bucket',
        es: 'Bucket de Config',
      },
    },
    {
      key: 'guardDutyEventsMillionsMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 0.5,
      unit: 'mi',
      visibleWhen: (config) => config.guardDuty === true,
      label: {
        pt: 'GuardDuty: eventos do CloudTrail por Região (milhões)',
        en: 'GuardDuty: CloudTrail events per Region (millions)',
        es: 'GuardDuty: eventos de CloudTrail por Región (millones)',
      },
    },
    {
      key: 'guardDutyLogsGbMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1,
      unit: 'GB',
      visibleWhen: (config) => config.guardDuty === true,
      label: {
        pt: 'GuardDuty: Flow Logs e DNS por Região',
        en: 'GuardDuty: Flow Logs and DNS per Region',
        es: 'GuardDuty: Flow Logs y DNS por Región',
      },
    },
    {
      key: 'securityChecksMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1000,
      visibleWhen: (config) => config.securityHub === true,
      label: {
        pt: 'Security Hub: verificações por Região/mês',
        en: 'Security Hub: checks per Region/month',
        es: 'Security Hub: verificaciones por Región/mes',
      },
    },
    {
      key: 'configItemsMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 100,
      visibleWhen: (config) => config.awsConfig === true,
      label: {
        pt: 'Config: itens gravados por Região/mês',
        en: 'Config: items recorded per Region/month',
        es: 'Config: ítems grabados por Región/mes',
      },
      help: {
        pt: 'Cada mudança de configuração de um recurso vira um item.',
        en: 'Each configuration change of a resource becomes an item.',
        es: 'Cada cambio de configuración de un recurso se vuelve un ítem.',
      },
    },
    {
      key: 'owner',
      section: 'operation',
      type: 'text',
      suggest: 'Owner',
      label: {
        pt: 'Responsável (tag Owner)',
        en: 'Owner (Owner tag)',
        es: 'Responsable (tag Owner)',
      },
      help: {
        pt: 'Padrão do projeto: herdado por tudo que for criado dentro da conta.',
        en: 'Project default: inherited by everything created inside the account.',
        es: 'Predeterminado del proyecto: heredado por todo lo que se cree dentro de la cuenta.',
      },
    },
    {
      key: 'costCenter',
      section: 'operation',
      type: 'text',
      suggest: 'CostCenter',
      label: {
        pt: 'Centro de custo (tag CostCenter)',
        en: 'Cost center (CostCenter tag)',
        es: 'Centro de costo (tag CostCenter)',
      },
      help: {
        pt: 'Padrão do projeto: herdado por tudo que for criado dentro da conta.',
        en: 'Project default: inherited by everything created inside the account.',
        es: 'Predeterminado del proyecto: heredado por todo lo que se cree dentro de la cuenta.',
      },
    },
  ],
};

// ── L1 — Região ──────────────────────────────────────────────────────────
const region: CloudCatalogEntry = {
  type: 'aws.region',
  layer: 1,
  kind: 'container',
  category: 'foundation',
  groupColor: 'region',
  dashed: true,
  label: { pt: 'Região', en: 'Region', es: 'Región' },
  summary: {
    pt: 'Onde os recursos rodam. Define a tabela de preços.',
    en: 'Where resources run. Sets the price table.',
    es: 'Dónde corren los recursos. Define la tabla de precios.',
  },
  namePrefix: { pt: 'Região', en: 'Region', es: 'Región' },
  parents: ['aws.account'],
  defaultSize: { width: 880, height: 420 },
  defaults: { region: 'sa-east-1', azCount: 2 },
  validate: (resource) => {
    const zones = awsRegionZones(resource.config.region).length;
    const wanted = Number(resource.config.azCount);
    return wanted > zones
      ? {
          azCount: {
            pt: `Esta região oferece ${zones} AZ(s).`,
            en: `This region offers ${zones} AZ(s).`,
            es: `Esta región ofrece ${zones} AZ.`,
          },
        }
      : {};
  },
  fields: [
    {
      key: 'region',
      section: 'config',
      type: 'select',
      optionsSource: 'awsRegions',
      label: { pt: 'Região AWS', en: 'AWS region', es: 'Región AWS' },
      help: {
        pt: 'Os preços do custo estimado vêm desta região.',
        en: 'Cost estimate prices come from this region.',
        es: 'Los precios del costo estimado vienen de esta región.',
      },
    },
    {
      key: 'azCount',
      section: 'config',
      type: 'number',
      min: 1,
      max: 6,
      step: 1,
      label: {
        pt: 'Zonas de disponibilidade',
        en: 'Availability zones',
        es: 'Zonas de disponibilidad',
      },
      help: {
        pt: 'Quantas AZs a arquitetura usa (2 ou mais para alta disponibilidade).',
        en: 'How many AZs the architecture uses (2+ for high availability).',
        es: 'Cuántas AZ usa la arquitectura (2 o más para alta disponibilidad).',
      },
    },
  ],
};

// ── L2 — VPC ─────────────────────────────────────────────────────────────
const cidrHelp: LocalizedText = {
  pt: 'Sugerido pelo motor de IP sem sobrepor as outras VPCs do projeto.',
  en: 'Suggested by the IP engine without overlapping the project’s other VPCs.',
  es: 'Sugerido por el motor de IP sin superponerse a las otras VPC del proyecto.',
};

const vpc: CloudCatalogEntry = {
  type: 'aws.vpc',
  layer: 2,
  kind: 'container',
  category: 'network',
  groupColor: 'vpc',
  label: { pt: 'VPC', en: 'VPC', es: 'VPC' },
  summary: {
    pt: 'Rede privada isolada na região. Já nasce com as AZs.',
    en: 'Isolated private network in the region. Comes with its AZs.',
    es: 'Red privada aislada en la región. Nace con sus AZ.',
  },
  namePrefix: { pt: 'VPC', en: 'VPC', es: 'VPC' },
  parents: ['aws.region'],
  defaultSize: { width: 780, height: 372 },
  childLayout: 'row',
  nodeBand: 'top',
  defaults: {
    enableDnsSupport: true,
    enableDnsHostnames: true,
    instanceTenancy: 'default',
    flowLogs: false,
    logGroupId: '',
    flowLogsGbMonth: 10,
  },
  derive: ({ state }) => ({
    cidr: suggestCidrForVpc(state.resources, null) ?? '',
  }),
  // D1 da F2: a VPC já nasce com as AZs que a região usa.
  autoChildren: ({ state, resource }) =>
    Array.from(
      { length: regionAzCount(state.resources, resource.parentId) },
      () => 'aws.az',
    ),
  validate: (resource, resources) => {
    const issue = vpcCidrIssue(resources, resource);
    const issues: Record<string, LocalizedText> = {
      ...(issue ? { cidr: cidrIssueText(issue) } : {}),
      ...observabilityIssues(resource, resources),
    };
    if (resource.config.flowLogs === true && !resource.config.logGroupId)
      issues.flowLogs = {
        pt: 'Escolha o grupo de logs que recebe os Flow Logs (crie um na Região).',
        en: 'Pick the log group that receives the Flow Logs (create one in the Region).',
        es: 'Elige el grupo de logs que recibe los Flow Logs (crea uno en la Región).',
      };
    return issues;
  },
  fields: [
    {
      key: 'cidr',
      section: 'config',
      type: 'text',
      mono: true,
      placeholder: '10.0.0.0/16',
      autofill: (resources, resource) =>
        suggestCidrForVpc(resources, resource.id),
      label: {
        pt: 'Bloco CIDR IPv4',
        en: 'IPv4 CIDR block',
        es: 'Bloque CIDR IPv4',
      },
      help: cidrHelp,
    },
    {
      key: 'enableDnsSupport',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Resolução DNS (Route 53 Resolver)',
        en: 'DNS resolution (Route 53 Resolver)',
        es: 'Resolución DNS (Route 53 Resolver)',
      },
    },
    {
      key: 'enableDnsHostnames',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Nomes DNS para instâncias',
        en: 'DNS hostnames for instances',
        es: 'Nombres DNS para instancias',
      },
    },
    {
      key: 'instanceTenancy',
      section: 'config',
      type: 'select',
      label: {
        pt: 'Locação das instâncias',
        en: 'Instance tenancy',
        es: 'Tenencia de instancias',
      },
      options: [
        {
          value: 'default',
          label: {
            pt: 'Compartilhada (padrão)',
            en: 'Shared (default)',
            es: 'Compartida (predeterminada)',
          },
        },
        {
          value: 'dedicated',
          label: {
            pt: 'Dedicada (custo maior)',
            en: 'Dedicated (higher cost)',
            es: 'Dedicada (costo mayor)',
          },
        },
      ],
    },
    {
      key: 'flowLogs',
      section: 'operation',
      type: 'boolean',
      label: { pt: 'VPC Flow Logs', en: 'VPC Flow Logs', es: 'VPC Flow Logs' },
      help: {
        pt: 'Todo o tráfego (aceito e recusado) vai para um grupo do CloudWatch Logs; a retenção é a do grupo.',
        en: 'All traffic (accepted and rejected) goes to a CloudWatch Logs group; retention is the group’s.',
        es: 'Todo el tráfico (aceptado y rechazado) va a un grupo de CloudWatch Logs; la retención es la del grupo.',
      },
    },
    logGroupField(
      {
        pt: 'Grupo da mesma Região que recebe os Flow Logs.',
        en: 'Same-Region group that receives the Flow Logs.',
        es: 'Grupo de la misma Región que recibe los Flow Logs.',
      },
      (config) => config.flowLogs === true,
    ),
    {
      key: 'flowLogsGbMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1,
      unit: 'GB',
      visibleWhen: (config) => config.flowLogs === true,
      label: {
        pt: 'Volume de Flow Logs por mês',
        en: 'Flow Logs volume per month',
        es: 'Volumen de Flow Logs por mes',
      },
    },
  ],
};

// ── L3 — Zona de disponibilidade e borda da VPC ──────────────────────────
const az: CloudCatalogEntry = {
  type: 'aws.az',
  layer: 3,
  kind: 'container',
  category: 'network',
  groupColor: 'az',
  dashed: true,
  label: {
    pt: 'Zona de disponibilidade',
    en: 'Availability zone',
    es: 'Zona de disponibilidad',
  },
  summary: {
    pt: 'Data center isolado da região. As subnets ficam dentro dela.',
    en: 'Isolated data center in the region. Subnets live inside it.',
    es: 'Centro de datos aislado de la región. Las subnets van dentro.',
  },
  namePrefix: { pt: 'AZ', en: 'AZ', es: 'AZ' },
  parents: ['aws.vpc'],
  defaultSize: { width: 360, height: 196 },
  childLayout: 'column',
  defaults: {},
  derive: ({ state, parent }) => ({
    zone: parent ? (nextAzLetter(state.resources, parent.id) ?? 'a') : 'a',
  }),
  requires: ({ state, parent }) => {
    if (!parent) return null;
    const limit = regionAzCount(state.resources, parent.id);
    if (azsOf(state.resources, parent.id).length < limit) return null;
    return {
      pt: `A região usa ${limit} AZ(s). Aumente em Região → Zonas de disponibilidade.`,
      en: `The region uses ${limit} AZ(s). Increase it in Region → Availability zones.`,
      es: `La región usa ${limit} AZ. Auméntalo en Región → Zonas de disponibilidad.`,
    };
  },
  validate: (resource, resources) => {
    if (
      !regionZones(resources, resource.id).includes(
        String(resource.config.zone),
      )
    ) {
      return {
        zone: {
          pt: 'Esta zona não existe na região escolhida.',
          en: 'This zone does not exist in the selected region.',
          es: 'Esta zona no existe en la región elegida.',
        },
      };
    }
    const clash = azsOf(resources, resource.parentId ?? '').some(
      (other) =>
        other.id !== resource.id && other.config.zone === resource.config.zone,
    );
    return clash
      ? {
          zone: {
            pt: 'Outra AZ desta VPC já usa esta zona.',
            en: 'Another AZ in this VPC already uses this zone.',
            es: 'Otra AZ de esta VPC ya usa esta zona.',
          },
        }
      : {};
  },
  fields: [
    {
      key: 'zone',
      section: 'config',
      type: 'select',
      optionsSource: 'awsZones',
      label: { pt: 'Zona', en: 'Zone', es: 'Zona' },
      help: {
        pt: 'Cada AZ da VPC usa uma zona diferente da região. A AWS mapeia as letras por conta: em contas antigas, confira as zonas disponíveis.',
        en: 'Each AZ in the VPC uses a different zone of the region. AWS maps the letters per account: on older accounts, check which zones are available.',
        es: 'Cada AZ de la VPC usa una zona distinta de la región. AWS asigna las letras por cuenta: en cuentas antiguas, revisa las zonas disponibles.',
      },
    },
  ],
};

const igw: CloudCatalogEntry = {
  type: 'aws.igw',
  layer: 3,
  kind: 'node',
  category: 'network',
  label: {
    pt: 'Internet Gateway',
    en: 'Internet Gateway',
    es: 'Internet Gateway',
  },
  summary: {
    pt: 'Porta da VPC para a internet. Necessário para subnets públicas.',
    en: 'The VPC’s door to the internet. Required by public subnets.',
    es: 'La puerta de la VPC a internet. Necesario para subnets públicas.',
  },
  namePrefix: { pt: 'IGW', en: 'IGW', es: 'IGW' },
  parents: ['aws.vpc'],
  maxPerParent: 1,
  defaults: {},
  fields: [],
};

const ENDPOINT_SERVICES = ['s3', 'dynamodb'] as const;
const usedEndpointServices = (
  resources: CloudResource[],
  vpcId: string | null,
  exceptId: string | null,
) =>
  resources
    .filter(
      (r) =>
        r.type === 'aws.vpc_endpoint.gateway' &&
        r.parentId === vpcId &&
        r.id !== exceptId,
    )
    .map((r) => r.config.service);

const vpcEndpointGateway: CloudCatalogEntry = {
  type: 'aws.vpc_endpoint.gateway',
  layer: 3,
  kind: 'node',
  category: 'network',
  label: {
    pt: 'Endpoint de gateway',
    en: 'Gateway endpoint',
    es: 'Endpoint de gateway',
  },
  summary: {
    pt: 'S3 ou DynamoDB sem passar pela internet nem pelo NAT. Sem custo.',
    en: 'S3 or DynamoDB without going through the internet or NAT. Free.',
    es: 'S3 o DynamoDB sin pasar por internet ni por el NAT. Sin costo.',
  },
  namePrefix: { pt: 'Endpoint', en: 'Endpoint', es: 'Endpoint' },
  parents: ['aws.vpc'],
  maxPerParent: ENDPOINT_SERVICES.length,
  defaults: {},
  derive: ({ state, parent }) => {
    const used = usedEndpointServices(
      state.resources,
      parent?.id ?? null,
      null,
    );
    return {
      service: ENDPOINT_SERVICES.find((s) => !used.includes(s)) ?? 's3',
    };
  },
  validate: (resource, resources) =>
    usedEndpointServices(resources, resource.parentId, resource.id).includes(
      resource.config.service,
    )
      ? {
          service: {
            pt: 'Esta VPC já tem um endpoint para este serviço.',
            en: 'This VPC already has an endpoint for this service.',
            es: 'Esta VPC ya tiene un endpoint para este servicio.',
          },
        }
      : {},
  fields: [
    {
      key: 'service',
      section: 'config',
      type: 'select',
      label: { pt: 'Serviço', en: 'Service', es: 'Servicio' },
      options: [
        {
          value: 's3',
          label: { pt: 'Amazon S3', en: 'Amazon S3', es: 'Amazon S3' },
        },
        {
          value: 'dynamodb',
          label: {
            pt: 'Amazon DynamoDB',
            en: 'Amazon DynamoDB',
            es: 'Amazon DynamoDB',
          },
        },
      ],
    },
  ],
};

// ── L4 — Subnets ─────────────────────────────────────────────────────────
const subnetCidrField = (tier: 'public' | 'private'): CloudField => ({
  key: 'cidr',
  section: 'config',
  type: 'text',
  mono: true,
  placeholder: '10.0.1.0/24',
  capacity: true,
  autofill: (resources, resource) =>
    suggestCidrForSubnet(
      resources,
      resource.parentId ?? '',
      tier === 'public' ? 'public' : subnetTier(resource),
      resource.id,
    ),
  label: {
    pt: 'Bloco CIDR IPv4',
    en: 'IPv4 CIDR block',
    es: 'Bloque CIDR IPv4',
  },
  help: {
    pt: 'Dentro da VPC, sem sobrepor as outras subnets. A AWS reserva 5 IPs por subnet.',
    en: 'Inside the VPC, without overlapping other subnets. AWS reserves 5 IPs per subnet.',
    es: 'Dentro de la VPC, sin superponerse a otras subnets. AWS reserva 5 IP por subnet.',
  },
});

const validateSubnet = (
  resource: CloudResource,
  resources: CloudResource[],
) => {
  const issue = subnetCidrIssue(resources, resource);
  const routing = subnetRoutingIssue(resources, resource);
  return {
    ...(issue ? { cidr: cidrIssueText(issue) } : {}),
    ...(routing ? { '*': routing } : {}),
  };
};

/** NACL da subnet: vazio = NACL padrão da VPC (permite tudo). */
const subnetNaclField: CloudField = {
  key: 'naclId',
  section: 'config',
  type: 'select',
  optionsSource: 'vpcNacls',
  label: { pt: 'Network ACL', en: 'Network ACL', es: 'Network ACL' },
  help: {
    pt: 'Filtro sem estado na borda da subnet. As NACLs são criadas na aba Segurança.',
    en: 'Stateless filter at the subnet edge. NACLs are created in the Security tab.',
    es: 'Filtro sin estado en el borde de la subnet. Las NACL se crean en la pestaña Seguridad.',
  },
};

const subnetPublic: CloudCatalogEntry = {
  type: 'aws.subnet.public',
  layer: 4,
  kind: 'container',
  category: 'network',
  groupColor: 'subnet-public',
  label: { pt: 'Subnet pública', en: 'Public subnet', es: 'Subnet pública' },
  summary: {
    pt: 'Rota para a internet pelo IGW. Load balancers, NAT, bastion.',
    en: 'Routes to the internet through the IGW. Load balancers, NAT, bastion.',
    es: 'Ruta a internet por el IGW. Balanceadores, NAT, bastion.',
  },
  namePrefix: { pt: 'Pública', en: 'Public', es: 'Pública' },
  parents: ['aws.az'],
  defaultSize: { width: 320, height: 132 },
  defaults: { mapPublicIpOnLaunch: true, naclId: '' },
  derive: ({ state, parent }) => ({
    cidr: parent
      ? (suggestCidrForSubnet(state.resources, parent.id, 'public', null) ?? '')
      : '',
  }),
  validate: validateSubnet,
  fields: [
    subnetCidrField('public'),
    {
      key: 'mapPublicIpOnLaunch',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Atribuir IP público ao iniciar',
        en: 'Auto-assign public IP on launch',
        es: 'Asignar IP pública al iniciar',
      },
    },
    subnetNaclField,
  ],
};

const subnetPrivate: CloudCatalogEntry = {
  type: 'aws.subnet.private',
  layer: 4,
  kind: 'container',
  category: 'network',
  groupColor: 'subnet-private',
  label: { pt: 'Subnet privada', en: 'Private subnet', es: 'Subnet privada' },
  summary: {
    pt: 'Sem IP público. Aplicação e dados; sai pela NAT (ou isolada).',
    en: 'No public IP. Apps and data; egress via NAT (or isolated).',
    es: 'Sin IP pública. Aplicación y datos; sale por NAT (o aislada).',
  },
  namePrefix: { pt: 'Privada', en: 'Private', es: 'Privada' },
  parents: ['aws.az'],
  defaultSize: { width: 320, height: 132 },
  defaults: { isolated: false, naclId: '' },
  derive: ({ state, parent }) => ({
    cidr: parent
      ? (suggestCidrForSubnet(state.resources, parent.id, 'private', null) ??
        '')
      : '',
  }),
  validate: validateSubnet,
  fields: [
    subnetCidrField('private'),
    {
      key: 'isolated',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Isolada (sem rota para a internet)',
        en: 'Isolated (no route to the internet)',
        es: 'Aislada (sin ruta a internet)',
      },
      help: {
        pt: 'Bancos e dados sensíveis. Nenhuma rota pela NAT é criada para ela.',
        en: 'Databases and sensitive data. No NAT route will be created for it.',
        es: 'Bases de datos y datos sensibles. No tendrá ruta por el NAT.',
      },
    },
    subnetNaclField,
  ],
};

// ── L4 — Segurança da VPC (itens de configuração, fora do canvas) ────────
const securityHint: LocalizedText = {
  pt: 'As regras ficam na aba Segurança, embaixo do canvas.',
  en: 'Rules are in the Security tab, below the canvas.',
  es: 'Las reglas están en la pestaña Seguridad, debajo del lienzo.',
};

const securityGroup: CloudCatalogEntry = {
  type: SG_TYPE,
  layer: 4,
  kind: 'node',
  category: 'network',
  canvas: false,
  label: { pt: 'Security group', en: 'Security group', es: 'Security group' },
  summary: {
    pt: 'Firewall com estado dos recursos (entrada e saída).',
    en: 'Stateful firewall for resources (inbound and outbound).',
    es: 'Firewall con estado de los recursos (entrada y salida).',
  },
  namePrefix: { pt: 'sg', en: 'sg', es: 'sg' },
  parents: ['aws.vpc'],
  inspectorHint: securityHint,
  // Como a AWS: saída liberada, entrada fechada até haver regra.
  defaults: {
    description: '',
    rules: [
      {
        id: 'default-egress',
        direction: 'egress',
        protocol: 'all',
        ports: '',
        peer: '0.0.0.0/0',
        description: '',
      },
    ],
  },
  validate: (resource, resources) => {
    const issue = sgIssue(resource, resources);
    return issue ? { '*': issue } : {};
  },
  fields: [
    {
      key: 'description',
      section: 'config',
      type: 'text',
      placeholder: 'web, app, db…',
      label: { pt: 'Descrição', en: 'Description', es: 'Descripción' },
    },
  ],
};

const nacl: CloudCatalogEntry = {
  type: NACL_TYPE,
  layer: 4,
  kind: 'node',
  category: 'network',
  canvas: false,
  label: { pt: 'Network ACL', en: 'Network ACL', es: 'Network ACL' },
  summary: {
    pt: 'Filtro sem estado na borda das subnets, por número de regra.',
    en: 'Stateless filter at the subnet edge, by rule number.',
    es: 'Filtro sin estado en el borde de las subnets, por número de regla.',
  },
  namePrefix: { pt: 'acl', en: 'acl', es: 'acl' },
  parents: ['aws.vpc'],
  inspectorHint: securityHint,
  // D3 da F3: nasce permitindo tudo (regra 100) para associar sem cortar tráfego.
  defaults: {
    rules: [
      {
        id: 'r100-in',
        number: 100,
        direction: 'ingress',
        protocol: 'all',
        ports: '',
        cidr: '0.0.0.0/0',
        action: 'allow',
      },
      {
        id: 'r100-out',
        number: 100,
        direction: 'egress',
        protocol: 'all',
        ports: '',
        cidr: '0.0.0.0/0',
        action: 'allow',
      },
    ],
  },
  validate: (resource) => {
    const issue = naclIssue(resource);
    return issue ? { '*': issue } : {};
  },
  fields: [],
};

// ── L5 — Recursos ────────────────────────────────────────────────────────
const natGateway: CloudCatalogEntry = {
  type: 'aws.nat',
  layer: 5,
  kind: 'node',
  category: 'network',
  label: { pt: 'NAT Gateway', en: 'NAT Gateway', es: 'NAT Gateway' },
  summary: {
    pt: 'Saída para a internet das subnets privadas. Uma por AZ.',
    en: 'Internet egress for private subnets. One per AZ.',
    es: 'Salida a internet de las subnets privadas. Uno por AZ.',
  },
  namePrefix: { pt: 'NAT', en: 'NAT', es: 'NAT' },
  parents: ['aws.subnet.public'],
  maxPerParent: 1,
  requires: ({ state, parent }) => {
    const vpcId = parent
      ? state.resources.find((r) => r.id === parent.parentId)?.parentId
      : null;
    const hasIgw = state.resources.some(
      (r) => r.type === 'aws.igw' && r.parentId === vpcId,
    );
    return hasIgw
      ? null
      : {
          pt: 'Crie antes o Internet Gateway da VPC.',
          en: 'Create the VPC’s Internet Gateway first.',
          es: 'Crea antes el Internet Gateway de la VPC.',
        };
  },
  defaults: { dataProcessedGbMonth: 100 },
  derive: ({ state, parent }) => ({
    privateIp: parent
      ? (suggestIpInSubnet(state.resources, parent.id, null) ?? '')
      : '',
  }),
  validate: (resource, resources) => {
    const issue = natIssue(resources, resource);
    const ip = privateIpIssue(resources, resource);
    return {
      ...(issue ? { '*': issue } : {}),
      ...(ip ? { privateIp: ip } : {}),
    };
  },

  fields: [
    privateIpField,
    {
      key: 'dataProcessedGbMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 10,
      unit: 'GB',
      label: {
        pt: 'Dados processados por mês',
        en: 'Data processed per month',
        es: 'Datos procesados por mes',
      },
      help: {
        pt: 'Entra no custo estimado (por GB processado).',
        en: 'Feeds the cost estimate (per GB processed).',
        es: 'Entra en el costo estimado (por GB procesado).',
      },
    },
  ],
};

export const AWS_CATALOG: CloudCatalogEntry[] = [
  account,
  region,
  vpc,
  az,
  igw,
  vpcEndpointGateway,
  subnetPublic,
  subnetPrivate,
  securityGroup,
  nacl,
  natGateway,
  ...AWS_RESOURCES,
  ...AWS_EDGE,
  ...AWS_SECURITY,
  ...AWS_COMPUTE,
  ...AWS_DATA,
  ...AWS_OBSERVABILITY,
];
