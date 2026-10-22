import { awsRegionZones } from './catalog/awsRegions';
import type { LocalizedText } from './catalog/types';
import {
  nextSubnetCidr,
  subnetCapacity,
  suggestVpcCidr,
  validateSubnetCidr,
  validateVpcCidr,
  type CidrIssue,
  type SubnetTier,
} from './engines/ip';
import type { CloudResource } from './types';

/**
 * Rede do rascunho (F2): VPC → AZ → subnet sobre a lista plana de recursos,
 * ligando a árvore ao motor de IP. Não importa o catálogo nem `tree.ts`
 * (o catálogo importa este módulo — evita ciclo na inicialização).
 */

export const VPC_TYPE = 'aws.vpc';
export const AZ_TYPE = 'aws.az';
export const SUBNET_TYPES = [
  'aws.subnet.public',
  'aws.subnet.private',
] as const;

const byId = (resources: CloudResource[], id: string | null | undefined) =>
  id ? resources.find((r) => r.id === id) : undefined;

const str = (value: unknown) => (typeof value === 'string' ? value : '');

export const isSubnet = (resource: CloudResource) =>
  (SUBNET_TYPES as readonly string[]).includes(resource.type);

/** Ancestral mais próximo (ou o próprio) do tipo pedido. */
export function closest(
  resources: CloudResource[],
  id: string | null,
  type: string,
) {
  let current = byId(resources, id);
  while (current && current.type !== type)
    current = byId(resources, current.parentId);
  return current;
}

export const vpcOf = (resources: CloudResource[], id: string | null) =>
  closest(resources, id, VPC_TYPE);

export function azsOf(resources: CloudResource[], vpcId: string) {
  return resources.filter((r) => r.type === AZ_TYPE && r.parentId === vpcId);
}

/** Subnets da VPC (dentro das AZs dela), na ordem das AZs. */
export function subnetsOfVpc(resources: CloudResource[], vpcId: string) {
  const azIds = azsOf(resources, vpcId).map((az) => az.id);
  return azIds.flatMap((azId) =>
    resources.filter((r) => isSubnet(r) && r.parentId === azId),
  );
}

export function subnetTier(subnet: CloudResource): SubnetTier {
  if (subnet.type === 'aws.subnet.public') return 'public';
  return subnet.config.isolated === true ? 'isolated' : 'private';
}

export const cidrOf = (resource: CloudResource | undefined) =>
  str(resource?.config.cidr);

/** Código da região da VPC/AZ (ex.: `sa-east-1`). */
export function regionCodeOf(resources: CloudResource[], id: string | null) {
  return str(closest(resources, id, 'aws.region')?.config.region);
}

/** Letras das AZs que a região do elemento oferece (`awsRegions.ts`). */
export function regionZones(resources: CloudResource[], id: string | null) {
  return awsRegionZones(regionCodeOf(resources, id));
}

/**
 * Quantas AZs a região do elemento usa (campo `azCount` da Região),
 * limitado às zonas que a região tem.
 */
export function regionAzCount(resources: CloudResource[], id: string | null) {
  const value = closest(resources, id, 'aws.region')?.config.azCount;
  const wanted = typeof value === 'number' ? value : 2;
  return Math.min(wanted, regionZones(resources, id).length);
}

/** Próxima letra de AZ livre na VPC, entre as da região (`null` se todas em uso). */
export function nextAzLetter(resources: CloudResource[], vpcId: string) {
  const used = new Set(
    azsOf(resources, vpcId).map((az) => str(az.config.zone)),
  );
  return (
    regionZones(resources, vpcId).find((letter) => !used.has(letter)) ?? null
  );
}

/** Nome da zona como a AWS escreve: região + letra (`sa-east-1a`). */
export function zoneName(resources: CloudResource[], az: CloudResource) {
  const letter = str(az.config.zone);
  return `${regionCodeOf(resources, az.id)}${letter}`;
}

// ---------------------------------------------------------------------------
//  Sugestões (criação e botão "Sugerir")
// ---------------------------------------------------------------------------

export function otherVpcCidrs(
  resources: CloudResource[],
  exceptId: string | null,
) {
  return resources
    .filter((r) => r.type === VPC_TYPE && r.id !== exceptId)
    .map(cidrOf)
    .filter(Boolean);
}

export function suggestCidrForVpc(
  resources: CloudResource[],
  vpcId: string | null,
) {
  return suggestVpcCidr(otherVpcCidrs(resources, vpcId));
}

