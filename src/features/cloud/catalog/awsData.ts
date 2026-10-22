import { readIdList } from '../engines/addressing';
import { securityGroupsOf } from '../engines/connections';
import {
  AURORA_TYPE,
  deadLetterQueueOf,
  deadLetterQueuesFor,
  DYNAMODB_TYPE,
  EFS_TYPE,
  ELASTICACHE_TYPE,
  queueTriggersOf,
  SNS_TYPE,
  SQS_TYPE,
  subscriptionsOf,
} from '../engines/data';
import { securityIssues } from '../engines/secrets';
import {
  azCountOf,
  closest,
  subnetsPerAz,
  subnetTier,
  VPC_TYPE,
} from '../network';
import type { CloudResource } from '../types';
import { noSgWarning, securityGroupsField, subnetsField } from './awsResources';
import { alarmFields, observabilityIssues } from './awsObservability';
import { kmsKeyField } from './awsSecurity';
import type {
  CloudCatalogContext,
  CloudCatalogEntry,
  CloudField,
  LocalizedText,
} from './types';

/**
 * Dados e mensageria (F7 onda 7C, parte 2 —
 * `sprint-cloud-f7c2-dados-mensageria.md`): ElastiCache, Aurora, DynamoDB,
 * SQS, SNS e EFS.
 */

const same = (text: string): LocalizedText => ({
  pt: text,
  en: text,
  es: text,
});

/** Subnet group: as subnets da camada do pai, uma por AZ (como o RDS). */
const subnetGroupOf = ({ state, parent }: CloudCatalogContext) => {
  if (!parent) return [];
  const vpc = closest(state.resources, parent.id, VPC_TYPE);
  return vpc
    ? subnetsPerAz(state.resources, vpc.id, subnetTier(parent), parent.id)
    : [];
};

const twoAzError = (count: number): LocalizedText => ({
  pt: `As subnets cobrem ${count} AZ: a AWS exige ao menos 2.`,
  en: `The subnets cover ${count} AZ: AWS requires at least 2.`,
  es: `Las subnets cubren ${count} AZ: AWS exige al menos 2.`,
});

/** Subnet group do banco/cache: ≥ 2 AZs (quando exigido) e com a subnet do pai. */
function subnetGroupIssues(
  resource: CloudResource,
  resources: CloudResource[],
  requireTwoAz: boolean,
): Record<string, LocalizedText> {
  const issues: Record<string, LocalizedText> = {};
  const ids = readIdList(resource.config.subnetIds);
  const azs = azCountOf(resources, ids);
  if (requireTwoAz && azs < 2) issues.subnetIds = twoAzError(azs);
  if (resource.parentId && !ids.includes(resource.parentId)) {
    issues.subnetIds ??= {
      pt: 'A subnet do elemento precisa estar no subnet group.',
      en: 'The element subnet must be in the subnet group.',
      es: 'La subnet del elemento debe estar en el subnet group.',
    };
  }
  if (securityGroupsOf(resource).length === 0) issues['*'] = noSgWarning;
  return {
    ...issues,
    ...securityIssues(resources, resource),
    ...observabilityIssues(resource, resources),
  };
}

const hoursField: CloudField = {
  key: 'hoursPerMonth',
  section: 'operation',
  type: 'number',
  min: 0,
  max: 744,
  step: 1,
  unit: 'h',
  label: { pt: 'Horas por mês', en: 'Hours per month', es: 'Horas por mes' },
  help: {
    pt: '730 = ligado o mês inteiro.',
    en: '730 = on all month.',
    es: '730 = encendido todo el mes.',
  },
};

const millions = (
  key: string,
  label: LocalizedText,
  visibleWhen?: CloudField['visibleWhen'],
): CloudField => ({
  key,
  section: 'operation',
  type: 'number',
  min: 0,
  step: 0.5,
  unit: 'mi',
  label,
  visibleWhen,
});

const fifoField = (help: LocalizedText): CloudField => ({
  key: 'fifo',
  section: 'config',
  type: 'boolean',
  label: {
    pt: 'FIFO (ordem garantida, sem duplicatas)',
    en: 'FIFO (guaranteed order, no duplicates)',
    es: 'FIFO (orden garantizado, sin duplicados)',
  },
  help,
});

