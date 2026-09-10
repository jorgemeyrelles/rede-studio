import { readStateDocument } from '../../_core';

export function getSessionsSnapshot() {
  const document = readStateDocument();
  if (!document) return null;

  return {
    activeSessions: document.activeSessions,
  };
}

export function getSessionsByNode(nodeId: string) {
  const document = readStateDocument();
  if (!document) return [];

  return document.activeSessions.filter((item) => item.nodeId === nodeId);
}
