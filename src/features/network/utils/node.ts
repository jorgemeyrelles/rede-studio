import { CATEGORY_CODE_MAP, CATEGORY_HOST_BASE_MAP } from '../constants';
import type { NodeCategory, NodeItem, SiteNetwork } from '../types';
import { buildNetworkAddress, ipToNumber, numberToIp } from './ip';

export function makeSiteId(index: number) {
  return `S${index}`;
}

export function makeLayerId(siteId: string, index: number) {
  return `${siteId}.C${index}`;
}

export function makeNodeId(
  category: NodeCategory,
  index: number,
  siteId?: string,
  layerId?: string,
) {
  const categoryCode = getCategoryCode(category);
  if (siteId && layerId) {
    return `${siteId}.${layerId}.${categoryCode}${index}`;
  }
  return `${categoryCode}${index}`;
}

export function getCategoryCode(category: NodeCategory) {
  return CATEGORY_CODE_MAP[category] ?? category.toUpperCase();
}

export function parseTrailingNumber(value: string, fallback = 1) {
  const match = value.match(/(\d+)$/);
  if (!match) return fallback;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function getNodeIdPrefix(value: string) {
  const match = value.match(/^(.*?)(\d+)$/);
  if (!match) {
    return { prefix: value, start: 1 };
  }

  return {
    prefix: match[1],
    start: Number(match[2]),
  };
}

export function buildNodeHostAllocations(
  node: Pick<NodeItem, 'id' | 'ip' | 'hostCount'>,
) {
  const startIp = ipToNumber(node.ip);
  if (startIp === null) {
    return [{ id: node.id, ip: node.ip }];
  }

  const count = Math.max(1, Math.trunc(Number(node.hostCount ?? 1) || 1));
  const { prefix, start } = getNodeIdPrefix(node.id);

  return Array.from({ length: count }, (_entry, index) => ({
    id: index === 0 ? node.id : `${prefix}${start + index}`,
    ip: numberToIp(startIp + index),
  }));
}

export function getNextNodeSequence(
  nodes: NodeItem[],
  category: NodeCategory,
  siteId?: string,
  layerId?: string,
) {
  const categoryCode = getCategoryCode(category);
  const relevant = nodes.filter(
    (node) =>
      node.category === category &&
      node.siteId === siteId &&
      node.layerId === layerId,
  );

  const maxUsed = relevant.reduce((highest, node) => {
    const allocations =
      node.hostAllocations.length > 0
        ? node.hostAllocations
        : [{ id: node.id, ip: node.ip }];
    const localMax = allocations.reduce((innerHighest, allocation) => {
      if (!allocation.id.includes(categoryCode)) return innerHighest;
      return Math.max(innerHighest, parseTrailingNumber(allocation.id, 0));
    }, 0);
    return Math.max(highest, localMax);
  }, 0);

  return Math.max(1, maxUsed + 1);
}

export function buildNodeLabel(
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

export function getCategoryHostBase(category: NodeCategory) {
  return CATEGORY_HOST_BASE_MAP[category] ?? 230;
}

export function buildNodeIp(
  siteOctet: number,
  layerOrder: number,
  category: NodeCategory,
  categoryCount: number,
  network?: Pick<SiteNetwork, 'addressFamily' | 'thirdOctet'>,
) {
  const hostBase = getCategoryHostBase(category);
  const fourth = Math.max(1, Math.min(254, hostBase + categoryCount - 1));

  if (!network) {
    const third = Math.max(1, Math.min(254, layerOrder));
    return `200.${siteOctet}.${third}.${fourth}`;
  }

  // Com rede definida: 3º octeto fixo da rede, 4º octeto por categoria
  const base = buildNetworkAddress(
    network.addressFamily,
    network.thirdOctet,
    siteOctet,
  );
  const baseParts = base.split('.').map(Number);
  if (baseParts.length !== 4 || baseParts.some((p) => !Number.isFinite(p))) {
    const third = Math.max(1, Math.min(254, layerOrder));
    return `200.${siteOctet}.${third}.${fourth}`;
  }
  return `${baseParts[0]}.${baseParts[1]}.${baseParts[2]}.${fourth}`;
}
