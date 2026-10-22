import { createUndoHistory } from '../history/createUndoHistory';
import { hydrateCloudState, restoreCloudDomain } from './cloudSlice';
import type { CloudState } from './types';

/**
 * Desfazer/refazer do Studio Cloud — mesma regra do on-prem
 * (`createUndoHistory`), pilhas próprias. Ações: `cloudHistory/undo`,
 * `cloudHistory/redo` — nunca mexem no projeto on-prem e vice-versa.
 */
const cloudHistory = createUndoHistory<CloudState>({
  name: 'cloudHistory',
  stateKey: 'cloud',
  actionPrefix: 'cloud/',
  isHydrate: (action) => hydrateCloudState.match(action),
  restore: (snapshot) => restoreCloudDomain(snapshot),
});

export const { undo: cloudUndo, redo: cloudRedo } = cloudHistory;
export const cloudHistoryReducer = cloudHistory.reducer;
export const cloudHistoryMiddleware = cloudHistory.middleware;
