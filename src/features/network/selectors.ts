import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';
import type { RouteRow } from './types';
import { getNodeReservedRange, getSiteReserveRange } from './utils';
import { resolveGateway, resolveInterface, resolveRouteType } from './utils';

export const selectNetworkState = (state: RootState) => state.network;

export const selectLegendTree = createSelector(
  [selectNetworkState],
  (network) => {
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
  },
);

export const selectRouteTable = createSelector(
  [selectNetworkState],
  (network) => {
    const { links, nodes, sites } = network;

    // Contador de interface por site para numeração dinâmica
    const ifaceCountersBySite: Record<string, { eth: number; tun: number }> =
      {};

    const rows: RouteRow[] = links.map((link) => {
      const from = nodes.find((node) => node.id === link.from);
      const to = nodes.find((node) => node.id === link.to);

      const fromSiteId = from?.siteId;
      const toSiteId = to?.siteId;

      // Determina o siteId "dono" da rota: prefere o nó de origem; fallback para destino; fallback 'global'
      const ownerSiteId = fromSiteId ?? toSiteId ?? 'global';
      const ownerSite = sites.find((s) => s.id === ownerSiteId);
      const siteName = ownerSite?.name ?? 'Global / Inter-site';
      const reserveRange = ownerSite ? getSiteReserveRange(ownerSite) : null;

      if (!ifaceCountersBySite[ownerSiteId]) {
        ifaceCountersBySite[ownerSiteId] = { eth: 0, tun: 0 };
      }
      const counters = ifaceCountersBySite[ownerSiteId];

      const tipo = resolveRouteType(
        link.kind,
        fromSiteId,
        toSiteId,
        from?.category,
        to?.category,
      );
      const vlan =
        from && from.category !== 'wan' && (from.vlans ?? []).length > 0
          ? String(from.vlans[0])
          : '-';
      const gateway = resolveGateway(tipo, from?.ip, to?.ip);
      const iface = resolveInterface(tipo, link.kind, counters);

      const redeDest =
        tipo === 'Default'
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
        reservedSiteRange:
          reserveRange && reserveRange.count > 0
            ? `${reserveRange.startIp} - ${reserveRange.endIp}`
            : undefined,
        reservedSiteCount: reserveRange?.count ?? 0,
        reserveMarginPercent: ownerSite?.reserveMarginPercent ?? 0,
      };
    });

    return rows;
  },
);

