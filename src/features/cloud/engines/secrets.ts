import type { LocalizedText } from '../catalog/types';
import { closest, isSubnet, subnetTier, VPC_TYPE } from '../network';
import type { CloudConnection, CloudResource } from '../types';
import { readIdList } from './addressing';
import { AURORA_TYPE, dataAccessOf, dataServicesOf } from './data';
import { routeTableOfSubnet } from './routing';

/**
 * Segurança e segredos (F7 onda 7B — `sprint-cloud-f7b-seguranca.md`): KMS,
 * Secrets Manager, Parameter Store, Session Manager, Cognito e endpoints de
 * interface. Puro: não importa o catálogo (o catálogo importa este módulo).
 *
 * As relações ficam no recurso que usa (`kmsKeyId`, `secretIds`,
 * `cognitoUserPoolId`, `sessionManager`); daqui saem o escopo (mesma Região),
 * o alcance (NAT × endpoint) e o mínimo que a role da instância precisa.
 */

export const KMS_TYPE = 'aws.kms.key';
export const SECRET_TYPE = 'aws.secret';
export const PARAMETER_TYPE = 'aws.ssm.parameter';
export const COGNITO_TYPE = 'aws.cognito.userpool';
export const INTERFACE_ENDPOINT_TYPE = 'aws.vpc_endpoint.interface';

/** Serviços oferecidos no endpoint de interface (sufixo de `com.amazonaws.<região>.`). */
export const INTERFACE_SERVICES = [
  'secretsmanager',
  'ssm',
  'ssmmessages',
  'ec2messages',
  'kms',
  'sts',
  'logs',
  'ecr.api',
  'ecr.dkr',
  'ec2',
  'eks',
  'eks-auth',
  'sqs',
  'sns',
] as const;

/** Endpoints que o Session Manager precisa numa subnet sem saída. */
export const SESSION_MANAGER_SERVICES = ['ssm', 'ssmmessages', 'ec2messages'];

/** Bancos cuja senha mestre o próprio serviço guarda no Secrets Manager. */
const MANAGED_SECRET_TYPES = ['aws.rds', AURORA_TYPE];

/** Tipos que leem segredos/parâmetros e podem usar Session Manager (ganham role). */
export const INSTANCE_TYPES = ['aws.ec2', 'aws.asg'];

/** Cargas que rodam nas subnets escolhidas (`subnetIds`) e chamam serviços da AWS. */
const SUBNET_WORKLOADS = [
  'aws.asg',
  'aws.lambda',
  'aws.ecs.service',
  'aws.eks.nodegroup',
];

/** O que cada carga chama ao subir: imagens (ECR + S3 por gateway) e, nos nós do EKS, a API do cluster. */
const BOOT_SERVICES: Record<string, string[]> = {
  'aws.ecs.service': ['ecr.api', 'ecr.dkr', 's3'],
  'aws.eks.nodegroup': [
    'ec2',
    'ecr.api',
    'ecr.dkr',
    'sts',
    'eks',
    'eks-auth',
    's3',
  ],
};

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const byId = (resources: CloudResource[], id: unknown) =>
  typeof id === 'string' && id ? resources.find((r) => r.id === id) : undefined;

/** Mesma Região (container) — chaves, segredos e user pools não cruzam regiões. */
export const sameRegion = (
  resources: CloudResource[],
  a: string,
  b: string,
) => {
  const ra = closest(resources, a, 'aws.region');
  return Boolean(ra) && ra?.id === closest(resources, b, 'aws.region')?.id;
};

// ---------------------------------------------------------------------------
//  KMS e Cognito (associações de configuração)
// ---------------------------------------------------------------------------

export const kmsKeysFor = (
  resources: CloudResource[],
  resource: CloudResource,
) =>
  resources.filter(
    (r) => r.type === KMS_TYPE && sameRegion(resources, r.id, resource.id),
  );

export const kmsKeyOf = (
  resources: CloudResource[],
  resource: CloudResource,
) => {
  const key = byId(resources, resource.config.kmsKeyId);
  return key?.type === KMS_TYPE ? key : undefined;
};

export const cognitoPoolsFor = (
  resources: CloudResource[],
  resource: CloudResource,
) =>
  resources.filter(
    (r) => r.type === COGNITO_TYPE && sameRegion(resources, r.id, resource.id),
  );

export const cognitoOf = (
  resources: CloudResource[],
  resource: CloudResource,
) => {
  const pool = byId(resources, resource.config.cognitoUserPoolId);
  return pool?.type === COGNITO_TYPE ? pool : undefined;
};

