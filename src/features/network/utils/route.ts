import type { RouteType } from '../types';

export function resolveRouteType(
  linkKind: string,
  fromSiteId: string | undefined,
  toSiteId: string | undefined,
  fromCategory: string | undefined,
  toCategory: string | undefined,
  fromRoutingMode?: string,
): RouteType {
  if (linkKind === 'vpn' || linkKind === 'ipsec') return 'VPN';
  if (linkKind === 'wan' || fromCategory === 'wan' || toCategory === 'wan') {
    // Se o roteador usa BGP ou mixed e o link é inter-site, classificar como BGP
    if (
      (fromRoutingMode === 'bgp' || fromRoutingMode === 'mixed') &&
      fromSiteId &&
      toSiteId &&
      fromSiteId !== toSiteId
    ) {
      return 'BGP';
    }
    return 'Default';
  }
  // Link inter-site com BGP habilitado
  if (
    (fromRoutingMode === 'bgp' || fromRoutingMode === 'mixed') &&
    fromSiteId &&
    toSiteId &&
    fromSiteId !== toSiteId
  ) {
    return 'BGP';
  }
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

export function resolveGatewayIpv6(
  tipo: RouteType,
  fromIpv6: string | undefined,
  toIpv6: string | undefined,
): string {
  if (tipo === 'Direta') return '—';
  if (tipo === 'Default') return toIpv6 && toIpv6 !== '' ? toIpv6 : '—';
  if (tipo === 'VPN') return fromIpv6 && fromIpv6 !== '' ? fromIpv6 : '—';
  return toIpv6 && toIpv6 !== '' ? toIpv6 : '—';
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
