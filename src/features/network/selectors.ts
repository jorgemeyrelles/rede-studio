import type { RootState } from '../../app/store';

export const selectNetworkState = (state: RootState) => state.network;

export const selectLegendTree = (state: RootState) => {
  const { sites, layers, nodes, links } = state.network;

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
};

export const selectRouteTable = (state: RootState) => {
  const { links, nodes } = state.network;

  return links.map((link, index) => {
    const from = nodes.find((node) => node.id === link.from);
    const to = nodes.find((node) => node.id === link.to);

    return {
      id: `R${index + 1}`,
      origem: from?.label ?? link.from,
      destino: to?.label ?? link.to,
      redeDestino: `${to?.ip ?? '0.0.0.0'}/${to?.cidr ?? 0}`,
      proximoSalto: from?.ip ?? '-',
      tipo: link.kind,
    };
  });
};

export const selectFirewallRules = (state: RootState) => {
  const { links, nodes } = state.network;

  return links
    .filter((link) => {
      const from = nodes.find((node) => node.id === link.from);
      const to = nodes.find((node) => node.id === link.to);
      return (
        from?.category === 'firewall' ||
        to?.category === 'firewall' ||
        link.kind === 'vpn' ||
        link.kind === 'ipsec'
      );
    })
    .map((link, index) => {
      const from = nodes.find((node) => node.id === link.from);
      const to = nodes.find((node) => node.id === link.to);
      return {
        id: `FW${index + 1}`,
        acao: 'ALLOW',
        origem: `${from?.ip ?? '-'} / ${from?.label ?? link.from}`,
        destino: `${to?.ip ?? '-'} / ${to?.label ?? link.to}`,
        servico: link.kind === 'ipsec' || link.kind === 'vpn' ? 'VPN' : 'ANY',
      };
    });
};
