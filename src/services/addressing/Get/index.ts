import { readStateDocument } from '../../_core';

export function getAddressingSnapshot() {
  const document = readStateDocument();
  if (!document) return null;

  return {
    siteNetworks: document.siteNetworks,
    siteVlans: document.siteVlans,
    subnets: document.subnets,
    nodeVlanInterfaces: document.nodeVlanInterfaces,
    dhcpScopes: document.dhcpScopes,
  };
}

export function getAddressingBySite(siteId: string) {
  const document = readStateDocument();
  if (!document) return null;

  return {
    siteNetworks: document.siteNetworks.filter((item) => item.siteId === siteId),
    siteVlans: document.siteVlans.filter((item) => item.siteId === siteId),
    subnets: document.subnets.filter((item) => item.siteId === siteId),
    nodeVlanInterfaces: document.nodeVlanInterfaces.filter(
      (item) => item.siteId === siteId,
    ),
    dhcpScopes: document.dhcpScopes.filter((item) => item.siteId === siteId),
  };
}
