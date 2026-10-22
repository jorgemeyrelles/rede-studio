import type {
  CloudPriceCatalogItem,
  CloudPriceCatalogResponse,
} from '../../../services/routes/cloudPricesRoutes';
import { getCatalogEntry, type LocalizedText } from '../catalog';
import { isSubnet } from '../network';
import type {
  CloudAssumptions,
  CloudConnection,
  CloudResource,
} from '../types';
import { readIdList } from './addressing';
import { readConnectionConfig } from './connections';
import { subscriptionsOf, SQS_TYPE } from './data';
import {
  alarmsOf,
  backupStoredGb,
  DETAILED_MONITORING_METRICS,
  flowLogsInto,
  retainedMonths,
} from './observability';
import {
  BOT_CONTROL_GROUP,
  GLOBAL_PRICE_REGION,
  INTERNET_TYPE,
  priceRegionOf,
  wafRuleCount,
  wafRuleGroups,
} from './edge';

/**
 * Motor de custo do Studio Cloud (F6 — `sprint-cloud-f6-custo.md`). Puro:
 * rascunho + premissas + catálogo de preços de cada região → linhas de custo
 * mensal com USD **e** BRL (a moeda exibida é só apresentação).
 *
 * Preço que não existe na região vira linha `unpriced` (fora do total e
 * contada no aviso) — nunca zero em silêncio.
 */

export type CostService =
  | 'ec2'
  | 'ebs'
  | 'rds'
  | 'elb'
  | 'vpc'
  | 's3'
  | 'cloudfront'
  | 'route53'
  | 'waf'
  | 'shield'
  | 'kms'
  | 'secrets'
  | 'ssm'
  | 'cognito'
  | 'lambda'
  | 'apigw'
  | 'fargate'
  | 'eks'
  | 'ecr'
  | 'elasticache'
  | 'dynamodb'
  | 'sqs'
  | 'sns'
  | 'efs'
  | 'cloudwatch'
  | 'cloudtrail'
  | 'backup'
  | 'guardduty'
  | 'securityhub'
  | 'config'
  | 'transfer';

export type CostLine = {
  resourceId: string | null;
  region: string;
  service: CostService;
  /** O que está sendo cobrado ("t3.micro (Linux)", "gp3 storage"...). */
  item: LocalizedText;
  unit: string;
  quantity: number;
  /** Preço médio por unidade (em faixas, o efetivo para a quantidade). */
  unitUsd: number | null;
  unitBrl: number | null;
  monthlyUsd: number | null;
  monthlyBrl: number | null;
  status: 'priced' | 'unpriced';
};

export type CostTotals = { usd: number; brl: number };

export type CostEstimate = {
  lines: CostLine[];
  /** Elementos do rascunho que não têm custo próprio na AWS. */
  free: string[];
  total: CostTotals;
  byService: Record<CostService, CostTotals>;
  byRegion: Record<string, CostTotals>;
  /** Camada do catálogo (0–5) ou `transfer` para as transferências. */
  byLayer: Record<string, CostTotals>;
  unpricedCount: number;
};

export type CostInput = {
  resources: CloudResource[];
  connections: CloudConnection[];
  assumptions: CloudAssumptions;
  /** Catálogo de preços por código de região (`null` = sem carga / indisponível). */
  catalogs: Record<string, CloudPriceCatalogResponse | null | undefined>;
};

/**
 * Franquia permanente da AWS: 100 GB/mês de saída para a internet por conta,
 * somando as regiões (a Price List só mostra o 1º GB grátis).
 */
export const FREE_EGRESS_GB = 100;
/** Franquia permanente do CloudFront (todas as distribuições da conta somadas). */
export const FREE_CLOUDFRONT_GB = 1024;
export const FREE_CLOUDFRONT_REQUESTS = 10_000_000;
/** Franquias permanentes de KMS (requisições) e Cognito Lite/Essentials (MAU). */
export const FREE_KMS_REQUESTS = 20_000;
export const FREE_COGNITO_MAU = 10_000;
/** Franquia permanente da Lambda (todas as funções da conta). */
export const FREE_LAMBDA_REQUESTS = 1_000_000;
export const FREE_LAMBDA_GB_SECONDS = 400_000;
/** Franquias permanentes de DynamoDB (25 RCU/WCU × 744 h; 25 GB), SQS e SNS. */
export const FREE_DYNAMODB_CAPACITY_HOURS = 18_600;
export const FREE_DYNAMODB_GB = 25;
export const FREE_SQS_REQUESTS = 1_000_000;
export const FREE_SNS_PUBLISHES = 1_000_000;
/** Franquias permanentes do CloudWatch (por conta): 5 GB de logs ingeridos e guardados, 10 métricas, 10 alarmes. */
export const FREE_LOGS_GB = 5;
export const FREE_METRICS = 10;
export const FREE_ALARMS = 10;
/** Versões do EKS fora do suporte padrão (cobram o suporte estendido). */
export const EKS_EXTENDED_VERSIONS = ['1.33'];

/** Tipos que a AWS não cobra (aparecem como "sem custo"). */
const FREE_TYPES = [
  'aws.account',
  'aws.region',
  'aws.vpc',
  'aws.az',
  'aws.subnet.public',
  'aws.subnet.private',
  'aws.igw',
  'aws.vpc_endpoint.gateway',
  'aws.security_group',
  'aws.nacl',
  'aws.global',
  'aws.acm.certificate',
  'aws.ecs.cluster',
];

const num = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const same = (text: string): LocalizedText => ({
  pt: text,
  en: text,
  es: text,
});

/** Itens do catálogo com o tipo e os atributos pedidos (faixas ordenadas). */
function find(
  catalog: CloudPriceCatalogResponse | null | undefined,
  resourceType: string,
  attributes: Record<string, unknown>,
) {
  return (catalog?.items ?? [])
    .filter(
      (item) =>
        item.resourceType === resourceType &&
        Object.entries(attributes).every(([k, v]) => item.attributes[k] === v),
    )
    .sort((a, b) => (a.tierBegin ?? 0) - (b.tierBegin ?? 0));
}

