import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  AddLinkPayload,
  AddNodePayload,
  AddSiteVlanPayload,
  Layer,
  NetworkState,
  NodeCategory,
  RemoveSiteVlanPayload,
  SetVlanAssignmentPayload,
  ToggleNodeVlanPayload,
  UpdateAclRulePayload,
  UpdateNodePayload,
  UpdateNodeTechFieldPayload,
  UpdateSitePayload,
} from './types';
import { SCHEMA_VERSION } from './constants';
import {
  buildDefaultTechProfile,
  ensureTechProfile,
  normalizeTechProfile,
} from './techProfiles';
import {
  assignNodeIpInsideVlan,
  assignNodeIpOutsideVlans,
  buildIpFromSiteAndRadical,
  buildNodeIp,
  buildNodeLabel,
  ipToNumber,
  isIpInVlan,
  makeLayerId,
  makeNodeId,
  makeSiteId,
  reconcileAclRules,
  siteOwnsVlan,
  siteRangeBounds,
  toValidVlanId,
  getCategoryHostBase,
  normalizeNodeVlansForCatalog,
  numberToIp,
} from './utils';

const initialState: NetworkState = {
  sites: [],
  layers: [],
  nodes: [
    {
      id: 'wan_1',
      label: 'WAN/Internet',
      category: 'wan',
      ip: '',
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
  counters: {
    site: 1,
    layer: 1,
    node: 1,
    link: 1,
  },
  ui: {
    inspectorNodeId: null,
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

function normalizeState(input: NetworkState): NetworkState {
  const normalizedSiteVlans = Array.isArray(input.siteVlans)
    ? input.siteVlans
        .filter((item) =>
          Boolean(
            item &&
            item.siteId &&
            input.sites.some((site) => site.id === item.siteId),
          ),
        )
        .map((item) => {
          const site = input.sites.find(
            (siteItem) => siteItem.id === item.siteId,
          );
          const vlanId = toValidVlanId(Number(item.vlanId));

          const vlanNodes = input.nodes.filter(
            (node) =>
              node.siteId === item.siteId &&
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
            id: item.id || `${item.siteId}-vlan-${vlanId}`,
            siteId: item.siteId,
            vlanId,
            name: item.name || `VLAN ${vlanId}`,
            capacity: rawCapacity,
            startRadical,
            startIp: rawStartIp,
            endIp: rawEndIpFromItem ?? computedEndIp,
          };
        })
    : [];

  const normalizedNodes = normalizeNodeVlansForCatalog(
    input.nodes.map((node) => {
      const layerOrder = node.layerId
        ? (input.layers.find((layer) => layer.id === node.layerId)?.order ?? 1)
        : 0;
      const shouldBeGateway =
        node.siteId &&
        (node.category === 'router' || node.category === 'firewall') &&
        layerOrder === 1;
      return {
        ...node,
        originalIp:
          node.category === 'wan'
            ? undefined
            : node.originalIp && ipToNumber(node.originalIp) !== null
              ? node.originalIp
              : node.ip,
        techProfile: ensureTechProfile(node.category, node.techProfile, {
          layerOrder,
          shouldBeGateway: Boolean(shouldBeGateway),
          siteNodeCount: node.siteId
            ? input.nodes.filter((item) => item.siteId === node.siteId).length
            : 0,
        }),
      };
    }),
    normalizedSiteVlans,
  );

  const fallbackUi = input.ui ?? { inspectorNodeId: null, zoom: 1 };

  return {
    ...input,
    siteVlans: normalizedSiteVlans,
    nodes: normalizedNodes,
    ui: {
      ...fallbackUi,
      vlanAssignment:
        fallbackUi.vlanAssignment &&
        siteOwnsVlan(
          normalizedSiteVlans,
          fallbackUi.vlanAssignment.siteId,
          toValidVlanId(Number(fallbackUi.vlanAssignment.vlanId)),
        )
          ? {
              siteId: fallbackUi.vlanAssignment.siteId,
              vlanId: toValidVlanId(Number(fallbackUi.vlanAssignment.vlanId)),
            }
          : null,
    },
    aclRules: reconcileAclRules({
      aclRules: input.aclRules ?? [],
      links: input.links,
      nodes: normalizedNodes,
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
      nodes: [...initialState.nodes],
      counters: { ...initialState.counters },
      ui: { ...initialState.ui, vlanAssignment: null },
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
    addLayer: (state, action: PayloadAction<{ siteId: string }>) => {
      const { siteId } = action.payload;
      const siteExists = state.sites.some((site) => site.id === siteId);
      if (!siteExists) return;

      const layerId = makeLayerId(state.counters.layer);
      const order = getLayerOrder(state.layers, siteId);
      state.layers.push({
        id: layerId,
        siteId,
        name: `Camada ${order}`,
        order,
        width: 320,
        height: 180,
        minWidth: 220,
        maxWidth: 680,
        minHeight: 140,
        maxHeight: 520,
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

      const categoryCount =
        state.nodes.filter(
          (node) =>
            node.siteId === siteId &&
            node.layerId === layerId &&
            node.category === category,
        ).length + 1;
      const nodeId = makeNodeId(category, categoryCount, siteId, layerId);
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
        ip: buildNodeIp(site.ipOctet, layer.order, category, categoryCount),
        originalIp: buildNodeIp(
          site.ipOctet,
          layer.order,
          category,
          categoryCount,
        ),
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
      const categoryCount =
        state.nodes.filter(
          (node) => !node.siteId && !node.layerId && node.category === category,
        ).length + 1;
      const nodeId = makeNodeId(category, categoryCount);
      const nodeOrder = state.counters.node;
      state.nodes.push({
        id: nodeId,
        category,
        label: `${category.toUpperCase()} ${categoryCount}`,
        ip: `200.200.1.${Math.max(1, Math.min(254, nodeOrder))}`,
        originalIp: `200.200.1.${Math.max(1, Math.min(254, nodeOrder))}`,
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
      if (typeof action.payload.changes.label === 'string') {
        node.label = action.payload.changes.label;
      }
      if (!isWan && typeof action.payload.changes.ip === 'string') {
        node.ip = action.payload.changes.ip;
        if ((node.vlans ?? []).length === 0) {
          node.originalIp = action.payload.changes.ip;
        }
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
          assignNodeIpOutsideVlans(state, node);
        } else {
          if (!hadVlansBefore && node.ip) {
            node.originalIp = node.originalIp ?? node.ip;
          }
          const targetVlan =
            (siteId
              ? state.siteVlans.find(
                  (item) =>
                    item.siteId === siteId && item.vlanId === node.vlans[0],
                )
              : null) ?? null;

          if (targetVlan) {
            const moved = assignNodeIpInsideVlan(state, node, targetVlan);
            if (!moved) {
              state.meta.persistWarning = `VLAN ${targetVlan.vlanId} sem IP livre para o elemento ${node.label}.`;
            }
          }
        }
      }
      if (typeof action.payload.changes.description === 'string') {
        node.description = action.payload.changes.description;
      }
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
        kind: action.payload.kind ?? 'other',
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
    },
    setInspectorNodeId: (state, action: PayloadAction<string | null>) => {
      state.ui.inspectorNodeId = action.payload;
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
  addLayer,
  removeLayer,
  resizeLayer,
  addNode,
  addFloatingNode,
  removeNode,
  updateNodePosition,
  updateNode,
  updateNodeTechField,
  addLink,
  removeLink,
  updateAclRule,
  setInspectorNodeId,
  setZoom,
  setPersistWarning,
  markSaved,
  hydrateNetworkState,
} = networkSlice.actions;

export default networkSlice.reducer;
