/**
 * Motor de IP do Studio Cloud (F2 — `sprint-cloud-f2-vpc-ip.md`): CIDR de
 * VPC e de subnet, sugestão do próximo bloco livre, plano de subnets por
 * AZ e capacidade descontando os reservados da AWS. Funções puras (rodam
 * em `jiti` — ver `.claude/scratch/verify-cloud-ip.ts`); só IPv4.
 *
 * Endereços são números de 32 bits sem sinal (`>>> 0`); um bloco é sempre
 * guardado alinhado (`base` = endereço de rede).
 */

export type CidrBlock = { base: number; prefix: number };

/** Limites de prefixo da AWS para VPC e subnet (IPv4). */
export const AWS_MIN_PREFIX = 16;
export const AWS_MAX_PREFIX = 28;

/** A AWS reserva 5 endereços por subnet: rede, roteador, DNS, uso futuro e broadcast. */
export const AWS_RESERVED_PER_SUBNET = 5;

/** Faixa onde as VPCs são sugeridas (decisão D2 da F2). */
export const VPC_SUGGESTION_SPACE = '10.0.0.0/8';

/** Bloco inicial (em blocos do prefixo da subnet) de cada camada no plano. */
export const TIER_BLOCK_OFFSET = {
  public: 0,
  private: 10,
  isolated: 20,
} as const;
export type SubnetTier = keyof typeof TIER_BLOCK_OFFSET;
export const SUBNET_TIERS: SubnetTier[] = ['public', 'private', 'isolated'];

const RFC1918 = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

