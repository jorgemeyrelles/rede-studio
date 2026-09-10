import {
    clearStateDocument,
    loadStateDocument,
    saveStateDocument,
    type NetworkStateDocument,
} from '../_core';

export function getStateDocument() {
  return loadStateDocument();
}

export function putStateDocument(state: NetworkStateDocument) {
  return saveStateDocument(state);
}

export function deleteStateDocument() {
  clearStateDocument();
}

export const stateRoutes = {
  getStateDocument,
  putStateDocument,
  deleteStateDocument,
};
