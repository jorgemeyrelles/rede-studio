import { mutateStateDocument } from '../../_core';
import type { CreateNodeQosProfileDto } from '../Dto';

export function createNodeQosProfile(input: CreateNodeQosProfileDto) {
  return mutateStateDocument((document) => {
    const exists = document.nodeQosProfiles.some(
      (item) => item.nodeId === input.nodeId,
    );
    if (exists) {
      return (
        document.nodeQosProfiles.find((item) => item.nodeId === input.nodeId) ??
        null
      );
    }

    document.nodeQosProfiles.push(input);
    return input;
  });
}