// ── ElastiCache ──────────────────────────────────────────────────────────
const elasticache: CloudCatalogEntry = {
  type: ELASTICACHE_TYPE,
  layer: 5,
  kind: 'node',
  category: 'data',
  optional: true,
  label: {
    pt: 'ElastiCache (Valkey/Redis)',
    en: 'ElastiCache (Valkey/Redis)',
    es: 'ElastiCache (Valkey/Redis)',
  },
  summary: {
    pt: 'Cache em memória numa subnet privada. Réplicas em outras AZs assumem se o nó cair.',
    en: 'In-memory cache in a private subnet. Replicas in other AZs take over if the node fails.',
    es: 'Caché en memoria en una subnet privada. Las réplicas en otras AZ asumen si el nodo cae.',
  },
  namePrefix: { pt: 'cache', en: 'cache', es: 'cache' },
  parents: ['aws.subnet.private'],
  defaults: {
    engine: 'valkey',
    nodeType: 'cache.t4g.micro',
    replicas: 1,
    transitEncryption: true,
    kmsKeyId: '',
    securityGroupIds: [],
    snapshotRetentionDays: 1,
    hoursPerMonth: 730,
  },
  derive: (context) => ({ subnetIds: subnetGroupOf(context) }),
  validate: (resource, resources) =>
    subnetGroupIssues(
      resource,
      resources,
      Number(resource.config.replicas) > 0,
    ),
  fields: [
    {
      key: 'engine',
      section: 'config',
      type: 'select',
      label: { pt: 'Engine', en: 'Engine', es: 'Engine' },
      options: [
        {
          value: 'valkey',
          label: {
            pt: 'Valkey (compatível com Redis, mais barato)',
            en: 'Valkey (Redis-compatible, cheaper)',
            es: 'Valkey (compatible con Redis, más barato)',
          },
        },
        { value: 'redis', label: same('Redis OSS') },
      ],
    },
    {
      key: 'nodeType',
      section: 'config',
      type: 'select',
      optionsSource: 'cacheNodeTypes',
      label: { pt: 'Tipo de nó', en: 'Node type', es: 'Tipo de nodo' },
    },
    {
      key: 'replicas',
      section: 'config',
      type: 'number',
      min: 0,
      max: 5,
      step: 1,
      label: { pt: 'Réplicas', en: 'Replicas', es: 'Réplicas' },
      help: {
        pt: '0 = um nó só (sem failover). Com réplicas, failover automático e Multi-AZ (subnets em 2+ AZs).',
        en: '0 = a single node (no failover). With replicas, automatic failover and Multi-AZ (subnets in 2+ AZs).',
        es: '0 = un solo nodo (sin failover). Con réplicas, failover automático y Multi-AZ (subnets en 2+ AZ).',
      },
    },
    {
      key: 'transitEncryption',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'TLS em trânsito',
        en: 'TLS in transit',
        es: 'TLS en tránsito',
      },
      help: {
        pt: 'O cliente precisa conectar com TLS. Em repouso o cache é sempre cifrado.',
        en: 'Clients must connect with TLS. At rest the cache is always encrypted.',
        es: 'El cliente debe conectar con TLS. En reposo la caché siempre está cifrada.',
      },
    },
    kmsKeyField(),
    subnetsField({
      pt: 'Subnet group: uma por AZ; o primário e as réplicas se espalham por elas.',
      en: 'Subnet group: one per AZ; the primary and replicas spread across them.',
      es: 'Subnet group: una por AZ; el primario y las réplicas se reparten entre ellas.',
    }),
    securityGroupsField,
    {
      key: 'snapshotRetentionDays',
      section: 'operation',
      type: 'number',
      min: 0,
      max: 35,
      step: 1,
      label: {
        pt: 'Retenção de snapshots (dias)',
        en: 'Snapshot retention (days)',
        es: 'Retención de snapshots (días)',
      },
    },
    hoursField,
  ],
};

