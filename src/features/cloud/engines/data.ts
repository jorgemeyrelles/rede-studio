import type { LocalizedText } from '../catalog/types';
import { closest } from '../network';
import type { CloudConnection, CloudResource } from '../types';

/**
 * Dados e mensageria (F7 onda 7C, parte 2 —
 * `sprint-cloud-f7c2-dados-mensageria.md`): ElastiCache, Aurora, DynamoDB,
 * SQS, SNS e EFS. Puro e sem importar outros motores: `secrets.ts` e
 * `connections.ts` importam este módulo, e `compute.ts` → `secrets.ts` →
 * aqui fecharia um ciclo na carga.
 *
 * As conexões seguem o fluxo da mensagem (D3): produtor → fila/tópico,
 * fila → consumidor, tópico → assinante. Delas saem a role mínima (D4) e os
 * serviços que a carga chama (alcance, D5).
 */

export const ELASTICACHE_TYPE = 'aws.elasticache';
export const AURORA_TYPE = 'aws.aurora';
export const DYNAMODB_TYPE = 'aws.dynamodb.table';
export const SQS_TYPE = 'aws.sqs.queue';
export const SNS_TYPE = 'aws.sns.topic';
export const EFS_TYPE = 'aws.efs';

const KMS_TYPE = 'aws.kms.key';
const LAMBDA_TYPE = 'aws.lambda';

/** Cargas que falam com dados e mensageria (e ganham role). */
export const WORKLOAD_TYPES = [
  'aws.ec2',
  'aws.asg',
  LAMBDA_TYPE,
  'aws.ecs.service',
  'aws.eks.nodegroup',
];

/** Só recebem conexões, sempre de cargas. */
const SINK_TYPES = [ELASTICACHE_TYPE, DYNAMODB_TYPE, EFS_TYPE];

const byId = (resources: CloudResource[], id: unknown) =>
  typeof id === 'string' && id ? resources.find((r) => r.id === id) : undefined;

const isFifo = (resource: CloudResource) => resource.config.fifo === true;

/** O par origem → destino faz sentido para dados e mensageria? `null` = não é com este módulo. */
export function dataPairAllowed(
  sourceType: string,
  targetType: string,
): boolean | null {
  if (SINK_TYPES.includes(sourceType)) return false;
  if (SINK_TYPES.includes(targetType))
    return WORKLOAD_TYPES.includes(sourceType);
  if (sourceType === SNS_TYPE)
    return targetType === SQS_TYPE || targetType === LAMBDA_TYPE;
  if (targetType === SNS_TYPE) return WORKLOAD_TYPES.includes(sourceType);
  if (sourceType === SQS_TYPE) return WORKLOAD_TYPES.includes(targetType);
  if (targetType === SQS_TYPE)
    return WORKLOAD_TYPES.includes(sourceType) || sourceType === SNS_TYPE;
  return null;
}

