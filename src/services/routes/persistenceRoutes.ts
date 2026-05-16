import type { NetworkStateDocument } from '../_core';
import {
    deleteStateDocument,
    getStateDocument,
    putStateDocument,
} from './stateRoutes';

export function loadNetworkState() {
  return getStateDocument();
}

export function saveNetworkState(state: NetworkStateDocument) {
  return putStateDocument(state);
}

export function clearNetworkState() {
  deleteStateDocument();
}

export const persistenceRoutes = {
  loadNetworkState,
  saveNetworkState,
  clearNetworkState,
};
