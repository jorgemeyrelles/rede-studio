import { mutateStateDocument } from '../../_core';

export function deleteNodeQosProfile(nodeId: string) {
  return mutateStateDocument((document) => {
    document.nodeQosProfiles = document.nodeQosProfiles.filter(
      (item) => item.nodeId !== nodeId,
    );
    return { nodeId };
  });
}
