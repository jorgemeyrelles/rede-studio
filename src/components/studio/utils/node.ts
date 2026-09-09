import type {
  TechFieldSchema,
  TechValue,
} from '../../../features/network/techProfiles';

export function parseVlans(raw: string) {
  return raw
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((num) => Number.isFinite(num) && num > 0 && num < 4095);
}

export function parseTechValue(
  schema: TechFieldSchema,
  raw: string,
): TechValue {
  if (schema.type === 'boolean') {
    return raw === 'true';
  }
  if (schema.type === 'number') {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 0;
    if (typeof schema.min === 'number' && parsed < schema.min) {
      return schema.min;
    }
    if (typeof schema.max === 'number' && parsed > schema.max) {
      return schema.max;
    }
    return parsed;
  }
  return raw;
}
