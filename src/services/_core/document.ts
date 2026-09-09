import { loadStateDocument, saveStateDocument } from './statePersistence';
import type { NetworkStateDocument } from './types';

export function readStateDocument(): NetworkStateDocument | undefined {
  return loadStateDocument();
}

export function mutateStateDocument<T>(
  mutator: (document: NetworkStateDocument) => T,
): T | null {
  const document = loadStateDocument();
  if (!document) return null;

  const result = mutator(document);
  const saveResult = saveStateDocument(document);
  if (!saveResult.ok) return null;

  return result;
}