// ── Aurora ───────────────────────────────────────────────────────────────
const aurora: CloudCatalogEntry = {
  type: AURORA_TYPE,
  layer: 5,
  kind: 'node',
  category: 'data',
  optional: true,
  label: { pt: 'Aurora', en: 'Aurora', es: 'Aurora' },
  summary: {
    pt: 'Cluster PostgreSQL/MySQL: um writer e réplicas de leitura, storage compartilhado em 3 AZs.',
    en: 'PostgreSQL/MySQL cluster: one writer and read replicas, storage shared across 3 AZs.',
    es: 'Cluster PostgreSQL/MySQL: un writer y réplicas de lectura, storage compartido en 3 AZ.',
  },
  namePrefix: { pt: 'aurora', en: 'aurora', es: 'aurora' },
  parents: ['aws.subnet.private'],
  defaults: {
    engine: 'aurora-postgresql',
    engineVersion: '16.6',
    instanceClass: 'db.t4g.medium',
    readers: 1,
    storageMode: 'standard',
    kmsKeyId: '',
    securityGroupIds: [],
    backupRetentionDays: 7,
    storageGb: 20,
    ioMillionsMonth: 10,
    hoursPerMonth: 730,
  },
  derive: (context) => ({ subnetIds: subnetGroupOf(context) }),
  validate: (resource, resources) => {
    const issues = subnetGroupIssues(resource, resources, true);
    const version = String(resource.config.engineVersion ?? '').trim();
    const mysql = resource.config.engine === 'aurora-mysql';
    if (
      mysql
        ? !version.startsWith('8.0.mysql_aurora.')
        : !/^\d+\.\d+$/.test(version)
    )
      issues.engineVersion = mysql
        ? {
            pt: 'Aurora MySQL usa versões como 8.0.mysql_aurora.3.08.0.',
            en: 'Aurora MySQL uses versions like 8.0.mysql_aurora.3.08.0.',
            es: 'Aurora MySQL usa versiones como 8.0.mysql_aurora.3.08.0.',
          }
        : {
            pt: 'Aurora PostgreSQL usa versões como 16.6.',
            en: 'Aurora PostgreSQL uses versions like 16.6.',
            es: 'Aurora PostgreSQL usa versiones como 16.6.',
          };
    return issues;
  },
  fields: [
    {
      key: 'engine',
      section: 'config',
      type: 'select',
      label: { pt: 'Engine', en: 'Engine', es: 'Engine' },
      options: [
        { value: 'aurora-postgresql', label: same('Aurora PostgreSQL') },
        { value: 'aurora-mysql', label: same('Aurora MySQL') },
      ],
    },
    {
      key: 'engineVersion',
      section: 'config',
      type: 'text',
      mono: true,
      label: { pt: 'Versão', en: 'Version', es: 'Versión' },
    },
    {
      key: 'instanceClass',
      section: 'config',
      type: 'select',
      optionsSource: 'auroraInstanceClasses',
      label: { pt: 'Classe', en: 'Class', es: 'Clase' },
    },
    {
      key: 'readers',
      section: 'config',
      type: 'number',
      min: 0,
      max: 15,
      step: 1,
      label: {
        pt: 'Réplicas de leitura',
        en: 'Read replicas',
        es: 'Réplicas de lectura',
      },
      help: {
        pt: 'Cada réplica é uma instância a mais (e assume se o writer cair).',
        en: 'Each replica is one more instance (and takes over if the writer fails).',
        es: 'Cada réplica es una instancia más (y asume si el writer cae).',
      },
    },
    {
      key: 'storageMode',
      section: 'config',
      type: 'select',
      label: { pt: 'Storage', en: 'Storage', es: 'Storage' },
      options: [
        {
          value: 'standard',
          label: {
            pt: 'Aurora Standard (paga por E/S)',
            en: 'Aurora Standard (pay per I/O)',
            es: 'Aurora Standard (paga por E/S)',
          },
        },
        {
          value: 'io-optimized',
          label: {
            pt: 'I/O-Optimized (E/S incluída)',
            en: 'I/O-Optimized (I/O included)',
            es: 'I/O-Optimized (E/S incluida)',
          },
        },
      ],
      help: {
        pt: 'I/O-Optimized compensa quando a E/S passa de ~25% do custo. Sempre cifrado.',
        en: 'I/O-Optimized pays off when I/O exceeds ~25% of the cost. Always encrypted.',
        es: 'I/O-Optimized conviene cuando la E/S supera ~25% del costo. Siempre cifrado.',
      },
    },
    kmsKeyField(),
    subnetsField({
      pt: 'Subnet group: ao menos 2 AZs (exigência da AWS).',
      en: 'Subnet group: at least 2 AZs (AWS requirement).',
      es: 'Subnet group: al menos 2 AZ (exigencia de AWS).',
    }),
    securityGroupsField,
    {
      key: 'backupRetentionDays',
      section: 'operation',
      type: 'number',
      min: 1,
      max: 35,
      step: 1,
      label: {
        pt: 'Retenção de backup (dias)',
        en: 'Backup retention (days)',
        es: 'Retención de backup (días)',
      },
    },
    {
      key: 'storageGb',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 10,
      unit: 'GB',
      label: {
        pt: 'Dados armazenados',
        en: 'Stored data',
        es: 'Datos almacenados',
      },
    },
    millions(
      'ioMillionsMonth',
      {
        pt: 'E/S por mês (milhões)',
        en: 'I/O per month (millions)',
        es: 'E/S por mes (millones)',
      },
      (config) => config.storageMode !== 'io-optimized',
    ),
    ...alarmFields,
    hoursField,
  ],
};

