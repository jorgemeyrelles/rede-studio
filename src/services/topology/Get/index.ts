import { readStateDocument } from '../../_core';

export function getTopologySnapshot() {
  const document = readStateDocument();
  if (!document) return null;

  return {
    sites: document.sites,
    layers: document.layers,
    nodes: document.nodes,
    links: document.links,
  };
}

export function getTopologyBySite(siteId: string) {
  const document = readStateDocument();
  if (!document) return null;

  const layers = document.layers.filter((layer) => layer.siteId === siteId);
  const nodes = document.nodes.filter((node) => node.siteId === siteId);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const links = document.links.filter(
    (link) => nodeIds.has(link.from) || nodeIds.has(link.to),
  );

  return {
    site: document.sites.find((site) => site.id === siteId) ?? null,
    layers,
    nodes,
    links,
  };
}
