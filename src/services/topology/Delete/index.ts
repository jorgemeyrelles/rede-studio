import { mutateStateDocument } from '../../_core';

function cascadeRemoveByNodeIds(document: import('../../../features/network/types').NetworkState, nodeIds: Set<string>) {
  const removedLinkIds = new Set(
    document.links
      .filter((link) => nodeIds.has(link.from) || nodeIds.has(link.to))
      .map((link) => link.id),
  );

  document.links = document.links.filter(
    (link) => !nodeIds.has(link.from) && !nodeIds.has(link.to),
  );
  document.aclRules = document.aclRules.filter(
    (rule) =>
      !nodeIds.has(rule.sourceNodeId) &&
      !nodeIds.has(rule.destinationNodeId) &&
      (!rule.linkId || !removedLinkIds.has(rule.linkId)),
  );
  document.fwPolicies = document.fwPolicies.filter(
    (policy) => !nodeIds.has(policy.nodeId),
  );
  document.natRules = document.natRules.filter((rule) => !nodeIds.has(rule.nodeId));
  document.activeSessions = document.activeSessions.filter(
    (session) => !nodeIds.has(session.nodeId),
  );
  document.nodeQosProfiles = document.nodeQosProfiles.filter(
    (profile) => !nodeIds.has(profile.nodeId),
  );
  document.nodeVlanInterfaces = document.nodeVlanInterfaces.filter(
    (item) => !nodeIds.has(item.nodeId),
  );
  document.ipsecSas = document.ipsecSas.filter(
    (sa) => !sa.linkId || !removedLinkIds.has(sa.linkId),
  );
  document.sslVpnProfiles = document.sslVpnProfiles.filter(
    (profile) => !profile.linkId || !removedLinkIds.has(profile.linkId),
  );
}

export function deleteSite(id: string) {
  return mutateStateDocument((document) => {
    const layerIds = new Set(
      document.layers.filter((item) => item.siteId === id).map((item) => item.id),
    );
    const nodeIds = new Set(
      document.nodes.filter((item) => item.siteId === id).map((item) => item.id),
    );

    document.sites = document.sites.filter((item) => item.id !== id);
    document.layers = document.layers.filter((item) => item.siteId !== id);
    document.nodes = document.nodes.filter((item) => item.siteId !== id);
    document.siteNetworks = document.siteNetworks.filter((item) => item.siteId !== id);
    document.siteVlans = document.siteVlans.filter((item) => item.siteId !== id);
    document.subnets = document.subnets.filter((item) => item.siteId !== id);
    document.nodeVlanInterfaces = document.nodeVlanInterfaces.filter(
      (item) => item.siteId !== id,
    );
    document.dhcpScopes = document.dhcpScopes.filter((item) => item.siteId !== id);

    cascadeRemoveByNodeIds(document, nodeIds);

    if (layerIds.size > 0) {
      document.nodes = document.nodes.filter(
        (node) => !node.layerId || !layerIds.has(node.layerId),
      );
    }

    return { id };
  });
}

export function deleteLayer(id: string) {
  return mutateStateDocument((document) => {
    const nodeIds = new Set(
      document.nodes.filter((item) => item.layerId === id).map((item) => item.id),
    );

    document.layers = document.layers.filter((item) => item.id !== id);
    document.nodes = document.nodes.filter((item) => item.layerId !== id);
    cascadeRemoveByNodeIds(document, nodeIds);

    return { id };
  });
}

export function deleteNode(id: string) {
  return mutateStateDocument((document) => {
    document.nodes = document.nodes.filter((item) => item.id !== id);
    cascadeRemoveByNodeIds(document, new Set([id]));
    return { id };
  });
}

export function deleteLink(id: string) {
  return mutateStateDocument((document) => {
    document.links = document.links.filter((item) => item.id !== id);
    document.aclRules = document.aclRules.filter(
      (rule) => !rule.linkId || rule.linkId !== id,
    );
    document.ipsecSas = document.ipsecSas.filter((item) => item.linkId !== id);
    document.sslVpnProfiles = document.sslVpnProfiles.filter(
      (item) => item.linkId !== id,
    );
    return { id };
  });
}