/** CIDRs das outras subnets da mesma VPC. */
export function siblingSubnetCidrs(
  resources: CloudResource[],
  vpcId: string,
  exceptId: string | null,
) {
  return subnetsOfVpc(resources, vpcId)
    .filter((s) => s.id !== exceptId)
    .map(cidrOf)
    .filter(Boolean);
}

/** Bloco sugerido para uma subnet nova/existente, a partir do bloco da camada. */
export function suggestCidrForSubnet(
  resources: CloudResource[],
  azId: string,
  tier: SubnetTier,
  exceptId: string | null,
  prefix = 24,
) {
  const vpc = vpcOf(resources, azId);
  if (!vpc || !cidrOf(vpc)) return null;
  return nextSubnetCidr(
    cidrOf(vpc),
    siblingSubnetCidrs(resources, vpc.id, exceptId),
    prefix,
    tier,
  );
}

// ---------------------------------------------------------------------------
//  Validação (inspetor, aba IPAM)
// ---------------------------------------------------------------------------

export function vpcCidrIssue(
  resources: CloudResource[],
  vpc: CloudResource,
): CidrIssue | null {
  return validateVpcCidr(cidrOf(vpc), otherVpcCidrs(resources, vpc.id));
}

export function subnetCidrIssue(
  resources: CloudResource[],
  subnet: CloudResource,
  cidr = cidrOf(subnet),
): CidrIssue | null {
  const vpc = vpcOf(resources, subnet.id);
  if (!vpc) return null;
  return validateSubnetCidr(
    cidr,
    cidrOf(vpc),
    siblingSubnetCidrs(resources, vpc.id, subnet.id),
  );
}

export function cidrIssueText(issue: CidrIssue): LocalizedText {
  switch (issue.code) {
    case 'format':
      return {
        pt: 'Use o formato a.b.c.d/prefixo (ex.: 10.0.0.0/16).',
        en: 'Use the a.b.c.d/prefix format (e.g. 10.0.0.0/16).',
        es: 'Usa el formato a.b.c.d/prefijo (ej.: 10.0.0.0/16).',
      };
    case 'notAligned':
      return {
        pt: `Não é endereço de rede. Use ${issue.suggestion}.`,
        en: `Not a network address. Use ${issue.suggestion}.`,
        es: `No es una dirección de red. Usa ${issue.suggestion}.`,
      };
    case 'prefixRange':
      return {
        pt: 'A AWS aceita de /16 a /28.',
        en: 'AWS accepts /16 to /28.',
        es: 'AWS acepta de /16 a /28.',
      };
    case 'notPrivate':
      return {
        pt: 'Use uma faixa privada (10/8, 172.16/12 ou 192.168/16).',
        en: 'Use a private range (10/8, 172.16/12 or 192.168/16).',
        es: 'Usa un rango privado (10/8, 172.16/12 o 192.168/16).',
      };
    case 'outsideVpc':
      return {
        pt: `Fora da VPC (${issue.vpc}).`,
        en: `Outside the VPC (${issue.vpc}).`,
        es: `Fuera de la VPC (${issue.vpc}).`,
      };
    case 'overlap':
      return {
        pt: `Sobrepõe ${issue.with}.`,
        en: `Overlaps ${issue.with}.`,
        es: `Se superpone con ${issue.with}.`,
      };
  }
}

/** "10.0.1.0/24 · 251 IPs" — título dos containers de subnet. */
export function subnetSummary(cidr: string) {
  const capacity = subnetCapacity(cidr);
  return capacity ? `${cidr} · ${capacity.usable} IPs` : cidr;
}

/**
 * Uma subnet da camada por AZ da VPC (ALB, ASG, subnet group do RDS); com
 * `prefer`, ela entra no lugar das outras da mesma AZ.
 */
export function subnetsPerAz(
  resources: CloudResource[],
  vpcId: string,
  tier: SubnetTier | SubnetTier[],
  prefer: string | null = null,
): string[] {
  const tiers = Array.isArray(tier) ? tier : [tier];
  return azsOf(resources, vpcId).flatMap((az) => {
    const candidates = resources.filter(
      (r) =>
        isSubnet(r) && r.parentId === az.id && tiers.includes(subnetTier(r)),
    );
    const chosen = candidates.find((c) => c.id === prefer) ?? candidates[0];
    return chosen ? [chosen.id] : [];
  });
}

/** Quantas AZs diferentes as subnets cobrem. */
export function azCountOf(resources: CloudResource[], subnetIds: string[]) {
  return new Set(
    subnetIds
      .map((id) => resources.find((r) => r.id === id)?.parentId)
      .filter(Boolean),
  ).size;
}