export const selectFirewallRules = createSelector(
  [selectNetworkState],
  (network) => {
    const { aclRules, nodes, siteVlans } = network;

    const getNode = (nodeId: string) =>
      nodes.find((item) => item.id === nodeId) ?? null;

    const getNodeVlanLabel = (nodeId: string) => {
      const node = getNode(nodeId);
      if (!node?.siteId || (node.vlans ?? []).length === 0) {
        return '-';
      }

      const vlanId = node.vlans[0];
      const vlan = siteVlans.find(
        (item) => item.siteId === node.siteId && item.vlanId === vlanId,
      );

      return vlan ? `VLAN ${vlan.vlanId} (${vlan.name})` : `VLAN ${vlanId}`;
    };

    const formatNodeTarget = (nodeId: string) => {
      const node = getNode(nodeId);
      const reserved = node ? getNodeReservedRange(node) : null;
      const ipLabel =
        reserved && reserved.count > 1
          ? `${reserved.startIp} - ${reserved.endIp}`
          : (node?.ip ?? '-');

      return `${ipLabel} / ${node?.label ?? nodeId}`;
    };

    const formatVlanTarget = (nodeId: string, vlanId?: number) => {
      const node = getNode(nodeId);
      const vlan = siteVlans.find(
        (item) => item.siteId === node?.siteId && item.vlanId === vlanId,
      );

      if (!vlan) return formatNodeTarget(nodeId);
      return `VLAN ${vlan.vlanId} / ${vlan.name} / ${vlan.startIp} - ${vlan.endIp}`;
    };

    const formatIpTarget = (nodeId: string, ip?: string) => {
      const node = getNode(nodeId);
      return `${ip ?? node?.ip ?? '-'} / ${node?.label ?? nodeId}`;
    };

    const getVlanHostAllocations = (nodeId: string, vlanId?: number) => {
      const node = getNode(nodeId);
      if (!node?.siteId || !vlanId) {
        return [{ id: nodeId, ip: node?.ip ?? '-' }];
      }

      const vlanNodes = nodes.filter(
        (item) =>
          item.siteId === node.siteId &&
          Array.isArray(item.vlans) &&
          item.vlans.includes(vlanId),
      );

      const allocations = vlanNodes.flatMap((item) => {
        const hostAllocations = item.hostAllocations ?? [];
        if (hostAllocations.length > 0) {
          return hostAllocations;
        }

        return [{ id: item.id, ip: item.ip ?? '-' }];
      });

      return allocations.length > 0
        ? allocations
        : [{ id: nodeId, ip: node.ip ?? '-' }];
    };

    return aclRules.flatMap((rule) => {
      const sourceNode = getNode(rule.sourceNodeId);
      const destinationNode = getNode(rule.destinationNodeId);

      const sourceAllocations =
        rule.sourceScope === 'vlan'
          ? getVlanHostAllocations(rule.sourceNodeId, rule.sourceVlanId)
          : rule.sourceScope === 'node' &&
              sourceNode &&
              (sourceNode.hostAllocations ?? []).length > 0
            ? sourceNode.hostAllocations
            : [{ id: rule.sourceNodeId, ip: sourceNode?.ip ?? '-' }];

      const destinationAllocations =
        rule.destinationScope === 'vlan'
          ? getVlanHostAllocations(
              rule.destinationNodeId,
              rule.destinationVlanId,
            )
          : rule.destinationScope === 'node' &&
              destinationNode &&
              (destinationNode.hostAllocations ?? []).length > 0
            ? destinationNode.hostAllocations
            : [{ id: rule.destinationNodeId, ip: destinationNode?.ip ?? '-' }];

      return sourceAllocations.flatMap((sourceAllocation, sourceIndex) => {
        return destinationAllocations.map(
          (destinationAllocation, destinationIndex) => {
            const origem =
              rule.sourceScope === 'vlan'
                ? `${sourceAllocation.ip} / ${sourceAllocation.id} (${formatVlanTarget(rule.sourceNodeId, rule.sourceVlanId)})`
                : rule.sourceScope === 'ip'
                  ? formatIpTarget(rule.sourceNodeId, rule.sourceIp)
                  : `${sourceAllocation.ip} / ${sourceAllocation.id}`;

            const destino =
              rule.destinationScope === 'vlan'
                ? `${destinationAllocation.ip} / ${destinationAllocation.id} (${formatVlanTarget(rule.destinationNodeId, rule.destinationVlanId)})`
                : rule.destinationScope === 'ip'
                  ? formatIpTarget(rule.destinationNodeId, rule.destinationIp)
                  : `${destinationAllocation.ip} / ${destinationAllocation.id}`;

            const sourceVlanLabel =
              rule.sourceScope === 'node'
                ? getNodeVlanLabel(rule.sourceNodeId)
                : '-';
            const destinationVlanLabel =
              rule.destinationScope === 'node'
                ? getNodeVlanLabel(rule.destinationNodeId)
                : '-';
            const vlan =
              sourceVlanLabel === '-' && destinationVlanLabel === '-'
                ? 'Nao'
                : `O: ${sourceVlanLabel} | D: ${destinationVlanLabel}`;

            return {
              id:
                sourceIndex === 0 && destinationIndex === 0
                  ? rule.id
                  : `${rule.id}#${sourceIndex + 1}-${destinationIndex + 1}`,
              aclRuleId: rule.id,
              acao: rule.action,
              origem,
              destino,
              vlan,
              servico: rule.service,
              enabled: rule.enabled,
              managed: rule.managed,
              sourceNodeId: rule.sourceNodeId,
              destinationNodeId: rule.destinationNodeId,
              sourceNodeSiteId: sourceNode?.siteId,
              destinationNodeSiteId: destinationNode?.siteId,
              sourceScope: rule.sourceScope,
              sourceVlanId: rule.sourceVlanId,
              sourceIp: rule.sourceIp,
              destinationScope: rule.destinationScope,
              destinationVlanId: rule.destinationVlanId,
              destinationIp: rule.destinationIp,
              isDerivedAllocation: sourceIndex > 0 || destinationIndex > 0,
            };
          },
        );
      });
    });
  },
);
