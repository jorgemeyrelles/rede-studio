import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type {
  AclAction,
  AclRule,
  Layer,
  LinkItem,
  LinkKind,
  NetworkState,
  NodeCategory,
  NodeItem,
} from './types';
import {
  buildDefaultTechProfile,
  ensureTechProfile,
  normalizeTechProfile,
  type TechValue,
} from './techProfiles';

const SCHEMA_VERSION = 1;

function isAclEligibleLink(nodes: NodeItem[], link: LinkItem) {
  const from = nodes.find((node) => node.id === link.from);
  const to = nodes.find((node) => node.id === link.to);

  return (
    from?.category === 'firewall' ||
    to?.category === 'firewall' ||
    link.kind === 'vpn' ||
    link.kind === 'ipsec'
  );
}

function getDefaultAclService(
  linkKind: LinkKind,
  fromCategory?: NodeCategory,
  toCategory?: NodeCategory,
) {
  const categories = new Set([fromCategory, toCategory]);

  if (linkKind === 'vpn' || linkKind === 'ipsec') {
    return 'ICMP, TCP 443/80';
  }

  if (categories.has('printer')) {
    return 'TCP 445/80';
  }

  if (categories.has('server') || categories.has('nas')) {
    return 'TCP 445/22/80/443';
  }

  if (
    categories.has('router') ||
    categories.has('firewall') ||
    categories.has('switch')
  ) {
    return 'QUALQUER';
  }

  if (
    categories.has('pc') ||
    categories.has('voip') ||
    categories.has('access-point')
  ) {
    return 'TCP 443/80, ICMP';
  }

  return 'QUALQUER';
}

function reconcileAclRules(
  state: Pick<NetworkState, 'aclRules' | 'links' | 'nodes'>,
) {
  const existingRules = Array.isArray(state.aclRules) ? state.aclRules : [];
  const existingManagedByLinkId = new Map(
    existingRules
      .filter((rule) => rule.managed && rule.linkId)
      .map((rule) => [rule.linkId as string, rule]),
  );
  const validNodeIds = new Set(state.nodes.map((node) => node.id));

  const managedRules: AclRule[] = state.links
    .filter((link) => isAclEligibleLink(state.nodes, link))
    .map((link) => {
      const previousRule = existingManagedByLinkId.get(link.id);
      const from = state.nodes.find((node) => node.id === link.from);
      const to = state.nodes.find((node) => node.id === link.to);

      return {
        id: previousRule?.id ?? `acl_${link.id}`,
        linkId: link.id,
        sourceNodeId: link.from,
        destinationNodeId: link.to,
        action: previousRule?.action ?? 'ALLOW',
        service:
          previousRule?.service ??
          getDefaultAclService(link.kind, from?.category, to?.category),
        enabled: previousRule?.enabled ?? true,
        managed: true,
      };
    });

  const manualRules = existingRules.filter(
    (rule) =>
      !rule.managed &&
      validNodeIds.has(rule.sourceNodeId) &&
      validNodeIds.has(rule.destinationNodeId),
  );

  return [...managedRules, ...manualRules];
}

function makeSiteId(index: number) {
  return `site_${index}`;
}

function makeLayerId(index: number) {
  return `camada_${index}`;
}

function makeNodeId(
  category: NodeCategory,
  index: number,
  siteId?: string,
  layerId?: string,
) {
  if (siteId && layerId) {
    return `${siteId}.${layerId}.${category}_${index}`;
  }
  return `${category}_${index}`;
}

function getCategoryCode(category: NodeCategory) {
  const table: Record<NodeCategory, string> = {
    wan: 'WAN',
    router: 'RTR',
    firewall: 'FW',
    switch: 'SW',
    'load-balancer': 'LB',
    'access-point': 'AP',
    ids: 'IDS',
    ips: 'IPS',
    proxy: 'PX',
    modem: 'MDM',
    dns: 'DNS',
    dhcp: 'DHCP',
    nas: 'NAS',
    printer: 'PRN',
    voip: 'VOIP',
    pc: 'PC',
    server: 'SRV',
    sdwan: 'SDW',
    vpn: 'VPN',
    ipsec: 'IPSEC',
    wireguard: 'WG',
    mpls: 'MPLS',
    gre: 'GRE',
  };
  return table[category] ?? category.toUpperCase();
}

