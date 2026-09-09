import type { NodeQosProfile } from '../../../features/network/types';

export type QosSnapshotDto = {
  nodeQosProfiles: NodeQosProfile[];
};

export type CreateNodeQosProfileDto = NodeQosProfile;
export type PatchNodeQosProfileDto = Partial<Omit<NodeQosProfile, 'nodeId'>>;
