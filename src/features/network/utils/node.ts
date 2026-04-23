import { CATEGORY_CODE_MAP, CATEGORY_HOST_BASE_MAP } from '../constants';
import type { NodeCategory } from '../types';

export function makeSiteId(index: number) {
  return `site_${index}`;
}

export function makeLayerId(index: number) {
  return `camada_${index}`;
}

export function makeNodeId(
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
) {
  const third = Math.max(1, Math.min(254, layerOrder));
  const hostBase = getCategoryHostBase(category);
  const fourth = Math.max(1, Math.min(254, hostBase + categoryCount - 1));
  return `200.${siteOctet}.${third}.${fourth}`;
}
