import type { RouteType } from '../types';

export function resolveRouteType(
  linkKind: string,
  fromSiteId: string | undefined,
  toSiteId: string | undefined,
  toCategory: string | undefined,
): RouteType {
  if (linkKind === 'vpn' || linkKind === 'ipsec') return 'VPN';
  if (toCategory === 'wan') return 'Default';
  if (fromSiteId && toSiteId && fromSiteId === toSiteId) return 'Direta';
  return 'Estática';
}

export function resolveGateway(
  tipo: RouteType,
  fromIp: string | undefined,
  toIp: string | undefined,
): string {
  if (tipo === 'Direta') return '—';
  if (tipo === 'Default') return toIp && toIp !== '' ? toIp : '—';
  if (tipo === 'VPN') return fromIp && fromIp !== '' ? fromIp : '—';
  return toIp && toIp !== '' ? toIp : '—';
}

export function resolveInterface(
  tipo: RouteType,
  linkKind: string,
  ifaceCounters: { eth: number; tun: number },
): string {
  if (tipo === 'VPN' || linkKind === 'vpn' || linkKind === 'ipsec') {
    const idx = ifaceCounters.tun;
    ifaceCounters.tun += 1;
    return `tun${idx} — túnel`;
  }
  if (linkKind === 'wan' || tipo === 'Default') {
    const idx = ifaceCounters.eth;
    ifaceCounters.eth += 1;
    return `eth${idx} — WAN`;
  }
  const idx = ifaceCounters.eth;
  ifaceCounters.eth += 1;
  return `eth${idx} — LAN`;
}
