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

type AclTrafficClass = NonNullable<AclRule['trafficClass']>;

const ACL_DSCP_BY_CLASS: Record<AclTrafficClass, number> = {
  voice: 46,
  video: 34,
  critical: 26,
  bulk: 8,
  'best-effort': 0,
};

const ACL_BANDWIDTH_PERCENT: Record<
  AclTrafficClass,
  { guaranteed: number; max: number }
> = {
  voice: { guaranteed: 8, max: 15 },
  video: { guaranteed: 20, max: 35 },
  critical: { guaranteed: 10, max: 25 },
  bulk: { guaranteed: 2, max: 20 },
  'best-effort': { guaranteed: 0, max: 100 },
};

const ACL_FALLBACK_BANDWIDTH_KBPS: Record<
  AclTrafficClass,
  { guaranteed: number; max: number }
> = {
  voice: { guaranteed: 512, max: 2048 },
  video: { guaranteed: 2048, max: 8192 },
  critical: { guaranteed: 512, max: 3072 },
  bulk: { guaranteed: 128, max: 1536 },
  'best-effort': { guaranteed: 0, max: 3000 },
};

const CONTROL_PLANE_SERVICE_RE =
  /(udp\/500|udp\/4500|\besp\b|\bbgp\b|\bospf\b|\bdns\b|\bdhcp\b|\bntp\b|\bradius\b|\bldap\b|\bkerberos\b|\bldaps\b)/;
const VOICE_SERVICE_RE = /(\bsip\b|\brtp\b|5060|5061|\bvoip\b)/;
const VIDEO_SERVICE_RE = /(\bvideo\b|\bteams\b|\bzoom\b|\bmeet\b|\bh323\b|\brtsp\b|554)/;
const BULK_SERVICE_RE =
  /(\bbackup\b|\breplica\b|\breplication\b|\brsync\b|\bftp\b|\bsftp\b|\bscp\b|\b445\b|\b9100\b|\bprint\b|\bsmb\b)/;

export function suggestAclRuleQoS(params: {
  rule: Pick<AclRule, 'action' | 'service' | 'protocol' | 'natExempt'>;
  linkKind?: LinkKind;
  linkBandwidthKbps?: number;
  sourceCategory?: NodeCategory;
  destinationCategory?: NodeCategory;
}): Pick<
  AclRule,
  'trafficClass' | 'dscpMark' | 'guaranteedBwKbps' | 'maxBwKbps'
> {
  if (params.rule.action !== 'ALLOW') {
    return {
      trafficClass: undefined,
      dscpMark: undefined,
      guaranteedBwKbps: undefined,
      maxBwKbps: undefined,
    };
  }

  const service = String(params.rule.service ?? '').toLowerCase();
  const protocol = String(params.rule.protocol ?? 'any').toLowerCase();
  const categories = new Set([params.sourceCategory, params.destinationCategory]);

  const isControlPlaneService =
    params.rule.natExempt ||
    CONTROL_PLANE_SERVICE_RE.test(service) ||
    ((params.linkKind === 'ipsec' || params.linkKind === 'vpn') &&
      /(udp\/500|udp\/4500|\besp\b)/.test(service));
  const isVoiceService =
    categories.has('voip') || VOICE_SERVICE_RE.test(service);
  const isVideoService = VIDEO_SERVICE_RE.test(service);
  const isBulkService =
    categories.has('printer') || categories.has('nas') || BULK_SERVICE_RE.test(service);
  const isInfraCategory =
    categories.has('router') ||
    categories.has('firewall') ||
    categories.has('switch') ||
    categories.has('dns') ||
    categories.has('dhcp') ||
    categories.has('ids') ||
    categories.has('ips') ||
    categories.has('proxy');

  let trafficClass: AclTrafficClass = 'best-effort';
  if (isVoiceService) {
    trafficClass = 'voice';
  } else if (isVideoService) {
    trafficClass = 'video';
  } else if (
    isControlPlaneService ||
    isInfraCategory ||
    params.linkKind === 'ipsec' ||
    params.linkKind === 'vpn' ||
    protocol === 'icmp'
  ) {
    trafficClass = 'critical';
  } else if (isBulkService) {
    trafficClass = 'bulk';
  }

  const linkBandwidthKbps =
    typeof params.linkBandwidthKbps === 'number' &&
    Number.isFinite(params.linkBandwidthKbps) &&
    params.linkBandwidthKbps > 0
      ? params.linkBandwidthKbps
      : undefined;

  let guaranteedBwKbps: number;
  let maxBwKbps: number;

  if (linkBandwidthKbps) {
    const profile =
      isControlPlaneService && trafficClass === 'critical'
        ? { guaranteed: 2, max: 10 }
        : ACL_BANDWIDTH_PERCENT[trafficClass];

    guaranteedBwKbps = Math.max(
      0,
      Math.round((linkBandwidthKbps * profile.guaranteed) / 100),
    );
    maxBwKbps = Math.max(
      guaranteedBwKbps,
      Math.round((linkBandwidthKbps * profile.max) / 100),
    );
  } else {
    const fallback =
      isControlPlaneService && trafficClass === 'critical'
        ? { guaranteed: 256, max: 1024 }
        : ACL_FALLBACK_BANDWIDTH_KBPS[trafficClass];
    guaranteedBwKbps = fallback.guaranteed;
    maxBwKbps = Math.max(fallback.max, fallback.guaranteed);
  }

  return {
    trafficClass,
    dscpMark: ACL_DSCP_BY_CLASS[trafficClass],
    guaranteedBwKbps,
    maxBwKbps,
  };
}

