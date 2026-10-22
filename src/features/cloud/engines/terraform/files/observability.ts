import { getCatalogEntry } from '../../../catalog';
import { VPC_TYPE } from '../../../network';
import type { CloudResource } from '../../../types';
import { clusterOf } from '../../compute';
import {
  alarmsOf,
  alarmTopicOf,
  backupTargetsOf,
  BACKUP_TYPE,
  bucketOf,
  logGroupOf,
  LOG_GROUP_TYPE,
  TRAIL_TYPE,
  type AlarmSpec,
} from '../../observability';
import { kmsKeyOf } from '../../secrets';
import { attr, block, raw, type HclEntry, type HclValue } from '../hcl';
import { localized, tfSlug, dnsName, awsDescription } from '../shared';
import type { TfContext } from '../context';

/** Seção `observability.tf` do gerador. */
export function emitObservability(ctx: TfContext) {
  const {
    resources,
    connections,
    language,
    namer,
    get,
    ofType,
    str,
    numOr,
    emit,
    todo,
    regions,
    regionCodeOf,
    providerOf,
    tagsOf,
    ok,
    gate,
    ref,
    kmsAttr,
    logGroupRef,
    account,
    workloadRole,
  } = ctx;

  // ── observability.tf ──────────────────────────────────────────────────
  const keyPolicyTodo = (resource: CloudResource, service: string) => {
    const key = kmsKeyOf(resources, resource);
    if (!key || !ok(key)) return;
    const keyName = key.name;
    todo(
      'observability.tf',
      resource,
      localized((x) => x.keyPolicy(keyName, service)),
    );
  };
  const policyDocument = (name: string, statements: HclEntry[]) =>
    block('data', ['aws_iam_policy_document', name], statements);
  const serviceStatement = (
    service: string,
    actions: string[],
    resourcesList: HclValue[],
    condition?: { test: string; variable: string; values: HclValue[] },
  ) =>
    block(
      'statement',
      [],
      [
        ...attr('actions', actions),
        ...attr('resources', resourcesList),
        block(
          'principals',
          [],
          [...attr('type', 'Service'), ...attr('identifiers', [service])],
        ),
        ...(condition
          ? [
              block(
                'condition',
                [],
                [
                  ...attr('test', condition.test),
                  ...attr('variable', condition.variable),
                  ...attr('values', condition.values),
                ],
              ),
            ]
          : []),
      ],
    );

  for (const group of ofType(LOG_GROUP_TYPE)) {
    if (!gate('observability.tf', group)) continue;
    const retention = Number(group.config.retentionDays);
    emit(
      'observability.tf',
      [group.id],
      block(
        'resource',
        [
          'aws_cloudwatch_log_group',
          namer.name('aws_cloudwatch_log_group', group.id, group.name),
        ],
        [
          ...providerOf(group),
          ...attr(
            'name',
            raw(`"/\${var.project}/${dnsName(group.name, 200)}"`),
          ),
          ...(retention > 0 ? attr('retention_in_days', retention) : []),
          ...kmsAttr('kms_key_id', group),
          ...tagsOf(group),
        ],
      ),
    );
    keyPolicyTodo(group, `logs.${regionCodeOf(group)}.amazonaws.com`);
  }

  // Flow Logs: todo o tráfego da VPC para o grupo, com role de entrega.
  for (const vpc of ofType(VPC_TYPE)) {
    const group = logGroupOf(resources, vpc);
    if (vpc.config.flowLogs !== true || !group || !ok(vpc) || !ok(group))
      continue;
    const role = workloadRole(
      vpc,
      'vpc-flow-logs.amazonaws.com',
      [],
      'flowlogs',
      [
        block(
          'statement',
          [],
          [
            ...attr('actions', [
              'logs:CreateLogStream',
              'logs:PutLogEvents',
              'logs:DescribeLogStreams',
            ]),
            ...attr('resources', [
              raw(`"\${${logGroupRef(group, 'arn').expr}}:*"`),
            ]),
          ],
        ),
      ],
    );
    emit(
      'observability.tf',
      [vpc.id, group.id],
      block(
        'resource',
        ['aws_flow_log', namer.name('aws_flow_log', vpc.id, vpc.name)],
        [
          ...providerOf(vpc),
          ...attr('vpc_id', ref.vpc(vpc)),
          ...attr('traffic_type', 'ALL'),
          ...attr('log_destination', logGroupRef(group, 'arn')),
          ...attr('iam_role_arn', raw(`aws_iam_role.${role}.arn`)),
          ...tagsOf(vpc),
        ],
      ),
    );
  }

  // Alarmes padrão: dimensões pelo recurso Terraform já gerado.
  const alarmDimensions = (
    resource: CloudResource,
  ): Record<string, HclValue> | null => {
    const has = (tfType: string) => namer.has(tfType, resource.id);
    const r = (tfType: string, attribute: string) =>
      namer.ref(tfType, resource.id, resource.name, attribute);
    switch (resource.type) {
      case 'aws.ec2':
        return has('aws_instance')
          ? { InstanceId: r('aws_instance', 'id') }
          : null;
      case 'aws.asg':
        return has('aws_autoscaling_group')
          ? { AutoScalingGroupName: r('aws_autoscaling_group', 'name') }
          : null;
      case 'aws.alb':
        return has('aws_lb')
          ? { LoadBalancer: r('aws_lb', 'arn_suffix') }
          : null;
      case 'aws.rds':
        return has('aws_db_instance')
          ? { DBInstanceIdentifier: r('aws_db_instance', 'identifier') }
          : null;
      case 'aws.aurora':
        return has('aws_rds_cluster')
          ? { DBClusterIdentifier: r('aws_rds_cluster', 'cluster_identifier') }
          : null;
      case 'aws.ecs.service': {
        const cluster = clusterOf(resources, resource);
        return has('aws_ecs_service') && cluster
          ? {
              ClusterName: namer.ref(
                'aws_ecs_cluster',
                cluster.id,
                cluster.name,
                'name',
              ),
              ServiceName: r('aws_ecs_service', 'name'),
            }
          : null;
      }
      case 'aws.lambda':
        return has('aws_lambda_function')
          ? { FunctionName: r('aws_lambda_function', 'function_name') }
          : null;
      case 'aws.sqs.queue':
        return has('aws_sqs_queue')
          ? { QueueName: r('aws_sqs_queue', 'name') }
          : null;
      default:
        return null;
    }
  };
  for (const resource of resources) {
    const specs: AlarmSpec[] = alarmsOf(resource);
    if (!specs.length) continue;
    const dimensions = alarmDimensions(resource);
    if (!dimensions) continue;
    const topic = alarmTopicOf(resources, resource);
    const actions =
      topic && ok(topic)
        ? attr('alarm_actions', [
            namer.ref('aws_sns_topic', topic.id, topic.name, 'arn'),
          ])
        : [];
    for (const spec of specs)
      emit(
        'observability.tf',
        [resource.id],
        block(
          'resource',
          [
            'aws_cloudwatch_metric_alarm',
            namer.name(
              'aws_cloudwatch_metric_alarm',
              `${resource.id}|${spec.key}`,
              `${resource.name}_${spec.key}`,
            ),
          ],
          [
            ...providerOf(resource),
            ...attr(
              'alarm_name',
              raw(
                `"\${var.project}-${dnsName(resource.name, 180)}-${spec.key}"`,
              ),
            ),
            ...attr('alarm_description', awsDescription(spec.label[language])),
            ...attr('namespace', spec.namespace),
            ...attr('metric_name', spec.metric),
            ...attr('statistic', spec.statistic),
            ...attr('comparison_operator', spec.comparison),
            ...attr('threshold', spec.threshold(resource)),
            ...attr('evaluation_periods', spec.periods),
            ...attr('period', spec.period),
            ...attr('treat_missing_data', 'notBreaching'),
            ...actions,
            ...attr('dimensions', dimensions),
          ],
        ),
      );
    if (topic && ok(topic) && kmsKeyOf(resources, topic))
      keyPolicyTodo(topic, 'cloudwatch.amazonaws.com');
  }

  // Bucket policies de serviços (CloudTrail e Config somam no mesmo bucket).
  const bucketStatements = new Map<string, HclEntry[]>();
  let callerIdentity = false;
  const accountIdExpr = () => {
    if (!callerIdentity) {
      callerIdentity = true;
      emit(
        'observability.tf',
        [],
        block('data', ['aws_caller_identity', 'current'], []),
      );
    }
    return 'data.aws_caller_identity.current.account_id';
  };
  const grantBucket = (
    bucket: CloudResource,
    service: string,
    prefix: string,
    readActions: string[],
  ) => {
    const arn = namer.ref('aws_s3_bucket', bucket.id, bucket.name, 'arn');
    const list = bucketStatements.get(bucket.id) ?? [];
    list.push(
      serviceStatement(service, readActions, [arn]),
      serviceStatement(
        service,
        ['s3:PutObject'],
        [raw(`"\${${arn.expr}}/${prefix}/\${${accountIdExpr()}}/*"`)],
        {
          test: 'StringEquals',
          variable: 's3:x-amz-acl',
          values: ['bucket-owner-full-control'],
        },
      ),
    );
    bucketStatements.set(bucket.id, list);
  };

  for (const trail of ofType(TRAIL_TYPE)) {
    if (!gate('observability.tf', trail)) continue;
    const bucket = bucketOf(resources, trail)!;
    grantBucket(bucket, 'cloudtrail.amazonaws.com', 'AWSLogs', [
      's3:GetBucketAcl',
    ]);
    const group = logGroupOf(resources, trail);
    const role =
      group && ok(group)
        ? workloadRole(trail, 'cloudtrail.amazonaws.com', [], 'logs', [
            block(
              'statement',
              [],
              [
                ...attr('actions', [
                  'logs:CreateLogStream',
                  'logs:PutLogEvents',
                ]),
                ...attr('resources', [
                  raw(`"\${${logGroupRef(group, 'arn').expr}}:*"`),
                ]),
              ],
            ),
          ])
        : null;
    emit(
      'observability.tf',
      [trail.id, bucket.id],
      block(
        'resource',
        ['aws_cloudtrail', namer.name('aws_cloudtrail', trail.id, trail.name)],
        [
          ...providerOf(trail),
          ...attr('name', raw(`"\${var.project}-${dnsName(trail.name, 100)}"`)),
          ...attr(
            's3_bucket_name',
            namer.ref('aws_s3_bucket', bucket.id, bucket.name, 'id'),
          ),
          ...attr('is_multi_region_trail', true),
          ...attr('include_global_service_events', true),
          ...attr('enable_log_file_validation', true),
          ...kmsAttr('kms_key_id', trail),
          ...(group && role
            ? [
                ...attr(
                  'cloud_watch_logs_group_arn',
                  raw(`"\${${logGroupRef(group, 'arn').expr}}:*"`),
                ),
                ...attr(
                  'cloud_watch_logs_role_arn',
                  raw(`aws_iam_role.${role}.arn`),
                ),
              ]
            : []),
          ...(trail.config.dataEvents === true
            ? [
                block(
                  'event_selector',
                  [],
                  [
                    ...attr('read_write_type', 'All'),
                    ...attr('include_management_events', true),
                    block(
                      'data_resource',
                      [],
                      [
                        ...attr('type', 'AWS::S3::Object'),
                        ...attr('values', ['arn:aws:s3']),
                      ],
                    ),
                    block(
                      'data_resource',
                      [],
                      [
                        ...attr('type', 'AWS::Lambda::Function'),
                        ...attr('values', ['arn:aws:lambda']),
                      ],
                    ),
                  ],
                ),
              ]
            : []),
          ...tagsOf(trail),
          ...attr('depends_on', [
            raw(
              `aws_s3_bucket_policy.${namer.name('aws_s3_bucket_policy', bucket.id, bucket.name)}`,
            ),
          ]),
        ],
      ),
    );
    keyPolicyTodo(trail, 'cloudtrail.amazonaws.com');
  }

  // AWS Backup: cofre, plano, role do serviço e seleção dos alvos válidos.
  const backupArn = (target: CloudResource): HclValue | null => {
    const tfType =
      target.type === 'aws.rds'
        ? 'aws_db_instance'
        : target.type === 'aws.aurora'
          ? 'aws_rds_cluster'
          : target.type === 'aws.efs'
            ? 'aws_efs_file_system'
            : target.type === 'aws.dynamodb.table'
              ? 'aws_dynamodb_table'
              : 'aws_instance';
    return namer.has(tfType, target.id)
      ? namer.ref(tfType, target.id, target.name, 'arn')
      : null;
  };
  for (const plan of ofType(BACKUP_TYPE)) {
    if (!gate('observability.tf', plan)) continue;
    const name = namer.name('aws_backup_plan', plan.id, plan.name);
    const arns: HclValue[] = [];
    for (const target of backupTargetsOf(resources, plan)) {
      const arn = ok(target) ? backupArn(target) : null;
      if (arn) arns.push(arn);
      else {
        const targetName = target.name;
        todo(
          'observability.tf',
          plan,
          localized((x) => x.backupTargetSkipped(targetName)),
        );
      }
    }
    emit(
      'observability.tf',
      [plan.id],
      block(
        'resource',
        ['aws_backup_vault', name],
        [
          ...providerOf(plan),
          ...attr('name', raw(`"\${var.project}-${dnsName(plan.name, 40)}"`)),
          ...kmsAttr('kms_key_arn', plan),
          ...tagsOf(plan),
        ],
      ),
    );
    const weekly = plan.config.schedule === 'weekly';
    emit(
      'observability.tf',
      [plan.id],
      block(
        'resource',
        ['aws_backup_plan', name],
        [
          ...providerOf(plan),
          ...attr('name', raw(`"\${var.project}-${dnsName(plan.name, 40)}"`)),
          block(
            'rule',
            [],
            [
              ...attr('rule_name', weekly ? 'semanal' : 'diario'),
              ...attr(
                'target_vault_name',
                raw(`aws_backup_vault.${name}.name`),
              ),
              ...attr(
                'schedule',
                weekly ? 'cron(0 5 ? * SUN *)' : 'cron(0 5 * * ? *)',
              ),
              block(
                'lifecycle',
                [],
                [...attr('delete_after', numOr(plan.config.retentionDays, 35))],
              ),
            ],
          ),
          ...tagsOf(plan),
        ],
      ),
    );
    if (!arns.length) continue;
    const role = workloadRole(plan, 'backup.amazonaws.com', [
      {
        suffix: 'backup',
        arn: 'arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup',
      },
      {
        suffix: 'restore',
        arn: 'arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores',
      },
    ]);
    emit(
      'observability.tf',
      [plan.id],
      block(
        'resource',
        ['aws_backup_selection', name],
        [
          ...providerOf(plan),
          ...attr('name', dnsName(plan.name, 50)),
          ...attr('plan_id', raw(`aws_backup_plan.${name}.id`)),
          ...attr('iam_role_arn', raw(`aws_iam_role.${role}.arn`)),
          ...attr('resources', arns),
        ],
      ),
    );
  }

  // Governança da conta: GuardDuty, Security Hub e Config em cada Região.
  const governance = account?.config ?? {};
  if (account && ok(account)) {
    const configBucket = bucketOf(resources, account, 'configBucketId');
    const configIssue = getCatalogEntry('aws.account')?.validate?.(
      account,
      resources,
      connections,
    ).configBucketId;
    const configOk =
      governance.awsConfig === true &&
      configBucket !== undefined &&
      ok(configBucket) &&
      !configIssue;
    if (governance.awsConfig === true && !configOk)
      todo(
        'observability.tf',
        account,
        localized((x) => x.configNoBucket),
        'configBucketId',
      );
    let configRole: string | null = null;
    if (configOk) {
      grantBucket(configBucket!, 'config.amazonaws.com', 'AWSLogs', [
        's3:GetBucketAcl',
        's3:ListBucket',
      ]);
      configRole = workloadRole(
        account,
        'config.amazonaws.com',
        [
          {
            suffix: 'config',
            arn: 'arn:aws:iam::aws:policy/service-role/AWS_ConfigRole',
          },
        ],
        'config',
      );
    }
    regions.forEach((region, index) => {
      const code = tfSlug(str(region.config.region));
      if (governance.guardDuty === true)
        emit(
          'observability.tf',
          [account.id],
          block(
            'resource',
            ['aws_guardduty_detector', code],
            [...providerOf(region), ...attr('enable', true)],
          ),
        );
      if (governance.securityHub === true)
        emit(
          'observability.tf',
          [account.id],
          block(
            'resource',
            ['aws_securityhub_account', code],
            [...providerOf(region), ...attr('enable_default_standards', true)],
          ),
        );
      if (configOk && configRole) {
        emit(
          'observability.tf',
          [account.id],
          block(
            'resource',
            ['aws_config_configuration_recorder', code],
            [
              ...providerOf(region),
              ...attr('name', 'default'),
              ...attr('role_arn', raw(`aws_iam_role.${configRole}.arn`)),
              block(
                'recording_group',
                [],
                [
                  ...attr('all_supported', true),
                  // Recursos globais (IAM) só numa Região, para não duplicar itens.
                  ...attr('include_global_resource_types', index === 0),
                ],
              ),
            ],
          ),
        );
        emit(
          'observability.tf',
          [account.id],
          block(
            'resource',
            ['aws_config_delivery_channel', code],
            [
              ...providerOf(region),
              ...attr('name', 'default'),
              ...attr(
                's3_bucket_name',
                namer.ref(
                  'aws_s3_bucket',
                  configBucket!.id,
                  configBucket!.name,
                  'id',
                ),
              ),
              ...attr('depends_on', [
                raw(`aws_config_configuration_recorder.${code}`),
                raw(
                  `aws_s3_bucket_policy.${namer.name('aws_s3_bucket_policy', configBucket!.id, configBucket!.name)}`,
                ),
              ]),
            ],
          ),
        );
        emit(
          'observability.tf',
          [account.id],
          block(
            'resource',
            ['aws_config_configuration_recorder_status', code],
            [
              ...providerOf(region),
              ...attr(
                'name',
                raw(`aws_config_configuration_recorder.${code}.name`),
              ),
              ...attr('is_enabled', true),
              ...attr('depends_on', [
                raw(`aws_config_delivery_channel.${code}`),
              ]),
            ],
          ),
        );
      }
    });
  }

  for (const [bucketId, statements] of bucketStatements) {
    const bucket = get(bucketId)!;
    const name = namer.name('aws_s3_bucket_policy', bucket.id, bucket.name);
    emit(
      'observability.tf',
      [bucket.id],
      policyDocument(`${name}_servicos`, statements),
    );
    emit(
      'observability.tf',
      [bucket.id],
      block(
        'resource',
        ['aws_s3_bucket_policy', name],
        [
          ...providerOf(bucket),
          ...attr(
            'bucket',
            namer.ref('aws_s3_bucket', bucket.id, bucket.name, 'id'),
          ),
          ...attr(
            'policy',
            raw(`data.aws_iam_policy_document.${name}_servicos.json`),
          ),
        ],
      ),
    );
  }
}
