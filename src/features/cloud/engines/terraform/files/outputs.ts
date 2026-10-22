import { VPC_TYPE } from '../../../network';
import type { CloudResource } from '../../../types';
import { CLOUDFRONT_TYPE, ZONE_TYPE } from '../../edge';
import { AURORA_TYPE, EFS_TYPE, ELASTICACHE_TYPE, SQS_TYPE } from '../../data';
import { attr, block, type HclValue } from '../hcl';
import { tfSlug } from '../shared';
import type { TfContext } from '../context';

/** Seção `outputs.tf` do gerador. */
export function emitOutputs(ctx: TfContext) {
  const { namer, ofType, str, emit, ok, ref, zoneRef, cfRef } = ctx;

  // ── outputs.tf ────────────────────────────────────────────────────────
  const output = (
    resource: CloudResource,
    suffix: string,
    value: HclValue,
    description: string,
  ) =>
    emit(
      'outputs.tf',
      [resource.id],
      block(
        'output',
        [`${tfSlug(resource.name)}_${suffix}`],
        [...attr('description', description), ...attr('value', value)],
      ),
    );
  for (const vpc of ofType(VPC_TYPE).filter(ok))
    output(vpc, 'id', ref.vpc(vpc), `VPC ${vpc.name}`);
  for (const nat of ofType('aws.nat').filter(ok)) {
    output(
      nat,
      'public_ip',
      namer.ref('aws_eip', nat.id, nat.name, 'public_ip'),
      `Elastic IP ${nat.name}`,
    );
  }
  for (const lb of [...ofType('aws.alb'), ...ofType('aws.nlb')].filter(ok)) {
    output(lb, 'dns_name', ref.lb(lb, 'dns_name'), `DNS ${lb.name}`);
  }
  for (const rds of ofType('aws.rds').filter(ok)) {
    output(
      rds,
      'endpoint',
      namer.ref('aws_db_instance', rds.id, rds.name, 'address'),
      `Endpoint ${rds.name}`,
    );
  }
  for (const cluster of ofType(AURORA_TYPE).filter(ok)) {
    output(
      cluster,
      'endpoint',
      namer.ref('aws_rds_cluster', cluster.id, cluster.name, 'endpoint'),
      `Writer ${cluster.name}`,
    );
    output(
      cluster,
      'reader_endpoint',
      namer.ref('aws_rds_cluster', cluster.id, cluster.name, 'reader_endpoint'),
      `Readers ${cluster.name}`,
    );
  }
  for (const cache of ofType(ELASTICACHE_TYPE).filter(ok)) {
    output(
      cache,
      'endpoint',
      namer.ref(
        'aws_elasticache_replication_group',
        cache.id,
        cache.name,
        'primary_endpoint_address',
      ),
      `Endpoint ${cache.name}`,
    );
  }
  for (const fs of ofType(EFS_TYPE).filter(ok)) {
    output(
      fs,
      'dns_name',
      namer.ref('aws_efs_file_system', fs.id, fs.name, 'dns_name'),
      `NFS ${fs.name}`,
    );
  }
  for (const queue of ofType(SQS_TYPE).filter(ok)) {
    output(
      queue,
      'url',
      namer.ref('aws_sqs_queue', queue.id, queue.name, 'url'),
      `SQS ${queue.name}`,
    );
  }
  for (const zone of ofType(ZONE_TYPE).filter(ok)) {
    if (zone.config.private !== true)
      output(
        zone,
        'name_servers',
        zoneRef(zone, 'name_servers'),
        `Name servers ${str(zone.config.domain)}`,
      );
  }
  for (const cf of ofType(CLOUDFRONT_TYPE).filter(ok)) {
    if (namer.has('aws_cloudfront_distribution', cf.id))
      output(
        cf,
        'domain_name',
        cfRef(cf, 'domain_name'),
        `CloudFront ${cf.name}`,
      );
  }
  for (const bucket of ofType('aws.s3').filter(ok)) {
    output(
      bucket,
      'bucket',
      namer.ref('aws_s3_bucket', bucket.id, bucket.name, 'bucket'),
      `Bucket ${bucket.name}`,
    );
  }
}
