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

export function findNextFreeIp(
  state: NetworkState,
  siteId: string,
  excludeNodeId: string | null,
  predicate: (ipNumber: number) => boolean,
) {
  const site = state.sites.find((item) => item.id === siteId);
  if (!site) return null;

  const used = new Set(
    state.nodes
      .filter(
        (node) =>
          node.siteId === siteId &&
          node.id !== excludeNodeId &&
          node.category !== 'wan',
      )
      .map((node) => ipToNumber(node.ip))
      .filter((value): value is number => value !== null),
  );

  const { min, max } = siteRangeBounds(site.ipOctet);
  for (let third = 1; third <= 254; third += 1) {
    for (let fourth = 1; fourth <= 254; fourth += 1) {
      const ipNumber = ipToNumber(`200.${site.ipOctet}.${third}.${fourth}`);
      if (ipNumber === null) continue;
      if (ipNumber < min || ipNumber > max) continue;
      if (!predicate(ipNumber)) continue;
      if (used.has(ipNumber)) continue;
      return numberToIp(ipNumber);
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

  const nextIp = findNextFreeIp(state, node.siteId, node.id, (candidate) => {
    const candidateIp = numberToIp(candidate);
    return !isIpInAnyVlan(candidateIp, siteVlans);
  });

  if (nextIp) {
    node.ip = nextIp;
  }
}

export function assignNodeIpInsideVlan(
  state: NetworkState,
  node: NodeItem,
  vlan: SiteVlan,
) {
  if (!node.siteId || node.category === 'wan') return false;
  const range = getVlanRange(vlan);
  if (!range) return false;

  const nextIp = findNextFreeIp(state, node.siteId, node.id, (candidate) => {
    return candidate >= range.start && candidate <= range.end;
  });

  if (!nextIp) return false;
  node.ip = nextIp;
  return true;
}

export { getVlanRange, ipToNumber, isIpInAnyVlan, isIpInVlan, numberToIp };