/** Custo de `quantity` unidades em faixas (`tierBegin`/`tierEnd`); sem faixa = preço único. */
function tiered(
  items: CloudPriceCatalogItem[],
  quantity: number,
): CostTotals | null {
  if (items.length === 0) return null;
  // Sem faixas de verdade (todas começam no mesmo ponto): preço único. Linhas
  // repetidas no catálogo (mesmo item com outro SKU) nunca somam.
  if (
    items.length === 1 ||
    new Set(items.map((i) => i.tierBegin ?? 0)).size === 1
  ) {
    return { usd: items[0].usd * quantity, brl: items[0].brl * quantity };
  }
  let usd = 0;
  let brl = 0;
  for (const item of items) {
    const begin = item.tierBegin ?? 0;
    const end = item.tierEnd ?? Infinity;
    const inTier = Math.max(0, Math.min(quantity, end) - begin);
    usd += inTier * item.usd;
    brl += inTier * item.brl;
  }
  return { usd, brl };
}

export function estimateCost(input: CostInput): CostEstimate {
  const { resources, connections, assumptions, catalogs } = input;
  const lines: CostLine[] = [];
  const free: string[] = [];
  // Região da tabela de preços: a da Região, ou `global` em Serviços globais.
  const regionOf = (resource: CloudResource) =>
    priceRegionOf(resources, resource.id);

  const add = (
    resource: CloudResource | null,
    region: string,
    service: CostService,
    item: LocalizedText,
    unit: string,
    quantity: number,
    priced: CloudPriceCatalogItem[],
    /**
     * `from`: unidades já consumidas antes nas mesmas faixas (zonas e
     * distribuições somam na conta); `waived`: unidades desta linha cobertas
     * pela franquia — só as posições [from + waived, from + quantity] pagam.
     */
    tiers: { from?: number; waived?: number; afterFree?: boolean } = {},
  ) => {
    if (quantity <= 0) return;
    const from = tiers.from ?? 0;
    const waived = Math.min(quantity, tiers.waived ?? 0);
    // `afterFree`: as faixas contam só o excedente (Cognito: 10 mil grátis, depois a 1ª faixa).
    const end = tiered(
      priced,
      tiers.afterFree ? from + quantity - waived : from + quantity,
    );
    const start =
      !tiers.afterFree && from + waived > 0
        ? tiered(priced, from + waived)
        : null;
    const cost =
      end && start
        ? { usd: end.usd - start.usd, brl: end.brl - start.brl }
        : end;
    lines.push({
      resourceId: resource?.id ?? null,
      region,
      service,
      item,
      unit,
      quantity,
      unitUsd: cost ? cost.usd / quantity : null,
      unitBrl: cost ? cost.brl / quantity : null,
      monthlyUsd: cost?.usd ?? null,
      monthlyBrl: cost?.brl ?? null,
      status: cost ? 'priced' : 'unpriced',
    });
  };

  const hoursOf = (resource: CloudResource) =>
    num(resource.config.hoursPerMonth, assumptions.hoursPerMonth);
  const ipv4 = (
    resource: CloudResource,
    region: string,
    count: number,
    hours: number,
  ) =>
    add(
      resource,
      region,
      'vpc',
      { pt: 'IPv4 público', en: 'Public IPv4', es: 'IPv4 pública' },
      'Hrs',
      count * hours,
      find(catalogs[region], 'aws.vpc.public_ipv4', { kind: 'in_use' }),
    );

  const ebs = (resource: CloudResource, region: string, count: number) => {
    const catalog = catalogs[region];
    add(
      resource,
      region,
      'ebs',
      same('EBS gp3 storage'),
      'GB-Mo',
      num(resource.config.ebsGb, 20) * count,
      find(catalog, 'aws.ebs.gp3', { kind: 'storage' }),
    );
    const iops = Math.max(0, num(resource.config.ebsIops, 3000) - 3000) * count;
    add(
      resource,
      region,
      'ebs',
      {
        pt: 'EBS gp3 IOPS extras',
        en: 'EBS gp3 extra IOPS',
        es: 'EBS gp3 IOPS extra',
      },
      'IOPS-Mo',
      iops,
      find(catalog, 'aws.ebs.gp3', { kind: 'iops' }),
    );
    // O catálogo guarda throughput por GiB/s-mês; o campo é em MiB/s.
    const throughput =
      (Math.max(0, num(resource.config.ebsThroughput, 125) - 125) / 1024) *
      count;
    add(
      resource,
      region,
      'ebs',
      {
        pt: 'EBS gp3 vazão extra',
        en: 'EBS gp3 extra throughput',
        es: 'EBS gp3 rendimiento extra',
      },
      'GiBps-mo',
      throughput,
      find(catalog, 'aws.ebs.gp3', { kind: 'throughput' }),
    );
  };

  const instance = (resource: CloudResource, region: string, count: number) => {
    const type = str(resource.config.instanceType);
    const os = resource.config.os === 'windows' ? 'Windows' : 'Linux';
    add(
      resource,
      region,
      'ec2',
      same(`${type} (${os})`),
      'Hrs',
      hoursOf(resource) * count,
      find(catalogs[region], 'aws.ec2.instance', {
        instanceType: type,
        operatingSystem: os,
      }),
    );
  };

  // Acumulados da conta (faixas e franquias somam entre recursos).
  const freeEgress = assumptions.freeTierEgress !== false;
  let cfFreeGb = freeEgress ? FREE_CLOUDFRONT_GB : 0;
  let cfFreeRequests = freeEgress ? FREE_CLOUDFRONT_REQUESTS : 0;
  const cfGbByGeo = new Map<string, number>();
  let zonesSoFar = 0;
  let queriesSoFar = 0;
  let kmsFreeRequests = freeEgress ? FREE_KMS_REQUESTS : 0;
  let cognitoFreeMau = freeEgress ? FREE_COGNITO_MAU : 0;
  let lambdaFreeRequests = freeEgress ? FREE_LAMBDA_REQUESTS : 0;
  let lambdaFreeGbs = freeEgress ? FREE_LAMBDA_GB_SECONDS : 0;
  const lambdaGbsByArch = new Map<string, number>();
  let apiRequestsSoFar = 0;
  // DynamoDB e SNS trazem a franquia como 1ª faixa do catálogo: sem franquia, começa depois dela.
  let ddbRcuSoFar = freeEgress ? 0 : FREE_DYNAMODB_CAPACITY_HOURS;
  let ddbWcuSoFar = freeEgress ? 0 : FREE_DYNAMODB_CAPACITY_HOURS;
  let ddbGbSoFar = freeEgress ? 0 : FREE_DYNAMODB_GB;
  let snsSoFar = freeEgress ? 0 : FREE_SNS_PUBLISHES;
  let sqsFreeRequests = freeEgress ? FREE_SQS_REQUESTS : 0;
  let logsFreeIngest = freeEgress ? FREE_LOGS_GB : 0;
  let logsFreeStorage = freeEgress ? FREE_LOGS_GB : 0;
  let metricsFree = freeEgress ? FREE_METRICS : 0;
  let alarmsFree = freeEgress ? FREE_ALARMS : 0;
  let metricsSoFar = 0;
  let vendedSoFar = 0;
  const regionCodes = [
    ...new Set(
      resources
        .filter((r) => r.type === 'aws.region')
        .map((r) => str(r.config.region))
        .filter(Boolean),
    ),
  ];
  const metrics = (resource: CloudResource, region: string, count: number) => {
    if (count <= 0) return;
    const waived = Math.min(count, metricsFree);
    metricsFree -= waived;
    add(
      resource,
      region,
      'cloudwatch',
      {
        pt: 'Monitoramento detalhado (métricas de 1 min)',
        en: 'Detailed monitoring (1-min metrics)',
        es: 'Monitoreo detallado (métricas de 1 min)',
      },
      'Metrics',
      count,
      find(catalogs[region], 'aws.cloudwatch', { kind: 'metrics' }),
      { from: metricsSoFar, waived },
    );
    metricsSoFar += count;
  };

  for (const resource of resources) {
    if (resource.type === INTERNET_TYPE) continue;
    if (
      resource.type === 'aws.account' &&
      resource.config.shieldAdvanced === true
    ) {
      add(
        resource,
        GLOBAL_PRICE_REGION,
        'shield',
        same('Shield Advanced'),
        'Mo',
        1,
        find(catalogs[GLOBAL_PRICE_REGION], 'aws.shield', { kind: 'monthly' }),
      );
    }
    // Governança da conta: GuardDuty, Security Hub e Config em cada Região do projeto.
    if (resource.type === 'aws.account')
      for (const code of regionCodes) {
        const c = resource.config;
        if (c.guardDuty === true) {
          add(
            resource,
            code,
            'guardduty',
            {
              pt: 'GuardDuty: eventos do CloudTrail',
              en: 'GuardDuty: CloudTrail events',
              es: 'GuardDuty: eventos de CloudTrail',
            },
            'Events',
            num(c.guardDutyEventsMillionsMonth, 0) * 1e6,
            find(catalogs[code], 'aws.guardduty', { kind: 'events' }),
          );
          add(
            resource,
            code,
            'guardduty',
            {
              pt: 'GuardDuty: Flow Logs e DNS',
              en: 'GuardDuty: Flow Logs and DNS',
              es: 'GuardDuty: Flow Logs y DNS',
            },
            'GB',
            num(c.guardDutyLogsGbMonth, 0),
            find(catalogs[code], 'aws.guardduty', { kind: 'logs' }),
          );
        }
        if (c.securityHub === true)
          add(
            resource,
            code,
            'securityhub',
            {
              pt: 'Security Hub: verificações',
              en: 'Security Hub: checks',
              es: 'Security Hub: verificaciones',
            },
            'Security Checks',
            num(c.securityChecksMonth, 0),
            find(catalogs[code], 'aws.securityhub', { kind: 'checks' }),
          );
        if (c.awsConfig === true)
          add(
            resource,
            code,
            'config',
            {
              pt: 'Config: itens gravados',
              en: 'Config: recorded items',
              es: 'Config: ítems grabados',
            },
            'Items',
            num(c.configItemsMonth, 0),
            find(catalogs[code], 'aws.config', { kind: 'items' }),
          );
      }
    // Flow Logs: a VPC não é cobrada, o volume entregue ao CloudWatch é.
    if (
      resource.type === 'aws.vpc' &&
      resource.config.flowLogs === true &&
      str(resource.config.logGroupId)
    ) {
      const region = regionOf(resource);
      const gb = num(resource.config.flowLogsGbMonth, 0);
      add(
        resource,
        region,
        'cloudwatch',
        {
          pt: 'Flow Logs (logs entregues)',
          en: 'Flow Logs (vended logs)',
          es: 'Flow Logs (logs entregados)',
        },
        'GB',
        gb,
        find(catalogs[region], 'aws.cloudwatch', { kind: 'logs_vended' }),
        { from: vendedSoFar },
      );
      vendedSoFar += gb;
    }
    if (FREE_TYPES.includes(resource.type)) {
      free.push(resource.id);
      continue;
    }
    const region = regionOf(resource);
    const catalog = catalogs[region];
    switch (resource.type) {
      case 'aws.ec2':
        instance(resource, region, 1);
        ebs(resource, region, 1);
        if (resource.config.detailedMonitoring === true)
          metrics(resource, region, DETAILED_MONITORING_METRICS);
        if (resource.config.publicIp === true)
          ipv4(resource, region, 1, hoursOf(resource));
        break;
      case 'aws.asg': {
        const desired = num(resource.config.desiredSize, 1);
        instance(resource, region, desired);
        ebs(resource, region, desired);
        if (resource.config.detailedMonitoring === true)
          metrics(resource, region, DETAILED_MONITORING_METRICS * desired);
        break;
      }
      case 'aws.rds': {
        const engine =
          resource.config.engine === 'mysql' ? 'MySQL' : 'PostgreSQL';
        const deployment =
          resource.config.multiAz === true ? 'Multi-AZ' : 'Single-AZ';
        const klass = str(resource.config.instanceClass);
        add(
          resource,
          region,
          'rds',
          same(`${klass} ${engine} ${deployment}`),
          'Hrs',
          hoursOf(resource),
          find(catalog, 'aws.rds.instance', {
            instanceClass: klass,
            engine,
            deployment,
          }),
        );
        add(
          resource,
          region,
          'rds',
          same(`RDS gp3 storage ${deployment}`),
          'GB-Mo',
          num(resource.config.storageGb, 20),
          find(catalog, 'aws.rds.storage', {
            engine,
            deployment,
            volumeType: 'gp3',
          }),
        );
        // O Terraform liga `manage_master_user_password`: a senha vira um segredo cobrado.
        add(
          resource,
          region,
          'secrets',
          {
            pt: 'Segredo da senha mestre (gerenciado pelo RDS)',
            en: 'Master password secret (managed by RDS)',
            es: 'Secreto de la contraseña maestra (administrado por RDS)',
          },
          'Secrets',
          1,
          find(catalog, 'aws.secretsmanager', { kind: 'secret' }),
        );
        break;
      }
      case 'aws.aurora': {
        const engine =
          resource.config.engine === 'aurora-mysql'
            ? 'Aurora MySQL'
            : 'Aurora PostgreSQL';
        const storageMode =
          resource.config.storageMode === 'io-optimized'
            ? 'io-optimized'
            : 'standard';
        const klass = str(resource.config.instanceClass);
        const instances = 1 + num(resource.config.readers, 0);
        add(
          resource,
          region,
          'rds',
          same(`${klass} ${engine} × ${instances}`),
          'Hrs',
          hoursOf(resource) * instances,
          find(catalog, 'aws.aurora.instance', {
            instanceClass: klass,
            engine,
            storageMode,
          }),
        );
        add(
          resource,
          region,
          'rds',
          storageMode === 'io-optimized'
            ? same('Aurora I/O-Optimized storage')
            : same('Aurora storage'),
          'GB-Mo',
          num(resource.config.storageGb, 0),
          find(catalog, 'aws.aurora.storage', { engine, storageMode }),
        );
        if (storageMode === 'standard')
          add(
            resource,
            region,
            'rds',
            {
              pt: 'Aurora E/S',
              en: 'Aurora I/O',
              es: 'Aurora E/S',
            },
            'IOs',
            num(resource.config.ioMillionsMonth, 0) * 1e6,
            find(catalog, 'aws.aurora.io', { engine }),
          );
        add(
          resource,
          region,
          'secrets',
          {
            pt: 'Segredo da senha mestre (gerenciado pelo Aurora)',
            en: 'Master password secret (managed by Aurora)',
            es: 'Secreto de la contraseña maestra (administrado por Aurora)',
          },
          'Secrets',
          1,
          find(catalog, 'aws.secretsmanager', { kind: 'secret' }),
        );
        break;
      }
      case 'aws.elasticache': {
        const engine = resource.config.engine === 'redis' ? 'Redis' : 'Valkey';
        const nodeType = str(resource.config.nodeType);
        const nodes = 1 + num(resource.config.replicas, 0);
        add(
          resource,
          region,
          'elasticache',
          same(`${nodeType} ${engine} × ${nodes}`),
          'NodeUsage',
          hoursOf(resource) * nodes,
          find(catalog, 'aws.elasticache.node', { nodeType, engine }),
        );
        break;
      }
      case 'aws.dynamodb.table': {
        const storage = num(resource.config.storageGb, 0);
        if (resource.config.billingMode === 'PROVISIONED') {
          const hours = assumptions.hoursPerMonth;
          const rcu = num(resource.config.readCapacity, 0) * hours;
          const wcu = num(resource.config.writeCapacity, 0) * hours;
          add(
            resource,
            region,
            'dynamodb',
            {
              pt: 'Leitura provisionada',
              en: 'Provisioned reads',
              es: 'Lectura aprovisionada',
            },
            'RCU-Hrs',
            rcu,
            find(catalog, 'aws.dynamodb', { kind: 'rcu' }),
            { from: ddbRcuSoFar },
          );
          ddbRcuSoFar += rcu;
          add(
            resource,
            region,
            'dynamodb',
            {
              pt: 'Gravação provisionada',
              en: 'Provisioned writes',
              es: 'Escritura aprovisionada',
            },
            'WCU-Hrs',
            wcu,
            find(catalog, 'aws.dynamodb', { kind: 'wcu' }),
            { from: ddbWcuSoFar },
          );
          ddbWcuSoFar += wcu;
        } else {
          add(
            resource,
            region,
            'dynamodb',
            {
              pt: 'Leituras sob demanda',
              en: 'On-demand reads',
              es: 'Lecturas bajo demanda',
            },
            'ReadRequestUnits',
            num(resource.config.readsMillionsMonth, 0) * 1e6,
            find(catalog, 'aws.dynamodb', { kind: 'read_requests' }),
          );
          add(
            resource,
            region,
            'dynamodb',
            {
              pt: 'Gravações sob demanda',
              en: 'On-demand writes',
              es: 'Escrituras bajo demanda',
            },
            'WriteRequestUnits',
            num(resource.config.writesMillionsMonth, 0) * 1e6,
            find(catalog, 'aws.dynamodb', { kind: 'write_requests' }),
          );
        }
        add(
          resource,
          region,
          'dynamodb',
          { pt: 'Armazenamento', en: 'Storage', es: 'Almacenamiento' },
          'GB-Mo',
          storage,
          find(catalog, 'aws.dynamodb', { kind: 'storage' }),
          { from: ddbGbSoFar },
        );
        ddbGbSoFar += storage;
        if (resource.config.pitr === true)
          add(
            resource,
            region,
            'dynamodb',
            same('PITR'),
            'GB-Mo',
            storage,
            find(catalog, 'aws.dynamodb', { kind: 'pitr' }),
          );
        break;
      }
      case 'aws.sqs.queue': {
        const queueType = resource.config.fifo === true ? 'fifo' : 'standard';
        const requests = num(resource.config.requestsMillionsMonth, 0) * 1e6;
        const waived = Math.min(requests, sqsFreeRequests);
        sqsFreeRequests -= waived;
        add(
          resource,
          region,
          'sqs',
          {
            pt: `Requisições (${queueType === 'fifo' ? 'FIFO' : 'Standard'})`,
            en: `Requests (${queueType === 'fifo' ? 'FIFO' : 'Standard'})`,
            es: `Solicitudes (${queueType === 'fifo' ? 'FIFO' : 'Standard'})`,
          },
          'Requests',
          requests,
          find(catalog, 'aws.sqs', { kind: 'requests', queueType }),
          { waived },
        );
        break;
      }
      case 'aws.sns.topic': {
        const publishes = num(resource.config.publishesMillionsMonth, 0) * 1e6;
        if (resource.config.fifo === true) {
          add(
            resource,
            region,
            'sns',
            {
              pt: 'Publicações FIFO',
              en: 'FIFO publishes',
              es: 'Publicaciones FIFO',
            },
            'Requests',
            publishes,
            find(catalog, 'aws.sns', { kind: 'fifo_publishes' }),
          );
          // FIFO cobra cada entrega às filas assinantes.
          const queues = subscriptionsOf(
            resources,
            connections,
            resource,
          ).filter((r) => r.type === SQS_TYPE).length;
          add(
            resource,
            region,
            'sns',
            {
              pt: `Entregas FIFO (${queues} fila)`,
              en: `FIFO deliveries (${queues} queue)`,
              es: `Entregas FIFO (${queues} cola)`,
            },
            'Messages',
            publishes * queues,
            find(catalog, 'aws.sns', { kind: 'fifo_deliveries' }),
          );
        } else {
          add(
            resource,
            region,
            'sns',
            { pt: 'Publicações', en: 'Publishes', es: 'Publicaciones' },
            'Requests',
            publishes,
            find(catalog, 'aws.sns', { kind: 'publishes' }),
            { from: snsSoFar },
          );
          snsSoFar += publishes;
        }
        break;
      }
      case 'aws.efs':
        add(
          resource,
          region,
          'efs',
          {
            pt: 'EFS Standard armazenamento',
            en: 'EFS Standard storage',
            es: 'EFS Standard almacenamiento',
          },
          'GB-Mo',
          num(resource.config.storageGb, 0),
          find(catalog, 'aws.efs', { kind: 'storage' }),
        );
        if (resource.config.throughputMode !== 'bursting') {
          add(
            resource,
            region,
            'efs',
            {
              pt: 'Elastic: leituras',
              en: 'Elastic: reads',
              es: 'Elastic: lecturas',
            },
            'GB',
            num(resource.config.readGbMonth, 0),
            find(catalog, 'aws.efs', { kind: 'elastic_read' }),
          );
          add(
            resource,
            region,
            'efs',
            {
              pt: 'Elastic: gravações',
              en: 'Elastic: writes',
              es: 'Elastic: escrituras',
            },
            'GB',
            num(resource.config.writeGbMonth, 0),
            find(catalog, 'aws.efs', { kind: 'elastic_write' }),
          );
        }
        break;
      case 'aws.logs.group': {
        const ingest = num(resource.config.ingestGbMonth, 0);
        const ingestWaived = Math.min(ingest, logsFreeIngest);
        logsFreeIngest -= ingestWaived;
        add(
          resource,
          region,
          'cloudwatch',
          {
            pt: 'Logs ingeridos',
            en: 'Ingested logs',
            es: 'Logs ingeridos',
          },
          'GB',
          ingest,
          find(catalog, 'aws.cloudwatch', { kind: 'logs_ingest' }),
          { waived: ingestWaived },
        );
        const stored =
          (ingest + flowLogsInto(resources, resource)) *
          retainedMonths(Number(resource.config.retentionDays));
        const storedWaived = Math.min(stored, logsFreeStorage);
        logsFreeStorage -= storedWaived;
        add(
          resource,
          region,
          'cloudwatch',
          {
            pt: 'Logs armazenados',
            en: 'Stored logs',
            es: 'Logs almacenados',
          },
          'GB-Mo',
          stored,
          find(catalog, 'aws.cloudwatch', { kind: 'logs_storage' }),
          { waived: storedWaived },
        );
        break;
      }
      case 'aws.cloudtrail':
        if (resource.config.dataEvents === true)
          add(
            resource,
            region,
            'cloudtrail',
            {
              pt: 'Eventos de dados',
              en: 'Data events',
              es: 'Eventos de datos',
            },
            'Events',
            num(resource.config.dataEventsMillionsMonth, 0) * 1e6,
            find(catalog, 'aws.cloudtrail', { kind: 'data_events' }),
          );
        // A 1ª cópia dos eventos de gestão é grátis.
        else free.push(resource.id);
        break;
      case 'aws.backup.plan':
        for (const { target, gb } of backupStoredGb(resources, resource)) {
          const engine = (aurora: boolean) =>
            aurora
              ? target.config.engine === 'aurora-mysql'
                ? 'Aurora MySQL'
                : 'Aurora PostgreSQL'
              : target.config.engine === 'mysql'
                ? 'MySQL'
                : 'PostgreSQL';
          const priced =
            target.type === 'aws.efs'
              ? find(catalog, 'aws.backup', {
                  kind: 'warm_storage',
                  target: 'EFS',
                })
              : target.type === 'aws.dynamodb.table'
                ? find(catalog, 'aws.backup', {
                    kind: 'warm_storage',
                    target: 'DynamoDB',
                  })
                : target.type === 'aws.ec2'
                  ? find(catalog, 'aws.ebs.snapshot', { kind: 'storage' })
                  : target.type === 'aws.aurora'
                    ? find(catalog, 'aws.aurora.backup', {
                        engine: engine(true),
                      })
                    : find(catalog, 'aws.rds.backup', {
                        engine: engine(false),
                      });
          add(
            resource,
            region,
            'backup',
            {
              pt: `Backup de ${target.name}`,
              en: `Backup of ${target.name}`,
              es: `Backup de ${target.name}`,
            },
            'GB-Mo',
            gb,
            priced,
          );
        }
        break;
      case 'aws.alb':
      case 'aws.nlb': {
        const type =
          resource.type === 'aws.alb' ? 'aws.elb.alb' : 'aws.elb.nlb';
        const hours = hoursOf(resource);
        const label = resource.type === 'aws.alb' ? 'ALB' : 'NLB';
        add(
          resource,
          region,
          'elb',
          same(`${label}`),
          'Hrs',
          hours,
          find(catalog, type, { kind: 'hours' }),
        );
        add(
          resource,
          region,
          'elb',
          same(`${label} LCU`),
          'LCU-Hrs',
          num(resource.config.lcuPerHour, 1) * hours,
          find(catalog, type, { kind: 'lcu' }),
        );
        if (resource.config.scheme !== 'internal')
          ipv4(
            resource,
            region,
            readIdList(resource.config.subnetIds).length,
            hours,
          );
        break;
      }
      case 'aws.nat': {
        const hours = assumptions.hoursPerMonth;
        add(
          resource,
          region,
          'vpc',
          same('NAT Gateway'),
          'Hrs',
          hours,
          find(catalog, 'aws.vpc.nat_gateway', { kind: 'hours' }),
        );
        add(
          resource,
          region,
          'vpc',
          {
            pt: 'NAT dados processados',
            en: 'NAT data processed',
            es: 'NAT datos procesados',
          },
          'GB',
          num(resource.config.dataProcessedGbMonth, 0),
          find(catalog, 'aws.vpc.nat_gateway', { kind: 'data_processed' }),
        );
        ipv4(resource, region, 1, hours);
        break;
      }
      case 'aws.s3':
        add(
          resource,
          region,
          's3',
          {
            pt: 'S3 Standard armazenamento',
            en: 'S3 Standard storage',
            es: 'S3 Standard almacenamiento',
          },
          'GB-Mo',
          num(resource.config.storageGbMonth, 0),
          find(catalog, 'aws.s3.standard', { kind: 'storage' }),
        );
        add(
          resource,
          region,
          's3',
          {
            pt: 'S3 requisições GET',
            en: 'S3 GET requests',
            es: 'S3 solicitudes GET',
          },
          'Requests',
          num(resource.config.requestsPerMonth, 0),
          find(catalog, 'aws.s3.standard', { kind: 'get_requests' }),
        );
        add(
          resource,
          region,
          's3',
          {
            pt: 'S3 requisições PUT/COPY/POST/LIST',
            en: 'S3 PUT/COPY/POST/LIST requests',
            es: 'S3 solicitudes PUT/COPY/POST/LIST',
          },
          'Requests',
          num(resource.config.putRequestsPerMonth, 0),
          find(catalog, 'aws.s3.standard', { kind: 'put_requests' }),
        );
        break;
      case 'aws.vpc_endpoint.interface': {
        // Uma interface por subnet (AZ), cobrada por hora.
        const enis = Math.max(1, readIdList(resource.config.subnetIds).length);
        add(
          resource,
          region,
          'vpc',
          {
            pt: `Endpoint de interface (${enis} AZ)`,
            en: `Interface endpoint (${enis} AZ)`,
            es: `Endpoint de interfaz (${enis} AZ)`,
          },
          'Hrs',
          enis * assumptions.hoursPerMonth,
          find(catalog, 'aws.vpc.interface_endpoint', { kind: 'hours' }),
        );
        add(
          resource,
          region,
          'vpc',
          {
            pt: 'Endpoint: dados processados',
            en: 'Endpoint: data processed',
            es: 'Endpoint: datos procesados',
          },
          'GB',
          num(resource.config.dataProcessedGbMonth, 0),
          find(catalog, 'aws.vpc.interface_endpoint', {
            kind: 'data_processed',
          }),
        );
        break;
      }
      case 'aws.kms.key': {
        add(
          resource,
          region,
          'kms',
          {
            pt: 'Chave gerenciada pelo cliente',
            en: 'Customer managed key',
            es: 'Clave administrada por el cliente',
          },
          'Keys',
          1,
          find(catalog, 'aws.kms', { kind: 'key' }),
        );
        const requests = num(resource.config.requestsPerMonth, 0);
        const waived = Math.min(requests, kmsFreeRequests);
        kmsFreeRequests -= waived;
        add(
          resource,
          region,
          'kms',
          { pt: 'Requisições', en: 'Requests', es: 'Solicitudes' },
          'Requests',
          requests,
          find(catalog, 'aws.kms', { kind: 'requests' }),
          { waived },
        );
        break;
      }
      case 'aws.secret':
        add(
          resource,
          region,
          'secrets',
          { pt: 'Segredo', en: 'Secret', es: 'Secreto' },
          'Secrets',
          1,
          find(catalog, 'aws.secretsmanager', { kind: 'secret' }),
        );
        add(
          resource,
          region,
          'secrets',
          { pt: 'Chamadas de API', en: 'API calls', es: 'Llamadas de API' },
          'API Requests',
          num(resource.config.apiCallsPerMonth, 0),
          find(catalog, 'aws.secretsmanager', { kind: 'api_requests' }),
        );
        break;
      case 'aws.ssm.parameter':
        if (resource.config.tier === 'Advanced')
          add(
            resource,
            region,
            'ssm',
            {
              pt: 'Parâmetro Advanced',
              en: 'Advanced parameter',
              es: 'Parámetro Advanced',
            },
            'Hour',
            assumptions.hoursPerMonth,
            find(catalog, 'aws.ssm', { kind: 'advanced_parameter' }),
          );
        else free.push(resource.id);
        break;
      case 'aws.cognito.userpool': {
        const plan = str(resource.config.plan) || 'ESSENTIALS';
        const mau = num(resource.config.monthlyActiveUsers, 0);
        // A franquia de 10 mil MAU vale para Lite e Essentials (não para Plus).
        const waived = plan === 'PLUS' ? 0 : Math.min(mau, cognitoFreeMau);
        cognitoFreeMau -= waived;
        add(
          resource,
          region,
          'cognito',
          {
            pt: `Usuários ativos (${plan})`,
            en: `Monthly active users (${plan})`,
            es: `Usuarios activos (${plan})`,
          },
          'MAU',
          mau,
          find(catalog, 'aws.cognito', { kind: 'mau', plan }),
          { waived, afterFree: true },
        );
        break;
      }
      case 'aws.lambda': {
        const arch = str(resource.config.architecture) || 'arm64';
        const requests = num(resource.config.invocationsMillionsMonth, 0) * 1e6;
        const gbSeconds =
          requests *
          (num(resource.config.avgDurationMs, 0) / 1000) *
          (num(resource.config.memoryMb, 128) / 1024);
        const requestsWaived = Math.min(requests, lambdaFreeRequests);
        lambdaFreeRequests -= requestsWaived;
        const gbsWaived = Math.min(gbSeconds, lambdaFreeGbs);
        lambdaFreeGbs -= gbsWaived;
        const from = lambdaGbsByArch.get(arch) ?? 0;
        lambdaGbsByArch.set(arch, from + gbSeconds);
        add(
          resource,
          region,
          'lambda',
          {
            pt: `Invocações (${arch})`,
            en: `Invocations (${arch})`,
            es: `Invocaciones (${arch})`,
          },
          'Requests',
          requests,
          find(catalog, 'aws.lambda', { kind: 'requests', arch }),
          { waived: requestsWaived },
        );
        add(
          resource,
          region,
          'lambda',
          {
            pt: `Computação (${arch})`,
            en: `Compute (${arch})`,
            es: `Cómputo (${arch})`,
          },
          'GB-s',
          gbSeconds,
          find(catalog, 'aws.lambda', { kind: 'compute', arch }),
          { from, waived: gbsWaived },
        );
        break;
      }
      case 'aws.apigw.http': {
        const requests = num(resource.config.requestsMillionsMonth, 0) * 1e6;
        add(
          resource,
          region,
          'apigw',
          {
            pt: 'Requisições HTTP API',
            en: 'HTTP API requests',
            es: 'Solicitudes HTTP API',
          },
          'Requests',
          requests,
          find(catalog, 'aws.apigw', { kind: 'http_requests' }),
          { from: apiRequestsSoFar },
        );
        apiRequestsSoFar += requests;
        break;
      }
      case 'aws.ecs.service': {
        const arch = str(resource.config.architecture) || 'arm64';
        const tasks = num(resource.config.desiredCount, 0);
        const hours = hoursOf(resource);
        add(
          resource,
          region,
          'fargate',
          { pt: `vCPU (${arch})`, en: `vCPU (${arch})`, es: `vCPU (${arch})` },
          'vCPU-Hrs',
          (Number(resource.config.cpu) / 1024) * tasks * hours,
          find(catalog, 'aws.fargate', { kind: 'vcpu', arch }),
        );
        add(
          resource,
          region,
          'fargate',
          {
            pt: `Memória (${arch})`,
            en: `Memory (${arch})`,
            es: `Memoria (${arch})`,
          },
          'GB-Hrs',
          (num(resource.config.memoryMb, 0) / 1024) * tasks * hours,
          find(catalog, 'aws.fargate', { kind: 'memory', arch }),
        );
        break;
      }
      case 'aws.eks.cluster': {
        const hours = hoursOf(resource);
        add(
          resource,
          region,
          'eks',
          {
            pt: 'Cluster (plano de controle)',
            en: 'Cluster (control plane)',
            es: 'Cluster (plano de control)',
          },
          'Hrs',
          hours,
          find(catalog, 'aws.eks', { kind: 'cluster' }),
        );
        if (EKS_EXTENDED_VERSIONS.includes(str(resource.config.version)))
          add(
            resource,
            region,
            'eks',
            {
              pt: 'Suporte estendido',
              en: 'Extended support',
              es: 'Soporte extendido',
            },
            'Hrs',
            hours,
            find(catalog, 'aws.eks', { kind: 'extended_support' }),
          );
        break;
      }
      case 'aws.eks.nodegroup': {
        const nodes = num(resource.config.desiredSize, 0);
        instance(resource, region, nodes);
        add(
          resource,
          region,
          'ebs',
          same('EBS gp3 storage'),
          'GB-Mo',
          num(resource.config.diskGb, 20) * nodes,
          find(catalog, 'aws.ebs.gp3', { kind: 'storage' }),
        );
        break;
      }
      case 'aws.ecr.repository':
        add(
          resource,
          region,
          'ecr',
          {
            pt: 'Imagens armazenadas',
            en: 'Stored images',
            es: 'Imágenes almacenadas',
          },
          'GB-Mo',
          num(resource.config.storageGb, 0),
          find(catalog, 'aws.ecr', { kind: 'storage' }),
        );
        break;
      case 'aws.cloudfront': {
        const geo = str(resource.config.viewerGeography) || 'SA';
        const gb = num(resource.config.dataOutGbMonth, 0);
        const gbWaived = Math.min(gb, cfFreeGb);
        cfFreeGb -= gbWaived;
        const geoFrom = cfGbByGeo.get(geo) ?? 0;
        cfGbByGeo.set(geo, geoFrom + gb);
        add(
          resource,
          region,
          'cloudfront',
          {
            pt: `Saída para usuários (${geo})`,
            en: `Egress to viewers (${geo})`,
            es: `Salida a usuarios (${geo})`,
          },
          'GB',
          gb,
          find(catalog, 'aws.cloudfront', { kind: 'data_out', geo }),
          { from: geoFrom, waived: gbWaived },
        );
        const requests = num(resource.config.requestsMillionsMonth, 0) * 1e6;
        const requestsWaived = Math.min(requests, cfFreeRequests);
        cfFreeRequests -= requestsWaived;
        add(
          resource,
          region,
          'cloudfront',
          {
            pt: `Requisições HTTPS (${geo})`,
            en: `HTTPS requests (${geo})`,
            es: `Solicitudes HTTPS (${geo})`,
          },
          'Requests',
          requests,
          find(catalog, 'aws.cloudfront', { kind: 'https_requests', geo }),
          { waived: requestsWaived },
        );
        break;
      }
      case 'aws.route53.zone': {
        add(
          resource,
          region,
          'route53',
          { pt: 'Zona hospedada', en: 'Hosted zone', es: 'Zona alojada' },
          'Mo',
          1,
          find(catalog, 'aws.route53', { kind: 'hosted_zone' }),
          { from: zonesSoFar },
        );
        zonesSoFar += 1;
        const queries = num(resource.config.queriesMillionsMonth, 0) * 1e6;
        add(
          resource,
          region,
          'route53',
          { pt: 'Consultas DNS', en: 'DNS queries', es: 'Consultas DNS' },
          'Queries',
          queries,
          find(catalog, 'aws.route53', { kind: 'queries' }),
          { from: queriesSoFar },
        );
        queriesSoFar += queries;
        break;
      }
      case 'aws.waf.acl': {
        add(
          resource,
          region,
          'waf',
          same('Web ACL'),
          'Mo',
          1,
          find(catalog, 'aws.waf', { kind: 'web_acl' }),
        );
        add(
          resource,
          region,
          'waf',
          { pt: 'Regras', en: 'Rules', es: 'Reglas' },
          'Mo',
          wafRuleCount(resource),
          find(catalog, 'aws.waf', { kind: 'rule' }),
        );
        add(
          resource,
          region,
          'waf',
          { pt: 'Requisições', en: 'Requests', es: 'Solicitudes' },
          'Requests',
          num(resource.config.requestsMillionsMonth, 0) * 1e6,
          find(catalog, 'aws.waf', { kind: 'requests' }),
        );
        if (wafRuleGroups(resource).includes(BOT_CONTROL_GROUP)) {
          add(
            resource,
            region,
            'waf',
            same('Bot Control'),
            'Mo',
            1,
            find(catalog, 'aws.waf', { kind: 'bot_control' }),
          );
        }
        break;
      }
      default:
        break;
    }
    // Alarmes padrão (7D): 10 grátis na conta.
    const alarmCount = alarmsOf(resource).length;
    if (alarmCount > 0) {
      const waived = Math.min(alarmCount, alarmsFree);
      alarmsFree -= waived;
      add(
        resource,
        region,
        'cloudwatch',
        {
          pt: `Alarmes (${alarmCount})`,
          en: `Alarms (${alarmCount})`,
          es: `Alarmas (${alarmCount})`,
        },
        'Alarms',
        alarmCount,
        find(catalog, 'aws.cloudwatch', { kind: 'alarms' }),
        { waived },
      );
    }
  }

  // Conexões entre AZs diferentes: a AWS cobra a saída e a entrada (× 2).
  const azOf = (id: string) => {
    const resource = resources.find((r) => r.id === id);
    if (!resource) return null;
    const parent = resources.find((r) => r.id === resource.parentId);
    return parent && isSubnet(parent) ? parent.parentId : null;
  };
  for (const connection of connections) {
    const fromAz = azOf(connection.source);
    const toAz = azOf(connection.target);
    if (!fromAz || !toAz || fromAz === toAz) continue;
    const source = resources.find((r) => r.id === connection.source)!;
    const target = resources.find((r) => r.id === connection.target)!;
    const region = regionOf(source);
    add(
      null,
      region,
      'transfer',
      same(`${source.name} → ${target.name} (inter-AZ)`),
      'GB',
      readConnectionConfig(connection).gbMonth * 2,
      find(catalogs[region], 'aws.data_transfer', { kind: 'inter_az' }),
    );
  }

  // Premissas globais, na primeira região do rascunho.
  const firstRegion = str(
    resources.find((r) => r.type === 'aws.region')?.config.region,
  );
  if (firstRegion) {
    add(
      null,
      firstRegion,
      'transfer',
      freeEgress
        ? {
            pt: `Saída para a internet (${FREE_EGRESS_GB} GB grátis)`,
            en: `Internet egress (${FREE_EGRESS_GB} GB free)`,
            es: `Salida a internet (${FREE_EGRESS_GB} GB gratis)`,
          }
        : {
            pt: 'Saída para a internet',
            en: 'Internet egress',
            es: 'Salida a internet',
          },
      'GB',
      assumptions.internetEgressGbMonth,
      find(catalogs[firstRegion], 'aws.data_transfer', {
        kind: 'internet_out',
      }),
      { waived: freeEgress ? FREE_EGRESS_GB : 0 },
    );
    add(
      null,
      firstRegion,
      'transfer',
      {
        pt: 'Entre AZs (premissa)',
        en: 'Inter-AZ (assumption)',
        es: 'Entre AZ (premisa)',
      },
      'GB',
      assumptions.interAzGbMonth,
      find(catalogs[firstRegion], 'aws.data_transfer', { kind: 'inter_az' }),
    );
  }

  const zero = (): CostTotals => ({ usd: 0, brl: 0 });
  const total = zero();
  const byService = {
    ec2: zero(),
    ebs: zero(),
    rds: zero(),
    elb: zero(),
    vpc: zero(),
    s3: zero(),
    cloudfront: zero(),
    route53: zero(),
    waf: zero(),
    shield: zero(),
    kms: zero(),
    secrets: zero(),
    ssm: zero(),
    cognito: zero(),
    lambda: zero(),
    apigw: zero(),
    fargate: zero(),
    eks: zero(),
    ecr: zero(),
    elasticache: zero(),
    dynamodb: zero(),
    sqs: zero(),
    sns: zero(),
    efs: zero(),
    cloudwatch: zero(),
    cloudtrail: zero(),
    backup: zero(),
    guardduty: zero(),
    securityhub: zero(),
    config: zero(),
    transfer: zero(),
  };
  const byRegion: Record<string, CostTotals> = {};
  const byLayer: Record<string, CostTotals> = {};
  for (const line of lines) {
    if (line.status !== 'priced') continue;
    const layerKey = line.resourceId
      ? String(
          getCatalogEntry(
            resources.find((r) => r.id === line.resourceId)?.type ?? '',
          )?.layer ?? 'transfer',
        )
      : 'transfer';
    for (const bucket of [
      total,
      byService[line.service],
      (byRegion[line.region] ??= zero()),
      (byLayer[layerKey] ??= zero()),
    ]) {
      bucket.usd += line.monthlyUsd!;
      bucket.brl += line.monthlyBrl!;
    }
  }
  return {
    lines,
    free,
    total,
    byService,
    byRegion,
    byLayer,
    unpricedCount: lines.filter((l) => l.status === 'unpriced').length,
  };
}

/** CSV com as duas moedas (separador `;`, decimal com ponto — abre em qualquer planilha). */
export function costCsv(
  estimate: CostEstimate,
  resources: CloudResource[],
  language: 'pt' | 'en' | 'es',
): string {
  const head = [
    'resource',
    'region',
    'service',
    'item',
    'unit',
    'quantity',
    'unit_usd',
    'unit_brl',
    'monthly_usd',
    'monthly_brl',
    'status',
  ];
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const fixed = (value: number | null, digits: number) =>
    value === null ? '' : value.toFixed(digits);
  const rows = estimate.lines.map((line) => [
    resources.find((r) => r.id === line.resourceId)?.name ?? '',
    line.region,
    line.service,
    line.item[language],
    line.unit,
    fixed(line.quantity, 4),
    fixed(line.unitUsd, 6),
    fixed(line.unitBrl, 6),
    fixed(line.monthlyUsd, 2),
    fixed(line.monthlyBrl, 2),
    line.status,
  ]);
  rows.push([
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    estimate.total.usd.toFixed(2),
    estimate.total.brl.toFixed(2),
    '',
  ]);
  return (
    [head, ...rows].map((row) => row.map(cell).join(';')).join('\n') + '\n'
  );
}
