import { closest, isSubnet } from '../../../network';
import type { CloudResource } from '../../../types';
import { derivedSgRules } from '../../connections';
import {
  parsePorts,
  readNaclRules,
  readSgRules,
  PL_PEER_PREFIX,
  PREFIX_LISTS,
  SG_PEER_PREFIX,
  type SgRule,
} from '../../security';
import {
  COGNITO_TYPE,
  KMS_TYPE,
  PARAMETER_TYPE,
  SECRET_TYPE,
} from '../../secrets';
import { attr, block, raw, type HclEntry } from '../hcl';
import { localized, dnsName, awsDescription } from '../shared';
import type { TfContext } from '../context';

/** Seção `security.tf` do gerador. */
export function emitSecurity(ctx: TfContext) {
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
    regionAlias,
    providerOf,
    tagsOf,
    ok,
    gate,
    ref,
    kmsAttr,
  } = ctx;

  // ── security.tf ───────────────────────────────────────────────────────
  const protocolPorts = (
    protocol: SgRule['protocol'],
    ports: string,
  ): HclEntry[] | null => {
    if (protocol === 'all') return attr('ip_protocol', '-1');
    if (protocol === 'icmp')
      return [
        ...attr('ip_protocol', 'icmp'),
        ...attr('from_port', -1),
        ...attr('to_port', -1),
      ];
    const range = parsePorts(ports);
    if (!range) return null;
    return [
      ...attr('ip_protocol', protocol),
      ...attr('from_port', range[0]),
      ...attr('to_port', range[1]),
    ];
  };
  /** Prefix list gerenciada (ex.: CloudFront), lida uma vez por região. */
  const prefixLists = new Set<string>();
  const prefixListRef = (sg: CloudResource, peer: string) => {
    const region = closest(resources, sg.id, 'aws.region');
    const alias = region ? regionAlias.get(region.id) : null;
    const name = `${peer.slice(PL_PEER_PREFIX.length)}${alias ? `_${alias}` : ''}`;
    if (!prefixLists.has(name)) {
      prefixLists.add(name);
      emit(
        'security.tf',
        [],
        block(
          'data',
          ['aws_ec2_managed_prefix_list', name],
          [...providerOf(sg), ...attr('name', PREFIX_LISTS[peer].awsName)],
        ),
      );
    }
    return raw(`data.aws_ec2_managed_prefix_list.${name}.id`);
  };

  const sgRule = (
    sg: CloudResource,
    rule: SgRule,
    key: string,
    resourceIds: string[],
  ) => {
    const proto = protocolPorts(rule.protocol, rule.ports);
    let peer: HclEntry[] | null = null;
    if (rule.peer.startsWith(SG_PEER_PREFIX)) {
      const other = get(rule.peer.slice(SG_PEER_PREFIX.length));
      if (ok(other)) peer = attr('referenced_security_group_id', ref.sg(other));
    } else if (PREFIX_LISTS[rule.peer]) {
      peer = attr('prefix_list_id', prefixListRef(sg, rule.peer));
    } else if (rule.peer.includes(':')) {
      peer = attr('cidr_ipv6', rule.peer);
    } else if (/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(rule.peer.trim())) {
      peer = attr('cidr_ipv4', rule.peer.trim());
    }
    if (!proto || !peer) {
      todo(
        'security.tf',
        sg,
        localized(
          (x) =>
            `${rule.description || rule.ports || rule.protocol}: ${x.ruleInvalid}`,
        ),
      );
      return;
    }
    const tfType =
      rule.direction === 'ingress'
        ? 'aws_vpc_security_group_ingress_rule'
        : 'aws_vpc_security_group_egress_rule';
    const base = `${sg.name}_${rule.direction === 'ingress' ? 'in' : 'out'}_${rule.protocol === 'all' ? 'all' : rule.ports || rule.protocol}`;
    emit(
      'security.tf',
      resourceIds,
      block(
        'resource',
        [tfType, namer.name(tfType, key, base)],
        [
          ...providerOf(sg),
          ...attr('security_group_id', ref.sg(sg)),
          ...proto,
          ...peer,
          ...(rule.description
            ? attr('description', awsDescription(rule.description))
            : []),
        ],
      ),
    );
  };

  const derived = derivedSgRules(resources, connections);
  for (const sg of ofType('aws.security_group')) {
    if (!gate('security.tf', sg)) continue;
    const vpc = get(sg.parentId)!;
    emit(
      'security.tf',
      [sg.id],
      block(
        'resource',
        [
          'aws_security_group',
          namer.name('aws_security_group', sg.id, sg.name),
        ],
        [
          ...providerOf(sg),
          // Prefixo do projeto: a AWS recusa nome de SG começando com `sg-`.
          ...attr('name', raw(`"\${var.project}-${dnsName(sg.name, 200)}"`)),
          ...attr(
            'description',
            awsDescription(str(sg.config.description)) || t.sgDefault,
          ),
          ...attr('vpc_id', ref.vpc(vpc)),
          ...tagsOf(sg),
        ],
      ),
    );
  }
  for (const sg of ofType('aws.security_group').filter(ok)) {
    for (const rule of readSgRules(sg))
      sgRule(sg, rule, `${sg.id}|${rule.id}`, [sg.id]);
    for (const d of derived.filter((x) => x.sgId === sg.id)) {
      const connection = connections.find((c) => c.id === d.connectionId);
      sgRule(sg, d.rule, d.rule.id, [
        sg.id,
        ...(connection ? [connection.source, connection.target] : []),
      ]);
    }
  }

  for (const nacl of ofType('aws.nacl')) {
    if (!gate('security.tf', nacl)) continue;
    const vpc = get(nacl.parentId)!;
    const name = namer.name('aws_network_acl', nacl.id, nacl.name);
    const subnets = resources.filter(
      (r) => isSubnet(r) && r.config.naclId === nacl.id && ok(r),
    );
    emit(
      'security.tf',
      [nacl.id, ...subnets.map((s) => s.id)],
      block(
        'resource',
        ['aws_network_acl', name],
        [
          ...providerOf(nacl),
          ...attr('vpc_id', ref.vpc(vpc)),
          ...attr('subnet_ids', subnets.map(ref.subnet)),
          ...tagsOf(nacl),
        ],
      ),
    );
    for (const rule of readNaclRules(nacl)) {
      const range = parsePorts(rule.ports);
      const needsPorts = rule.protocol === 'tcp' || rule.protocol === 'udp';
      if (
        (needsPorts && !range) ||
        !/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(rule.cidr.trim())
      ) {
        todo(
          'security.tf',
          nacl,
          localized((x) => `${rule.number}: ${x.ruleInvalid}`),
        );
        continue;
      }
      emit(
        'security.tf',
        [nacl.id],
        block(
          'resource',
          [
            'aws_network_acl_rule',
            namer.name(
              'aws_network_acl_rule',
              `${nacl.id}|${rule.id}`,
              `${name}_${rule.direction}_${rule.number}`,
            ),
          ],
          [
            ...providerOf(nacl),
            ...attr('network_acl_id', raw(`aws_network_acl.${name}.id`)),
            ...attr('rule_number', rule.number),
            ...attr('egress', rule.direction === 'egress'),
            ...attr('protocol', rule.protocol === 'all' ? '-1' : rule.protocol),
            ...attr('rule_action', rule.action),
            ...attr('cidr_block', rule.cidr.trim()),
            ...(needsPorts && range
              ? [...attr('from_port', range[0]), ...attr('to_port', range[1])]
              : []),
            ...(rule.protocol === 'icmp'
              ? [...attr('icmp_type', -1), ...attr('icmp_code', -1)]
              : []),
          ],
        ),
      );
    }
  }

  // Chaves KMS, segredos, parâmetros e Cognito (7B).
  for (const key of ofType(KMS_TYPE)) {
    if (!gate('security.tf', key)) continue;
    const name = namer.name('aws_kms_key', key.id, key.name);
    emit(
      'security.tf',
      [key.id],
      block(
        'resource',
        ['aws_kms_key', name],
        [
          ...providerOf(key),
          ...attr('description', awsDescription(key.name)),
          ...attr('enable_key_rotation', key.config.rotation !== false),
          ...attr(
            'deletion_window_in_days',
            numOr(key.config.deletionWindowDays, 30),
          ),
          ...tagsOf(key),
        ],
      ),
    );
    emit(
      'security.tf',
      [key.id],
      block(
        'resource',
        ['aws_kms_alias', name],
        [
          ...providerOf(key),
          ...attr(
            'name',
            raw(`"alias/\${var.project}-${dnsName(key.name, 200)}"`),
          ),
          ...attr('target_key_id', raw(`aws_kms_key.${name}.key_id`)),
        ],
      ),
    );
  }
  for (const secret of ofType(SECRET_TYPE)) {
    if (!gate('security.tf', secret)) continue;
    todo(
      'security.tf',
      secret,
      localized((x) => x.secretValue),
    );
    if (secret.config.rotation === true)
      todo(
        'security.tf',
        secret,
        localized((x) => x.secretRotation),
      );
    emit(
      'security.tf',
      [secret.id],
      block(
        'resource',
        [
          'aws_secretsmanager_secret',
          namer.name('aws_secretsmanager_secret', secret.id, secret.name),
        ],
        [
          ...providerOf(secret),
          ...attr(
            'name',
            raw(`"\${var.project}/${dnsName(secret.name, 200)}"`),
          ),
          ...(str(secret.config.description)
            ? attr(
                'description',
                awsDescription(str(secret.config.description)),
              )
            : []),
          ...kmsAttr('kms_key_id', secret),
          ...tagsOf(secret),
        ],
      ),
    );
  }
  for (const parameter of ofType(PARAMETER_TYPE)) {
    if (!gate('security.tf', parameter)) continue;
    const secure = parameter.config.valueType === 'SecureString';
    emit(
      'security.tf',
      [parameter.id],
      block(
        'resource',
        [
          'aws_ssm_parameter',
          namer.name('aws_ssm_parameter', parameter.id, parameter.name),
        ],
        [
          ...providerOf(parameter),
          ...attr('name', str(parameter.config.path)),
          ...attr('type', str(parameter.config.valueType) || 'String'),
          ...attr('tier', str(parameter.config.tier) || 'Standard'),
          // Placeholder: o valor real é gravado depois e o Terraform não o sobrescreve.
          ...attr('value', 'CHANGE_ME'),
          ...(secure ? kmsAttr('key_id', parameter) : []),
          ...tagsOf(parameter),
          block('lifecycle', [], [...attr('ignore_changes', [raw('value')])]),
        ],
      ),
    );
  }
  for (const pool of ofType(COGNITO_TYPE)) {
    if (!gate('security.tf', pool)) continue;
    const name = namer.name('aws_cognito_user_pool', pool.id, pool.name);
    const mfa = str(pool.config.mfa) || 'OPTIONAL';
    emit(
      'security.tf',
      [pool.id],
      block(
        'resource',
        ['aws_cognito_user_pool', name],
        [
          ...providerOf(pool),
          ...attr('name', raw(`"\${var.project}-${dnsName(pool.name, 100)}"`)),
          ...attr('user_pool_tier', str(pool.config.plan) || 'ESSENTIALS'),
          ...attr('username_attributes', ['email']),
          ...attr('auto_verified_attributes', ['email']),
          ...attr('mfa_configuration', mfa),
          ...(mfa === 'OFF'
            ? []
            : [
                block(
                  'software_token_mfa_configuration',
                  [],
                  [...attr('enabled', true)],
                ),
              ]),
          ...tagsOf(pool),
        ],
      ),
    );
    emit(
      'security.tf',
      [pool.id],
      block(
        'resource',
        ['aws_cognito_user_pool_domain', name],
        [
          ...providerOf(pool),
          ...attr('domain', raw(`"\${var.project}-${dnsName(pool.name, 40)}"`)),
          ...attr('user_pool_id', raw(`aws_cognito_user_pool.${name}.id`)),
        ],
      ),
    );
  }
}
