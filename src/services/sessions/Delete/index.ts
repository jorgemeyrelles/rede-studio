import { mutateStateDocument } from '../../_core';

export function deleteActiveSession(id: string) {
  return mutateStateDocument((document) => {
    document.activeSessions = document.activeSessions.filter(
      (item) => item.id !== id,
    );
    return { id };
  });
}

export function clearSessionsByNode(nodeId: string) {
  return mutateStateDocument((document) => {
    document.activeSessions = document.activeSessions.filter(
      (item) => item.nodeId !== nodeId,
    );
    return { nodeId };
  });
}
