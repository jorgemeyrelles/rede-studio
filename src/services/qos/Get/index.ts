import { readStateDocument } from '../../_core';

export function getQosSnapshot() {
  const document = readStateDocument();
  if (!document) return null;

  return {
    nodeQosProfiles: document.nodeQosProfiles,
  };
}

export function getNodeQosProfile(nodeId: string) {
  const document = readStateDocument();
  if (!document) return null;

  return (
    document.nodeQosProfiles.find((item) => item.nodeId === nodeId) ?? null
  );
}
