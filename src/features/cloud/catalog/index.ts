import { AWS_CATALOG } from './aws';
import type { CloudCatalogEntry, CloudFieldOption } from './types';

export * from './types';
export { AWS_COMMERCIAL_REGIONS, awsRegionName } from './awsRegions';

const BY_TYPE = new Map(AWS_CATALOG.map((entry) => [entry.type, entry]));

/** Catálogo completo, na ordem de crescimento (camada, depois ordem de declaração). */
export const CLOUD_CATALOG: readonly CloudCatalogEntry[] = [
  ...AWS_CATALOG,
].sort((a, b) => a.layer - b.layer);

export function getCatalogEntry(type: string): CloudCatalogEntry | undefined {
  return BY_TYPE.get(type);
}

/** Opções fixas de um campo `select` do catálogo (vazio se não houver). */
export function getFieldOptions(type: string, key: string): CloudFieldOption[] {
  const field = getCatalogEntry(type)?.fields.find((f) => f.key === key);
  return field?.type === 'select' ? (field.options ?? []) : [];
}