// ── DynamoDB ─────────────────────────────────────────────────────────────
const ATTRIBUTE_NAME = /^[A-Za-z0-9_.-]{1,255}$/;
const provisioned = (config: Record<string, unknown>) =>
  config.billingMode === 'PROVISIONED';

const dynamodb: CloudCatalogEntry = {
  type: DYNAMODB_TYPE,
  layer: 5,
  kind: 'node',
  category: 'data',
  optional: true,
  label: {
    pt: 'DynamoDB — tabela',
    en: 'DynamoDB — table',
    es: 'DynamoDB — tabla',
  },
  summary: {
    pt: 'Tabela NoSQL regional (fora da VPC). Ligue as cargas a ela: a role ganha só o acesso a esta tabela.',
    en: 'Regional NoSQL table (outside the VPC). Connect workloads to it: their role gets access to this table only.',
    es: 'Tabla NoSQL regional (fuera de la VPC). Conecta las cargas a ella: el rol recibe acceso solo a esta tabla.',
  },
  namePrefix: { pt: 'tabela', en: 'table', es: 'tabla' },
  parents: ['aws.region'],
  inspectorHint: {
    pt: 'Subnet sem saída para a internet alcança a tabela pelo endpoint de gateway "dynamodb" da VPC (grátis).',
    en: 'A subnet with no way out reaches the table through the VPC "dynamodb" gateway endpoint (free).',
    es: 'Una subnet sin salida alcanza la tabla por el endpoint de gateway "dynamodb" de la VPC (gratis).',
  },
  defaults: {
    partitionKey: 'pk',
    sortKey: '',
    billingMode: 'PAY_PER_REQUEST',
    readCapacity: 5,
    writeCapacity: 5,
    pitr: true,
    kmsKeyId: '',
    readsMillionsMonth: 10,
    writesMillionsMonth: 1,
    storageGb: 1,
  },
  validate: (resource, resources) => {
    const issues: Record<string, LocalizedText> = {
      ...securityIssues(resources, resource),
    };
    const pk = String(resource.config.partitionKey ?? '').trim();
    const sk = String(resource.config.sortKey ?? '').trim();
    if (!ATTRIBUTE_NAME.test(pk))
      issues.partitionKey = {
        pt: 'Dê um nome à chave de partição (letras, números, _ . -).',
        en: 'Name the partition key (letters, digits, _ . -).',
        es: 'Da un nombre a la clave de partición (letras, números, _ . -).',
      };
    if (sk && (!ATTRIBUTE_NAME.test(sk) || sk === pk))
      issues.partitionKey ??= {
        pt: 'A chave de ordenação precisa de um nome válido e diferente da de partição.',
        en: 'The sort key needs a valid name, different from the partition key.',
        es: 'La clave de ordenación necesita un nombre válido y distinto de la de partición.',
      };
    return issues;
  },
  fields: [
    {
      key: 'partitionKey',
      section: 'config',
      type: 'text',
      mono: true,
      label: {
        pt: 'Chave de partição (texto)',
        en: 'Partition key (string)',
        es: 'Clave de partición (texto)',
      },
    },
    {
      key: 'sortKey',
      section: 'config',
      type: 'text',
      mono: true,
      placeholder: 'sk',
      label: {
        pt: 'Chave de ordenação (opcional)',
        en: 'Sort key (optional)',
        es: 'Clave de ordenación (opcional)',
      },
    },
    {
      key: 'billingMode',
      section: 'config',
      type: 'select',
      label: { pt: 'Capacidade', en: 'Capacity', es: 'Capacidad' },
      options: [
        {
          value: 'PAY_PER_REQUEST',
          label: {
            pt: 'Sob demanda (paga por requisição)',
            en: 'On-demand (pay per request)',
            es: 'Bajo demanda (paga por solicitud)',
          },
        },
        {
          value: 'PROVISIONED',
          label: {
            pt: 'Provisionada (RCU/WCU fixas)',
            en: 'Provisioned (fixed RCU/WCU)',
            es: 'Aprovisionada (RCU/WCU fijas)',
          },
        },
      ],
    },
    {
      key: 'readCapacity',
      section: 'config',
      type: 'number',
      min: 1,
      max: 40000,
      step: 1,
      unit: 'RCU',
      visibleWhen: provisioned,
      label: {
        pt: 'Leitura provisionada',
        en: 'Provisioned reads',
        es: 'Lectura aprovisionada',
      },
    },
    {
      key: 'writeCapacity',
      section: 'config',
      type: 'number',
      min: 1,
      max: 40000,
      step: 1,
      unit: 'WCU',
      visibleWhen: provisioned,
      label: {
        pt: 'Gravação provisionada',
        en: 'Provisioned writes',
        es: 'Escritura aprovisionada',
      },
    },
    {
      key: 'pitr',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Recuperação para um ponto no tempo (PITR)',
        en: 'Point-in-time recovery (PITR)',
        es: 'Recuperación a un punto en el tiempo (PITR)',
      },
    },
    kmsKeyField(),
    millions(
      'readsMillionsMonth',
      {
        pt: 'Leituras por mês (milhões)',
        en: 'Reads per month (millions)',
        es: 'Lecturas por mes (millones)',
      },
      (config) => !provisioned(config),
    ),
    millions(
      'writesMillionsMonth',
      {
        pt: 'Gravações por mês (milhões)',
        en: 'Writes per month (millions)',
        es: 'Escrituras por mes (millones)',
      },
      (config) => !provisioned(config),
    ),
    {
      key: 'storageGb',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1,
      unit: 'GB',
      label: {
        pt: 'Dados armazenados',
        en: 'Stored data',
        es: 'Datos almacenados',
      },
    },
  ],
};

