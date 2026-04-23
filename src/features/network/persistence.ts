import type { NetworkState } from './types';

const STORAGE_KEY = 'rede-sp-cwb-network-studio-v1';
const MAX_BYTES = 4_500_000;

export function loadNetworkState(): NetworkState | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as NetworkState;
    if (!parsed || typeof parsed !== 'object') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function saveNetworkState(state: NetworkState) {
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
  return { ok: true as const, warning: null };
}

export function clearNetworkState() {
  localStorage.removeItem(STORAGE_KEY);
}
