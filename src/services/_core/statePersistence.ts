import { MAX_BYTES, STORAGE_KEY } from '../../features/network/constants';
import type { NetworkStateDocument, StatePersistenceResult } from './types';

export function loadStateDocument(): NetworkStateDocument | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as NetworkStateDocument;
    if (!parsed || typeof parsed !== 'object') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function saveStateDocument(
  state: NetworkStateDocument,
): StatePersistenceResult {
  const payload = JSON.stringify(state);
  const bytes = new TextEncoder().encode(payload).length;

  if (bytes > MAX_BYTES) {
    return {
      ok: false,
      warning:
        'Projeto excedeu limite seguro de persistencia local. Considere exportar JSON.',
    };
  }

  localStorage.setItem(STORAGE_KEY, payload);
  return { ok: true, warning: null };
}

export function clearStateDocument() {
  localStorage.removeItem(STORAGE_KEY);
}
