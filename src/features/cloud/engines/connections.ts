import type { LocalizedText } from '../catalog/types';
import { cidrOf, closest, isSubnet, VPC_TYPE } from '../network';
import type { CloudConnection, CloudResource } from '../types';
import { readIdList } from './addressing';
import {
  APIGW_TARGET_TYPES,
  APIGW_TYPE,
  ECS_SERVICE_TYPE,
  EKS_NODEGROUP_TYPE,
  LAMBDA_TYPE,
  lambdaInVpc,
} from './compute';
import {
  AURORA_TYPE,
  dataConnectionIssue,
  dataPairAllowed,
  dataPortOf,
  DYNAMODB_TYPE,
  EFS_TYPE,
  ELASTICACHE_TYPE,
  SNS_TYPE,
  SQS_TYPE,
} from './data';
import {
  CLOUDFRONT_ORIGIN_TYPES,
  CLOUDFRONT_TYPE,
  INTERNET_TYPE,
} from './edge';
import {
  parsePorts,
  SG_PEER_PREFIX,
  type RuleProtocol,
  type SgRule,
} from './security';

/**
 * Conexões do Studio Cloud (F4 — "Conexões e setas" do plano da sprint).
 *
 * Três modos de direção:
 * - `one-way` (ida): seta só no destino;
 * - `both` (ida e volta iguais): UMA conexão, seta nas duas pontas;
 * - par (ida e volta diferentes): DUAS conexões `one-way` opostas ligadas
 *   por `pairId`, cada uma com sua configuração.
 *
 * Toda conexão TCP/UDP entre recursos de VPC gera a regra de entrada nos
 * SGs do destino (decisão D4): a regra é derivada — a conexão é a fonte
 * da verdade. Puro: não importa o catálogo.
 */

export type ConnectionKind = 'traffic' | 'association' | 'data';
export const CONNECTION_KINDS: ConnectionKind[] = [
  'traffic',
  'association',
  'data',
];

export type ConnectionMode = 'one-way' | 'both' | 'pair';

export type ConnectionConfig = {
  protocol: RuleProtocol;
  ports: string;
  encrypted: boolean;
  gbMonth: number;
};

/** Recursos que podem ser ponta de conexão. */
export const CONNECTABLE_TYPES = [
  'aws.ec2',
  'aws.asg',
  'aws.alb',
  'aws.nlb',
  'aws.rds',
  'aws.s3',
  INTERNET_TYPE,
  CLOUDFRONT_TYPE,
  LAMBDA_TYPE,
  APIGW_TYPE,
  ECS_SERVICE_TYPE,
  EKS_NODEGROUP_TYPE,
  AURORA_TYPE,
  ELASTICACHE_TYPE,
  DYNAMODB_TYPE,
  SQS_TYPE,
  SNS_TYPE,
  EFS_TYPE,
];

/** Para onde a Internet pode mandar tráfego (só origem, nunca destino). */
const INTERNET_TARGETS = [
  CLOUDFRONT_TYPE,
  APIGW_TYPE,
  'aws.alb',
  'aws.nlb',
  'aws.ec2',
];

/** Destinos de associação do load balancer (target group). */
export const LB_TARGET_TYPES = ['aws.ec2', 'aws.asg', ECS_SERVICE_TYPE];

/** O par origem → destino faz sentido? Internet só sai; CloudFront só recebe da Internet. */
function allowedPair(sourceType: string, targetType: string) {
  if (targetType === INTERNET_TYPE) return false;
  if (sourceType === INTERNET_TYPE)
    return INTERNET_TARGETS.includes(targetType);
  if (targetType === CLOUDFRONT_TYPE) return false;
  if (sourceType === CLOUDFRONT_TYPE)
    return CLOUDFRONT_ORIGIN_TYPES.includes(targetType);
  // API Gateway: só recebe da Internet; as rotas vão a Lambda e LBs.
  if (targetType === APIGW_TYPE) return false;
  if (sourceType === APIGW_TYPE) return APIGW_TARGET_TYPES.includes(targetType);
  // Dados e mensageria: fluxo da mensagem (produtor → fila → consumidor).
  return dataPairAllowed(sourceType, targetType) ?? true;
}

const str = (value: unknown) => (typeof value === 'string' ? value : '');

