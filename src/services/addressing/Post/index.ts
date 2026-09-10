import { makeServiceId, mutateStateDocument } from '../../_core';
import type {
  CreateDhcpScopeDto,
  CreateNodeVlanInterfaceDto,
  CreateSiteNetworkDto,
  CreateSiteVlanDto,
  CreateSubnetDto,
} from '../Dto';

export function createSiteNetwork(input: CreateSiteNetworkDto) {
  return mutateStateDocument((document) => {
    const siteNetwork = { ...input, id: input.id ?? makeServiceId('snet') };
    document.siteNetworks.push(siteNetwork);
    return siteNetwork;
  });
}

export function createSiteVlan(input: CreateSiteVlanDto) {
  return mutateStateDocument((document) => {
    const siteVlan = { ...input, id: input.id ?? makeServiceId('vlan') };
    document.siteVlans.push(siteVlan);
    return siteVlan;
  });
}

export function createSubnet(input: CreateSubnetDto) {
  return mutateStateDocument((document) => {
    const subnet = { ...input, id: input.id ?? makeServiceId('subnet') };
    document.subnets.push(subnet);
    return subnet;
  });
}

export function createNodeVlanInterface(input: CreateNodeVlanInterfaceDto) {
  return mutateStateDocument((document) => {
    const nodeVlanInterface = {
      ...input,
      id: input.id ?? makeServiceId('nvif'),
    };
    document.nodeVlanInterfaces.push(nodeVlanInterface);
    return nodeVlanInterface;
  });
}

export function createDhcpScope(input: CreateDhcpScopeDto) {
  return mutateStateDocument((document) => {
    const dhcpScope = { ...input, id: input.id ?? makeServiceId('dhcp') };
    document.dhcpScopes.push(dhcpScope);
    return dhcpScope;
  });
}
