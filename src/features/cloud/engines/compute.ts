import type { LocalizedText } from '../catalog/types';
import { closest, isSubnet, VPC_TYPE } from '../network';
import type { CloudConnection, CloudResource } from '../types';
import { sameRegion } from './secrets';

/**
 * Computação (F7 onda 7C, parte 1 — `sprint-cloud-f7c1-computacao.md`):
 * Lambda, API Gateway HTTP, ECS Fargate, EKS e ECR. Puro: não importa o
 * catálogo (o catálogo importa este módulo).
 */

export const LAMBDA_TYPE = 'aws.lambda';
export const APIGW_TYPE = 'aws.apigw.http';
export const ECR_TYPE = 'aws.ecr.repository';
export const ECS_CLUSTER_TYPE = 'aws.ecs.cluster';
export const ECS_SERVICE_TYPE = 'aws.ecs.service';
export const EKS_CLUSTER_TYPE = 'aws.eks.cluster';
export const EKS_NODEGROUP_TYPE = 'aws.eks.nodegroup';

/** Destinos de rota da API: Lambda direto; ALB/NLB internos pelo VPC Link. */
export const APIGW_TARGET_TYPES = [LAMBDA_TYPE, 'aws.alb', 'aws.nlb'];

const byId = (resources: CloudResource[], id: unknown) =>
  typeof id === 'string' && id ? resources.find((r) => r.id === id) : undefined;

/** Lambda dentro da VPC (criada numa subnet; usa `subnetIds` + SGs). */
export const lambdaInVpc = (
  resources: CloudResource[],
  lambda: CloudResource,
) =>
  Boolean(
    byId(resources, lambda.parentId) &&
    isSubnet(byId(resources, lambda.parentId)!),
  );

// ---------------------------------------------------------------------------
//  Clusters e repositórios (associações por seletor)
// ---------------------------------------------------------------------------

/** Clusters ECS da mesma Região; clusters EKS da mesma VPC (os nós entram nas subnets dela). */
export function clustersFor(
  resources: CloudResource[],
  resource: CloudResource,
) {
  if (resource.type === EKS_NODEGROUP_TYPE) {
    const vpc = closest(resources, resource.id, VPC_TYPE);
    return resources.filter(
      (r) =>
        r.type === EKS_CLUSTER_TYPE &&
        vpc !== undefined &&
        closest(resources, r.id, VPC_TYPE)?.id === vpc.id,
    );
  }
  return resources.filter(
    (r) =>
      r.type === ECS_CLUSTER_TYPE && sameRegion(resources, r.id, resource.id),
  );
}

export const clusterOf = (
  resources: CloudResource[],
  resource: CloudResource,
) => {
  const cluster = byId(resources, resource.config.clusterId);
  return cluster && [ECS_CLUSTER_TYPE, EKS_CLUSTER_TYPE].includes(cluster.type)
    ? cluster
    : undefined;
};

export const ecrReposFor = (
  resources: CloudResource[],
  resource: CloudResource,
) =>
  resources.filter(
    (r) => r.type === ECR_TYPE && sameRegion(resources, r.id, resource.id),
  );

export const ecrOf = (resources: CloudResource[], resource: CloudResource) => {
  const repo = byId(resources, resource.config.ecrRepositoryId);
  return repo?.type === ECR_TYPE ? repo : undefined;
};

// ---------------------------------------------------------------------------
//  API Gateway: rotas = conexões que saem da API
// ---------------------------------------------------------------------------

export function apiRoutes(
  resources: CloudResource[],
  connections: CloudConnection[],
  api: CloudResource,
) {
  return connections
    .filter((c) => c.source === api.id)
    .map((connection) => ({
      connection,
      target: resources.find((r) => r.id === connection.target),
    }))
    .filter((r): r is { connection: CloudConnection; target: CloudResource } =>
      Boolean(r.target && APIGW_TARGET_TYPES.includes(r.target.type)),
    );
}

// ---------------------------------------------------------------------------
//  Fargate
// ---------------------------------------------------------------------------

/** Memórias aceitas pelo Fargate para cada CPU (unidades: 1024 = 1 vCPU). */
export function fargateMemoryOptions(cpu: number): number[] {
  const range = (from: number, to: number, step: number) =>
    Array.from({ length: (to - from) / step + 1 }, (_, i) => from + i * step);
  switch (cpu) {
    case 256:
      return [512, 1024, 2048];
    case 512:
      return range(1024, 4096, 1024);
    case 1024:
      return range(2048, 8192, 1024);
    case 2048:
      return range(4096, 16384, 1024);
    case 4096:
      return range(8192, 30720, 1024);
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
//  Problemas comuns
// ---------------------------------------------------------------------------

/** Cluster obrigatório e no escopo certo (ECS: mesma Região; EKS: mesma VPC). */
export function clusterIssue(
  resources: CloudResource[],
  resource: CloudResource,
): LocalizedText | null {
  const cluster = clusterOf(resources, resource);
  if (!cluster)
    return resource.type === EKS_NODEGROUP_TYPE
      ? {
          pt: 'Escolha o cluster EKS (crie um na VPC antes).',
          en: 'Pick the EKS cluster (create one in the VPC first).',
          es: 'Elige el cluster EKS (crea uno en la VPC antes).',
        }
      : {
          pt: 'Escolha o cluster ECS (crie um na Região antes).',
          en: 'Pick the ECS cluster (create one in the Region first).',
          es: 'Elige el cluster ECS (crea uno en la Región antes).',
        };
  if (!clustersFor(resources, resource).includes(cluster))
    return {
      pt: 'O cluster está em outra Região/VPC.',
      en: 'The cluster is in another Region/VPC.',
      es: 'El cluster está en otra Región/VPC.',
    };
  return null;
}
