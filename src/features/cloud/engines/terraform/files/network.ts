import {
  azsOf,
  cidrOf,
  closest,
  isSubnet,
  subnetTier,
  VPC_TYPE,
} from '../../../network';
import { readIdList } from '../../addressing';
import { EKS_CLUSTER_TYPE } from '../../compute';
import { logGroupOf } from '../../observability';
import { deriveRouteTables, igwOf } from '../../routing';
import { INTERFACE_ENDPOINT_TYPE } from '../../secrets';
import { attr, block, raw, type HclValue } from '../hcl';
import { localized } from '../shared';
import type { TfContext } from '../context';

/** Seção `network.tf` do gerador. */
export function emitNetwork(ctx: TfContext) {
  const {
    resources,
    namer,
    get,
    ofType,
    str,
    emit,
    todo,
    regionCodeOf,
    providerOf,
    tagsOf,
    ok,
    gate,
    ref,
    subnetRefs,
    sgAttr,
  } = ctx;

  // ── network.tf ────────────────────────────────────────────────────────
  for (const vpc of ofType(VPC_TYPE)) {
    if (!gate('network.tf', vpc)) continue;
    const region = regionCodeOf(vpc);
    emit(
      'network.tf',
      [vpc.id],
      block(
        'resource',
        ['aws_vpc', namer.name('aws_vpc', vpc.id, vpc.name)],
        [
          ...providerOf(vpc),
          ...attr('cidr_block', cidrOf(vpc)),
          ...attr('enable_dns_support', vpc.config.enableDnsSupport !== false),
          ...attr(
            'enable_dns_hostnames',
            vpc.config.enableDnsHostnames !== false,
          ),
          ...attr(
            'instance_tenancy',
            str(vpc.config.instanceTenancy) || 'default',
          ),
          ...tagsOf(vpc),
        ],
      ),
    );
    if (vpc.config.flowLogs === true && !logGroupOf(resources, vpc))
      todo(
        'network.tf',
        vpc,
        localized((x) => x.flowLogs),
        'flowLogs',
      );

    const eksInVpc = resources.some(
      (r) => r.type === EKS_CLUSTER_TYPE && r.parentId === vpc.id,
    );
    for (const az of azsOf(resources, vpc.id)) {
      for (const subnet of resources.filter(
        (r) => isSubnet(r) && r.parentId === az.id,
      )) {
        if (!gate('network.tf', subnet)) continue;
        emit(
          'network.tf',
          [subnet.id],
          block(
            'resource',
            ['aws_subnet', namer.name('aws_subnet', subnet.id, subnet.name)],
            [
              ...providerOf(subnet),
              ...attr('vpc_id', ref.vpc(vpc)),
              ...attr('cidr_block', cidrOf(subnet)),
              ...attr('availability_zone', `${region}${str(az.config.zone)}`),
              ...attr(
                'map_public_ip_on_launch',
                subnet.config.mapPublicIpOnLaunch === true,
              ),
              // Com EKS na VPC: o AWS Load Balancer Controller acha as subnets pelas tags.
              ...tagsOf(
                subnet,
                subnet.name,
                eksInVpc
                  ? subnetTier(subnet) === 'public'
                    ? { 'kubernetes.io/role/elb': '1' }
                    : { 'kubernetes.io/role/internal-elb': '1' }
                  : {},
              ),
            ],
          ),
        );
      }
    }

    const igw = igwOf(resources, vpc.id);
    if (igw && gate('network.tf', igw)) {
      emit(
        'network.tf',
        [igw.id],
        block(
          'resource',
          [
            'aws_internet_gateway',
            namer.name('aws_internet_gateway', igw.id, igw.name),
          ],
          [...providerOf(igw), ...attr('vpc_id', ref.vpc(vpc)), ...tagsOf(igw)],
        ),
      );
    }

    const nats = resources.filter(
      (r) =>
        r.type === 'aws.nat' &&
        closest(resources, r.id, VPC_TYPE)?.id === vpc.id,
    );
    for (const nat of nats) {
      if (!gate('network.tf', nat)) continue;
      const name = namer.name('aws_nat_gateway', nat.id, nat.name);
      emit(
        'network.tf',
        [nat.id],
        block(
          'resource',
          ['aws_eip', namer.name('aws_eip', nat.id, nat.name)],
          [...providerOf(nat), ...attr('domain', 'vpc'), ...tagsOf(nat)],
        ),
      );
      emit(
        'network.tf',
        [nat.id],
        block(
          'resource',
          ['aws_nat_gateway', name],
          [
            ...providerOf(nat),
            ...attr('allocation_id', namer.ref('aws_eip', nat.id, nat.name)),
            ...attr('subnet_id', ref.subnet(get(nat.parentId)!)),
            ...(str(nat.config.privateIp)
              ? attr('private_ip', str(nat.config.privateIp))
              : []),
            ...tagsOf(nat),
            ...attr('depends_on', [
              raw(
                `aws_internet_gateway.${namer.name('aws_internet_gateway', igw!.id, igw!.name)}`,
              ),
            ]),
          ],
        ),
      );
    }

    // Route tables derivadas (D1 da F3) + rotas + associações.
    const tables = deriveRouteTables(resources, vpc.id);
    const tableRefs: HclValue[] = [];
    for (const table of tables) {
      const key = table.azId
        ? `private_${str(get(table.azId)?.config.zone) || 'az'}`
        : table.key;
      const rtName = namer.name(
        'aws_route_table',
        `${vpc.id}|${table.key}`,
        `${vpc.name}_${key}`,
      );
      const subnets = table.subnetIds.map(get).filter(ok);
      emit(
        'network.tf',
        [vpc.id, ...table.subnetIds],
        block(
          'resource',
          ['aws_route_table', rtName],
          [
            ...providerOf(vpc),
            ...attr('vpc_id', ref.vpc(vpc)),
            ...attr('tags', { Name: table.name }),
          ],
        ),
      );
      tableRefs.push(raw(`aws_route_table.${rtName}.id`));
      for (const route of table.routes) {
        if (
          route.target.kind === 'local' ||
          (route.target.kind === 'vpce' && route.origin === 'auto')
        )
          continue;
        if (route.target.kind === 'missing') {
          todo(
            'network.tf',
            vpc,
            localized((x) => `${table.name}: ${x.missingIgw}`),
          );
          continue;
        }
        if (route.target.kind === 'vpce') {
          todo(
            'network.tf',
            vpc,
            localized((x) => `${table.name}: ${x.vpceManual}`),
          );
          continue;
        }
        const target = get(route.target.id);
        if (!ok(target)) continue;
        emit(
          'network.tf',
          [vpc.id, target.id],
          block(
            'resource',
            [
              'aws_route',
              namer.name(
                'aws_route',
                `${rtName}|${route.destination}`,
                `${rtName}_${route.destination === '0.0.0.0/0' ? 'default' : route.destination}`,
              ),
            ],
            [
              ...providerOf(vpc),
              ...attr('route_table_id', raw(`aws_route_table.${rtName}.id`)),
              ...attr('destination_cidr_block', route.destination),
              ...(route.target.kind === 'igw'
                ? attr('gateway_id', ref.igw(target))
                : attr('nat_gateway_id', ref.nat(target))),
            ],
          ),
        );
      }
      for (const subnet of subnets) {
        emit(
          'network.tf',
          [subnet.id],
          block(
            'resource',
            [
              'aws_route_table_association',
              namer.name('aws_route_table_association', subnet.id, subnet.name),
            ],
            [
              ...providerOf(subnet),
              ...attr('subnet_id', ref.subnet(subnet)),
              ...attr('route_table_id', raw(`aws_route_table.${rtName}.id`)),
            ],
          ),
        );
      }
    }

    for (const endpoint of resources.filter(
      (r) => r.type === 'aws.vpc_endpoint.gateway' && r.parentId === vpc.id,
    )) {
      if (!gate('network.tf', endpoint)) continue;
      emit(
        'network.tf',
        [endpoint.id],
        block(
          'resource',
          [
            'aws_vpc_endpoint',
            namer.name('aws_vpc_endpoint', endpoint.id, endpoint.name),
          ],
          [
            ...providerOf(endpoint),
            ...attr('vpc_id', ref.vpc(vpc)),
            ...attr(
              'service_name',
              `com.amazonaws.${region}.${str(endpoint.config.service)}`,
            ),
            ...attr('vpc_endpoint_type', 'Gateway'),
            ...attr('route_table_ids', tableRefs),
            ...tagsOf(endpoint),
          ],
        ),
      );
    }
  }

  // Endpoints de interface (7B): uma ENI por subnet escolhida.
  for (const endpoint of ofType(INTERFACE_ENDPOINT_TYPE)) {
    if (!gate('network.tf', endpoint)) continue;
    const vpc = get(endpoint.parentId)!;
    emit(
      'network.tf',
      [endpoint.id],
      block(
        'resource',
        [
          'aws_vpc_endpoint',
          namer.name('aws_vpc_endpoint', endpoint.id, endpoint.name),
        ],
        [
          ...providerOf(endpoint),
          ...attr('vpc_id', ref.vpc(vpc)),
          ...attr(
            'service_name',
            `com.amazonaws.${regionCodeOf(endpoint)}.${str(endpoint.config.service)}`,
          ),
          ...attr('vpc_endpoint_type', 'Interface'),
          ...attr(
            'subnet_ids',
            subnetRefs(readIdList(endpoint.config.subnetIds)),
          ),
          ...sgAttr('security_group_ids', endpoint),
          ...attr('private_dns_enabled', endpoint.config.privateDns !== false),
          ...tagsOf(endpoint),
        ],
      ),
    );
  }
}
