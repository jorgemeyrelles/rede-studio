import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Gauge,
  GripVertical,
  Info,
  Lock,
  MapPin,
  RotateCcw,
  Shield,
  X,
} from 'lucide-react';
import { Fragment, useRef, useState, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  DSCP_BY_QOSCLASS,
  QOSCLASS_LABEL,
} from '../../features/network/constants';
import {
  addCustomAclRule,
  addQosQueue,
  removeCustomAclRule,
  removeDhcpScope,
  removeQosQueue,
  reorderCustomAclRule,
  setAclChildOverride,
  updateAclRule,
  updateAclRuleQoS,
  updateLink,
  updateQosQueue,
  upsertDhcpScope,
} from '../../features/network/networkSlice';
import {
  selectFirewallRulesGrouped,
  selectRouteTable,
  selectSubnetRouteTable,
} from '../../features/network/selectors';
import type {
  AclAction,
  AddressAllocationMode,
  DhcpScopeIpv6Mode,
  RouteType,
} from '../../features/network/types';
import type { QosClass, QosQueue } from '../../features/network/types/entities';
import type { FirewallRuleRow } from '../../features/network/types/selectors';
import { suggestAclRuleQoS } from '../../features/network/utils';
import {
  getRouteFirewallCopy,
  getSiteOtherIps,
  groupRoutesBySite,
  groupSubnetRoutesBySiteAndVlan,
  ROUTE_TYPE_CLASS,
  SERVICE_CATALOG,
  type RouteFirewallPanelProps,
  type TooltipPosition,
} from './catalog';
import RoutingProtocolTable from './RoutingProtocolTable';
import type { TableTabDescriptor } from './TableTabs';
import TreePicker from './TreePicker';
import RemoveButton from './RemoveButton';
import { ui as studioUi } from './utils/studioUi';

function HeaderInfoTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const setTooltipPosition = (button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    setPosition({
      top: rect.top + rect.height / 2,
      left: rect.right,
    });
  };

  const openTooltipOnMouse = (event: React.MouseEvent<HTMLButtonElement>) => {
    setTooltipPosition(event.currentTarget);
  };

  const openTooltipOnFocus = (event: React.FocusEvent<HTMLButtonElement>) => {
    setTooltipPosition(event.currentTarget);
  };

  const closeTooltip = () => {
    setPosition(null);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <button
        type="button"
        aria-label={`${studioUi().infoAbout} ${label}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-2xs text-chalk-faint transition hover:text-chalk"
        onMouseEnter={openTooltipOnMouse}
        onMouseLeave={closeTooltip}
        onFocus={openTooltipOnFocus}
        onBlur={closeTooltip}
      >
        <Info size={12} aria-hidden="true" />
      </button>
      {position && (
        <div
          className="fixed z-[1000] w-72 -translate-y-1/2 rounded-sm border border-line-strong bg-ink p-2 text-left text-2xs leading-relaxed text-chalk-dim shadow-panel"
          style={{
            top: position.top,
            left: position.left,
          }}
        >
          {children}
        </div>
      )}
    </span>
  );
}

function TruncatedValueTooltip({
  value,
  maxWidthClass = 'max-w-[130px]',
  className = '',
}: {
  value: string;
  maxWidthClass?: string;
  className?: string;
}) {
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const openTooltip = (element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    setPosition({
      top: rect.top + rect.height / 2,
      left: rect.right + 8,
    });
  };

  const closeTooltip = () => {
    setPosition(null);
  };

  return (
    <>
      <div
        tabIndex={0}
        className={`${maxWidthClass} cursor-help overflow-hidden text-ellipsis whitespace-nowrap text-2xs text-chalk-dim rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent ${className}`}
        onMouseEnter={(event) => openTooltip(event.currentTarget)}
        onMouseLeave={closeTooltip}
        onFocus={(event) => openTooltip(event.currentTarget)}
        onBlur={closeTooltip}
      >
        {value}
      </div>

      {position && (
        <div
          className="fixed z-[1000] max-w-[360px] -translate-y-1/2 rounded-sm border border-line-strong bg-ink px-3 py-2 text-left text-2xs leading-relaxed text-chalk shadow-panel"
          style={{
            top: position.top,
            left: position.left,
          }}
        >
          {value}
        </div>
      )}
    </>
  );
}

// ── Flag badge with custom styled tooltip ──────────────────────────────────
function FlagBadge({
  children,
  tooltip,
  className,
}: {
  children: ReactNode;
  tooltip: string;
  className: string;
}) {
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const open = (el: HTMLSpanElement) => {
    const rect = el.getBoundingClientRect();
    setPosition({ top: rect.top + rect.height / 2, left: rect.right + 6 });
  };
  const close = () => setPosition(null);

  return (
    <>
      {/* Código curto (FD/HD, ←R, stl, ícones) — o significado completo vai
          no nome acessível; o conteúdo visual fica oculto pra leitor de tela. */}
      <span
        role="img"
        aria-label={tooltip}
        className={`inline-flex cursor-help items-center rounded-sm px-1 py-px text-2xs ${className}`}
        onMouseEnter={(e) => open(e.currentTarget)}
        onMouseLeave={close}
        onFocus={(e) => open(e.currentTarget)}
        onBlur={close}
        tabIndex={0}
      >
        <span aria-hidden="true">{children}</span>
      </span>
      {position && (
        <div
          role="tooltip"
          className="fixed z-[1000] max-w-[260px] -translate-y-1/2 rounded-sm border border-line-strong bg-ink px-2 py-1.5 text-left text-2xs leading-relaxed text-chalk shadow-panel"
          style={{ top: position.top, left: position.left }}
        >
          {tooltip}
        </div>
      )}
    </>
  );
}

function IconActionTooltipButton({
  icon,
  tooltip,
  ariaLabel,
  className,
  onClick,
}: {
  icon: ReactNode;
  tooltip: string;
  ariaLabel: string;
  className: string;
  onClick?: () => void;
}) {
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const open = (el: HTMLButtonElement) => {
    const rect = el.getBoundingClientRect();
    setPosition({ top: rect.top + rect.height / 2, left: rect.right + 8 });
  };

  const close = () => setPosition(null);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClick}
        onMouseEnter={(e) => open(e.currentTarget)}
        onMouseLeave={close}
        onFocus={(e) => open(e.currentTarget)}
        onBlur={close}
        className={`flex h-5 w-5 items-center justify-center rounded-sm border text-2xs transition ${className}`}
      >
        {icon}
      </button>

      {position && (
        <div
          className="fixed z-[1000] max-w-[260px] -translate-y-1/2 rounded-sm border border-line-strong bg-ink px-2 py-1.5 text-left text-2xs leading-relaxed text-chalk shadow-panel"
          style={{ top: position.top, left: position.left }}
        >
          {tooltip}
        </div>
      )}
    </>
  );
}

// ── Badge helpers ───────────────────────────────────────────────────────────
function RuleBadges({ rule }: { rule: FirewallRuleRow }) {
  const natLabel =
    rule.fwNatMode === 'pat'
      ? 'NAT'
      : rule.fwNatMode === 'snat'
        ? 'SNAT'
        : rule.fwNatMode === 'dnat'
          ? 'DNAT'
          : rule.fwNatMode === 'hybrid'
            ? 'NAT+DNAT'
            : null;

  const natTitle =
    rule.fwNatMode === 'pat'
      ? studioUi().natPat
      : rule.fwNatMode === 'snat'
        ? studioUi().natSnat
        : rule.fwNatMode === 'dnat'
          ? studioUi().natDnat
          : rule.fwNatMode === 'hybrid'
            ? studioUi().natHybrid
            : '';

  const ipsecBadgeColor =
    rule.ipsecAuthBadge === 'PKI' || rule.ipsecAuthBadge === 'keypair'
      ? 'bg-signal-up/15 text-signal-up'
      : rule.ipsecAuthBadge === 'EAP'
        ? 'bg-route-bgp/15 text-route-bgp'
        : rule.ipsecAuthBadge === 'NO_IKE'
          ? 'bg-signal-down/15 text-signal-down'
          : 'bg-signal-warn/15 text-signal-warn'; // PSK

  const duplexIcon = rule.duplexMode === 'half' ? 'HD' : 'FD';
  const duplexTitle =
    rule.duplexMode === 'half' ? studioUi().halfDuplex : studioUi().fullDuplex;
  const duplexClass =
    rule.duplexMode === 'half'
      ? 'bg-ink-raised-2 text-chalk-dim'
      : 'bg-ink-raised-2 text-chalk-dim';

  return (
    <span className="flex flex-wrap gap-0.5">
      {!rule.stateful && !rule.passthrough && (
        <FlagBadge
          tooltip={studioUi().flagStateless}
          className="bg-signal-warn/15 text-signal-warn"
        >
          ~
        </FlagBadge>
      )}
      {rule.bidirectional && (
        <FlagBadge
          tooltip={studioUi().flagBidirectional}
          className="bg-accent/15 text-accent"
        >
          <ArrowLeftRight size={10} aria-hidden="true" />
        </FlagBadge>
      )}
      <FlagBadge tooltip={duplexTitle} className={duplexClass}>
        {duplexIcon}
      </FlagBadge>
      {rule.passthrough && (
        <FlagBadge
          tooltip={studioUi().flagPassthrough}
          className="bg-ink-raised-2 text-chalk-dim"
        >
          <Ban size={10} aria-hidden="true" />
        </FlagBadge>
      )}
      {rule.hasConflict && (
        <FlagBadge
          tooltip={studioUi().flagConflict}
          className="bg-signal-down/15 text-signal-down"
        >
          <AlertTriangle size={10} aria-hidden="true" />
        </FlagBadge>
      )}
      {rule.natExempt && (
        <FlagBadge
          tooltip={studioUi().flagNatExempt}
          className="bg-signal-up/15 text-signal-up"
        >
          <Shield size={10} aria-hidden="true" />
        </FlagBadge>
      )}
      {natLabel && (
        <FlagBadge
          tooltip={natTitle}
          className="bg-signal-warn/15 text-signal-warn"
        >
          {natLabel}
        </FlagBadge>
      )}
      {rule.ipsecAuthBadge && (
        <FlagBadge
          tooltip={`IPsec auth: ${rule.ipsecAuthBadge === 'NO_IKE' ? studioUi().noIke : rule.ipsecAuthBadge}`}
          className={ipsecBadgeColor}
        >
          {rule.ipsecAuthBadge === 'NO_IKE'
            ? studioUi().noIke
            : rule.ipsecAuthBadge}
        </FlagBadge>
      )}
      {rule.managed && (
        <FlagBadge
          tooltip={studioUi().flagManaged}
          className="bg-ink-raised-2 text-chalk-dim"
        >
          <Lock size={10} aria-hidden="true" />
        </FlagBadge>
      )}
      {rule.isReturnRule && (
        <FlagBadge
          tooltip={studioUi().flagReturnException}
          className="bg-route-vpn/15 text-route-vpn"
        >
          ←R
        </FlagBadge>
      )}
      {rule.missingReturn && (
        <FlagBadge
          tooltip={studioUi().flagMissingReturn}
          className="bg-route-default/15 text-route-default"
        >
          stl
        </FlagBadge>
      )}
    </span>
  );
}

// ── Zone Section Label ──────────────────────────────────────────────────────
function ZoneHeader({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <tr>
      <td
        colSpan={7}
        className={`border-y border-line bg-ink-raised-2 px-2 py-1 text-label ${color}`}
      >
        {label} ({count})
      </td>
    </tr>
  );
}

// ── ServicePicker ─────────────────────────────────────────────────────────
function ServicePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['Web']));
  const [custom, setCustom] = useState('');

  const toggleGroup = (group: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-sm border border-line-strong bg-ink-raised-2 px-2 py-1 text-left text-2xs text-chalk hover:border-line-strong"
      >
        <span className="block truncate">{value || 'Selecionar serviço…'}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-sm border border-line-strong bg-ink shadow-panel">
          <div className="max-h-56 overflow-y-auto">
            {/* Any */}
            <button
              type="button"
              onClick={() => {
                onChange('ANY');
                setOpen(false);
              }}
              className="w-full px-2 py-1 text-left text-2xs text-chalk-dim hover:bg-ink-raised-2"
            >
              {studioUi().anyService}
            </button>
            {SERVICE_CATALOG.map((cat) => (
              <div key={cat.group}>
                <button
                  type="button"
                  onClick={() => toggleGroup(cat.group)}
                  className="flex w-full items-center gap-1 bg-ink-raised-2 px-2 py-1 text-left text-2xs font-semibold text-chalk-dim hover:text-chalk"
                >
                  <span>
                    {openGroups.has(cat.group) ? (
                      <ChevronDown size={12} aria-hidden="true" />
                    ) : (
                      <ChevronRight size={12} aria-hidden="true" />
                    )}
                  </span>
                  {cat.group}
                </button>
                {openGroups.has(cat.group) &&
                  cat.items.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        onChange(item.value);
                        setOpen(false);
                      }}
                      className="w-full px-4 py-0.5 text-left text-2xs text-chalk-dim hover:bg-ink-raised-2"
                    >
                      {item.label}
                      <span className="ml-1 text-chalk-faint">
                        {item.value}
                      </span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
          {/* Custom entry */}
          <div className="border-t border-line p-1.5">
            <div className="flex gap-1">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="ex: tcp/8080"
                className="flex-1 rounded-sm border border-line-strong bg-ink-raised-2 px-1.5 py-0.5 text-2xs text-chalk placeholder-chalk-faint"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && custom.trim()) {
                    onChange(custom.trim());
                    setCustom('');
                    setOpen(false);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (custom.trim()) {
                    onChange(custom.trim());
                    setCustom('');
                    setOpen(false);
                  }
                }}
                className="rounded-sm border border-line-strong px-1.5 py-0.5 text-2xs text-chalk-dim hover:border-line-strong"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook (não componente) que monta as 6 seções de rotas/firewall como
 * descritores de aba `{ id, label, content }` — StudioPage.tsx combina o
 * retorno com os outros paineis do Studio (VLANs por site, inventário,
 * serviços/certificados) num único `TableTabs` (ver Fase 4 do redesign
 * Planta, .claude/plans/redesign-planta-e-sessao-jwt.md). Continua um hook
 * de verdade (chama useAppSelector/useState normalmente) — só a "casca" de
 * JSX que virou array em vez de <TableTabs>.
 */
export function useRouteFirewallTabs({
  language,
}: RouteFirewallPanelProps): TableTabDescriptor[] {
  const dispatch = useAppDispatch();
  const routes = useAppSelector(selectRouteTable);
  const subnetRoutes = useAppSelector(selectSubnetRouteTable);
  const { manualRules, topologyRules, natExemptRules } = useAppSelector(
    selectFirewallRulesGrouped,
  );
  const siteVlans = useAppSelector((state) => state.network.siteVlans);
  const dhcpScopes = useAppSelector((state) => state.network.dhcpScopes);
  const siteNetworks = useAppSelector((state) => state.network.siteNetworks);
  const nodeVlanInterfaces = useAppSelector(
    (state) => state.network.nodeVlanInterfaces,
  );
  const sites = useAppSelector((state) => state.network.sites);
  const nodes = useAppSelector((state) => state.network.nodes);
  const links = useAppSelector((state) => state.network.links);
  const aclRules = useAppSelector((state) => state.network.aclRules);
  const nodeQosProfiles = useAppSelector(
    (state) => state.network.nodeQosProfiles,
  );
  const copy = getRouteFirewallCopy(language);
  const routeTypeLabels: Record<RouteType, string> = {
    Direta: copy.routeTypeDirect,
    Estática: copy.routeTypeStatic,
    Default: copy.routeTypeDefault,
    VPN: copy.routeTypeVpn,
    BGP: 'BGP',
  };
  const subnetRouteGroups = groupSubnetRoutesBySiteAndVlan(subnetRoutes);

  const allocationModeLabels: Record<AddressAllocationMode, string> = {
    dhcpv4: 'DHCPv4',
    dhcpv6: 'DHCPv6',
    slaac: 'SLAAC',
    'dual-dhcp-slaac': 'DHCPv4 + SLAAC/DHCPv6',
    'static-ipv4': 'Static IPv4',
    'static-ipv6': 'Static IPv6',
    'static-dual': 'Static Dual Stack',
  };

  const ipv6PolicyLabels: Record<string, string> = {
    none: 'none',
    slaac: 'slaac',
    'dhcpv6-stateless': 'dhcpv6-stateless',
    'dhcpv6-stateful': 'dhcpv6-stateful',
  };

  const dhcpScopeByVlan = new Map(
    dhcpScopes.map((scope) => [`${scope.siteId}|${scope.vlanId}`, scope]),
  );

  const defaultIpv6ModeByAllocation = (
    mode: AddressAllocationMode,
  ): DhcpScopeIpv6Mode => {
    if (mode === 'slaac') return 'slaac';
    if (mode === 'dhcpv6') return 'dhcpv6-stateful';
    if (mode === 'dual-dhcp-slaac') return 'dhcpv6-stateless';
    return 'none';
  };

  const normalizeList = (raw: string) =>
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(
        (item, index, self) => item !== '' && self.indexOf(item) === index,
      );

  const suggestDnsForVlan = (vlan: (typeof siteVlans)[number]) => {
    const siteScopedNetworks = siteNetworks.filter(
      (item) => item.siteId === vlan.siteId,
    );
    const network = vlan.networkId
      ? siteNetworks.find((item) => item.id === vlan.networkId)
      : siteScopedNetworks.length === 1
        ? siteScopedNetworks[0]
        : siteScopedNetworks.find((item) => item.purpose === 'principal');

    const vlanIfaces = nodeVlanInterfaces.filter(
      (item) => item.siteId === vlan.siteId && item.vlanId === vlan.vlanId,
    );

    const preferredIface =
      vlanIfaces.find((iface) => {
        const ifaceNode = nodes.find((node) => node.id === iface.nodeId);
        return Boolean(ifaceNode?.techProfile?.fields?.gatewayDefault);
      }) ??
      vlanIfaces.find((iface) => {
        const ifaceNode = nodes.find((node) => node.id === iface.nodeId);
        return (
          ifaceNode?.category === 'router' || ifaceNode?.category === 'firewall'
        );
      }) ??
      vlanIfaces[0];

    const preferredGatewayNode =
      (preferredIface
        ? nodes.find((node) => node.id === preferredIface.nodeId)
        : undefined) ??
      nodes.find(
        (node) =>
          node.siteId === vlan.siteId &&
          Boolean(node.ip?.trim()) &&
          Boolean(node.techProfile?.fields?.gatewayDefault),
      ) ??
      nodes.find(
        (node) =>
          node.siteId === vlan.siteId &&
          (node.category === 'router' || node.category === 'firewall') &&
          Boolean(node.ip?.trim()),
      ) ??
      nodes.find(
        (node) =>
          node.siteId === vlan.siteId &&
          node.category !== 'wan' &&
          Boolean(node.ip?.trim()),
      );

    const networkDnsPolicy = network?.dnsPolicy ?? 'a-only';
    const hasIpv6Plan =
      (network?.stackMode ?? 'ipv4') !== 'ipv4' ||
      Boolean(vlan.ipv6Prefix && vlan.ipv6Prefix.trim() !== '');
    const includeIpv6Dns = networkDnsPolicy === 'a-aaaa' && hasIpv6Plan;

    const v4 = [
      preferredIface?.gatewayIp,
      preferredGatewayNode?.ip,
      '8.8.8.8',
      '1.1.1.1',
    ].filter(
      (value, index, self): value is string =>
        Boolean(value && value.trim() !== '') && self.indexOf(value) === index,
    );

    const v6 = includeIpv6Dns
      ? [
          preferredIface?.gatewayIpv6,
          preferredGatewayNode?.ipv6,
          '2001:4860:4860::8888',
          '2606:4700:4700::1111',
        ].filter(
          (value, index, self): value is string =>
            Boolean(value && value.trim() !== '') &&
            self.indexOf(value) === index,
        )
      : [];

    return {
      dnsServers: v4,
      ipv6DnsServers: v6,
      includeIpv6Dns,
    };
  };

  const buildDhcpScopePayload = (
    vlan: (typeof siteVlans)[number],
    scope: (typeof dhcpScopes)[number] | undefined,
  ) => {
    const allocationMode = vlan.addressAllocation ?? 'dhcpv4';
    const suggestedDns = suggestDnsForVlan(vlan);
    const currentDnsV4 = (scope?.dnsServers ?? []).filter(
      (item) => item.trim() !== '',
    );
    const currentDnsV6 = (scope?.ipv6DnsServers ?? []).filter(
      (item) => item.trim() !== '',
    );

    return {
      id: scope?.id,
      siteId: vlan.siteId,
      vlanId: vlan.vlanId,
      allocationMode,
      providerType: scope?.providerType ?? 'node',
      providerNodeId: scope?.providerNodeId,
      relayNodeId: scope?.relayNodeId,
      poolStartIp: scope?.poolStartIp ?? vlan.startIp,
      poolEndIp: scope?.poolEndIp ?? vlan.endIp,
      excludedIps: scope?.excludedIps ?? [],
      leaseMinutes: scope?.leaseMinutes ?? 1440,
      dnsServers:
        currentDnsV4.length > 0 ? currentDnsV4 : suggestedDns.dnsServers,
      ipv6Mode: scope?.ipv6Mode ?? defaultIpv6ModeByAllocation(allocationMode),
      ipv6DnsServers:
        currentDnsV6.length > 0
          ? currentDnsV6
          : suggestedDns.includeIpv6Dns
            ? suggestedDns.ipv6DnsServers
            : [],
      notes: scope?.notes ?? '',
    };
  };

  const updateDhcpScope = (
    vlan: (typeof siteVlans)[number],
    changes: Partial<ReturnType<typeof buildDhcpScopePayload>>,
  ) => {
    const current = dhcpScopeByVlan.get(`${vlan.siteId}|${vlan.vlanId}`);
    dispatch(
      upsertDhcpScope({
        ...buildDhcpScopePayload(vlan, current),
        ...changes,
      }),
    );
  };

  const getPreferredDhcpNodeId = (siteId: string) => {
    const preferred = nodes.find(
      (node) =>
        node.siteId === siteId &&
        (node.category === 'router' ||
          node.category === 'firewall' ||
          node.category === 'switch'),
    );
    if (preferred) return preferred.id;
    return (
      nodes.find((node) => node.siteId === siteId && node.category !== 'wan')
        ?.id ?? undefined
    );
  };

  const applyDhcpProposal = (vlan: (typeof siteVlans)[number]) => {
    const allocationMode = vlan.addressAllocation ?? 'dhcpv4';
    if (isStaticAllocation(allocationMode)) return;

    const scope = dhcpScopeByVlan.get(`${vlan.siteId}|${vlan.vlanId}`);
    const suggestedDns = suggestDnsForVlan(vlan);
    const preferredNodeId = getPreferredDhcpNodeId(vlan.siteId);

    const providerType = scope?.providerType ?? 'node';

    updateDhcpScope(vlan, {
      providerType,
      providerNodeId:
        providerType === 'node'
          ? (scope?.providerNodeId ?? preferredNodeId)
          : undefined,
      relayNodeId:
        providerType === 'relay'
          ? (scope?.relayNodeId ?? preferredNodeId)
          : undefined,
      poolStartIp: vlan.startIp,
      poolEndIp: vlan.endIp,
      leaseMinutes: scope?.leaseMinutes ?? 1440,
      ipv6Mode: scope?.ipv6Mode ?? defaultIpv6ModeByAllocation(allocationMode),
      dnsServers: suggestedDns.dnsServers,
      ipv6DnsServers: suggestedDns.ipv6DnsServers,
    });
  };

  const resolveNodeLabel = (nodeId?: string) => {
    if (!nodeId) return '-';
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) return nodeId;
    return `${node.label} (${node.ip})`;
  };

  const isStaticAllocation = (mode: AddressAllocationMode) =>
    mode === 'static-ipv4' || mode === 'static-ipv6' || mode === 'static-dual';

  const dhcpRows = [...siteVlans]
    .sort((left, right) => {
      if (left.siteId !== right.siteId)
        return left.siteId.localeCompare(right.siteId);
      return left.vlanId - right.vlanId;
    })
    .map((vlan) => {
      const key = `${vlan.siteId}|${vlan.vlanId}`;
      const scope = dhcpScopeByVlan.get(key);
      const siteName =
        sites.find((site) => site.id === vlan.siteId)?.name ?? vlan.siteId;
      const allocation = vlan.addressAllocation ?? 'dhcpv4';
      const isStatic = isStaticAllocation(allocation);

      const providerLabel = scope
        ? scope.providerType === 'node'
          ? copy.dhcpProviderNode
          : scope.providerType === 'relay'
            ? copy.dhcpProviderRelay
            : copy.dhcpProviderExternal
        : '-';

      const serverRelay = scope
        ? [
            resolveNodeLabel(scope.providerNodeId),
            resolveNodeLabel(scope.relayNodeId),
          ]
            .filter((value) => value !== '-')
            .join(' | ') || '-'
        : '-';

      const poolRange =
        scope?.poolStartIp && scope?.poolEndIp
          ? `${scope.poolStartIp} - ${scope.poolEndIp}`
          : '-';

      const suggestedDns = suggestDnsForVlan(vlan);
      const dnsV4 =
        scope?.dnsServers && scope.dnsServers.length > 0
          ? scope.dnsServers
          : suggestedDns.dnsServers;
      const dnsV6 =
        scope?.ipv6DnsServers && scope.ipv6DnsServers.length > 0
          ? scope.ipv6DnsServers
          : suggestedDns.ipv6DnsServers;

      const ipv6Policy = scope?.ipv6Mode
        ? (ipv6PolicyLabels[scope.ipv6Mode] ?? scope.ipv6Mode)
        : '-';

      const lease = scope?.leaseMinutes ? String(scope.leaseMinutes) : '-';

      const requiresPool =
        allocation === 'dhcpv4' || allocation === 'dual-dhcp-slaac';

      const changeRequired = (() => {
        if (isStatic) return copy.dhcpChangeStaticNoDhcp;
        if (!scope) return copy.dhcpChangeCreateScope;
        if (scope.providerType === 'node' && !scope.providerNodeId) {
          return copy.dhcpChangeSetDhcpServer;
        }
        if (scope.providerType === 'relay' && !scope.relayNodeId) {
          return copy.dhcpChangeSetRelayNode;
        }
        if (requiresPool && (!scope.poolStartIp || !scope.poolEndIp)) {
          return copy.dhcpChangeDefinePool;
        }
        return copy.dhcpChangeNone;
      })();

      const status: 'pending' | 'ok' | 'static' =
        changeRequired === copy.dhcpChangeStaticNoDhcp
          ? 'static'
          : changeRequired === copy.dhcpChangeNone
            ? 'ok'
            : 'pending';

      return {
        id: vlan.id,
        siteId: vlan.siteId,
        vlan,
        scope,
        hasScope: Boolean(scope),
        requiresPool,
        siteName,
        vlanLabel: `${vlan.vlanId} - ${vlan.name}`,
        allocationLabel: allocationModeLabels[allocation],
        providerLabel,
        serverRelay,
        poolRange,
        dnsV4,
        dnsV6,
        ipv6Policy,
        lease,
        changeRequired,
        status,
      };
    });

  const dhcpSummary = dhcpRows.reduce(
    (acc, row) => {
      if (row.status === 'pending') acc.pending += 1;
      if (row.status === 'ok') acc.configured += 1;
      return acc;
    },
    {
      total: dhcpRows.length,
      pending: 0,
      configured: 0,
    },
  );

  const getVlanOptions = (siteId?: string) => {
    if (!siteId) return [];
    return siteVlans
      .filter((vlan) => vlan.siteId === siteId)
      .sort((a, b) => a.vlanId - b.vlanId);
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [qosExpandedIds, setQosExpandedIds] = useState<Set<string>>(new Set());
  const [expansionFilters, setExpansionFilters] = useState<
    Record<string, { origin: string; dest: string }>
  >({});
  const [manualZoneFirst, setManualZoneFirst] = useState(true);
  const [showDhcpPendingOnly, setShowDhcpPendingOnly] = useState(false);

  const dhcpVisibleRows = showDhcpPendingOnly
    ? dhcpRows.filter((row) => row.status === 'pending')
    : dhcpRows;

  // H — drag handle state
  const dragRuleIdRef = useRef<string | null>(null);

  // P16 — QoS Profile form state (por nó selecionado)
  const [qosSelectedNodeId, setQosSelectedNodeId] = useState<string>('');
  const [qosFormName, setQosFormName] = useState('');
  const [qosFormClass, setQosFormClass] = useState<QosClass>('default');
  const [qosFormPriority, setQosFormPriority] =
    useState<QosQueue['priority']>('best-effort');
  const [qosFormMinBw, setQosFormMinBw] = useState<number | ''>('');

  // ── Custom rule creator state ─────────────────────────────────────────────
  const [showCreator, setShowCreator] = useState(false);
  const [newSrcNodeId, setNewSrcNodeId] = useState('');
  const [newDstNodeId, setNewDstNodeId] = useState('');
  const [newService, setNewService] = useState('ANY');
  const [newProtocol, setNewProtocol] = useState<
    'tcp' | 'udp' | 'icmp' | 'any'
  >('any');
  const [newAction, setNewAction] = useState<AclAction>('ALLOW');
  const [newStateful, setNewStateful] = useState(true);
  const [newBidirectional, setNewBidirectional] = useState(false);
  const [newSrcScope, setNewSrcScope] = useState<
    'node' | 'vlan' | 'ip' | 'any'
  >('node');
  const [newDstScope, setNewDstScope] = useState<
    'node' | 'vlan' | 'ip' | 'any'
  >('node');

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getChildAction = (
    childId: string,
    parentAction: AclAction,
    ruleId: string,
  ): AclAction => {
    const rule = aclRules.find((r) => r.id === ruleId);
    return (
      (rule?.childOverrides?.[childId] as AclAction | undefined) ?? parentAction
    );
  };

  const setChildAction = (
    ruleId: string,
    childId: string,
    action: AclAction,
    parentAction: AclAction,
  ) =>
    dispatch(
      setAclChildOverride({
        ruleId,
        childId,
        // null = remover sobrescrita quando volta ao padrão do pai
        action: action === parentAction ? null : action,
      }),
    );

  const getFilter = (ruleId: string) =>
    expansionFilters[ruleId] ?? { origin: '', dest: '' };

  const setFilterValue = (
    ruleId: string,
    side: 'origin' | 'dest',
    value: string,
  ) =>
    setExpansionFilters((prev) => ({
      ...prev,
      [ruleId]: { ...getFilter(ruleId), [side]: value },
    }));

  type ExpansionRow = { id: string; origem: string; destino: string };

  const getExpansionRows = (
    rule: FirewallRuleRow,
    children: FirewallRuleRow[],
  ): ExpansionRow[] => {
    if (children.length > 0) {
      return children.map((c) => ({
        id: c.id,
        origem: c.origem,
        destino: c.destino,
      }));
    }
    const srcVlans = getVlanOptions(rule.sourceNodeSiteId);
    const dstVlans = getVlanOptions(rule.destinationNodeSiteId);
    if (srcVlans.length === 0 && dstVlans.length === 0) return [];
    if (srcVlans.length > 0 && dstVlans.length > 0) {
      return srcVlans.flatMap((sv) =>
        dstVlans.map((dv) => ({
          id: `${rule.aclRuleId}|sv${sv.vlanId}|dv${dv.vlanId}`,
          origem: `VLAN ${sv.vlanId} (${sv.name})`,
          destino: `VLAN ${dv.vlanId} (${dv.name})`,
        })),
      );
    }
    if (srcVlans.length > 0) {
      return srcVlans.map((sv) => ({
        id: `${rule.aclRuleId}|sv${sv.vlanId}`,
        origem: `VLAN ${sv.vlanId} (${sv.name})`,
        destino: rule.destino,
      }));
    }
    return dstVlans.map((dv) => ({
      id: `${rule.aclRuleId}|dv${dv.vlanId}`,
      origem: rule.origem,
      destino: `VLAN ${dv.vlanId} (${dv.name})`,
    }));
  };

  // ── Grouped helper ─────────────────────────────────────────────────────────
  const groupFlat = (flatRules: FirewallRuleRow[]) => {
    const groups: { parent: FirewallRuleRow; children: FirewallRuleRow[] }[] =
      [];
    for (const row of flatRules) {
      if (!row.isDerivedAllocation) {
        groups.push({ parent: row, children: [] });
      } else if (groups.length > 0) {
        groups[groups.length - 1].children.push(row);
      }
    }
    return groups;
  };

  const handleAddCustomRule = () => {
    if (!newSrcNodeId || !newDstNodeId) return;
    dispatch(
      addCustomAclRule({
        sourceNodeId: newSrcNodeId,
        destinationNodeId: newDstNodeId,
        sourceScope: newSrcScope,
        destinationScope: newDstScope,
        service: newService,
        action: newAction,
        protocol: newProtocol,
        stateful: newStateful,
        bidirectional: newBidirectional,
      }),
    );
    setShowCreator(false);
    setNewSrcNodeId('');
    setNewDstNodeId('');
    setNewService('ANY');
    setNewProtocol('any');
    setNewAction('ALLOW');
    setNewSrcScope('node');
    setNewDstScope('node');
  };

  // ── Rule row renderer ──────────────────────────────────────────────────────
  const renderRuleGroup = (
    rule: FirewallRuleRow,
    children: FirewallRuleRow[],
    idx: number,
    _totalManual: number,
    isManual: boolean,
    allManualGroups: { parent: FirewallRuleRow; children: FirewallRuleRow[] }[],
  ) => {
    const isExpandable =
      children.length > 0 ||
      rule.sourceScope === 'vlan' ||
      rule.sourceScope === 'ip-list' ||
      rule.destinationScope === 'vlan' ||
      rule.destinationScope === 'ip-list';
    const expansionRows = getExpansionRows(rule, children);
    const isOpen = expandedIds.has(rule.aclRuleId);
    const isQosOpen = qosExpandedIds.has(rule.aclRuleId);
    const rawRule = aclRules.find((r) => r.id === rule.aclRuleId);
    const sourceNode = rawRule
      ? nodes.find((node) => node.id === rawRule.sourceNodeId)
      : undefined;
    const destinationNode = rawRule
      ? nodes.find((node) => node.id === rawRule.destinationNodeId)
      : undefined;
    const linkedRule =
      rawRule && rawRule.linkId
        ? links.find((link) => link.id === rawRule.linkId)
        : links.find(
            (link) =>
              (link.from === rule.sourceNodeId &&
                link.to === rule.destinationNodeId) ||
              (link.from === rule.destinationNodeId &&
                link.to === rule.sourceNodeId),
          );
    const qosSuggestion = rawRule
      ? suggestAclRuleQoS({
          rule: {
            action: rawRule.action,
            service: rawRule.service,
            protocol: rawRule.protocol,
            natExempt: rawRule.natExempt,
          },
          linkKind: linkedRule?.kind,
          linkBandwidthKbps: linkedRule?.wanQosPolicy?.totalBandwidthKbps,
          sourceCategory: sourceNode?.category,
          destinationCategory: destinationNode?.category,
        })
      : {
          trafficClass: undefined,
          dscpMark: undefined,
          guaranteedBwKbps: undefined,
          maxBwKbps: undefined,
        };
    const hasQosSuggestion =
      qosSuggestion.trafficClass !== undefined ||
      qosSuggestion.dscpMark !== undefined ||
      qosSuggestion.guaranteedBwKbps !== undefined ||
      qosSuggestion.maxBwKbps !== undefined;
    const hasQos = !!(
      rawRule?.dscpMark !== undefined ||
      rawRule?.trafficClass ||
      rawRule?.guaranteedBwKbps ||
      rawRule?.maxBwKbps
    );
    const filter = getFilter(rule.aclRuleId);

    const filteredRows = expansionRows.filter((row) => {
      return (
        row.origem.toLowerCase().includes(filter.origin.toLowerCase()) &&
        row.destino.toLowerCase().includes(filter.dest.toLowerCase())
      );
    });

    return (
      <Fragment key={rule.id}>
        <tr className="hover:bg-ink-raised-2">
          {/* Chevron */}
          <td className="border-b border-line px-1 py-1">
            <button
              type="button"
              aria-label={isOpen ? 'Recolher' : 'Expandir'}
              onClick={() => isExpandable && toggleExpand(rule.aclRuleId)}
              disabled={!isExpandable}
              className={`flex h-5 w-5 items-center justify-center rounded-sm transition-all duration-150 ${
                isExpandable
                  ? 'cursor-pointer text-signal-warn hover:bg-ink-raised-2 hover:text-signal-warn'
                  : 'cursor-not-allowed text-chalk-faint opacity-40'
              }`}
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`h-3 w-3 transition-transform duration-200 ${isOpen ? 'rotate-90' : 'rotate-0'}`}
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </td>

          {/* Priority / ID */}
          <td className="border-b border-line px-1 py-1">
            <span className="text-2xs text-chalk-faint">{rule.priority}</span>
          </td>

          {/* Ação — cor por valor (Fase 4 do redesign Planta): allow em
              --signal-up, deny em --signal-down, nunca o acento de marca. */}
          <td className="border-b border-line px-1 py-1">
            <select
              value={rule.acao}
              onChange={(e) =>
                dispatch(
                  updateAclRule({
                    id: rule.aclRuleId,
                    changes: { action: e.target.value as AclAction },
                  }),
                )
              }
              className={`w-full rounded-sm border bg-ink px-1 py-1 text-2xs font-semibold ${
                rule.acao === 'ALLOW'
                  ? 'border-signal-up/50 text-signal-up'
                  : 'border-signal-down/50 text-signal-down'
              }`}
            >
              <option value="ALLOW">ALLOW</option>
              <option value="DENY">DENY</option>
            </select>
          </td>

          {/* Origem */}
          <td className="border-b border-line px-1 py-1">
            <TruncatedValueTooltip
              value={rule.origem}
              maxWidthClass="max-w-[140px]"
            />
          </td>

          {/* Destino */}
          <td className="border-b border-line px-1 py-1">
            <TruncatedValueTooltip
              value={rule.destino}
              maxWidthClass="max-w-[140px]"
            />
          </td>

          {/* Serviço */}
          <td className="border-b border-line px-1 py-1">
            <input
              value={rule.servico}
              onChange={(e) =>
                dispatch(
                  updateAclRule({
                    id: rule.aclRuleId,
                    changes: { service: e.target.value },
                  }),
                )
              }
              className="w-full rounded-sm border border-line bg-ink px-1 py-1 text-2xs text-chalk"
              placeholder="ANY, HTTPS:443"
            />
          </td>

          {/* Badges + actions */}
          <td className="border-b border-line px-1 py-1 text-right">
            <div className="flex flex-wrap items-center justify-end gap-1">
              <RuleBadges rule={rule} />
              {/* QoS toggle button */}
              <button
                type="button"
                title={studioUi().qosTitle}
                onClick={() =>
                  setQosExpandedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(rule.aclRuleId)) next.delete(rule.aclRuleId);
                    else next.add(rule.aclRuleId);
                    return next;
                  })
                }
                className={`flex h-5 items-center rounded-sm px-1 text-2xs font-bold transition ${
                  hasQos
                    ? 'border border-route-default/60 bg-route-default/15 text-route-default'
                    : 'text-chalk-faint hover:text-chalk-dim'
                }`}
              >
                <Gauge
                  size={11}
                  aria-hidden="true"
                  className={hasQos ? 'text-route-default' : ''}
                />{' '}
                QoS
              </button>
              {/* G — ↔ toggle bidirecional do link (1 linha ligado / cria exceção de retorno desligado) */}
              {!isManual && !rule.isReturnRule && rule.linkId && (
                <button
                  type="button"
                  title={
                    rule.bidirectional
                      ? studioUi().bidirectionalOn
                      : studioUi().bidirectionalOff
                  }
                  aria-label={
                    rule.bidirectional
                      ? studioUi().bidirectionalOn
                      : studioUi().bidirectionalOff
                  }
                  aria-pressed={rule.bidirectional}
                  onClick={() =>
                    dispatch(
                      updateLink({
                        id: rule.linkId!,
                        changes: { bidirectional: !rule.bidirectional },
                      }),
                    )
                  }
                  className={`ml-1 flex h-5 w-5 items-center justify-center rounded-sm border text-2xs transition ${
                    rule.bidirectional
                      ? 'border-accent/60 bg-ink-raised-2 text-chalk hover:bg-signal-down/15 hover:text-signal-down hover:border-signal-down/60'
                      : 'border-line bg-ink-raised-2 text-chalk-faint hover:bg-ink-raised-2 hover:text-accent hover:border-line-strong'
                  }`}
                >
                  <ArrowLeftRight size={11} aria-hidden="true" />
                </button>
              )}
              {isManual && (
                <div className="flex items-center gap-0.5">
                  {/* H — drag handle */}
                  <span
                    title="Arrastar para reordenar"
                    className="flex h-5 w-4 cursor-grab select-none items-center justify-center text-chalk-faint active:cursor-grabbing"
                    draggable
                    onDragStart={() => {
                      dragRuleIdRef.current = rule.aclRuleId;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      const draggedId = dragRuleIdRef.current;
                      dragRuleIdRef.current = null;
                      if (!draggedId || draggedId === rule.aclRuleId) return;
                      const draggedIdx = allManualGroups.findIndex(
                        (g) => g.parent.aclRuleId === draggedId,
                      );
                      if (draggedIdx === -1) return;
                      // Move dragged rule toward drop target
                      const direction = idx < draggedIdx ? 'up' : 'down';
                      dispatch(
                        reorderCustomAclRule({ id: draggedId, direction }),
                      );
                    }}
                  >
                    <GripVertical size={12} aria-hidden="true" />
                  </span>
                  <RemoveButton
                    onClick={() =>
                      dispatch(removeCustomAclRule({ id: rule.aclRuleId }))
                    }
                    label={studioUi().removeRule}
                  />
                </div>
              )}
            </div>
          </td>
        </tr>

        {/* ── QoS inline panel ────────────────────────────────────────────── */}
        <tr>
          <td colSpan={7} className="p-0">
            <div
              className={`overflow-hidden transition-all duration-200 ${isQosOpen ? 'max-h-[200px]' : 'max-h-0'}`}
            >
              <div className="ml-7 rounded-sm border border-route-default/30 bg-route-default/5 px-3 py-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-label text-route-default">
                    {studioUi().qosTitle}
                  </p>
                  <button
                    type="button"
                    disabled={!rawRule || !hasQosSuggestion}
                    onClick={() => {
                      if (!rawRule || !hasQosSuggestion) return;
                      dispatch(
                        updateAclRuleQoS({
                          id: rule.aclRuleId,
                          ...qosSuggestion,
                        }),
                      );
                    }}
                    className="rounded-sm border border-route-default/50 bg-route-default/15 px-2 py-0.5 text-2xs text-route-default hover:bg-route-default/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {studioUi().applySuggestion}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-2xs">
                  {/* Classe de Tráfego */}
                  <div>
                    <label className="mb-0.5 block text-2xs text-chalk-faint">
                      {studioUi().trafficClass}
                    </label>
                    <select
                      value={rawRule?.trafficClass ?? ''}
                      onChange={(e) =>
                        dispatch(
                          updateAclRuleQoS({
                            id: rule.aclRuleId,
                            trafficClass: (e.target.value ||
                              undefined) as Parameters<
                              typeof updateAclRuleQoS
                            >[0] extends { trafficClass?: infer T }
                              ? T
                              : never,
                          }),
                        )
                      }
                      className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                    >
                      <option value="">{studioUi().defaultOption}</option>
                      <option value="critical">Critical</option>
                      <option value="voice">Voice</option>
                      <option value="video">Video</option>
                      <option value="bulk">Bulk</option>
                      <option value="best-effort">Best-effort</option>
                    </select>
                  </div>
                  {/* DSCP Mark */}
                  <div>
                    <label className="mb-0.5 block text-2xs text-chalk-faint">
                      DSCP Mark (0–63)
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={0}
                        max={63}
                        value={rawRule?.dscpMark ?? ''}
                        onChange={(e) =>
                          dispatch(
                            updateAclRuleQoS({
                              id: rule.aclRuleId,
                              dscpMark:
                                e.target.value !== ''
                                  ? Number(e.target.value)
                                  : undefined,
                            }),
                          )
                        }
                        placeholder="Ex: 46"
                        className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 font-mono text-2xs text-chalk placeholder-chalk-faint"
                      />
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value !== '')
                            dispatch(
                              updateAclRuleQoS({
                                id: rule.aclRuleId,
                                dscpMark: Number(e.target.value),
                              }),
                            );
                        }}
                        className="rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk-dim"
                      >
                        <option value="">Preset</option>
                        <option value="46">EF=46</option>
                        <option value="34">AF41=34</option>
                        <option value="26">AF31=26</option>
                        <option value="18">AF21=18</option>
                        <option value="0">CS0=0</option>
                      </select>
                    </div>
                  </div>
                  {/* Banda Garantida */}
                  <div>
                    <label className="mb-0.5 block text-2xs text-chalk-faint">
                      Banda Garantida (kbps)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={rawRule?.guaranteedBwKbps ?? ''}
                      onChange={(e) =>
                        dispatch(
                          updateAclRuleQoS({
                            id: rule.aclRuleId,
                            guaranteedBwKbps:
                              e.target.value !== ''
                                ? Number(e.target.value)
                                : undefined,
                          }),
                        )
                      }
                      placeholder="Ex: 1000"
                      className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 font-mono text-2xs text-chalk placeholder-chalk-faint"
                    />
                  </div>
                  {/* Banda Máxima */}
                  <div>
                    <label className="mb-0.5 block text-2xs text-chalk-faint">
                      Banda Máxima (kbps)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={rawRule?.maxBwKbps ?? ''}
                      onChange={(e) =>
                        dispatch(
                          updateAclRuleQoS({
                            id: rule.aclRuleId,
                            maxBwKbps:
                              e.target.value !== ''
                                ? Number(e.target.value)
                                : undefined,
                          }),
                        )
                      }
                      placeholder="Ex: 5000"
                      className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 font-mono text-2xs text-chalk placeholder-chalk-faint"
                    />
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
        {/* Expansion row */}
        {isExpandable && (
          <tr>
            <td colSpan={7} className="p-0">
              <div
                className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[600px]' : 'max-h-0'}`}
              >
                <div className="ml-7 rounded-sm border border-line bg-ink-raised-2">
                  <div className="flex gap-2 border-b border-line px-2 py-1.5">
                    <div className="flex flex-1 items-center gap-1">
                      <span className="shrink-0 text-2xs text-chalk-faint">
                        Origem:
                      </span>
                      <input
                        value={filter.origin}
                        onChange={(e) =>
                          setFilterValue(
                            rule.aclRuleId,
                            'origin',
                            e.target.value,
                          )
                        }
                        placeholder="filtrar IP / host…"
                        className="w-full rounded-sm border border-line bg-ink px-1.5 py-0.5 text-2xs text-chalk placeholder-chalk-faint outline-none focus:border-signal-warn/60"
                      />
                    </div>
                    <div className="flex flex-1 items-center gap-1">
                      <span className="shrink-0 text-2xs text-chalk-faint">
                        Destino:
                      </span>
                      <input
                        value={filter.dest}
                        onChange={(e) =>
                          setFilterValue(rule.aclRuleId, 'dest', e.target.value)
                        }
                        placeholder="filtrar IP / host…"
                        className="w-full rounded-sm border border-line bg-ink px-1.5 py-0.5 text-2xs text-chalk placeholder-chalk-faint outline-none focus:border-signal-warn/60"
                      />
                    </div>
                    {(filter.origin || filter.dest) && (
                      <RemoveButton
                        onClick={() =>
                          setExpansionFilters((prev) => ({
                            ...prev,
                            [rule.aclRuleId]: { origin: '', dest: '' },
                          }))
                        }
                        label={studioUi().clearFilters}
                      />
                    )}
                  </div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-left text-2xs text-chalk-faint">
                        <th className="w-6 px-2 py-0.5">#</th>
                        <th className="w-[100px] px-2 py-0.5">Ação</th>
                        <th className="px-2 py-0.5">Origem</th>
                        <th className="px-2 py-0.5">Destino</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-2 py-1 text-2xs text-chalk-faint"
                          >
                            Nenhum resultado para os filtros aplicados.
                          </td>
                        </tr>
                      )}
                      {filteredRows.map((row, rowIdx) => {
                        const childOverrideAction = getChildAction(
                          row.id,
                          rule.acao,
                          rule.aclRuleId,
                        );
                        const hasOverride = childOverrideAction !== rule.acao;
                        return (
                          <tr
                            key={row.id}
                            className={`hover:bg-ink-raised-2 ${hasOverride ? 'bg-signal-down/10' : ''}`}
                          >
                            <td className="px-2 py-0.5 text-2xs text-chalk-faint">
                              {rowIdx + 1}
                            </td>
                            <td className="px-2 py-0.5">
                              <select
                                value={childOverrideAction}
                                onChange={(e) =>
                                  setChildAction(
                                    rule.aclRuleId,
                                    row.id,
                                    e.target.value as AclAction,
                                    rule.acao,
                                  )
                                }
                                className={`w-full rounded-sm border px-1 py-0.5 text-2xs text-chalk ${
                                  hasOverride
                                    ? 'border-signal-down/60 bg-signal-down/15 font-semibold text-signal-down'
                                    : 'border-line bg-ink'
                                }`}
                              >
                                <option value="ALLOW">ALLOW</option>
                                <option value="DENY">DENY</option>
                              </select>
                            </td>
                            <td className="px-2 py-0.5">
                              <TruncatedValueTooltip
                                value={row.origem}
                                maxWidthClass="max-w-[200px]"
                                className="font-mono text-2xs text-chalk-dim"
                              />
                            </td>
                            <td className="px-2 py-0.5">
                              <TruncatedValueTooltip
                                value={row.destino}
                                maxWidthClass="max-w-[200px]"
                                className="font-mono text-2xs text-chalk-dim"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredRows.length > 0 && (
                    <p className="px-2 py-1 text-2xs text-chalk-faint">
                      {filteredRows.length} de {expansionRows.length} alocaç
                      {expansionRows.length === 1 ? 'ão' : 'ões'}
                    </p>
                  )}
                </div>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const manualGrouped = groupFlat(manualRules);
  const topologyGrouped = groupFlat(topologyRules);
  const natGrouped = groupFlat(natExemptRules);

  const firewallZoneB = (
    <>
      <ZoneHeader
        label={studioUi().manualExceptions}
        count={manualGrouped.length}
        color="text-route-vpn"
      />
      {manualGrouped.length === 0 && (
        <tr>
          <td
            colSpan={7}
            className="px-2 py-1.5 text-2xs text-chalk-faint italic"
          >
            {studioUi().noManualRules}
          </td>
        </tr>
      )}
      {manualGrouped.map(({ parent, children }, idx) =>
        renderRuleGroup(
          parent,
          children,
          idx,
          manualGrouped.length,
          true,
          manualGrouped,
        ),
      )}
    </>
  );

  const firewallZoneA = (
    <>
      <ZoneHeader
        label="Regras de topologia (Zona A)"
        count={topologyGrouped.length}
        color="text-signal-down"
      />
      {topologyGrouped.length === 0 && (
        <tr>
          <td
            colSpan={7}
            className="px-2 py-1.5 text-2xs text-chalk-faint italic"
          >
            {studioUi().noTopologyRules}
          </td>
        </tr>
      )}
      {topologyGrouped.map(({ parent, children }, idx) =>
        renderRuleGroup(
          parent,
          children,
          idx,
          topologyGrouped.length,
          false,
          [],
        ),
      )}
    </>
  );

  return [
    {
      id: 'rotas',
      label: copy.routeTableTitle,
      content: (
        // ── Linha 1: Tabela de Rotas (largura total) ───────────────────────
        <div className="rounded-md border border-line bg-ink-raised p-3">
          <h3 className="mb-2 font-display text-heading font-semibold text-chalk">
            {copy.routeTableTitle}
          </h3>
          <div className="theme-scrollbar h-[280px] overflow-x-auto overflow-y-auto text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-chalk-dim">
                  <th className="border-b border-line px-1 py-1">
                    {copy.type}
                  </th>
                  <th className="border-b border-line px-1 py-1">VLAN</th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.destinationNetwork}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.destinationNetworkIpv6}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    <HeaderInfoTooltip label={copy.gateway}>
                      <strong className="mb-1 block text-signal-warn">
                        {copy.routeGatewayByType}
                      </strong>
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr className="border-b border-line">
                            <td className="py-0.5 pr-2 font-semibold text-signal-up">
                              {copy.routeTypeDirect}
                            </td>
                            <td className="py-0.5 text-chalk-dim">
                              — {copy.routeHelpDirect}
                            </td>
                          </tr>
                          <tr className="border-b border-line">
                            <td className="py-0.5 pr-2 font-semibold text-route-default">
                              {copy.routeTypeDefault}
                            </td>
                            <td className="py-0.5 text-chalk-dim">
                              {copy.routeHelpDefault}
                            </td>
                          </tr>
                          <tr className="border-b border-line">
                            <td className="py-0.5 pr-2 font-semibold text-chalk">
                              {copy.routeTypeVpn}
                            </td>
                            <td className="py-0.5 text-chalk-dim">
                              {copy.routeHelpVpn}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-0.5 pr-2 font-semibold text-signal-warn">
                              {copy.routeTypeStatic}
                            </td>
                            <td className="py-0.5 text-chalk-dim">
                              {copy.routeHelpStatic}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </HeaderInfoTooltip>
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.gatewayIpv6}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    <HeaderInfoTooltip label={copy.interface}>
                      <strong className="mb-1 block text-signal-warn">
                        {copy.interfaceDynamicNumbering}
                      </strong>
                      {copy.interfaceHelpLine1}
                      <br />
                      {copy.interfaceHelpLine2}
                      <br />
                      {copy.interfaceHelpLine3}
                    </HeaderInfoTooltip>
                  </th>
                  <th className="w-[90px] border-b border-line px-1 py-1 text-chalk-dim">
                    {studioUi().networkColumn}
                  </th>
                  <th className="w-[70px] border-b border-line px-1 py-1 text-chalk-dim">
                    {studioUi().zoneColumn}
                  </th>
                </tr>
              </thead>
              <tbody>
                {routes.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-1 py-2 text-chalk-faint">
                      {copy.emptyRoutes}
                    </td>
                  </tr>
                )}
                {groupRoutesBySite(routes).map((group) => (
                  <Fragment key={`group-${group.siteId}`}>
                    <tr>
                      <td
                        colSpan={9}
                        className="bg-ink-raised-2 px-2 py-1 font-semibold text-chalk border-b border-line-strong border-t border-line-strong"
                      >
                        <MapPin
                          size={12}
                          className="mr-1 inline-block -translate-y-px"
                          aria-hidden="true"
                        />
                        {group.siteName}
                      </td>
                    </tr>
                    {group.rows.map((route, i) => (
                      <tr
                        key={`${group.siteId}-${i}`}
                        className="hover:bg-ink-raised-2"
                      >
                        <td className="border-b border-line px-1 py-1">
                          <span
                            className={`font-medium ${ROUTE_TYPE_CLASS[route.tipo] ?? 'text-chalk-dim'}`}
                          >
                            {routeTypeLabels[route.tipo] ?? route.tipo}
                          </span>
                        </td>
                        <td className="border-b border-line px-1 py-1 font-mono text-chalk-dim">
                          {route.vlan}
                        </td>
                        <td className="border-b border-line px-1 py-1 font-mono text-chalk">
                          {route.redeDest}
                        </td>
                        <td className="border-b border-line px-1 py-1 font-mono text-chalk">
                          {route.redeDestIpv6 || '-'}
                        </td>
                        <td className="border-b border-line px-1 py-1 font-mono text-chalk-dim">
                          {route.gateway}
                        </td>
                        <td className="border-b border-line px-1 py-1 font-mono text-chalk">
                          {route.gatewayIpv6 || '-'}
                        </td>
                        <td className="border-b border-line px-1 py-1 text-chalk-dim">
                          {route.iface}
                        </td>
                        <td className="border-b border-line px-1 py-1 text-chalk-dim">
                          {route.networkName}
                        </td>
                        <td className="border-b border-line px-1 py-1">
                          <span
                            className={`rounded-sm px-1 py-0.5 text-2xs font-semibold uppercase ${
                              route.zone === 'wan'
                                ? 'bg-route-default/15 text-route-default'
                                : route.zone === 'vpn'
                                  ? 'bg-ink-raised-2 text-chalk'
                                  : route.zone === 'dmz'
                                    ? 'bg-signal-warn/15 text-signal-warn'
                                    : route.zone === 'lan'
                                      ? 'bg-signal-up/15 text-signal-up'
                                      : 'bg-ink-raised-2 text-chalk-dim'
                            }`}
                          >
                            {route.zone}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td
                        colSpan={9}
                        className="border-b border-line px-2 py-1 text-2xs text-chalk-dim"
                      >
                        {copy.otherIps}:{' '}
                        {getSiteOtherIps(group.siteId, group.rows, sites)}
                        {' | '}
                        {copy.reserveSummary}:{' '}
                        {group.rows[0]?.reserveMarginPercent ?? 0}%
                        {group.rows[0]?.reservedSiteRange
                          ? ` (${copy.reserveRange}: ${group.rows[0].reservedSiteRange}, ${group.rows[0].reservedSiteCount})`
                          : ''}
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: 'vlan-subnet',
      label: copy.vlanSubnetRouteTableTitle,
      content: (
        <div className="rounded-md border border-line bg-ink-raised p-3">
          <h3 className="mb-2 font-display text-heading font-semibold text-chalk">
            {copy.vlanSubnetRouteTableTitle}
          </h3>
          <div className="theme-scrollbar h-[240px] overflow-x-auto overflow-y-auto text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-chalk-dim">
                  <th className="border-b border-line px-1 py-1">VLAN</th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.subnetName}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.destinationNetwork}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.destinationNetworkIpv6}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.gateway}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.gatewayIpv6}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.gatewayNode}
                  </th>
                </tr>
              </thead>
              <tbody>
                {subnetRouteGroups.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-1 py-2 text-chalk-faint">
                      {copy.emptyVlanSubnetRoutes}
                    </td>
                  </tr>
                )}
                {subnetRouteGroups.map((siteGroup) => (
                  <Fragment key={`subnet-site-${siteGroup.siteId}`}>
                    <tr>
                      <td
                        colSpan={7}
                        className="border-b border-t border-line-strong bg-ink-raised-2 px-2 py-1 font-semibold text-chalk"
                      >
                        <MapPin
                          size={12}
                          className="mr-1 inline-block -translate-y-px"
                          aria-hidden="true"
                        />
                        {siteGroup.siteName}
                      </td>
                    </tr>
                    {siteGroup.vlans.flatMap((vlanGroup) => [
                      <tr
                        key={`subnet-vlan-${siteGroup.siteId}-${vlanGroup.vlanId}`}
                        className="bg-ink/60"
                      >
                        <td
                          colSpan={7}
                          className="border-b border-line px-2 py-1 font-semibold text-chalk"
                        >
                          VLAN {vlanGroup.vlanId} - {vlanGroup.vlanName}
                        </td>
                      </tr>,
                      ...vlanGroup.subnets.flatMap(
                        (subnetGroup, subnetIndex) => [
                          <tr
                            key={`subnet-group-${siteGroup.siteId}-${vlanGroup.vlanId}-${subnetIndex}`}
                            className="bg-ink/30"
                          >
                            <td
                              colSpan={7}
                              className="border-b border-line px-3 py-1 text-label text-route-vpn"
                            >
                              {copy.subnetName}: {subnetGroup.subnetName}
                            </td>
                          </tr>,
                          ...subnetGroup.rows.map((route, rowIndex) => (
                            <tr
                              key={`subnet-row-${siteGroup.siteId}-${vlanGroup.vlanId}-${subnetIndex}-${rowIndex}`}
                              className="hover:bg-ink-raised-2"
                            >
                              <td className="border-b border-line px-1 py-1 font-mono text-chalk-dim">
                                {route.vlanId}
                              </td>
                              <td className="border-b border-line px-1 py-1 text-chalk-dim">
                                {route.subnetName || '-'}
                              </td>
                              <td className="border-b border-line px-1 py-1 font-mono text-chalk">
                                {route.destination}
                              </td>
                              <td className="border-b border-line px-1 py-1 font-mono text-chalk">
                                {route.destinationIpv6 || '-'}
                              </td>
                              <td className="border-b border-line px-1 py-1 font-mono text-chalk-dim">
                                {route.gateway || '-'}
                              </td>
                              <td className="border-b border-line px-1 py-1 font-mono text-chalk">
                                {route.gatewayIpv6 || '-'}
                              </td>
                              <td className="border-b border-line px-1 py-1 text-chalk-dim">
                                {route.gatewayNodeLabel || '-'}
                              </td>
                            </tr>
                          )),
                        ],
                      ),
                    ])}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: 'firewall',
      label: copy.firewallTitle,
      content: (
        // ── Firewall / ACL ─────────────────────────────────────────────────
        <div className="rounded-md border border-line bg-ink-raised p-3">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-heading font-semibold text-chalk">
              {copy.firewallTitle}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setManualZoneFirst((v) => !v)}
                title={studioUi().toggleExceptionsPosition}
                className="rounded-sm border border-line-strong bg-ink-raised-2 px-2 py-0.5 text-2xs text-chalk-dim hover:border-line-strong hover:text-chalk"
              >
                {manualZoneFirst
                  ? studioUi().exceptionsBefore
                  : studioUi().exceptionsAfter}
                {manualZoneFirst ? (
                  <ChevronDown
                    size={12}
                    aria-hidden="true"
                    className="inline-block"
                  />
                ) : (
                  <ChevronUp
                    size={12}
                    className="inline-block"
                    aria-hidden="true"
                  />
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowCreator((v) => !v)}
                className="rounded-sm border border-route-vpn/60 bg-route-vpn/15 px-2 py-0.5 text-2xs text-route-vpn hover:bg-route-vpn/15 hover:text-route-vpn"
              >
                {showCreator ? studioUi().cancel : studioUi().newRule}
              </button>
            </div>
          </div>

          {/* Custom rule creator */}
          {showCreator && (
            <div className="mb-2 rounded-sm border border-route-vpn/40 bg-route-vpn/15 p-2 text-2xs">
              <p className="mb-1.5 font-semibold text-route-vpn">
                {studioUi().newManualRule}
              </p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-chalk-dim">
                    {studioUi().sourceNode}
                  </span>
                  <TreePicker
                    nodes={nodes}
                    siteVlans={siteVlans}
                    sites={sites}
                    value={newSrcNodeId}
                    onChange={setNewSrcNodeId}
                    placeholder="— selecione origem —"
                    excludeNodeId={newDstNodeId}
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-chalk-dim">
                    {studioUi().destinationNode}
                  </span>
                  <TreePicker
                    nodes={nodes}
                    siteVlans={siteVlans}
                    sites={sites}
                    value={newDstNodeId}
                    onChange={setNewDstNodeId}
                    placeholder="— selecione destino —"
                    excludeNodeId={newSrcNodeId}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-chalk-dim">Serviço</span>
                  <ServicePicker value={newService} onChange={setNewService} />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-chalk-dim">Protocolo</span>
                  <select
                    value={newProtocol}
                    onChange={(e) =>
                      setNewProtocol(
                        e.target.value as 'tcp' | 'udp' | 'icmp' | 'any',
                      )
                    }
                    className="rounded-sm border border-line-strong bg-ink-raised-2 px-1 py-1 text-chalk"
                  >
                    <option value="any">Qualquer</option>
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="icmp">ICMP</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-chalk-dim">Ação</span>
                  <select
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value as AclAction)}
                    className="rounded-sm border border-line-strong bg-ink-raised-2 px-1 py-1 text-chalk"
                  >
                    <option value="ALLOW">ALLOW</option>
                    <option value="DENY">DENY</option>
                  </select>
                </label>
                <div className="flex flex-col gap-1 pt-3">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={newStateful}
                      onChange={(e) => setNewStateful(e.target.checked)}
                      className="h-3 w-3 accent-[var(--accent)]"
                    />
                    <span className="text-chalk-dim">Stateful</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={newBidirectional}
                      onChange={(e) => setNewBidirectional(e.target.checked)}
                      className="h-3 w-3 accent-[var(--accent)]"
                    />
                    <span className="text-chalk-dim">Bidirecional</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreator(false)}
                  className="rounded-sm border border-line-strong px-2 py-1 text-2xs text-chalk-dim hover:text-chalk"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomRule}
                  disabled={!newSrcNodeId || !newDstNodeId}
                  className="rounded-sm border border-route-vpn/60 bg-route-vpn/15 px-2 py-1 text-2xs text-route-vpn hover:bg-route-vpn/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}

          <div className="theme-scrollbar h-[400px] overflow-x-auto overflow-y-auto text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-chalk-dim">
                  <th className="w-7 border-b border-line px-1 py-1 text-center" />
                  <th
                    className="w-[42px] border-b border-line px-1 py-1 text-center"
                    title={studioUi().priorityHint}
                  >
                    Prio
                  </th>
                  <th className="w-[60px] border-b border-line px-1 py-1 text-center">
                    {copy.action}
                  </th>
                  <th className="w-[140px] border-b border-line px-1 py-1 text-center">
                    {copy.source}
                  </th>
                  <th className="w-[140px] border-b border-line px-1 py-1 text-center">
                    {copy.destination}
                  </th>
                  <th className="w-[120px] border-b border-line px-1 py-1 text-center">
                    {copy.portService}
                  </th>
                  <th className="w-[160px] border-b border-line px-1 py-1 text-center">
                    Flags
                  </th>
                </tr>
              </thead>
              <tbody>
                {manualGrouped.length === 0 &&
                  topologyGrouped.length === 0 &&
                  natGrouped.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-1 py-2 text-chalk-faint">
                        {copy.emptyRules}
                      </td>
                    </tr>
                  )}

                {manualZoneFirst ? (
                  <>
                    {firewallZoneB}
                    {firewallZoneA}
                  </>
                ) : (
                  <>
                    {firewallZoneA}
                    {firewallZoneB}
                  </>
                )}

                {natGrouped.length > 0 && (
                  <>
                    <ZoneHeader
                      label="NAT Exempt"
                      count={natGrouped.length}
                      color="text-signal-up"
                    />
                    {natGrouped.map(({ parent, children }, idx) =>
                      renderRuleGroup(
                        parent,
                        children,
                        idx,
                        natGrouped.length,
                        false,
                        [],
                      ),
                    )}
                  </>
                )}

                {/* Implicit deny footer */}
                <tr className="bg-signal-down/10">
                  <td colSpan={2} className="border-t border-line px-1 py-1" />
                  <td className="border-t border-line px-1 py-1">
                    <span className="rounded-sm bg-signal-down/15 px-1 py-0.5 text-2xs text-signal-down font-semibold">
                      DENY
                    </span>
                  </td>
                  <td className="border-t border-line px-1 py-1 text-2xs text-chalk-faint">
                    any
                  </td>
                  <td className="border-t border-line px-1 py-1 text-2xs text-chalk-faint">
                    any
                  </td>
                  <td className="border-t border-line px-1 py-1 text-2xs text-chalk-faint">
                    *
                  </td>
                  <td className="border-t border-line px-1 py-1 text-2xs text-chalk-faint italic">
                    implicit deny
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* fim card firewall */}
        </div>
      ),
    },
    {
      id: 'protocolo',
      label: studioUi().routingProtocolsTab,
      content: <RoutingProtocolTable language={language} />,
    },
    {
      id: 'dhcp',
      label: copy.dhcpContainerTitle,
      content: (
        <div className="rounded-md border border-line bg-ink-raised p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-heading font-semibold text-chalk">
              {copy.dhcpContainerTitle}
            </h3>
            <div className="flex flex-wrap items-center gap-1">
              <span className="rounded-sm border border-line bg-ink/60 px-2 py-0.5 text-2xs text-chalk-dim">
                {copy.dhcpSummaryTotal}: {dhcpSummary.total}
              </span>
              <span className="rounded-sm border border-signal-warn/40 bg-signal-warn/10 px-2 py-0.5 text-2xs text-signal-warn">
                {copy.dhcpSummaryPending}: {dhcpSummary.pending}
              </span>
              <span className="rounded-sm border border-signal-up/40 bg-signal-up/10 px-2 py-0.5 text-2xs text-signal-up">
                {copy.dhcpSummaryConfigured}: {dhcpSummary.configured}
              </span>
              <button
                type="button"
                onClick={() => setShowDhcpPendingOnly((prev) => !prev)}
                className="rounded-sm border border-line-strong bg-ink-raised-2 px-2 py-0.5 text-2xs text-chalk hover:bg-accent/15"
              >
                {showDhcpPendingOnly
                  ? copy.dhcpFilterAll
                  : copy.dhcpFilterPending}
              </button>
            </div>
          </div>
          <div className="theme-scrollbar h-[230px] overflow-x-auto overflow-y-auto text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-chalk-dim">
                  <th className="border-b border-line px-1 py-1">
                    {copy.dhcpColumnSite}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.dhcpColumnVlan}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.dhcpColumnAllocation}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.dhcpColumnProvider}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.dhcpColumnServerRelay}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.dhcpColumnPool}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.dhcpColumnIpv6Policy}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.dhcpColumnLease}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.dhcpColumnDns}
                  </th>
                  <th className="border-b border-line px-1 py-1">
                    {copy.dhcpColumnChangeRequired}
                  </th>
                </tr>
              </thead>
              <tbody>
                {dhcpVisibleRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-1 py-2 text-chalk-faint">
                      {copy.dhcpEmpty}
                    </td>
                  </tr>
                )}
                {dhcpVisibleRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-ink-raised-2 ${
                      row.status === 'pending'
                        ? 'bg-signal-warn/10'
                        : row.status === 'ok'
                          ? 'bg-signal-up/10'
                          : ''
                    }`}
                  >
                    <td className="border-b border-line px-1 py-1 align-middle">
                      <TruncatedValueTooltip
                        value={row.siteName}
                        maxWidthClass="max-w-[96px]"
                        className="text-chalk"
                      />
                    </td>
                    <td className="border-b border-line px-1 py-1 align-middle">
                      <TruncatedValueTooltip
                        value={row.vlanLabel}
                        maxWidthClass="max-w-[150px]"
                        className="text-chalk"
                      />
                    </td>
                    <td className="border-b border-line px-1 py-1 align-middle">
                      <TruncatedValueTooltip
                        value={row.allocationLabel}
                        maxWidthClass="max-w-[120px]"
                        className="text-chalk-dim"
                      />
                    </td>
                    <td className="border-b border-line px-1 py-1 text-chalk-dim">
                      {isStaticAllocation(
                        row.vlan.addressAllocation ?? 'dhcpv4',
                      ) ? (
                        <span className="text-chalk-faint">-</span>
                      ) : (
                        <select
                          value={row.scope?.providerType ?? 'node'}
                          onChange={(event) => {
                            const providerType = event.target.value as
                              | 'node'
                              | 'relay'
                              | 'external';
                            updateDhcpScope(row.vlan, {
                              providerType,
                              providerNodeId:
                                providerType === 'node'
                                  ? row.scope?.providerNodeId
                                  : undefined,
                              relayNodeId:
                                providerType === 'relay'
                                  ? row.scope?.relayNodeId
                                  : undefined,
                            });
                          }}
                          className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                        >
                          <option value="node">{copy.dhcpProviderNode}</option>
                          <option value="relay">
                            {copy.dhcpProviderRelay}
                          </option>
                          <option value="external">
                            {copy.dhcpProviderExternal}
                          </option>
                        </select>
                      )}
                    </td>
                    <td className="border-b border-line px-1 py-1 font-mono text-2xs text-chalk-dim">
                      {isStaticAllocation(
                        row.vlan.addressAllocation ?? 'dhcpv4',
                      ) ? (
                        <span className="text-chalk-faint">-</span>
                      ) : row.scope?.providerType === 'external' ? (
                        <span className="text-chalk-faint">-</span>
                      ) : (
                        <select
                          value={
                            row.scope?.providerType === 'relay'
                              ? (row.scope?.relayNodeId ?? '')
                              : (row.scope?.providerNodeId ?? '')
                          }
                          onChange={(event) => {
                            const nextId = event.target.value || undefined;
                            if (
                              (row.scope?.providerType ?? 'node') === 'relay'
                            ) {
                              updateDhcpScope(row.vlan, {
                                relayNodeId: nextId,
                              });
                            } else {
                              updateDhcpScope(row.vlan, {
                                providerNodeId: nextId,
                              });
                            }
                          }}
                          className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                        >
                          <option value="">-</option>
                          {nodes
                            .filter(
                              (node) =>
                                node.siteId === row.siteId &&
                                node.category !== 'wan',
                            )
                            .map((node) => (
                              <option key={node.id} value={node.id}>
                                {node.label} ({node.ip})
                              </option>
                            ))}
                        </select>
                      )}
                    </td>
                    <td className="border-b border-line px-1 py-1 font-mono text-2xs text-chalk-dim">
                      {isStaticAllocation(
                        row.vlan.addressAllocation ?? 'dhcpv4',
                      ) || !row.requiresPool ? (
                        <span className="text-chalk-faint">-</span>
                      ) : (
                        <div className="flex min-w-[210px] gap-1">
                          <input
                            defaultValue={
                              row.scope?.poolStartIp ?? row.vlan.startIp
                            }
                            onBlur={(event) =>
                              updateDhcpScope(row.vlan, {
                                poolStartIp:
                                  event.target.value.trim() || row.vlan.startIp,
                              })
                            }
                            className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                          />
                          <input
                            defaultValue={
                              row.scope?.poolEndIp ?? row.vlan.endIp
                            }
                            onBlur={(event) =>
                              updateDhcpScope(row.vlan, {
                                poolEndIp:
                                  event.target.value.trim() || row.vlan.endIp,
                              })
                            }
                            className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                          />
                        </div>
                      )}
                    </td>
                    <td className="border-b border-line px-1 py-1 text-chalk-dim">
                      {isStaticAllocation(
                        row.vlan.addressAllocation ?? 'dhcpv4',
                      ) ? (
                        <span className="text-chalk-faint">-</span>
                      ) : (
                        <select
                          value={
                            row.scope?.ipv6Mode ??
                            defaultIpv6ModeByAllocation(
                              row.vlan.addressAllocation ?? 'dhcpv4',
                            )
                          }
                          onChange={(event) =>
                            updateDhcpScope(row.vlan, {
                              ipv6Mode: event.target.value as DhcpScopeIpv6Mode,
                            })
                          }
                          className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                        >
                          <option value="none">none</option>
                          <option value="slaac">slaac</option>
                          <option value="dhcpv6-stateless">
                            dhcpv6-stateless
                          </option>
                          <option value="dhcpv6-stateful">
                            dhcpv6-stateful
                          </option>
                        </select>
                      )}
                    </td>
                    <td className="border-b border-line px-1 py-1 text-chalk-dim">
                      {isStaticAllocation(
                        row.vlan.addressAllocation ?? 'dhcpv4',
                      ) ? (
                        <span className="text-chalk-faint">-</span>
                      ) : (
                        <input
                          type="number"
                          min={1}
                          max={43200}
                          defaultValue={row.scope?.leaseMinutes ?? 1440}
                          onBlur={(event) => {
                            const value = Number(event.target.value);
                            if (!Number.isFinite(value)) return;
                            updateDhcpScope(row.vlan, {
                              leaseMinutes: Math.max(
                                1,
                                Math.min(43200, Math.trunc(value)),
                              ),
                            });
                          }}
                          className="w-[86px] rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                        />
                      )}
                    </td>
                    <td className="border-b border-line px-1 py-1 text-chalk-dim">
                      {isStaticAllocation(
                        row.vlan.addressAllocation ?? 'dhcpv4',
                      ) ? (
                        <span className="text-chalk-faint">-</span>
                      ) : (
                        <div className="min-w-[200px] space-y-1">
                          <input
                            defaultValue={row.dnsV4.join(', ')}
                            onBlur={(event) =>
                              updateDhcpScope(row.vlan, {
                                dnsServers: normalizeList(event.target.value),
                              })
                            }
                            placeholder={copy.dhcpDnsV4Placeholder}
                            className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                          />
                          <input
                            defaultValue={row.dnsV6.join(', ')}
                            onBlur={(event) =>
                              updateDhcpScope(row.vlan, {
                                ipv6DnsServers: normalizeList(
                                  event.target.value,
                                ),
                              })
                            }
                            placeholder={copy.dhcpDnsV6Placeholder}
                            className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                          />
                        </div>
                      )}
                    </td>
                    <td className="border-b border-line px-1 py-1 align-middle">
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                        <div className="flex w-full justify-center">
                          <TruncatedValueTooltip
                            value={row.changeRequired}
                            maxWidthClass="max-w-[170px]"
                            className="mx-auto text-center text-2xs !text-signal-warn"
                          />
                        </div>

                        {!isStaticAllocation(
                          row.vlan.addressAllocation ?? 'dhcpv4',
                        ) && (
                          <div className="flex items-center justify-center gap-1">
                            <IconActionTooltipButton
                              icon={<Check size={11} aria-hidden="true" />}
                              tooltip={copy.dhcpActionApplyProposal}
                              ariaLabel={copy.dhcpActionApplyProposal}
                              className="border-line-strong bg-ink-raised-2 text-chalk hover:bg-accent/15"
                              onClick={() => applyDhcpProposal(row.vlan)}
                            />

                            <IconActionTooltipButton
                              icon={<RotateCcw size={11} aria-hidden="true" />}
                              tooltip={copy.dhcpActionRestoreDns}
                              ariaLabel={copy.dhcpActionRestoreDns}
                              className="border-line-strong bg-ink-raised-2 text-chalk hover:bg-accent/15"
                              onClick={() =>
                                updateDhcpScope(row.vlan, {
                                  dnsServers: suggestDnsForVlan(row.vlan)
                                    .dnsServers,
                                  ipv6DnsServers: suggestDnsForVlan(row.vlan)
                                    .ipv6DnsServers,
                                })
                              }
                            />

                            {row.hasScope && (
                              <IconActionTooltipButton
                                icon={<X size={11} aria-hidden="true" />}
                                tooltip={copy.dhcpActionRemoveScope}
                                ariaLabel={copy.dhcpActionRemoveScope}
                                className="border-signal-down/40 bg-signal-down/10 text-signal-down hover:bg-signal-down/15"
                                onClick={() =>
                                  dispatch(
                                    removeDhcpScope({
                                      siteId: row.vlan.siteId,
                                      vlanId: row.vlan.vlanId,
                                    }),
                                  )
                                }
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: 'qos',
      label: 'QoS',
      content:
        // ── P16 — QoS Profile — Filas de Scheduling ───────────────────────────
        (() => {
          const qosNodes = nodes.filter(
            (n) =>
              n.category === 'router' ||
              n.category === 'firewall' ||
              n.category === 'switch',
          );
          const activeNode =
            qosNodes.find((n) => n.id === qosSelectedNodeId) ??
            qosNodes[0] ??
            null;
          const profile = activeNode
            ? nodeQosProfiles.find((p) => p.nodeId === activeNode.id)
            : null;
          const queues = profile?.queues ?? [];
          const sumBw = queues.reduce(
            (acc, q) => acc + (q.minBandwidthPercent ?? 0),
            0,
          );
          const strictCount = queues.filter(
            (q) => q.priority === 'strict',
          ).length;
          const hasBestEffort = queues.some(
            (q) => q.priority === 'best-effort',
          );

          return (
            <div className="rounded-md border border-line bg-ink-raised p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-display text-heading font-semibold text-chalk">
                  QoS profile — filas de scheduling
                </h3>
                {qosNodes.length > 1 && (
                  <select
                    value={activeNode?.id ?? ''}
                    onChange={(e) => {
                      setQosSelectedNodeId(e.target.value);
                      setQosFormName('');
                      setQosFormMinBw('');
                      setQosFormPriority('best-effort');
                      setQosFormClass('default');
                    }}
                    className="rounded-sm border border-line-strong bg-ink-raised-2 px-1.5 py-0.5 text-2xs text-chalk"
                  >
                    {qosNodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label || n.id}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {!activeNode && (
                <p className="text-2xs italic text-chalk-faint">
                  Nenhum roteador, firewall ou switch no diagrama.
                </p>
              )}

              {activeNode && (
                <>
                  {/* Warnings */}
                  {sumBw > 100 && (
                    <p className="mb-1 rounded-sm bg-signal-down/15 px-1.5 py-0.5 text-2xs text-signal-down">
                      <AlertTriangle
                        size={12}
                        className="mr-1 inline-block -translate-y-px"
                        aria-hidden="true"
                      />
                      Soma de % mínima ({sumBw}%) excede 100%.
                    </p>
                  )}
                  {strictCount > 1 && (
                    <p className="mb-1 rounded-sm bg-signal-warn/15 px-1.5 py-0.5 text-2xs text-signal-warn">
                      <AlertTriangle
                        size={12}
                        className="mr-1 inline-block -translate-y-px"
                        aria-hidden="true"
                      />
                      {studioUi().multipleStrictQueues}
                    </p>
                  )}
                  {queues.length > 0 && !hasBestEffort && (
                    <p className="mb-1 rounded-sm bg-ink-raised-2 px-1.5 py-0.5 text-2xs text-chalk-faint">
                      {studioUi().addBestEffortQueue}
                    </p>
                  )}

                  {/* Lista de filas */}
                  {queues.length === 0 && (
                    <p className="mb-2 text-2xs italic text-chalk-faint">
                      Nenhuma fila configurada para{' '}
                      {activeNode.label || activeNode.id}.
                    </p>
                  )}
                  <div className="mb-3 space-y-1">
                    {queues.map((q) => (
                      <div
                        key={q.id}
                        className="rounded-sm border border-line bg-ink-raised-2 px-2 py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex-1 font-mono text-2xs text-chalk">
                            {q.name}
                          </span>
                          <span className="rounded-sm bg-route-default/15 px-1 text-2xs text-route-default">
                            {QOSCLASS_LABEL[q.trafficClass]}
                          </span>
                          <span className="text-2xs text-chalk-faint">
                            DSCP {DSCP_BY_QOSCLASS[q.trafficClass]}
                          </span>
                          <RemoveButton
                            onClick={() =>
                              dispatch(
                                removeQosQueue({
                                  nodeId: activeNode.id,
                                  queueId: q.id,
                                }),
                              )
                            }
                          />
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-2xs text-chalk-faint">
                              % mín
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={q.minBandwidthPercent ?? ''}
                              onChange={(e) =>
                                dispatch(
                                  updateQosQueue({
                                    nodeId: activeNode.id,
                                    queueId: q.id,
                                    changes: {
                                      minBandwidthPercent:
                                        e.target.value !== ''
                                          ? Number(e.target.value)
                                          : undefined,
                                    },
                                  }),
                                )
                              }
                              placeholder="—"
                              className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 font-mono text-2xs text-chalk placeholder-chalk-faint"
                            />
                          </div>
                          <div>
                            <label className="text-2xs text-chalk-faint">
                              Disciplina
                            </label>
                            <select
                              value={q.priority}
                              onChange={(e) =>
                                dispatch(
                                  updateQosQueue({
                                    nodeId: activeNode.id,
                                    queueId: q.id,
                                    changes: {
                                      priority: e.target
                                        .value as QosQueue['priority'],
                                    },
                                  }),
                                )
                              }
                              className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                            >
                              <option value="strict">strict</option>
                              <option value="weighted">weighted</option>
                              <option value="best-effort">best-effort</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Formulário nova fila */}
                  <div className="border-t border-route-default/40 pt-2">
                    <p className="mb-1.5 text-label text-chalk-faint">
                      + Nova fila
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-2xs text-chalk-faint">
                          Nome
                        </label>
                        <input
                          value={qosFormName}
                          onChange={(e) => setQosFormName(e.target.value)}
                          placeholder="ex: q0"
                          className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk placeholder-chalk-faint"
                        />
                      </div>
                      <div>
                        <label className="text-2xs text-chalk-faint">
                          Classe
                        </label>
                        <select
                          value={qosFormClass}
                          onChange={(e) =>
                            setQosFormClass(e.target.value as QosClass)
                          }
                          className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                        >
                          {(Object.keys(QOSCLASS_LABEL) as QosClass[]).map(
                            (c) => (
                              <option key={c} value={c}>
                                {QOSCLASS_LABEL[c]}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="text-2xs text-chalk-faint">
                          Disciplina
                        </label>
                        <select
                          value={qosFormPriority}
                          onChange={(e) =>
                            setQosFormPriority(
                              e.target.value as QosQueue['priority'],
                            )
                          }
                          className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 text-2xs text-chalk"
                        >
                          <option value="strict">strict</option>
                          <option value="weighted">weighted</option>
                          <option value="best-effort">best-effort</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-2xs text-chalk-faint">
                          % mín
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={qosFormMinBw}
                          onChange={(e) =>
                            setQosFormMinBw(
                              e.target.value !== ''
                                ? Number(e.target.value)
                                : '',
                            )
                          }
                          placeholder="—"
                          className="w-full rounded-sm border border-line bg-ink px-1 py-0.5 font-mono text-2xs text-chalk placeholder-chalk-faint"
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        disabled={!qosFormName.trim()}
                        onClick={() => {
                          if (!qosFormName.trim()) return;
                          dispatch(
                            addQosQueue({
                              nodeId: activeNode.id,
                              queue: {
                                name: qosFormName.trim(),
                                trafficClass: qosFormClass,
                                priority: qosFormPriority,
                                minBandwidthPercent:
                                  qosFormMinBw !== ''
                                    ? qosFormMinBw
                                    : undefined,
                              },
                            }),
                          );
                          setQosFormName('');
                          setQosFormMinBw('');
                          setQosFormPriority('best-effort');
                          setQosFormClass('default');
                        }}
                        className="rounded-sm border border-route-default/50 bg-route-default/15 px-3 py-1 text-2xs text-route-default hover:bg-route-default/15 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        + Fila
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })(),
    },
  ];
}