/** Convenção determinística do id da regra de ACL gerenciada (1 por link elegível). */
export function managedAclRuleId(linkId: string): string {
  return `acl_${linkId}`;
}

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
    link.kind === 'lan' ||
    link.kind === 'inter-lan'
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

  // Pre-compute whether a RADIUS service exists in the topology (for EAP IPsec auth)
  const hasRadiusNode = state.nodes.some((n) => {
    const role = String(n.techProfile?.fields?.role ?? '').toLowerCase();
    return n.category === 'server' && role === 'radius';
  });

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

    const resolvedAction = previousRule?.action ?? 'ALLOW';
    const resolvedService =
      previousRule?.service ??
      getDefaultAclService(
        link.kind,
        from?.category,
        to?.category,
        ipsecAuthMethod,
        hasRadiusNode,
      );
    const resolvedProtocol = previousRule?.protocol ?? 'any';

    const qosSuggestion = suggestAclRuleQoS({
      rule: {
        action: resolvedAction,
        service: resolvedService,
        protocol: resolvedProtocol,
        natExempt: false,
      },
      linkKind: link.kind,
      linkBandwidthKbps: link.wanQosPolicy?.totalBandwidthKbps,
      sourceCategory: from?.category,
      destinationCategory: to?.category,
    });

    return normalizeAclRule(
      {
        id: previousRule?.id ?? managedAclRuleId(link.id),
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
        action: resolvedAction,
        service: resolvedService,
        enabled: previousRule?.enabled ?? true,
        managed: true,
        priority: 1000 + index * 10,
        source: 'topology',
        stateful: isStateful,
        bidirectional: link.bidirectional ?? true,
        passthrough: isPassthrough,
        natExempt: false,
        protocol: resolvedProtocol,
        trafficClass: previousRule?.trafficClass ?? qosSuggestion.trafficClass,
        dscpMark: previousRule?.dscpMark ?? qosSuggestion.dscpMark,
        guaranteedBwKbps:
          previousRule?.guaranteedBwKbps ?? qosSuggestion.guaranteedBwKbps,
        maxBwKbps: previousRule?.maxBwKbps ?? qosSuggestion.maxBwKbps,
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

    const natExemptService = 'esp, udp/500, udp/4500';
    const natExemptQosSuggestion = suggestAclRuleQoS({
      rule: {
        action: 'ALLOW',
        service: natExemptService,
        protocol: 'any',
        natExempt: true,
      },
      linkKind: link.kind,
      linkBandwidthKbps: link.wanQosPolicy?.totalBandwidthKbps,
      sourceCategory: fromNode?.category,
      destinationCategory: toNode?.category,
    });

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
          service: natExemptService,
          enabled: existing?.enabled ?? true,
          managed: true,
          priority: 9990 + natExemptIndex,
          source: 'topology',
          stateful: false,
          bidirectional: true,
          passthrough: false,
          natExempt: true,
          protocol: 'any',
          trafficClass: existing?.trafficClass ?? natExemptQosSuggestion.trafficClass,
          dscpMark: existing?.dscpMark ?? natExemptQosSuggestion.dscpMark,
          guaranteedBwKbps:
            existing?.guaranteedBwKbps ?? natExemptQosSuggestion.guaranteedBwKbps,
          maxBwKbps: existing?.maxBwKbps ?? natExemptQosSuggestion.maxBwKbps,
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
    .map((rule, index) => {
      const sourceNode = state.nodes.find((node) => node.id === rule.sourceNodeId);
      const destinationNode = state.nodes.find(
        (node) => node.id === rule.destinationNodeId,
      );
      const linkedRule =
        (rule.linkId
          ? state.links.find((link) => link.id === rule.linkId)
          : undefined) ??
        state.links.find(
          (link) =>
            (link.from === rule.sourceNodeId &&
              link.to === rule.destinationNodeId) ||
            (link.from === rule.destinationNodeId &&
              link.to === rule.sourceNodeId),
        );

      const qosSuggestion = suggestAclRuleQoS({
        rule: {
          action: rule.action,
          service: rule.service,
          protocol: rule.protocol,
          natExempt: rule.natExempt,
        },
        linkKind: linkedRule?.kind,
        linkBandwidthKbps: linkedRule?.wanQosPolicy?.totalBandwidthKbps,
        sourceCategory: sourceNode?.category,
        destinationCategory: destinationNode?.category,
      });

      return normalizeAclRule(
        {
          ...rule,
          source: rule.source ?? 'manual',
          priority: rule.priority ?? index * 10 + 10,
          stateful: rule.stateful ?? true,
          bidirectional: rule.bidirectional ?? false,
          passthrough: rule.passthrough ?? false,
          natExempt: rule.natExempt ?? false,
          protocol: rule.protocol ?? 'any',
          trafficClass: rule.trafficClass ?? qosSuggestion.trafficClass,
          dscpMark: rule.dscpMark ?? qosSuggestion.dscpMark,
          guaranteedBwKbps:
            rule.guaranteedBwKbps ?? qosSuggestion.guaranteedBwKbps,
          maxBwKbps: rule.maxBwKbps ?? qosSuggestion.maxBwKbps,
        },
        state.nodes,
        state.siteVlans,
      );
    });

  return [...managedRules, ...natExemptRules, ...manualRules];
}
