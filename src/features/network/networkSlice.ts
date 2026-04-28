import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  AclRule,
  AddCustomAclRulePayload,
  AddCustomServicePayload,
  AddCertificatePayload,
  AddIpsecSaPayload,
  AddSslVpnProfilePayload,
  AddFwPolicyPayload,
  AddNatRulePayload,
  AddActiveSessionPayload,
  AddLayerPayload,
  AddLinkPayload,
  AddNodePayload,
  AddSiteNetworkPayload,
  AddSiteVlanPayload,
  AddSubnetPayload,
  ClearActiveSessionsPayload,
  Layer,
  NetworkState,
  NodeCategory,
  RemoveCertificatePayload,
  RemoveCustomAclRulePayload,
  RemoveCustomServicePayload,
  RemoveFwPolicyPayload,
  RemoveIpsecSaPayload,
  RemoveNatRulePayload,
  RemoveSiteNetworkPayload,
  RemoveSiteVlanPayload,
  RemoveSslVpnProfilePayload,
  RemoveSubnetPayload,
  ReorderCustomAclRulePayload,
  SetVlanAssignmentPayload,
  ToggleNodeVlanPayload,
  UpdateAclRulePayload,
  UpdateAclRuleQoSPayload,
  SetAclChildOverridePayload,
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
} from './types';
import { SCHEMA_VERSION } from './constants';
import {
  buildDefaultTechProfile,
  ensureTechProfile,
  normalizeTechProfile,
} from './techProfiles';
import {
  normalizeAclRule,
  assignNodeIpInsideVlan,
  assignNodeIpOutsideVlans,
  buildNodeHostAllocations,
  buildIpFromSiteAndRadical,
  buildNodeIp,
  buildNodeLabel,
  getCategoryCode,
  getNextNodeSequence,
  ipToNumber,
  isIpInVlan,
  makeLayerId,
  makeNodeId,
  makeSiteId,
  parseTrailingNumber,
  reconcileAclRules,
  siteOwnsVlan,
  siteRangeBounds,
  toValidVlanId,
  getCategoryHostBase,
  getVlanRange,
  normalizeNodeVlansForCatalog,
  numberToIp,
} from './utils';

