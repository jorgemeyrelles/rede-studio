import { makeServiceId, mutateStateDocument } from '../../_core';
import type { CreateActiveSessionDto } from '../Dto';

export function createActiveSession(input: CreateActiveSessionDto) {
  return mutateStateDocument((document) => {
    const activeSession = {
      ...input,
      id: input.id ?? makeServiceId('sess'),
    };
    document.activeSessions.push(activeSession);
    return activeSession;
  });
}
