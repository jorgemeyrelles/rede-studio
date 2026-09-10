import { mutateStateDocument } from '../../_core';
import type {
    PatchDhcpScopeDto,
    PatchNodeVlanInterfaceDto,
    PatchSiteNetworkDto,
    PatchSiteVlanDto,
    PatchSubnetDto,
} from '../Dto';

export function patchSiteNetwork(id: string, changes: PatchSiteNetworkDto) {
  return mutateStateDocument((document) => {
    const target = document.siteNetworks.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}

export function patchSiteVlan(id: string, changes: PatchSiteVlanDto) {
  return mutateStateDocument((document) => {
    const target = document.siteVlans.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}

export function patchSubnet(id: string, changes: PatchSubnetDto) {
  return mutateStateDocument((document) => {
    const target = document.subnets.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}

export function patchNodeVlanInterface(
  id: string,
  changes: PatchNodeVlanInterfaceDto,
) {
  return mutateStateDocument((document) => {
    const target =
      document.nodeVlanInterfaces.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}

export function patchDhcpScope(id: string, changes: PatchDhcpScopeDto) {
  return mutateStateDocument((document) => {
    const target = document.dhcpScopes.find((item) => item.id === id) ?? null;
    if (!target) return null;
    Object.assign(target, changes);
    return target;
  });
}
