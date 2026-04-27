import { Fragment, useRef, useState, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  updateAclRule,
  addCustomAclRule,
  removeCustomAclRule,
  reorderCustomAclRule,
  setActiveLinkId,
  updateLink,
} from '../../features/network/networkSlice';
import {
  selectFirewallRulesGrouped,
  selectRouteTable,
} from '../../features/network/selectors';
import type { AclAction } from '../../features/network/types';
import type { FirewallRuleRow } from '../../features/network/types/selectors';
import {
  getRouteFirewallCopy,
  ROUTE_TYPE_CLASS,
  getSiteOtherIps,
  groupRoutesBySite,
  type StudioLanguage,
} from './catalog';
import type { TooltipPosition } from './catalog';
import type { RouteType } from '../../features/network/types';
import TreePicker from './TreePicker';

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
        aria-label={`Informacoes sobre ${label}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] text-slate-500 transition hover:text-slate-200 focus:outline-none"
        onMouseEnter={openTooltipOnMouse}
        onMouseLeave={closeTooltip}
        onFocus={openTooltipOnFocus}
        onBlur={closeTooltip}
      >
        ⓘ
      </button>
      {position && (
        <div
          className="fixed z-[1000] w-72 -translate-y-1/2 rounded border border-slate-600 bg-slate-900 p-2 text-left text-[10px] leading-relaxed text-slate-300 shadow-xl"
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
        className={`${maxWidthClass} cursor-help overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-slate-300 outline-none ${className}`}
        onMouseEnter={(event) => openTooltip(event.currentTarget)}
        onMouseLeave={closeTooltip}
        onFocus={(event) => openTooltip(event.currentTarget)}
        onBlur={closeTooltip}
      >
        {value}
      </div>

      {position && (
        <div
          className="fixed z-[1000] max-w-[360px] -translate-y-1/2 rounded border border-slate-600 bg-slate-900 px-3 py-2 text-left text-[11px] leading-relaxed text-slate-200 shadow-xl"
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

type RouteFirewallPanelProps = {
  language: StudioLanguage;
};

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
      ? 'Destino verá IP do FW (PAT)'
      : rule.fwNatMode === 'snat'
        ? 'Origem aparece como IP mapeado (SNAT)'
        : rule.fwNatMode === 'dnat'
          ? 'Destino é IP público → privado (DNAT)'
          : rule.fwNatMode === 'hybrid'
            ? 'Modo híbrido NAT + DNAT'
            : '';

  const ipsecBadgeColor =
    rule.ipsecAuthBadge === 'PKI' || rule.ipsecAuthBadge === 'keypair'
      ? 'bg-green-900/60 text-green-300'
      : rule.ipsecAuthBadge === 'EAP'
        ? 'bg-blue-900/60 text-blue-300'
        : rule.ipsecAuthBadge === '⚠ sem IKE'
          ? 'bg-red-900/60 text-red-400'
          : 'bg-orange-900/60 text-orange-300'; // PSK

  return (
    <span className="flex flex-wrap gap-0.5">
      {!rule.stateful && !rule.passthrough && (
        <span
          title="Stateless"
          className="rounded bg-amber-900/60 px-1 py-px text-[9px] text-amber-300"
        >
          ~
        </span>
      )}
      {rule.bidirectional && (
        <span
          title="Bidirecional — par de retorno gerado"
          className="rounded bg-sky-900/60 px-1 py-px text-[9px] text-sky-300"
        >
          ↔
        </span>
      )}
      {rule.passthrough && (
        <span
          title="Passthrough (sem FW/router no caminho)"
          className="rounded bg-slate-700 px-1 py-px text-[9px] text-slate-400"
        >
          ⊘
        </span>
      )}
      {rule.hasConflict && (
        <span
          title="Conflito: DENY manual sobrescreve ALLOW de topologia"
          className="rounded bg-red-900/60 px-1 py-px text-[9px] text-red-400"
        >
          ⚠
        </span>
      )}
      {rule.natExempt && (
        <span
          title="NAT Exempt — bypass NAT para IPsec"
          className="rounded bg-emerald-900/60 px-1 py-px text-[9px] text-emerald-400"
        >
          🛡
        </span>
      )}
      {natLabel && (
        <span
          title={natTitle}
          className="rounded bg-amber-900/60 px-1 py-px text-[9px] text-amber-300"
        >
          {natLabel}
        </span>
      )}
      {rule.ipsecAuthBadge && (
        <span
          title={`IPsec auth: ${rule.ipsecAuthBadge}`}
          className={`rounded px-1 py-px text-[9px] ${ipsecBadgeColor}`}
        >
          {rule.ipsecAuthBadge}
        </span>
      )}
      {rule.managed && (
        <span
          title="Gerenciada por topologia"
          className="rounded bg-slate-700 px-1 py-px text-[9px] text-slate-400"
        >
          🔒
        </span>
      )}
      {rule.isReturnRule && (
        <span
          title="Regra de retorno automática"
          className="rounded bg-purple-900/60 px-1 py-px text-[9px] text-purple-300"
        >
          ←R
        </span>
      )}
      {rule.missingReturn && (
        <span
          title="Stateless sem regra de retorno"
          className="rounded bg-orange-900/60 px-1 py-px text-[9px] text-orange-400"
        >
          ⚠stl
        </span>
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
        className={`border-y border-slate-700 bg-slate-800/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${color}`}
      >
        {label} ({count})
      </td>
    </tr>
  );
}

// ── ServicePicker ─────────────────────────────────────────────────────────
const SERVICE_CATALOG = [
  {
    group: 'Web',
    items: [
      { label: 'HTTP', value: 'tcp/80' },
      { label: 'HTTPS', value: 'tcp/443' },
      { label: 'HTTP + HTTPS', value: 'tcp/80, tcp/443' },
    ],
  },
  {
    group: 'Gerência',
    items: [
      { label: 'SSH', value: 'tcp/22' },
      { label: 'RDP', value: 'tcp/3389' },
      { label: 'SNMP', value: 'udp/161' },
      { label: 'ICMP echo', value: 'icmp' },
      { label: 'Gerência completa', value: 'tcp/22, tcp/3389, udp/161, icmp' },
    ],
  },
  {
    group: 'VoIP',
    items: [
      { label: 'SIP', value: 'udp/5060' },
      { label: 'RTP', value: 'udp/10000-20000' },
      { label: 'VoIP completo', value: 'udp/5060, udp/10000-20000' },
    ],
  },
  {
    group: 'VPN / Túnel',
    items: [
      { label: 'IKE', value: 'udp/500' },
      { label: 'IPsec NAT-T', value: 'udp/4500' },
      { label: 'ESP', value: 'esp' },
      { label: 'OpenVPN', value: 'udp/1194' },
      { label: 'IPsec completo', value: 'udp/500, udp/4500, esp' },
    ],
  },
  {
    group: 'Banco de dados',
    items: [
      { label: 'MySQL', value: 'tcp/3306' },
      { label: 'PostgreSQL', value: 'tcp/5432' },
      { label: 'MSSQL', value: 'tcp/1433' },
      { label: 'Oracle', value: 'tcp/1521' },
    ],
  },
  {
    group: 'Arquivo',
    items: [
      { label: 'SMB / CIFS', value: 'tcp/445' },
      { label: 'NFS', value: 'tcp/2049' },
      { label: 'FTP', value: 'tcp/20-21' },
    ],
  },
];

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
        className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-left text-[10px] text-slate-200 hover:border-slate-400"
      >
        <span className="block truncate">{value || 'Selecionar serviço…'}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded border border-slate-600 bg-slate-900 shadow-xl">
          <div className="max-h-56 overflow-y-auto">
            {/* Any */}
            <button
              type="button"
              onClick={() => {
                onChange('ANY');
                setOpen(false);
              }}
              className="w-full px-2 py-1 text-left text-[10px] text-slate-300 hover:bg-slate-700"
            >
              ☐ Qualquer (ANY)
            </button>
            {SERVICE_CATALOG.map((cat) => (
              <div key={cat.group}>
                <button
                  type="button"
                  onClick={() => toggleGroup(cat.group)}
                  className="flex w-full items-center gap-1 bg-slate-800/60 px-2 py-1 text-left text-[10px] font-semibold text-slate-400 hover:text-slate-200"
                >
                  <span>{openGroups.has(cat.group) ? '▼' : '▶'}</span>
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
                      className="w-full px-4 py-0.5 text-left text-[10px] text-slate-300 hover:bg-slate-700"
                    >
                      {item.label}
                      <span className="ml-1 text-slate-500">{item.value}</span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
          {/* Custom entry */}
          <div className="border-t border-slate-700 p-1.5">
            <div className="flex gap-1">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="ex: tcp/8080"
                className="flex-1 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-200 placeholder-slate-600"
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
                className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-slate-400"
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

export default function RouteFirewallPanel({
  language,
}: RouteFirewallPanelProps) {
  const dispatch = useAppDispatch();
  const routes = useAppSelector(selectRouteTable);
  const { manualRules, topologyRules, natExemptRules } = useAppSelector(
    selectFirewallRulesGrouped,
  );
  const siteVlans = useAppSelector((state) => state.network.siteVlans);
  const sites = useAppSelector((state) => state.network.sites);
  const nodes = useAppSelector((state) => state.network.nodes);
  const links = useAppSelector((state) => state.network.links);
  const activeLinkId = useAppSelector((state) => state.network.ui.activeLinkId);
  const activeLink = activeLinkId
    ? (links.find((l) => l.id === activeLinkId) ?? null)
    : null;
  const copy = getRouteFirewallCopy(language);
  const routeTypeLabels: Record<RouteType, string> = {
    Direta: copy.routeTypeDirect,
    Estática: copy.routeTypeStatic,
    Default: copy.routeTypeDefault,
    VPN: copy.routeTypeVpn,
  };

  const getVlanOptions = (siteId?: string) => {
    if (!siteId) return [];
    return siteVlans
      .filter((vlan) => vlan.siteId === siteId)
      .sort((a, b) => a.vlanId - b.vlanId);
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [childActions, setChildActions] = useState<Record<string, AclAction>>(
    {},
  );
  const [expansionFilters, setExpansionFilters] = useState<
    Record<string, { origin: string; dest: string }>
  >({});
  const [manualZoneFirst, setManualZoneFirst] = useState(true);
  // H — drag handle state
  const dragRuleIdRef = useRef<string | null>(null);

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
  ): AclAction =>
    (childActions[childId] as AclAction | undefined) ?? parentAction;

  const setChildAction = (childId: string, action: AclAction) =>
    setChildActions((prev) => ({ ...prev, [childId]: action }));

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
    totalManual: number,
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
    const filter = getFilter(rule.aclRuleId);

    const filteredRows = expansionRows.filter((row) => {
      return (
        row.origem.toLowerCase().includes(filter.origin.toLowerCase()) &&
        row.destino.toLowerCase().includes(filter.dest.toLowerCase())
      );
    });

    return (
      <Fragment key={rule.id}>
        <tr className="hover:bg-slate-800/40">
          {/* Chevron */}
          <td className="border-b border-slate-800 px-1 py-1">
            <button
              type="button"
              aria-label={isOpen ? 'Recolher' : 'Expandir'}
              onClick={() => isExpandable && toggleExpand(rule.aclRuleId)}
              disabled={!isExpandable}
              className={`flex h-5 w-5 items-center justify-center rounded transition-all duration-150 ${
                isExpandable
                  ? 'cursor-pointer text-amber-400 hover:bg-slate-700 hover:text-amber-300'
                  : 'cursor-not-allowed text-slate-600 opacity-40'
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
          <td className="border-b border-slate-800 px-1 py-1">
            <span className="text-[10px] text-slate-500">{rule.priority}</span>
          </td>

          {/* Ação */}
          <td className="border-b border-slate-800 px-1 py-1">
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
              className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[11px] text-slate-100"
            >
              <option value="ALLOW">ALLOW</option>
              <option value="DENY">DENY</option>
            </select>
          </td>

          {/* Origem */}
          <td className="border-b border-slate-800 px-1 py-1">
            <TruncatedValueTooltip value={rule.origem} />
          </td>

          {/* Destino */}
          <td className="border-b border-slate-800 px-1 py-1">
            <TruncatedValueTooltip value={rule.destino} />
          </td>

          {/* Serviço */}
          <td className="border-b border-slate-800 px-1 py-1">
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
              className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[10px] text-slate-100"
              placeholder="ANY, HTTPS:443"
            />
          </td>

          {/* Badges + actions */}
          <td className="border-b border-slate-800 px-1 py-1">
            <div className="flex items-center gap-1">
              <RuleBadges rule={rule} />
              {/* G — ↔ toggle for topology rows with missing return rule */}
              {!isManual && rule.missingReturn && !rule.isReturnRule && (
                <button
                  type="button"
                  title="Marcar como bidirecional — gera regra de retorno"
                  onClick={() =>
                    dispatch(
                      updateAclRule({
                        id: rule.aclRuleId,
                        changes: { bidirectional: true },
                      }),
                    )
                  }
                  className="ml-1 flex h-5 w-5 items-center justify-center rounded border border-amber-700/60 bg-amber-900/20 text-[10px] text-amber-400 hover:bg-amber-800/40"
                >
                  ↔
                </button>
              )}
              {isManual && (
                <div className="ml-auto flex items-center gap-0.5">
                  {/* H — drag handle */}
                  <span
                    title="Arrastar para reordenar"
                    className="flex h-5 w-4 cursor-grab select-none items-center justify-center text-slate-500 active:cursor-grabbing"
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
                    ⠿
                  </span>
                  <button
                    type="button"
                    title="Remover regra"
                    onClick={() =>
                      dispatch(removeCustomAclRule({ id: rule.aclRuleId }))
                    }
                    className="flex h-5 w-5 items-center justify-center rounded text-red-600 hover:bg-red-900/30 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              )}
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
                <div className="ml-7 border-l-2 border-amber-500/40 bg-slate-800/50">
                  <div className="flex gap-2 border-b border-slate-700/60 px-2 py-1.5">
                    <div className="flex flex-1 items-center gap-1">
                      <span className="shrink-0 text-[10px] text-slate-500">
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
                        className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-200 placeholder-slate-600 outline-none focus:border-amber-500/60"
                      />
                    </div>
                    <div className="flex flex-1 items-center gap-1">
                      <span className="shrink-0 text-[10px] text-slate-500">
                        Destino:
                      </span>
                      <input
                        value={filter.dest}
                        onChange={(e) =>
                          setFilterValue(rule.aclRuleId, 'dest', e.target.value)
                        }
                        placeholder="filtrar IP / host…"
                        className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-200 placeholder-slate-600 outline-none focus:border-amber-500/60"
                      />
                    </div>
                    {(filter.origin || filter.dest) && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpansionFilters((prev) => ({
                            ...prev,
                            [rule.aclRuleId]: { origin: '', dest: '' },
                          }))
                        }
                        className="shrink-0 text-[10px] text-slate-500 hover:text-slate-300"
                        aria-label="Limpar filtros"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-left text-[10px] text-slate-500">
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
                            className="px-2 py-1 text-[10px] text-slate-600"
                          >
                            Nenhum resultado para os filtros aplicados.
                          </td>
                        </tr>
                      )}
                      {filteredRows.map((row, rowIdx) => (
                        <tr key={row.id} className="hover:bg-slate-700/30">
                          <td className="px-2 py-0.5 text-[10px] text-slate-500">
                            {rowIdx + 1}
                          </td>
                          <td className="px-2 py-0.5">
                            <select
                              value={getChildAction(row.id, rule.acao)}
                              onChange={(e) =>
                                setChildAction(
                                  row.id,
                                  e.target.value as AclAction,
                                )
                              }
                              className="w-full rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-100"
                            >
                              <option value="ALLOW">ALLOW</option>
                              <option value="DENY">DENY</option>
                            </select>
                          </td>
                          <td className="px-2 py-0.5">
                            <TruncatedValueTooltip
                              value={row.origem}
                              maxWidthClass="max-w-[200px]"
                              className="font-mono text-[10px] text-slate-300"
                            />
                          </td>
                          <td className="px-2 py-0.5">
                            <TruncatedValueTooltip
                              value={row.destino}
                              maxWidthClass="max-w-[200px]"
                              className="font-mono text-[10px] text-slate-300"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredRows.length > 0 && (
                    <p className="px-2 py-1 text-[10px] text-slate-600">
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
        label="Exceções manuais (Zona B)"
        count={manualGrouped.length}
        color="text-violet-300"
      />
      {manualGrouped.length === 0 && (
        <tr>
          <td
            colSpan={7}
            className="px-2 py-1.5 text-[11px] text-slate-600 italic"
          >
            Nenhuma regra manual. Adicione com "+ Regra" acima.
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
        color="text-rose-300"
      />
      {topologyGrouped.length === 0 && (
        <tr>
          <td
            colSpan={7}
            className="px-2 py-1.5 text-[11px] text-slate-600 italic"
          >
            Nenhuma regra de topologia gerada ainda.
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

  return (
    <section className="w-full flex flex-col gap-3">
      {/* ── Linha 1: Tabela de Rotas (largura total) ─────────────────────── */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
          {copy.routeTableTitle}
        </h3>
        <div className="theme-scrollbar h-[280px] overflow-x-auto overflow-y-auto text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="border-b border-slate-700 px-1 py-1">
                  {copy.type}
                </th>
                <th className="border-b border-slate-700 px-1 py-1">VLAN</th>
                <th className="border-b border-slate-700 px-1 py-1">
                  {copy.destinationNetwork}
                </th>
                <th className="border-b border-slate-700 px-1 py-1">
                  <HeaderInfoTooltip label={copy.gateway}>
                    <strong className="mb-1 block text-amber-300">
                      {copy.routeGatewayByType}
                    </strong>
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr className="border-b border-slate-700">
                          <td className="py-0.5 pr-2 font-semibold text-emerald-400">
                            {copy.routeTypeDirect}
                          </td>
                          <td className="py-0.5 text-slate-400">
                            — {copy.routeHelpDirect}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-700">
                          <td className="py-0.5 pr-2 font-semibold text-orange-400">
                            {copy.routeTypeDefault}
                          </td>
                          <td className="py-0.5 text-slate-400">
                            {copy.routeHelpDefault}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-700">
                          <td className="py-0.5 pr-2 font-semibold text-cyan-300">
                            {copy.routeTypeVpn}
                          </td>
                          <td className="py-0.5 text-slate-400">
                            {copy.routeHelpVpn}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-0.5 pr-2 font-semibold text-amber-300">
                            {copy.routeTypeStatic}
                          </td>
                          <td className="py-0.5 text-slate-400">
                            {copy.routeHelpStatic}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </HeaderInfoTooltip>
                </th>
                <th className="border-b border-slate-700 px-1 py-1">
                  <HeaderInfoTooltip label={copy.interface}>
                    <strong className="mb-1 block text-amber-300">
                      {copy.interfaceDynamicNumbering}
                    </strong>
                    {copy.interfaceHelpLine1}
                    <br />
                    {copy.interfaceHelpLine2}
                    <br />
                    {copy.interfaceHelpLine3}
                  </HeaderInfoTooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {routes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-1 py-2 text-slate-500">
                    {copy.emptyRoutes}
                  </td>
                </tr>
              )}
              {groupRoutesBySite(routes).map((group) => (
                <Fragment key={`group-${group.siteId}`}>
                  <tr>
                    <td
                      colSpan={5}
                      className="bg-slate-800/70 px-2 py-1 font-semibold text-sky-300 border-b border-slate-600 border-t border-slate-600"
                    >
                      📍 {group.siteName}
                    </td>
                  </tr>
                  {group.rows.map((route, i) => (
                    <tr
                      key={`${group.siteId}-${i}`}
                      className="hover:bg-slate-800/40"
                    >
                      <td className="border-b border-slate-800 px-1 py-1">
                        <span
                          className={`font-medium ${ROUTE_TYPE_CLASS[route.tipo] ?? 'text-slate-300'}`}
                        >
                          {routeTypeLabels[route.tipo] ?? route.tipo}
                        </span>
                      </td>
                      <td className="border-b border-slate-800 px-1 py-1 font-mono text-slate-300">
                        {route.vlan}
                      </td>
                      <td className="border-b border-slate-800 px-1 py-1 font-mono text-slate-200">
                        {route.redeDest}
                      </td>
                      <td className="border-b border-slate-800 px-1 py-1 font-mono text-slate-400">
                        {route.gateway}
                      </td>
                      <td className="border-b border-slate-800 px-1 py-1 text-slate-300">
                        {route.iface}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td
                      colSpan={5}
                      className="border-b border-slate-700 px-2 py-1 text-[11px] text-slate-400"
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

      {/* ── Linha 2: Inspector 25% + Firewall 75% ────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-[1fr_3fr]">
        {/* Inspector de link */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
            Inspector de Link
          </h3>
          {!activeLink ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-slate-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-8 w-8 opacity-40"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
              <p className="text-[11px] leading-relaxed">
                Clique em um <span className="text-slate-400">link</span> no
                diagrama para inspecionar suas propriedades
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded border border-sky-700/30 bg-sky-950/20 px-2 py-1.5">
                <p className="text-[10px] text-sky-400 font-semibold uppercase tracking-wider mb-0.5">
                  Link selecionado
                </p>
                <p
                  className="font-mono text-[10px] text-slate-300 truncate"
                  title={activeLink.id}
                >
                  {activeLink.id}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Tipo:{' '}
                  <span className="text-slate-300">{activeLink.kind}</span>
                </p>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-slate-400">Modo stateful</span>
                <select
                  value={activeLink.statefulOverride ?? 'inherited'}
                  onChange={(e) =>
                    dispatch(
                      updateLink({
                        id: activeLinkId!,
                        changes: {
                          statefulOverride: e.target.value as
                            | 'inherited'
                            | 'force-stateful'
                            | 'force-stateless',
                        },
                      }),
                    )
                  }
                  className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200"
                >
                  <option value="inherited">Herdado do FW</option>
                  <option value="force-stateful">Forçar stateful</option>
                  <option value="force-stateless">Forçar stateless</option>
                </select>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={activeLink.generateAcl ?? true}
                  onChange={(e) =>
                    dispatch(
                      updateLink({
                        id: activeLinkId!,
                        changes: { generateAcl: e.target.checked },
                      }),
                    )
                  }
                  className="h-3 w-3 accent-blue-500"
                />
                <span className="text-slate-300">Gerar regras ACL</span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-slate-400">Descrição</span>
                <input
                  type="text"
                  value={activeLink.description ?? ''}
                  onChange={(e) =>
                    dispatch(
                      updateLink({
                        id: activeLinkId!,
                        changes: { description: e.target.value },
                      }),
                    )
                  }
                  placeholder="Descrição do link..."
                  className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200 placeholder-slate-600"
                />
              </label>

              <button
                type="button"
                onClick={() => dispatch(setActiveLinkId(null))}
                className="w-full rounded border border-slate-600 py-1 text-[10px] text-slate-500 hover:border-slate-400 hover:text-slate-300"
              >
                Deselecionar link
              </button>
            </div>
          )}
        </div>

        {/* Firewall / ACL */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-300">
              {copy.firewallTitle}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setManualZoneFirst((v) => !v)}
                title="Alternar posição das exceções manuais"
                className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:border-slate-400 hover:text-slate-100"
              >
                {manualZoneFirst ? 'exceções: antes ▼' : 'exceções: depois ▲'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreator((v) => !v)}
                className="rounded border border-violet-600 bg-violet-900/30 px-2 py-0.5 text-[10px] text-violet-300 hover:bg-violet-800/40 hover:text-violet-200"
              >
                {showCreator ? '✕ Cancelar' : '+ Regra'}
              </button>
            </div>
          </div>

          {/* Custom rule creator */}
          {showCreator && (
            <div className="mb-2 rounded border border-violet-700/50 bg-violet-950/30 p-2 text-[11px]">
              <p className="mb-1.5 font-semibold text-violet-300">
                Nova regra manual
              </p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-slate-400">Origem (nó)</span>
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
                  <span className="text-slate-400">Destino (nó)</span>
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
                  <span className="text-slate-400">Serviço</span>
                  <ServicePicker value={newService} onChange={setNewService} />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-slate-400">Protocolo</span>
                  <select
                    value={newProtocol}
                    onChange={(e) =>
                      setNewProtocol(
                        e.target.value as 'tcp' | 'udp' | 'icmp' | 'any',
                      )
                    }
                    className="rounded border border-slate-600 bg-slate-800 px-1 py-1 text-slate-200"
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
                  <span className="text-slate-400">Ação</span>
                  <select
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value as AclAction)}
                    className="rounded border border-slate-600 bg-slate-800 px-1 py-1 text-slate-200"
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
                      className="h-3 w-3 accent-blue-500"
                    />
                    <span className="text-slate-300">Stateful</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={newBidirectional}
                      onChange={(e) => setNewBidirectional(e.target.checked)}
                      className="h-3 w-3 accent-sky-500"
                    />
                    <span className="text-slate-300">Bidirecional</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreator(false)}
                  className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomRule}
                  disabled={!newSrcNodeId || !newDstNodeId}
                  className="rounded border border-violet-600 bg-violet-900/40 px-2 py-1 text-[10px] text-violet-300 hover:bg-violet-800/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}

          <div className="theme-scrollbar h-[400px] overflow-x-auto overflow-y-auto text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="w-7 border-b border-slate-700 px-1 py-1" />
                  <th
                    className="w-[42px] border-b border-slate-700 px-1 py-1"
                    title="Prioridade — menor valor = avaliado primeiro"
                  >
                    Prio
                  </th>
                  <th className="w-[100px] border-b border-slate-700 px-1 py-1">
                    {copy.action}
                  </th>
                  <th className="border-b border-slate-700 px-1 py-1">
                    {copy.source}
                  </th>
                  <th className="border-b border-slate-700 px-1 py-1">
                    {copy.destination}
                  </th>
                  <th className="w-[120px] border-b border-slate-700 px-1 py-1">
                    {copy.portService}
                  </th>
                  <th className="w-[90px] border-b border-slate-700 px-1 py-1">
                    Flags
                  </th>
                </tr>
              </thead>
              <tbody>
                {manualGrouped.length === 0 &&
                  topologyGrouped.length === 0 &&
                  natGrouped.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-1 py-2 text-slate-500">
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
                      color="text-emerald-300"
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
                <tr className="bg-red-950/20">
                  <td
                    colSpan={2}
                    className="border-t border-slate-700 px-1 py-1"
                  />
                  <td className="border-t border-slate-700 px-1 py-1">
                    <span className="rounded bg-red-900/60 px-1 py-0.5 text-[10px] text-red-400 font-semibold">
                      DENY
                    </span>
                  </td>
                  <td className="border-t border-slate-700 px-1 py-1 text-[10px] text-slate-500">
                    any
                  </td>
                  <td className="border-t border-slate-700 px-1 py-1 text-[10px] text-slate-500">
                    any
                  </td>
                  <td className="border-t border-slate-700 px-1 py-1 text-[10px] text-slate-500">
                    *
                  </td>
                  <td className="border-t border-slate-700 px-1 py-1 text-[10px] text-slate-600 italic">
                    implicit deny
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {/* fim card firewall */}
      </div>
      {/* fim grid linha 2 */}
    </section>
  );
}