export function readConnectionConfig(
  connection: CloudConnection,
): ConnectionConfig {
  const c = connection.config;
  return {
    protocol: (['tcp', 'udp', 'icmp', 'all'] as const).includes(
      c.protocol as RuleProtocol,
    )
      ? (c.protocol as RuleProtocol)
      : 'tcp',
    ports: str(c.ports),
    encrypted: c.encrypted === true,
    gbMonth: typeof c.gbMonth === 'number' ? c.gbMonth : 0,
  };
}

export function connectionMode(connection: CloudConnection): ConnectionMode {
  return connection.pairId ? 'pair' : connection.direction;
}

/** Pode ligar `sourceId` → `targetId`? Não liga a si mesmo nem duplica uma ligação existente. */
export function canConnect(
  resources: CloudResource[],
  connections: CloudConnection[],
  sourceId: string,
  targetId: string,
): boolean {
  if (sourceId === targetId) return false;
  const types = [sourceId, targetId].map(
    (id) => resources.find((r) => r.id === id)?.type ?? '',
  );
  if (!types.every((t) => CONNECTABLE_TYPES.includes(t))) return false;
  if (!allowedPair(types[0], types[1])) return false;
  return !connections.some(
    (c) =>
      (c.source === sourceId && c.target === targetId) ||
      (c.source === targetId && c.target === sourceId),
  );
}

/** Tipo e configuração padrão pela natureza das pontas (ALB → associação, → RDS/S3 → dados). */
export function defaultConnection(
  resources: CloudResource[],
  sourceId: string,
  targetId: string,
): { kind: ConnectionKind; config: ConnectionConfig } {
  const source = resources.find((r) => r.id === sourceId);
  const target = resources.find((r) => r.id === targetId);
  // Da Internet, do CloudFront ou da API para um LB: a porta e o protocolo do listener.
  const external =
    source?.type === INTERNET_TYPE ||
    source?.type === CLOUDFRONT_TYPE ||
    source?.type === APIGW_TYPE;
  if (external && (target?.type === 'aws.alb' || target?.type === 'aws.nlb')) {
    const listener = String(target.config.listenerProtocol ?? '');
    return {
      kind: 'traffic',
      config: {
        protocol: listener === 'UDP' ? 'udp' : 'tcp',
        ports: String(target.config.listenerPort ?? 443),
        encrypted: ['HTTPS', 'TLS'].includes(listener),
        gbMonth: 100,
      },
    };
  }
  if (external) {
    return {
      kind: target?.type === 'aws.s3' ? 'data' : 'traffic',
      config: { protocol: 'tcp', ports: '443', encrypted: true, gbMonth: 100 },
    };
  }
  // Cache, EFS, Aurora, tabela, fila, tópico; e o que sai de fila/tópico.
  const dataPort = target ? dataPortOf(target) : null;
  if (dataPort || source?.type === SQS_TYPE || source?.type === SNS_TYPE) {
    return {
      kind: 'data',
      config: {
        protocol: 'tcp',
        ports: dataPort ?? '443',
        encrypted:
          target?.type !== ELASTICACHE_TYPE ||
          target.config.transitEncryption !== false,
        gbMonth: 10,
      },
    };
  }
  if (target?.type === 'aws.rds') {
    const port = target.config.engine === 'mysql' ? '3306' : '5432';
    return {
      kind: 'data',
      config: { protocol: 'tcp', ports: port, encrypted: true, gbMonth: 10 },
    };
  }
  if (target?.type === 'aws.s3') {
    return {
      kind: 'data',
      config: { protocol: 'tcp', ports: '443', encrypted: true, gbMonth: 50 },
    };
  }
  if (source?.type === 'aws.alb' || source?.type === 'aws.nlb') {
    // Serviço ECS: o target group aponta para a porta do contêiner.
    const port =
      target?.type === ECS_SERVICE_TYPE
        ? String(target.config.containerPort ?? 80)
        : '80';
    return {
      kind: 'association',
      config: { protocol: 'tcp', ports: port, encrypted: false, gbMonth: 100 },
    };
  }
  return {
    kind: 'traffic',
    config: { protocol: 'tcp', ports: '443', encrypted: true, gbMonth: 20 },
  };
}

/**
 * Troca o modo de direção de `id`. Para o par, cria a volta com `newId`
 * (cópia da configuração, depois independente); sair do par apaga a volta.
 */
