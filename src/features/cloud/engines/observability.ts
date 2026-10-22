import type { LocalizedText } from '../catalog/types';
import type { CloudConnection, CloudResource } from '../types';
import { readIdList } from './addressing';
import { SNS_TYPE } from './data';
import { sameRegion } from './secrets';

/**
 * Observabilidade e governança (F7 onda 7D — `sprint-cloud-f7d-observabilidade.md`):
 * grupos de logs (e Flow Logs), monitoramento detalhado, alarmes padrão,
 * CloudTrail, AWS Backup e as opções da conta (GuardDuty, Security Hub,
 * Config). Puro: não importa o catálogo (o catálogo importa este módulo).
 */

export const LOG_GROUP_TYPE = 'aws.logs.group';
export const TRAIL_TYPE = 'aws.cloudtrail';
export const BACKUP_TYPE = 'aws.backup.plan';

/** Quem pode mandar logs para um grupo (`logGroupId`). */
export const LOG_SOURCE_TYPES = [
  'aws.vpc',
  'aws.lambda',
  'aws.ecs.service',
  'aws.apigw.http',
  TRAIL_TYPE,
];

/** O que o AWS Backup protege nesta onda. */
export const BACKUP_TARGET_TYPES = [
  'aws.rds',
  'aws.aurora',
  'aws.efs',
  'aws.dynamodb.table',
  'aws.ec2',
];

/** Métricas de 1 minuto que o monitoramento detalhado liga em cada instância. */
export const DETAILED_MONITORING_METRICS = 7;

const byId = (resources: CloudResource[], id: unknown) =>
  typeof id === 'string' && id ? resources.find((r) => r.id === id) : undefined;
const num = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

// ---------------------------------------------------------------------------
//  Associações (seletores do inspetor)
// ---------------------------------------------------------------------------

export const logGroupsFor = (
  resources: CloudResource[],
  resource: CloudResource,
) =>
  resources.filter(
    (r) =>
      r.type === LOG_GROUP_TYPE && sameRegion(resources, r.id, resource.id),
  );

export const logGroupOf = (
  resources: CloudResource[],
  resource: CloudResource,
) => {
  const group = byId(resources, resource.config.logGroupId);
  return group?.type === LOG_GROUP_TYPE ? group : undefined;
};

/** Tópicos SNS que recebem os alarmes (mesma Região). */
export const alarmTopicsFor = (
  resources: CloudResource[],
  resource: CloudResource,
) =>
  resources.filter(
    (r) => r.type === SNS_TYPE && sameRegion(resources, r.id, resource.id),
  );

export const alarmTopicOf = (
  resources: CloudResource[],
  resource: CloudResource,
) => {
  const topic = byId(resources, resource.config.alarmTopicId);
  return topic?.type === SNS_TYPE ? topic : undefined;
};

/** Buckets do projeto (a trilha e o Config gravam em qualquer Região). */
export const projectBucketsFor = (resources: CloudResource[]) =>
  resources.filter((r) => r.type === 'aws.s3');

export const bucketOf = (
  resources: CloudResource[],
  resource: CloudResource,
  key = 'bucketId',
) => {
  const bucket = byId(resources, resource.config[key]);
  return bucket?.type === 'aws.s3' ? bucket : undefined;
};

/** O bucket já tem bucket policy de outro dono (origem do CloudFront)? */
export const isCloudFrontOrigin = (
  resources: CloudResource[],
  connections: CloudConnection[],
  bucket: CloudResource,
) =>
  connections.some(
    (c) =>
      c.target === bucket.id &&
      // literal: `edge.ts` importa este módulo (associações derivadas).
      byId(resources, c.source)?.type === 'aws.cloudfront',
  );

export const backupTargetsFor = (
  resources: CloudResource[],
  plan: CloudResource,
) =>
  resources.filter(
    (r) =>
      BACKUP_TARGET_TYPES.includes(r.type) &&
      sameRegion(resources, r.id, plan.id),
  );

export const backupTargetsOf = (
  resources: CloudResource[],
  plan: CloudResource,
) =>
  readIdList(plan.config.targetIds)
    .map((id) => byId(resources, id))
    .filter((r): r is CloudResource =>
      Boolean(r && BACKUP_TARGET_TYPES.includes(r.type)),
    );

// ---------------------------------------------------------------------------
//  Alarmes padrão (D3)
// ---------------------------------------------------------------------------

export type AlarmSpec = {
  key: string;
  namespace: string;
  metric: string;
  statistic: 'Average' | 'Sum' | 'Maximum' | 'Minimum';
  comparison:
    | 'GreaterThanThreshold'
    | 'GreaterThanOrEqualToThreshold'
    | 'LessThanThreshold';
  threshold: (resource: CloudResource) => number;
  /** Períodos seguidos (de `period` segundos) acima do limiar. */
  periods: number;
  period: number;
  label: LocalizedText;
};

const cpu = (namespace: string): AlarmSpec => ({
  key: 'cpu',
  namespace,
  metric: 'CPUUtilization',
  statistic: 'Average',
  comparison: 'GreaterThanThreshold',
  threshold: () => 80,
  periods: 3,
  period: 300,
  label: {
    pt: 'CPU acima de 80% por 15 min',
    en: 'CPU above 80% for 15 min',
    es: 'CPU por encima de 80% durante 15 min',
  },
});

