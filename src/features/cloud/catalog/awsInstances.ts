/**
 * Tipos de instância EC2 e classes RDS de reserva (decisão D5 da F4): o
 * inspetor usa o catálogo de preços da região; esta lista só aparece quando
 * a região ainda não tem preço carregado. Mesmas famílias da carga de
 * preços (`tools/cloud-pricing`), com vCPU e memória oficiais.
 */

export type InstanceSpec = { type: string; vcpu: number; memoryGiB: number };

/** Família Graviton (arm64): `t4g`, `m7g`, `c7gn`, `r6gd`… — não roda Windows. */
export function isArmInstanceType(type: unknown): boolean {
  const family = String(type ?? '').split('.')[0];
  return /\d+g/.test(family);
}

const SIZES = [
  'nano',
  'micro',
  'small',
  'medium',
  'large',
  'xlarge',
  '2xlarge',
] as const;
const BURSTABLE: Record<(typeof SIZES)[number], [number, number]> = {
  nano: [2, 0.5],
  micro: [2, 1],
  small: [2, 2],
  medium: [2, 4],
  large: [2, 8],
  xlarge: [4, 16],
  '2xlarge': [8, 32],
};

/** GiB por vCPU de cada família de uso geral/computação/memória. */
const FAMILIES: [string, number][] = [
  ['m6i', 4],
  ['m7g', 4],
  ['c6i', 2],
  ['r6i', 8],
];
const SCALE: [string, number][] = [
  ['large', 2],
  ['xlarge', 4],
  ['2xlarge', 8],
  ['4xlarge', 16],
];

export const EC2_FALLBACK_TYPES: InstanceSpec[] = [
  ...['t3', 't4g'].flatMap((family) =>
    SIZES.map((size) => ({
      type: `${family}.${size}`,
      vcpu: BURSTABLE[size][0],
      memoryGiB: BURSTABLE[size][1],
    })),
  ),
  { type: 'm7g.medium', vcpu: 1, memoryGiB: 4 },
  ...FAMILIES.flatMap(([family, perVcpu]) =>
    SCALE.map(([size, vcpu]) => ({
      type: `${family}.${size}`,
      vcpu,
      memoryGiB: vcpu * perVcpu,
    })),
  ),
];

export const RDS_FALLBACK_CLASSES: InstanceSpec[] = [
  ...(['micro', 'small', 'medium', 'large', 'xlarge'] as const).map((size) => ({
    type: `db.t4g.${size}`,
    vcpu: BURSTABLE[size][0],
    memoryGiB: BURSTABLE[size][1],
  })),
  ...SCALE.map(([size, vcpu]) => ({
    type: `db.m6g.${size}`,
    vcpu,
    memoryGiB: vcpu * 4,
  })),
];

/** Classes do Aurora (só t4g.medium/large na família burstable; memória r7g/r8g). */
export const AURORA_FALLBACK_CLASSES: InstanceSpec[] = [
  { type: 'db.t4g.medium', vcpu: 2, memoryGiB: 4 },
  { type: 'db.t4g.large', vcpu: 2, memoryGiB: 8 },
  ...['r7g', 'r8g'].flatMap((family) =>
    SCALE.map(([size, vcpu]) => ({
      type: `db.${family}.${size}`,
      vcpu,
      memoryGiB: vcpu * 8,
    })),
  ),
];

/** Nós do ElastiCache (memória útil oficial de cada tipo). */
export const CACHE_FALLBACK_NODES: InstanceSpec[] = [
  { type: 'cache.t4g.micro', vcpu: 2, memoryGiB: 0.5 },
  { type: 'cache.t4g.small', vcpu: 2, memoryGiB: 1.37 },
  { type: 'cache.t4g.medium', vcpu: 2, memoryGiB: 3.09 },
  { type: 'cache.m7g.large', vcpu: 2, memoryGiB: 6.38 },
  { type: 'cache.m7g.xlarge', vcpu: 4, memoryGiB: 12.93 },
  { type: 'cache.r7g.large', vcpu: 2, memoryGiB: 13.07 },
  { type: 'cache.r7g.xlarge', vcpu: 4, memoryGiB: 26.32 },
];
