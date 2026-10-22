import { getCatalogEntry, type LocalizedText } from '../../catalog';
import { closest, isSubnet, VPC_TYPE } from '../../network';
import { effectiveTags } from '../../tags';
import type { CloudResource } from '../../types';
import { readIdList } from '../addressing';
import { securityGroupsOf } from '../connections';
import {
  certificateOf,
  GLOBAL_PROVIDER_REGION,
  isGlobal,
  validationZoneOf,
} from '../edge';
import { clusterOf, ecrOf } from '../compute';
import {
  AURORA_TYPE,
  dataAccessOf,
  dataKmsKeys,
  deadLetterQueueOf,
  DYNAMODB_TYPE,
  SQS_TYPE,
} from '../data';
import {
  alarmTopicOf,
  bucketOf,
  logGroupOf,
  TRAIL_TYPE,
} from '../observability';
import { igwOf } from '../routing';
import {
  cognitoOf,
  instancePermissions,
  readPermissions,
  kmsKeyOf,
  PARAMETER_TYPE,
  SECRET_TYPE,
} from '../secrets';
import {
  attr,
  block,
  comment,
  raw,
  Raw,
  type HclEntry,
  type HclValue,
} from './hcl';
import {
  type TerraformInput,
  type TerraformTodo,
  type FileName,
  BLOCKING_KEYS,
  T,
  localized,
  tfSlug,
  dnsName,
  Namer,
  type Chunk,
} from './shared';

/**
 * Estado e auxiliares compartilhados pelas seções do gerador (namer, chunks,
 * TODOs, bloqueios, referências, roles). Criado uma vez por `generateTerraform`.
 */