// ── SQS ──────────────────────────────────────────────────────────────────
const sqs: CloudCatalogEntry = {
  type: SQS_TYPE,
  layer: 5,
  kind: 'node',
  category: 'data',
  optional: true,
  label: { pt: 'SQS — fila', en: 'SQS — queue', es: 'SQS — cola' },
  summary: {
    pt: 'Fila de mensagens. Produtor → fila → consumidor (Lambda dispara sozinha; EC2/ECS leem).',
    en: 'Message queue. Producer → queue → consumer (Lambda is triggered; EC2/ECS poll).',
    es: 'Cola de mensajes. Productor → cola → consumidor (Lambda se dispara sola; EC2/ECS leen).',
  },
  namePrefix: { pt: 'fila', en: 'queue', es: 'cola' },
  parents: ['aws.region'],
  defaults: {
    fifo: false,
    visibilityTimeoutSec: 30,
    retentionDays: 4,
    deadLetterQueueId: '',
    maxReceiveCount: 5,
    kmsKeyId: '',
    requestsMillionsMonth: 1,
  },
  validate: (resource, resources, connections) => {
    const issues: Record<string, LocalizedText> = {
      ...securityIssues(resources, resource),
      ...observabilityIssues(resource, resources),
    };
    const dlq = deadLetterQueueOf(resources, resource);
    if (
      String(resource.config.deadLetterQueueId ?? '') &&
      !(dlq && deadLetterQueuesFor(resources, resource).includes(dlq))
    )
      issues.deadLetterQueueId = {
        pt: 'A fila morta precisa ser outra fila da mesma Região e do mesmo tipo (FIFO ou Standard).',
        en: 'The dead-letter queue must be another queue in the same Region and of the same type (FIFO or Standard).',
        es: 'La cola de mensajes fallidos debe ser otra cola de la misma Región y del mismo tipo (FIFO o Standard).',
      };
    // O gatilho da Lambda exige visibilidade ≥ tempo limite da função.
    const visibility = Number(resource.config.visibilityTimeoutSec) || 0;
    const slow = (connections ?? [])
      .filter((c) => c.source === resource.id)
      .map((c) => resources.find((r) => r.id === c.target))
      .find(
        (r) =>
          r?.type === 'aws.lambda' &&
          queueTriggersOf(resources, connections ?? [], r).includes(resource) &&
          (Number(r.config.timeoutSec) || 0) > visibility,
      );
    if (slow)
      issues.visibilityTimeoutSec = {
        pt: `A visibilidade (${visibility} s) precisa ser ≥ o tempo limite de ${slow.name} (${slow.config.timeoutSec} s); a AWS recomenda 6×.`,
        en: `Visibility (${visibility} s) must be ≥ ${slow.name}'s timeout (${slow.config.timeoutSec} s); AWS recommends 6×.`,
        es: `La visibilidad (${visibility} s) debe ser ≥ el tiempo límite de ${slow.name} (${slow.config.timeoutSec} s); AWS recomienda 6×.`,
      };
    return issues;
  },
  fields: [
    fifoField({
      pt: 'O nome ganha o sufixo .fifo. Custa um pouco mais por requisição.',
      en: 'The name gets the .fifo suffix. Costs a bit more per request.',
      es: 'El nombre recibe el sufijo .fifo. Cuesta un poco más por solicitud.',
    }),
    {
      key: 'visibilityTimeoutSec',
      section: 'config',
      type: 'number',
      min: 0,
      max: 43200,
      step: 1,
      unit: 's',
      label: {
        pt: 'Tempo de visibilidade',
        en: 'Visibility timeout',
        es: 'Tiempo de visibilidad',
      },
      help: {
        pt: 'Quanto tempo a mensagem some da fila enquanto alguém a processa.',
        en: 'How long a message is hidden while someone processes it.',
        es: 'Cuánto tiempo el mensaje desaparece de la cola mientras alguien lo procesa.',
      },
    },
    {
      key: 'retentionDays',
      section: 'config',
      type: 'number',
      min: 1,
      max: 14,
      step: 1,
      unit: 'd',
      label: { pt: 'Retenção', en: 'Retention', es: 'Retención' },
    },
    {
      key: 'deadLetterQueueId',
      section: 'config',
      type: 'select',
      optionsSource: 'sqsQueues',
      label: {
        pt: 'Fila morta (DLQ)',
        en: 'Dead-letter queue (DLQ)',
        es: 'Cola de mensajes fallidos (DLQ)',
      },
      help: {
        pt: 'Recebe as mensagens que falharam várias vezes.',
        en: 'Receives the messages that failed several times.',
        es: 'Recibe los mensajes que fallaron varias veces.',
      },
    },
    {
      key: 'maxReceiveCount',
      section: 'config',
      type: 'number',
      min: 1,
      max: 1000,
      step: 1,
      visibleWhen: (config) => Boolean(config.deadLetterQueueId),
      label: {
        pt: 'Tentativas antes da DLQ',
        en: 'Attempts before the DLQ',
        es: 'Intentos antes de la DLQ',
      },
    },
    {
      ...kmsKeyField(),
      help: {
        pt: 'Vazio = criptografia gerenciada pelo SQS (SSE-SQS). Só chaves da mesma Região.',
        en: 'Empty = SQS managed encryption (SSE-SQS). Only keys from the same Region.',
        es: 'Vacío = cifrado administrado por SQS (SSE-SQS). Solo claves de la misma Región.',
      },
    },
    millions('requestsMillionsMonth', {
      pt: 'Requisições por mês (milhões)',
      en: 'Requests per month (millions)',
      es: 'Solicitudes por mes (millones)',
    }),
    ...alarmFields,
  ],
};