export function ipToInt(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

export function intToIp(value: number): string {
  const v = value >>> 0;
  return [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join('.');
}

export const blockSize = (prefix: number) => 2 ** (32 - prefix);

/** Lê "a.b.c.d/p". `aligned` diz se o endereço já é o de rede (10.0.1.5/24 não é). */
export function parseCidr(
  text: string,
): (CidrBlock & { aligned: boolean }) | null {
  const match = /^\s*([\d.]+)\/(\d{1,2})\s*$/.exec(text ?? '');
  if (!match) return null;
  const ip = ipToInt(match[1]);
  const prefix = Number(match[2]);
  if (ip === null || prefix < 0 || prefix > 32) return null;
  const size = blockSize(prefix);
  const base = ip - (ip % size);
  return { base, prefix, aligned: base === ip };
}

export function formatCidr(block: CidrBlock): string {
  return `${intToIp(block.base)}/${block.prefix}`;
}

/** Primeiro e último endereço do bloco. */
export function cidrRange(block: CidrBlock): [number, number] {
  return [block.base, block.base + blockSize(block.prefix) - 1];
}

export function cidrContains(outer: CidrBlock, inner: CidrBlock): boolean {
  const [os, oe] = cidrRange(outer);
  const [is, ie] = cidrRange(inner);
  return is >= os && ie <= oe;
}

export function cidrsOverlap(a: CidrBlock, b: CidrBlock): boolean {
  const [as, ae] = cidrRange(a);
  const [bs, be] = cidrRange(b);
  return as <= be && bs <= ae;
}

export function isPrivateCidr(block: CidrBlock): boolean {
  return RFC1918.some((range) => cidrContains(parseCidr(range)!, block));
}

const parseAll = (cidrs: string[]) =>
  cidrs
    .map((c) => parseCidr(c))
    .filter((b): b is NonNullable<typeof b> => b !== null);

// ---------------------------------------------------------------------------
//  Capacidade
// ---------------------------------------------------------------------------

export type SubnetCapacity = {
  total: number;
  usable: number;
  /** Primeiro e último IP que um recurso pode receber (`null` se o bloco não comporta). */
  firstUsable: string | null;
  lastUsable: string | null;
};

/** Capacidade de uma subnet AWS: as 4 primeiras e a última ficam reservadas. */
export function subnetCapacity(cidr: string): SubnetCapacity | null {
  const block = parseCidr(cidr);
  if (!block) return null;
  const total = blockSize(block.prefix);
  const usable = Math.max(0, total - AWS_RESERVED_PER_SUBNET);
  const [start, end] = cidrRange(block);
  return {
    total,
    usable,
    firstUsable: usable > 0 ? intToIp(start + 4) : null,
    lastUsable: usable > 0 ? intToIp(end - 1) : null,
  };
}

// ---------------------------------------------------------------------------
//  Validação — devolve o problema (código + bloco em conflito), a UI traduz
// ---------------------------------------------------------------------------

export type CidrIssue =
  | { code: 'format' }
  | { code: 'notAligned'; suggestion: string }
  | { code: 'prefixRange' }
  | { code: 'notPrivate' }
  | { code: 'outsideVpc'; vpc: string }
  | { code: 'overlap'; with: string };

function checkShape(cidr: string): CidrIssue | CidrBlock {
  const block = parseCidr(cidr);
  if (!block) return { code: 'format' };
  if (!block.aligned)
    return { code: 'notAligned', suggestion: formatCidr(block) };
  if (block.prefix < AWS_MIN_PREFIX || block.prefix > AWS_MAX_PREFIX)
    return { code: 'prefixRange' };
  return block;
}

const isIssue = (value: CidrIssue | CidrBlock): value is CidrIssue =>
  'code' in value;

/** CIDR de VPC: formato, alinhado, /16–/28, RFC 1918 e sem sobrepor as outras VPCs do projeto. */
export function validateVpcCidr(
  cidr: string,
  otherVpcCidrs: string[],
): CidrIssue | null {
  const shape = checkShape(cidr);
  if (isIssue(shape)) return shape;
  if (!isPrivateCidr(shape)) return { code: 'notPrivate' };
  const clash = otherVpcCidrs.find((other) => {
    const block = parseCidr(other);
    return block !== null && cidrsOverlap(shape, block);
  });
  return clash ? { code: 'overlap', with: clash } : null;
}

/** CIDR de subnet: formato, alinhado, /16–/28, dentro da VPC e sem sobrepor as irmãs. */
export function validateSubnetCidr(
  cidr: string,
  vpcCidr: string,
  siblingCidrs: string[],
): CidrIssue | null {
  const shape = checkShape(cidr);
  if (isIssue(shape)) return shape;
  const vpc = parseCidr(vpcCidr);
  if (vpc && !cidrContains(vpc, shape))
    return { code: 'outsideVpc', vpc: vpcCidr };
  const clash = siblingCidrs.find((other) => {
    const block = parseCidr(other);
    return block !== null && cidrsOverlap(shape, block);
  });
  return clash ? { code: 'overlap', with: clash } : null;
}

// ---------------------------------------------------------------------------
//  Sugestão de blocos
// ---------------------------------------------------------------------------

/**
 * Primeiro bloco `/prefix` livre dentro de `space`, a partir do bloco de
 * índice `startIndex` (contado em blocos do prefixo) e dando a volta até o
 * início. `null` se não couber.
 */
export function nextFreeBlock(
  space: CidrBlock,
  taken: CidrBlock[],
  prefix: number,
  startIndex = 0,
): string | null {
  if (prefix < space.prefix) return null;
  const size = blockSize(prefix);
  const count = blockSize(space.prefix) / size;
  for (let step = 0; step < count; step++) {
    const index = (startIndex + step) % count;
    const candidate = { base: space.base + index * size, prefix };
    if (!taken.some((block) => cidrsOverlap(block, candidate)))
      return formatCidr(candidate);
  }
  return null;
}

/** Próximo `/16` livre em `10.0.0.0/8` (10.0, 10.1, …) sem sobrepor as VPCs existentes. */
export function suggestVpcCidr(
  existingVpcCidrs: string[],
  prefix = 16,
): string | null {
  return nextFreeBlock(
    parseCidr(VPC_SUGGESTION_SPACE)!,
    parseAll(existingVpcCidrs),
    prefix,
  );
}

/**
 * Próximo bloco livre de subnet dentro da VPC. Com `tier`, começa no bloco
 * da camada (pública 0, privada 10, isolada 20 — com `/24` numa `/16`, a
 * camada se lê pelo terceiro octeto).
 */
export function nextSubnetCidr(
  vpcCidr: string,
  siblingCidrs: string[],
  prefix = 24,
  tier?: SubnetTier,
): string | null {
  const vpc = parseCidr(vpcCidr);
  if (!vpc) return null;
  return nextFreeBlock(
    vpc,
    parseAll(siblingCidrs),
    prefix,
    tier ? TIER_BLOCK_OFFSET[tier] : 0,
  );
}

// ---------------------------------------------------------------------------
//  Plano de subnets (botão "Planejar subnets")
// ---------------------------------------------------------------------------

export type PlanAz = { id: string; label: string };

export type PlanExisting = { azId: string; tier: SubnetTier; cidr: string };

export type PlannedSubnet = {
  azId: string;
  tier: SubnetTier;
  /** `null` quando não há bloco livre do tamanho pedido. */
  cidr: string | null;
  /** `exists`: a AZ já tem subnet dessa camada — o plano não cria nem apaga. */
  status: 'create' | 'exists' | 'noSpace';
};

/**
 * Plano determinístico: uma subnet por camada × AZ, camada por camada (na
 * ordem pública → privada → isolada) e AZ por AZ. Cada camada começa no seu
 * bloco (`TIER_BLOCK_OFFSET`) e pula o que já está ocupado. O que já existe
 * aparece como `exists` e nunca é recriado nem apagado.
 */
export function planSubnets(params: {
  vpcCidr: string;
  azs: PlanAz[];
  tiers: SubnetTier[];
  prefix: number;
  existing: PlanExisting[];
}): PlannedSubnet[] {
  const { vpcCidr, azs, tiers, prefix, existing } = params;
  const vpc = parseCidr(vpcCidr);
  const taken = parseAll(existing.map((e) => e.cidr));
  const plan: PlannedSubnet[] = [];
  for (const tier of SUBNET_TIERS.filter((t) => tiers.includes(t))) {
    azs.forEach((az, azIndex) => {
      const current = existing.find((e) => e.azId === az.id && e.tier === tier);
      if (current) {
        plan.push({ azId: az.id, tier, cidr: current.cidr, status: 'exists' });
        return;
      }
      const cidr = vpc
        ? nextFreeBlock(vpc, taken, prefix, TIER_BLOCK_OFFSET[tier] + azIndex)
        : null;
      if (cidr) taken.push(parseCidr(cidr)!);
      plan.push({
        azId: az.id,
        tier,
        cidr,
        status: cidr ? 'create' : 'noSpace',
      });
    });
  }
  return plan;
}
