import { mutateStateDocument } from '../../_core';

export function deleteSiteNetwork(id: string) {
  return mutateStateDocument((document) => {
    const affectedVlanIds = document.siteVlans
      .filter((item) => item.networkId === id)
      .map((item) => item.vlanId);

    document.siteNetworks = document.siteNetworks.filter((item) => item.id !== id);
    document.subnets = document.subnets.filter((item) => item.networkId !== id);
    document.siteVlans = document.siteVlans.filter((item) => item.networkId !== id);
    document.layers = document.layers.map((layer) =>
      layer.networkId === id ? { ...layer, networkId: undefined } : layer,
    );
    document.nodes = document.nodes.map((node) =>
      node.networkId === id ? { ...node, networkId: undefined } : node,
    );
    if (affectedVlanIds.length > 0) {
      document.nodeVlanInterfaces = document.nodeVlanInterfaces.filter(
        (item) => !affectedVlanIds.includes(item.vlanId),
      );
      document.dhcpScopes = document.dhcpScopes.filter(
        (item) => !affectedVlanIds.includes(item.vlanId),
      );
    }

    return { id };
  });
}

export function deleteSiteVlan(id: string) {
  return mutateStateDocument((document) => {
    const target = document.siteVlans.find((item) => item.id === id) ?? null;
    if (!target) return { id, removed: false };

    document.siteVlans = document.siteVlans.filter((item) => item.id !== id);
    document.nodeVlanInterfaces = document.nodeVlanInterfaces.filter(
      (item) => !(item.siteId === target.siteId && item.vlanId === target.vlanId),
    );
    document.dhcpScopes = document.dhcpScopes.filter(
      (item) => !(item.siteId === target.siteId && item.vlanId === target.vlanId),
    );

    return { id, removed: true };
  });
}

export function deleteSubnet(id: string) {
  return mutateStateDocument((document) => {
    document.subnets = document.subnets.filter((item) => item.id !== id);
    return { id };
  });
}

export function deleteNodeVlanInterface(id: string) {
  return mutateStateDocument((document) => {
    document.nodeVlanInterfaces = document.nodeVlanInterfaces.filter(
      (item) => item.id !== id,
    );
    return { id };
  });
}

export function deleteDhcpScope(id: string) {
  return mutateStateDocument((document) => {
    document.dhcpScopes = document.dhcpScopes.filter((item) => item.id !== id);
    return { id };
  });
}