export function createContext(input: TerraformInput) {
  const { resources, connections, language } = input;
  const t = T[language] ?? T.pt;
  const namer = new Namer();
  const todos: TerraformTodo[] = [];
  const chunks: Record<FileName, Chunk[]> = {
    'providers.tf': [],
    'variables.tf': [],
    'iam.tf': [],
    'network.tf': [],
    'security.tf': [],
    'compute.tf': [],
    'data.tf': [],
    'edge.tf': [],
    'observability.tf': [],
    'outputs.tf': [],
  };
  const byId = new Map(resources.map((r) => [r.id, r]));
  const get = (id: string | null | undefined) =>
    id ? byId.get(id) : undefined;
  const ofType = (type: string) => resources.filter((r) => r.type === type);
  const str = (value: unknown) => (typeof value === 'string' ? value : '');
  const numOr = (value: unknown, fallback: number) =>
    typeof value === 'number' ? value : fallback;

  const emit = (
    file: FileName,
    resourceIds: string[],
    ...entries: HclEntry[]
  ) => chunks[file].push({ resourceIds, entries });
  const todo = (
    file: FileName,
    resource: CloudResource | null,
    message: LocalizedText,
    issueKey?: string,
  ) => {
    todos.push({
      resourceId: resource?.id ?? null,
      file,
      message,
      ...(issueKey ? { issueKey } : {}),
    });
    const who = resource ? `${resource.name} (${resource.type})` : 'projeto';
    emit(
      file,
      resource ? [resource.id] : [],
      comment(`TODO(rede-studio): ${who}: ${message[language]}`),
    );
  };

  // --- regiões e provider (a primeira é o provider padrão; as demais, alias)
  const regions = ofType('aws.region');
  const regionAlias = new Map(
    regions.map((r, i) => [
      r.id,
      i === 0 ? null : tfSlug(str(r.config.region)),
    ]),
  );
  const regionCodeOf = (resource: CloudResource) =>
    str(closest(resources, resource.id, 'aws.region')?.config.region);
  // Serviços globais rodam em us-east-1: usa a Região us-east-1 do projeto
  // ou cria (uma vez) o provider `aws.us_east_1`.
  const usEast1 = regions.find(
    (r) => str(r.config.region) === GLOBAL_PROVIDER_REGION,
  );
  let globalAliasEmitted = false;
  const globalProvider = (): HclEntry[] => {
    if (usEast1) {
      const alias = regionAlias.get(usEast1.id);
      return alias ? attr('provider', raw(`aws.${alias}`)) : [];
    }
    if (!globalAliasEmitted) {
      globalAliasEmitted = true;
      const accountId = str(ofType('aws.account')[0]?.config.accountId);
      emit(
        'providers.tf',
        [],
        block(
          'provider',
          ['aws'],
          [
            ...attr('alias', tfSlug(GLOBAL_PROVIDER_REGION)),
            ...attr('region', GLOBAL_PROVIDER_REGION),
            ...(/^\d{12}$/.test(accountId)
              ? attr('allowed_account_ids', [accountId])
              : []),
            block(
              'default_tags',
              [],
              [...attr('tags', raw('local.common_tags'))],
            ),
          ],
        ),
      );
    }
    return attr('provider', raw(`aws.${tfSlug(GLOBAL_PROVIDER_REGION)}`));
  };
  const providerOf = (resource: CloudResource): HclEntry[] => {
    if (isGlobal(resources, resource.id)) return globalProvider();
    const region = closest(resources, resource.id, 'aws.region');
    const alias = region ? regionAlias.get(region.id) : null;
    return alias ? attr('provider', raw(`aws.${alias}`)) : [];
  };

  /** `Name` + as tags que o elemento sobrescreve (as da conta vêm do default_tags). */
  const tagsOf = (
    resource: CloudResource,
    name = resource.name,
    extra: Record<string, string> = {},
  ): HclEntry[] => {
    const own: Record<string, HclValue> = { Name: name, ...extra };
    for (const tag of effectiveTags(resources, resource.id)) {
      if (!tag.inherited && tag.value && resource.type !== 'aws.account')
        own[tag.tag] = tag.value;
    }
    return attr('tags', own);
  };

  // --- o que pode virar recurso (problemas próprios + dependências)
  const blocking = new Map<string, LocalizedText | null>();
  const ownBlockingKey = (resource: CloudResource) => {
    const issues =
      getCatalogEntry(resource.type)?.validate?.(
        resource,
        resources,
        connections,
      ) ?? {};
    const key = BLOCKING_KEYS.find((k) => issues[k]);
    return key ? { key, message: issues[key]! } : null;
  };
  const ownIssue = (resource: CloudResource): LocalizedText | null =>
    ownBlockingKey(resource)?.message ?? null;
  const depsOf = (resource: CloudResource): string[] => {
    const deps: string[] = [];
    const parent = get(resource.parentId);
    if (parent && (parent.type === VPC_TYPE || isSubnet(parent)))
      deps.push(parent.id);
    if (isSubnet(resource)) {
      const vpc = closest(resources, resource.id, VPC_TYPE);
      if (vpc) deps.push(vpc.id);
      // A zona da AZ vai para `availability_zone`: AZ inválida bloqueia a subnet.
      if (resource.parentId) deps.push(resource.parentId);
    }
    deps.push(...readIdList(resource.config.subnetIds));
    // O listener (ou a distribuição) usa o ARN do certificado escolhido.
    const cert = certificateOf(resources, resource);
    if (cert) deps.push(cert.id);
    const key = kmsKeyOf(resources, resource);
    if (key) deps.push(key.id);
    const pool = cognitoOf(resources, resource);
    if (pool) deps.push(pool.id);
    const cluster = clusterOf(resources, resource);
    if (cluster) deps.push(cluster.id);
    const repo = ecrOf(resources, resource);
    if (repo) deps.push(repo.id);
    const dlq = deadLetterQueueOf(resources, resource);
    if (dlq) deps.push(dlq.id);
    const logGroup = logGroupOf(resources, resource);
    if (logGroup) deps.push(logGroup.id);
    if (resource.config.alarms === true) {
      const topic = alarmTopicOf(resources, resource);
      if (topic) deps.push(topic.id);
    }
    if (resource.type === TRAIL_TYPE) {
      const bucket = bucketOf(resources, resource);
      if (bucket) deps.push(bucket.id);
    }
    if (resource.type === 'aws.nat') {
      const vpc = closest(resources, resource.id, VPC_TYPE);
      const igw = vpc ? igwOf(resources, vpc.id) : undefined;
      if (igw) deps.push(igw.id);
    }
    return [...new Set(deps)];
  };
  const problemOf = (
    resource: CloudResource,
    seen = new Set<string>(),
  ): LocalizedText | null => {
    if (blocking.has(resource.id)) return blocking.get(resource.id)!;
    if (seen.has(resource.id)) return null;
    seen.add(resource.id);
    let problem = ownIssue(resource);
    if (!problem && resource.type === 'aws.nat') {
      const vpc = closest(resources, resource.id, VPC_TYPE);
      if (vpc && !igwOf(resources, vpc.id))
        problem = localized((x) => x.missingIgw);
    }
    if (!problem) {
      for (const depId of depsOf(resource)) {
        const dep = get(depId);
        if (dep && problemOf(dep, seen)) {
          const depName = dep.name;
          problem = localized((x) => x.dependsOn(depName));
          break;
        }
      }
    }
    blocking.set(resource.id, problem);
    return problem;
  };
  const ok = (resource: CloudResource | undefined): resource is CloudResource =>
    Boolean(resource && !problemOf(resource));
  /** Gera o recurso ou o TODO; devolve se gerou. */
  const gate = (file: FileName, resource: CloudResource) => {
    const problem = problemOf(resource);
    if (problem) todo(file, resource, problem, ownBlockingKey(resource)?.key);
    return !problem;
  };

  // Referências estáveis por elemento do rascunho.
  const ref = {
    vpc: (r: CloudResource) => namer.ref('aws_vpc', r.id, r.name),
    subnet: (r: CloudResource) => namer.ref('aws_subnet', r.id, r.name),
    igw: (r: CloudResource) => namer.ref('aws_internet_gateway', r.id, r.name),
    nat: (r: CloudResource) => namer.ref('aws_nat_gateway', r.id, r.name),
    sg: (r: CloudResource) => namer.ref('aws_security_group', r.id, r.name),
    instance: (r: CloudResource) => namer.ref('aws_instance', r.id, r.name),
    lb: (r: CloudResource, a = 'arn') => namer.ref('aws_lb', r.id, r.name, a),
  };
  const subnetRefs = (ids: string[]) => ids.map(get).filter(ok).map(ref.subnet);
  /** ARN da chave KMS escolhida, quando ela foi gerada. */
  const kmsRef = (key: CloudResource) =>
    namer.ref('aws_kms_key', key.id, key.name, 'arn');
  const kmsAttr = (attribute: string, resource: CloudResource): HclEntry[] => {
    const key = kmsKeyOf(resources, resource);
    return key && ok(key) ? attr(attribute, kmsRef(key)) : [];
  };
  /**
   * ARN do certificado para listener/distribuição: o validado (espera a
   * validação DNS) quando há zona do projeto que o valida; senão, o do
   * certificado (validação manual).
   */
  const certArnRef = (cert: CloudResource) => {
    const zone = validationZoneOf(resources, cert);
    return zone && ok(zone)
      ? namer.ref(
          'aws_acm_certificate_validation',
          cert.id,
          cert.name,
          'certificate_arn',
        )
      : namer.ref('aws_acm_certificate', cert.id, cert.name, 'arn');
  };
  const sgRefs = (resource: CloudResource) =>
    securityGroupsOf(resource).map(get).filter(ok).map(ref.sg);
  /** Lista de SGs só quando há algum (vazia, a AWS usa o SG padrão e o `plan` acusaria diferença). */
  const sgAttr = (key: string, resource: CloudResource) => {
    const refs = sgRefs(resource);
    return refs.length ? attr(key, refs) : [];
  };
  const logGroupRef = (group: CloudResource, attribute: string) =>
    namer.ref('aws_cloudwatch_log_group', group.id, group.name, attribute);
  /** Bloco que só existe quando o recurso escolheu um grupo de logs válido. */
  const logGroupBlock = (
    resource: CloudResource,
    make: (group: CloudResource) => HclEntry,
  ): HclEntry[] => {
    const group = logGroupOf(resources, resource);
    return group && ok(group) ? [make(group)] : [];
  };

  const account = ofType('aws.account')[0];
  const variable = (name: string, description: string, value: string) =>
    emit(
      'variables.tf',
      [],
      block(
        'variable',
        [name],
        [
          ...attr('description', description),
          ...attr('type', raw('string')),
          ...attr('default', value),
        ],
      ),
    );
  // ── iam.tf (roles das instâncias, 7B) ──────────────────────────────────
  /** ARN de quem a instância lê: segredo, parâmetro ou a senha mestre do RDS. */
  const sourceArn = (source: CloudResource): HclValue | null => {
    if (!ok(source)) return null;
    if (source.type === SECRET_TYPE)
      return namer.ref(
        'aws_secretsmanager_secret',
        source.id,
        source.name,
        'arn',
      );
    if (source.type === PARAMETER_TYPE)
      return namer.ref('aws_ssm_parameter', source.id, source.name, 'arn');
    if (source.type === AURORA_TYPE)
      return raw(
        `aws_rds_cluster.${namer.name('aws_rds_cluster', source.id, source.name)}.master_user_secret[0].secret_arn`,
      );
    return raw(
      `${namer.ref('aws_db_instance', source.id, source.name).expr.replace(/\.id$/, '')}.master_user_secret[0].secret_arn`,
    );
  };
  const DYNAMODB_ACTIONS = [
    'dynamodb:BatchGetItem',
    'dynamodb:BatchWriteItem',
    'dynamodb:ConditionCheckItem',
    'dynamodb:DeleteItem',
    'dynamodb:GetItem',
    'dynamodb:PutItem',
    'dynamodb:Query',
    'dynamodb:Scan',
    'dynamodb:UpdateItem',
  ];
  /** ARN da tabela, fila ou tópico. */
  const dataArn = (target: CloudResource) =>
    target.type === DYNAMODB_TYPE
      ? namer.ref('aws_dynamodb_table', target.id, target.name, 'arn')
      : target.type === SQS_TYPE
        ? namer.ref('aws_sqs_queue', target.id, target.name, 'arn')
        : namer.ref('aws_sns_topic', target.id, target.name, 'arn');
  /**
   * Role de uma carga com o mínimo: políticas gerenciadas pedidas + leitura
   * só nos segredos/parâmetros escolhidos (e decrypt nas chaves deles).
   * `suffix` separa várias roles do mesmo recurso (cluster/nós do EKS).
   * Devolve o nome Terraform da role.
   */
  const workloadRole = (
    resource: CloudResource,
    principal: string,
    managed: { suffix: string; arn: string }[],
    suffix = '',
    /** Declarações próprias do serviço (entrega de logs, por exemplo). */
    extra: HclEntry[] = [],
  ): string => {
    const name = suffix
      ? namer.name(
          'aws_iam_role',
          `${resource.id}|${suffix}`,
          `${resource.name}_${suffix}`,
        )
      : namer.name('aws_iam_role', resource.id, resource.name);
    const roleName = raw(
      `"\${var.project}-${dnsName(suffix ? `${resource.name}-${suffix}` : resource.name, 50)}"`,
    );
    emit(
      'iam.tf',
      [resource.id],
      block(
        'data',
        ['aws_iam_policy_document', `${name}_assume`],
        [
          block(
            'statement',
            [],
            [
              ...attr('actions', ['sts:AssumeRole']),
              block(
                'principals',
                [],
                [
                  ...attr('type', 'Service'),
                  ...attr('identifiers', [principal]),
                ],
              ),
            ],
          ),
        ],
      ),
    );
    emit(
      'iam.tf',
      [resource.id],
      block(
        'resource',
        ['aws_iam_role', name],
        [
          ...attr('name', roleName),
          ...attr(
            'assume_role_policy',
            raw(`data.aws_iam_policy_document.${name}_assume.json`),
          ),
          ...tagsOf(resource),
        ],
      ),
    );
    for (const policy of managed)
      emit(
        'iam.tf',
        [resource.id],
        block(
          'resource',
          ['aws_iam_role_policy_attachment', `${name}_${policy.suffix}`],
          [
            ...attr('role', raw(`aws_iam_role.${name}.name`)),
            ...attr('policy_arn', policy.arn),
          ],
        ),
      );
    const readsHere = !suffix || suffix === 'execucao';
    const dataHere = !suffix || suffix === 'tarefa';
    if (readsHere || dataHere || extra.length) {
      const reads = readsHere
        ? readPermissions(resources, resource)
        : { secrets: [], parameters: [], kmsKeys: [] };
      const secretArns = reads.secrets
        .map(sourceArn)
        .filter((a): a is HclValue => a !== null);
      const parameterArns = reads.parameters
        .map(sourceArn)
        .filter((a): a is HclValue => a !== null);
      const keyArns = reads.kmsKeys.filter(ok).map(kmsRef);
      const statement = (actions: string[], arns: HclValue[]) =>
        arns.length
          ? [
              block(
                'statement',
                [],
                [...attr('actions', actions), ...attr('resources', arns)],
              ),
            ]
          : [];
      // Dados e mensageria (7C parte 2): só as tabelas/filas/tópicos ligados.
      const access = dataHere
        ? dataAccessOf(resources, connections, resource).filter((a) =>
            ok(a.target),
          )
        : [];
      const arnsOf = (mode: string) =>
        access.filter((a) => a.mode === mode).map((a) => dataArn(a.target));
      const tables = arnsOf('readwrite');
      const dataStatements: HclEntry[] = [
        ...statement(DYNAMODB_ACTIONS, [
          ...tables,
          ...tables.map((arn) => raw(`"\${${(arn as Raw).expr}}/index/*"`)),
        ]),
        ...statement(
          ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'],
          arnsOf('send'),
        ),
        ...statement(['sns:Publish'], arnsOf('publish')),
        ...statement(
          [
            'sqs:ReceiveMessage',
            'sqs:DeleteMessage',
            'sqs:ChangeMessageVisibility',
            'sqs:GetQueueAttributes',
          ],
          arnsOf('consume'),
        ),
        ...statement(
          ['kms:Decrypt', 'kms:GenerateDataKey'],
          dataKmsKeys(resources, access).filter(ok).map(kmsRef),
        ),
      ];
      const statements: HclEntry[] = [
        ...statement(['secretsmanager:GetSecretValue'], secretArns),
        ...statement(['ssm:GetParameter', 'ssm:GetParameters'], parameterArns),
        ...statement(['kms:Decrypt'], keyArns),
        ...dataStatements,
        ...extra,
      ];
      if (statements.length) {
        emit(
          'iam.tf',
          [resource.id],
          block(
            'data',
            ['aws_iam_policy_document', `${name}_access`],
            statements,
          ),
        );
        emit(
          'iam.tf',
          [resource.id],
          block(
            'resource',
            ['aws_iam_role_policy', `${name}_access`],
            [
              ...attr(
                'name',
                dataStatements.length || extra.length
                  ? 'acesso-minimo'
                  : 'leitura-de-segredos',
              ),
              ...attr('role', raw(`aws_iam_role.${name}.id`)),
              ...attr(
                'policy',
                raw(`data.aws_iam_policy_document.${name}_access.json`),
              ),
            ],
          ),
        );
      }
    }
    return name;
  };

  /**
   * Role + instance profile da EC2/ASG (Session Manager e leituras). Devolve
   * o nome do profile, ou `null` se a instância não precisa de role.
   */
  const instanceProfile = (resource: CloudResource): HclValue | null => {
    const needs = instancePermissions(resources, resource, connections);
    if (!needs) return null;
    const name = workloadRole(
      resource,
      'ec2.amazonaws.com',
      needs.sessionManager
        ? [
            {
              suffix: 'ssm',
              arn: 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore',
            },
          ]
        : [],
    );
    const profile = namer.name(
      'aws_iam_instance_profile',
      resource.id,
      resource.name,
    );
    emit(
      'iam.tf',
      [resource.id],
      block(
        'resource',
        ['aws_iam_instance_profile', profile],
        [
          ...attr(
            'name',
            raw(`"\${var.project}-${dnsName(resource.name, 50)}"`),
          ),
          ...attr('role', raw(`aws_iam_role.${name}.name`)),
        ],
      ),
    );
    return raw(`aws_iam_instance_profile.${profile}.name`);
  };

  const zoneRef = (zone: CloudResource, attribute = 'zone_id') =>
    namer.ref('aws_route53_zone', zone.id, zone.name, attribute);
  const cfRef = (cf: CloudResource, attribute: string) =>
    namer.ref('aws_cloudfront_distribution', cf.id, cf.name, attribute);

  return {
    input,
    resources,
    connections,
    language,
    t,
    namer,
    todos,
    chunks,
    byId,
    get,
    ofType,
    str,
    numOr,
    emit,
    todo,
    regions,
    regionAlias,
    regionCodeOf,
    usEast1,
    globalProvider,
    providerOf,
    tagsOf,
    blocking,
    ownBlockingKey,
    ownIssue,
    depsOf,
    problemOf,
    ok,
    gate,
    ref,
    subnetRefs,
    kmsRef,
    kmsAttr,
    certArnRef,
    sgRefs,
    sgAttr,
    logGroupRef,
    logGroupBlock,
    account,
    variable,
    sourceArn,
    DYNAMODB_ACTIONS,
    dataArn,
    workloadRole,
    instanceProfile,
    zoneRef,
    cfRef,
  };
}

export type TfContext = ReturnType<typeof createContext>;
