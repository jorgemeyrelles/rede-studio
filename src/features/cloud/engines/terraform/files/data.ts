import type { CloudResource } from '../../../types';
import { readIdList } from '../../addressing';
import { LAMBDA_TYPE } from '../../compute';
import {
  AURORA_TYPE,
  deadLetterQueueOf,
  DYNAMODB_TYPE,
  EFS_TYPE,
  ELASTICACHE_TYPE,
  queueTriggersOf,
  SNS_TYPE,
  SQS_TYPE,
  subscriptionsOf,
} from '../../data';
import { kmsKeyOf } from '../../secrets';
import { attr, block, comment, raw } from '../hcl';
import { localized, dnsName, awsDescription } from '../shared';
import type { TfContext } from '../context';

/** Seção `data.tf` do gerador. */
export function emitData(ctx: TfContext) {
  const {
    resources,
    connections,
    t,
    namer,
    get,
    ofType,
    str,
    numOr,
    emit,
    todo,
    providerOf,
    tagsOf,
    ok,
    gate,
    ref,
    subnetRefs,
    kmsRef,
    kmsAttr,
    sgAttr,
  } = ctx;

  // ── data.tf ───────────────────────────────────────────────────────────
  for (const rds of ofType('aws.rds')) {
    if (!gate('data.tf', rds)) continue;
    const name = namer.name('aws_db_instance', rds.id, rds.name);
    const identifier = dnsName(rds.name);
    emit(
      'data.tf',
      [rds.id],
      block(
        'resource',
        [
          'aws_db_subnet_group',
          namer.name('aws_db_subnet_group', rds.id, rds.name),
        ],
        [
          ...providerOf(rds),
          ...attr('name', `${identifier}-subnets`),
          ...attr('subnet_ids', subnetRefs(readIdList(rds.config.subnetIds))),
          ...tagsOf(rds),
        ],
      ),
    );
    emit(
      'data.tf',
      [rds.id],
      block(
        'resource',
        ['aws_db_instance', name],
        [
          comment(t.rdsIp),
          ...providerOf(rds),
          ...attr('identifier', identifier),
          ...attr('engine', str(rds.config.engine) || 'postgres'),
          ...attr('engine_version', str(rds.config.engineVersion) || '16'),
          ...attr('instance_class', str(rds.config.instanceClass)),
          ...attr('allocated_storage', numOr(rds.config.storageGb, 20)),
          ...attr('storage_type', 'gp3'),
          ...attr('storage_encrypted', rds.config.encrypted !== false),
          ...(rds.config.encrypted !== false ? kmsAttr('kms_key_id', rds) : []),
          ...attr('multi_az', rds.config.multiAz === true),
          ...attr(
            'db_subnet_group_name',
            namer.ref('aws_db_subnet_group', rds.id, rds.name, 'name'),
          ),
          ...sgAttr('vpc_security_group_ids', rds),
          ...attr('username', raw('var.db_username')),
          ...attr('manage_master_user_password', true),
          ...attr(
            'backup_retention_period',
            numOr(rds.config.backupRetentionDays, 7),
          ),
          ...attr('deletion_protection', raw('var.environment == "prod"')),
          ...attr('skip_final_snapshot', raw('var.environment != "prod"')),
          ...attr('final_snapshot_identifier', `${identifier}-final`),
          ...tagsOf(rds),
        ],
      ),
    );
  }

  for (const bucket of ofType('aws.s3')) {
    if (!gate('data.tf', bucket)) continue;
    const name = namer.name('aws_s3_bucket', bucket.id, bucket.name);
    const bucketRef = raw(`aws_s3_bucket.${name}.id`);
    emit(
      'data.tf',
      [bucket.id],
      block(
        'resource',
        ['aws_s3_bucket', name],
        [
          ...providerOf(bucket),
          ...attr('bucket_prefix', `${dnsName(bucket.name, 36)}-`),
          ...tagsOf(bucket),
        ],
      ),
    );
    emit(
      'data.tf',
      [bucket.id],
      block(
        'resource',
        ['aws_s3_bucket_versioning', name],
        [
          ...providerOf(bucket),
          ...attr('bucket', bucketRef),
          block(
            'versioning_configuration',
            [],
            [
              ...attr(
                'status',
                bucket.config.versioning === false ? 'Suspended' : 'Enabled',
              ),
            ],
          ),
        ],
      ),
    );
    emit(
      'data.tf',
      [bucket.id],
      block(
        'resource',
        ['aws_s3_bucket_server_side_encryption_configuration', name],
        [
          ...providerOf(bucket),
          ...attr('bucket', bucketRef),
          block(
            'rule',
            [],
            [
              block(
                'apply_server_side_encryption_by_default',
                [],
                [
                  ...attr(
                    'sse_algorithm',
                    bucket.config.encryption === 'sse-kms'
                      ? 'aws:kms'
                      : 'AES256',
                  ),
                  ...(bucket.config.encryption === 'sse-kms'
                    ? kmsAttr('kms_master_key_id', bucket)
                    : []),
                ],
              ),
            ],
          ),
        ],
      ),
    );
    const blockPublic = bucket.config.blockPublicAccess !== false;
    emit(
      'data.tf',
      [bucket.id],
      block(
        'resource',
        ['aws_s3_bucket_public_access_block', name],
        [
          ...providerOf(bucket),
          ...attr('bucket', bucketRef),
          ...attr('block_public_acls', blockPublic),
          ...attr('block_public_policy', blockPublic),
          ...attr('ignore_public_acls', blockPublic),
          ...attr('restrict_public_buckets', blockPublic),
        ],
      ),
    );
  }

  for (const cluster of ofType(AURORA_TYPE)) {
    if (!gate('data.tf', cluster)) continue;
    const name = namer.name('aws_rds_cluster', cluster.id, cluster.name);
    const identifier = dnsName(cluster.name);
    const subnetGroup = namer.name(
      'aws_db_subnet_group',
      cluster.id,
      cluster.name,
    );
    emit(
      'data.tf',
      [cluster.id],
      block(
        'resource',
        ['aws_db_subnet_group', subnetGroup],
        [
          ...providerOf(cluster),
          ...attr('name', `${identifier}-subnets`),
          ...attr(
            'subnet_ids',
            subnetRefs(readIdList(cluster.config.subnetIds)),
          ),
          ...tagsOf(cluster),
        ],
      ),
    );
    emit(
      'data.tf',
      [cluster.id],
      block(
        'resource',
        ['aws_rds_cluster', name],
        [
          ...providerOf(cluster),
          ...attr('cluster_identifier', identifier),
          ...attr('engine', str(cluster.config.engine) || 'aurora-postgresql'),
          ...attr('engine_version', str(cluster.config.engineVersion)),
          ...(cluster.config.storageMode === 'io-optimized'
            ? attr('storage_type', 'aurora-iopt1')
            : []),
          ...attr('master_username', raw('var.db_username')),
          ...attr('manage_master_user_password', true),
          ...attr('storage_encrypted', true),
          ...kmsAttr('kms_key_id', cluster),
          ...attr(
            'db_subnet_group_name',
            raw(`aws_db_subnet_group.${subnetGroup}.name`),
          ),
          ...sgAttr('vpc_security_group_ids', cluster),
          ...attr(
            'backup_retention_period',
            numOr(cluster.config.backupRetentionDays, 7),
          ),
          ...attr('deletion_protection', raw('var.environment == "prod"')),
          ...attr('skip_final_snapshot', raw('var.environment != "prod"')),
          ...attr('final_snapshot_identifier', `${identifier}-final`),
          ...tagsOf(cluster),
        ],
      ),
    );
    // Writer + réplicas: a AWS escolhe o writer entre as instâncias do cluster.
    emit(
      'data.tf',
      [cluster.id],
      block(
        'resource',
        ['aws_rds_cluster_instance', name],
        [
          ...providerOf(cluster),
          ...attr('count', 1 + numOr(cluster.config.readers, 0)),
          ...attr('identifier', raw(`"${identifier}-\${count.index}"`)),
          ...attr('cluster_identifier', raw(`aws_rds_cluster.${name}.id`)),
          ...attr('instance_class', str(cluster.config.instanceClass)),
          ...attr('engine', raw(`aws_rds_cluster.${name}.engine`)),
          ...attr(
            'engine_version',
            raw(`aws_rds_cluster.${name}.engine_version`),
          ),
          ...attr(
            'db_subnet_group_name',
            raw(`aws_db_subnet_group.${subnetGroup}.name`),
          ),
          ...tagsOf(cluster),
        ],
      ),
    );
  }

  const CACHE_VERSIONS: Record<string, string> = {
    valkey: '8.0',
    redis: '7.1',
  };
  for (const cache of ofType(ELASTICACHE_TYPE)) {
    if (!gate('data.tf', cache)) continue;
    const name = namer.name(
      'aws_elasticache_replication_group',
      cache.id,
      cache.name,
    );
    const engine = cache.config.engine === 'redis' ? 'redis' : 'valkey';
    const replicas = numOr(cache.config.replicas, 0);
    emit(
      'data.tf',
      [cache.id],
      block(
        'resource',
        ['aws_elasticache_subnet_group', name],
        [
          ...providerOf(cache),
          ...attr('name', `${dnsName(cache.name)}-subnets`),
          ...attr('subnet_ids', subnetRefs(readIdList(cache.config.subnetIds))),
          ...tagsOf(cache),
        ],
      ),
    );
    emit(
      'data.tf',
      [cache.id],
      block(
        'resource',
        ['aws_elasticache_replication_group', name],
        [
          ...providerOf(cache),
          ...attr('replication_group_id', dnsName(cache.name, 40)),
          ...attr('description', awsDescription(cache.name) || 'cache'),
          ...attr('engine', engine),
          ...attr('engine_version', CACHE_VERSIONS[engine]),
          ...attr('node_type', str(cache.config.nodeType)),
          ...attr('num_cache_clusters', 1 + replicas),
          ...attr('port', 6379),
          ...attr('automatic_failover_enabled', replicas > 0),
          ...attr('multi_az_enabled', replicas > 0),
          ...attr(
            'subnet_group_name',
            raw(`aws_elasticache_subnet_group.${name}.name`),
          ),
          ...sgAttr('security_group_ids', cache),
          ...attr('at_rest_encryption_enabled', true),
          ...kmsAttr('kms_key_id', cache),
          ...attr(
            'transit_encryption_enabled',
            cache.config.transitEncryption !== false,
          ),
          ...attr(
            'snapshot_retention_limit',
            numOr(cache.config.snapshotRetentionDays, 1),
          ),
          ...tagsOf(cache),
        ],
      ),
    );
  }

  for (const table of ofType(DYNAMODB_TYPE)) {
    if (!gate('data.tf', table)) continue;
    const pk = str(table.config.partitionKey).trim();
    const sk = str(table.config.sortKey).trim();
    const provisionedMode = table.config.billingMode === 'PROVISIONED';
    const key = kmsKeyOf(resources, table);
    emit(
      'data.tf',
      [table.id],
      block(
        'resource',
        [
          'aws_dynamodb_table',
          namer.name('aws_dynamodb_table', table.id, table.name),
        ],
        [
          ...providerOf(table),
          ...attr('name', raw(`"\${var.project}-${dnsName(table.name, 200)}"`)),
          ...attr(
            'billing_mode',
            provisionedMode ? 'PROVISIONED' : 'PAY_PER_REQUEST',
          ),
          ...attr('hash_key', pk),
          ...(sk ? attr('range_key', sk) : []),
          ...(provisionedMode
            ? [
                ...attr('read_capacity', numOr(table.config.readCapacity, 5)),
                ...attr('write_capacity', numOr(table.config.writeCapacity, 5)),
              ]
            : []),
          ...attr(
            'deletion_protection_enabled',
            raw('var.environment == "prod"'),
          ),
          ...[pk, ...(sk ? [sk] : [])].map((attribute) =>
            block(
              'attribute',
              [],
              [...attr('name', attribute), ...attr('type', 'S')],
            ),
          ),
          block(
            'point_in_time_recovery',
            [],
            [...attr('enabled', table.config.pitr === true)],
          ),
          ...(key && ok(key)
            ? [
                block(
                  'server_side_encryption',
                  [],
                  [
                    ...attr('enabled', true),
                    ...attr('kms_key_arn', kmsRef(key)),
                  ],
                ),
              ]
            : []),
          ...tagsOf(table),
        ],
      ),
    );
  }

  for (const fs of ofType(EFS_TYPE)) {
    if (!gate('data.tf', fs)) continue;
    const name = namer.name('aws_efs_file_system', fs.id, fs.name);
    const transition = str(fs.config.transitionToIa);
    emit(
      'data.tf',
      [fs.id],
      block(
        'resource',
        ['aws_efs_file_system', name],
        [
          ...providerOf(fs),
          ...attr(
            'creation_token',
            raw(`"\${var.project}-${dnsName(fs.name, 50)}"`),
          ),
          ...attr(
            'performance_mode',
            str(fs.config.performanceMode) || 'generalPurpose',
          ),
          ...attr(
            'throughput_mode',
            str(fs.config.throughputMode) || 'elastic',
          ),
          ...attr('encrypted', true),
          ...kmsAttr('kms_key_id', fs),
          ...(transition
            ? [
                block(
                  'lifecycle_policy',
                  [],
                  [...attr('transition_to_ia', transition)],
                ),
              ]
            : []),
          ...tagsOf(fs),
        ],
      ),
    );
    // Um ponto de montagem por subnet (uma por AZ).
    for (const subnet of readIdList(fs.config.subnetIds).map(get).filter(ok))
      emit(
        'data.tf',
        [fs.id],
        block(
          'resource',
          [
            'aws_efs_mount_target',
            namer.name(
              'aws_efs_mount_target',
              `${fs.id}|${subnet.id}`,
              `${fs.name}_${subnet.name}`,
            ),
          ],
          [
            ...providerOf(fs),
            ...attr('file_system_id', raw(`aws_efs_file_system.${name}.id`)),
            ...attr('subnet_id', ref.subnet(subnet)),
            ...sgAttr('security_groups', fs),
          ],
        ),
      );
  }

  // Mensageria: filas, tópicos, assinaturas e gatilhos.
  const queueRef = (queue: CloudResource, attribute = 'arn') =>
    namer.ref('aws_sqs_queue', queue.id, queue.name, attribute);
  const topicRef = (topic: CloudResource) =>
    namer.ref('aws_sns_topic', topic.id, topic.name, 'arn');
  const lambdaRef = (fn: CloudResource, attribute: string) =>
    namer.ref('aws_lambda_function', fn.id, fn.name, attribute);
  const fifoName = (resource: CloudResource, max: number) =>
    raw(
      `"\${var.project}-${dnsName(resource.name, max)}${resource.config.fifo === true ? '.fifo' : ''}"`,
    );
  for (const queue of ofType(SQS_TYPE)) {
    if (!gate('data.tf', queue)) continue;
    const key = kmsKeyOf(resources, queue);
    const dlq = deadLetterQueueOf(resources, queue);
    emit(
      'data.tf',
      [queue.id],
      block(
        'resource',
        ['aws_sqs_queue', namer.name('aws_sqs_queue', queue.id, queue.name)],
        [
          ...providerOf(queue),
          ...attr('name', fifoName(queue, 60)),
          ...(queue.config.fifo === true
            ? [
                ...attr('fifo_queue', true),
                ...attr('content_based_deduplication', true),
              ]
            : []),
          ...attr(
            'visibility_timeout_seconds',
            numOr(queue.config.visibilityTimeoutSec, 30),
          ),
          ...attr(
            'message_retention_seconds',
            numOr(queue.config.retentionDays, 4) * 86400,
          ),
          ...(key && ok(key)
            ? attr('kms_master_key_id', kmsRef(key))
            : attr('sqs_managed_sse_enabled', true)),
          ...(dlq
            ? attr(
                'redrive_policy',
                raw(
                  `jsonencode({ deadLetterTargetArn = ${queueRef(dlq).expr}, maxReceiveCount = ${numOr(queue.config.maxReceiveCount, 5)} })`,
                ),
              )
            : []),
          ...tagsOf(queue),
        ],
      ),
    );
  }

  const snsSources = new Map<string, CloudResource[]>();
  for (const topic of ofType(SNS_TYPE)) {
    if (!gate('data.tf', topic)) continue;
    const key = kmsKeyOf(resources, topic);
    const name = namer.name('aws_sns_topic', topic.id, topic.name);
    emit(
      'data.tf',
      [topic.id],
      block(
        'resource',
        ['aws_sns_topic', name],
        [
          ...providerOf(topic),
          ...attr('name', fifoName(topic, 200)),
          ...(topic.config.fifo === true
            ? [
                ...attr('fifo_topic', true),
                ...attr('content_based_deduplication', true),
              ]
            : []),
          ...(key && ok(key) ? attr('kms_master_key_id', kmsRef(key)) : []),
          ...tagsOf(topic),
        ],
      ),
    );
    for (const target of subscriptionsOf(resources, connections, topic)) {
      const lambda = target.type !== SQS_TYPE;
      const emitted = lambda
        ? namer.has('aws_lambda_function', target.id)
        : ok(target);
      // FIFO só fala com FIFO; a chave própria da fila é TODO (política da chave).
      const fifoMismatch =
        !lambda &&
        (topic.config.fifo === true) !== (target.config.fifo === true);
      if (!emitted || fifoMismatch) {
        const targetName = target.name;
        todo(
          'data.tf',
          topic,
          localized((x) => x.subscriptionBlocked(targetName)),
        );
        continue;
      }
      const queueKey = lambda ? undefined : kmsKeyOf(resources, target);
      if (queueKey) {
        const keyName = queueKey.name;
        todo(
          'data.tf',
          target,
          localized((x) => x.snsKms(keyName)),
        );
      }
      const sub = namer.name(
        'aws_sns_topic_subscription',
        `${topic.id}|${target.id}`,
        `${topic.name}_${target.name}`,
      );
      emit(
        'data.tf',
        [topic.id, target.id],
        block(
          'resource',
          ['aws_sns_topic_subscription', sub],
          [
            ...providerOf(topic),
            ...attr('topic_arn', raw(`aws_sns_topic.${name}.arn`)),
            ...attr('protocol', lambda ? 'lambda' : 'sqs'),
            ...attr(
              'endpoint',
              lambda ? lambdaRef(target, 'arn') : queueRef(target),
            ),
            ...(lambda ? [] : attr('raw_message_delivery', true)),
          ],
        ),
      );
      if (lambda)
        emit(
          'data.tf',
          [topic.id, target.id],
          block(
            'resource',
            ['aws_lambda_permission', sub],
            [
              ...providerOf(target),
              ...attr('statement_id', `AllowSNS-${dnsName(topic.name, 40)}`),
              ...attr('action', 'lambda:InvokeFunction'),
              ...attr('function_name', lambdaRef(target, 'function_name')),
              ...attr('principal', 'sns.amazonaws.com'),
              ...attr('source_arn', raw(`aws_sns_topic.${name}.arn`)),
            ],
          ),
        );
      else
        snsSources.set(target.id, [
          ...(snsSources.get(target.id) ?? []),
          topic,
        ]);
    }
  }
  // A fila só aceita mensagens dos tópicos que a assinam.
  for (const queue of ofType(SQS_TYPE)) {
    const topics = snsSources.get(queue.id);
    if (!topics) continue;
    const name = namer.name('aws_sqs_queue', queue.id, queue.name);
    emit(
      'data.tf',
      [queue.id, ...topics.map((t) => t.id)],
      block(
        'data',
        ['aws_iam_policy_document', `${name}_sns`],
        [
          block(
            'statement',
            [],
            [
              ...attr('actions', ['sqs:SendMessage']),
              ...attr('resources', [queueRef(queue)]),
              block(
                'principals',
                [],
                [
                  ...attr('type', 'Service'),
                  ...attr('identifiers', ['sns.amazonaws.com']),
                ],
              ),
              block(
                'condition',
                [],
                [
                  ...attr('test', 'ArnEquals'),
                  ...attr('variable', 'aws:SourceArn'),
                  ...attr('values', topics.map(topicRef)),
                ],
              ),
            ],
          ),
        ],
      ),
    );
    emit(
      'data.tf',
      [queue.id],
      block(
        'resource',
        ['aws_sqs_queue_policy', name],
        [
          ...providerOf(queue),
          ...attr('queue_url', queueRef(queue, 'id')),
          ...attr(
            'policy',
            raw(`data.aws_iam_policy_document.${name}_sns.json`),
          ),
        ],
      ),
    );
  }
  // Fila → Lambda: a função é disparada pelo serviço (event source mapping).
  for (const fn of ofType(LAMBDA_TYPE)) {
    if (!namer.has('aws_lambda_function', fn.id)) continue;
    for (const queue of queueTriggersOf(resources, connections, fn)) {
      if (!ok(queue)) continue;
      if (
        numOr(queue.config.visibilityTimeoutSec, 30) <
        numOr(fn.config.timeoutSec, 30)
      ) {
        const [queueName, fnName] = [queue.name, fn.name];
        todo(
          'data.tf',
          queue,
          localized((x) => x.triggerVisibility(queueName, fnName)),
        );
        continue;
      }
      emit(
        'data.tf',
        [queue.id, fn.id],
        block(
          'resource',
          [
            'aws_lambda_event_source_mapping',
            namer.name(
              'aws_lambda_event_source_mapping',
              `${queue.id}|${fn.id}`,
              `${queue.name}_${fn.name}`,
            ),
          ],
          [
            ...providerOf(fn),
            ...attr('event_source_arn', queueRef(queue)),
            ...attr('function_name', lambdaRef(fn, 'arn')),
            ...attr('batch_size', 10),
          ],
        ),
      );
    }
  }
}
