import type { Site, SiteVlan } from '../types';

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
