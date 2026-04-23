import type { SiteVlan } from '../types';

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