function parseTrailingNumber(value: string, fallback = 1) {
  const match = value.match(/(\d+)$/);
  if (!match) return fallback;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function buildNodeLabel(
  category: NodeCategory,
  siteId: string,
  layerOrder: number,
  categoryCount: number,
) {
  const categoryCode = getCategoryCode(category);
  const siteNumber = parseTrailingNumber(siteId, 1);
  const safeLayer = Math.max(1, layerOrder);
  const seq = String(Math.max(1, categoryCount)).padStart(2, '0');
  return `${categoryCode}-S${siteNumber}-C${safeLayer}-${seq}`;
}

function getCategoryHostBase(category: NodeCategory) {
  const table: Record<NodeCategory, number> = {
    wan: 1,
    router: 10,
    firewall: 20,
    switch: 30,
    'load-balancer': 40,
    'access-point': 50,
    ids: 60,
    ips: 70,
    proxy: 80,
    modem: 90,
    dns: 100,
    dhcp: 110,
    nas: 120,
    printer: 130,
    voip: 140,
    pc: 150,
    server: 160,
    sdwan: 170,
    vpn: 180,
    ipsec: 190,
    wireguard: 200,
    mpls: 210,
    gre: 220,
  };
  return table[category] ?? 230;
}

function buildNodeIp(
  siteOctet: number,
  layerOrder: number,
  category: NodeCategory,
  categoryCount: number,
) {
  const third = Math.max(1, Math.min(254, layerOrder));
  const hostBase = getCategoryHostBase(category);
  const fourth = Math.max(1, Math.min(254, hostBase + categoryCount - 1));
  return `200.${siteOctet}.${third}.${fourth}`;
}

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
  counters: {
    site: 1,
    layer: 1,
    node: 1,
    link: 1,
  },
  ui: {
    inspectorNodeId: null,
    zoom: 1,
  },
  meta: {
    schemaVersion: SCHEMA_VERSION,
    projectName: 'Projeto Rede Interativa',
    persistWarning: null,
    lastSavedAt: null,
  },
};

type AddNodePayload = {
  siteId: string;
  layerId: string;
  category: NodeCategory;
};

type UpdateNodePayload = {
  id: string;
  changes: Partial<{
    label: string;
    ip: string;
    cidr: number;
    vlans: number[];
    description: string;
  }>;
};

type AddLinkPayload = {
  from: string;
  to: string;
  kind?: LinkKind;
};

type UpdateNodeTechFieldPayload = {
  id: string;
  key: string;
  value: TechValue;
};

type UpdateAclRulePayload = {
  id: string;
  changes: Partial<{
    action: AclAction;
    service: string;
    enabled: boolean;
  }>;
};

type UpdateSitePayload = {
  id: string;
  changes: Partial<{
    name: string;
    ipOctet: number;
    cidr: number;
  }>;
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
  const normalizedNodes = input.nodes.map((node) => {
    const layerOrder = node.layerId
      ? (input.layers.find((layer) => layer.id === node.layerId)?.order ?? 1)
      : 0;
    const shouldBeGateway =
      node.siteId &&
      (node.category === 'router' || node.category === 'firewall') &&
      layerOrder === 1;
    return {
      ...node,
      techProfile: ensureTechProfile(node.category, node.techProfile, {
        layerOrder,
        shouldBeGateway: Boolean(shouldBeGateway),
        siteNodeCount: node.siteId
          ? input.nodes.filter((item) => item.siteId === node.siteId).length
          : 0,
      }),
    };
  });

  return {
    ...input,
    nodes: normalizedNodes,
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
      nodes: [...initialState.nodes],
      counters: { ...initialState.counters },
      ui: { ...initialState.ui },
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
      }
      if (!isWan && typeof action.payload.changes.cidr === 'number') {
        node.cidr = action.payload.changes.cidr;
      }
      if (!isWan && Array.isArray(action.payload.changes.vlans)) {
        node.vlans = action.payload.changes.vlans;
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
