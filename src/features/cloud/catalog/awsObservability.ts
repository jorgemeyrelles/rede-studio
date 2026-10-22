import {
  BACKUP_TARGET_TYPES,
  backupTargetsFor,
  backupTargetsOf,
  BACKUP_TYPE,
  bucketOf,
  isCloudFrontOrigin,
  logGroupOf,
  logGroupsFor,
  LOG_GROUP_TYPE,
  alarmTopicOf,
  alarmTopicsFor,
  TRAIL_TYPE,
} from '../engines/observability';
import { securityIssues } from '../engines/secrets';
import { closest } from '../network';
import type { CloudResource } from '../types';
import { kmsKeyField } from './awsSecurity';
import type { CloudCatalogEntry, CloudField, LocalizedText } from './types';

/**
 * Observabilidade e governança (F7 onda 7D — `sprint-cloud-f7d-observabilidade.md`):
 * grupo de logs, CloudTrail e AWS Backup, e os campos compartilhados de
 * logs e alarmes que os outros arquivos do catálogo usam. Não importa
 * `awsResources`/`awsCompute`/`awsData` (eles importam este arquivo).
 */

// ── Campos compartilhados ────────────────────────────────────────────────
export const logGroupField = (
  help: LocalizedText,
  visibleWhen?: CloudField['visibleWhen'],
): CloudField => ({
  key: 'logGroupId',
  section: 'operation',
  type: 'select',
  optionsSource: 'logGroups',
  visibleWhen,
  label: { pt: 'Grupo de logs', en: 'Log group', es: 'Grupo de logs' },
  help,
});

export const alarmFields: CloudField[] = [
  {
    key: 'alarms',
    section: 'operation',
    type: 'boolean',
    label: {
      pt: 'Alarmes padrão (CloudWatch)',
      en: 'Default alarms (CloudWatch)',
      es: 'Alarmas predeterminadas (CloudWatch)',
    },
    help: {
      pt: 'CPU, erros, latência ou fila parada, conforme o tipo. Os limiares ficam no Terraform gerado.',
      en: 'CPU, errors, latency or a stuck queue, depending on the type. Thresholds live in the generated Terraform.',
      es: 'CPU, errores, latencia o cola detenida, según el tipo. Los umbrales quedan en el Terraform generado.',
    },
  },
  {
    key: 'alarmTopicId',
    section: 'operation',
    type: 'select',
    optionsSource: 'snsTopics',
    visibleWhen: (config) => config.alarms === true,
    label: {
      pt: 'Avisar no tópico SNS',
      en: 'Notify SNS topic',
      es: 'Avisar en el tema SNS',
    },
    help: {
      pt: 'Sem tópico, o alarme só muda de estado no console.',
      en: 'Without a topic, the alarm only changes state in the console.',
      es: 'Sin tema, la alarma solo cambia de estado en la consola.',
    },
  },
];

/** Problemas de escopo de logs e alarmes (grupo/tópico de outra Região ou excluído). */
export function observabilityIssues(
  resource: CloudResource,
  resources: CloudResource[],
): Record<string, LocalizedText> {
  const issues: Record<string, LocalizedText> = {};
  if (String(resource.config.logGroupId ?? '')) {
    const group = logGroupOf(resources, resource);
    if (!group || !logGroupsFor(resources, resource).includes(group))
      issues.logGroupId = {
        pt: 'O grupo de logs precisa estar na mesma Região.',
        en: 'The log group must be in the same Region.',
        es: 'El grupo de logs debe estar en la misma Región.',
      };
  }
  if (
    resource.config.alarms === true &&
    String(resource.config.alarmTopicId ?? '')
  ) {
    const topic = alarmTopicOf(resources, resource);
    if (!topic || !alarmTopicsFor(resources, resource).includes(topic))
      issues.alarmTopicId = {
        pt: 'O tópico precisa estar na mesma Região.',
        en: 'The topic must be in the same Region.',
        es: 'El tema debe estar en la misma Región.',
      };
  }
  return issues;
}