export const ALARM_SPECS: Record<string, AlarmSpec[]> = {
  'aws.ec2': [
    cpu('AWS/EC2'),
    {
      key: 'status',
      namespace: 'AWS/EC2',
      metric: 'StatusCheckFailed',
      statistic: 'Maximum',
      comparison: 'GreaterThanOrEqualToThreshold',
      threshold: () => 1,
      periods: 2,
      period: 60,
      label: {
        pt: 'Falha na verificação de status',
        en: 'Status check failed',
        es: 'Falla en la verificación de estado',
      },
    },
  ],
  'aws.asg': [cpu('AWS/EC2')],
  'aws.alb': [
    {
      key: 'elb5xx',
      namespace: 'AWS/ApplicationELB',
      metric: 'HTTPCode_ELB_5XX_Count',
      statistic: 'Sum',
      comparison: 'GreaterThanThreshold',
      threshold: () => 10,
      periods: 1,
      period: 300,
      label: {
        pt: 'Mais de 10 erros 5xx em 5 min',
        en: 'More than 10 5xx errors in 5 min',
        es: 'Más de 10 errores 5xx en 5 min',
      },
    },
    {
      key: 'latency',
      namespace: 'AWS/ApplicationELB',
      metric: 'TargetResponseTime',
      statistic: 'Average',
      comparison: 'GreaterThanThreshold',
      threshold: () => 1,
      periods: 3,
      period: 300,
      label: {
        pt: 'Resposta média acima de 1 s por 15 min',
        en: 'Average response above 1 s for 15 min',
        es: 'Respuesta media por encima de 1 s durante 15 min',
      },
    },
  ],
  'aws.rds': [
    cpu('AWS/RDS'),
    {
      key: 'storage',
      namespace: 'AWS/RDS',
      metric: 'FreeStorageSpace',
      statistic: 'Minimum',
      comparison: 'LessThanThreshold',
      // 10% do storage alocado, em bytes.
      threshold: (r) =>
        Math.round(num(r.config.storageGb, 20) * 1024 ** 3 * 0.1),
      periods: 1,
      period: 300,
      label: {
        pt: 'Menos de 10% de armazenamento livre',
        en: 'Less than 10% free storage',
        es: 'Menos de 10% de almacenamiento libre',
      },
    },
  ],
  'aws.aurora': [cpu('AWS/RDS')],
  'aws.ecs.service': [
    cpu('AWS/ECS'),
    {
      ...cpu('AWS/ECS'),
      key: 'memory',
      metric: 'MemoryUtilization',
      label: {
        pt: 'Memória acima de 80% por 15 min',
        en: 'Memory above 80% for 15 min',
        es: 'Memoria por encima de 80% durante 15 min',
      },
    },
  ],
  'aws.lambda': [
    {
      key: 'errors',
      namespace: 'AWS/Lambda',
      metric: 'Errors',
      statistic: 'Sum',
      comparison: 'GreaterThanThreshold',
      threshold: () => 0,
      periods: 1,
      period: 300,
      label: {
        pt: 'Qualquer erro em 5 min',
        en: 'Any error in 5 min',
        es: 'Cualquier error en 5 min',
      },
    },
    {
      key: 'throttles',
      namespace: 'AWS/Lambda',
      metric: 'Throttles',
      statistic: 'Sum',
      comparison: 'GreaterThanThreshold',
      threshold: () => 0,
      periods: 1,
      period: 300,
      label: {
        pt: 'Invocações estranguladas',
        en: 'Throttled invocations',
        es: 'Invocaciones limitadas',
      },
    },
  ],
  'aws.sqs.queue': [
    {
      key: 'age',
      namespace: 'AWS/SQS',
      metric: 'ApproximateAgeOfOldestMessage',
      statistic: 'Maximum',
      comparison: 'GreaterThanThreshold',
      threshold: () => 300,
      periods: 1,
      period: 300,
      label: {
        pt: 'Mensagem parada há mais de 5 min',
        en: 'Message waiting for over 5 min',
        es: 'Mensaje esperando más de 5 min',
      },
    },
  ],
};

/** Alarmes ligados no recurso. */
export const alarmsOf = (resource: CloudResource): AlarmSpec[] =>
  resource.config.alarms === true ? (ALARM_SPECS[resource.type] ?? []) : [];

// ---------------------------------------------------------------------------
//  Volumes para o custo
// ---------------------------------------------------------------------------

/** Meses que um GB ingerido fica guardado (sem expirar = estimativa de 12 meses). */
export const retainedMonths = (days: unknown) => {
  const d = num(days, 0);
  return d <= 0 ? 12 : Math.min(d, 3653) / 30;
};

/** Flow Logs que caem no grupo (GB/mês). */
export const flowLogsInto = (
  resources: CloudResource[],
  group: CloudResource,
) =>
  resources
    .filter(
      (r) =>
        r.type === 'aws.vpc' &&
        r.config.flowLogs === true &&
        r.config.logGroupId === group.id,
    )
    .reduce((sum, vpc) => sum + num(vpc.config.flowLogsGbMonth, 0), 0);

/** Tamanho em GB de um alvo do Backup (o storage que ele tem). */
export function backupSourceGb(resource: CloudResource): number {
  if (resource.type === 'aws.ec2') return num(resource.config.ebsGb, 20);
  return num(resource.config.storageGb, 0);
}

/**
 * GB guardados pelo plano por alvo (D5): uma cópia cheia + a variação
 * diária × as cópias retidas (diárias ou semanais).
 */
export function backupStoredGb(
  resources: CloudResource[],
  plan: CloudResource,
): { target: CloudResource; gb: number }[] {
  const retention = Math.max(1, num(plan.config.retentionDays, 35));
  const copies =
    plan.config.schedule === 'weekly' ? Math.ceil(retention / 7) : retention;
  const change = num(plan.config.dailyChangePercent, 2) / 100;
  const perCopy = plan.config.schedule === 'weekly' ? change * 7 : change;
  return backupTargetsOf(resources, plan).map((target) => {
    const size = backupSourceGb(target);
    return { target, gb: size + size * Math.min(1, perCopy) * (copies - 1) };
  });
}
