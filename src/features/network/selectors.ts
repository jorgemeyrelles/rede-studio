import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

export const selectNetworkState = (state: RootState) => state.network;

export const selectLegendTree = createSelector([selectNetworkState], (network) => {
  const { sites, layers, nodes, links } = network;

  return sites.map((site) => {
    const siteLayers = layers.filter((layer) => layer.siteId === site.id);
    return {
      ...site,
      layers: siteLayers.map((layer) => {
        const layerNodes = nodes.filter((node) => node.layerId === layer.id);
        return {
          ...layer,
          nodes: layerNodes.map((node) => ({
            ...node,
            children: links
              .filter((link) => link.from === node.id || link.to === node.id)
              .map((link) => {
                const childId = link.from === node.id ? link.to : link.from;
                const child = nodes.find((item) => item.id === childId);
                return {
                  linkId: link.id,
                  id: childId,
                  label: child?.label ?? childId,
                };
              }),
          })),
        };
      }),
    };
  });
});

export type RouteType = 'Direta' | 'Estática' | 'Default' | 'VPN';

export type RouteRow = {
  siteId: string;
  siteName: string;
  tipo: RouteType;
  vlan: string;
  redeDest: string;
  gateway: string;
  iface: string;
};

function resolveRouteType(
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

function resolveGateway(
  tipo: RouteType,
  fromIp: string | undefined,
  toIp: string | undefined,
  toCategory: string | undefined,
): string {
  if (tipo === 'Direta') return '—';
  if (tipo === 'Default') return toIp && toIp !== '' ? toIp : '—';
  if (tipo === 'VPN') return fromIp && fromIp !== '' ? fromIp : '—';
  // Estática: próximo salto = IP do destino
  return toIp && toIp !== '' ? toIp : '—';
}

function resolveInterface(
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

export const selectRouteTable = createSelector([selectNetworkState], (network) => {
  const { links, nodes, sites } = network;

  // Contador de interface por site para numeração dinâmica
  const ifaceCountersBySite: Record<string, { eth: number; tun: number }> = {};

  const rows: RouteRow[] = links.map((link) => {
    const from = nodes.find((node) => node.id === link.from);
    const to = nodes.find((node) => node.id === link.to);

    const fromSiteId = from?.siteId;
    const toSiteId = to?.siteId;

    // Determina o siteId "dono" da rota: prefere o nó de origem; fallback para destino; fallback 'global'
    const ownerSiteId = fromSiteId ?? toSiteId ?? 'global';
    const ownerSite = sites.find((s) => s.id === ownerSiteId);
    const siteName = ownerSite?.name ?? 'Global / Inter-site';

    if (!ifaceCountersBySite[ownerSiteId]) {
      ifaceCountersBySite[ownerSiteId] = { eth: 0, tun: 0 };
    }
    const counters = ifaceCountersBySite[ownerSiteId];

    const tipo = resolveRouteType(
      link.kind,
      fromSiteId,
      toSiteId,
      to?.category,
    );
    const vlan =
      from && from.category !== 'wan' && (from.vlans ?? []).length > 0
        ? String(from.vlans[0])
        : '-';
    const gateway = resolveGateway(tipo, from?.ip, to?.ip, to?.category);
    const iface = resolveInterface(tipo, link.kind, counters);

    const redeDest =
      to?.category === 'wan'
        ? '0.0.0.0/0'
        : `${to?.ip ?? '0.0.0.0'}/${to?.cidr ?? 0}`;

    return {
      siteId: ownerSiteId,
      siteName,
      tipo,
      vlan,
      redeDest,
      gateway,
      iface,
    };
  });

  return rows;
});

export const selectFirewallRules = createSelector([selectNetworkState], (network) => {
  const { aclRules, nodes } = network;

  return aclRules.map((rule) => {
    const from = nodes.find((node) => node.id === rule.sourceNodeId);
    const to = nodes.find((node) => node.id === rule.destinationNodeId);

    return {
      id: rule.id,
      acao: rule.action,
      origem: `${from?.ip ?? '-'} / ${from?.label ?? rule.sourceNodeId}`,
      destino: `${to?.ip ?? '-'} / ${to?.label ?? rule.destinationNodeId}`,
      servico: rule.service,
      enabled: rule.enabled,
      managed: rule.managed,
    };
  });
});
