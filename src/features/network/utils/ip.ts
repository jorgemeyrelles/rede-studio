import type { Site, SiteNetwork, SiteVlan } from '../types';

export function ipToNumber(ip: string) {
  const parts = ip.split('.').map((item) => Number(item));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }

  return (
    parts[0] * 256 * 256 * 256 +
    parts[1] * 256 * 256 +
    parts[2] * 256 +
    parts[3]
  );
}

export function numberToIp(value: number) {
  const a = Math.floor(value / (256 * 256 * 256));
  const b = Math.floor((value % (256 * 256 * 256)) / (256 * 256));
  const c = Math.floor((value % (256 * 256)) / 256);
  const d = value % 256;
  return `${a}.${b}.${c}.${d}`;
}

export function parseRadical(value: string) {
  const [thirdRaw, fourthRaw] = value.split('.');
  const third = Number(thirdRaw);
  const fourth = Number(fourthRaw);
  if (
    !Number.isInteger(third) ||
    !Number.isInteger(fourth) ||
    third < 0 ||
    third > 255 ||
    fourth < 0 ||
    fourth > 255
  ) {
    return null;
  }
  return { third, fourth };
}

export function buildIpFromSiteAndRadical(
  siteOctet: number,
  startRadical: string,
) {
  const parsed = parseRadical(startRadical);
  if (!parsed) return null;
  return `200.${siteOctet}.${parsed.third}.${parsed.fourth}`;
}

export function siteRangeBounds(siteOctet: number) {
  const min = ipToNumber(`200.${siteOctet}.0.0`) ?? 0;
  const max = ipToNumber(`200.${siteOctet}.255.255`) ?? 0;
  return { min, max };
}

export function getSiteSubnetBounds(site: Pick<Site, 'ipOctet' | 'cidr'>) {
  const anchor = ipToNumber(`200.${site.ipOctet}.0.0`) ?? 0;
  const safeCidr = Math.max(1, Math.min(32, Math.trunc(site.cidr)));
  const blockSize = 2 ** (32 - safeCidr);
  const networkStart = Math.floor(anchor / blockSize) * blockSize;
  const networkEnd = networkStart + blockSize - 1;

  if (safeCidr >= 31) {
    return {
      networkStart,
      networkEnd,
      usableStart: networkStart,
      usableEnd: networkEnd,
      usableCount: Math.max(1, networkEnd - networkStart + 1),
    };
  }

  return {
    networkStart,
    networkEnd,
    usableStart: networkStart + 1,
    usableEnd: networkEnd - 1,
    usableCount: Math.max(1, networkEnd - networkStart - 1),
  };
}

export function getSiteReserveRange(
  site: Pick<Site, 'ipOctet' | 'cidr' | 'reserveMarginPercent'>,
) {
  const bounds = getSiteSubnetBounds(site);
  const safePercent = Math.max(
    0,
    Math.min(100, Math.trunc(site.reserveMarginPercent)),
  );
  const reservedCount = Math.floor((bounds.usableCount * safePercent) / 100);

  if (reservedCount <= 0) {
    return {
      count: 0,
      startIp: null,
      endIp: null,
    };
  }

  const start = bounds.usableEnd - reservedCount + 1;

  return {
    count: reservedCount,
    startIp: numberToIp(start),
    endIp: numberToIp(bounds.usableEnd),
  };
}

export function getVlanRange(vlan: SiteVlan) {
  const start = ipToNumber(vlan.startIp);
  const end = ipToNumber(vlan.endIp);
  if (start === null || end === null) return null;
  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}

export function isIpInVlan(ip: string, vlan: SiteVlan) {
  const value = ipToNumber(ip);
  const range = getVlanRange(vlan);
  if (value === null || !range) return false;
  return value >= range.start && value <= range.end;
}

export function isIpInAnyVlan(ip: string, vlans: SiteVlan[]) {
  return vlans.some((vlan) => isIpInVlan(ip, vlan));
}

// ── Fase 2 — multi-rede / endereçamento flexível ──────────────────────────────

import type { AddressFamily } from '../types';

/**
 * Retorna o prefixo numérico (1º octeto ou os dois primeiros)
 * de acordo com a addressFamily escolhida.
 * Para '172.x' usa 172.16 como base (range privado RFC 1918).
 */
export function addressFamilyPrefix(family: AddressFamily): string {
  switch (family) {
    case '10.x':
      return '10';
    case '172.x':
      return '172.16';
    case '192.168.x':
      return '192.168';
    default:
      return '200'; // '200.x' — padrão legado
  }
}

