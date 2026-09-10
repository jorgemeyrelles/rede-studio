import type { NetworkState } from '../../features/network/types';

export type StatePersistenceResult =
  | {
      ok: true;
      warning: null;
    }
  | {
      ok: false;
      warning: string;
    };

export type NetworkStateDocument = NetworkState;