// ── Grupo de logs ────────────────────────────────────────────────────────
const RETENTION_DAYS = [1, 3, 7, 14, 30, 60, 90, 180, 365, 731, 1827, 3653];

const logGroup: CloudCatalogEntry = {
  type: LOG_GROUP_TYPE,
  layer: 5,
  kind: 'node',
  category: 'security',
  optional: true,
  label: {
    pt: 'CloudWatch Logs — grupo',
    en: 'CloudWatch Logs — group',
    es: 'CloudWatch Logs — grupo',
  },
  summary: {
    pt: 'Destino de logs da VPC (Flow Logs), Lambda, ECS, API Gateway e CloudTrail. Retenção e chave aqui.',
    en: 'Log destination for the VPC (Flow Logs), Lambda, ECS, API Gateway and CloudTrail. Retention and key here.',
    es: 'Destino de logs de la VPC (Flow Logs), Lambda, ECS, API Gateway y CloudTrail. Retención y clave aquí.',
  },
  namePrefix: { pt: 'logs', en: 'logs', es: 'logs' },
  parents: ['aws.region'],
  inspectorHint: {
    pt: 'Escolha este grupo no campo "Grupo de logs" de quem gera os logs.',
    en: 'Pick this group in the "Log group" field of whatever produces the logs.',
    es: 'Elige este grupo en el campo "Grupo de logs" de quien genera los logs.',
  },
  defaults: { retentionDays: 30, kmsKeyId: '', ingestGbMonth: 5 },
  validate: (resource, resources) => securityIssues(resources, resource),
  fields: [
    {
      key: 'retentionDays',
      section: 'config',
      type: 'select',
      label: { pt: 'Retenção', en: 'Retention', es: 'Retención' },
      options: [
        ...RETENTION_DAYS.map((days) => ({
          value: String(days),
          label: {
            pt: `${days} dia${days > 1 ? 's' : ''}`,
            en: `${days} day${days > 1 ? 's' : ''}`,
            es: `${days} día${days > 1 ? 's' : ''}`,
          },
        })),
        {
          value: '0',
          label: {
            pt: 'Nunca expira',
            en: 'Never expire',
            es: 'Nunca expira',
          },
        },
      ],
      help: {
        pt: 'O armazenamento estimado é a ingestão × os meses retidos (sem expirar = 12 meses).',
        en: 'Estimated storage is ingestion × months retained (never expire = 12 months).',
        es: 'El almacenamiento estimado es la ingesta × los meses retenidos (sin expirar = 12 meses).',
      },
    },
    {
      ...kmsKeyField(),
      help: {
        pt: 'Vazio = cifrado pelo CloudWatch. Chave própria precisa liberar o serviço logs na política dela.',
        en: 'Empty = encrypted by CloudWatch. Your own key must allow the logs service in its policy.',
        es: 'Vacío = cifrado por CloudWatch. La clave propia debe permitir el servicio logs en su política.',
      },
    },
    {
      key: 'ingestGbMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1,
      unit: 'GB',
      label: {
        pt: 'Logs de aplicação por mês',
        en: 'Application logs per month',
        es: 'Logs de aplicación por mes',
      },
      help: {
        pt: 'Lambda, ECS e API. Os Flow Logs entram pelo volume da VPC.',
        en: 'Lambda, ECS and API. Flow Logs come in through the VPC volume.',
        es: 'Lambda, ECS y API. Los Flow Logs entran por el volumen de la VPC.',
      },
    },
  ],
};