// ── SNS ──────────────────────────────────────────────────────────────────
const sns: CloudCatalogEntry = {
  type: SNS_TYPE,
  layer: 5,
  kind: 'node',
  category: 'data',
  optional: true,
  label: { pt: 'SNS — tópico', en: 'SNS — topic', es: 'SNS — tema' },
  summary: {
    pt: 'Publica uma mensagem para vários assinantes (filas SQS e Lambdas).',
    en: 'Publishes one message to many subscribers (SQS queues and Lambdas).',
    es: 'Publica un mensaje para varios suscriptores (colas SQS y Lambdas).',
  },
  namePrefix: { pt: 'topico', en: 'topic', es: 'tema' },
  parents: ['aws.region'],
  inspectorHint: {
    pt: 'Assinatura: arraste do tópico até uma fila SQS ou uma Lambda. Entregas a SQS e Lambda não são cobradas.',
    en: 'Subscription: drag from the topic to an SQS queue or a Lambda. Deliveries to SQS and Lambda are free.',
    es: 'Suscripción: arrastra desde el tema hasta una cola SQS o una Lambda. Las entregas a SQS y Lambda no se cobran.',
  },
  defaults: { fifo: false, kmsKeyId: '', publishesMillionsMonth: 1 },
  validate: (resource, resources, connections) => {
    const issues: Record<string, LocalizedText> = {
      ...securityIssues(resources, resource),
    };
    if (
      connections &&
      subscriptionsOf(resources, connections, resource).length === 0
    )
      issues['*'] = {
        pt: 'Sem assinantes: ligue o tópico a uma fila SQS ou a uma Lambda.',
        en: 'No subscribers: connect the topic to an SQS queue or a Lambda.',
        es: 'Sin suscriptores: conecta el tema a una cola SQS o a una Lambda.',
      };
    return issues;
  },
  fields: [
    fifoField({
      pt: 'Tópico FIFO só entrega a filas FIFO.',
      en: 'A FIFO topic only delivers to FIFO queues.',
      es: 'Un tema FIFO solo entrega a colas FIFO.',
    }),
    kmsKeyField(),
    millions('publishesMillionsMonth', {
      pt: 'Publicações por mês (milhões)',
      en: 'Publishes per month (millions)',
      es: 'Publicaciones por mes (millones)',
    }),
  ],
};

