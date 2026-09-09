import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_QOS_TRUST, SCHEMA_VERSION, VLAN_COLOR_PALETTE } from './constants';
import {
    buildDefaultTechProfile,
    ensureTechProfile,
    normalizeTechProfile,
} from './techProfiles';
import type {
    AclRule,
    AddActiveSessionPayload,
    AddCertificatePayload,
    AddCustomAclRulePayload,
    AddCustomServicePayload,
    AddFwPolicyPayload,
    AddIpsecSaPayload,
    AddLayerPayload,
    AddLinkPayload,
    AddNatRulePayload,
    AddNodePayload,
    AddSiteNetworkPayload,
    AddSiteVlanPayload,
    AddSslVpnProfilePayload,
    AddSubnetPayload,
    ClearActiveSessionsPayload,
    DhcpScope,
    Layer,
    LinkDuplexMode,
    NetworkState,
    NodeCategory,
    NodeVlanInterface,
    RemoveCertificatePayload,
    RemoveCustomAclRulePayload,
    RemoveCustomServicePayload,
    RemoveDhcpScopePayload,
    RemoveFwPolicyPayload,
    RemoveIpsecSaPayload,
    RemoveNatRulePayload,
    RemoveSiteNetworkPayload,
    RemoveSiteVlanPayload,
    RemoveSslVpnProfilePayload,
    RemoveSubnetPayload,
    ReorderCustomAclRulePayload,
    SetAclChildOverridePayload,
    SetVlanAssignmentPayload,
    ToggleNodeVlanPayload,
    UpdateAclRulePayload,
    UpdateAclRuleQoSPayload,
    UpdateCertificatePayload,
    UpdateCustomServicePayload,
    UpdateFwPolicyPayload,
    UpdateIpsecSaPayload,
    UpdateLayerTierPayload,
    UpdateLinkPayload,
    UpdateNatRulePayload,
    UpdateNodePayload,
    UpdateNodeTechFieldPayload,
    UpdateNodeZonePayload,
    UpdateSitePayload,
    UpdateSslVpnProfilePayload,
    UpsertDhcpScopePayload,
} from './types';
import {
    assignNodeIpInsideVlan,
    assignNodeIpOutsideVlans,
    buildIpFromNetworkAndRadical,
    buildIpFromSiteAndRadical,
    buildNetworkAddress,
    buildNodeHostAllocations,
    buildNodeIp,
    buildNodeIpv6,
    buildNodeLabel,
    getCategoryCode,
    getCategoryHostBase,
    getNextNodeSequence,
    getVlanRange,
    ipToNumber,
    isIpInVlan,
    makeLayerId,
    makeNodeId,
    makeSiteId,
    managedAclRuleId,
    networkRangeBounds,
    normalizeAclRule,
    normalizeNodeVlansForCatalog,
    numberToIp,
    parseTrailingNumber,
    reconcileAclRules,
    siteOwnsVlan,
    siteRangeBounds,
    suggestAclRuleQoS,
    toValidVlanId,
} from './utils';

function defaultTrafficPreferenceByStack(
  stackMode: import('./types/entities').NetworkStackMode | undefined,
): import('./types/entities').NetworkTrafficPreference {
  if (stackMode === 'dual-stack') return 'balanced';
  if (stackMode === 'ipv6-ready') return 'ipv6-preferred';
  return 'ipv4-preferred';
}

function isStaticAddressAllocation(
  mode: import('./types/entities').AddressAllocationMode | undefined,
) {
  return (
    mode === 'static-ipv4' ||
    mode === 'static-ipv6' ||
    mode === 'static-dual'
  );
}

function defaultDhcpIpv6ModeByAllocation(
  mode: import('./types/entities').AddressAllocationMode,
): import('./types/entities').DhcpScopeIpv6Mode {
  if (mode === 'slaac') return 'slaac';
  if (mode === 'dhcpv6') return 'dhcpv6-stateful';
  if (mode === 'dual-dhcp-slaac') return 'dhcpv6-stateless';
  return 'none';
}

function buildDefaultDhcpScopeForVlan(
  vlan: Pick<
    import('./types/entities').SiteVlan,
    'siteId' | 'vlanId' | 'startIp' | 'endIp' | 'addressAllocation'
  >,
): DhcpScope {
  const allocationMode = vlan.addressAllocation ?? 'dhcpv4';
  return {
    id: `${vlan.siteId}-vlan-${vlan.vlanId}-dhcp`,
    siteId: vlan.siteId,
    vlanId: vlan.vlanId,
    allocationMode,
    providerType: 'node',
    poolStartIp: vlan.startIp,
    poolEndIp: vlan.endIp,
    excludedIps: [],
    leaseMinutes: 1440,
    dnsServers: [],
    ipv6Mode: defaultDhcpIpv6ModeByAllocation(allocationMode),
    ipv6DnsServers: [],
    notes: '',
  };
}

export const networkInitialState: NetworkState = {
  sites: [],
  layers: [],
  nodes: [
    {
      id: 'WAN1',
      label: 'WAN/Internet',
      category: 'wan',
      ip: '',
      hostCount: 1,
      hostAllocations: [{ id: 'WAN1', ip: '' }],
      cidr: 0,
      vlans: [],
      x: 680,
      y: 80,
      description: 'Ponto central de conectividade externa.',
      techProfile: buildDefaultTechProfile('wan', {
        layerOrder: 0,
        shouldBeGateway: false,
        siteNodeCount: 0,
      }),
    },
  ],
  links: [],
  aclRules: [],
  siteVlans: [],
  siteNetworks: [],
  subnets: [],
  nodeVlanInterfaces: [],
  dhcpScopes: [],
  nodeQosProfiles: [],
  // Fase 3
  customServices: [],
  certificates: [],
  ipsecSas: [],
  sslVpnProfiles: [],
  fwPolicies: [],
  natRules: [],
  activeSessions: [],
  counters: {
    site: 1,
    layer: 1,
    node: 1,
    link: 1,
  },
  ui: {
    inspectorNodeId: null,
    activeLinkId: null,
    zoom: 1,
    vlanAssignment: null,
  },
  meta: {
    schemaVersion: SCHEMA_VERSION,
    projectName: 'Projeto Rede Interativa',
    persistWarning: null,
    lastSavedAt: null,
    saveStatus: 'idle',
  },
};

function getLayerOrder(layers: Layer[], siteId: string) {
  return layers.filter((layer) => layer.siteId === siteId).length + 1;
}

function getInitialNodePosition(
  state: NetworkState,
  siteId: string,
  layerId: string,
  layerOrder: number,
  category: NodeCategory,
) {
  const nodesInLayer = state.nodes.filter(
    (node) => node.layerId === layerId,
  ).length;
  const nodesInCategory = state.nodes.filter(
    (node) => node.layerId === layerId && node.category === category,
  ).length;
  const siteIndex = state.sites.findIndex((site) => site.id === siteId);
  const safeSiteIndex = Math.max(0, siteIndex);

  // Aproxima a malha usada no diagrama para que o nó nasça visível dentro da camada.
  const cols = state.sites.length <= 4 ? 2 : 3;
  const col = safeSiteIndex % cols;
  const row = Math.floor(safeSiteIndex / cols);

  const siteBaseX = 120 + col * 420;
  const siteBaseY = 180 + row * 340;
  const layerYOffset = (Math.max(1, layerOrder) - 1) * 230;

  const categoryLane = Math.max(
    0,
    Math.min(5, Math.floor(getCategoryHostBase(category) / 40)),
  );
  const offsetX = 70 + categoryLane * 52 + (nodesInCategory % 2) * 30;
  const offsetY = 70 + (nodesInLayer % 4) * 62;

  return {
    x: siteBaseX + offsetX,
    y: siteBaseY + layerYOffset + offsetY,
  };
}

function shouldNodeBeGateway(
  state: NetworkState,
  siteId: string,
  layerOrder: number,
  category: NodeCategory,
) {
  if (layerOrder !== 1) return false;
  if (category !== 'router' && category !== 'firewall') return false;

  const hasGatewayInSite = state.nodes.some(
    (node) =>
      node.siteId === siteId &&
      (node.techProfile?.fields?.gatewayDefault === true ||
        ((node.category === 'router' || node.category === 'firewall') &&
          node.layerId &&
          state.layers.find((layer) => layer.id === node.layerId)?.order ===
            1)),
  );

  return !hasGatewayInSite;
}

const ZONE_DIRECTION_RANK: Record<string, number> = {
  wan: 0,
  dmz: 1,
  vpn: 2,
  lan: 3,
  guest: 4,
  management: 5,
  mgmt: 5,
};

const CATEGORY_DIRECTION_RANK: Partial<Record<NodeCategory, number>> = {
  wan: 0,
  mpls: 1,
  vpn: 1,
  ipsec: 1,
  wireguard: 1,
  sdwan: 1,
  gre: 1,
  firewall: 2,
  router: 3,
  proxy: 4,
  ids: 4,
  ips: 4,
  switch: 5,
};

function compareNodesForDirection(
  a: NetworkState['nodes'][number],
  b: NetworkState['nodes'][number],
) {
  // WAN is always considered the external/source side.
  if (a.category === 'wan' && b.category !== 'wan') return -1;
  if (b.category === 'wan' && a.category !== 'wan') return 1;

  const aZoneRank = ZONE_DIRECTION_RANK[(a.zone ?? '').toLowerCase()] ?? 99;
  const bZoneRank = ZONE_DIRECTION_RANK[(b.zone ?? '').toLowerCase()] ?? 99;
  if (aZoneRank !== bZoneRank) return aZoneRank - bZoneRank;

  // Inter-site links keep a stable direction based on siteId.
  if (a.siteId && b.siteId && a.siteId !== b.siteId) {
    return a.siteId.localeCompare(b.siteId);
  }

  const aCategoryRank = CATEGORY_DIRECTION_RANK[a.category] ?? 99;
  const bCategoryRank = CATEGORY_DIRECTION_RANK[b.category] ?? 99;
  if (aCategoryRank !== bCategoryRank) return aCategoryRank - bCategoryRank;

  return a.id.localeCompare(b.id);
}

function normalizeLinkDirection(
  state: NetworkState,
  fromNodeId: string,
  toNodeId: string,
) {
  const fromNode = state.nodes.find((node) => node.id === fromNodeId);
  const toNode = state.nodes.find((node) => node.id === toNodeId);
  if (!fromNode || !toNode) return { from: fromNodeId, to: toNodeId };

  return compareNodesForDirection(fromNode, toNode) <= 0
    ? { from: fromNodeId, to: toNodeId }
    : { from: toNodeId, to: fromNodeId };
}

function inferLinkKind(
  state: NetworkState,
  fromNodeId: string,
  toNodeId: string,
  providedKind?: AddLinkPayload['kind'],
) {
  if (providedKind) return providedKind;

  const fromNode = state.nodes.find((node) => node.id === fromNodeId);
  const toNode = state.nodes.find((node) => node.id === toNodeId);
  const categories = new Set([fromNode?.category, toNode?.category]);

  if (categories.has('ipsec')) return 'ipsec';
  if (categories.has('vpn') || categories.has('wireguard')) return 'vpn';
  if (categories.has('wan')) return 'wan';
  if (fromNode?.siteId && toNode?.siteId && fromNode.siteId === toNode.siteId) {
    // Mesmo site — verifica se os nós pertencem a redes diferentes (inter-lan)
    const fromNetId = fromNode.networkId;
    const toNetId = toNode.networkId;
    if (fromNetId && toNetId && fromNetId !== toNetId) {
      return 'inter-lan';
    }
    return 'lan';
  }

  return 'other';
}

function inferLinkBidirectionalDefault(
  nodes: NetworkState['nodes'],
  fromNodeId: string,
  toNodeId: string,
  kind: AddLinkPayload['kind'] | NetworkState['links'][number]['kind'],
) {
  if (kind === 'vpn' || kind === 'ipsec') return true;

  const fromNode = nodes.find((node) => node.id === fromNodeId);
  const toNode = nodes.find((node) => node.id === toNodeId);
  const hasDmz = [fromNode, toNode].some(
    (node) => (node?.zone ?? '').toLowerCase() === 'dmz',
  );

  // Matrix 3 default: DMZ links start as directional; others bidirectional.
  return !hasDmz;
}

