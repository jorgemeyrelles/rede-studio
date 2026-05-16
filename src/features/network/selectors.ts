import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';
import type {
    BgpNeighborEntry,
    FirewallGroupedResult,
    FirewallRuleRow,
    NetworkReadinessRow,
    RouteRow,
    RoutingProtocolRow,
    SubnetRouteRow,
} from './types';
import {
    getNodeReservedRange, getSiteReserveRange, resolveGateway,
    resolveGatewayIpv6,
    resolveInterface,
    resolveRouteType
} from './utils';

export const selectNetworkState = (state: RootState) => state.network;

export const selectLegendTree = createSelector(
  [selectNetworkState],
  (network) => {
    const { sites, layers, nodes, links, siteNetworks } = network;

    const buildLayerEntry = (layer: (typeof layers)[0]) => {
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
    };

    return sites.map((site) => {
      const siteLayers = layers.filter((layer) => layer.siteId === site.id);
      const siteNets = (siteNetworks ?? []).filter((n) => n.siteId === site.id);

      // Camadas sem networkId (legado ou n\u00e3o agrupadas)
      const ungroupedLayers = siteLayers
        .filter((layer) => !layer.networkId)
        .map(buildLayerEntry);

      // Redes com suas camadas aninhadas
      const networks = siteNets.map((net) => ({
        ...net,
        layers: siteLayers
          .filter((layer) => layer.networkId === net.id)
          .map(buildLayerEntry),
      }));

      return {
        ...site,
        networks,
        layers: ungroupedLayers,
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

    const buildRouteRow = (
      link: (typeof links)[number],
      from: (typeof nodes)[number] | undefined,
      to: (typeof nodes)[number] | undefined,
    ): RouteRow => {
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

      const fromRoutingMode = String(
        from?.techProfile?.fields?.routingMode ?? 'static',
      );

      const tipo = resolveRouteType(
        link.kind,
        fromSiteId,
        toSiteId,
        from?.category,
        to?.category,
        fromRoutingMode,
      );
      const vlan =
        from && from.category !== 'wan' && (from.vlans ?? []).length > 0
          ? String(from.vlans[0])
          : '-';
      const gateway = resolveGateway(tipo, from?.ip, to?.ip);
      const gatewayIpv6 = resolveGatewayIpv6(tipo, from?.ipv6, to?.ipv6);
      const iface = resolveInterface(tipo, link.kind, counters);

      const redeDest =
        tipo === 'Default'
          ? '0.0.0.0/0'
          : `${to?.ip ?? '0.0.0.0'}/${to?.cidr ?? 0}`;

      const redeDestIpv6 =
        tipo === 'Default'
          ? '::/0'
          : to?.ipv6 && to?.ipv6 !== ''
            ? `${to.ipv6}/64`
            : '';

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
        redeDestIpv6,
        gateway,
        gatewayIpv6,
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
    };

    return links.flatMap((link) => {
      const from = nodes.find((node) => node.id === link.from);
      const to = nodes.find((node) => node.id === link.to);

      const rows: RouteRow[] = [buildRouteRow(link, from, to)];
      if (link.bidirectional ?? true) {
        rows.push(buildRouteRow(link, to, from));
      }
      return rows;
    });
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
      const linkedLink = rule.linkId
        ? links.find((l) => l.id === rule.linkId)
        : undefined;
      const linkBidirectional = linkedLink
        ? (linkedLink.bidirectional ?? true)
        : false;
      const effectiveBidirectional =
        (rule.bidirectional ?? false) || linkBidirectional;
      const effectiveDuplexMode = linkedLink?.duplexMode ?? 'full';
      const missingReturn =
        !isStateful &&
        !hasReturnRule &&
        !rule.isReturnRule &&
        !effectiveBidirectional;

      const sourceNode = getNode(rule.sourceNodeId);
      const destinationNode = getNode(rule.destinationNodeId);
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

      const swapVlanDirection = (value: string) => {
        const match = value.match(/^O: (.*) \| D: (.*)$/);
        if (!match) return value;
        return `O: ${match[2]} | D: ${match[1]}`;
      };

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

      const forwardRows = sourceAllocations.flatMap(
        (sourceAllocation, sourceIndex) => {
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
              bidirectional: effectiveBidirectional,
              duplexMode: effectiveDuplexMode,
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
        },
      );

      if (!effectiveBidirectional || rule.isReturnRule) {
        return forwardRows;
      }

      const reverseRows = forwardRows.map((row) => ({
        ...row,
        id: `${row.id}#rev`,
        origem: row.destino,
        destino: row.origem,
        vlan: swapVlanDirection(row.vlan),
        sourceNodeId: row.destinationNodeId,
        destinationNodeId: row.sourceNodeId,
        sourceNodeSiteId: row.destinationNodeSiteId,
        destinationNodeSiteId: row.sourceNodeSiteId,
        sourceScope: row.destinationScope,
        sourceVlanId: row.destinationVlanId,
        sourceIp: row.destinationIp,
        destinationScope: row.sourceScope,
        destinationVlanId: row.sourceVlanId,
        destinationIp: row.sourceIp,
      }));

      return [...forwardRows, ...reverseRows];
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

// ── Routing Protocol Table ────────────────────────────────────────────────────

function parseBgpNeighbors(raw: string): BgpNeighborEntry[] {
  if (!raw.trim()) return [];
  return raw.split(',').map((entry) => {
    const parts = entry.trim().split('/');
    return { ip: parts[0]?.trim() ?? '', remoteAsn: parts[1]?.trim() ?? '' };
  });
}

export const selectRoutingProtocolRows = createSelector(
  [selectNetworkState],
  (network): RoutingProtocolRow[] => {
    const { nodes, sites, links } = network;

    return nodes
      .filter((node) => node.category === 'router')
      .map((node) => {
        const site = sites.find((s) => s.id === node.siteId);
        const fields = node.techProfile?.fields ?? {};
        const mode = String(fields.routingMode ?? 'static') as
          | 'static'
          | 'ospf'
          | 'bgp'
          | 'mixed';

        const warnings: string[] = [];
        if (mode === 'bgp' || mode === 'mixed') {
          if (!String(fields.bgpAsn ?? '').trim())
            warnings.push('ASN local não definido');
          if (!String(fields.bgpNeighbors ?? '').trim())
            warnings.push('Nenhum neighbor configurado');
        }

        const bgpNeighborsRaw = String(fields.bgpNeighbors ?? '');
        const neighborCandidates = Array.from(
          new Set(
            links
              .filter((link) => link.from === node.id || link.to === node.id)
              .map((link) => (link.from === node.id ? link.to : link.from)),
          ),
        )
          .map((peerId) => nodes.find((candidate) => candidate.id === peerId))
          .filter((peer): peer is (typeof nodes)[number] => Boolean(peer))
          .map((peer) => ({
            nodeId: peer.id,
            nodeLabel: peer.label,
            ip: peer.ip?.trim() ?? '',
            remoteAsn: String(peer.techProfile?.fields?.bgpAsn ?? '').trim(),
          }))
          .filter((peer) => peer.ip !== '');

        return {
          nodeId: node.id,
          nodeLabel: node.label,
          siteId: node.siteId ?? site?.id ?? '',
          siteName: site?.name ?? '—',
          mode,
          // OSPF
          ospfArea:
            mode === 'ospf' || mode === 'mixed'
              ? String(fields.ospfArea ?? '0.0.0.0')
              : undefined,
          ospfHello:
            mode === 'ospf' || mode === 'mixed'
              ? Number(fields.ospfHello ?? 10)
              : undefined,
          ospfDead:
            mode === 'ospf' || mode === 'mixed'
              ? Number(fields.ospfDead ?? 40)
              : undefined,
          // BGP
          bgpAsn:
            mode === 'bgp' || mode === 'mixed'
              ? String(fields.bgpAsn ?? '')
              : undefined,
          bgpNeighborsParsed:
            mode === 'bgp' || mode === 'mixed'
              ? parseBgpNeighbors(bgpNeighborsRaw)
              : undefined,
          bgpNeighborsRaw:
            mode === 'bgp' || mode === 'mixed' ? bgpNeighborsRaw : undefined,
          bgpNeighborCandidates:
            mode === 'bgp' || mode === 'mixed'
              ? neighborCandidates
              : undefined,
          bgpPrefixListIn:
            mode === 'bgp' || mode === 'mixed'
              ? String(fields.bgpPrefixListIn ?? '')
              : undefined,
          bgpPrefixListOut:
            mode === 'bgp' || mode === 'mixed'
              ? String(fields.bgpPrefixListOut ?? '')
              : undefined,
          bgpMd5:
            mode === 'bgp' || mode === 'mixed'
              ? Boolean(fields.bgpMd5)
              : undefined,
          warnings,
        };
      });
  },
);

/**
 * P8 — Tabela de rotas derivada de sub-redes (Subnet) + interfaces VLAN (NodeVlanInterface).
 * Cada linha representa uma rota de sub-rede com gateway opcionalmente atribuído.
 */
export const selectSubnetRouteTable = createSelector(
  [selectNetworkState],
  (network): SubnetRouteRow[] => {
    const { subnets, siteVlans, sites, nodes, nodeVlanInterfaces, siteNetworks } = network;

    const resolveGatewayIface = (siteId: string, vlanId: number) => {
      const candidates = (nodeVlanInterfaces ?? []).filter(
        (i) => i.siteId === siteId && i.vlanId === vlanId,
      );

      if (candidates.length === 0) return null;

      const preferred = candidates.find((iface) => {
        const node = nodes.find((n) => n.id === iface.nodeId);
        return node?.category === 'router' || node?.category === 'firewall';
      });

      return preferred ?? candidates[0] ?? null;
    };

    const resolveVlanIpv6Prefix = (
      vlan: (typeof siteVlans)[number],
    ): string | undefined => {
      if (vlan.ipv6Prefix?.trim()) return vlan.ipv6Prefix.trim();
      if (!vlan.networkId) return undefined;
      const network = (siteNetworks ?? []).find((n) => n.id === vlan.networkId);
      const basePrefix = network?.ipv6Prefix?.trim();
      if (!basePrefix) return undefined;
      const [base] = basePrefix.split('/');
      if (!base) return undefined;
      const compactBase = base.replace(/::+$/, '').replace(/:$/, '');
      const vlanHex = vlan.vlanId.toString(16);
      return `${compactBase}:${vlanHex}::/64`;
    };

    const vlanBaseRows: SubnetRouteRow[] = (siteVlans ?? []).map((vlan) => {
      const site = sites.find((s) => s.id === vlan.siteId);
      const iface = resolveGatewayIface(vlan.siteId, vlan.vlanId);
      const gatewayNode = iface
        ? nodes.find((n) => n.id === iface.nodeId)
        : undefined;

      return {
        siteId: vlan.siteId,
        siteName: site?.name ?? vlan.siteId,
        vlanId: vlan.vlanId,
        vlanName: vlan.name ?? `VLAN ${vlan.vlanId}`,
        destination: `${vlan.startIp} - ${vlan.endIp}`,
        destinationIpv6: resolveVlanIpv6Prefix(vlan),
        gateway: iface?.gatewayIp ?? '',
        gatewayIpv6: iface?.gatewayIpv6 ?? '',
        gatewayNodeId: iface?.nodeId ?? '',
        gatewayNodeLabel: gatewayNode?.label ?? '',
        subnetName: 'VLAN base',
      };
    });

    const subnetRows: SubnetRouteRow[] = (subnets ?? []).map((subnet) => {
      const site = sites.find((s) => s.id === subnet.siteId);
      const vlan = (siteVlans ?? []).find(
        (v) => v.siteId === subnet.siteId && v.vlanId === subnet.vlanId,
      );

      const iface = resolveGatewayIface(subnet.siteId, subnet.vlanId);
      const gatewayNode = iface
        ? nodes.find((n) => n.id === iface.nodeId)
        : undefined;

      const destination = `${subnet.networkAddress}/${subnet.cidr}`;

      return {
        siteId: subnet.siteId,
        siteName: site?.name ?? subnet.siteId,
        vlanId: subnet.vlanId ?? 0,
        vlanName: vlan?.name ?? `VLAN ${subnet.vlanId ?? '—'}`,
        destination,
        destinationIpv6: subnet.ipv6Prefix?.trim() || (vlan ? resolveVlanIpv6Prefix(vlan) : undefined),
        gateway: iface?.gatewayIp ?? '',
        gatewayIpv6: iface?.gatewayIpv6 ?? '',
        gatewayNodeId: iface?.nodeId ?? '',
        gatewayNodeLabel: gatewayNode?.label ?? '',
        subnetName: subnet.name,
      };
    });

    return [...vlanBaseRows, ...subnetRows];
  },
);

export const selectNetworkReadiness = createSelector(
  [selectNetworkState],
  (network): NetworkReadinessRow[] => {
    const { siteNetworks, sites, nodes, siteVlans } = network;

    return (siteNetworks ?? []).map((net) => {
      const siteName = sites.find((s) => s.id === net.siteId)?.name ?? net.siteId;
      const issues: string[] = [];

      const stackMode = net.stackMode ?? 'ipv4';
      const gatewayMode = net.gatewayMode ?? 'ipv4-only';
      const dnsPolicy = net.dnsPolicy ?? 'a-only';
      const preference = net.trafficPreference ?? 'ipv4-preferred';

      const networkNodes = nodes.filter(
        (n) => n.networkId === net.id && n.category !== 'wan',
      );
      const nodesMissingIpv6 = networkNodes.filter(
        (n) => !(n.ipv6 && n.ipv6.trim() !== ''),
      ).length;

      const vlansInNetwork = (siteVlans ?? []).filter((v) => v.networkId === net.id);
      const vlansMissingIpv6 = vlansInNetwork.filter(
        (v) => !(v.ipv6Prefix && v.ipv6Prefix.trim() !== ''),
      ).length;

      if (stackMode !== 'ipv4' && !(net.ipv6Prefix && net.ipv6Prefix.trim() !== '')) {
        issues.push('Stack dual/IPv6 sem prefixo IPv6 definido na LAN.');
      }

      if (stackMode !== 'ipv4' && gatewayMode !== 'dual-gateway') {
        issues.push('Gateway não está em modo dual (v4+v6).');
      }

      if (stackMode !== 'ipv4' && dnsPolicy !== 'a-aaaa') {
        issues.push('Política DNS sem suporte completo A+AAAA.');
      }

      if (
        (preference === 'ipv6-preferred' || preference === 'ipv6-strict') &&
        nodesMissingIpv6 > 0
      ) {
        issues.push(`${nodesMissingIpv6} nó(s) da LAN sem IPv6 configurado.`);
      }

      if (preference === 'ipv6-strict' && stackMode === 'ipv4') {
        issues.push('Preferência IPv6 strict incompatível com stack IPv4 only.');
      }

      if (preference === 'ipv6-strict' && vlansMissingIpv6 > 0) {
        issues.push(`${vlansMissingIpv6} VLAN(s) sem prefixo IPv6 em modo strict.`);
      }

      const level: NetworkReadinessRow['level'] =
        issues.length === 0
          ? 'ready'
          : issues.some((i) =>
                i.includes('strict') || i.includes('sem prefixo IPv6 definido'),
              )
            ? 'critical'
            : 'warning';

      return {
        siteId: net.siteId,
        siteName,
        networkId: net.id,
        networkName: net.name,
        level,
        issues,
      };
    });
  },
);
