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
  if (siteId) {
    return `${siteId}.${categoryCode}${index}`;
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

/**
 * Sprint equipamentos Fase 12 (correção) — cada unidade extra
 * (`hostAllocations[1..]`) pode ter marca/modelo próprios, independentes
 * das outras unidades e do nó pai. `previousAllocations` (o array anterior
 * à reconstrução) é usado pra preservar esses valores: se uma unidade já
 * existia (mesmo `id`), seus `equipmentBrand`/`equipmentModel` — inclusive
 * se `undefined`, ou seja, explicitamente limpos pelo usuário — são
 * copiados como estão; se é uma unidade nova (id nunca visto antes), ela
 * herda o valor atual do nó pai como default inicial, editável depois.
 */
export function buildNodeHostAllocations(
  node: Pick<
    NodeItem,
    'id' | 'ip' | 'hostCount' | 'equipmentBrand' | 'equipmentModel'
  >,
  options?: {
    usedIds?: Iterable<string>;
    previousAllocations?: Array<{
      id: string;
      equipmentBrand?: string;
      equipmentModel?: string;
    }>;
  },
) {
  const startIp = ipToNumber(node.ip);
  if (startIp === null) {
    return [{ id: node.id, ip: node.ip }];
  }

  const count = Math.max(1, Math.trunc(Number(node.hostCount ?? 1) || 1));
  const { prefix, start } = getNodeIdPrefix(node.id);
  const scopedUsedIds = new Set<string>();

  for (const candidate of options?.usedIds ?? []) {
    if (candidate.startsWith(prefix)) {
      scopedUsedIds.add(candidate);
    }
  }

  scopedUsedIds.delete(node.id);

  const generatedIds = new Set<string>([node.id]);
  const previousById = new Map(
    (options?.previousAllocations ?? []).map((allocation) => [
      allocation.id,
      allocation,
    ]),
  );

  return Array.from({ length: count }, (_entry, index) => {
    if (index === 0) {
      return {
        id: node.id,
        ip: numberToIp(startIp + index),
      };
    }

    let sequence = start + index;
    let candidateId = `${prefix}${sequence}`;
    while (scopedUsedIds.has(candidateId) || generatedIds.has(candidateId)) {
      sequence += 1;
      candidateId = `${prefix}${sequence}`;
    }

    generatedIds.add(candidateId);
    const previous = previousById.get(candidateId);
    return {
      id: candidateId,
      ip: numberToIp(startIp + index),
      equipmentBrand: previous ? previous.equipmentBrand : node.equipmentBrand,
      equipmentModel: previous ? previous.equipmentModel : node.equipmentModel,
    };
  });
}

export function getNextNodeSequence(
  nodes: NodeItem[],
  category: NodeCategory,
  siteId?: string,
  layerId?: string,
) {
  const categoryCode = getCategoryCode(category);
  const relevant = nodes.filter((node) => {
    if (node.category !== category) return false;
    if (layerId !== undefined) {
      return node.siteId === siteId && node.layerId === layerId;
    }
    if (siteId !== undefined) {
      // Sprint equipamentos Fase 2 — escopo "só site, sem layer": nós de
      // relação entre sites nunca têm siteId, só originSiteId.
      return (
        node.layerId === undefined &&
        (node.siteId === siteId || node.originSiteId === siteId)
      );
    }
    return node.siteId === undefined && node.layerId === undefined;
  });

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

/**
 * Sprint equipamentos Fase 2 — variante "só site, sem layer" de
 * `buildNodeLabel`, usada por elementos de conexão inter-site que
 * referenciam um site de origem mas não pertencem a nenhuma layer.
 */
export function buildNodeLabelForSite(
  category: NodeCategory,
  siteId: string,
  categoryCount: number,
) {
  const categoryCode = getCategoryCode(category);
  const siteNumber = parseTrailingNumber(siteId, 1);
  const seq = String(Math.max(1, categoryCount)).padStart(2, '0');
  return `${categoryCode}-S${siteNumber}-${seq}`;
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

export function buildNodeIpv6(
  siteOctet: number,
  layerOrder: number,
  category: NodeCategory,
  categoryCount: number,
  network?: Pick<SiteNetwork, 'ipv6Prefix'>,
) {
  const hostBase = getCategoryHostBase(category);
  const host = Math.max(1, hostBase + categoryCount - 1).toString(16);

  const networkPrefix = network?.ipv6Prefix?.trim();
  if (networkPrefix) {
    const [baseRaw] = networkPrefix.split('/');
    if (baseRaw) {
      const base = baseRaw.replace(/::+$/, '').replace(/:$/, '');
      const layerHex = Math.max(1, layerOrder).toString(16);
      return `${base}:${layerHex}::${host}`;
    }
  }

  const siteHex = Math.max(1, Math.min(4095, siteOctet)).toString(16);
  const layerHex = Math.max(1, Math.min(4095, layerOrder)).toString(16);
  return `fd00:${siteHex}:${layerHex}::${host}`;
}
