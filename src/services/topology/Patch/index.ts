import { mutateStateDocument } from '../../_core';
import type { PatchLayerDto, PatchLinkDto, PatchNodeDto, PatchSiteDto } from '../Dto';

export function patchSite(id: string, changes: PatchSiteDto) {
  return mutateStateDocument((document) => {
    const target = document.sites.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}

export function patchLayer(id: string, changes: PatchLayerDto) {
  return mutateStateDocument((document) => {
    const target = document.layers.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}

export function patchNode(id: string, changes: PatchNodeDto) {
  return mutateStateDocument((document) => {
    const target = document.nodes.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}

export function patchLink(id: string, changes: PatchLinkDto) {
  return mutateStateDocument((document) => {
    const target = document.links.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}
