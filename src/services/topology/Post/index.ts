import { makeServiceId, mutateStateDocument } from '../../_core';
import type {
    CreateLayerDto,
    CreateLinkDto,
    CreateNodeDto,
    CreateSiteDto,
} from '../Dto';

export function createSite(input: CreateSiteDto) {
  return mutateStateDocument((document) => {
    const site = { ...input, id: input.id ?? makeServiceId('site') };
    document.sites.push(site);
    return site;
  });
}

export function createLayer(input: CreateLayerDto) {
  return mutateStateDocument((document) => {
    const layer = { ...input, id: input.id ?? makeServiceId('layer') };
    document.layers.push(layer);
    return layer;
  });
}

export function createNode(input: CreateNodeDto) {
  return mutateStateDocument((document) => {
    const node = { ...input, id: input.id ?? makeServiceId('node') };
    document.nodes.push(node);
    return node;
  });
}

export function createLink(input: CreateLinkDto) {
  return mutateStateDocument((document) => {
    const link = { ...input, id: input.id ?? makeServiceId('link') };
    document.links.push(link);
    return link;
  });
}
