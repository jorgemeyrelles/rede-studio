import { createUndoHistory } from '../history/createUndoHistory';
import {
  hydrateNetworkState,
  resetNetworkState,
  restoreDomainSnapshot,
} from './networkSlice';
import type { NetworkState } from './types';

/**
 * Desfazer/refazer do Studio on-prem — instância de `createUndoHistory`
 * (regras de pilha, coalescência e hidratação documentadas lá) sobre o
 * slice `network`. `resetNetworkState` (apagar tudo) sempre vira um passo
 * próprio. Ações: `history/undo`, `history/redo`.
 */
const networkHistory = createUndoHistory<NetworkState>({
  name: 'history',
  stateKey: 'network',
  actionPrefix: 'network/',
  isHydrate: (action) => hydrateNetworkState.match(action),
  isForcedStep: (action) => resetNetworkState.match(action),
  restore: (snapshot) => restoreDomainSnapshot(snapshot),
});

export const { undo, redo } = networkHistory;
export const historyReducer = networkHistory.reducer;
export const historyMiddleware = networkHistory.middleware;