function inferLinkDuplexModeDefault(
  nodes: NetworkState['nodes'],
  fromNodeId: string,
  toNodeId: string,
  kind: AddLinkPayload['kind'] | NetworkState['links'][number]['kind'],
): LinkDuplexMode {
  const fromNode = nodes.find((node) => node.id === fromNodeId);
  const toNode = nodes.find((node) => node.id === toNodeId);

  const isWirelessNode = (
    node: NetworkState['nodes'][number] | undefined,
  ) => {
    if (!node) return false;
    if (node.category === 'access-point') return true;

    const fields = node.techProfile?.fields ?? {};
    const band = String(fields.band ?? '').toLowerCase();
    const ssid = String(fields.ssid ?? '').trim();
    const wirelessSecurity = String(fields.wirelessSecurity ?? '').trim();
    const channelWidth = String(fields.channelWidth ?? '').trim();
    const role = String(fields.role ?? '').toLowerCase();

    return (
      ssid !== '' ||
      wirelessSecurity !== '' ||
      channelWidth !== '' ||
      band.includes('ghz') ||
      band.includes('dual') ||
      role.includes('wireless') ||
      role.includes('wifi') ||
      role.includes('wlan') ||
      role.includes('radio')
    );
  };

  const hasWirelessHop =
    isWirelessNode(fromNode) || isWirelessNode(toNode);
  if (hasWirelessHop) return 'half';

  if (kind === 'wan' || kind === 'vpn' || kind === 'ipsec') {
    return 'full';
  }

  return 'full';
}

function collectScopedUsedHostIds(
  nodes: NetworkState['nodes'],
  target: Pick<
    NetworkState['nodes'][number],
    'id' | 'siteId' | 'layerId' | 'category'
  >,
) {
  const usedIds = new Set<string>();

  nodes
    .filter(
      (candidate) =>
        candidate.id !== target.id &&
        candidate.category === target.category &&
        candidate.siteId === target.siteId &&
        candidate.layerId === target.layerId,
    )
    .forEach((candidate) => {
      usedIds.add(candidate.id);
      (candidate.hostAllocations ?? []).forEach((allocation) => {
        usedIds.add(allocation.id);
      });
    });

  return usedIds;
}

function isAccessPointL3Mode(
  node: Pick<NetworkState['nodes'][number], 'category' | 'techProfile'>,
) {
  if (node.category !== 'access-point') return false;
  return String(node.techProfile?.fields?.apInterfaceMode ?? 'l2-bridge') === 'l3-routed';
}

