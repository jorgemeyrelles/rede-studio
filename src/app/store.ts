import { configureStore } from '@reduxjs/toolkit';
import {
  historyMiddleware,
  historyReducer,
} from '../features/network/history';
import networkReducer from '../features/network/networkSlice';

// Autosave (antes um middleware aqui) agora é `features/network/useAutosave.ts`,
// um hook usado dentro de `StudioPage.tsx` — lê `projectId` da URL e salva via
// React Query (`useSaveProjectSnapshotMutation`). Sessão (`auth`) e lista de
// projetos (`projects`) também saíram do Redux — ver `features/auth/queries.ts`
// e `features/projects/queries.ts`. Só sobra aqui o estado de cliente puro da
// topologia (`network`).
export const store = configureStore({
  reducer: {
    network: networkReducer,
    // Só os flags canUndo/canRedo — as pilhas vivem no middleware.
    history: historyReducer,
  },
  middleware: (getDefault) => getDefault().concat(historyMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
