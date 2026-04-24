import { Fragment, useState, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { updateAclRule } from '../../features/network/networkSlice';
import {
  selectFirewallRules,
  selectRouteTable,
} from '../../features/network/selectors';
import type { AclAction } from '../../features/network/types';
import {
  getRouteFirewallCopy,
  ROUTE_TYPE_CLASS,
  getSiteOtherIps,
  groupRoutesBySite,
  type StudioLanguage,
} from './catalog';
import type { TooltipPosition } from './catalog';
import type { RouteType } from '../../features/network/types';

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

export default function RouteFirewallPanel({
  language,
}: RouteFirewallPanelProps) {
  const dispatch = useAppDispatch();
  const routes = useAppSelector(selectRouteTable);
  const firewallRules = useAppSelector(selectFirewallRules);
  const siteVlans = useAppSelector((state) => state.network.siteVlans);
  const sites = useAppSelector((state) => state.network.sites);
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

  // ── Tabela ACL colapsável ─────────────────────────────────────────────────
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [childActions, setChildActions] = useState<Record<string, AclAction>>(
    {},
  );
  const [expansionFilters, setExpansionFilters] = useState<
    Record<string, { origin: string; dest: string }>
  >({});

  const grouped = firewallRules.reduce<
    {
      parent: (typeof firewallRules)[number];
      children: (typeof firewallRules)[number][];
    }[]
  >((acc, row) => {
    if (!row.isDerivedAllocation) {
      acc.push({ parent: row, children: [] });
    } else if (acc.length > 0) {
      acc[acc.length - 1].children.push(row);
    }
    return acc;
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
    rule: (typeof grouped)[number]['parent'],
    children: (typeof grouped)[number]['children'],
  ): ExpansionRow[] => {
    if (children.length > 0) {
      return children.map((c) => ({
        id: c.id,
        origem: c.origem,
        destino: c.destino,
      }));
    }
    // Fallback: linhas por VLAN quando não há alocações por host
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

  return (
    <section className="w-full grid gap-3 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
          {copy.routeTableTitle}
        </h3>
        <div className="theme-scrollbar h-[400px] overflow-x-auto overflow-y-auto text-xs">
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

      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-300">
          {copy.firewallTitle}
        </h3>
        <div className="theme-scrollbar h-[400px] overflow-x-auto overflow-y-auto text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="w-7 border-b border-slate-700 px-1 py-1" />
                <th className="w-[36px] border-b border-slate-700 px-1 py-1">
                  ID
                </th>
                <th className="w-[110px] border-b border-slate-700 px-1 py-1">
                  {copy.action}
                </th>
                <th className="border-b border-slate-700 px-1 py-1">
                  {copy.source}
                </th>
                <th className="border-b border-slate-700 px-1 py-1">
                  {copy.destination}
                </th>
                <th className="w-[130px] border-b border-slate-700 px-1 py-1">
                  {copy.portService}
                </th>
              </tr>
            </thead>
            <tbody>
              {grouped.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-1 py-2 text-slate-500">
                    {copy.emptyRules}
                  </td>
                </tr>
              )}
              {grouped.map(({ parent: rule, children }) => {
                const expansionRows = getExpansionRows(rule, children);
                const isExpandable = expansionRows.length > 0;
                const isOpen = expandedIds.has(rule.aclRuleId);
                const filter = getFilter(rule.aclRuleId);

                const filteredRows = expansionRows.filter((row) => {
                  const originMatch = row.origem
                    .toLowerCase()
                    .includes(filter.origin.toLowerCase());
                  const destMatch = row.destino
                    .toLowerCase()
                    .includes(filter.dest.toLowerCase());
                  return originMatch && destMatch;
                });

                return (
                  <Fragment key={rule.id}>
                    {/* ── Linha principal da regra ────────────────────────── */}
                    <tr className="hover:bg-slate-800/40">
                      {/* Chevron */}
                      <td className="border-b border-slate-800 px-1 py-1">
                        <button
                          type="button"
                          aria-label={
                            isOpen ? 'Recolher alocações' : 'Expandir alocações'
                          }
                          onClick={() =>
                            isExpandable && toggleExpand(rule.aclRuleId)
                          }
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
                            className={`h-3 w-3 transition-transform duration-200 ${
                              isOpen ? 'rotate-90' : 'rotate-0'
                            }`}
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </td>

                      {/* ID */}
                      <td className="border-b border-slate-800 px-1 py-1">
                        <TruncatedValueTooltip
                          value={rule.id}
                          maxWidthClass="max-w-[26px]"
                          className="text-[10px] text-slate-400"
                        />
                      </td>

                      {/* Ação */}
                      <td className="border-b border-slate-800 px-1 py-1">
                        <select
                          value={rule.acao}
                          onChange={(event) => {
                            dispatch(
                              updateAclRule({
                                id: rule.aclRuleId,
                                changes: {
                                  action: event.target.value as AclAction,
                                },
                              }),
                            );
                          }}
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
                          onChange={(event) => {
                            dispatch(
                              updateAclRule({
                                id: rule.aclRuleId,
                                changes: { service: event.target.value },
                              }),
                            );
                          }}
                          className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[10px] text-slate-100"
                          placeholder="ANY, VPN, HTTPS:443"
                        />
                      </td>
                    </tr>

                    {/* ── Linha de expansão ──────────────────────────────── */}
                    {isExpandable && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <div
                            className={`overflow-hidden transition-all duration-200 ${
                              isOpen ? 'max-h-[600px]' : 'max-h-0'
                            }`}
                          >
                            <div className="ml-7 border-l-2 border-amber-500/40 bg-slate-800/50">
                              {/* Filtros */}
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
                                      setFilterValue(
                                        rule.aclRuleId,
                                        'dest',
                                        e.target.value,
                                      )
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
                                        [rule.aclRuleId]: {
                                          origin: '',
                                          dest: '',
                                        },
                                      }))
                                    }
                                    className="shrink-0 text-[10px] text-slate-500 hover:text-slate-300"
                                    aria-label="Limpar filtros"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              {/* Sub-tabela */}
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="text-left text-[10px] text-slate-500">
                                    <th className="w-6 px-2 py-0.5">#</th>
                                    <th className="w-[100px] px-2 py-0.5">
                                      Ação
                                    </th>
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
                                        Nenhum resultado para os filtros
                                        aplicados.
                                      </td>
                                    </tr>
                                  )}
                                  {filteredRows.map((row, idx) => (
                                    <tr
                                      key={row.id}
                                      className="hover:bg-slate-700/30"
                                    >
                                      <td className="px-2 py-0.5 text-[10px] text-slate-500">
                                        {idx + 1}
                                      </td>
                                      <td className="px-2 py-0.5">
                                        <select
                                          value={getChildAction(
                                            row.id,
                                            rule.acao,
                                          )}
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
                                  {filteredRows.length} de{' '}
                                  {expansionRows.length} alocaç
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
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