/** Porta padrão da conexão até o destino (cache, EFS, Aurora, APIs da AWS). */
export function dataPortOf(target: CloudResource): string | null {
  switch (target.type) {
    case ELASTICACHE_TYPE:
      return '6379';
    case EFS_TYPE:
      return '2049';
    case AURORA_TYPE:
      return target.config.engine === 'aurora-mysql' ? '3306' : '5432';
    case DYNAMODB_TYPE:
    case SQS_TYPE:
    case SNS_TYPE:
      return '443';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
//  Fila morta (associação de configuração)
// ---------------------------------------------------------------------------

/** Filas que podem ser a fila morta: mesma Região, mesmo tipo (FIFO × Standard), não ela mesma. */
export function deadLetterQueuesFor(
  resources: CloudResource[],
  queue: CloudResource,
) {
  const region = closest(resources, queue.id, 'aws.region')?.id;
  return resources.filter(
    (r) =>
      r.type === SQS_TYPE &&
      r.id !== queue.id &&
      region !== undefined &&
      closest(resources, r.id, 'aws.region')?.id === region &&
      isFifo(r) === isFifo(queue),
  );
}

export const deadLetterQueueOf = (
  resources: CloudResource[],
  queue: CloudResource,
) => {
  const dlq = byId(resources, queue.config.deadLetterQueueId);
  return dlq?.type === SQS_TYPE ? dlq : undefined;
};

// ---------------------------------------------------------------------------
//  Acessos da carga (role mínima e alcance)
// ---------------------------------------------------------------------------

export type DataAccessMode = 'readwrite' | 'send' | 'publish' | 'consume';
export type DataAccess = { target: CloudResource; mode: DataAccessMode };

/**
 * O que a carga faz com tabelas, filas e tópicos, pelas conexões: grava e lê
 * tabelas, envia a filas, publica em tópicos e consome filas que apontam
 * para ela. Fila → Lambda também conta (o gatilho usa a role da função).
 */
export function dataAccessOf(
  resources: CloudResource[],
  connections: CloudConnection[],
  workload: CloudResource,
): DataAccess[] {
  if (!WORKLOAD_TYPES.includes(workload.type)) return [];
  const out: DataAccess[] = [];
  const seen = new Set<string>();
  const push = (target: CloudResource | undefined, mode: DataAccessMode) => {
    const key = `${target?.id}|${mode}`;
    if (!target || seen.has(key)) return;
    seen.add(key);
    out.push({ target, mode });
  };
  for (const connection of connections) {
    const both = connection.direction === 'both' && !connection.pairId;
    const ends: [string, string][] = [[connection.source, connection.target]];
    if (both) ends.push([connection.target, connection.source]);
    for (const [from, to] of ends) {
      if (from === workload.id) {
        const target = byId(resources, to);
        if (target?.type === DYNAMODB_TYPE) push(target, 'readwrite');
        if (target?.type === SQS_TYPE) push(target, 'send');
        if (target?.type === SNS_TYPE) push(target, 'publish');
      }
      if (to === workload.id) {
        const source = byId(resources, from);
        if (source?.type === SQS_TYPE) push(source, 'consume');
      }
    }
  }
  return out;
}

/** Chaves KMS das tabelas/filas/tópicos que a carga usa (Decrypt + GenerateDataKey). */
export function dataKmsKeys(resources: CloudResource[], access: DataAccess[]) {
  const keys = access
    .map((a) => byId(resources, a.target.config.kmsKeyId))
    .filter((k): k is CloudResource => k?.type === KMS_TYPE);
  return [...new Set(keys)];
}

/** Endpoints que a carga chama pelos dados (S3/DynamoDB são de gateway). */
export function dataServicesOf(
  resources: CloudResource[],
  connections: CloudConnection[],
  workload: CloudResource,
): string[] {
  const services = new Set<string>();
  for (const access of dataAccessOf(resources, connections, workload)) {
    // Fila → Lambda: quem lê a fila é o serviço Lambda, não a função na VPC.
    if (access.mode === 'consume' && workload.type === LAMBDA_TYPE) continue;
    services.add(
      access.target.type === DYNAMODB_TYPE
        ? 'dynamodb'
        : access.target.type === SQS_TYPE
          ? 'sqs'
          : 'sns',
    );
    if (byId(resources, access.target.config.kmsKeyId)?.type === KMS_TYPE)
      services.add('kms');
  }
  for (const connection of connections)
    if (
      connection.source === workload.id &&
      byId(resources, connection.target)?.type === 'aws.s3'
    )
      services.add('s3');
  return [...services];
}

// ---------------------------------------------------------------------------
//  Assinaturas e gatilhos
// ---------------------------------------------------------------------------

/** Assinaturas do tópico: filas e Lambdas ligadas a partir dele. */
export function subscriptionsOf(
  resources: CloudResource[],
  connections: CloudConnection[],
  topic: CloudResource,
) {
  return connections
    .filter((c) => c.source === topic.id)
    .map((c) => byId(resources, c.target))
    .filter((r): r is CloudResource =>
      Boolean(r && (r.type === SQS_TYPE || r.type === LAMBDA_TYPE)),
    );
}

/** Filas que disparam a Lambda (event source mapping). */
export function queueTriggersOf(
  resources: CloudResource[],
  connections: CloudConnection[],
  fn: CloudResource,
) {
  return connections
    .filter((c) => c.target === fn.id)
    .map((c) => byId(resources, c.source))
    .filter((r): r is CloudResource => r?.type === SQS_TYPE);
}

/** Problema da conexão de mensageria (FIFO, fila cifrada recebendo do SNS). */
export function dataConnectionIssue(
  resources: CloudResource[],
  connection: CloudConnection,
): LocalizedText | null {
  const source = byId(resources, connection.source);
  const target = byId(resources, connection.target);
  if (!source || !target) return null;
  if (source.type === SNS_TYPE && target.type === SQS_TYPE) {
    if (isFifo(source) !== isFifo(target))
      return isFifo(source)
        ? {
            pt: `${source.name} é FIFO: só entrega a fila FIFO.`,
            en: `${source.name} is FIFO: it only delivers to FIFO queues.`,
            es: `${source.name} es FIFO: solo entrega a colas FIFO.`,
          }
        : {
            pt: `${target.name} é FIFO: só recebe de tópico FIFO.`,
            en: `${target.name} is FIFO: it only receives from FIFO topics.`,
            es: `${target.name} es FIFO: solo recibe de temas FIFO.`,
          };
    if (byId(resources, target.config.kmsKeyId)?.type === KMS_TYPE)
      return {
        pt: `${target.name} usa chave KMS própria: a política da chave precisa liberar o SNS (kms:GenerateDataKey, kms:Decrypt).`,
        en: `${target.name} uses its own KMS key: the key policy must allow SNS (kms:GenerateDataKey, kms:Decrypt).`,
        es: `${target.name} usa clave KMS propia: la política de la clave debe permitir SNS (kms:GenerateDataKey, kms:Decrypt).`,
      };
  }
  if (
    connection.direction === 'both' &&
    !connection.pairId &&
    [SQS_TYPE, SNS_TYPE].includes(source.type) !==
      [SQS_TYPE, SNS_TYPE].includes(target.type)
  )
    return {
      pt: 'Mensageria segue o fluxo da mensagem: use "ida" (produtor → fila/tópico → consumidor).',
      en: 'Messaging follows the message flow: use "one-way" (producer → queue/topic → consumer).',
      es: 'La mensajería sigue el flujo del mensaje: usa "ida" (productor → cola/tema → consumidor).',
    };
  return null;
}
