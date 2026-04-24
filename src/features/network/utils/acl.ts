import type {
  AclEndpointScope,
  AclRule,
  LinkItem,
  LinkKind,
  NetworkState,
  NodeCategory,
  NodeItem,
  SiteVlan,
} from '../types';

export function isAclEligibleLink(nodes: NodeItem[], link: LinkItem) {
  const from = nodes.find((node) => node.id === link.from);
  const to = nodes.find((node) => node.id === link.to);

  return (
    from?.category === 'firewall' ||
    to?.category === 'firewall' ||
    link.kind === 'wan' ||
    link.kind === 'vpn' ||
    link.kind === 'ipsec'
  );
}

export function getDefaultAclService(
  linkKind: LinkKind,
  fromCategory?: NodeCategory,
  toCategory?: NodeCategory,
) {
  const categories = new Set([fromCategory, toCategory]);

  if (linkKind === 'vpn' || linkKind === 'ipsec') {
    return 'ICMP, TCP 443/80';
  }

  if (categories.has('printer')) {
    return 'TCP 445/80';
  }

  if (categories.has('server') || categories.has('nas')) {
    return 'TCP 445/22/80/443';
  }

  if (
    categories.has('router') ||
    categories.has('firewall') ||
    categories.has('switch')
  ) {
    return 'QUALQUER';
  }

  if (
    categories.has('pc') ||
    categories.has('voip') ||
    categories.has('access-point')
  ) {
    return 'TCP 443/80, ICMP';
  }

  return 'QUALQUER';
}

function normalizeEndpoint(
  scope: AclEndpointScope | undefined,
  node: NodeItem | undefined,
  vlanId: number | undefined,
  ip: string | undefined,
  siteVlans: SiteVlan[],
) {
  const scopedVlans = node?.siteId
    ? siteVlans.filter((item) => item.siteId === node.siteId)
    : [];
  const safeScope: AclEndpointScope =
    scope === 'vlan' || scope === 'ip' ? scope : 'node';

  if (safeScope === 'vlan' && scopedVlans.length > 0) {
    const safeVlanId = scopedVlans.some((item) => item.vlanId === vlanId)
      ? vlanId
      : scopedVlans[0]?.vlanId;

    return {
      scope: 'vlan' as const,
      vlanId: safeVlanId,
      ip: undefined,
    };
  }

  if (safeScope === 'ip' && scopedVlans.length > 0) {
    return {
      scope: 'ip' as const,
      vlanId: undefined,
      ip: typeof ip === 'string' && ip.trim().length > 0 ? ip.trim() : node?.ip,
    };
  }

  return {
    scope: 'node' as const,
    vlanId: undefined,
    ip: undefined,
  };
}

export function normalizeAclRule(
  rule: AclRule,
  nodes: NodeItem[],
  siteVlans: SiteVlan[],
) {
  const sourceNode = nodes.find((node) => node.id === rule.sourceNodeId);
  const destinationNode = nodes.find(
    (node) => node.id === rule.destinationNodeId,
  );

  const source = normalizeEndpoint(
    rule.sourceScope,
    sourceNode,
    rule.sourceVlanId,
    rule.sourceIp,
    siteVlans,
  );
  const destination = normalizeEndpoint(
    rule.destinationScope,
    destinationNode,
    rule.destinationVlanId,
    rule.destinationIp,
    siteVlans,
  );

  return {
    ...rule,
    sourceScope: source.scope,
    sourceVlanId: source.vlanId,
    sourceIp: source.ip,
    destinationScope: destination.scope,
    destinationVlanId: destination.vlanId,
    destinationIp: destination.ip,
  };
}

export function reconcileAclRules(
  state: Pick<NetworkState, 'aclRules' | 'links' | 'nodes' | 'siteVlans'>,
) {
  const existingRules = Array.isArray(state.aclRules) ? state.aclRules : [];
  const existingManagedByLinkId = new Map(
    existingRules
      .filter((rule) => rule.managed && rule.linkId)
      .map((rule) => [rule.linkId as string, rule]),
  );
  const validNodeIds = new Set(state.nodes.map((node) => node.id));

  const managedRules: AclRule[] = state.links
    .filter((link) => isAclEligibleLink(state.nodes, link))
    .map((link) => {
      const previousRule = existingManagedByLinkId.get(link.id);
      const from = state.nodes.find((node) => node.id === link.from);
      const to = state.nodes.find((node) => node.id === link.to);

      return normalizeAclRule(
        {
          id: previousRule?.id ?? `acl_${link.id}`,
          linkId: link.id,
          sourceNodeId: link.from,
          destinationNodeId: link.to,
          sourceScope: previousRule?.sourceScope ?? 'node',
          sourceVlanId: previousRule?.sourceVlanId,
          sourceIp: previousRule?.sourceIp,
          destinationScope: previousRule?.destinationScope ?? 'node',
          destinationVlanId: previousRule?.destinationVlanId,
          destinationIp: previousRule?.destinationIp,
          action: previousRule?.action ?? 'ALLOW',
          service:
            previousRule?.service ??
            getDefaultAclService(link.kind, from?.category, to?.category),
          enabled: previousRule?.enabled ?? true,
          managed: true,
        },
        state.nodes,
        state.siteVlans,
      );
    });

  const manualRules = existingRules
    .filter(
      (rule) =>
        !rule.managed &&
        validNodeIds.has(rule.sourceNodeId) &&
        validNodeIds.has(rule.destinationNodeId),
    )
    .map((rule) => normalizeAclRule(rule, state.nodes, state.siteVlans));

  return [...managedRules, ...manualRules];
}
