import type { CloudResource } from '../../../types';
import { readIdList } from '../../addressing';
import { readConnectionConfig } from '../../connections';
import { parsePorts } from '../../security';
import {
  certificateCovers,
  certificateOf,
  CLOUDFRONT_TYPE,
  cloudfrontOrigins,
  dnsNameOf,
  isValidRecordName,
  pathPatternOf,
  validationZoneOf,
  wafOf,
  wafRuleGroups,
  wafScopeOf,
  ZONE_TYPE,
  ACM_TYPE,
  WAF_TYPE,
  zoneOf,
} from '../../edge';
import { APIGW_TYPE } from '../../compute';
import { attr, block, raw, type HclEntry, type HclValue } from '../hcl';
import { localized, dnsName, awsDescription } from '../shared';
import type { TfContext } from '../context';

/** Seção `edge.tf` do gerador. */
export function emitEdge(ctx: TfContext) {
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
    regionCodeOf,
    providerOf,
    tagsOf,
    problemOf,
    ok,
    gate,
    ref,
    certArnRef,
    account,
    zoneRef,
    cfRef,
  } = ctx;

  // ── edge.tf ───────────────────────────────────────────────────────────
  const wafRef = (waf: CloudResource) =>
    namer.ref('aws_wafv2_web_acl', waf.id, waf.name, 'arn');
  const visibility = (metric: string) =>
    block(
      'visibility_config',
      [],
      [
        ...attr('cloudwatch_metrics_enabled', true),
        ...attr('metric_name', metric),
        ...attr('sampled_requests_enabled', true),
      ],
    );

  // Zonas DNS (globais; zona privada associada às VPCs, com a região delas).
  for (const zone of ofType(ZONE_TYPE)) {
    if (!gate('edge.tf', zone)) continue;
    const vpcs = readIdList(zone.config.vpcIds).map(get).filter(ok);
    emit(
      'edge.tf',
      [zone.id],
      block(
        'resource',
        [
          'aws_route53_zone',
          namer.name('aws_route53_zone', zone.id, zone.name),
        ],
        [
          ...providerOf(zone),
          ...attr('name', str(zone.config.domain).toLowerCase()),
          ...(zone.config.private === true
            ? vpcs.map((vpc) =>
                block(
                  'vpc',
                  [],
                  [
                    ...attr('vpc_id', ref.vpc(vpc)),
                    ...attr('vpc_region', regionCodeOf(vpc)),
                  ],
                ),
              )
            : []),
          ...tagsOf(zone),
        ],
      ),
    );
  }

  // Certificados ACM, com a validação DNS quando há zona do projeto.
  for (const cert of ofType(ACM_TYPE)) {
    if (!gate('edge.tf', cert)) continue;
    const name = namer.name('aws_acm_certificate', cert.id, cert.name);
    const alternatives = readIdList(cert.config.alternativeNames)
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean);
    emit(
      'edge.tf',
      [cert.id],
      block(
        'resource',
        ['aws_acm_certificate', name],
        [
          ...providerOf(cert),
          ...attr('domain_name', str(cert.config.domain).toLowerCase()),
          ...(alternatives.length
            ? attr('subject_alternative_names', alternatives)
            : []),
          ...attr('validation_method', 'DNS'),
          ...tagsOf(cert),
          block('lifecycle', [], [...attr('create_before_destroy', true)]),
        ],
      ),
    );
    const zone = validationZoneOf(resources, cert);
    if (!zone || !ok(zone)) {
      todo(
        'edge.tf',
        cert,
        localized((x) => x.certManual),
      );
      continue;
    }
    const recordName = namer.name(
      'aws_route53_record',
      `${cert.id}|validation`,
      `${cert.name}_validation`,
    );
    emit(
      'edge.tf',
      [cert.id, zone.id],
      block(
        'resource',
        ['aws_route53_record', recordName],
        [
          ...providerOf(zone),
          ...attr(
            'for_each',
            raw(
              [
                '{',
                `  for dvo in aws_acm_certificate.${name}.domain_validation_options : dvo.domain_name => {`,
                '    name   = dvo.resource_record_name',
                '    record = dvo.resource_record_value',
                '    type   = dvo.resource_record_type',
                '  }',
                '}',
              ].join('\n'),
            ),
          ),
          ...attr('allow_overwrite', true),
          ...attr('name', raw('each.value.name')),
          ...attr('records', [raw('each.value.record')]),
          ...attr('ttl', 60),
          ...attr('type', raw('each.value.type')),
          ...attr('zone_id', zoneRef(zone)),
        ],
      ),
    );
    emit(
      'edge.tf',
      [cert.id],
      block(
        'resource',
        [
          'aws_acm_certificate_validation',
          namer.name('aws_acm_certificate_validation', cert.id, cert.name),
        ],
        [
          ...providerOf(cert),
          ...attr('certificate_arn', raw(`aws_acm_certificate.${name}.arn`)),
          ...attr(
            'validation_record_fqdns',
            raw(
              `[for record in aws_route53_record.${recordName} : record.fqdn]`,
            ),
          ),
        ],
      ),
    );
  }

  // Web ACLs (escopo pelo container: Região = REGIONAL, Global = CLOUDFRONT).
  for (const waf of ofType(WAF_TYPE)) {
    if (!gate('edge.tf', waf)) continue;
    const metric = dnsName(waf.name, 100);
    const rate = numOr(waf.config.rateLimit, 0);
    const rules: HclEntry[] = [];
    if (rate > 0) {
      rules.push(
        block(
          'rule',
          [],
          [
            ...attr('name', 'rate-limit'),
            ...attr('priority', 0),
            block('action', [], [block('block', [], [])]),
            block(
              'statement',
              [],
              [
                block(
                  'rate_based_statement',
                  [],
                  [...attr('limit', rate), ...attr('aggregate_key_type', 'IP')],
                ),
              ],
            ),
            visibility(`${metric}-rate-limit`),
          ],
        ),
      );
    }
    wafRuleGroups(waf).forEach((group, index) => {
      rules.push(
        block(
          'rule',
          [],
          [
            ...attr('name', group),
            ...attr('priority', (index + 1) * 10),
            block('override_action', [], [block('none', [], [])]),
            block(
              'statement',
              [],
              [
                block(
                  'managed_rule_group_statement',
                  [],
                  [...attr('name', group), ...attr('vendor_name', 'AWS')],
                ),
              ],
            ),
            visibility(
              `${metric}-${dnsName(group.replace(/^AWSManagedRules/, ''), 60)}`,
            ),
          ],
        ),
      );
    });
    emit(
      'edge.tf',
      [waf.id],
      block(
        'resource',
        [
          'aws_wafv2_web_acl',
          namer.name('aws_wafv2_web_acl', waf.id, waf.name),
        ],
        [
          ...providerOf(waf),
          ...attr('name', raw(`"\${var.project}-${dnsName(waf.name, 100)}"`)),
          ...attr('scope', wafScopeOf(resources, waf)),
          block('default_action', [], [block('allow', [], [])]),
          ...rules,
          visibility(metric),
          ...tagsOf(waf),
        ],
      ),
    );
  }

  // WAF regional nos ALBs (o CloudFront recebe o ARN na própria distribuição).
  for (const lb of ofType('aws.alb').filter(ok)) {
    const waf = wafOf(resources, lb);
    if (!waf || !ok(waf)) continue;
    emit(
      'edge.tf',
      [lb.id, waf.id],
      block(
        'resource',
        [
          'aws_wafv2_web_acl_association',
          namer.name('aws_wafv2_web_acl_association', lb.id, lb.name),
        ],
        [
          ...providerOf(lb),
          ...attr('resource_arn', ref.lb(lb)),
          ...attr('web_acl_arn', wafRef(waf)),
        ],
      ),
    );
  }

  // CloudFront: origens = conexões que saem da distribuição.
  const cachePolicies = new Set<string>();
  const managedPolicy = (
    dataType: string,
    name: string,
    awsName: string,
    cf: CloudResource,
  ) => {
    if (!cachePolicies.has(`${dataType}.${name}`)) {
      cachePolicies.add(`${dataType}.${name}`);
      emit(
        'edge.tf',
        [],
        block(
          'data',
          [dataType, name],
          [...providerOf(cf), ...attr('name', awsName)],
        ),
      );
    }
    return raw(`data.${dataType}.${name}.id`);
  };
  /** Distribuições que servem cada bucket (para a bucket policy do OAC). */
  const bucketReaders = new Map<string, CloudResource[]>();
  for (const cf of ofType(CLOUDFRONT_TYPE)) {
    if (!gate('edge.tf', cf)) continue;
    const origins = cloudfrontOrigins(resources, connections, cf).filter(
      ({ origin }) => {
        if (!problemOf(origin)) return true;
        todo(
          'edge.tf',
          cf,
          localized((x) => x.originBlocked(origin.name)),
        );
        return false;
      },
    );
    const defaultOrigin =
      origins.find(({ connection }) => !pathPatternOf(connection)) ?? undefined;
    if (!defaultOrigin) {
      todo(
        'edge.tf',
        cf,
        localized((x) => x.noOrigin),
      );
      continue;
    }
    const name = namer.name('aws_cloudfront_distribution', cf.id, cf.name);
    const originId = (origin: CloudResource) => dnsName(origin.name, 60);
    const originBlocks: HclEntry[] = [];
    const seen = new Set<string>();
    for (const { origin, connection } of origins) {
      if (seen.has(origin.id)) continue;
      seen.add(origin.id);
      if (origin.type === 'aws.s3') {
        const oac = namer.name(
          'aws_cloudfront_origin_access_control',
          origin.id,
          origin.name,
        );
        if (!bucketReaders.has(origin.id)) {
          emit(
            'edge.tf',
            [origin.id],
            block(
              'resource',
              ['aws_cloudfront_origin_access_control', oac],
              [
                ...providerOf(cf),
                ...attr(
                  'name',
                  raw(`"\${var.project}-${dnsName(origin.name, 50)}"`),
                ),
                ...attr('origin_access_control_origin_type', 's3'),
                ...attr('signing_behavior', 'always'),
                ...attr('signing_protocol', 'sigv4'),
              ],
            ),
          );
        }
        bucketReaders.set(origin.id, [
          ...(bucketReaders.get(origin.id) ?? []),
          cf,
        ]);
        originBlocks.push(
          block(
            'origin',
            [],
            [
              ...attr(
                'domain_name',
                namer.ref(
                  'aws_s3_bucket',
                  origin.id,
                  origin.name,
                  'bucket_regional_domain_name',
                ),
              ),
              ...attr('origin_id', originId(origin)),
              ...attr(
                'origin_access_control_id',
                raw(`aws_cloudfront_origin_access_control.${oac}.id`),
              ),
            ],
          ),
        );
        continue;
      }
      // ALB, NLB ou EC2: origem "custom" (HTTPS se a conexão é 443 ou o listener é TLS).
      const port =
        parsePorts(readConnectionConfig(connection).ports)?.[0] ?? 443;
      const listener = str(origin.config.listenerProtocol);
      const https = port === 443 || listener === 'HTTPS' || listener === 'TLS';
      const fqdn = dnsNameOf(resources, origin);
      const domain = fqdn
        ? fqdn
        : origin.type === 'aws.ec2'
          ? ref.instance(origin) &&
            namer.ref('aws_instance', origin.id, origin.name, 'public_dns')
          : ref.lb(origin, 'dns_name');
      if (https && !fqdn && origin.type !== 'aws.ec2') {
        todo(
          'edge.tf',
          cf,
          localized((x) => x.originTls(origin.name)),
        );
      }
      originBlocks.push(
        block(
          'origin',
          [],
          [
            ...attr('domain_name', domain),
            ...attr('origin_id', originId(origin)),
            block(
              'custom_origin_config',
              [],
              [
                ...attr('http_port', https ? 80 : port),
                ...attr('https_port', https ? port : 443),
                ...attr(
                  'origin_protocol_policy',
                  https ? 'https-only' : 'http-only',
                ),
                ...attr('origin_ssl_protocols', ['TLSv1.2']),
              ],
            ),
          ],
        ),
      );
    }
    const behavior = (origin: CloudResource): HclEntry[] => {
      const isS3 = origin.type === 'aws.s3';
      return [
        ...attr(
          'allowed_methods',
          isS3
            ? ['GET', 'HEAD']
            : ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
        ),
        ...attr('cached_methods', ['GET', 'HEAD']),
        ...attr('target_origin_id', originId(origin)),
        ...attr('viewer_protocol_policy', 'redirect-to-https'),
        ...attr('compress', true),
        ...attr(
          'cache_policy_id',
          isS3
            ? managedPolicy(
                'aws_cloudfront_cache_policy',
                'caching_optimized',
                'Managed-CachingOptimized',
                cf,
              )
            : managedPolicy(
                'aws_cloudfront_cache_policy',
                'caching_disabled',
                'Managed-CachingDisabled',
                cf,
              ),
        ),
        ...(isS3
          ? []
          : attr(
              'origin_request_policy_id',
              managedPolicy(
                'aws_cloudfront_origin_request_policy',
                'all_viewer_except_host',
                'Managed-AllViewerExceptHostHeader',
                cf,
              ),
            )),
      ];
    };
    const ordered: HclEntry[] = [];
    for (const { origin, connection } of origins) {
      const path = pathPatternOf(connection);
      if (connection === defaultOrigin.connection) continue;
      if (!path) {
        todo(
          'edge.tf',
          cf,
          localized((x) => x.pathMissing(origin.name)),
        );
        continue;
      }
      ordered.push(
        block(
          'ordered_cache_behavior',
          [],
          [...attr('path_pattern', path), ...behavior(origin)],
        ),
      );
    }
    const fqdn = dnsNameOf(resources, cf);
    const cert = certificateOf(resources, cf);
    const waf = wafOf(resources, cf);
    const rootObject = str(cf.config.defaultRootObject);
    emit(
      'edge.tf',
      [cf.id, ...origins.map((o) => o.origin.id)],
      block(
        'resource',
        ['aws_cloudfront_distribution', name],
        [
          ...providerOf(cf),
          ...attr('enabled', true),
          ...attr('is_ipv6_enabled', true),
          ...attr('comment', awsDescription(cf.name)),
          ...attr('price_class', str(cf.config.priceClass) || 'PriceClass_All'),
          ...(defaultOrigin.origin.type === 'aws.s3' && rootObject
            ? attr('default_root_object', rootObject)
            : []),
          ...(fqdn && cert && certificateCovers(cert, fqdn)
            ? attr('aliases', [fqdn])
            : []),
          ...(waf && ok(waf) ? attr('web_acl_id', wafRef(waf)) : []),
          ...originBlocks,
          block('default_cache_behavior', [], behavior(defaultOrigin.origin)),
          ...ordered,
          block(
            'restrictions',
            [],
            [
              block(
                'geo_restriction',
                [],
                [...attr('restriction_type', 'none')],
              ),
            ],
          ),
          block(
            'viewer_certificate',
            [],
            cert && ok(cert)
              ? [
                  ...attr('acm_certificate_arn', certArnRef(cert)),
                  ...attr('ssl_support_method', 'sni-only'),
                  ...attr('minimum_protocol_version', 'TLSv1.2_2021'),
                ]
              : [...attr('cloudfront_default_certificate', true)],
          ),
          ...tagsOf(cf),
        ],
      ),
    );
  }

  // Bucket policy do OAC: só as distribuições do projeto leem o bucket.
  for (const [bucketId, readers] of bucketReaders) {
    const bucket = get(bucketId)!;
    const policyName = namer.name(
      'aws_iam_policy_document',
      `${bucket.id}|cloudfront`,
      `${bucket.name}_cloudfront`,
    );
    emit(
      'edge.tf',
      [bucket.id, ...readers.map((r) => r.id)],
      block(
        'data',
        ['aws_iam_policy_document', policyName],
        [
          block(
            'statement',
            [],
            [
              ...attr('actions', ['s3:GetObject']),
              ...attr('resources', [
                raw(
                  `"\${${namer.ref('aws_s3_bucket', bucket.id, bucket.name, 'arn').expr}}/*"`,
                ),
              ]),
              block(
                'principals',
                [],
                [
                  ...attr('type', 'Service'),
                  ...attr('identifiers', ['cloudfront.amazonaws.com']),
                ],
              ),
              block(
                'condition',
                [],
                [
                  ...attr('test', 'StringEquals'),
                  ...attr('variable', 'AWS:SourceArn'),
                  ...attr(
                    'values',
                    readers.map((r) => cfRef(r, 'arn')),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
    emit(
      'edge.tf',
      [bucket.id],
      block(
        'resource',
        [
          'aws_s3_bucket_policy',
          namer.name('aws_s3_bucket_policy', bucket.id, bucket.name),
        ],
        [
          ...providerOf(bucket),
          ...attr(
            'bucket',
            namer.ref('aws_s3_bucket', bucket.id, bucket.name, 'id'),
          ),
          ...attr(
            'policy',
            raw(`data.aws_iam_policy_document.${policyName}.json`),
          ),
        ],
      ),
    );
  }

  // Registros alias: CloudFront (A e AAAA), ALB e NLB.
  const publishable = [
    ...ofType(CLOUDFRONT_TYPE),
    ...ofType('aws.alb'),
    ...ofType('aws.nlb'),
    ...ofType(APIGW_TYPE),
  ];
  for (const target of publishable) {
    const zone = zoneOf(resources, target);
    if (!zone || !ok(zone) || !ok(target)) continue;
    if (!isValidRecordName(target.config.dnsRecord)) {
      todo(
        'edge.tf',
        target,
        localized((x) => x.recordInvalid),
      );
      continue;
    }
    const fqdn = dnsNameOf(resources, target)!;
    const isCf = target.type === CLOUDFRONT_TYPE;
    const isApi = target.type === APIGW_TYPE;
    if (isApi && !namer.has('aws_apigatewayv2_domain_name', target.id))
      continue;
    if (isCf && !namer.has('aws_cloudfront_distribution', target.id)) continue;
    // CloudFront sem certificado para o nome não ganha o alias (ver validate).
    if (
      isCf &&
      !(
        certificateOf(resources, target) &&
        certificateCovers(certificateOf(resources, target)!, fqdn)
      )
    )
      continue;
    for (const type of isCf ? ['A', 'AAAA'] : ['A']) {
      emit(
        'edge.tf',
        [target.id, zone.id],
        block(
          'resource',
          [
            'aws_route53_record',
            namer.name(
              'aws_route53_record',
              `${target.id}|${type}`,
              `${target.name}_${type}`,
            ),
          ],
          [
            ...providerOf(zone),
            ...attr('zone_id', zoneRef(zone)),
            ...attr('name', fqdn),
            ...attr('type', type),
            block(
              'alias',
              [],
              isCf
                ? [
                    ...attr('name', cfRef(target, 'domain_name')),
                    ...attr('zone_id', cfRef(target, 'hosted_zone_id')),
                    ...attr('evaluate_target_health', false),
                  ]
                : isApi
                  ? [
                      ...attr(
                        'name',
                        raw(
                          `${namer.ref('aws_apigatewayv2_domain_name', target.id, target.name).expr.replace(/\.id$/, '')}.domain_name_configuration[0].target_domain_name`,
                        ),
                      ),
                      ...attr(
                        'zone_id',
                        raw(
                          `${namer.ref('aws_apigatewayv2_domain_name', target.id, target.name).expr.replace(/\.id$/, '')}.domain_name_configuration[0].hosted_zone_id`,
                        ),
                      ),
                      ...attr('evaluate_target_health', false),
                    ]
                  : [
                      ...attr('name', ref.lb(target, 'dns_name')),
                      ...attr('zone_id', ref.lb(target, 'zone_id')),
                      ...attr('evaluate_target_health', true),
                    ],
            ),
          ],
        ),
      );
    }
  }

  // Shield Advanced: proteções (a assinatura é um compromisso feito no console).
  if (account?.config.shieldAdvanced === true) {
    todo(
      'edge.tf',
      account,
      localized((x) => x.shieldSubscription),
    );
    const protect = (resource: CloudResource, arn: HclValue) =>
      emit(
        'edge.tf',
        [resource.id],
        block(
          'resource',
          [
            'aws_shield_protection',
            namer.name('aws_shield_protection', resource.id, resource.name),
          ],
          [
            ...providerOf(resource),
            ...attr(
              'name',
              raw(`"\${var.project}-${dnsName(resource.name, 100)}"`),
            ),
            ...attr('resource_arn', arn),
          ],
        ),
      );
    for (const cf of ofType(CLOUDFRONT_TYPE).filter(ok)) {
      if (namer.has('aws_cloudfront_distribution', cf.id))
        protect(cf, cfRef(cf, 'arn'));
    }
    for (const lb of ofType('aws.alb').filter(ok)) {
      if (lb.config.scheme !== 'internal') protect(lb, ref.lb(lb));
    }
    for (const zone of ofType(ZONE_TYPE).filter(ok)) {
      if (zone.config.private !== true) protect(zone, zoneRef(zone, 'arn'));
    }
  }
}
