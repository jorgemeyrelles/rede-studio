import type { LocalizedText } from '../catalog/types';
import { azsOf, closest, isSubnet, subnetTier, VPC_TYPE } from '../network';
import type { CloudResource } from '../types';

/**
 * Motor de roteamento do Studio Cloud (F3 — `sprint-cloud-f3-rotas-seguranca.md`).
 * As route tables são DERIVADAS da topologia, no padrão de mercado da AWS
 * (decisão D1): por VPC, uma pública (todas as subnets públicas → IGW),
 * uma privada por AZ (→ NAT da mesma AZ) e uma isolada (só `local`).
 * Endpoints de gateway entram em todas (D2). Rotas manuais ficam na VPC
 * (`config.manualRoutes`) e são acrescentadas à tabela indicada.
 *
 * Puro: não importa o catálogo (o catálogo importa este módulo).
 */

export const IGW_TYPE = 'aws.igw';
export const NAT_TYPE = 'aws.nat';
export const ENDPOINT_TYPE = 'aws.vpc_endpoint.gateway';

export type RouteTargetKind = 'local' | 'igw' | 'nat' | 'vpce' | 'missing';

export type RouteTarget = {
  kind: RouteTargetKind;
  id: string | null;
  label: string;
};

export type Route = {
  destination: string;
  target: RouteTarget;
  origin: 'auto' | 'manual';
  /** Id da rota manual (para remover). */
  manualId?: string;
  /** A NAT escolhida é de outra AZ (custo inter-AZ, ponto único de falha). */
  crossAz?: boolean;
};

export type RouteTableKind = 'public' | 'private' | 'isolated';

export type RouteTable = {
  /** Chave estável dentro da VPC: `public`, `private:<azId>`, `isolated`. */
  key: string;
  name: string;
  kind: RouteTableKind;
  azId: string | null;
  subnetIds: string[];
  routes: Route[];
};

export type ManualRoute = {
  id: string;
  table: string;
  destination: string;
  targetId: string;
};

const str = (value: unknown) => (typeof value === 'string' ? value : '');

export function readManualRoutes(vpc: CloudResource): ManualRoute[] {
  const raw = vpc.config.manualRoutes;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is ManualRoute =>
      typeof r === 'object' &&
      r !== null &&
      typeof r.id === 'string' &&
      typeof r.table === 'string',
  );
}

/** Elementos da VPC que podem ser alvo de rota: IGW, NATs e endpoints de gateway. */
export function routeTargetsOf(
  resources: CloudResource[],
  vpcId: string,
): CloudResource[] {
  return resources.filter(
    (r) =>
      [IGW_TYPE, NAT_TYPE, ENDPOINT_TYPE].includes(r.type) &&
      closest(resources, r.id, VPC_TYPE)?.id === vpcId,
  );
}

export const igwOf = (resources: CloudResource[], vpcId: string) =>
  resources.find((r) => r.type === IGW_TYPE && r.parentId === vpcId);

/** NATs da VPC com a AZ onde cada uma está (NAT → subnet pública → AZ). */
export function natsOf(resources: CloudResource[], vpcId: string) {
  return resources
    .filter(
      (r) =>
        r.type === NAT_TYPE && closest(resources, r.id, VPC_TYPE)?.id === vpcId,
    )
    .map((nat) => ({
      nat,
      azId: closest(resources, nat.id, 'aws.az')?.id ?? null,
    }));
}

/** A NAT que a route table privada de `azId` usa: a da mesma AZ, senão a primeira da VPC. */
export function natForAz(
  resources: CloudResource[],
  vpcId: string,
  azId: string,
) {
  const nats = natsOf(resources, vpcId);
  const same = nats.find((n) => n.azId === azId);
  if (same) return { nat: same.nat, crossAz: false };
  return nats[0] ? { nat: nats[0].nat, crossAz: true } : null;
}

function targetOf(resource: CloudResource | undefined): RouteTarget {
  if (!resource) return { kind: 'missing', id: null, label: '' };
  const kind: RouteTargetKind =
    resource.type === IGW_TYPE
      ? 'igw'
      : resource.type === NAT_TYPE
        ? 'nat'
        : 'vpce';
  return { kind, id: resource.id, label: resource.name };
}