/**
 * Monta o endereço de rede a partir da família e do 3º octeto.
 * Ex: addressFamily='10.x', thirdOctet=50 → '10.0.50.0'
 *     addressFamily='200.x', thirdOctet=10 → '200.10.0.0' (usa siteOctet no 2º)
 *
 * Para o padrão legado '200.x', o 2º octeto vem de `siteOctet`.
 */
export function buildNetworkAddress(
  family: AddressFamily,
  thirdOctet: number,
  siteOctet?: number,
): string {
  const prefix = addressFamilyPrefix(family);
  if (family === '200.x') {
    return `200.${siteOctet ?? 10}.${thirdOctet}.0`;
  }
  if (family === '192.168.x' || family === '172.x') {
    return `${prefix}.${thirdOctet}.0`;
  }
  // '10.x'
  return `10.0.${thirdOctet}.0`;
}

/**
 * Retorna o número de hosts disponíveis dado um CIDR.
 * Ex: cidr=24 → 254; cidr=26 → 62; cidr=30 → 2
 */
export function cidrToHostCount(cidr: number): number {
  const safe = Math.max(1, Math.min(32, cidr));
  if (safe >= 31) return Math.max(1, 2 ** (32 - safe));
  return Math.max(1, 2 ** (32 - safe) - 2);
}

/**
 * Verifica se uma sub-rede (networkAddress + cidr) está contida
 * no bloco pai (parentNetwork + parentCidr) e sem sobreposição
 * com blocos irmãos.
 */
export function validateSubnetInParent(params: {
  subnetAddress: string;
  subnetCidr: number;
  parentAddress: string;
  parentCidr: number;
}): { valid: boolean; reason?: string } {
  const { subnetAddress, subnetCidr, parentAddress, parentCidr } = params;

  const subnetStart = ipToNumber(subnetAddress);
  const parentStart = ipToNumber(parentAddress);
  if (subnetStart === null || parentStart === null) {
    return { valid: false, reason: 'Endereço IP inválido' };
  }

  if (subnetCidr <= parentCidr) {
    return {
      valid: false,
      reason: 'CIDR da sub-rede deve ser maior que o da rede pai',
    };
  }

  const parentSize = 2 ** (32 - parentCidr);
  const parentEnd = parentStart + parentSize - 1;

  const subnetSize = 2 ** (32 - subnetCidr);
  const subnetEnd = subnetStart + subnetSize - 1;

  if (subnetStart < parentStart || subnetEnd > parentEnd) {
    return { valid: false, reason: 'Sub-rede fora do bloco da rede pai' };
  }

  return { valid: true };
}

// ── Fase 2 — funções de range por SiteNetwork ─────────────────────────────────

/**
 * Retorna os limites numéricos (min/max) de uma SiteNetwork.
 * Usa addressFamily + thirdOctet + cidr para calcular o bloco.
 */
export function networkRangeBounds(
  network: Pick<SiteNetwork, 'addressFamily' | 'thirdOctet' | 'cidr'>,
  siteOctet: number,
): { min: number; max: number } {
  const addr = buildNetworkAddress(
    network.addressFamily,
    network.thirdOctet,
    siteOctet,
  );
  const start = ipToNumber(addr) ?? 0;
  const blockSize = 2 ** (32 - Math.max(1, Math.min(32, network.cidr)));
  return { min: start, max: start + blockSize - 1 };
}

/**
 * Versão network-aware de buildIpFromSiteAndRadical.
 * O radical X.Y é interpretado como offset a partir do endereço base da rede:
 *   IP = prefix.A.B.(C + X).Y  onde prefix.A.B.C é buildNetworkAddress.
 */
export function buildIpFromNetworkAndRadical(
  network: Pick<SiteNetwork, 'addressFamily' | 'thirdOctet'>,
  startRadical: string,
  siteOctet: number,
): string | null {
  const parsed = parseRadical(startRadical);
  if (!parsed) return null;
  const base = buildNetworkAddress(
    network.addressFamily,
    network.thirdOctet,
    siteOctet,
  );
  const baseParts = base.split('.').map(Number);
  if (baseParts.length !== 4 || baseParts.some((p) => !Number.isFinite(p)))
    return null;
  const thirdOctet = Math.max(0, Math.min(255, baseParts[2] + parsed.third));
  return `${baseParts[0]}.${baseParts[1]}.${thirdOctet}.${parsed.fourth}`;
}