// ---------------------------------------------------------------------------
//  Segredos e parâmetros lidos
// ---------------------------------------------------------------------------

/**
 * O que a instância pode ler: segredos, parâmetros e a senha mestre que o
 * RDS gerencia (no Secrets Manager), todos da mesma Região.
 */
export const secretSourcesFor = (
  resources: CloudResource[],
  resource: CloudResource,
) =>
  resources.filter(
    (r) =>
      [SECRET_TYPE, PARAMETER_TYPE, ...MANAGED_SECRET_TYPES].includes(r.type) &&
      sameRegion(resources, r.id, resource.id),
  );

/** O que o recurso lê (`secretIds`), só o que ainda existe. */
export const readsOf = (resources: CloudResource[], resource: CloudResource) =>
  readIdList(resource.config.secretIds)
    .map((id) => byId(resources, id))
    .filter((r): r is CloudResource => Boolean(r));

/** Serviços da AWS que a instância chama (para alcance e endpoints); `connections` soma os de dados/mensageria. */
export function requiredServices(
  resources: CloudResource[],
  resource: CloudResource,
  connections: CloudConnection[] = [],
): string[] {
  const services = new Set<string>(BOOT_SERVICES[resource.type] ?? []);
  if (resource.config.sessionManager === true)
    SESSION_MANAGER_SERVICES.forEach((s) => services.add(s));
  for (const source of readsOf(resources, resource)) {
    services.add(source.type === PARAMETER_TYPE ? 'ssm' : 'secretsmanager');
    if (kmsKeyOf(resources, source)) services.add('kms');
  }
  dataServicesOf(resources, connections, resource).forEach((s) =>
    services.add(s),
  );
  return [...services];
}

// ---------------------------------------------------------------------------
//  Alcance: a instância chega aos serviços da AWS?
// ---------------------------------------------------------------------------

/** A subnet sai para a internet (pública com IP público; privada com rota para NAT)? */
function subnetReachesInternet(
  resources: CloudResource[],
  subnet: CloudResource,
  publicIp: boolean,
) {
  const tier = subnetTier(subnet);
  if (tier === 'public') return publicIp;
  if (tier === 'isolated') return false;
  return Boolean(
    routeTableOfSubnet(resources, subnet)?.routes.some(
      (r) => r.destination === '0.0.0.0/0' && r.target.kind === 'nat',
    ),
  );
}

/** Subnets onde a carga roda (EC2: a do pai; ASG, Lambda na VPC, ECS, nós do EKS: as escolhidas). */
const subnetsOfInstance = (
  resources: CloudResource[],
  resource: CloudResource,
) =>
  (SUBNET_WORKLOADS.includes(resource.type)
    ? readIdList(resource.config.subnetIds)
    : [resource.parentId ?? '']
  )
    .map((id) => byId(resources, id))
    .filter((r): r is CloudResource => Boolean(r && isSubnet(r)));

/** Serviços com endpoint na VPC (de interface, ou de gateway: S3 e DynamoDB). */
export const interfaceServicesOf = (
  resources: CloudResource[],
  vpcId: string,
) =>
  new Set(
    resources
      .filter(
        (r) =>
          (r.type === INTERFACE_ENDPOINT_TYPE ||
            r.type === 'aws.vpc_endpoint.gateway') &&
          r.parentId === vpcId,
      )
      .map((r) => str(r.config.service)),
  );

/**
 * Endpoints que faltam: só quando alguma subnet da instância não tem saída
 * para a internet (com saída, a chamada vai pela internet/NAT).
 */
export function missingEndpoints(
  resources: CloudResource[],
  resource: CloudResource,
  connections: CloudConnection[] = [],
): string[] {
  const services = requiredServices(resources, resource, connections);
  if (!services.length) return [];
  const vpc = closest(resources, resource.id, VPC_TYPE);
  if (!vpc) return [];
  // O ASG não liga IP público; a EC2 só se o campo pedir.
  const publicIp =
    resource.type === 'aws.ec2' && resource.config.publicIp === true;
  const isolated = subnetsOfInstance(resources, resource).some(
    (subnet) => !subnetReachesInternet(resources, subnet, publicIp),
  );
  if (!isolated) return [];
  const present = interfaceServicesOf(resources, vpc.id);
  return services.filter((s) => !present.has(s));
}