export function setConnectionMode(
  connections: CloudConnection[],
  id: string,
  mode: ConnectionMode,
  newId: string,
): CloudConnection[] {
  const connection = connections.find((c) => c.id === id);
  if (!connection || connectionMode(connection) === mode) return connections;
  const partnerId = connection.pairId;
  const rest = connections.filter((c) => c.id !== id && c.id !== partnerId);
  if (mode === 'pair') {
    const forward: CloudConnection = {
      ...connection,
      direction: 'one-way',
      pairId: newId,
    };
    const back: CloudConnection = {
      ...connection,
      id: newId,
      source: connection.target,
      target: connection.source,
      direction: 'one-way',
      pairId: connection.id,
      config: { ...connection.config },
    };
    return [...rest, forward, back];
  }
  return [...rest, { ...connection, direction: mode, pairId: null }];
}

/** Inverte origem e destino (só faz sentido em "ida"). */
export function reverseConnection(
  connections: CloudConnection[],
  id: string,
): CloudConnection[] {
  return connections.map((c) =>
    c.id === id ? { ...c, source: c.target, target: c.source } : c,
  );
}

/** Remove a conexão e, se for par, a volta. */
export function removeConnection(
  connections: CloudConnection[],
  id: string,
): CloudConnection[] {
  const connection = connections.find((c) => c.id === id);
  return connections.filter((c) => c.id !== id && c.id !== connection?.pairId);
}

// ---------------------------------------------------------------------------
//  Regras de SG derivadas
// ---------------------------------------------------------------------------

export type DerivedSgRule = {
  connectionId: string;
  sgId: string;
  rule: SgRule;
};

export const securityGroupsOf = (resource: CloudResource | undefined) =>
  readIdList(resource?.config.securityGroupIds);

const inVpc = (
  resources: CloudResource[],
  resource: CloudResource | undefined,
) => Boolean(resource && closest(resources, resource.id, VPC_TYPE));

/** Prefix list gerenciada da AWS com os IPs do CloudFront que falam com origens. */
export const CLOUDFRONT_PREFIX_PEER = 'pl:cloudfront';

/**
 * Origem da regra: Internet → `0.0.0.0/0`; CloudFront → a prefix list dele;
 * recurso da VPC → 1º SG dele, senão o CIDR da subnet (ou da VPC).
 */
function peerOf(
  resources: CloudResource[],
  source: CloudResource,
  target: CloudResource,
): string {
  if (source.type === INTERNET_TYPE) return '0.0.0.0/0';
  if (source.type === CLOUDFRONT_TYPE) return CLOUDFRONT_PREFIX_PEER;
  // O VPC Link da API fica nas subnets da VPC do destino.
  if (source.type === APIGW_TYPE)
    return cidrOf(closest(resources, target.id, VPC_TYPE));
  const sgs = securityGroupsOf(source);
  if (sgs[0]) return `${SG_PEER_PREFIX}${sgs[0]}`;
  const subnet = resources.find((r) => r.id === source.parentId && isSubnet(r));
  return cidrOf(subnet) || cidrOf(closest(resources, source.id, VPC_TYPE));
}

/** Fluxos (origem → destino) que a conexão abre. */
function flowsOf(connection: CloudConnection): [string, string][] {
  const forward: [string, string] = [connection.source, connection.target];
  return connection.direction === 'both' && !connection.pairId
    ? [forward, [connection.target, connection.source]]
    : [forward];
}

export function derivedSgRules(
  resources: CloudResource[],
  connections: CloudConnection[],
): DerivedSgRule[] {
  const out: DerivedSgRule[] = [];
  const byId = (id: string) => resources.find((r) => r.id === id);
  for (const connection of connections) {
    const config = readConnectionConfig(connection);
    if (config.protocol !== 'tcp' && config.protocol !== 'udp') continue;
    for (const [sourceId, targetId] of flowsOf(connection)) {
      const source = byId(sourceId);
      const target = byId(targetId);
      const externalSource =
        source?.type === INTERNET_TYPE ||
        source?.type === CLOUDFRONT_TYPE ||
        source?.type === APIGW_TYPE;
      if (
        !source ||
        !target ||
        !(externalSource || inVpc(resources, source)) ||
        !inVpc(resources, target)
      )
        continue;
      for (const sgId of securityGroupsOf(target)) {
        out.push({
          connectionId: connection.id,
          sgId,
          rule: {
            id: `conn-${connection.id}-${sourceId}-${sgId}`,
            direction: 'ingress',
            protocol: config.protocol,
            ports: config.ports,
            peer: peerOf(resources, source, target),
            description: `${source.name} → ${target.name}`,
          },
        });
      }
    }
  }
  return out;
}

