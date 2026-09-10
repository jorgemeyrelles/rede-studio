import type { ActiveSession } from '../../../features/network/types';

export type SessionsSnapshotDto = {
  activeSessions: ActiveSession[];
};

export type CreateActiveSessionDto = Omit<ActiveSession, 'id'> & { id?: string };
export type PatchActiveSessionDto = Partial<Omit<ActiveSession, 'id'>>;
