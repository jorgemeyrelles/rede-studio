import { isArmInstanceType } from '../../../catalog/awsInstances';
import { closest, VPC_TYPE } from '../../../network';
import type { CloudResource } from '../../../types';
import { readIdList } from '../../addressing';
import { LB_TARGET_TYPES, readConnectionConfig } from '../../connections';
import { parsePorts } from '../../security';
import {
  certificateCovers,
  certificateOf,
  dnsNameOf,
  pathPatternOf,
} from '../../edge';
import {
  APIGW_TYPE,
  apiRoutes,
  clusterOf,
  ECR_TYPE,
  ecrOf,
  ECS_CLUSTER_TYPE,
  ECS_SERVICE_TYPE,
  EKS_CLUSTER_TYPE,
  EKS_NODEGROUP_TYPE,
  LAMBDA_TYPE,
  lambdaInVpc,
} from '../../compute';
import { dataAccessOf } from '../../data';
import { logGroupOf } from '../../observability';
import { cognitoOf, readPermissions } from '../../secrets';
import {
  attr,
  block,
  quote,
  raw,
  Raw,
  type HclEntry,
  type HclValue,
} from '../hcl';
import { localized, tfSlug, dnsName } from '../shared';
import type { TfContext } from '../context';

/** Seção `compute.tf` do gerador. */
export function emitCompute(ctx: TfContext) {
  const {
    resources,
    connections,
    namer,
    get,
    ofType,
    str,
    numOr,
    emit,
    todo,
    regionAlias,
    regionCodeOf,
    providerOf,
    tagsOf,
    ok,
    gate,
    ref,
    subnetRefs,
    kmsAttr,
    certArnRef,
    sgRefs,
    sgAttr,
    logGroupRef,
    logGroupBlock,
    sourceArn,
    workloadRole,
    instanceProfile,
  } = ctx;

  // ── compute.tf ────────────────────────────────────────────────────────
  const AMI_FILTERS = {
    al2023_x86_64: 'al2023-ami-2023.*-x86_64',
    al2023_arm64: 'al2023-ami-2023.*-arm64',
    windows_2022: 'Windows_Server-2022-English-Full-Base-*',
  } as const;
  type AmiVariant = keyof typeof AMI_FILTERS;
  const amiOf = (resource: CloudResource): AmiVariant => {
    if (resource.config.os === 'windows') return 'windows_2022';
    return isArmInstanceType(resource.config.instanceType)
      ? 'al2023_arm64'
      : 'al2023_x86_64';
  };
  const amis = new Map<string, { variant: AmiVariant; host: CloudResource }>();
  const amiRef = (resource: CloudResource) => {
    const region = closest(resources, resource.id, 'aws.region');
    const alias = region ? regionAlias.get(region.id) : null;
    const variant = amiOf(resource);
    const name = alias ? `${variant}_${alias}` : variant;
    if (!amis.has(name)) amis.set(name, { variant, host: resource });
    return raw(`data.aws_ami.${name}.id`);
  };
  const computeTypes = ['aws.ec2', 'aws.asg'];
  // Primeiro as AMIs usadas (ficam no topo do arquivo).
  resources
    .filter((r) => computeTypes.includes(r.type) && ok(r))
    .forEach(amiRef);
  for (const [name, { variant, host }] of amis) {
    emit(
      'compute.tf',
      [],
      block(
        'data',
        ['aws_ami', name],
        [
          ...providerOf(host),
          ...attr('most_recent', true),
          ...attr('owners', ['amazon']),
          block(
            'filter',
            [],
            [
              ...attr('name', 'name'),
              ...attr('values', [AMI_FILTERS[variant]]),
            ],
          ),
        ],
      ),
    );
  }

  for (const ec2 of ofType('aws.ec2')) {
    if (!gate('compute.tf', ec2)) continue;
    const key = str(ec2.config.keyPair).trim();
    const profile = instanceProfile(ec2);
    emit(
      'compute.tf',
      [ec2.id],
      block(
        'resource',
        ['aws_instance', namer.name('aws_instance', ec2.id, ec2.name)],
        [
          ...providerOf(ec2),
          ...attr('ami', amiRef(ec2)),
          ...attr('instance_type', str(ec2.config.instanceType)),
          ...attr('subnet_id', ref.subnet(get(ec2.parentId)!)),
          ...(str(ec2.config.privateIp)
            ? attr('private_ip', str(ec2.config.privateIp))
            : []),
          ...attr('associate_public_ip_address', ec2.config.publicIp === true),
          ...sgAttr('vpc_security_group_ids', ec2),
          ...(key ? attr('key_name', key) : []),
          ...attr('monitoring', ec2.config.detailedMonitoring === true),
          ...(profile ? attr('iam_instance_profile', profile) : []),
          block(
            'root_block_device',
            [],
            [
              ...attr('volume_type', 'gp3'),
              ...attr('volume_size', numOr(ec2.config.ebsGb, 20)),
              ...attr('iops', numOr(ec2.config.ebsIops, 3000)),
              ...attr('throughput', numOr(ec2.config.ebsThroughput, 125)),
              ...attr('encrypted', true),
              ...kmsAttr('kms_key_id', ec2),
            ],
          ),
          ...tagsOf(ec2),
        ],
      ),
    );
  }

  // Load balancers: target group por porta das conexões de associação.
  const tgArnsFor = new Map<string, HclValue[]>();
  /** Target groups de cada serviço ECS (bloco `load_balancer` do serviço). */
  const ecsTargetsFor = new Map<string, { tg: string; port: number }[]>();
  for (const lb of [...ofType('aws.alb'), ...ofType('aws.nlb')]) {
    if (!gate('compute.tf', lb)) continue;
    const isAlb = lb.type === 'aws.alb';
    const lbName = namer.name('aws_lb', lb.id, lb.name);
    const vpc = closest(resources, lb.id, VPC_TYPE)!;
    emit(
      'compute.tf',
      [lb.id],
      block(
        'resource',
        ['aws_lb', lbName],
        [
          ...providerOf(lb),
          ...attr('name', dnsName(lb.name, 32)),
          ...attr('internal', lb.config.scheme === 'internal'),
          ...attr('load_balancer_type', isAlb ? 'application' : 'network'),
          ...attr('subnets', subnetRefs(readIdList(lb.config.subnetIds))),
          ...(isAlb ? sgAttr('security_groups', lb) : []),
          ...tagsOf(lb),
        ],
      ),
    );
    const links = connections.filter(
      (c) => c.source === lb.id && c.kind === 'association',
    );
    const byPort = new Map<
      number,
      { targets: CloudResource[]; protocols: Set<string> }
    >();
    /** Cada conexão válida: porta do destino e caminho (regra do listener no ALB). */
    const routes: { port: number; path: string }[] = [];
    for (const link of links) {
      const target = get(link.target);
      const config = readConnectionConfig(link);
      const range = parsePorts(config.ports);
      if (!ok(target) || !range || !LB_TARGET_TYPES.includes(target.type))
        continue;
      const group = byPort.get(range[0]) ?? {
        targets: [],
        protocols: new Set<string>(),
      };
      group.targets.push(target);
      group.protocols.add(config.protocol);
      byPort.set(range[0], group);
      routes.push({ port: range[0], path: pathPatternOf(link) });
    }
    // NLB: o protocolo do target group segue as conexões (UDP, TCP ou os dois).
    const tgProtocolOf = (protocols: Set<string>) =>
      isAlb
        ? null
        : protocols.has('udp') && protocols.has('tcp')
          ? 'TCP_UDP'
          : protocols.has('udp')
            ? 'UDP'
            : 'TCP';
    const tgs: { name: string; port: number; protocol: string | null }[] = [];
    for (const [port, { targets, protocols }] of byPort) {
      const tgName = namer.name(
        'aws_lb_target_group',
        `${lb.id}|${port}`,
        `${lbName}_${port}`,
      );
      tgs.push({ name: tgName, port, protocol: tgProtocolOf(protocols) });
      emit(
        'compute.tf',
        [lb.id, ...targets.map((x) => x.id)],
        block(
          'resource',
          ['aws_lb_target_group', tgName],
          [
            ...providerOf(lb),
            ...attr('name', dnsName(`${lb.name}-${port}`, 32)),
            ...attr('port', port),
            ...attr(
              'protocol',
              isAlb
                ? port === 443
                  ? 'HTTPS'
                  : 'HTTP'
                : tgProtocolOf(protocols)!,
            ),
            ...attr('vpc_id', ref.vpc(vpc)),
            // Fargate registra a tarefa pelo IP; EC2/ASG, pela instância.
            ...attr(
              'target_type',
              targets.some((x) => x.type === ECS_SERVICE_TYPE)
                ? 'ip'
                : 'instance',
            ),
            ...tagsOf(lb, `${lb.name}-${port}`),
          ],
        ),
      );
      for (const target of targets) {
        if (target.type === ECS_SERVICE_TYPE) {
          ecsTargetsFor.set(target.id, [
            ...(ecsTargetsFor.get(target.id) ?? []),
            { tg: tgName, port },
          ]);
          continue;
        }
        if (target.type === 'aws.asg') {
          tgArnsFor.set(target.id, [
            ...(tgArnsFor.get(target.id) ?? []),
            raw(`aws_lb_target_group.${tgName}.arn`),
          ]);
          continue;
        }
        emit(
          'compute.tf',
          [lb.id, target.id],
          block(
            'resource',
            [
              'aws_lb_target_group_attachment',
              namer.name(
                'aws_lb_target_group_attachment',
                `${tgName}|${target.id}`,
                `${tgName}_${target.name}`,
              ),
            ],
            [
              ...providerOf(lb),
              ...attr(
                'target_group_arn',
                raw(`aws_lb_target_group.${tgName}.arn`),
              ),
              ...attr('target_id', ref.instance(target)),
              ...attr('port', port),
            ],
          ),
        );
      }
    }
    const protocol =
      str(lb.config.listenerProtocol) || (isAlb ? 'HTTP' : 'TCP');
    const cert = certificateOf(resources, lb);
    const tls =
      (isAlb && protocol === 'HTTPS') || (!isAlb && protocol === 'TLS');
    const certArn = cert
      ? certArnRef(cert)
      : str(lb.config.certificateArn) || null;
    if (tls && !certArn) {
      todo(
        'compute.tf',
        lb,
        localized((x) => x.nlbTls),
      );
      continue;
    }
    if (!isAlb && tgs.length === 0) {
      todo(
        'compute.tf',
        lb,
        localized((x) => x.noTargets),
      );
      continue;
    }
    const tgOfPort = (port: number) => tgs.find((tg) => tg.port === port);
    // ALB: ação padrão = 1ª conexão sem caminho; as com caminho viram regras.
    // NLB: listener UDP só encaminha para UDP/TCP_UDP; TCP/TLS, para TCP/TCP_UDP.
    const forward = isAlb
      ? (tgOfPort(routes.find((r) => !r.path)?.port ?? -1) ?? tgs[0])
      : tgs.find(
          (tg) =>
            tg.protocol === 'TCP_UDP' ||
            tg.protocol === (protocol === 'UDP' ? 'UDP' : 'TCP'),
        );
    if (!isAlb && !forward) {
      todo(
        'compute.tf',
        lb,
        localized((x) => x.nlbNoCompatible(protocol)),
      );
      continue;
    }
    const pathRules = isAlb
      ? [
          ...new Map(
            routes
              .filter((r) => r.path)
              .map((r) => [`${r.path}|${r.port}`, r] as const),
          ).values(),
        ]
      : [];
    for (const tg of tgs) {
      if (tg === forward || pathRules.some((r) => r.port === tg.port)) continue;
      todo(
        'compute.tf',
        lb,
        localized((x) => x.lbPortUnused(tg.port, forward!.port)),
      );
    }
    const listenerName = namer.name('aws_lb_listener', lb.id, lbName);
    // Cognito (7B): cliente do user pool por ALB e login antes de encaminhar.
    const pool = isAlb && tls ? cognitoOf(resources, lb) : undefined;
    let authenticate: ((order: number, type: string) => HclEntry) | null = null;
    if (pool && ok(pool)) {
      const poolName = namer.name('aws_cognito_user_pool', pool.id, pool.name);
      const client = namer.name('aws_cognito_user_pool_client', lb.id, lb.name);
      const fqdn = dnsNameOf(resources, lb);
      emit(
        'compute.tf',
        [lb.id, pool.id],
        block(
          'resource',
          ['aws_cognito_user_pool_client', client],
          [
            ...providerOf(lb),
            ...attr('name', dnsName(lb.name, 128)),
            ...attr(
              'user_pool_id',
              raw(`aws_cognito_user_pool.${poolName}.id`),
            ),
            ...attr('generate_secret', true),
            ...attr('allowed_oauth_flows_user_pool_client', true),
            ...attr('allowed_oauth_flows', ['code']),
            ...attr('allowed_oauth_scopes', ['openid', 'email']),
            ...attr('supported_identity_providers', ['COGNITO']),
            ...attr('callback_urls', [
              ...(fqdn ? [`https://${fqdn}/oauth2/idpresponse`] : []),
              raw(
                `"https://\${${ref.lb(lb, 'dns_name').expr}}/oauth2/idpresponse"`,
              ),
            ]),
          ],
        ),
      );
      authenticate = (order, type) =>
        block(
          type,
          [],
          [
            ...attr('type', 'authenticate-cognito'),
            ...attr('order', order),
            block(
              'authenticate_cognito',
              [],
              [
                ...attr(
                  'user_pool_arn',
                  raw(`aws_cognito_user_pool.${poolName}.arn`),
                ),
                ...attr(
                  'user_pool_client_id',
                  raw(`aws_cognito_user_pool_client.${client}.id`),
                ),
                ...attr(
                  'user_pool_domain',
                  raw(`aws_cognito_user_pool_domain.${poolName}.domain`),
                ),
              ],
            ),
          ],
        );
    }
    /** Ação de encaminhar (com `order` quando vem depois do login). */
    const forwardTo = (type: string, tgName: string): HclEntry[] => [
      ...(authenticate ? [authenticate(1, type)] : []),
      block(
        type,
        [],
        [
          ...attr('type', 'forward'),
          ...(authenticate ? attr('order', 2) : []),
          ...attr('target_group_arn', raw(`aws_lb_target_group.${tgName}.arn`)),
        ],
      ),
    ];
    emit(
      'compute.tf',
      [lb.id],
      block(
        'resource',
        ['aws_lb_listener', listenerName],
        [
          ...providerOf(lb),
          ...attr('load_balancer_arn', ref.lb(lb)),
          ...attr('port', numOr(lb.config.listenerPort, tls ? 443 : 80)),
          ...attr('protocol', protocol),
          ...(tls
            ? attr('ssl_policy', 'ELBSecurityPolicy-TLS13-1-2-2021-06')
            : []),
          ...(tls && certArn ? attr('certificate_arn', certArn) : []),
          ...(forward
            ? forwardTo('default_action', forward.name)
            : [
                block(
                  'default_action',
                  [],
                  [
                    ...attr('type', 'fixed-response'),
                    block(
                      'fixed_response',
                      [],
                      [
                        ...attr('content_type', 'text/plain'),
                        ...attr('message_body', 'Not Found'),
                        ...attr('status_code', '404'),
                      ],
                    ),
                  ],
                ),
              ]),
        ],
      ),
    );
    pathRules.forEach((rule, index) => {
      const tg = tgOfPort(rule.port)!;
      emit(
        'compute.tf',
        [lb.id],
        block(
          'resource',
          [
            'aws_lb_listener_rule',
            namer.name(
              'aws_lb_listener_rule',
              `${lb.id}|${rule.path}|${rule.port}`,
              `${lbName}_${rule.path}`,
            ),
          ],
          [
            ...providerOf(lb),
            ...attr('listener_arn', raw(`aws_lb_listener.${listenerName}.arn`)),
            ...attr('priority', (index + 1) * 10),
            ...forwardTo('action', tg.name),
            block(
              'condition',
              [],
              [block('path_pattern', [], [...attr('values', [rule.path])])],
            ),
          ],
        ),
      );
    });
  }

  for (const asg of ofType('aws.asg')) {
    if (!gate('compute.tf', asg)) continue;
    const ltName = namer.name('aws_launch_template', asg.id, asg.name);
    const ltProfile = instanceProfile(asg);
    emit(
      'compute.tf',
      [asg.id],
      block(
        'resource',
        ['aws_launch_template', ltName],
        [
          ...providerOf(asg),
          ...attr('name_prefix', `${dnsName(asg.name, 100)}-`),
          ...attr('image_id', amiRef(asg)),
          ...attr('instance_type', str(asg.config.instanceType)),
          ...sgAttr('vpc_security_group_ids', asg),
          ...(ltProfile
            ? [block('iam_instance_profile', [], [...attr('name', ltProfile)])]
            : []),
          block(
            'monitoring',
            [],
            [...attr('enabled', asg.config.detailedMonitoring === true)],
          ),
          block(
            'block_device_mappings',
            [],
            [
              ...attr('device_name', '/dev/xvda'),
              block(
                'ebs',
                [],
                [
                  ...attr('volume_size', numOr(asg.config.ebsGb, 20)),
                  ...attr('volume_type', 'gp3'),
                  ...attr('encrypted', true),
                  ...kmsAttr('kms_key_id', asg),
                ],
              ),
            ],
          ),
          ...tagsOf(asg),
        ],
      ),
    );
    const tgs = tgArnsFor.get(asg.id) ?? [];
    emit(
      'compute.tf',
      [asg.id],
      block(
        'resource',
        [
          'aws_autoscaling_group',
          namer.name('aws_autoscaling_group', asg.id, asg.name),
        ],
        [
          ...providerOf(asg),
          ...attr('name', dnsName(asg.name, 255)),
          ...attr('min_size', numOr(asg.config.minSize, 1)),
          ...attr('max_size', numOr(asg.config.maxSize, 1)),
          ...attr('desired_capacity', numOr(asg.config.desiredSize, 1)),
          ...attr(
            'vpc_zone_identifier',
            subnetRefs(readIdList(asg.config.subnetIds)),
          ),
          ...(tgs.length ? attr('target_group_arns', tgs) : []),
          block(
            'launch_template',
            [],
            [
              ...attr('id', raw(`aws_launch_template.${ltName}.id`)),
              ...attr('version', '$Latest'),
            ],
          ),
          block(
            'tag',
            [],
            [
              ...attr('key', 'Name'),
              ...attr('value', asg.name),
              ...attr('propagate_at_launch', true),
            ],
          ),
        ],
      ),
    );
  }

  // ── compute.tf (7C1: ECR, Lambda, ECS, EKS, API Gateway) ───────────────
  for (const repo of ofType(ECR_TYPE)) {
    if (!gate('compute.tf', repo)) continue;
    emit(
      'compute.tf',
      [repo.id],
      block(
        'resource',
        [
          'aws_ecr_repository',
          namer.name('aws_ecr_repository', repo.id, repo.name),
        ],
        [
          ...providerOf(repo),
          ...attr('name', raw(`"\${var.project}-${dnsName(repo.name, 200)}"`)),
          ...attr(
            'image_tag_mutability',
            str(repo.config.tagMutability) || 'IMMUTABLE',
          ),
          block(
            'image_scanning_configuration',
            [],
            [...attr('scan_on_push', repo.config.scanOnPush !== false)],
          ),
          ...tagsOf(repo),
        ],
      ),
    );
  }

  const LAMBDA_HANDLERS: Record<string, string> = {
    'nodejs22.x': 'index.handler',
    'python3.13': 'app.handler',
    java21: 'example.Handler::handleRequest',
    dotnet8: 'Function::Function.Handler::FunctionHandler',
    'provided.al2023': 'bootstrap',
  };
  for (const fn of ofType(LAMBDA_TYPE)) {
    if (!gate('compute.tf', fn)) continue;
    const vpcAccess = lambdaInVpc(resources, fn);
    const role = workloadRole(fn, 'lambda.amazonaws.com', [
      vpcAccess
        ? {
            suffix: 'vpc',
            arn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole',
          }
        : {
            suffix: 'logs',
            arn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          },
    ]);
    const runtime = str(fn.config.runtime) || 'nodejs22.x';
    const zip = `lambda/${dnsName(fn.name, 60)}.zip`;
    todo(
      'compute.tf',
      fn,
      localized((x) => x.lambdaPackage(zip)),
    );
    emit(
      'compute.tf',
      [fn.id],
      block(
        'resource',
        [
          'aws_lambda_function',
          namer.name('aws_lambda_function', fn.id, fn.name),
        ],
        [
          ...providerOf(fn),
          ...attr(
            'function_name',
            raw(`"\${var.project}-${dnsName(fn.name, 50)}"`),
          ),
          ...attr('role', raw(`aws_iam_role.${role}.arn`)),
          ...attr('runtime', runtime),
          ...attr('handler', LAMBDA_HANDLERS[runtime] ?? 'index.handler'),
          ...attr('architectures', [str(fn.config.architecture) || 'arm64']),
          ...attr('memory_size', numOr(fn.config.memoryMb, 512)),
          ...attr('timeout', numOr(fn.config.timeoutSec, 30)),
          ...attr('filename', raw(`"\${path.module}/${zip}"`)),
          ...logGroupBlock(fn, (group) =>
            block(
              'logging_config',
              [],
              [
                ...attr('log_format', 'Text'),
                ...attr('log_group', logGroupRef(group, 'name')),
              ],
            ),
          ),
          ...(vpcAccess
            ? [
                block(
                  'vpc_config',
                  [],
                  [
                    ...attr(
                      'subnet_ids',
                      subnetRefs(readIdList(fn.config.subnetIds)),
                    ),
                    ...attr('security_group_ids', sgRefs(fn)),
                  ],
                ),
              ]
            : []),
          ...tagsOf(fn),
        ],
      ),
    );
  }

  for (const cluster of ofType(ECS_CLUSTER_TYPE)) {
    if (!gate('compute.tf', cluster)) continue;
    emit(
      'compute.tf',
      [cluster.id],
      block(
        'resource',
        [
          'aws_ecs_cluster',
          namer.name('aws_ecs_cluster', cluster.id, cluster.name),
        ],
        [
          ...providerOf(cluster),
          ...attr(
            'name',
            raw(`"\${var.project}-${dnsName(cluster.name, 200)}"`),
          ),
          block(
            'setting',
            [],
            [
              ...attr('name', 'containerInsights'),
              ...attr(
                'value',
                cluster.config.containerInsights === true
                  ? 'enabled'
                  : 'disabled',
              ),
            ],
          ),
          ...tagsOf(cluster),
        ],
      ),
    );
  }

  for (const svc of ofType(ECS_SERVICE_TYPE)) {
    if (!gate('compute.tf', svc)) continue;
    const cluster = clusterOf(resources, svc)!;
    const role = workloadRole(
      svc,
      'ecs-tasks.amazonaws.com',
      [
        {
          suffix: 'execution',
          arn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
        },
      ],
      'execucao',
    );
    // Role da tarefa (o app): só existe se o serviço fala com tabela/fila/tópico.
    const taskRole = dataAccessOf(resources, connections, svc).some((a) =>
      ok(a.target),
    )
      ? workloadRole(svc, 'ecs-tasks.amazonaws.com', [], 'tarefa')
      : null;
    const repo = ecrOf(resources, svc);
    const image = repo
      ? `"\${${namer.ref('aws_ecr_repository', repo.id, repo.name, 'repository_url').expr}}:latest"`
      : quote(str(svc.config.image));
    const port = numOr(svc.config.containerPort, 8080);
    // Segredos lidos viram variáveis do contêiner (injetadas pela role de execução).
    const reads = readPermissions(resources, svc);
    const secretEntries = [...reads.secrets, ...reads.parameters]
      .map((source) => {
        const arn = sourceArn(source);
        return arn
          ? `{ name = ${quote(tfSlug(source.name).toUpperCase())}, valueFrom = ${arn instanceof Raw ? arn.expr : String(arn)} }`
          : null;
      })
      .filter(Boolean);
    const svcGroup = logGroupOf(resources, svc);
    const container = [
      `name = "app"`,
      `image = ${image}`,
      `essential = true`,
      `portMappings = [{ containerPort = ${port}, protocol = "tcp" }]`,
      ...(secretEntries.length
        ? [`secrets = [${secretEntries.join(', ')}]`]
        : []),
      ...(svcGroup && ok(svcGroup)
        ? [
            `logConfiguration = { logDriver = "awslogs", options = { "awslogs-group" = ${logGroupRef(svcGroup, 'name').expr}, "awslogs-region" = "${regionCodeOf(svc)}", "awslogs-stream-prefix" = "app" } }`,
          ]
        : []),
    ].join(', ');
    const family = namer.name('aws_ecs_task_definition', svc.id, svc.name);
    emit(
      'compute.tf',
      [svc.id],
      block(
        'resource',
        ['aws_ecs_task_definition', family],
        [
          ...providerOf(svc),
          ...attr('family', raw(`"\${var.project}-${dnsName(svc.name, 200)}"`)),
          ...attr('requires_compatibilities', ['FARGATE']),
          ...attr('network_mode', 'awsvpc'),
          ...attr('cpu', String(Number(svc.config.cpu) || 512)),
          ...attr('memory', String(numOr(svc.config.memoryMb, 1024))),
          ...attr('execution_role_arn', raw(`aws_iam_role.${role}.arn`)),
          ...(taskRole
            ? attr('task_role_arn', raw(`aws_iam_role.${taskRole}.arn`))
            : []),
          ...attr(
            'container_definitions',
            raw(`jsonencode([{ ${container} }])`),
          ),
          block(
            'runtime_platform',
            [],
            [
              ...attr('operating_system_family', 'LINUX'),
              ...attr(
                'cpu_architecture',
                svc.config.architecture === 'x86_64' ? 'X86_64' : 'ARM64',
              ),
            ],
          ),
          ...tagsOf(svc),
        ],
      ),
    );
    const lbs = ecsTargetsFor.get(svc.id) ?? [];
    emit(
      'compute.tf',
      [svc.id, cluster.id],
      block(
        'resource',
        ['aws_ecs_service', namer.name('aws_ecs_service', svc.id, svc.name)],
        [
          ...providerOf(svc),
          ...attr('name', dnsName(svc.name, 255)),
          ...attr(
            'cluster',
            namer.ref('aws_ecs_cluster', cluster.id, cluster.name),
          ),
          ...attr(
            'task_definition',
            raw(`aws_ecs_task_definition.${family}.arn`),
          ),
          ...attr('desired_count', numOr(svc.config.desiredCount, 1)),
          ...attr('launch_type', 'FARGATE'),
          block(
            'network_configuration',
            [],
            [
              ...attr('subnets', subnetRefs(readIdList(svc.config.subnetIds))),
              ...attr('security_groups', sgRefs(svc)),
              ...attr('assign_public_ip', false),
            ],
          ),
          ...lbs.map(({ tg, port: tgPort }) =>
            block(
              'load_balancer',
              [],
              [
                ...attr(
                  'target_group_arn',
                  raw(`aws_lb_target_group.${tg}.arn`),
                ),
                ...attr('container_name', 'app'),
                ...attr('container_port', tgPort),
              ],
            ),
          ),
          ...tagsOf(svc),
        ],
      ),
    );
  }

  for (const cluster of ofType(EKS_CLUSTER_TYPE)) {
    if (!gate('compute.tf', cluster)) continue;
    const role = workloadRole(
      cluster,
      'eks.amazonaws.com',
      [
        {
          suffix: 'cluster',
          arn: 'arn:aws:iam::aws:policy/AmazonEKSClusterPolicy',
        },
      ],
      'cluster',
    );
    const access = str(cluster.config.endpointAccess) || 'both';
    const name = namer.name('aws_eks_cluster', cluster.id, cluster.name);
    emit(
      'compute.tf',
      [cluster.id],
      block(
        'resource',
        ['aws_eks_cluster', name],
        [
          ...providerOf(cluster),
          ...attr(
            'name',
            raw(`"\${var.project}-${dnsName(cluster.name, 80)}"`),
          ),
          ...attr('role_arn', raw(`aws_iam_role.${role}.arn`)),
          ...attr('version', str(cluster.config.version) || '1.34'),
          block(
            'vpc_config',
            [],
            [
              ...attr(
                'subnet_ids',
                subnetRefs(readIdList(cluster.config.subnetIds)),
              ),
              ...attr('endpoint_private_access', access !== 'public'),
              ...attr('endpoint_public_access', access !== 'private'),
            ],
          ),
          block(
            'access_config',
            [],
            [
              ...attr('authentication_mode', 'API'),
              ...attr('bootstrap_cluster_creator_admin_permissions', true),
            ],
          ),
          ...tagsOf(cluster),
          ...attr('depends_on', [
            raw(`aws_iam_role_policy_attachment.${role}_cluster`),
          ]),
        ],
      ),
    );
    for (const addon of [
      'vpc-cni',
      'kube-proxy',
      'coredns',
      'eks-pod-identity-agent',
    ])
      emit(
        'compute.tf',
        [cluster.id],
        block(
          'resource',
          ['aws_eks_addon', `${name}_${tfSlug(addon)}`],
          [
            ...providerOf(cluster),
            ...attr('cluster_name', raw(`aws_eks_cluster.${name}.name`)),
            ...attr('addon_name', addon),
          ],
        ),
      );
  }

  for (const group of ofType(EKS_NODEGROUP_TYPE)) {
    if (!gate('compute.tf', group)) continue;
    const cluster = clusterOf(resources, group)!;
    const role = workloadRole(
      group,
      'ec2.amazonaws.com',
      [
        {
          suffix: 'worker',
          arn: 'arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy',
        },
        { suffix: 'cni', arn: 'arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy' },
        {
          suffix: 'ecr',
          arn: 'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly',
        },
      ],
      'nos',
    );
    emit(
      'compute.tf',
      [group.id, cluster.id],
      block(
        'resource',
        [
          'aws_eks_node_group',
          namer.name('aws_eks_node_group', group.id, group.name),
        ],
        [
          ...providerOf(group),
          ...attr(
            'cluster_name',
            namer.ref('aws_eks_cluster', cluster.id, cluster.name, 'name'),
          ),
          ...attr('node_group_name', dnsName(group.name, 63)),
          ...attr('node_role_arn', raw(`aws_iam_role.${role}.arn`)),
          ...attr('subnet_ids', subnetRefs(readIdList(group.config.subnetIds))),
          ...attr('instance_types', [str(group.config.instanceType)]),
          ...attr(
            'capacity_type',
            str(group.config.capacityType) || 'ON_DEMAND',
          ),
          ...attr(
            'ami_type',
            isArmInstanceType(group.config.instanceType)
              ? 'AL2023_ARM_64_STANDARD'
              : 'AL2023_x86_64_STANDARD',
          ),
          ...attr('disk_size', numOr(group.config.diskGb, 20)),
          block(
            'scaling_config',
            [],
            [
              ...attr('desired_size', numOr(group.config.desiredSize, 2)),
              ...attr('max_size', numOr(group.config.maxSize, 4)),
              ...attr('min_size', numOr(group.config.minSize, 2)),
            ],
          ),
          ...tagsOf(group),
          ...attr('depends_on', [
            raw(`aws_iam_role_policy_attachment.${role}_worker`),
            raw(`aws_iam_role_policy_attachment.${role}_cni`),
            raw(`aws_iam_role_policy_attachment.${role}_ecr`),
          ]),
        ],
      ),
    );
  }

  // API Gateway HTTP: rotas = conexões que saem da API.
  const routeKey = (path: string) => {
    if (!path) return '$default';
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `ANY ${clean.replace(/\/\*$/, '/{proxy+}')}`;
  };
  for (const api of ofType(APIGW_TYPE)) {
    if (!gate('compute.tf', api)) continue;
    const name = namer.name('aws_apigatewayv2_api', api.id, api.name);
    const apiRef = (attribute: string) =>
      raw(`aws_apigatewayv2_api.${name}.${attribute}`);
    emit(
      'compute.tf',
      [api.id],
      block(
        'resource',
        ['aws_apigatewayv2_api', name],
        [
          ...providerOf(api),
          ...attr('name', raw(`"\${var.project}-${dnsName(api.name, 100)}"`)),
          ...attr('protocol_type', 'HTTP'),
          ...tagsOf(api),
        ],
      ),
    );
    emit(
      'compute.tf',
      [api.id],
      block(
        'resource',
        ['aws_apigatewayv2_stage', name],
        [
          ...providerOf(api),
          ...attr('api_id', apiRef('id')),
          ...attr('name', '$default'),
          ...attr('auto_deploy', true),
          ...logGroupBlock(api, (group) =>
            block(
              'access_log_settings',
              [],
              [
                ...attr('destination_arn', logGroupRef(group, 'arn')),
                ...attr(
                  'format',
                  raw(
                    'jsonencode({ requestId = "$context.requestId", ip = "$context.identity.sourceIp", routeKey = "$context.routeKey", status = "$context.status", latency = "$context.responseLatency" })',
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
    // Autorizador JWT do Cognito (cliente próprio da API).
    const pool = cognitoOf(resources, api);
    let authorizer: string | null = null;
    if (pool && ok(pool)) {
      const poolName = namer.name('aws_cognito_user_pool', pool.id, pool.name);
      const client = namer.name(
        'aws_cognito_user_pool_client',
        api.id,
        api.name,
      );
      emit(
        'compute.tf',
        [api.id, pool.id],
        block(
          'resource',
          ['aws_cognito_user_pool_client', client],
          [
            ...providerOf(api),
            ...attr('name', dnsName(api.name, 128)),
            ...attr(
              'user_pool_id',
              raw(`aws_cognito_user_pool.${poolName}.id`),
            ),
          ],
        ),
      );
      authorizer = namer.name('aws_apigatewayv2_authorizer', api.id, api.name);
      emit(
        'compute.tf',
        [api.id, pool.id],
        block(
          'resource',
          ['aws_apigatewayv2_authorizer', authorizer],
          [
            ...providerOf(api),
            ...attr('api_id', apiRef('id')),
            ...attr('authorizer_type', 'JWT'),
            ...attr('identity_sources', ['$request.header.Authorization']),
            ...attr('name', 'cognito'),
            block(
              'jwt_configuration',
              [],
              [
                ...attr('audience', [
                  raw(`aws_cognito_user_pool_client.${client}.id`),
                ]),
                ...attr(
                  'issuer',
                  raw(
                    `"https://\${aws_cognito_user_pool.${poolName}.endpoint}"`,
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    }
    const vpcLinks = new Map<string, string>();
    for (const { connection, target } of apiRoutes(
      resources,
      connections,
      api,
    )) {
      const path = pathPatternOf(connection);
      const key = `${api.id}|${connection.id}`;
      const integration = namer.name(
        'aws_apigatewayv2_integration',
        key,
        `${api.name}_${target.name}`,
      );
      if (target.type === LAMBDA_TYPE) {
        if (!namer.has('aws_lambda_function', target.id)) {
          todo(
            'compute.tf',
            api,
            localized((x) => x.routeTarget(target.name)),
          );
          continue;
        }
        const fn = namer.ref(
          'aws_lambda_function',
          target.id,
          target.name,
          'function_name',
        );
        emit(
          'compute.tf',
          [api.id, target.id],
          block(
            'resource',
            ['aws_apigatewayv2_integration', integration],
            [
              ...providerOf(api),
              ...attr('api_id', apiRef('id')),
              ...attr('integration_type', 'AWS_PROXY'),
              ...attr(
                'integration_uri',
                namer.ref(
                  'aws_lambda_function',
                  target.id,
                  target.name,
                  'invoke_arn',
                ),
              ),
              ...attr('payload_format_version', '2.0'),
            ],
          ),
        );
        emit(
          'compute.tf',
          [api.id, target.id],
          block(
            'resource',
            ['aws_lambda_permission', integration],
            [
              ...providerOf(api),
              ...attr(
                'statement_id',
                `AllowApiGateway-${dnsName(api.name, 40)}`,
              ),
              ...attr('action', 'lambda:InvokeFunction'),
              ...attr('function_name', fn),
              ...attr('principal', 'apigateway.amazonaws.com'),
              ...attr(
                'source_arn',
                raw(`"\${aws_apigatewayv2_api.${name}.execution_arn}/*/*"`),
              ),
            ],
          ),
        );
      } else {
        // ALB/NLB interno: VPC Link nas subnets do LB, com os SGs dele.
        if (!namer.has('aws_lb_listener', target.id)) {
          todo(
            'compute.tf',
            api,
            localized((x) => x.routeTarget(target.name)),
          );
          continue;
        }
        const vpc = closest(resources, target.id, VPC_TYPE)!;
        if (!vpcLinks.has(vpc.id)) {
          const link = namer.name(
            'aws_apigatewayv2_vpc_link',
            `${api.id}|${vpc.id}`,
            `${api.name}_${vpc.name}`,
          );
          vpcLinks.set(vpc.id, link);
          emit(
            'compute.tf',
            [api.id, target.id],
            block(
              'resource',
              ['aws_apigatewayv2_vpc_link', link],
              [
                ...providerOf(api),
                ...attr(
                  'name',
                  raw(`"\${var.project}-${dnsName(api.name, 60)}"`),
                ),
                ...attr(
                  'subnet_ids',
                  subnetRefs(readIdList(target.config.subnetIds)),
                ),
                ...attr('security_group_ids', sgRefs(target)),
              ],
            ),
          );
        }
        emit(
          'compute.tf',
          [api.id, target.id],
          block(
            'resource',
            ['aws_apigatewayv2_integration', integration],
            [
              ...providerOf(api),
              ...attr('api_id', apiRef('id')),
              ...attr('integration_type', 'HTTP_PROXY'),
              ...attr('integration_method', 'ANY'),
              ...attr(
                'integration_uri',
                namer.ref('aws_lb_listener', target.id, target.name, 'arn'),
              ),
              ...attr('connection_type', 'VPC_LINK'),
              ...attr(
                'connection_id',
                raw(`aws_apigatewayv2_vpc_link.${vpcLinks.get(vpc.id)}.id`),
              ),
            ],
          ),
        );
      }
      emit(
        'compute.tf',
        [api.id, target.id],
        block(
          'resource',
          ['aws_apigatewayv2_route', integration],
          [
            ...providerOf(api),
            ...attr('api_id', apiRef('id')),
            ...attr('route_key', routeKey(path)),
            ...attr(
              'target',
              raw(
                `"integrations/\${aws_apigatewayv2_integration.${integration}.id}"`,
              ),
            ),
            ...(authorizer
              ? [
                  ...attr('authorization_type', 'JWT'),
                  ...attr(
                    'authorizer_id',
                    raw(`aws_apigatewayv2_authorizer.${authorizer}.id`),
                  ),
                ]
              : []),
          ],
        ),
      );
    }
    // Domínio próprio: certificado da Região + mapeamento (o registro vai no edge.tf).
    const fqdn = dnsNameOf(resources, api);
    const cert = certificateOf(resources, api);
    if (fqdn && cert && ok(cert) && certificateCovers(cert, fqdn)) {
      const domain = namer.name(
        'aws_apigatewayv2_domain_name',
        api.id,
        api.name,
      );
      emit(
        'compute.tf',
        [api.id, cert.id],
        block(
          'resource',
          ['aws_apigatewayv2_domain_name', domain],
          [
            ...providerOf(api),
            ...attr('domain_name', fqdn),
            block(
              'domain_name_configuration',
              [],
              [
                ...attr('certificate_arn', certArnRef(cert)),
                ...attr('endpoint_type', 'REGIONAL'),
                ...attr('security_policy', 'TLS_1_2'),
              ],
            ),
          ],
        ),
      );
      emit(
        'compute.tf',
        [api.id],
        block(
          'resource',
          ['aws_apigatewayv2_api_mapping', name],
          [
            ...providerOf(api),
            ...attr('api_id', apiRef('id')),
            ...attr(
              'domain_name',
              raw(`aws_apigatewayv2_domain_name.${domain}.id`),
            ),
            ...attr('stage', raw(`aws_apigatewayv2_stage.${name}.id`)),
          ],
        ),
      );
    }
  }
}