const LB_TYPES = ['aws.alb', 'aws.nlb'];

/**
 * Para onde o listener do load balancer encaminha — mesma regra do
 * Terraform: a 1ª conexão de associação válida (EC2/ASG com porta) e, no
 * NLB, com protocolo compatível com o listener (UDP → UDP; TCP/TLS → TCP).
 */
export function lbForward(
  resources: CloudResource[],
  connections: CloudConnection[],
  lb: CloudResource,
): { port: number; protocol: RuleProtocol } | null {
  const listenerUdp = lb.config.listenerProtocol === 'UDP';
  const candidates: { port: number; protocol: RuleProtocol; path: string }[] =
    [];
  for (const link of connections) {
    if (link.source !== lb.id || link.kind !== 'association') continue;
    const target = resources.find((r) => r.id === link.target);
    const config = readConnectionConfig(link);
    const range = parsePorts(config.ports);
    if (!target || !range || !LB_TARGET_TYPES.includes(target.type)) continue;
    if (lb.type === 'aws.nlb' && (config.protocol === 'udp') !== listenerUdp)
      continue;
    candidates.push({
      port: range[0],
      protocol: config.protocol,
      path: String(link.config.pathPattern ?? '').trim(),
    });
  }
  // ALB: a ação padrão vai para a 1ª conexão sem caminho; as com caminho viram regras.
  const chosen =
    lb.type === 'aws.alb'
      ? (candidates.find((c) => !c.path) ?? candidates[0])
      : candidates[0];
  return chosen ? { port: chosen.port, protocol: chosen.protocol } : null;
}

