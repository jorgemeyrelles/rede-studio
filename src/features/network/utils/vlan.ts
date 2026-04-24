import type { NetworkState, NodeItem, SiteVlan } from '../types';
import {
  ipToNumber,
  isIpInAnyVlan,
  getVlanRange,
  isIpInVlan,
  numberToIp,
  siteRangeBounds,
} from './ip';

export function toValidVlanId(value: number) {
  return Math.max(1, Math.min(4094, Math.trunc(value)));
}

export function siteOwnsVlan(
  siteVlans: SiteVlan[],
  siteId: string,
  vlanId: number,
) {
  return siteVlans.some(
    (item) => item.siteId === siteId && item.vlanId === vlanId,
  );
}

export function normalizeNodeVlansForCatalog(
  nodes: NodeItem[],
  siteVlans: SiteVlan[],
) {
  return nodes.map((node) => {
    if (!node.siteId || node.category === 'wan') {
      return { ...node, vlans: [] };
    }

    const cleaned = Array.from(
      new Set(
        (node.vlans ?? [])
          .map((value) => toValidVlanId(Number(value)))
          .filter((value) =>
            siteOwnsVlan(siteVlans, node.siteId as string, value),
          ),
      ),
    ).sort((a, b) => a - b);

    return {
      ...node,
      vlans: cleaned,
    };
  });
}

export function getSiteVlans(state: NetworkState, siteId: string) {
  return state.siteVlans.filter((item) => item.siteId === siteId);
}

export function getNodeHostCount(node: Pick<NodeItem, 'hostCount'>) {
  return Math.max(1, Math.trunc(Number(node.hostCount ?? 1) || 1));
}

export function getNodeReservedRange(node: Pick<NodeItem, 'ip' | 'hostCount'>) {
  const start = ipToNumber(node.ip);
  if (start === null) return null;

  const count = getNodeHostCount(node);
  const end = start + count - 1;

  return {
    start,
    end,
    count,
    startIp: numberToIp(start),
    endIp: numberToIp(end),
  };
}

function buildOccupiedIpSet(
  state: NetworkState,
  siteId: string,
  excludeNodeId: string | null,
) {
  const used = new Set<number>();

  state.nodes
    .filter(
      (node) =>
        node.siteId === siteId &&
        node.id !== excludeNodeId &&
        node.category !== 'wan',
    )
    .forEach((node) => {
      const reserved = getNodeReservedRange(node);
      if (!reserved) return;

      for (
        let candidate = reserved.start;
        candidate <= reserved.end;
        candidate += 1
      ) {
        used.add(candidate);
      }
    });

  return used;
}

function isCandidateBlockAvailable(
  used: Set<number>,
  start: number,
  blockSize: number,
  predicate: (ipNumber: number) => boolean,
) {
  for (let offset = 0; offset < blockSize; offset += 1) {
    const candidate = start + offset;
    if (!predicate(candidate) || used.has(candidate)) {
      return false;
    }
  }

  return true;
}

export function findNextFreeIpBlock(
  state: NetworkState,
  siteId: string,
  excludeNodeId: string | null,
  blockSize: number,
  predicate: (ipNumber: number) => boolean,
  preferredStartIp?: string,
) {
  const site = state.sites.find((item) => item.id === siteId);
  if (!site) return null;

  const used = buildOccupiedIpSet(state, siteId, excludeNodeId);

  const { min, max } = siteRangeBounds(site.ipOctet);

  const resolveCandidate = (candidate: number | null) => {
    if (candidate === null) return null;
    if (candidate < min || candidate > max) return null;
    if (candidate + blockSize - 1 > max) return null;
    if (!isCandidateBlockAvailable(used, candidate, blockSize, predicate)) {
      return null;
    }
    return numberToIp(candidate);
  };

  const preferred = preferredStartIp ? ipToNumber(preferredStartIp) : null;
  const preferredIp = resolveCandidate(preferred);
  if (preferredIp) return preferredIp;

  for (let third = 1; third <= 254; third += 1) {
    for (let fourth = 1; fourth <= 254; fourth += 1) {
      const ipNumber = ipToNumber(`200.${site.ipOctet}.${third}.${fourth}`);
      const nextIp = resolveCandidate(ipNumber);
      if (nextIp) return nextIp;
    }
  }

  return null;
}

export function assignNodeIpOutsideVlans(state: NetworkState, node: NodeItem) {
  if (!node.siteId || node.category === 'wan') return;
  const siteVlans = getSiteVlans(state, node.siteId);
  const originalIp = node.originalIp ?? null;

  if (
    originalIp &&
    !isIpInAnyVlan(originalIp, siteVlans) &&
    !state.nodes.some(
      (item) =>
        item.id !== node.id &&
        item.siteId === node.siteId &&
        item.ip === originalIp,
    )
  ) {
    node.ip = originalIp;
    return;
  }

  const nextIp = findNextFreeIpBlock(
    state,
    node.siteId,
    node.id,
    1,
    (candidate) => {
      const candidateIp = numberToIp(candidate);
      return !isIpInAnyVlan(candidateIp, siteVlans);
    },
    originalIp ?? undefined,
  );

  if (nextIp) {
    node.ip = nextIp;
  }
}

export function assignNodeIpInsideVlan(
  state: NetworkState,
  node: NodeItem,
  vlan: SiteVlan,
  preferredStartIp?: string,
) {
  if (!node.siteId || node.category === 'wan') return false;
  const range = getVlanRange(vlan);
  if (!range) return false;

  const nextIp = findNextFreeIpBlock(
    state,
    node.siteId,
    node.id,
    getNodeHostCount(node),
    (candidate) => candidate >= range.start && candidate <= range.end,
    preferredStartIp,
  );

  if (!nextIp) return false;
  node.ip = nextIp;
  return true;
}

export function getAvailableVlanCapacityForNode(
  state: Pick<NetworkState, 'nodes' | 'siteVlans'>,
  node: NodeItem,
  vlan: SiteVlan,
) {
  if (!node.siteId) return 1;

  const range = getVlanRange(vlan);
  if (!range) return 1;

  const used = buildOccupiedIpSet(state as NetworkState, node.siteId, node.id);
  let available = 0;

  for (let candidate = range.start; candidate <= range.end; candidate += 1) {
    if (!used.has(candidate)) {
      available += 1;
    }
  }

  return Math.max(1, available);
}

export { getVlanRange, ipToNumber, isIpInAnyVlan, isIpInVlan, numberToIp };
