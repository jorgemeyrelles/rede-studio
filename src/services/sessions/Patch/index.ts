import { mutateStateDocument } from '../../_core';
import type { PatchActiveSessionDto } from '../Dto';

export function patchActiveSession(id: string, changes: PatchActiveSessionDto) {
  return mutateStateDocument((document) => {
    const target = document.activeSessions.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}
