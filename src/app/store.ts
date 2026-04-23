import { configureStore } from '@reduxjs/toolkit';
import networkReducer, {
  hydrateNetworkState,
  markSaved,
  setPersistWarning,
} from '../features/network/networkSlice';
import {
  loadNetworkState,
  saveNetworkState,
} from '../features/network/persistence';
import type { NetworkState } from '../features/network/types';

const preloadedNetwork = loadNetworkState();

export const store = configureStore({
  reducer: {
    network: networkReducer,
  },
});

if (preloadedNetwork) {
  store.dispatch(hydrateNetworkState(preloadedNetwork));
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
store.subscribe(() => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const state = store.getState().network as NetworkState;
    const result = saveNetworkState(state);
    if (!result.ok) {
      store.dispatch(setPersistWarning(result.warning));
      return;
    }
    store.dispatch(markSaved(new Date().toISOString()));
  }, 350);
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