/** Problema da conexão (inspetor e tabela). `connections` habilita as checagens do load balancer. */
export function connectionIssue(
  resources: CloudResource[],
  connection: CloudConnection,
  connections: CloudConnection[] = [],
): LocalizedText | null {
  const config = readConnectionConfig(connection);
  if (
    (config.protocol === 'tcp' || config.protocol === 'udp') &&
    !parsePorts(config.ports)
  ) {
    return {
      pt: 'Porta inválida (ex.: 443 ou 1024-65535).',
      en: 'Invalid port (e.g. 443 or 1024-65535).',
      es: 'Puerto inválido (ej.: 443 o 1024-65535).',
    };
  }
  const dataIssue = dataConnectionIssue(resources, connection);
  if (dataIssue) return dataIssue;
  const source = resources.find((r) => r.id === connection.source);
  const target = resources.find((r) => r.id === connection.target);
  const fromOutside =
    source?.type === INTERNET_TYPE || source?.type === CLOUDFRONT_TYPE;
  if (fromOutside && target) {
    const who = source!.type === INTERNET_TYPE ? 'Internet' : 'CloudFront';
    if (LB_TYPES.includes(target.type) && target.config.scheme === 'internal') {
      return {
        pt: `${target.name} é interno: a ${who} não alcança. Mude o esquema para "voltado à internet".`,
        en: `${target.name} is internal: ${who} cannot reach it. Change the scheme to "internet-facing".`,
        es: `${target.name} es interno: ${who} no lo alcanza. Cambia el esquema a "expuesto a internet".`,
      };
    }
    if (target.type === 'aws.ec2' && target.config.publicIp !== true) {
      return {
        pt: `${target.name} não tem IP público: a ${who} não alcança.`,
        en: `${target.name} has no public IP: ${who} cannot reach it.`,
        es: `${target.name} no tiene IP pública: ${who} no la alcanza.`,
      };
    }
    const range = parsePorts(config.ports);
    if (
      source!.type === INTERNET_TYPE &&
      config.protocol === 'tcp' &&
      range &&
      [22, 3389].some((p) => p >= range[0] && p <= range[1])
    ) {
      return {
        pt: 'Porta de administração (22/3389) aberta para a internet toda. Prefira Session Manager ou uma VPN.',
        en: 'Admin port (22/3389) open to the whole internet. Prefer Session Manager or a VPN.',
        es: 'Puerto de administración (22/3389) abierto a todo internet. Prefiere Session Manager o una VPN.',
      };
    }
  }
  // API → LB: integração privada pelo VPC Link (LB interno).
  if (
    source?.type === APIGW_TYPE &&
    target &&
    LB_TYPES.includes(target.type) &&
    target.config.scheme !== 'internal'
  ) {
    return {
      pt: `${target.name} é voltado à internet: a API chega por VPC Link, use um ${target.type === 'aws.alb' ? 'ALB' : 'NLB'} interno.`,
      en: `${target.name} is internet-facing: the API reaches it through a VPC Link, use an internal ${target.type === 'aws.alb' ? 'ALB' : 'NLB'}.`,
      es: `${target.name} está expuesto a internet: la API llega por VPC Link, usa un ${target.type === 'aws.alb' ? 'ALB' : 'NLB'} interno.`,
    };
  }
  // Lambda fora da VPC não alcança recursos dentro dela.
  if (
    source?.type === LAMBDA_TYPE &&
    !lambdaInVpc(resources, source) &&
    target &&
    inVpc(resources, target)
  ) {
    return {
      pt: `${source.name} está fora da VPC e não alcança ${target.name}: crie a Lambda numa subnet privada.`,
      en: `${source.name} is outside the VPC and cannot reach ${target.name}: create the Lambda in a private subnet.`,
      es: `${source.name} está fuera de la VPC y no alcanza ${target.name}: crea la Lambda en una subnet privada.`,
    };
  }
  if (
    source &&
    LB_TYPES.includes(source.type) &&
    connection.kind === 'association'
  ) {
    const listener = String(source.config.listenerProtocol ?? '');
    if (
      source.type === 'aws.nlb' &&
      (config.protocol === 'udp') !== (listener === 'UDP')
    ) {
      return {
        pt: `O listener de ${source.name} é ${listener}: esta conexão precisa usar ${listener === 'UDP' ? 'UDP' : 'TCP'}.`,
        en: `${source.name}'s listener is ${listener}: this connection must use ${listener === 'UDP' ? 'UDP' : 'TCP'}.`,
        es: `El listener de ${source.name} es ${listener}: esta conexión debe usar ${listener === 'UDP' ? 'UDP' : 'TCP'}.`,
      };
    }
    const forward = lbForward(resources, connections, source);
    const range = parsePorts(config.ports);
    if (
      forward &&
      range &&
      range[0] !== forward.port &&
      !(
        source.type === 'aws.alb' &&
        String(connection.config.pathPattern ?? '').trim()
      )
    ) {
      return {
        pt: `O listener de ${source.name} só encaminha para a porta ${forward.port}: esta conexão (porta ${range[0]}) fica sem tráfego.`,
        en: `${source.name}'s listener only forwards to port ${forward.port}: this connection (port ${range[0]}) gets no traffic.`,
        es: `El listener de ${source.name} solo reenvía al puerto ${forward.port}: esta conexión (puerto ${range[0]}) queda sin tráfico.`,
      };
    }
  }
  // Só quando a conexão gera regra (origem na VPC ou externa; fila/tópico não geram).
  const derives =
    fromOutside || source?.type === APIGW_TYPE || inVpc(resources, source);
  if (
    target &&
    derives &&
    inVpc(resources, target) &&
    target.type !== 'aws.nlb' &&
    target.type !== EKS_NODEGROUP_TYPE &&
    securityGroupsOf(target).length === 0 &&
    (config.protocol === 'tcp' || config.protocol === 'udp')
  ) {
    return {
      pt: `${target.name} não tem security group: a regra desta conexão não tem onde ficar.`,
      en: `${target.name} has no security group: this connection’s rule has nowhere to go.`,
      es: `${target.name} no tiene security group: la regla de esta conexión no tiene dónde ir.`,
    };
  }
  return null;
}

/** Rótulo curto da aresta: `TCP 443`, `UDP 53`, `ICMP`, `Todos`. */
export function connectionLabel(connection: CloudConnection): string {
  const config = readConnectionConfig(connection);
  if (config.protocol === 'icmp') return 'ICMP';
  if (config.protocol === 'all') return '*';
  return `${config.protocol.toUpperCase()} ${config.ports}`;
}