export function reachabilityIssue(
  resources: CloudResource[],
  resource: CloudResource,
  connections: CloudConnection[] = [],
): LocalizedText | null {
  const missing = missingEndpoints(resources, resource, connections);
  if (!missing.length) return null;
  const list = missing.join(', ');
  return {
    pt: `Sem saída para a internet: os serviços ${list} não respondem. Crie os endpoints na VPC (S3 e DynamoDB são de gateway; os outros, de interface) ou uma NAT.`,
    en: `No way out to the internet: services ${list} won’t answer. Create the endpoints in the VPC (S3 and DynamoDB are gateway; the rest, interface) or a NAT.`,
    es: `Sin salida a internet: los servicios ${list} no responden. Crea los endpoints en la VPC (S3 y DynamoDB son de gateway; los demás, de interfaz) o una NAT.`,
  };
}

// ---------------------------------------------------------------------------
//  Role da instância (menor privilégio)
// ---------------------------------------------------------------------------

export type InstancePermissions = {
  sessionManager: boolean;
  /** Segredos do Secrets Manager (inclui a senha mestre gerenciada pelo RDS). */
  secrets: CloudResource[];
  parameters: CloudResource[];
  /** Chaves que cifram o que a instância lê (kms:Decrypt). */
  kmsKeys: CloudResource[];
};

/**
 * O que qualquer carga lê (`secretIds`): segredos (inclui a senha mestre do
 * RDS), parâmetros e as chaves KMS que os cifram. Serve à role da instância,
 * da Lambda e da tarefa ECS.
 */
export function readPermissions(
  resources: CloudResource[],
  resource: CloudResource,
): Omit<InstancePermissions, 'sessionManager'> {
  const reads = readsOf(resources, resource);
  const secrets = reads.filter(
    (r) => r.type === SECRET_TYPE || MANAGED_SECRET_TYPES.includes(r.type),
  );
  const parameters = reads.filter((r) => r.type === PARAMETER_TYPE);
  const kmsKeys = [
    ...new Set(
      reads
        .map((r) => kmsKeyOf(resources, r))
        .filter((k): k is CloudResource => Boolean(k)),
    ),
  ];
  return { secrets, parameters, kmsKeys };
}

export function instancePermissions(
  resources: CloudResource[],
  resource: CloudResource,
  connections: CloudConnection[] = [],
): InstancePermissions | null {
  if (!INSTANCE_TYPES.includes(resource.type)) return null;
  const reads = readPermissions(resources, resource);
  const sessionManager = resource.config.sessionManager === true;
  if (
    !sessionManager &&
    !reads.secrets.length &&
    !reads.parameters.length &&
    !dataAccessOf(resources, connections, resource).length
  )
    return null;
  return { sessionManager, ...reads };
}

// ---------------------------------------------------------------------------
//  Problemas de escopo (catálogo → inspetor, ⚠ e Terraform)
// ---------------------------------------------------------------------------

/** KMS e Cognito de outra Região (ou excluídos) e leituras fora da Região. */
export function securityIssues(
  resources: CloudResource[],
  resource: CloudResource,
): Record<string, LocalizedText> {
  const issues: Record<string, LocalizedText> = {};
  if (str(resource.config.kmsKeyId)) {
    const key = kmsKeyOf(resources, resource);
    if (!key || !sameRegion(resources, key.id, resource.id)) {
      issues.kmsKeyId = {
        pt: 'A chave KMS precisa estar na mesma Região.',
        en: 'The KMS key must be in the same Region.',
        es: 'La clave KMS debe estar en la misma Región.',
      };
    }
  }
  if (str(resource.config.cognitoUserPoolId)) {
    const pool = cognitoOf(resources, resource);
    if (!pool || !sameRegion(resources, pool.id, resource.id)) {
      issues.cognitoUserPoolId = {
        pt: 'O user pool precisa estar na mesma Região do load balancer.',
        en: 'The user pool must be in the same Region as the load balancer.',
        es: 'El user pool debe estar en la misma Región que el balanceador.',
      };
    } else if (
      resource.type === 'aws.alb' &&
      resource.config.listenerProtocol !== 'HTTPS'
    ) {
      issues.cognitoUserPoolId = {
        pt: 'Login com Cognito exige listener HTTPS.',
        en: 'Cognito sign-in requires an HTTPS listener.',
        es: 'El inicio de sesión con Cognito exige listener HTTPS.',
      };
    }
  }
  const foreign = readsOf(resources, resource).find(
    (r) => !sameRegion(resources, r.id, resource.id),
  );
  if (foreign) {
    issues.secretIds = {
      pt: `${foreign.name} está em outra Região.`,
      en: `${foreign.name} is in another Region.`,
      es: `${foreign.name} está en otra Región.`,
    };
  }
  return issues;
}