const initialState: NetworkState = {
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
    return 'lan';
  }

  return 'other';
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
        hostCount:
          node.category === 'wan'
            ? 1
            : Math.max(1, Math.trunc(Number(node.hostCount ?? 1) || 1)),
        hostAllocations: buildNodeHostAllocations({
          id: node.id,
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

  const normalizedLinks = (input.links ?? []).map((link) => ({
    ...link,
    from: nodeIdMap.get(link.from) ?? link.from,
    to: nodeIdMap.get(link.to) ?? link.to,
  }));

  const remappedAclRules = (input.aclRules ?? []).map((rule) => ({
    ...rule,
    sourceNodeId: nodeIdMap.get(rule.sourceNodeId) ?? rule.sourceNodeId,
    destinationNodeId:
      nodeIdMap.get(rule.destinationNodeId) ?? rule.destinationNodeId,
  }));

  const fallbackUi = input.ui ?? { inspectorNodeId: null, zoom: 1 };

  return {
    ...input,
    sites: normalizedSites,
    layers: normalizedLayers,
    siteVlans: normalizedSiteVlans,
    // Fase 2 — preserva ou inicializa arrays; filtra orphans (siteId inválido)
    siteNetworks: Array.isArray(input.siteNetworks)
      ? input.siteNetworks
          .filter((n) =>
            normalizedSites.some(
              (s) => s.id === (siteIdMap.get(n.siteId) ?? n.siteId),
            ),
          )
          .map((n) => ({ ...n, siteId: siteIdMap.get(n.siteId) ?? n.siteId }))
      : [],
    subnets: Array.isArray(input.subnets)
      ? input.subnets
          .filter((s) =>
            normalizedSites.some(
              (site) => site.id === (siteIdMap.get(s.siteId) ?? s.siteId),
            ),
          )
          .map((s) => ({ ...s, siteId: siteIdMap.get(s.siteId) ?? s.siteId }))
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
  initialState,
  reducers: {
    resetNetworkState: () => ({
      ...initialState,
      sites: [],
      layers: [],
      links: [],
      aclRules: [],
      siteVlans: [],
      siteNetworks: [],
      subnets: [],
      customServices: [],
      certificates: [],
      ipsecSas: [],
      sslVpnProfiles: [],
      fwPolicies: [],
      natRules: [],
      activeSessions: [],
      nodes: [...initialState.nodes],
      counters: { ...initialState.counters },
      ui: { ...initialState.ui, activeLinkId: null, vlanAssignment: null },
      meta: { ...initialState.meta },
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
      const { siteId } = action.payload;
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
      const startIp = buildIpFromSiteAndRadical(
        site.ipOctet,
        action.payload.startRadical,
      );
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
      const { min: siteMin, max: siteMax } = siteRangeBounds(site.ipOctet);
      if (endNumber > siteMax || startNumber < siteMin) {
        state.meta.persistWarning =
          'Range da VLAN ultrapassa os limites de endereco do site.';
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

      state.siteVlans.push({
        id: `${siteId}-vlan-${vlanId}`,
        siteId,
        vlanId,
        name: action.payload.name?.trim() || `VLAN ${vlanId}`,
        capacity,
        startRadical: action.payload.startRadical,
        startIp,
        endIp,
      });

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
    setVlanAssignmentMode: (
      state,
      action: PayloadAction<SetVlanAssignmentPayload>,
    ) => {
      if (!action.payload) {
        state.ui.vlanAssignment = null;
        return;
      }

      const vlanId = toValidVlanId(action.payload.vlanId);
      const exists = state.siteVlans.some(
        (item) =>
          item.siteId === action.payload.siteId && item.vlanId === vlanId,
      );
      state.ui.vlanAssignment = exists
        ? { siteId: action.payload.siteId, vlanId }
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
        if (!node.originalIp && node.ip) {
          node.originalIp = node.ip;
        }
        const moved = assignNodeIpInsideVlan(state, node, vlan);
        if (!moved) {
          state.meta.persistWarning = `VLAN ${vlanId} sem IP livre para o elemento ${node.label}.`;
        }
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
      const { siteId, name, purpose, addressFamily, thirdOctet, cidr } =
        action.payload;
      if (!state.sites.some((s) => s.id === siteId)) return;

      const id = `${siteId}-net-${Date.now()}`;
      state.siteNetworks.push({
        id,
        siteId,
        name: name.trim() || 'Rede',
        purpose,
        addressFamily,
        thirdOctet: Math.max(0, Math.min(255, Math.trunc(thirdOctet))),
        cidr: Math.max(8, Math.min(30, Math.trunc(cidr))),
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
      });
    },
    removeSubnet: (state, action: PayloadAction<RemoveSubnetPayload>) => {
      state.subnets = state.subnets.filter((s) => s.id !== action.payload.id);
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
      const { siteId, tier, name } = action.payload;
      const siteExists = state.sites.some((site) => site.id === siteId);
      if (!siteExists) return;

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
        maxWidth: 884,
        minHeight: 180, // mínimo = altura na criação
        maxHeight: 300, // máximo ≈ 3 nós empilhados (3×76 + margens)
        tier,
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
      action: PayloadAction<{ layerId: string; width: number; height: number }>,
    ) => {
      const layer = state.layers.find(
        (item) => item.id === action.payload.layerId,
      );
      if (!layer) return;
      layer.width = Math.max(
        layer.minWidth,
        Math.min(layer.maxWidth, action.payload.width),
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
        category,
        label: buildNodeLabel(category, siteId, layer.order, categoryCount),
        ip: nodeIp,
        originalIp: buildNodeIp(
          site.ipOctet,
          layer.order,
          category,
          categoryCount,
        ),
        hostCount: 1,
        hostAllocations: [{ id: nodeId, ip: nodeIp }],
        cidr: site.cidr,
        vlans: [],
        x: position.x,
        y: position.y,
        description: 'Componente criado no Studio.',
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
        originalIp: floatingIp,
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

      node.hostAllocations = buildNodeHostAllocations(node);
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
    },
    addLink: (state, action: PayloadAction<AddLinkPayload>) => {
      const { from, to } = action.payload;
      if (from === to) return;
      const alreadyExists = state.links.some(
        (link) =>
          (link.from === from && link.to === to) ||
          (link.from === to && link.to === from),
      );
      if (alreadyExists) return;

      state.links.push({
        id: `link_${state.counters.link}`,
        from,
        to,
        kind: inferLinkKind(state, from, to, action.payload.kind),
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
    },
    markSaved: (state, action: PayloadAction<string>) => {
      state.meta.lastSavedAt = action.payload;
      state.meta.persistWarning = null;
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
  setVlanAssignmentMode,
  toggleNodeVlanAssignment,
  addSiteNetwork,
  removeSiteNetwork,
  addSubnet,
  removeSubnet,
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