/** Route tables da VPC, na ordem pública → privadas (por AZ) → isolada. */
export function deriveRouteTables(
  resources: CloudResource[],
  vpcId: string,
): RouteTable[] {
  const vpc = resources.find((r) => r.id === vpcId);
  if (!vpc) return [];
  const local: Route = {
    destination: str(vpc.config.cidr),
    target: { kind: 'local', id: null, label: 'local' },
    origin: 'auto',
  };
  const endpointRoutes: Route[] = resources
    .filter((r) => r.type === ENDPOINT_TYPE && r.parentId === vpcId)
    .map((endpoint) => ({
      destination: `pl-${str(endpoint.config.service)}`,
      target: targetOf(endpoint),
      origin: 'auto',
    }));
  const azs = azsOf(resources, vpcId);
  const subnets = azs.flatMap((az) =>
    resources.filter((r) => isSubnet(r) && r.parentId === az.id),
  );
  const tables: RouteTable[] = [];

  const publics = subnets.filter((s) => subnetTier(s) === 'public');
  if (publics.length) {
    const igw = igwOf(resources, vpcId);
    tables.push({
      key: 'public',
      name: 'rt-public',
      kind: 'public',
      azId: null,
      subnetIds: publics.map((s) => s.id),
      routes: [
        local,
        { destination: '0.0.0.0/0', target: targetOf(igw), origin: 'auto' },
        ...endpointRoutes,
      ],
    });
  }

  for (const az of azs) {
    const privates = subnets.filter(
      (s) => s.parentId === az.id && subnetTier(s) === 'private',
    );
    if (!privates.length) continue;
    const choice = natForAz(resources, vpcId, az.id);
    tables.push({
      key: `private:${az.id}`,
      name: `rt-private-${str(az.config.zone) || az.name}`,
      kind: 'private',
      azId: az.id,
      subnetIds: privates.map((s) => s.id),
      routes: [
        local,
        ...(choice
          ? [
              {
                destination: '0.0.0.0/0',
                target: targetOf(choice.nat),
                origin: 'auto' as const,
                crossAz: choice.crossAz,
              },
            ]
          : []),
        ...endpointRoutes,
      ],
    });
  }

  const isolated = subnets.filter((s) => subnetTier(s) === 'isolated');
  if (isolated.length) {
    tables.push({
      key: 'isolated',
      name: 'rt-isolated',
      kind: 'isolated',
      azId: null,
      subnetIds: isolated.map((s) => s.id),
      routes: [local, ...endpointRoutes],
    });
  }

  const targets = routeTargetsOf(resources, vpcId);
  for (const manual of readManualRoutes(vpc)) {
    const table = tables.find((t) => t.key === manual.table);
    if (!table) continue;
    table.routes.push({
      destination: manual.destination,
      target: targetOf(targets.find((t) => t.id === manual.targetId)),
      origin: 'manual',
      manualId: manual.id,
    });
  }
  return tables;
}

/** Route table que atende a subnet. */
export function routeTableOfSubnet(
  resources: CloudResource[],
  subnet: CloudResource,
) {
  const vpc = closest(resources, subnet.id, VPC_TYPE);
  return vpc
    ? deriveRouteTables(resources, vpc.id).find((t) =>
        t.subnetIds.includes(subnet.id),
      )
    : undefined;
}

// ---------------------------------------------------------------------------
//  Problemas de roteamento (catálogo → inspetor e ⚠ do canvas)
// ---------------------------------------------------------------------------

export function subnetRoutingIssue(
  resources: CloudResource[],
  subnet: CloudResource,
): LocalizedText | null {
  const vpc = closest(resources, subnet.id, VPC_TYPE);
  if (!vpc) return null;
  const tier = subnetTier(subnet);
  if (tier === 'public' && !igwOf(resources, vpc.id)) {
    return {
      pt: 'Sem rota para a internet: crie o Internet Gateway desta VPC.',
      en: 'No route to the internet: create this VPC’s Internet Gateway.',
      es: 'Sin ruta a internet: crea el Internet Gateway de esta VPC.',
    };
  }
  if (tier === 'private' && subnet.parentId) {
    const choice = natForAz(resources, vpc.id, subnet.parentId);
    if (choice?.crossAz) {
      return {
        pt: `Sai pela NAT de outra AZ (${choice.nat.name}): custo inter-AZ e ponto único de falha. Crie uma NAT nesta AZ.`,
        en: `Egress via a NAT in another AZ (${choice.nat.name}): inter-AZ cost and single point of failure. Create a NAT in this AZ.`,
        es: `Sale por el NAT de otra AZ (${choice.nat.name}): costo entre AZ y punto único de falla. Crea un NAT en esta AZ.`,
      };
    }
  }
  return null;
}

export function natIssue(
  resources: CloudResource[],
  nat: CloudResource,
): LocalizedText | null {
  const vpc = closest(resources, nat.id, VPC_TYPE);
  if (vpc && !igwOf(resources, vpc.id)) {
    return {
      pt: 'A NAT precisa do Internet Gateway da VPC para sair para a internet.',
      en: 'The NAT needs the VPC’s Internet Gateway to reach the internet.',
      es: 'El NAT necesita el Internet Gateway de la VPC para salir a internet.',
    };
  }
  return null;
}
