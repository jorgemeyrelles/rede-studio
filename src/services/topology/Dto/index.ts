import type { Layer, LinkItem, NodeItem, Site } from '../../../features/network/types';

export type TopologySnapshotDto = {
  sites: Site[];
  layers: Layer[];
  nodes: NodeItem[];
  links: LinkItem[];
};

export type CreateSiteDto = Omit<Site, 'id'> & { id?: string };
export type CreateLayerDto = Omit<Layer, 'id'> & { id?: string };
export type CreateNodeDto = Omit<NodeItem, 'id'> & { id?: string };
export type CreateLinkDto = Omit<LinkItem, 'id'> & { id?: string };

export type PatchSiteDto = Partial<Omit<Site, 'id'>>;
export type PatchLayerDto = Partial<Omit<Layer, 'id'>>;
export type PatchNodeDto = Partial<Omit<NodeItem, 'id'>>;
export type PatchLinkDto = Partial<Omit<LinkItem, 'id'>>;
