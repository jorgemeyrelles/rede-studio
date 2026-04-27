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
  // If explicitly disabled via link inspector, skip
  if (link.generateAcl === false) return false;

  const from = nodes.find((node) => node.id === link.from);
  const to = nodes.find((node) => node.id === link.to);

  // Always eligible: FW-adjacent, WAN, VPN/IPSEC, or LAN (generates passthrough rule)
  return (
    from?.category === 'firewall' ||
    to?.category === 'firewall' ||
    link.kind === 'wan' ||
    link.kind === 'vpn' ||
    link.kind === 'ipsec' ||
    link.kind === 'lan'
  );
}

export function getDefaultAclService(
  linkKind: LinkKind,
  fromCategory?: NodeCategory,
  toCategory?: NodeCategory,
  ipsecAuthMethod?: string,
  hasRadiusInTopology?: boolean,
): string {
  if (linkKind === 'ipsec') {
    switch (ipsecAuthMethod) {
      case 'certificate':
        return 'udp/500, udp/4500, esp, tcp/443';
      case 'eap':
        return hasRadiusInTopology
          ? 'udp/500, udp/4500, esp, udp/1812'
          : 'udp/500, udp/4500, esp';
      case 'keypair':
        return 'udp/500, udp/4500, esp';
      case 'none':
        return 'esp';
      // psk is the default
      default:
        return 'udp/500, udp/4500, esp';
    }
  }

  if (linkKind === 'vpn') {
    return 'udp/500, udp/1194, tcp/443';
  }

  const categories = new Set([fromCategory, toCategory]);

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

  const eligibleLinks = state.links.filter((link) =>
    isAclEligibleLink(state.nodes, link),
  );

  // Pre-compute whether a RADIUS node exists in the topology (for EAP IPsec auth)
  const hasRadiusNode = state.nodes.some((n) => n.category === 'radius');

  const managedRules: AclRule[] = eligibleLinks.map((link, index) => {
    const previousRule = existingManagedByLinkId.get(link.id);
    const from = state.nodes.find((node) => node.id === link.from);
    const to = state.nodes.find((node) => node.id === link.to);

    // B — Stateful: check FW *and* router stateMode; link override wins
    const stateNode = [from, to].find(
      (n) => n?.category === 'firewall' || n?.category === 'router',
    );
    const stateMode = String(
      stateNode?.techProfile?.fields?.stateMode ?? 'stateful',
    );
    const isStateful =
      link.statefulOverride === 'force-stateful'
        ? true
        : link.statefulOverride === 'force-stateless'
          ? false
          : stateMode !== 'stateless';

    // Passthrough: no FW/router in path and not encrypted/WAN link
    const hasFwOrRouter =
      from?.category === 'firewall' ||
      to?.category === 'firewall' ||
      from?.category === 'router' ||
      to?.category === 'router';
    const isPassthrough =
      !hasFwOrRouter &&
      link.kind !== 'vpn' &&
      link.kind !== 'ipsec' &&
      link.kind !== 'wan';

    // D — IPsec auth method for service template
    const ipsecNode = [from, to].find(
      (n) => n?.category === 'ipsec' || n?.category === 'vpn',
    );
    const ipsecAuthMethod = ipsecNode
      ? String(ipsecNode.techProfile?.fields?.authMethod ?? 'psk')
      : undefined;

    return normalizeAclRule(
      {
        id: previousRule?.id ?? `acl_${link.id}`,
        linkId: link.id,
        sourceNodeId: link.from,
        destinationNodeId: link.to,
        sourceScope: previousRule?.sourceScope ?? 'node',
        sourceVlanId: previousRule?.sourceVlanId,
        sourceIp: previousRule?.sourceIp,
        sourceIpList: previousRule?.sourceIpList,
        destinationScope: previousRule?.destinationScope ?? 'node',
        destinationVlanId: previousRule?.destinationVlanId,
        destinationIp: previousRule?.destinationIp,
        destinationIpList: previousRule?.destinationIpList,
        action: previousRule?.action ?? 'ALLOW',
        service:
          previousRule?.service ??
          getDefaultAclService(
            link.kind,
            from?.category,
            to?.category,
            ipsecAuthMethod,
            hasRadiusNode,
          ),
        enabled: previousRule?.enabled ?? true,
        managed: true,
        priority: 1000 + index * 10,
        source: 'topology',
        stateful: isStateful,
        bidirectional: previousRule?.bidirectional ?? false,
        passthrough: isPassthrough,
        natExempt: false,
        protocol: previousRule?.protocol ?? 'any',
        parentRuleId: undefined,
        returnRuleId: previousRule?.returnRuleId,
        isReturnRule: previousRule?.isReturnRule,
      },
      state.nodes,
      state.siteVlans,
    );
  });

  // C — NAT Exemption: for each node with an IPsec link AND natMode ≠ 'none'
  // generate an AclRule at priority 9990+ (one per ipsec link on a NAT node)
  const natExemptRules: AclRule[] = [];
  let natExemptIndex = 0;
  for (const link of state.links) {
    if (link.kind !== 'ipsec') continue;
    const fromNode = state.nodes.find((n) => n.id === link.from);
    const toNode = state.nodes.find((n) => n.id === link.to);

    // Find the FW/router node on this link that has NAT enabled
    const natNode = [fromNode, toNode].find((n) => {
      if (!n) return false;
      if (n.category !== 'firewall' && n.category !== 'router') return false;
      const natMode = String(n.techProfile?.fields?.natMode ?? 'none');
      return natMode !== 'none';
    });
    if (!natNode) continue;

    const existingId = `nat_exempt_${link.id}`;
    const existing = existingRules.find((r) => r.id === existingId);

    natExemptRules.push(
      normalizeAclRule(
        {
          id: existingId,
          linkId: link.id,
          sourceNodeId: link.from,
          destinationNodeId: link.to,
          sourceScope: 'node',
          destinationScope: 'node',
          action: 'ALLOW',
          service: 'esp, udp/500, udp/4500',
          enabled: existing?.enabled ?? true,
          managed: true,
          priority: 9990 + natExemptIndex,
          source: 'topology',
          stateful: false,
          bidirectional: true,
          passthrough: false,
          natExempt: true,
          protocol: 'any',
        },
        state.nodes,
        state.siteVlans,
      ),
    );
    natExemptIndex++;
  }

  const manualRules = existingRules
    .filter(
      (rule) =>
        !rule.managed &&
        validNodeIds.has(rule.sourceNodeId) &&
        validNodeIds.has(rule.destinationNodeId),
    )
    .map((rule, index) =>
      normalizeAclRule(
        {
          ...rule,
          source: rule.source ?? 'manual',
          priority: rule.priority ?? index * 10 + 10,
          stateful: rule.stateful ?? true,
          bidirectional: rule.bidirectional ?? false,
          passthrough: rule.passthrough ?? false,
          natExempt: rule.natExempt ?? false,
          protocol: rule.protocol ?? 'any',
        },
        state.nodes,
        state.siteVlans,
      ),
    );

  return [...managedRules, ...natExemptRules, ...manualRules];
}