function resolveAccessPointManagementVlanId(
  node: Pick<NetworkState['nodes'][number], 'category' | 'techProfile'>,
) {
  if (node.category !== 'access-point') return null;
  const raw = String(node.techProfile?.fields?.apManagementVlanId ?? '').trim();
  if (raw === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  const vlanId = Math.trunc(parsed);
  if (vlanId < 1 || vlanId > 4094) return null;
  return vlanId;
}

function findNextFreeGatewayIpInVlan(
  state: NetworkState,
  node: NetworkState['nodes'][number],
  vlan: NetworkState['siteVlans'][number],
) {
  const range = getVlanRange(vlan);
  if (!range) return null;

  const occupied = new Set<number>();

  state.nodes
    .filter((candidate) => candidate.siteId === vlan.siteId && candidate.category !== 'wan')
    .forEach((candidate) => {
      const allocationIps =
        (candidate.hostAllocations ?? []).length > 0
          ? candidate.hostAllocations.map((allocation) => allocation.ip)
          : [candidate.ip];

      allocationIps.forEach((ip) => {
        const value = ipToNumber(ip);
        if (value !== null) {
          occupied.add(value);
        }
      });
    });

  state.nodeVlanInterfaces.forEach((iface) => {
    if (iface.siteId !== vlan.siteId) return;
    if (iface.nodeId === node.id && iface.vlanId === vlan.vlanId) return;

    const value = ipToNumber(iface.gatewayIp);
    if (value !== null) {
      occupied.add(value);
    }
  });

  for (let candidate = range.start; candidate <= range.end; candidate += 1) {
    if (!occupied.has(candidate)) {
      return numberToIp(candidate);
    }
  }

  return null;
}

function ensureNodeVlanInterfaceForNode(
  state: NetworkState,
  node: NetworkState['nodes'][number],
  vlan: NetworkState['siteVlans'][number],
) {
  const alreadyHasIface = state.nodeVlanInterfaces.some(
    (iface) => iface.nodeId === node.id && iface.vlanId === vlan.vlanId,
  );
  if (alreadyHasIface) {
    return true;
  }

  const nextGatewayIp = findNextFreeGatewayIpInVlan(state, node, vlan);
  if (!nextGatewayIp) {
    state.meta.persistWarning = `VLAN ${vlan.vlanId} sem IP livre para interface de ${node.label}.`;
    return false;
  }

  state.nodeVlanInterfaces.push({
    id: `nvif-${node.id}-${vlan.vlanId}-${Date.now()}`,
    nodeId: node.id,
    siteId: vlan.siteId,
    vlanId: vlan.vlanId,
    gatewayIp: nextGatewayIp,
  });

  return true;
}

function syncAccessPointVlanInterfacesByMode(
  state: NetworkState,
  node: NetworkState['nodes'][number],
) {
  if (node.category !== 'access-point' || !node.siteId) return;

  if (!isAccessPointL3Mode(node)) {
    state.nodeVlanInterfaces = state.nodeVlanInterfaces.filter(
      (iface) => iface.nodeId !== node.id,
    );
    return;
  }

  const vlanIds = new Set((node.vlans ?? []).map((value) => toValidVlanId(Number(value))));

  state.nodeVlanInterfaces = state.nodeVlanInterfaces.filter(
    (iface) => iface.nodeId !== node.id || vlanIds.has(iface.vlanId),
  );

  (node.vlans ?? []).forEach((vlanId) => {
    const vlan = state.siteVlans.find(
      (item) => item.siteId === node.siteId && item.vlanId === vlanId,
    );
    if (!vlan) return;

    ensureNodeVlanInterfaceForNode(state, node, vlan);
  });
}

function normalizeState(input: NetworkState): NetworkState {
  const siteIdMap = new Map<string, string>();
  const normalizedSites = (input.sites ?? []).map((site, index) => {
    const compactId = /^S\d+$/.test(site.id)
      ? site.id
      : makeSiteId(parseTrailingNumber(site.id, index + 1));
    siteIdMap.set(site.id, compactId);

    return {
      ...site,
      id: compactId,
      reserveMarginPercent: Math.max(
        0,
        Math.min(100, Math.trunc(Number(site.reserveMarginPercent ?? 10))),
      ),
    };
  });

  const layerIdMap = new Map<string, string>();
  const normalizedLayers = (input.layers ?? []).map((layer, index) => {
    const mappedSiteId = siteIdMap.get(layer.siteId) ?? layer.siteId;
    const layerIndex = Math.max(
      1,
      Math.trunc(
        Number(layer.order ?? parseTrailingNumber(layer.id, index + 1)),
      ),
    );
    const compactId = /^S\d+\.C\d+$/.test(layer.id)
      ? `${mappedSiteId}.C${parseTrailingNumber(layer.id, layerIndex)}`
      : makeLayerId(mappedSiteId, layerIndex);
    layerIdMap.set(layer.id, compactId);

    return {
      ...layer,
      id: compactId,
      siteId: mappedSiteId,
    };
  });

  const normalizedSiteVlans = Array.isArray(input.siteVlans)
    ? input.siteVlans
        .filter((item) =>
          Boolean(
            item &&
            item.siteId &&
            normalizedSites.some(
              (site) => site.id === (siteIdMap.get(item.siteId) ?? item.siteId),
            ),
          ),
        )
        .map((item) => {
          const mappedSiteId = siteIdMap.get(item.siteId) ?? item.siteId;
          const site = normalizedSites.find(
            (siteItem) => siteItem.id === mappedSiteId,
          );
          const normalizedNetworkId =
            typeof item.networkId === 'string' &&
            item.networkId.trim() !== '' &&
            Array.isArray(input.siteNetworks) &&
            input.siteNetworks.some((network) => {
              const networkSiteId = siteIdMap.get(network.siteId) ?? network.siteId;
              return network.id === item.networkId && networkSiteId === mappedSiteId;
            })
              ? item.networkId
              : undefined;
          const vlanId = toValidVlanId(Number(item.vlanId));

          const vlanNodes = input.nodes.filter(
            (node) =>
              (siteIdMap.get(node.siteId ?? '') ?? node.siteId) ===
                mappedSiteId &&
              (node.vlans ?? []).map((value) => Number(value)).includes(vlanId),
          );
          const ipNumbers = vlanNodes
            .map((node) => ipToNumber(node.ip))
            .filter((value): value is number => value !== null)
            .sort((a, b) => a - b);

          const fallbackStartIp = `200.${site?.ipOctet ?? 10}.1.${Math.max(
            1,
            Math.min(254, vlanId),
          )}`;
          const rawStartIp =
            typeof item.startIp === 'string' &&
            ipToNumber(item.startIp) !== null
              ? item.startIp
              : ipNumbers.length > 0
                ? numberToIp(ipNumbers[0])
                : fallbackStartIp;

          const rawCapacity =
            typeof item.capacity === 'number' && Number.isFinite(item.capacity)
              ? Math.max(1, Math.trunc(item.capacity))
              : ipNumbers.length > 0
                ? ipNumbers[ipNumbers.length - 1] - ipNumbers[0] + 1
                : 64;

          const rawEndIpFromItem =
            typeof item.endIp === 'string' && ipToNumber(item.endIp) !== null
              ? item.endIp
              : null;
          const computedEndIp = (() => {
            const startNumber = ipToNumber(rawStartIp);
            if (startNumber === null) return rawStartIp;
            return numberToIp(startNumber + rawCapacity - 1);
          })();

          const startParts = rawStartIp.split('.');
          const startRadical =
            typeof item.startRadical === 'string' &&
            item.startRadical.includes('.')
              ? item.startRadical
              : `${startParts[2] ?? '1'}.${startParts[3] ?? '1'}`;

          return {
            id: item.id || `${mappedSiteId}-vlan-${vlanId}`,
            siteId: mappedSiteId,
            vlanId,
            name: item.name || `VLAN ${vlanId}`,
            capacity: rawCapacity,
            startRadical,
            startIp: rawStartIp,
            endIp: rawEndIpFromItem ?? computedEndIp,
            networkId: normalizedNetworkId,
            ipv6Prefix: item.ipv6Prefix?.trim() || undefined,
            addressAllocation: item.addressAllocation ?? 'dhcpv4',
            // P2 — preserva cor existente; se ausente, atribui pela paleta
            color: typeof item.color === 'string' && item.color
              ? item.color
              : undefined,
          };
        })
    : [];

  const nodeIdMap = new Map<string, string>();
  const normalizedNodes = normalizeNodeVlansForCatalog(
    input.nodes.map((node, index) => {
      const mappedSiteId = node.siteId
        ? (siteIdMap.get(node.siteId) ?? node.siteId)
        : undefined;
      const mappedLayerId = node.layerId
        ? (layerIdMap.get(node.layerId) ?? node.layerId)
        : undefined;
      const layerOrder = mappedLayerId
        ? (normalizedLayers.find((layer) => layer.id === mappedLayerId)
            ?.order ?? 1)
        : 0;
      const shouldBeGateway =
        mappedSiteId &&
        (node.category === 'router' || node.category === 'firewall') &&
        layerOrder === 1;
      const compactId = (() => {
        if (node.category === 'wan') {
          return /^WAN\d+$/.test(node.id)
            ? node.id
            : `WAN${parseTrailingNumber(node.id, 1)}`;
        }

        const seq = parseTrailingNumber(node.id, index + 1);
        if (mappedSiteId && mappedLayerId) {
          return `${mappedLayerId}.${getCategoryCode(node.category)}${seq}`;
        }

        return `${getCategoryCode(node.category)}${seq}`;
      })();
      nodeIdMap.set(node.id, compactId);

      return {
        ...node,
        id: compactId,
        siteId: mappedSiteId,
        layerId: mappedLayerId,
        ipv6: node.ipv6?.trim() || undefined,
        hostCount:
          node.category === 'wan'
            ? 1
            : Math.max(1, Math.trunc(Number(node.hostCount ?? 1) || 1)),
        hostAllocations: buildNodeHostAllocations({
          id: compactId,
          ip: node.ip,
          hostCount:
            node.category === 'wan'
              ? 1
              : Math.max(1, Math.trunc(Number(node.hostCount ?? 1) || 1)),
        }),
        originalIp:
          node.category === 'wan'
            ? undefined
            : node.originalIp && ipToNumber(node.originalIp) !== null
              ? node.originalIp
              : node.ip,
        originalIpv6:
          node.category === 'wan'
            ? undefined
            : node.originalIpv6?.trim() || node.ipv6?.trim() || undefined,
        techProfile: ensureTechProfile(node.category, node.techProfile, {
          layerOrder,
          shouldBeGateway: Boolean(shouldBeGateway),
          siteNodeCount: mappedSiteId
            ? input.nodes.filter(
                (item) =>
                  (siteIdMap.get(item.siteId ?? '') ?? item.siteId) ===
                  mappedSiteId,
              ).length
            : 0,
        }),
      };
    }),
    normalizedSiteVlans,
  );

  normalizedNodes.forEach((node) => {
    if (node.category === 'wan') {
      node.hostAllocations = [{ id: node.id, ip: node.ip }];
      return;
    }

    const usedIds = collectScopedUsedHostIds(normalizedNodes, node);
    node.hostAllocations = buildNodeHostAllocations(node, { usedIds });
  });

  const normalizedLinks = (input.links ?? []).map((link) => {
    const from = nodeIdMap.get(link.from) ?? link.from;
    const to = nodeIdMap.get(link.to) ?? link.to;
    const defaultBidirectional = inferLinkBidirectionalDefault(
      normalizedNodes,
      from,
      to,
      link.kind,
    );
    const defaultDuplexMode = inferLinkDuplexModeDefault(
      normalizedNodes,
      from,
      to,
      link.kind,
    );

    return {
      ...link,
      from,
      to,
      bidirectional: link.bidirectional ?? defaultBidirectional,
      duplexMode: link.duplexMode ?? defaultDuplexMode,
    };
  });

  const remappedAclRules = (input.aclRules ?? []).map((rule) => ({
    ...rule,
    sourceNodeId: nodeIdMap.get(rule.sourceNodeId) ?? rule.sourceNodeId,
    destinationNodeId:
      nodeIdMap.get(rule.destinationNodeId) ?? rule.destinationNodeId,
  }));

  const fallbackUi = input.ui ?? { inspectorNodeId: null, zoom: 1 };

  // P2 — backfill de cores: VLANs sem cor recebem cor da paleta pelo índice no site
  const siteVlanColorCounters = new Map<string, number>();
  const coloredSiteVlans = normalizedSiteVlans.map((vlan) => {
    if (vlan.color) return vlan;
    const idx = siteVlanColorCounters.get(vlan.siteId) ?? 0;
    siteVlanColorCounters.set(vlan.siteId, idx + 1);
    return { ...vlan, color: VLAN_COLOR_PALETTE[idx % VLAN_COLOR_PALETTE.length] };
  });

  const normalizedDhcpScopes = (() => {
    const sourceScopes = Array.isArray(input.dhcpScopes) ? input.dhcpScopes : [];

    const remappedScopes = sourceScopes
      .map((scope) => {
        const siteId = siteIdMap.get(scope.siteId) ?? scope.siteId;
        const vlanId = toValidVlanId(Number(scope.vlanId));
        const vlan = coloredSiteVlans.find(
          (item) => item.siteId === siteId && item.vlanId === vlanId,
        );
        if (!vlan) return null;

        const allocationMode =
          scope.allocationMode ?? vlan.addressAllocation ?? 'dhcpv4';
        if (isStaticAddressAllocation(allocationMode)) return null;

        const cleanList = (values: string[] | undefined) =>
          (values ?? [])
            .map((value) => value.trim())
            .filter((value, index, self) => value !== '' && self.indexOf(value) === index);

        return {
          id: scope.id || `${siteId}-vlan-${vlanId}-dhcp`,
          siteId,
          vlanId,
          allocationMode,
          providerType: scope.providerType ?? 'node',
          providerNodeId: scope.providerNodeId
            ? nodeIdMap.get(scope.providerNodeId) ?? scope.providerNodeId
            : undefined,
          relayNodeId: scope.relayNodeId
            ? nodeIdMap.get(scope.relayNodeId) ?? scope.relayNodeId
            : undefined,
          poolStartIp: scope.poolStartIp?.trim() || vlan.startIp,
          poolEndIp: scope.poolEndIp?.trim() || vlan.endIp,
          excludedIps: cleanList(scope.excludedIps),
          leaseMinutes: Math.max(
            1,
            Math.min(43200, Math.trunc(Number(scope.leaseMinutes ?? 1440))),
          ),
          dnsServers: cleanList(scope.dnsServers),
          ipv6Mode:
            scope.ipv6Mode ?? defaultDhcpIpv6ModeByAllocation(allocationMode),
          ipv6DnsServers: cleanList(scope.ipv6DnsServers),
          notes: scope.notes?.trim() ?? '',
        } as DhcpScope;
      })
      .filter((scope): scope is DhcpScope => Boolean(scope));

    const keyedScopes = new Map<string, DhcpScope>();
    remappedScopes.forEach((scope) => {
      keyedScopes.set(`${scope.siteId}|${scope.vlanId}`, scope);
    });

    coloredSiteVlans.forEach((vlan) => {
      const allocationMode = vlan.addressAllocation ?? 'dhcpv4';
      if (isStaticAddressAllocation(allocationMode)) return;
      const key = `${vlan.siteId}|${vlan.vlanId}`;
      if (!keyedScopes.has(key)) {
        keyedScopes.set(key, buildDefaultDhcpScopeForVlan(vlan));
      }
    });

    return Array.from(keyedScopes.values());
  })();

  return {
    ...input,
    sites: normalizedSites,
    layers: normalizedLayers,
    siteVlans: coloredSiteVlans,
    // Fase 2 — preserva ou inicializa arrays; filtra orphans (siteId inválido)
    siteNetworks: Array.isArray(input.siteNetworks)
      ? input.siteNetworks
          .filter((n) =>
            normalizedSites.some(
              (s) => s.id === (siteIdMap.get(n.siteId) ?? n.siteId),
            ),
          )
          .map((n) => ({
            ...n,
            siteId: siteIdMap.get(n.siteId) ?? n.siteId,
            stackMode: n.stackMode ?? 'ipv4',
            gatewayMode: n.gatewayMode ?? 'ipv4-only',
            dnsPolicy: n.dnsPolicy ?? 'a-only',
            ipv6Prefix: n.ipv6Prefix?.trim() || undefined,
            ipv6VlanPrefixLength: Math.max(
              48,
              Math.min(64, Math.trunc(n.ipv6VlanPrefixLength ?? 64)),
            ),
            trafficPreference:
              n.trafficPreference ??
              defaultTrafficPreferenceByStack(n.stackMode),
          }))
      : [],
    subnets: Array.isArray(input.subnets)
      ? input.subnets
          .filter((s) =>
            normalizedSites.some(
              (site) => site.id === (siteIdMap.get(s.siteId) ?? s.siteId),
            ),
          )
          .map((s) => ({
            ...s,
            siteId: siteIdMap.get(s.siteId) ?? s.siteId,
            ipv6Prefix: s.ipv6Prefix?.trim() || undefined,
          }))
      : [],
    // Fase 3 — preservar como estão (não dependem de IDs normalizados)
    customServices: Array.isArray(input.customServices)
      ? input.customServices
      : [],
    certificates: Array.isArray(input.certificates) ? input.certificates : [],
    ipsecSas: Array.isArray(input.ipsecSas)
      ? input.ipsecSas.filter((sa) =>
          normalizedLinks.some((l) => l.id === sa.linkId),
        )
      : [],
    sslVpnProfiles: Array.isArray(input.sslVpnProfiles)
      ? input.sslVpnProfiles.filter((p) =>
          normalizedLinks.some((l) => l.id === p.linkId),
        )
      : [],
    fwPolicies: Array.isArray(input.fwPolicies)
      ? input.fwPolicies.filter((p) =>
          normalizedNodes.some((n) => n.id === p.nodeId),
        )
      : [],
    natRules: Array.isArray(input.natRules)
      ? input.natRules.filter((r) =>
          normalizedNodes.some((n) => n.id === r.nodeId),
        )
      : [],
    activeSessions: Array.isArray(input.activeSessions)
      ? input.activeSessions.filter((s) =>
          normalizedNodes.some((n) => n.id === s.nodeId),
        )
      : [],
    // P11 — preservar interfaces VLAN (remapear nodeId se necessário)
    nodeVlanInterfaces: Array.isArray(input.nodeVlanInterfaces)
      ? input.nodeVlanInterfaces
          .map((i) => ({
            ...i,
            nodeId: nodeIdMap.get(i.nodeId) ?? i.nodeId,
            siteId: siteIdMap.get(i.siteId) ?? i.siteId,
            gatewayIpv6: i.gatewayIpv6?.trim() || undefined,
          }))
          .filter((i) => normalizedNodes.some((n) => n.id === i.nodeId))
      : [],
    dhcpScopes: normalizedDhcpScopes,
    // P16 — preservar perfis QoS, remapeando nodeId
    nodeQosProfiles: Array.isArray(input.nodeQosProfiles)
      ? input.nodeQosProfiles
          .map((p) => ({ ...p, nodeId: nodeIdMap.get(p.nodeId) ?? p.nodeId }))
          .filter((p) => normalizedNodes.some((n) => n.id === p.nodeId))
      : [],
    nodes: normalizedNodes,
    links: normalizedLinks,
    ui: {
      ...fallbackUi,
      inspectorNodeId: fallbackUi.inspectorNodeId
        ? (nodeIdMap.get(fallbackUi.inspectorNodeId) ??
          fallbackUi.inspectorNodeId)
        : null,
      vlanAssignment:
        fallbackUi.vlanAssignment &&
        siteOwnsVlan(
          normalizedSiteVlans,
          siteIdMap.get(fallbackUi.vlanAssignment.siteId) ??
            fallbackUi.vlanAssignment.siteId,
          toValidVlanId(Number(fallbackUi.vlanAssignment.vlanId)),
        )
          ? {
              siteId:
                siteIdMap.get(fallbackUi.vlanAssignment.siteId) ??
                fallbackUi.vlanAssignment.siteId,
              vlanId: toValidVlanId(Number(fallbackUi.vlanAssignment.vlanId)),
            }
          : null,
    },
    aclRules: reconcileAclRules({
      aclRules: remappedAclRules,
      links: normalizedLinks,
      nodes: normalizedNodes,
      siteVlans: normalizedSiteVlans,
    }),
  };
}

export const networkSlice = createSlice({
  name: 'network',
  initialState: networkInitialState,
  reducers: {
    resetNetworkState: () => ({
      ...networkInitialState,
      sites: [],
      layers: [],
      links: [],
      aclRules: [],
      siteVlans: [],
      siteNetworks: [],
      subnets: [],
      nodeVlanInterfaces: [],
      dhcpScopes: [],
      customServices: [],
      certificates: [],
      ipsecSas: [],
      sslVpnProfiles: [],
      fwPolicies: [],
      natRules: [],
      activeSessions: [],
      nodes: [...networkInitialState.nodes],
      counters: { ...networkInitialState.counters },
      ui: { ...networkInitialState.ui, activeLinkId: null, vlanAssignment: null },
      meta: { ...networkInitialState.meta },
    }),
    hydrateNetworkState: (_state, action: PayloadAction<NetworkState>) => {
      return normalizeState(action.payload);
    },
    addSite: (state) => {
      if (state.sites.length >= 4) {
        state.meta.persistWarning =
          'Limite de 4 sites nesta versao inicial do Studio.';
        return;
      }
      const siteId = makeSiteId(state.counters.site);
      const siteNumber = state.counters.site;
      state.sites.push({
        id: siteId,
        name: `Site ${siteNumber}`,
        ipOctet: Math.min(240, siteNumber * 10),
        cidr: 30,
        reserveMarginPercent: 10,
      });
      state.counters.site += 1;
    },
    removeSite: (state, action: PayloadAction<string>) => {
      const siteId = action.payload;
      const layersToDelete = state.layers
        .filter((layer) => layer.siteId === siteId)
        .map((layer) => layer.id);
      const nodesToDelete = state.nodes
        .filter((node) => node.siteId === siteId)
        .map((node) => node.id);

      state.sites = state.sites.filter((site) => site.id !== siteId);
      state.layers = state.layers.filter((layer) => layer.siteId !== siteId);
      state.siteVlans = state.siteVlans.filter(
        (item) => item.siteId !== siteId,
      );
      state.dhcpScopes = state.dhcpScopes.filter(
        (item) => item.siteId !== siteId,
      );
      state.nodes = state.nodes.filter((node) => node.siteId !== siteId);
      state.links = state.links.filter(
        (link) =>
          !nodesToDelete.includes(link.from) &&
          !nodesToDelete.includes(link.to),
      );
      state.aclRules = reconcileAclRules(state);
      if (
        state.ui.inspectorNodeId &&
        nodesToDelete.includes(state.ui.inspectorNodeId)
      ) {
        state.ui.inspectorNodeId = null;
      }

      if (layersToDelete.length === 0 && nodesToDelete.length === 0) {
        state.meta.persistWarning = 'Site removido sem filhos vinculados.';
      }

      if (state.ui.vlanAssignment?.siteId === siteId) {
        state.ui.vlanAssignment = null;
      }
    },
    updateSite: (state, action: PayloadAction<UpdateSitePayload>) => {
      const site = state.sites.find((item) => item.id === action.payload.id);
      if (!site) return;

      if (typeof action.payload.changes.name === 'string') {
        site.name = action.payload.changes.name;
      }
      if (typeof action.payload.changes.ipOctet === 'number') {
        site.ipOctet = Math.max(
          1,
          Math.min(254, action.payload.changes.ipOctet),
        );
      }
      if (typeof action.payload.changes.cidr === 'number') {
        site.cidr = Math.max(1, Math.min(32, action.payload.changes.cidr));
      }
      if (typeof action.payload.changes.reserveMarginPercent === 'number') {
        site.reserveMarginPercent = Math.max(
          0,
          Math.min(
            100,
            Math.trunc(action.payload.changes.reserveMarginPercent),
          ),
        );
      }
    },
    addSiteVlan: (state, action: PayloadAction<AddSiteVlanPayload>) => {
      const { siteId, networkId } = action.payload;
      const vlanId = toValidVlanId(action.payload.vlanId);
      const site = state.sites.find((item) => item.id === siteId);
      if (!site) return;

      const alreadyExists = state.siteVlans.some(
        (item) => item.siteId === siteId && item.vlanId === vlanId,
      );
      if (alreadyExists) {
        state.meta.persistWarning = `VLAN ${vlanId} ja existe neste site.`;
        return;
      }

      const capacity = Math.max(1, Math.trunc(action.payload.capacity));

      // Fase 2: quando networkId fornecido, usa endereçamento da rede
      const network = networkId
        ? state.siteNetworks.find((n) => n.id === networkId)
        : undefined;

      const startIp = network
        ? buildIpFromNetworkAndRadical(
            network,
            action.payload.startRadical,
            site.ipOctet,
          )
        : buildIpFromSiteAndRadical(site.ipOctet, action.payload.startRadical);

      if (!startIp) {
        state.meta.persistWarning =
          'Radical inicial invalido para o range da VLAN.';
        return;
      }

      const startNumber = ipToNumber(startIp);
      if (startNumber === null) {
        state.meta.persistWarning =
          'Nao foi possivel calcular IP inicial da VLAN.';
        return;
      }

      const endNumber = startNumber + capacity - 1;
      const { min: rangeMin, max: rangeMax } = network
        ? networkRangeBounds(network, site.ipOctet)
        : siteRangeBounds(site.ipOctet);

      if (endNumber > rangeMax || startNumber < rangeMin) {
        state.meta.persistWarning =
          'Range da VLAN ultrapassa os limites de endereco do site/rede.';
        return;
      }

      const overlaps = state.siteVlans
        .filter((item) => item.siteId === siteId)
        .some((item) => {
          const range = getVlanRange(item);
          if (!range) return false;
          return !(endNumber < range.start || startNumber > range.end);
        });
      if (overlaps) {
        state.meta.persistWarning =
          'Range da VLAN sobrepoe uma VLAN ja existente neste site.';
        return;
      }

      const endIp = numberToIp(endNumber);
      const suggestedIpv6Prefix = (() => {
        const basePrefix = network?.ipv6Prefix?.trim();
        if (!basePrefix) return undefined;
        const [base] = basePrefix.split('/');
        if (!base) return undefined;
        const compactBase = base.replace(/::+$/, '').replace(/:$/, '');
        const vlanHex = vlanId.toString(16);
        return `${compactBase}:${vlanHex}::/64`;
      })();

      // P2 — cor por paleta circular (contador de VLANs do site)
      const siteVlanCount = state.siteVlans.filter(
        (item) => item.siteId === siteId,
      ).length;
      const color =
        VLAN_COLOR_PALETTE[siteVlanCount % VLAN_COLOR_PALETTE.length];

      const allocationMode = action.payload.addressAllocation ?? 'dhcpv4';
      const createdVlan = {
        id: `${siteId}-vlan-${vlanId}`,
        siteId,
        vlanId,
        name: action.payload.name?.trim() || `VLAN ${vlanId}`,
        capacity,
        startRadical: action.payload.startRadical,
        startIp,
        endIp,
        color,
        networkId,
        ipv6Prefix: action.payload.ipv6Prefix?.trim() || suggestedIpv6Prefix,
        addressAllocation: allocationMode,
      };

      state.siteVlans.push(createdVlan);

      if (!isStaticAddressAllocation(allocationMode)) {
        const existingScope = state.dhcpScopes.find(
          (scope) => scope.siteId === siteId && scope.vlanId === vlanId,
        );
        if (!existingScope) {
          state.dhcpScopes.push(buildDefaultDhcpScopeForVlan(createdVlan));
        }
      }

      // Dispositivos que cairam por acaso no novo range e nao pertencem a VLAN
      // sao movidos para IP livre fora das VLANs.
      state.nodes.forEach((node) => {
        if (node.siteId !== siteId || node.category === 'wan') return;
        const inNewVlan = (node.vlans ?? []).includes(vlanId);
        if (inNewVlan) return;
        if (!isIpInVlan(node.ip, state.siteVlans[state.siteVlans.length - 1]))
          return;
        assignNodeIpOutsideVlans(state, node);
      });
    },
    removeSiteVlan: (state, action: PayloadAction<RemoveSiteVlanPayload>) => {
      const { siteId } = action.payload;
      const vlanId = toValidVlanId(action.payload.vlanId);

      state.siteVlans = state.siteVlans.filter(
        (item) => !(item.siteId === siteId && item.vlanId === vlanId),
      );
      state.dhcpScopes = state.dhcpScopes.filter(
        (scope) => !(scope.siteId === siteId && scope.vlanId === vlanId),
      );

      state.nodes.forEach((node) => {
        if (node.siteId !== siteId || node.category === 'wan') return;
        const hadVlan = (node.vlans ?? []).includes(vlanId);
        node.vlans = (node.vlans ?? []).filter((value) => value !== vlanId);
        if (!hadVlan) return;

        if ((node.vlans ?? []).length > 0) {
          const fallbackVlan = state.siteVlans.find(
            (item) =>
              item.siteId === siteId &&
              (node.vlans ?? []).includes(item.vlanId),
          );
          if (fallbackVlan) {
            assignNodeIpInsideVlan(state, node, fallbackVlan);
            return;
          }
        }

        assignNodeIpOutsideVlans(state, node);
      });

      if (
        state.ui.vlanAssignment &&
        state.ui.vlanAssignment.siteId === siteId &&
        state.ui.vlanAssignment.vlanId === vlanId
      ) {
        state.ui.vlanAssignment = null;
      }
    },
    upsertDhcpScope: (
      state,
      action: PayloadAction<UpsertDhcpScopePayload>,
    ) => {
      const siteId = action.payload.siteId;
      const vlanId = toValidVlanId(action.payload.vlanId);
      const vlan = state.siteVlans.find(
        (item) => item.siteId === siteId && item.vlanId === vlanId,
      );
      if (!vlan) return;

      const allocationMode =
        action.payload.allocationMode ?? vlan.addressAllocation ?? 'dhcpv4';
      if (isStaticAddressAllocation(allocationMode)) {
        state.dhcpScopes = state.dhcpScopes.filter(
          (scope) => !(scope.siteId === siteId && scope.vlanId === vlanId),
        );
        return;
      }

      const cleanList = (values: string[] | undefined) =>
        (values ?? [])
          .map((value) => value.trim())
          .filter((value, index, self) => value !== '' && self.indexOf(value) === index);

      const candidateId = action.payload.id || `${siteId}-vlan-${vlanId}-dhcp`;
      const existing = state.dhcpScopes.find(
        (scope) =>
          scope.id === candidateId ||
          (scope.siteId === siteId && scope.vlanId === vlanId),
      );

      const nextScope: DhcpScope = {
        id: existing?.id ?? candidateId,
        siteId,
        vlanId,
        allocationMode,
        providerType:
          action.payload.providerType ?? existing?.providerType ?? 'node',
        providerNodeId:
          action.payload.providerNodeId ?? existing?.providerNodeId,
        relayNodeId: action.payload.relayNodeId ?? existing?.relayNodeId,
        poolStartIp:
          action.payload.poolStartIp?.trim() ||
          existing?.poolStartIp ||
          vlan.startIp,
        poolEndIp:
          action.payload.poolEndIp?.trim() || existing?.poolEndIp || vlan.endIp,
        excludedIps: cleanList(action.payload.excludedIps ?? existing?.excludedIps),
        leaseMinutes: Math.max(
          1,
          Math.min(
            43200,
            Math.trunc(
              Number(
                action.payload.leaseMinutes ?? existing?.leaseMinutes ?? 1440,
              ),
            ),
          ),
        ),
        dnsServers: cleanList(action.payload.dnsServers ?? existing?.dnsServers),
        ipv6Mode:
          action.payload.ipv6Mode ??
          existing?.ipv6Mode ??
          defaultDhcpIpv6ModeByAllocation(allocationMode),
        ipv6DnsServers: cleanList(
          action.payload.ipv6DnsServers ?? existing?.ipv6DnsServers,
        ),
        notes: action.payload.notes?.trim() ?? existing?.notes ?? '',
      };

      if (existing) {
        Object.assign(existing, nextScope);
      } else {
        state.dhcpScopes.push(nextScope);
      }
    },
    removeDhcpScope: (
      state,
      action: PayloadAction<RemoveDhcpScopePayload>,
    ) => {
      if ('id' in action.payload) {
        state.dhcpScopes = state.dhcpScopes.filter(
          (scope) => scope.id !== action.payload.id,
        );
        return;
      }

      const siteId = action.payload.siteId;
      const vlanId = toValidVlanId(action.payload.vlanId);
      state.dhcpScopes = state.dhcpScopes.filter(
        (scope) => !(scope.siteId === siteId && scope.vlanId === vlanId),
      );
    },
    setVlanAssignmentMode: (
      state,
      action: PayloadAction<SetVlanAssignmentPayload>,
    ) => {
      const payload = action.payload;
      if (!payload) {
        state.ui.vlanAssignment = null;
        return;
      }

      const vlanId = toValidVlanId(payload.vlanId);
      const exists = state.siteVlans.some(
        (item) => item.siteId === payload.siteId && item.vlanId === vlanId,
      );
      state.ui.vlanAssignment = exists
        ? { siteId: payload.siteId, vlanId }
        : null;
    },
    toggleNodeVlanAssignment: (
      state,
      action: PayloadAction<ToggleNodeVlanPayload>,
    ) => {
      const node = state.nodes.find(
        (item) => item.id === action.payload.nodeId,
      );
      if (!node || node.category === 'wan') return;

      const vlanId = toValidVlanId(action.payload.vlanId);
      if (node.siteId !== action.payload.siteId) return;
      if (!siteOwnsVlan(state.siteVlans, action.payload.siteId, vlanId)) return;

      const hasVlan = (node.vlans ?? []).includes(vlanId);
      node.vlans = hasVlan
        ? (node.vlans ?? []).filter((value) => value !== vlanId)
        : [...new Set([...(node.vlans ?? []), vlanId])].sort((a, b) => a - b);

      if (!hasVlan) {
        const vlan = state.siteVlans.find(
          (item) =>
            item.siteId === action.payload.siteId && item.vlanId === vlanId,
        );
        if (!vlan) return;

        if (isAccessPointL3Mode(node)) {
          ensureNodeVlanInterfaceForNode(state, node, vlan);
          return;
        }

        // Verifica se o nó já tem IP dentro de alguma VLAN existente
        // (node.vlans já inclui o novo vlanId pois foi atualizado acima)
        const previousVlans = state.siteVlans.filter(
          (item) =>
            item.siteId === action.payload.siteId &&
            (node.vlans ?? []).includes(item.vlanId) &&
            item.vlanId !== vlanId,
        );
        const ipAlreadyInSomeVlan = previousVlans.some((v) =>
          isIpInVlan(node.ip, v),
        );

        const isRoutingDevice =
          node.category === 'router' ||
          node.category === 'firewall' ||
          node.category === 'switch';

        if (ipAlreadyInSomeVlan && isRoutingDevice) {
          // Dispositivo de rede multi-VLAN: mantém node.ip como IP de gerência
          // e cria automaticamente um NodeVlanInterface com IP dentro desta VLAN
          ensureNodeVlanInterfaceForNode(state, node, vlan);
          return;
        }

        if (ipAlreadyInSomeVlan) {
          // Nó terminal (pc/server/etc.) em múltiplas VLANs: mantém IP atual
          return;
        }

        if (!node.originalIp && node.ip) {
          node.originalIp = node.ip;
        }
        const moved = assignNodeIpInsideVlan(state, node, vlan);
        if (!moved) {
          state.meta.persistWarning = `VLAN ${vlanId} sem IP livre para o elemento ${node.label}.`;
        }
        return;
      }

      // Removendo da VLAN — limpar NodeVlanInterface associada, se existir
      state.nodeVlanInterfaces = state.nodeVlanInterfaces.filter(
        (i) => !(i.nodeId === node.id && i.vlanId === vlanId),
      );

      if (isAccessPointL3Mode(node)) {
        return;
      }

      if ((node.vlans ?? []).length > 0) {
        const fallbackVlan = state.siteVlans.find(
          (item) =>
            item.siteId === action.payload.siteId &&
            (node.vlans ?? []).includes(item.vlanId),
        );
        if (fallbackVlan) {
          assignNodeIpInsideVlan(state, node, fallbackVlan);
          return;
        }
      }

      assignNodeIpOutsideVlans(state, node);
    },

    // ── Fase 2 — SiteNetwork ────────────────────────────────────────────────
    addSiteNetwork: (state, action: PayloadAction<AddSiteNetworkPayload>) => {
      const {
        siteId,
        name,
        purpose,
        addressFamily,
        thirdOctet,
        cidr,
        stackMode,
        gatewayMode,
        dnsPolicy,
        ipv6Prefix,
        ipv6VlanPrefixLength,
        trafficPreference,
      } = action.payload;
      if (!state.sites.some((s) => s.id === siteId)) return;

      // P4 — máximo de 2 LANs por site
      const existingCount = state.siteNetworks.filter(
        (n) => n.siteId === siteId,
      ).length;
      if (existingCount >= 2) {
        state.meta.persistWarning =
          'Limite de 2 LANs por site atingido. Remova uma LAN para adicionar outra.';
        return;
      }

      const id = `${siteId}-net-${Date.now()}`;
      state.siteNetworks.push({
        id,
        siteId,
        name: name.trim() || 'Rede',
        purpose,
        addressFamily,
        thirdOctet: Math.max(0, Math.min(255, Math.trunc(thirdOctet))),
        cidr: Math.max(8, Math.min(30, Math.trunc(cidr))),
        stackMode: stackMode ?? 'ipv4',
        gatewayMode: gatewayMode ?? 'ipv4-only',
        dnsPolicy: dnsPolicy ?? 'a-only',
        ipv6Prefix: ipv6Prefix?.trim() || undefined,
        ipv6VlanPrefixLength: Math.max(
          48,
          Math.min(64, Math.trunc(ipv6VlanPrefixLength ?? 64)),
        ),
        trafficPreference:
          trafficPreference ?? defaultTrafficPreferenceByStack(stackMode),
      });
    },
    removeSiteNetwork: (
      state,
      action: PayloadAction<RemoveSiteNetworkPayload>,
    ) => {
      const { id } = action.payload;
      state.siteNetworks = state.siteNetworks.filter((n) => n.id !== id);
      // Limpar referências nas sub-redes
      state.subnets = state.subnets.filter((s) => s.networkId !== id);
      // Limpar networkId nas VLANs e layers que apontavam para esta rede
      state.siteVlans.forEach((v) => {
        if (v.networkId === id) v.networkId = undefined;
      });
      state.layers.forEach((l) => {
        if (l.networkId === id) l.networkId = undefined;
      });
      state.nodes.forEach((n) => {
        if (n.networkId === id) n.networkId = undefined;
      });
    },

    // ── Fase 2 — Subnet ────────────────────────────────────────────────────
    addSubnet: (state, action: PayloadAction<AddSubnetPayload>) => {
      const { siteId, networkId, vlanId, name, cidr, networkAddress } =
        action.payload;
      if (!state.siteNetworks.some((n) => n.id === networkId)) return;
      const id = `${networkId}-sub-${Date.now()}`;
      state.subnets.push({
        id,
        siteId,
        networkId,
        vlanId,
        name: name.trim() || 'Sub-rede',
        cidr: Math.max(8, Math.min(30, Math.trunc(cidr))),
        networkAddress,
        ipv6Prefix: action.payload.ipv6Prefix?.trim() || undefined,
      });
    },
    removeSubnet: (state, action: PayloadAction<RemoveSubnetPayload>) => {
      state.subnets = state.subnets.filter((s) => s.id !== action.payload.id);
    },

    // ── P11 — interfaces VLAN em roteadores / firewalls / switches ───────────
    addNodeVlanInterface: (
      state,
      action: PayloadAction<Omit<NodeVlanInterface, 'id'>>,
    ) => {
      const { nodeId, siteId, vlanId, gatewayIp, gatewayIpv6, description } =
        action.payload;
      const already = state.nodeVlanInterfaces.find(
        (i) => i.nodeId === nodeId && i.vlanId === vlanId,
      );
      if (already) return; // idempotente — sem duplicatas
      const id = `nvif-${nodeId}-${vlanId}-${Date.now()}`;
      state.nodeVlanInterfaces.push({
        id,
        nodeId,
        siteId,
        vlanId,
        gatewayIp,
        gatewayIpv6: gatewayIpv6?.trim() || undefined,
        description,
      });
    },
    removeNodeVlanInterface: (
      state,
      action: PayloadAction<{ id: string }>,
    ) => {
      state.nodeVlanInterfaces = state.nodeVlanInterfaces.filter(
        (i) => i.id !== action.payload.id,
      );
    },

    // ── P13 — QoS Class por VLAN ──────────────────────────────────────────
    updateSiteVlanQos: (
      state,
      action: PayloadAction<{ siteId: string; vlanId: number; qosClass: import('./types/entities').QosClass | undefined }>,
    ) => {
      const vlan = state.siteVlans.find(
        (v) => v.siteId === action.payload.siteId && v.vlanId === action.payload.vlanId,
      );
      if (!vlan) return;
      vlan.qosClass = action.payload.qosClass;
    },

    // ── P14 — Trust Boundary por Nó ───────────────────────────────────────
    updateNodeQosTrust: (
      state,
      action: PayloadAction<{ nodeId: string; qosTrust: import('./types/entities').QosTrust }>,
    ) => {
      const node = state.nodes.find((n) => n.id === action.payload.nodeId);
      if (!node) return;
      node.qosTrust = action.payload.qosTrust;
    },

    // ── P16 — QoS Profile por Nó (filas de scheduling) ───────────────────
    addQosQueue: (
      state,
      action: PayloadAction<{
        nodeId: string;
        queue: Omit<import('./types/entities').QosQueue, 'id'>;
      }>,
    ) => {
      const { nodeId, queue } = action.payload;
      let profile = state.nodeQosProfiles.find((p) => p.nodeId === nodeId);
      if (!profile) {
        state.nodeQosProfiles.push({ nodeId, queues: [] });
        profile = state.nodeQosProfiles[state.nodeQosProfiles.length - 1];
      }
      profile.queues.push({ ...queue, id: `q-${nodeId}-${Date.now()}` });
    },
    updateQosQueue: (
      state,
      action: PayloadAction<{
        nodeId: string;
        queueId: string;
        changes: Partial<Omit<import('./types/entities').QosQueue, 'id'>>;
      }>,
    ) => {
      const profile = state.nodeQosProfiles.find((p) => p.nodeId === action.payload.nodeId);
      if (!profile) return;
      const queue = profile.queues.find((q) => q.id === action.payload.queueId);
      if (!queue) return;
      Object.assign(queue, action.payload.changes);
    },
    removeQosQueue: (
      state,
      action: PayloadAction<{ nodeId: string; queueId: string }>,
    ) => {
      const profile = state.nodeQosProfiles.find((p) => p.nodeId === action.payload.nodeId);
      if (!profile) return;
      profile.queues = profile.queues.filter((q) => q.id !== action.payload.queueId);
    },

    // ── P17 — QoS WAN por Link ────────────────────────────────────────────
    updateLinkWanQos: (
      state,
      action: PayloadAction<{
        linkId: string;
        policy: Partial<import('./types/entities').WanQosPolicy> | null;
      }>,
    ) => {
      const link = state.links.find((l) => l.id === action.payload.linkId);
      if (!link) return;
      if (action.payload.policy === null) {
        delete link.wanQosPolicy;
        return;
      }
      if (!link.wanQosPolicy) {
        link.wanQosPolicy = {
          guaranteedClasses: [],
          suppressedClasses: [],
          ipsecEncap: false,
          dscpCopyToOuter: true,
        };
      }
      Object.assign(link.wanQosPolicy, action.payload.policy);
    },

    // ── Fase 1 — updateLayerTier / updateNodeZone (exports aqui por ordem) ─
    updateLayerTier: (state, action: PayloadAction<UpdateLayerTierPayload>) => {
      const layer = state.layers.find((l) => l.id === action.payload.id);
      if (!layer) return;
      layer.tier = action.payload.tier;
      if (action.payload.name !== undefined) {
        layer.name = action.payload.name;
      }
    },
    updateNodeZone: (state, action: PayloadAction<UpdateNodeZonePayload>) => {
      const node = state.nodes.find((n) => n.id === action.payload.id);
      if (!node) return;
      node.zone = action.payload.zone;
    },

    addLayer: (state, action: PayloadAction<AddLayerPayload>) => {
      const { siteId, tier, name, networkId } = action.payload;
      const siteExists = state.sites.some((site) => site.id === siteId);
      if (!siteExists) return;

      // Fase 2: valida que a rede existe, se fornecida
      if (networkId && !state.siteNetworks.some((n) => n.id === networkId)) {
        return;
      }

      const order = getLayerOrder(state.layers, siteId);
      const layerId = makeLayerId(siteId, order);

      const tierDefaultNames: Record<string, string> = {
        edge: 'Borda / Edge',
        distribution: 'Distribuição',
        access: 'Acesso',
        endpoint: 'Endpoints',
        dmz: 'DMZ',
        management: 'Gerência',
        custom: `Camada ${order}`,
      };
      const layerName =
        name?.trim() ||
        (tier
          ? (tierDefaultNames[tier] ?? `Camada ${order}`)
          : `Camada ${order}`);

      state.layers.push({
        id: layerId,
        siteId,
        name: layerName,
        order,
        width: 416,
        height: 180,
        minWidth: 286,
        // Sem teto fixo de largura; validacao dinamica ocorre no resize.
        maxWidth: Number.MAX_SAFE_INTEGER,
        minHeight: 180,
        maxHeight: 300,
        tier,
        networkId,
      });
      state.counters.layer += 1;
    },
    removeLayer: (state, action: PayloadAction<string>) => {
      const layerId = action.payload;
      const nodesToDelete = state.nodes
        .filter((node) => node.layerId === layerId)
        .map((node) => node.id);

      state.layers = state.layers.filter((layer) => layer.id !== layerId);
      state.nodes = state.nodes.filter((node) => node.layerId !== layerId);
      state.links = state.links.filter(
        (link) =>
          !nodesToDelete.includes(link.from) &&
          !nodesToDelete.includes(link.to),
      );
      state.aclRules = reconcileAclRules(state);
      if (
        state.ui.inspectorNodeId &&
        nodesToDelete.includes(state.ui.inspectorNodeId)
      ) {
        state.ui.inspectorNodeId = null;
      }
    },
    resizeLayer: (
      state,
      action: PayloadAction<{
        layerId: string;
        width: number;
        height: number;
        maxWidth?: number;
      }>,
    ) => {
      const layer = state.layers.find(
        (item) => item.id === action.payload.layerId,
      );
      if (!layer) return;
      const dynamicMaxWidth =
        typeof action.payload.maxWidth === 'number' &&
        Number.isFinite(action.payload.maxWidth)
          ? Math.max(layer.minWidth, action.payload.maxWidth)
          : layer.maxWidth;
      layer.width = Math.max(
        layer.minWidth,
        Math.min(dynamicMaxWidth, action.payload.width),
      );
      layer.height = Math.max(
        layer.minHeight,
        Math.min(layer.maxHeight, action.payload.height),
      );
    },
    addNode: (state, action: PayloadAction<AddNodePayload>) => {
      const { siteId, layerId, category } = action.payload;
      const site = state.sites.find((item) => item.id === siteId);
      const layer = state.layers.find((item) => item.id === layerId);
      if (!site || !layer) return;

      // Fase 2: resolve a rede l\u00f3gica da camada para endere\u00e7amento correto
      const network = layer.networkId
        ? state.siteNetworks.find((n) => n.id === layer.networkId)
        : undefined;

      const categoryCount = getNextNodeSequence(
        state.nodes,
        category,
        siteId,
        layerId,
      );
      const nodeId = makeNodeId(category, categoryCount, siteId, layerId);
      const nodeIp = buildNodeIp(
        site.ipOctet,
        layer.order,
        category,
        categoryCount,
        network,
      );
      const position = getInitialNodePosition(
        state,
        siteId,
        layerId,
        layer.order,
        category,
      );
      state.nodes.push({
        id: nodeId,
        siteId,
        layerId,
        networkId: layer.networkId,
        category,
        label: buildNodeLabel(category, siteId, layer.order, categoryCount),
        ip: nodeIp,
        ipv6: buildNodeIpv6(
          site.ipOctet,
          layer.order,
          category,
          categoryCount,
          network,
        ),
        originalIp: buildNodeIp(
          site.ipOctet,
          layer.order,
          category,
          categoryCount,
          network,
        ),
        originalIpv6: buildNodeIpv6(
          site.ipOctet,
          layer.order,
          category,
          categoryCount,
          network,
        ),
        hostCount: 1,
        hostAllocations: [{ id: nodeId, ip: nodeIp }],
        cidr: site.cidr,
        vlans: [],
        x: position.x,
        y: position.y,
        description: 'Componente criado no Studio.',
        // P14 — trust boundary padrão por categoria
        qosTrust: DEFAULT_QOS_TRUST[category] ?? 'untrusted',
        techProfile: buildDefaultTechProfile(category, {
          layerOrder: layer.order,
          shouldBeGateway: shouldNodeBeGateway(
            state,
            siteId,
            layer.order,
            category,
          ),
          siteNodeCount: state.nodes.filter((node) => node.siteId === siteId)
            .length,
        }),
      });
      state.counters.node += 1;
    },
    addFloatingNode: (
      state,
      action: PayloadAction<{ category: NodeCategory }>,
    ) => {
      const category = action.payload.category;
      const categoryCount = getNextNodeSequence(state.nodes, category);
      const nodeId = makeNodeId(category, categoryCount);
      const nodeOrder = state.counters.node;
      const floatingIp = `200.200.1.${Math.max(1, Math.min(254, nodeOrder))}`;
      state.nodes.push({
        id: nodeId,
        category,
        label: `${category.toUpperCase()} ${categoryCount}`,
        ip: floatingIp,
        ipv6: `fd00:200:1::${Math.max(1, Math.min(4095, nodeOrder)).toString(16)}`,
        originalIp: floatingIp,
        originalIpv6: `fd00:200:1::${Math.max(1, Math.min(4095, nodeOrder)).toString(16)}`,
        hostCount: 1,
        hostAllocations: [{ id: nodeId, ip: floatingIp }],
        cidr: 30,
        vlans: [],
        x: 860,
        y: 120,
        description: 'Componente de comunicação no quadro principal.',
        techProfile: buildDefaultTechProfile(category, {
          layerOrder: 0,
          shouldBeGateway: false,
          siteNodeCount: 0,
        }),
      });
      state.counters.node += 1;
    },
    removeNode: (state, action: PayloadAction<string>) => {
      const nodeId = action.payload;
      state.nodes = state.nodes.filter((node) => node.id !== nodeId);
      state.links = state.links.filter(
        (link) => link.from !== nodeId && link.to !== nodeId,
      );
      state.aclRules = reconcileAclRules(state);
      if (state.ui.inspectorNodeId === nodeId) {
        state.ui.inspectorNodeId = null;
      }
    },
    updateNodePosition: (
      state,
      action: PayloadAction<{ id: string; x: number; y: number }>,
    ) => {
      const node = state.nodes.find((item) => item.id === action.payload.id);
      if (!node) return;
      node.x = action.payload.x;
      node.y = action.payload.y;
    },
    updateNode: (state, action: PayloadAction<UpdateNodePayload>) => {
      const node = state.nodes.find((item) => item.id === action.payload.id);
      if (!node) return;
      const isWan = node.category === 'wan';
      let requestedIp: string | undefined;
      let needsAddressRefresh = false;

      if (typeof action.payload.changes.label === 'string') {
        node.label = action.payload.changes.label;
      }
      if (!isWan && typeof action.payload.changes.ip === 'string') {
        requestedIp = action.payload.changes.ip;
        if ((node.vlans ?? []).length === 0) {
          node.ip = requestedIp;
          node.originalIp = requestedIp;
        } else {
          needsAddressRefresh = true;
        }
      }
      if (!isWan && typeof action.payload.changes.ipv6 === 'string') {
        const layerNetworkId = node.layerId
          ? state.layers.find((layer) => layer.id === node.layerId)?.networkId
          : undefined;
        const networkId = node.networkId ?? layerNetworkId;
        const network = networkId
          ? state.siteNetworks.find((n) => n.id === networkId)
          : undefined;
        const nextIpv6 = action.payload.changes.ipv6.trim();

        if (network?.trafficPreference === 'ipv6-strict' && nextIpv6 === '') {
          state.meta.persistWarning =
            'Rede em modo IPv6 strict: o endereço IPv6 do nó não pode ser removido.';
        } else {
          node.ipv6 = nextIpv6 || undefined;
          node.originalIpv6 = node.ipv6;
        }
      }
      if (!isWan && typeof action.payload.changes.hostCount === 'number') {
        node.hostCount = Math.max(
          1,
          Math.trunc(action.payload.changes.hostCount || 1),
        );
        needsAddressRefresh = true;
      }
      if (!isWan && typeof action.payload.changes.cidr === 'number') {
        node.cidr = action.payload.changes.cidr;
      }
      if (!isWan && Array.isArray(action.payload.changes.vlans)) {
        const nextVlans = Array.from(
          new Set(
            action.payload.changes.vlans
              .map((value) => toValidVlanId(Number(value)))
              .filter((value) => Number.isFinite(value)),
          ),
        ).sort((a, b) => a - b);

        const siteId = node.siteId;
        const allowedVlans = siteId
          ? nextVlans.filter((vlanId) =>
              siteOwnsVlan(state.siteVlans, siteId, vlanId),
            )
          : [];

        const previousVlans = node.vlans ?? [];
        node.vlans = allowedVlans;

        const hasNowVlans = node.vlans.length > 0;
        const hadVlansBefore = previousVlans.length > 0;

        if (!hasNowVlans) {
          node.hostCount = 1;
        } else {
          if (!hadVlansBefore && node.ip) {
            node.originalIp = node.originalIp ?? node.ip;
          }
        }

        needsAddressRefresh = true;
      }
      if (typeof action.payload.changes.description === 'string') {
        node.description = action.payload.changes.description;
      }

      if (!isWan && needsAddressRefresh) {
        if (isAccessPointL3Mode(node)) {
          syncAccessPointVlanInterfacesByMode(state, node);
        } else {
        const siteId = node.siteId;
        const targetVlan =
          node.vlans.length > 0 && siteId
            ? (state.siteVlans.find(
                (item) =>
                  item.siteId === siteId && item.vlanId === node.vlans[0],
              ) ?? null)
            : null;

        if (!targetVlan) {
          node.hostCount = 1;
          assignNodeIpOutsideVlans(state, node);
        } else {
          const moved = assignNodeIpInsideVlan(
            state,
            node,
            targetVlan,
            requestedIp ?? node.ip,
          );

          if (!moved) {
            state.meta.persistWarning = `VLAN ${targetVlan.vlanId} sem IP livre para reservar ${node.hostCount} IP(s) para ${node.label}.`;
          }
        }
        }
      }

      const usedIds = collectScopedUsedHostIds(state.nodes, node);
      node.hostAllocations = buildNodeHostAllocations(node, { usedIds });
    },
    updateNodeTechField: (
      state,
      action: PayloadAction<UpdateNodeTechFieldPayload>,
    ) => {
      const node = state.nodes.find((item) => item.id === action.payload.id);
      if (!node) return;

      const layerOrder = node.layerId
        ? (state.layers.find((layer) => layer.id === node.layerId)?.order ?? 1)
        : 0;
      const shouldBeGateway =
        node.siteId &&
        (node.category === 'router' || node.category === 'firewall') &&
        layerOrder === 1;

      const profile = ensureTechProfile(node.category, node.techProfile, {
        layerOrder,
        shouldBeGateway: Boolean(shouldBeGateway),
        siteNodeCount: node.siteId
          ? state.nodes.filter((item) => item.siteId === node.siteId).length
          : 0,
      });

      profile.fields[action.payload.key] = action.payload.value;

      if (node.category === 'access-point') {
        const interfaceMode = String(
          profile.fields.apInterfaceMode ?? 'l2-bridge',
        );

        if (
          action.payload.key === 'apInterfaceMode' &&
          interfaceMode === 'l2-bridge'
        ) {
          const managementVlan = String(
            profile.fields.apManagementVlanId ?? '',
          ).trim();
          if (managementVlan === '' && (node.vlans ?? []).length > 0) {
            profile.fields.apManagementVlanId = String(node.vlans[0]);
          }
        }
      }

      if (
        node.category === 'router' &&
        action.payload.key === 'routingMode'
      ) {
        const routingMode = String(action.payload.value ?? 'static');
        if (routingMode === 'bgp' || routingMode === 'mixed') {
          const dedupe = (items: string[]) =>
            Array.from(
              new Set(
                items
                  .map((item) => item.trim())
                  .filter((item) => item !== ''),
              ),
            );

          const site = node.siteId
            ? state.sites.find((item) => item.id === node.siteId)
            : undefined;

          const directPeerIps = dedupe(
            state.links
              .filter((link) => link.from === node.id || link.to === node.id)
              .map((link) => (link.from === node.id ? link.to : link.from))
              .map(
                (peerId) =>
                  state.nodes.find((candidate) => candidate.id === peerId)?.ip ??
                  '',
              ),
          );

          const localSiteNetworks = dedupe(
            state.siteNetworks
              .filter((network) => network.siteId === node.siteId)
              .map((network) => {
                const address = buildNetworkAddress(
                  network.addressFamily,
                  network.thirdOctet,
                  site?.ipOctet,
                );
                return `${address}/${network.cidr}`;
              }),
          );

          const remoteSiteNetworks = dedupe(
            state.siteNetworks
              .filter((network) => network.siteId !== node.siteId)
              .map((network) => {
                const networkSite = state.sites.find(
                  (item) => item.id === network.siteId,
                );
                const address = buildNetworkAddress(
                  network.addressFamily,
                  network.thirdOctet,
                  networkSite?.ipOctet,
                );
                return `${address}/${network.cidr}`;
              }),
          );

          const suggestedPrefixIn =
            remoteSiteNetworks.length > 0
              ? remoteSiteNetworks
              : directPeerIps.map((ip) => `${ip}/32`);

          const currentAsn = String(profile.fields.bgpAsn ?? '').trim();
          if (!currentAsn && site?.ipOctet !== undefined) {
            profile.fields.bgpAsn = String(65000 + site.ipOctet);
          }

          const currentNeighbors = String(profile.fields.bgpNeighbors ?? '').trim();
          if (!currentNeighbors && directPeerIps.length > 0) {
            profile.fields.bgpNeighbors = directPeerIps.join(', ');
          }

          const currentPrefixIn = String(profile.fields.bgpPrefixListIn ?? '').trim();
          if (!currentPrefixIn && suggestedPrefixIn.length > 0) {
            profile.fields.bgpPrefixListIn = suggestedPrefixIn.join(', ');
          }

          const currentPrefixOut = String(profile.fields.bgpPrefixListOut ?? '').trim();
          if (!currentPrefixOut && localSiteNetworks.length > 0) {
            profile.fields.bgpPrefixListOut = localSiteNetworks.join(', ');
          }
        }
      }

      node.techProfile = normalizeTechProfile(node.category, profile, {
        layerOrder,
        shouldBeGateway: Boolean(shouldBeGateway),
        siteNodeCount: node.siteId
          ? state.nodes.filter((item) => item.siteId === node.siteId).length
          : 0,
      });

      if (
        action.payload.key === 'gatewayDefault' &&
        action.payload.value === true &&
        node.siteId
      ) {
        state.nodes.forEach((item) => {
          if (item.id === node.id || item.siteId !== node.siteId) return;
          if (item.category !== 'router' && item.category !== 'firewall')
            return;
          if (!item.techProfile) return;
          item.techProfile = {
            ...item.techProfile,
            fields: {
              ...item.techProfile.fields,
              gatewayDefault: false,
            },
          };
        });
      }

      if (node.category === 'access-point') {
        syncAccessPointVlanInterfacesByMode(state, node);

        if (!isAccessPointL3Mode(node)) {
          const managementVlanId = resolveAccessPointManagementVlanId(node);

          if ((node.vlans ?? []).length > 0 && managementVlanId === null) {
            state.meta.persistWarning =
              'AP em modo L2 deve definir VLAN de gerenciamento.';
          }

          if (
            managementVlanId !== null &&
            !(node.vlans ?? []).includes(managementVlanId)
          ) {
            state.meta.persistWarning = `VLAN de gerenciamento ${managementVlanId} nao esta associada ao AP ${node.label}.`;
          }
        }
      }
    },
    addLink: (state, action: PayloadAction<AddLinkPayload>) => {
      const normalized = normalizeLinkDirection(
        state,
        action.payload.from,
        action.payload.to,
      );
      const { from, to } = normalized;
      if (from === to) return;
      const alreadyExists = state.links.some(
        (link) =>
          (link.from === from && link.to === to) ||
          (link.from === to && link.to === from),
      );
      if (alreadyExists) return;

      const kind = inferLinkKind(state, from, to, action.payload.kind);
      const defaultBidirectional = inferLinkBidirectionalDefault(
        state.nodes,
        from,
        to,
        kind,
      );
      const defaultDuplexMode = inferLinkDuplexModeDefault(
        state.nodes,
        from,
        to,
        kind,
      );

      state.links.push({
        id: `link_${state.counters.link}`,
        from,
        to,
        kind,
        bidirectional: defaultBidirectional,
        duplexMode: defaultDuplexMode,
      });
      state.counters.link += 1;
      state.aclRules = reconcileAclRules(state);
    },
    removeLink: (state, action: PayloadAction<string>) => {
      state.links = state.links.filter((link) => link.id !== action.payload);
      state.aclRules = reconcileAclRules(state);
    },
    updateAclRule: (state, action: PayloadAction<UpdateAclRulePayload>) => {
      const rule = state.aclRules.find((item) => item.id === action.payload.id);
      if (!rule) return;

      if (typeof action.payload.changes.action === 'string') {
        rule.action = action.payload.changes.action;
      }
      if (typeof action.payload.changes.service === 'string') {
        rule.service = action.payload.changes.service;
      }
      if (typeof action.payload.changes.enabled === 'boolean') {
        rule.enabled = action.payload.changes.enabled;
      }
      if (typeof action.payload.changes.stateful === 'boolean') {
        rule.stateful = action.payload.changes.stateful;
      }
      if (typeof action.payload.changes.bidirectional === 'boolean') {
        rule.bidirectional = action.payload.changes.bidirectional;
      }
      if (typeof action.payload.changes.protocol === 'string') {
        rule.protocol = action.payload.changes.protocol;
      }

      if (typeof action.payload.changes.sourceScope === 'string') {
        rule.sourceScope = action.payload.changes.sourceScope;
      }
      if ('sourceVlanId' in action.payload.changes) {
        rule.sourceVlanId = action.payload.changes.sourceVlanId;
      }
      if ('sourceIp' in action.payload.changes) {
        rule.sourceIp = action.payload.changes.sourceIp;
      }
      if ('sourceIpList' in action.payload.changes) {
        rule.sourceIpList = action.payload.changes.sourceIpList;
      }
      if (typeof action.payload.changes.destinationScope === 'string') {
        rule.destinationScope = action.payload.changes.destinationScope;
      }
      if ('destinationVlanId' in action.payload.changes) {
        rule.destinationVlanId = action.payload.changes.destinationVlanId;
      }
      if ('destinationIp' in action.payload.changes) {
        rule.destinationIp = action.payload.changes.destinationIp;
      }
      if ('destinationIpList' in action.payload.changes) {
        rule.destinationIpList = action.payload.changes.destinationIpList;
      }

      Object.assign(rule, normalizeAclRule(rule, state.nodes, state.siteVlans));
    },
    addCustomAclRule: (
      state,
      action: PayloadAction<AddCustomAclRulePayload>,
    ) => {
      const { sourceNodeId, destinationNodeId } = action.payload;
      const validNodeIds = new Set(state.nodes.map((n) => n.id));
      if (
        !validNodeIds.has(sourceNodeId) ||
        !validNodeIds.has(destinationNodeId)
      )
        return;

      const manualRules = state.aclRules.filter((r) => !r.managed);
      const maxPriority = manualRules.reduce(
        (max, r) => Math.max(max, r.priority ?? 0),
        0,
      );

      const ruleId = `acl_manual_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
      const returnId = `acl_manual_ret_${Date.now()}_${Math.floor(Math.random() * 9999)}`;

      const sourceNode = state.nodes.find((node) => node.id === sourceNodeId);
      const destinationNode = state.nodes.find(
        (node) => node.id === destinationNodeId,
      );
      const linkedRule = state.links.find(
        (link) =>
          (link.from === sourceNodeId && link.to === destinationNodeId) ||
          (link.from === destinationNodeId && link.to === sourceNodeId),
      );

      const qosSuggestion = suggestAclRuleQoS({
        rule: {
          action: action.payload.action,
          service: action.payload.service,
          protocol: action.payload.protocol,
          natExempt: false,
        },
        linkKind: linkedRule?.kind,
        linkBandwidthKbps: linkedRule?.wanQosPolicy?.totalBandwidthKbps,
        sourceCategory: sourceNode?.category,
        destinationCategory: destinationNode?.category,
      });

      const reverseQosSuggestion = suggestAclRuleQoS({
        rule: {
          action: action.payload.action,
          service: action.payload.service,
          protocol: action.payload.protocol,
          natExempt: false,
        },
        linkKind: linkedRule?.kind,
        linkBandwidthKbps: linkedRule?.wanQosPolicy?.totalBandwidthKbps,
        sourceCategory: destinationNode?.category,
        destinationCategory: sourceNode?.category,
      });

      const newRule: AclRule = {
        id: ruleId,
        sourceNodeId,
        destinationNodeId,
        sourceScope: action.payload.sourceScope ?? 'node',
        sourceVlanId: action.payload.sourceVlanId,
        sourceIp: action.payload.sourceIp,
        sourceIpList: action.payload.sourceIpList,
        destinationScope: action.payload.destinationScope ?? 'node',
        destinationVlanId: action.payload.destinationVlanId,
        destinationIp: action.payload.destinationIp,
        destinationIpList: action.payload.destinationIpList,
        action: action.payload.action,
        service: action.payload.service,
        enabled: true,
        managed: false,
        priority: maxPriority + 10,
        source: 'manual',
        stateful: action.payload.stateful,
        bidirectional: action.payload.bidirectional,
        passthrough: false,
        natExempt: false,
        protocol: action.payload.protocol,
        trafficClass: qosSuggestion.trafficClass,
        dscpMark: qosSuggestion.dscpMark,
        guaranteedBwKbps: qosSuggestion.guaranteedBwKbps,
        maxBwKbps: qosSuggestion.maxBwKbps,
        // F — if bidirectional, link to auto-generated return rule
        returnRuleId: action.payload.bidirectional ? returnId : undefined,
      };

      state.aclRules.push(
        normalizeAclRule(newRule, state.nodes, state.siteVlans),
      );

      // F — auto-generate mirrored return rule for bidirectional manual rules
      if (action.payload.bidirectional) {
        const returnRule: AclRule = {
          id: returnId,
          sourceNodeId: destinationNodeId,
          destinationNodeId: sourceNodeId,
          sourceScope: action.payload.destinationScope ?? 'node',
          sourceVlanId: action.payload.destinationVlanId,
          sourceIp: action.payload.destinationIp,
          destinationScope: action.payload.sourceScope ?? 'node',
          destinationVlanId: action.payload.sourceVlanId,
          destinationIp: action.payload.sourceIp,
          action: action.payload.action,
          service: action.payload.service,
          enabled: true,
          managed: false,
          priority: maxPriority + 11,
          source: 'manual',
          stateful: action.payload.stateful,
          bidirectional: false,
          passthrough: false,
          natExempt: false,
          protocol: action.payload.protocol,
          trafficClass: reverseQosSuggestion.trafficClass,
          dscpMark: reverseQosSuggestion.dscpMark,
          guaranteedBwKbps: reverseQosSuggestion.guaranteedBwKbps,
          maxBwKbps: reverseQosSuggestion.maxBwKbps,
          parentRuleId: ruleId,
          isReturnRule: true,
        };
        state.aclRules.push(
          normalizeAclRule(returnRule, state.nodes, state.siteVlans),
        );
      }
    },
    removeCustomAclRule: (
      state,
      action: PayloadAction<RemoveCustomAclRulePayload>,
    ) => {
      const rule = state.aclRules.find((r) => r.id === action.payload.id);
      if (!rule || rule.managed) return;
      // F — also remove the auto-generated return rule if it exists
      const returnId = rule.returnRuleId;
      state.aclRules = state.aclRules.filter(
        (r) => r.id !== action.payload.id && r.id !== returnId,
      );

      // G — apagar a linha de exceção de retorno de um link de topologia
      // religa o bidirecional do link automaticamente
      if (rule.isReturnRule && rule.parentRuleId) {
        const parentRule = state.aclRules.find(
          (r) => r.id === rule.parentRuleId,
        );
        if (parentRule?.managed && parentRule.linkId) {
          const link = state.links.find((l) => l.id === parentRule.linkId);
          if (link) {
            link.bidirectional = true;
            if (parentRule.returnRuleId === rule.id) {
              parentRule.returnRuleId = undefined;
            }
            state.aclRules = reconcileAclRules(state);
          }
        }
      }
    },
    reorderCustomAclRule: (
      state,
      action: PayloadAction<ReorderCustomAclRulePayload>,
    ) => {
      const { id, direction } = action.payload;
      const manualRules = state.aclRules
        .filter((r) => !r.managed)
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      const idx = manualRules.findIndex((r) => r.id === id);
      if (idx === -1) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= manualRules.length) return;

      const priorityA = manualRules[idx].priority ?? 0;
      const priorityB = manualRules[swapIdx].priority ?? 0;
      const ruleA = state.aclRules.find((r) => r.id === manualRules[idx].id);
      const ruleB = state.aclRules.find(
        (r) => r.id === manualRules[swapIdx].id,
      );
      if (ruleA) ruleA.priority = priorityB;
      if (ruleB) ruleB.priority = priorityA;
    },
    updateLink: (state, action: PayloadAction<UpdateLinkPayload>) => {
      const link = state.links.find((l) => l.id === action.payload.id);
      if (!link) return;
      if (typeof action.payload.changes.kind === 'string') {
        link.kind = action.payload.changes.kind;
      }
      if (typeof action.payload.changes.bidirectional === 'boolean') {
        const previousBidirectional = link.bidirectional ?? true;
        const nextBidirectional = action.payload.changes.bidirectional;
        link.bidirectional = nextBidirectional;

        if (previousBidirectional !== nextBidirectional) {
          const forwardId = managedAclRuleId(link.id);
          const forwardRule = state.aclRules.find((r) => r.id === forwardId);

          if (!nextBidirectional) {
            // G — desligou o bidirecional: cria a linha manual de exceção de retorno
            const exceptionId = `acl_manual_ret_topology_${link.id}`;
            const alreadyExists = state.aclRules.some(
              (r) => r.id === exceptionId,
            );
            if (!alreadyExists) {
              const exceptionRule: AclRule = {
                id: exceptionId,
                linkId: link.id,
                sourceNodeId: link.to,
                destinationNodeId: link.from,
                sourceScope: 'node',
                destinationScope: 'node',
                action: forwardRule?.action ?? 'ALLOW',
                service: forwardRule?.service ?? 'QUALQUER',
                enabled: true,
                managed: false,
                priority:
                  state.aclRules
                    .filter((r) => !r.managed)
                    .reduce((max, r) => Math.max(max, r.priority ?? 0), 0) +
                  10,
                source: 'manual',
                stateful: forwardRule?.stateful ?? true,
                bidirectional: false,
                passthrough: false,
                natExempt: false,
                protocol: forwardRule?.protocol ?? 'any',
                parentRuleId: forwardId,
                isReturnRule: true,
              };
              state.aclRules.push(
                normalizeAclRule(exceptionRule, state.nodes, state.siteVlans),
              );
              if (forwardRule) forwardRule.returnRuleId = exceptionId;
            }
          } else {
            // G — religou o bidirecional: remove a linha manual de exceção associada
            const removed = state.aclRules.find(
              (r) =>
                !r.managed && r.isReturnRule && r.parentRuleId === forwardId,
            );
            if (removed) {
              state.aclRules = state.aclRules.filter(
                (r) => r.id !== removed.id,
              );
              if (forwardRule?.returnRuleId === removed.id) {
                forwardRule.returnRuleId = undefined;
              }
            }
          }
        }
      }
      if (typeof action.payload.changes.duplexMode === 'string') {
        link.duplexMode = action.payload.changes.duplexMode;
      }
      if (typeof action.payload.changes.generateAcl === 'boolean') {
        link.generateAcl = action.payload.changes.generateAcl;
      }
      if (typeof action.payload.changes.statefulOverride === 'string') {
        link.statefulOverride = action.payload.changes.statefulOverride;
      }
      if (typeof action.payload.changes.description === 'string') {
        link.description = action.payload.changes.description;
      }
      state.aclRules = reconcileAclRules(state);
    },
    setInspectorNodeId: (state, action: PayloadAction<string | null>) => {
      state.ui.inspectorNodeId = action.payload;
    },
    setActiveLinkId: (state, action: PayloadAction<string | null>) => {
      state.ui.activeLinkId = action.payload;
    },
    setZoom: (state, action: PayloadAction<number>) => {
      state.ui.zoom = action.payload;
    },
    setPersistWarning: (state, action: PayloadAction<string | null>) => {
      state.meta.persistWarning = action.payload;
      state.meta.saveStatus = 'idle';
    },
    setSaveStatus: (
      state,
      action: PayloadAction<NetworkState['meta']['saveStatus']>,
    ) => {
      state.meta.saveStatus = action.payload;
    },
    markSaved: (state, action: PayloadAction<string>) => {
      state.meta.lastSavedAt = action.payload;
      state.meta.persistWarning = null;
      state.meta.saveStatus = 'saved';
    },

    // ── Fase 3 — CustomService ──────────────────────────────────────────────
    addCustomService: (
      state,
      action: PayloadAction<AddCustomServicePayload>,
    ) => {
      const id = `svc-${Date.now()}`;
      state.customServices.push({ id, ...action.payload });
    },
    updateCustomService: (
      state,
      action: PayloadAction<UpdateCustomServicePayload>,
    ) => {
      const svc = state.customServices.find((s) => s.id === action.payload.id);
      if (svc) Object.assign(svc, action.payload.changes);
    },
    removeCustomService: (
      state,
      action: PayloadAction<RemoveCustomServicePayload>,
    ) => {
      state.customServices = state.customServices.filter(
        (s) => s.id !== action.payload.id,
      );
    },

    // ── Fase 3 — Certificate ───────────────────────────────────────────────
    addCertificate: (state, action: PayloadAction<AddCertificatePayload>) => {
      const id = `cert-${Date.now()}`;
      state.certificates.push({ id, ...action.payload });
    },
    updateCertificate: (
      state,
      action: PayloadAction<UpdateCertificatePayload>,
    ) => {
      const cert = state.certificates.find((c) => c.id === action.payload.id);
      if (cert) Object.assign(cert, action.payload.changes);
    },
    removeCertificate: (
      state,
      action: PayloadAction<RemoveCertificatePayload>,
    ) => {
      state.certificates = state.certificates.filter(
        (c) => c.id !== action.payload.id,
      );
    },

    // ── Fase 3 — IPsec SA ──────────────────────────────────────────────────
    addIpsecSa: (state, action: PayloadAction<AddIpsecSaPayload>) => {
      const { linkId } = action.payload;
      if (!state.links.some((l) => l.id === linkId)) return;
      const id = `sa-${Date.now()}`;
      state.ipsecSas.push({ id, state: 'down', ...action.payload });
    },
    updateIpsecSa: (state, action: PayloadAction<UpdateIpsecSaPayload>) => {
      const sa = state.ipsecSas.find((s) => s.id === action.payload.id);
      if (sa) Object.assign(sa, action.payload.changes);
    },
    removeIpsecSa: (state, action: PayloadAction<RemoveIpsecSaPayload>) => {
      state.ipsecSas = state.ipsecSas.filter((s) => s.id !== action.payload.id);
    },

    // ── Fase 3 — SSL-VPN Profile ───────────────────────────────────────────
    addSslVpnProfile: (
      state,
      action: PayloadAction<AddSslVpnProfilePayload>,
    ) => {
      const { linkId } = action.payload;
      if (!state.links.some((l) => l.id === linkId)) return;
      const id = `svpn-${Date.now()}`;
      state.sslVpnProfiles.push({
        id,
        authMode: 'password',
        ...action.payload,
      });
    },
    updateSslVpnProfile: (
      state,
      action: PayloadAction<UpdateSslVpnProfilePayload>,
    ) => {
      const profile = state.sslVpnProfiles.find(
        (p) => p.id === action.payload.id,
      );
      if (profile) Object.assign(profile, action.payload.changes);
    },
    removeSslVpnProfile: (
      state,
      action: PayloadAction<RemoveSslVpnProfilePayload>,
    ) => {
      state.sslVpnProfiles = state.sslVpnProfiles.filter(
        (p) => p.id !== action.payload.id,
      );
    },

    // ── Fase 3 — Firewall Policy ───────────────────────────────────────────
    addFwPolicy: (state, action: PayloadAction<AddFwPolicyPayload>) => {
      const { nodeId } = action.payload;
      if (!state.nodes.some((n) => n.id === nodeId)) return;
      const priority =
        state.fwPolicies.filter((p) => p.nodeId === nodeId).length + 1;
      const id = `pol-${Date.now()}`;
      state.fwPolicies.push({
        id,
        action: 'accept',
        enabled: true,
        priority,
        ...action.payload,
      });
    },
    updateFwPolicy: (state, action: PayloadAction<UpdateFwPolicyPayload>) => {
      const pol = state.fwPolicies.find((p) => p.id === action.payload.id);
      if (pol) Object.assign(pol, action.payload.changes);
    },
    removeFwPolicy: (state, action: PayloadAction<RemoveFwPolicyPayload>) => {
      state.fwPolicies = state.fwPolicies.filter(
        (p) => p.id !== action.payload.id,
      );
    },

    // ── Fase 3 — NAT Rule ──────────────────────────────────────────────────
    addNatRule: (state, action: PayloadAction<AddNatRulePayload>) => {
      const { nodeId } = action.payload;
      if (!state.nodes.some((n) => n.id === nodeId)) return;
      const id = `nat-${Date.now()}`;
      state.natRules.push({ id, enabled: true, ...action.payload });
    },
    updateNatRule: (state, action: PayloadAction<UpdateNatRulePayload>) => {
      const rule = state.natRules.find((r) => r.id === action.payload.id);
      if (rule) Object.assign(rule, action.payload.changes);
    },
    removeNatRule: (state, action: PayloadAction<RemoveNatRulePayload>) => {
      state.natRules = state.natRules.filter((r) => r.id !== action.payload.id);
    },

    // ── Fase 3 — Active Sessions ───────────────────────────────────────────
    addActiveSession: (
      state,
      action: PayloadAction<AddActiveSessionPayload>,
    ) => {
      const { nodeId } = action.payload;
      if (!state.nodes.some((n) => n.id === nodeId)) return;
      const id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      state.activeSessions.push({
        state: 'ESTABLISHED',
        ...action.payload,
        id,
      });
    },
    clearActiveSessions: (
      state,
      action: PayloadAction<ClearActiveSessionsPayload>,
    ) => {
      state.activeSessions = state.activeSessions.filter(
        (s) => s.nodeId !== action.payload.nodeId,
      );
    },

    // ── Fase 3 — QoS em AclRule ────────────────────────────────────────────
    updateAclRuleQoS: (
      state,
      action: PayloadAction<UpdateAclRuleQoSPayload>,
    ) => {
      const rule = state.aclRules.find((r) => r.id === action.payload.id);
      if (!rule) return;
      const { id: _id, ...qosFields } = action.payload;
      Object.assign(rule, qosFields);
    },

    // ── Child action overrides (sobrescrita por IP/VLAN no painel de expansão)
    setAclChildOverride: (
      state,
      action: PayloadAction<SetAclChildOverridePayload>,
    ) => {
      const rule = state.aclRules.find((r) => r.id === action.payload.ruleId);
      if (!rule) return;
      if (!rule.childOverrides) rule.childOverrides = {};
      if (action.payload.action === null) {
        delete rule.childOverrides[action.payload.childId];
      } else {
        rule.childOverrides[action.payload.childId] = action.payload.action;
      }
    },
  },
});

export const {
  resetNetworkState,
  addSite,
  removeSite,
  updateSite,
  addSiteVlan,
  removeSiteVlan,
  upsertDhcpScope,
  removeDhcpScope,
  setVlanAssignmentMode,
  toggleNodeVlanAssignment,
  addSiteNetwork,
  removeSiteNetwork,
  addSubnet,
  removeSubnet,
  addNodeVlanInterface,
  removeNodeVlanInterface,
  // P13–P17 — QoS
  updateSiteVlanQos,
  updateNodeQosTrust,
  addQosQueue,
  updateQosQueue,
  removeQosQueue,
  updateLinkWanQos,
  addLayer,
  removeLayer,
  updateLayerTier,
  resizeLayer,
  addNode,
  addFloatingNode,
  removeNode,
  updateNodePosition,
  updateNode,
  updateNodeTechField,
  updateNodeZone,
  addLink,
  removeLink,
  updateAclRule,
  updateAclRuleQoS,
  setAclChildOverride,
  addCustomAclRule,
  removeCustomAclRule,
  reorderCustomAclRule,
  updateLink,
  setInspectorNodeId,
  setActiveLinkId,
  setZoom,
  setPersistWarning,
  setSaveStatus,
  markSaved,
  hydrateNetworkState,
  // Fase 3
  addCustomService,
  updateCustomService,
  removeCustomService,
  addCertificate,
  updateCertificate,
  removeCertificate,
  addIpsecSa,
  updateIpsecSa,
  removeIpsecSa,
  addSslVpnProfile,
  updateSslVpnProfile,
  removeSslVpnProfile,
  addFwPolicy,
  updateFwPolicy,
  removeFwPolicy,
  addNatRule,
  updateNatRule,
  removeNatRule,
  addActiveSession,
  clearActiveSessions,
} = networkSlice.actions;

export default networkSlice.reducer;