// ── CloudTrail ───────────────────────────────────────────────────────────
const trail: CloudCatalogEntry = {
  type: TRAIL_TYPE,
  layer: 5,
  kind: 'node',
  category: 'security',
  optional: true,
  label: { pt: 'CloudTrail', en: 'CloudTrail', es: 'CloudTrail' },
  summary: {
    pt: 'Registro de quem fez o quê na conta, em todas as Regiões, gravado num bucket S3.',
    en: 'Record of who did what in the account, in every Region, written to an S3 bucket.',
    es: 'Registro de quién hizo qué en la cuenta, en todas las Regiones, grabado en un bucket S3.',
  },
  namePrefix: { pt: 'trilha', en: 'trail', es: 'registro' },
  parents: ['aws.region'],
  // D4: uma trilha multi-região por conta.
  requires: ({ state }) =>
    state.resources.some((r) => r.type === TRAIL_TYPE)
      ? {
          pt: 'Já existe uma trilha: ela é multi-região e cobre a conta toda.',
          en: 'A trail already exists: it is multi-Region and covers the whole account.',
          es: 'Ya existe un registro: es multirregión y cubre toda la cuenta.',
        }
      : null,
  defaults: {
    bucketId: '',
    logGroupId: '',
    kmsKeyId: '',
    dataEvents: false,
    dataEventsMillionsMonth: 1,
  },
  derive: ({ state }) => ({
    bucketId:
      state.resources.find(
        (r) =>
          r.type === 'aws.s3' &&
          !isCloudFrontOrigin(state.resources, state.connections, r),
      )?.id ?? '',
  }),
  validate: (resource, resources, connections) => {
    const issues: Record<string, LocalizedText> = {
      ...securityIssues(resources, resource),
      ...observabilityIssues(resource, resources),
    };
    const bucket = bucketOf(resources, resource);
    if (!bucket)
      issues.bucketId = {
        pt: 'Escolha o bucket S3 onde a trilha grava (crie um na Região).',
        en: 'Pick the S3 bucket the trail writes to (create one in the Region).',
        es: 'Elige el bucket S3 donde graba el registro (crea uno en la Región).',
      };
    else if (isCloudFrontOrigin(resources, connections ?? [], bucket))
      issues.bucketId = {
        pt: `${bucket.name} é origem do CloudFront e já tem bucket policy: use outro bucket para a trilha.`,
        en: `${bucket.name} is a CloudFront origin and already has a bucket policy: use another bucket for the trail.`,
        es: `${bucket.name} es origen de CloudFront y ya tiene bucket policy: usa otro bucket para el registro.`,
      };
    return issues;
  },
  fields: [
    {
      key: 'bucketId',
      section: 'config',
      type: 'select',
      optionsSource: 'projectBuckets',
      label: {
        pt: 'Bucket dos registros',
        en: 'Log bucket',
        es: 'Bucket de los registros',
      },
    },
    logGroupField({
      pt: 'Opcional: copia os eventos para o CloudWatch Logs (alarmes, consultas).',
      en: 'Optional: copies events to CloudWatch Logs (alarms, queries).',
      es: 'Opcional: copia los eventos a CloudWatch Logs (alarmas, consultas).',
    }),
    {
      ...kmsKeyField(),
      help: {
        pt: 'Vazio = SSE-S3. Chave própria precisa liberar o CloudTrail na política dela.',
        en: 'Empty = SSE-S3. Your own key must allow CloudTrail in its policy.',
        es: 'Vacío = SSE-S3. La clave propia debe permitir CloudTrail en su política.',
      },
    },
    {
      key: 'dataEvents',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Eventos de dados (objetos S3 e invocações Lambda)',
        en: 'Data events (S3 objects and Lambda invocations)',
        es: 'Eventos de datos (objetos S3 e invocaciones Lambda)',
      },
      help: {
        pt: 'Os eventos de gestão (1ª cópia) são grátis; os de dados são cobrados por evento.',
        en: 'Management events (first copy) are free; data events are billed per event.',
        es: 'Los eventos de gestión (1ª copia) son gratis; los de datos se cobran por evento.',
      },
    },
    {
      key: 'dataEventsMillionsMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 0.5,
      unit: 'mi',
      visibleWhen: (config) => config.dataEvents === true,
      label: {
        pt: 'Eventos de dados por mês (milhões)',
        en: 'Data events per month (millions)',
        es: 'Eventos de datos por mes (millones)',
      },
    },
  ],
};

