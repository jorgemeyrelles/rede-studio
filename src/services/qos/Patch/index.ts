import { mutateStateDocument } from '../../_core';
import type { PatchNodeQosProfileDto } from '../Dto';

export function patchNodeQosProfile(
  nodeId: string,
  changes: PatchNodeQosProfileDto,
) {
  return mutateStateDocument((document) => {
    const target =
      document.nodeQosProfiles.find((item) => item.nodeId === nodeId) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}
