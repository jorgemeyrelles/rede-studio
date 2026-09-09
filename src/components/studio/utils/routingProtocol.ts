import type { NeighborDraftEntry } from '../types';

export function parseNeighborDraft(raw: string): NeighborDraftEntry[] {
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((entry) => {
      const [ipRaw, asnRaw] = entry.trim().split('/');
      return {
        ip: ipRaw?.trim() ?? '',
        remoteAsn: asnRaw?.trim() ?? '',
      };
    })
    .filter((entry) => entry.ip !== '');
}

export function serializeNeighborDraft(entries: NeighborDraftEntry[]): string {
  return entries
    .map((entry) =>
      entry.remoteAsn ? `${entry.ip}/${entry.remoteAsn}` : entry.ip,
    )
    .join(', ');
}
