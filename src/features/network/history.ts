import {
  createAction,
  createSlice,
  type Middleware,
  type PayloadAction,
} from '@reduxjs/toolkit';
import {
  hydrateNetworkState,
  resetNetworkState,
  restoreDomainSnapshot,
} from './networkSlice';
import type { NetworkState } from './types';

/**
 * Desfazer/refazer do Studio.
 *
 * As pilhas ficam no fechamento do middleware (snapshots grandes não
 * entram no estado Redux nem passam pelo serializability check); o slice
 * `history` guarda só `canUndo`/`canRedo` pra UI re-renderizar.
 *
 * O que entra no histórico: qualquer action `network/*` que mude o
 * DOMÍNIO (tudo menos `ui` e `meta`), detectado por referência — zoom,
 * seleção e o ciclo de save ficam de fora sem precisar de lista de actions.
 * Edições em rajada (digitação) viram um passo só (janela de 500ms).
 * Abrir/trocar de projeto (`hydrateNetworkState`) zera o histórico.
 */

type DomainSnapshot = Omit<NetworkState, 'ui' | 'meta'>;

const LIMIT = 50;
const COALESCE_MS = 500;

export const undo = createAction('history/undo');
export const redo = createAction('history/redo');

type HistoryState = { canUndo: boolean; canRedo: boolean };

const historySlice = createSlice({
  name: 'history',
  initialState: { canUndo: false, canRedo: false } as HistoryState,
  reducers: {
    setHistoryFlags: (_state, action: PayloadAction<HistoryState>) =>
      action.payload,
  },
});

const { setHistoryFlags } = historySlice.actions;
export const historyReducer = historySlice.reducer;

function toDomain(state: NetworkState): DomainSnapshot {
  const { ui: _ui, meta: _meta, ...domain } = state;
  void _ui;
  void _meta;
  return domain;
}

function domainChanged(before: NetworkState, after: NetworkState): boolean {
  for (const key of Object.keys(after) as (keyof NetworkState)[]) {
    if (key === 'ui' || key === 'meta') continue;
    if (before[key] !== after[key]) return true;
  }
  return false;
}

export const historyMiddleware: Middleware<
  object,
  { network: NetworkState; history: HistoryState }
> = (api) => {
  let past: DomainSnapshot[] = [];
  let future: DomainSnapshot[] = [];
  let lastPushAt = 0;
  let applying = false;

  const syncFlags = () => {
    const { canUndo, canRedo } = api.getState().history;
    const next = { canUndo: past.length > 0, canRedo: future.length > 0 };
    if (next.canUndo !== canUndo || next.canRedo !== canRedo) {
      api.dispatch(setHistoryFlags(next));
    }
  };

  const apply = (snapshot: DomainSnapshot) => {
    applying = true;
    try {
      api.dispatch(restoreDomainSnapshot(snapshot));
    } finally {
      applying = false;
    }
    // Um passo novo depois de desfazer não deve ser fundido com o anterior.
    lastPushAt = 0;
  };

  return (next) => (action) => {
    if (undo.match(action)) {
      const previous = past.pop();
      if (previous) {
        future.push(toDomain(api.getState().network));
        apply(previous);
      }
      syncFlags();
      return action;
    }
    if (redo.match(action)) {
      const following = future.pop();
      if (following) {
        past.push(toDomain(api.getState().network));
        apply(following);
      }
      syncFlags();
      return action;
    }

    const before = api.getState().network;
    const result = next(action);

    if (hydrateNetworkState.match(action)) {
      past = [];
      future = [];
      lastPushAt = 0;
      syncFlags();
      return result;
    }

    const type = (action as { type?: unknown }).type;
    if (applying || typeof type !== 'string' || !type.startsWith('network/')) {
      return result;
    }

    const after = api.getState().network;
    if (!domainChanged(before, after)) return result;

    const now = Date.now();
    const forceNewStep = resetNetworkState.match(action);
    if (forceNewStep || now - lastPushAt > COALESCE_MS || past.length === 0) {
      past.push(toDomain(before));
      if (past.length > LIMIT) past.shift();
    }
    lastPushAt = forceNewStep ? 0 : now;
    future = [];
    syncFlags();
    return result;
  };
};