// ── AWS Backup ───────────────────────────────────────────────────────────
const backup: CloudCatalogEntry = {
  type: BACKUP_TYPE,
  layer: 5,
  kind: 'node',
  category: 'security',
  optional: true,
  label: {
    pt: 'AWS Backup — plano',
    en: 'AWS Backup — plan',
    es: 'AWS Backup — plan',
  },
  summary: {
    pt: 'Cópias agendadas de RDS, Aurora, EFS, DynamoDB e EC2 da Região, num cofre próprio.',
    en: 'Scheduled copies of the Region’s RDS, Aurora, EFS, DynamoDB and EC2, in a dedicated vault.',
    es: 'Copias programadas de RDS, Aurora, EFS, DynamoDB y EC2 de la Región, en una bóveda propia.',
  },
  namePrefix: { pt: 'backup', en: 'backup', es: 'backup' },
  parents: ['aws.region'],
  defaults: {
    schedule: 'daily',
    retentionDays: 35,
    kmsKeyId: '',
    dailyChangePercent: 2,
  },
  // Nasce protegendo tudo que já existe na Região.
  derive: ({ state, parent }) => ({
    targetIds: parent
      ? state.resources
          .filter(
            (r) =>
              BACKUP_TARGET_TYPES.includes(r.type) &&
              closest(state.resources, r.id, 'aws.region')?.id === parent.id,
          )
          .map((r) => r.id)
      : [],
  }),
  validate: (resource, resources) => {
    const issues: Record<string, LocalizedText> = {
      ...securityIssues(resources, resource),
    };
    const targets = backupTargetsOf(resources, resource);
    if (targets.length === 0)
      issues.targetIds = {
        pt: 'Escolha o que proteger (RDS, Aurora, EFS, DynamoDB ou EC2 da Região).',
        en: 'Pick what to protect (RDS, Aurora, EFS, DynamoDB or EC2 in the Region).',
        es: 'Elige qué proteger (RDS, Aurora, EFS, DynamoDB o EC2 de la Región).',
      };
    else if (
      targets.some((t) => !backupTargetsFor(resources, resource).includes(t))
    )
      issues.targetIds = {
        pt: 'O plano só protege recursos da mesma Região.',
        en: 'The plan only protects resources in the same Region.',
        es: 'El plan solo protege recursos de la misma Región.',
      };
    return issues;
  },
  fields: [
    {
      key: 'targetIds',
      section: 'config',
      type: 'refs',
      source: 'backupTargets',
      label: { pt: 'Proteger', en: 'Protect', es: 'Proteger' },
    },
    {
      key: 'schedule',
      section: 'config',
      type: 'select',
      label: { pt: 'Frequência', en: 'Frequency', es: 'Frecuencia' },
      options: [
        {
          value: 'daily',
          label: {
            pt: 'Diária (05:00 UTC)',
            en: 'Daily (05:00 UTC)',
            es: 'Diaria (05:00 UTC)',
          },
        },
        {
          value: 'weekly',
          label: {
            pt: 'Semanal (domingo, 05:00 UTC)',
            en: 'Weekly (Sunday, 05:00 UTC)',
            es: 'Semanal (domingo, 05:00 UTC)',
          },
        },
      ],
    },
    {
      key: 'retentionDays',
      section: 'config',
      type: 'number',
      min: 1,
      max: 36500,
      step: 1,
      unit: 'd',
      label: { pt: 'Retenção', en: 'Retention', es: 'Retención' },
    },
    {
      ...kmsKeyField(),
      help: {
        pt: 'Chave do cofre. Vazio = chave gerenciada pela AWS.',
        en: 'Vault key. Empty = AWS managed key.',
        es: 'Clave de la bóveda. Vacío = clave administrada por AWS.',
      },
    },
    {
      key: 'dailyChangePercent',
      section: 'operation',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
      label: {
        pt: 'Dados alterados por dia',
        en: 'Data changed per day',
        es: 'Datos modificados por día',
      },
      help: {
        pt: 'Cópias são incrementais: o custo é uma cópia cheia + a variação × as cópias retidas.',
        en: 'Copies are incremental: the cost is one full copy + the change × retained copies.',
        es: 'Las copias son incrementales: el costo es una copia completa + la variación × las copias retenidas.',
      },
    },
  ],
};

export const AWS_OBSERVABILITY: CloudCatalogEntry[] = [logGroup, trail, backup];
