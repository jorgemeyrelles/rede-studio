import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';
import type { FirewallGroupedResult, FirewallRuleRow, RouteRow } from './types';
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
    const { links, nodes, sites, siteNetworks } = network;

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

      // Fase 1 — zona inferida pelo tipo de rota e categoria dos nós
      const zone = (() => {
        if (tipo === 'Default') return 'wan';
        if (tipo === 'VPN') return 'vpn';
        if (from?.category === 'wan' || to?.category === 'wan') return 'wan';
        return from?.zone ?? to?.zone ?? 'lan';
      })();

      // Fase 2 — networkName a partir do networkId do nó de origem
      const networkName = (() => {
        const networkId = from?.networkId ?? to?.networkId;
        if (!networkId) return '—';
        const net = (siteNetworks ?? []).find((n) => n.id === networkId);
        return net?.name ?? '—';
      })();

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
        zone,
        networkName,
      };
    });

    return rows;
  },
);

export const selectFirewallRules = createSelector(
  [selectNetworkState],
  (network) => {
    const { aclRules, nodes, siteVlans, links } = network;

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
      const ruleSource: 'topology' | 'manual' =
        rule.source ?? (rule.managed ? 'topology' : 'manual');
      const rulePriority = rule.priority ?? (rule.managed ? 9999 : 500);

      // Conflict: manual DENY that shadows a topology ALLOW on the same inter-site path
      const ruleSrcSiteId = getNode(rule.sourceNodeId)?.siteId;
      const ruleDstSiteId = getNode(rule.destinationNodeId)?.siteId;
      const hasTopologyAllow =
        ruleSrcSiteId &&
        ruleDstSiteId &&
        aclRules.some((r) => {
          const rSource: 'topology' | 'manual' =
            r.source ?? (r.managed ? 'topology' : 'manual');
          if (rSource !== 'topology' || r.action !== 'ALLOW') return false;
          const rSrcSite = getNode(r.sourceNodeId)?.siteId;
          const rDstSite = getNode(r.destinationNodeId)?.siteId;
          if (!rSrcSite || !rDstSite) return false;
          return (
            (rSrcSite === ruleSrcSiteId && rDstSite === ruleDstSiteId) ||
            (rSrcSite === ruleDstSiteId && rDstSite === ruleSrcSiteId)
          );
        });
      const hasConflict =
        ruleSource === 'manual' &&
        rule.action === 'DENY' &&
        Boolean(hasTopologyAllow);
      void ruleSrcSiteId;
      void ruleDstSiteId;

      // Stateless without return rule
      const isStateful = rule.stateful ?? true;
      const hasReturnRule = aclRules.some(
        (r) =>
          r.id === rule.returnRuleId ||
          (r.parentRuleId === rule.id && r.isReturnRule),
      );
      const missingReturn =
        !isStateful &&
        !hasReturnRule &&
        !rule.isReturnRule &&
        !rule.bidirectional;

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

            // E — NAT mode badge from FW/router on the link path
            const linkedLink = rule.linkId
              ? links.find((l) => l.id === rule.linkId)
              : undefined;
            const linkedFrom = linkedLink
              ? nodes.find((n) => n.id === linkedLink.from)
              : undefined;
            const linkedTo = linkedLink
              ? nodes.find((n) => n.id === linkedLink.to)
              : undefined;
            const natHost = [linkedFrom, linkedTo].find(
              (n) => n?.category === 'firewall' || n?.category === 'router',
            );
            const rawNatMode = natHost
              ? String(natHost.techProfile?.fields?.natMode ?? 'none')
              : 'none';
            const fwNatMode = (
              ['pat', 'snat', 'dnat', 'hybrid', 'none'].includes(rawNatMode)
                ? rawNatMode
                : 'none'
            ) as FirewallRuleRow['fwNatMode'];

            // E — IPsec auth badge
            const ipsecNode = [linkedFrom, linkedTo].find(
              (n) => n?.category === 'ipsec' || n?.category === 'vpn',
            );
            const ipsecAuth = ipsecNode
              ? String(ipsecNode.techProfile?.fields?.authMethod ?? 'psk')
              : undefined;
            const ipsecAuthBadge: FirewallRuleRow['ipsecAuthBadge'] =
              ipsecAuth === 'certificate'
                ? 'PKI'
                : ipsecAuth === 'eap'
                  ? 'EAP'
                  : ipsecAuth === 'keypair'
                    ? 'keypair'
                    : ipsecAuth === 'none'
                      ? '⚠ sem IKE'
                      : ipsecAuth === 'psk'
                        ? 'PSK'
                        : undefined;

            const row: FirewallRuleRow = {
              id:
                sourceIndex === 0 && destinationIndex === 0
                  ? rule.id
                  : `${rule.id}#${sourceIndex + 1}-${destinationIndex + 1}`,
              aclRuleId: rule.id,
              priority: rulePriority,
              source: ruleSource,
              acao: rule.action,
              origem,
              destino,
              vlan,
              servico: rule.service,
              enabled: rule.enabled,
              managed: rule.managed,
              stateful: rule.stateful ?? true,
              bidirectional: rule.bidirectional ?? false,
              passthrough: rule.passthrough ?? false,
              natExempt: rule.natExempt ?? false,
              protocol: rule.protocol ?? 'any',
              isReturnRule: rule.isReturnRule,
              hasConflict,
              missingReturn,
              isDerivedAllocation: sourceIndex > 0 || destinationIndex > 0,
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
              parentRuleId: rule.parentRuleId,
              fwNatMode: fwNatMode !== 'none' ? fwNatMode : undefined,
              ipsecAuthBadge,
            };

            return row;
          },
        );
      });
    });
  },
);

// Helper: group flat FirewallRuleRow array into parent+children groups sorted by priority
function sortedGroupedRows(rows: FirewallRuleRow[]): FirewallRuleRow[] {
  const groups: { parent: FirewallRuleRow; children: FirewallRuleRow[] }[] = [];
  for (const row of rows) {
    if (!row.isDerivedAllocation) {
      groups.push({ parent: row, children: [] });
    } else if (groups.length > 0) {
      groups[groups.length - 1].children.push(row);
    }
  }
  groups.sort((a, b) => a.parent.priority - b.parent.priority);
  return groups.flatMap((g) => [g.parent, ...g.children]);
}

export const selectFirewallRulesGrouped = createSelector(
  [selectFirewallRules],
  (flatRules): FirewallGroupedResult => {
    const manual = flatRules.filter(
      (r) => r.source === 'manual' && !r.natExempt,
    );
    const topology = flatRules.filter(
      (r) => r.source === 'topology' && !r.natExempt,
    );
    const natExempt = flatRules.filter((r) => r.natExempt);
    return {
      manualRules: sortedGroupedRows(manual),
      topologyRules: sortedGroupedRows(topology),
      natExemptRules: sortedGroupedRows(natExempt),
    };
  },
);