// ── EFS (faixa de borda da VPC) ──────────────────────────────────────────
const elastic = (config: Record<string, unknown>) =>
  config.throughputMode !== 'bursting';

const efs: CloudCatalogEntry = {
  type: EFS_TYPE,
  layer: 5,
  kind: 'node',
  category: 'data',
  optional: true,
  label: { pt: 'EFS', en: 'EFS', es: 'EFS' },
  summary: {
    pt: 'Sistema de arquivos NFS compartilhado, com um ponto de montagem por AZ.',
    en: 'Shared NFS file system, with one mount target per AZ.',
    es: 'Sistema de archivos NFS compartido, con un punto de montaje por AZ.',
  },
  namePrefix: { pt: 'efs', en: 'efs', es: 'efs' },
  parents: [VPC_TYPE],
  inspectorHint: {
    pt: 'Ligue EC2, ECS ou Lambda ao EFS: a conexão abre a porta 2049 no SG dele. Montar no contêiner/instância fica com você.',
    en: 'Connect EC2, ECS or Lambda to EFS: the connection opens port 2049 in its SG. Mounting inside the container/instance is up to you.',
    es: 'Conecta EC2, ECS o Lambda al EFS: la conexión abre el puerto 2049 en su SG. Montar en el contenedor/instancia queda contigo.',
  },
  defaults: {
    performanceMode: 'generalPurpose',
    throughputMode: 'elastic',
    transitionToIa: 'AFTER_30_DAYS',
    kmsKeyId: '',
    securityGroupIds: [],
    storageGb: 50,
    readGbMonth: 100,
    writeGbMonth: 20,
  },
  derive: ({ state, parent }) => ({
    subnetIds: parent
      ? subnetsPerAz(state.resources, parent.id, ['private', 'isolated'])
      : [],
  }),
  validate: (resource, resources) => {
    const issues: Record<string, LocalizedText> = {
      ...securityIssues(resources, resource),
    };
    const subnets = readIdList(resource.config.subnetIds);
    if (subnets.length === 0)
      issues.subnetIds = {
        pt: 'Escolha ao menos uma subnet (um ponto de montagem por AZ).',
        en: 'Pick at least one subnet (one mount target per AZ).',
        es: 'Elige al menos una subnet (un punto de montaje por AZ).',
      };
    else if (azCountOf(resources, subnets) !== subnets.length)
      issues.subnetIds = {
        pt: 'No máximo uma subnet por AZ.',
        en: 'At most one subnet per AZ.',
        es: 'Como máximo una subnet por AZ.',
      };
    if (securityGroupsOf(resource).length === 0) issues['*'] = noSgWarning;
    return issues;
  },
  fields: [
    {
      key: 'performanceMode',
      section: 'config',
      type: 'select',
      label: { pt: 'Desempenho', en: 'Performance', es: 'Rendimiento' },
      options: [
        {
          value: 'generalPurpose',
          label: {
            pt: 'Uso geral (latência menor)',
            en: 'General purpose (lower latency)',
            es: 'Uso general (menor latencia)',
          },
        },
        {
          value: 'maxIO',
          label: {
            pt: 'Max I/O (muitos clientes em paralelo)',
            en: 'Max I/O (many parallel clients)',
            es: 'Max I/O (muchos clientes en paralelo)',
          },
        },
      ],
    },
    {
      key: 'throughputMode',
      section: 'config',
      type: 'select',
      label: { pt: 'Vazão', en: 'Throughput', es: 'Rendimiento' },
      options: [
        {
          value: 'elastic',
          label: {
            pt: 'Elastic (paga o que ler e gravar)',
            en: 'Elastic (pay for what you read and write)',
            es: 'Elastic (paga lo que lees y escribes)',
          },
        },
        {
          value: 'bursting',
          label: {
            pt: 'Bursting (cresce com o tamanho)',
            en: 'Bursting (scales with size)',
            es: 'Bursting (crece con el tamaño)',
          },
        },
      ],
    },
    {
      key: 'transitionToIa',
      section: 'config',
      type: 'select',
      label: {
        pt: 'Mover para acesso infrequente',
        en: 'Move to infrequent access',
        es: 'Mover a acceso infrecuente',
      },
      options: [
        {
          value: 'AFTER_30_DAYS',
          label: {
            pt: 'Após 30 dias sem acesso',
            en: 'After 30 days without access',
            es: 'Tras 30 días sin acceso',
          },
        },
        {
          value: 'AFTER_90_DAYS',
          label: {
            pt: 'Após 90 dias sem acesso',
            en: 'After 90 days without access',
            es: 'Tras 90 días sin acceso',
          },
        },
        { value: '', label: { pt: 'Nunca', en: 'Never', es: 'Nunca' } },
      ],
      help: {
        pt: 'A estimativa cobra tudo como Standard (teto).',
        en: 'The estimate charges everything as Standard (ceiling).',
        es: 'La estimación cobra todo como Standard (techo).',
      },
    },
    kmsKeyField(),
    subnetsField({
      pt: 'Uma por AZ: cada uma ganha um ponto de montagem.',
      en: 'One per AZ: each gets a mount target.',
      es: 'Una por AZ: cada una recibe un punto de montaje.',
    }),
    securityGroupsField,
    {
      key: 'storageGb',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 10,
      unit: 'GB',
      label: { pt: 'Armazenado', en: 'Stored', es: 'Almacenado' },
    },
    {
      key: 'readGbMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 10,
      unit: 'GB',
      visibleWhen: elastic,
      label: {
        pt: 'Lido por mês',
        en: 'Read per month',
        es: 'Leído por mes',
      },
    },
    {
      key: 'writeGbMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 10,
      unit: 'GB',
      visibleWhen: elastic,
      label: {
        pt: 'Gravado por mês',
        en: 'Written per month',
        es: 'Escrito por mes',
      },
    },
  ],
};

export const AWS_DATA: CloudCatalogEntry[] = [
  aurora,
  elasticache,
  dynamodb,
  efs,
  sqs,
  sns,
];
