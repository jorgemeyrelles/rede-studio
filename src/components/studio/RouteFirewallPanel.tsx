import { Fragment, useState, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { updateAclRule } from '../../features/network/networkSlice';
import {
  selectFirewallRules,
  selectRouteTable,
} from '../../features/network/selectors';
import type { AclAction, AclEndpointScope } from '../../features/network/types';
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

  const handleScopeChange = (
    ruleId: string,
    side: 'source' | 'destination',
    scope: AclEndpointScope,
    defaultVlanId?: number,
  ) => {
    const isSource = side === 'source';

    dispatch(
      updateAclRule({
        id: ruleId,
        changes: {
          [isSource ? 'sourceScope' : 'destinationScope']: scope,
          [isSource ? 'sourceVlanId' : 'destinationVlanId']:
            scope === 'vlan' ? defaultVlanId : undefined,
          [isSource ? 'sourceIp' : 'destinationIp']:
            scope === 'ip' ? '' : undefined,
        },
      }),
    );
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
                <th className="w-[40px] border-b border-slate-700 px-1 py-1">
                  ID
                </th>
                <th className="w-[180px] border-b border-slate-700 px-1 py-1">
                  {copy.action}
                </th>
                <th className="w-[115px] border-b border-slate-700 px-1 py-1">
                  {copy.source}
                </th>
                <th className="w-[138px] border-b border-slate-700 px-1 py-1">
                  {copy.endpointType} ({copy.source})
                </th>
                <th className="w-[115px] border-b border-slate-700 px-1 py-1">
                  {copy.destination}
                </th>
                <th className="w-[138px] border-b border-slate-700 px-1 py-1">
                  {copy.endpointType} ({copy.destination})
                </th>
                <th className="w-[160px] border-b border-slate-700 px-1 py-1">
                  {copy.portService}
                </th>
              </tr>
            </thead>
            <tbody>
              {firewallRules.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-1 py-2 text-slate-500">
                    {copy.emptyRules}
                  </td>
                </tr>
              )}
              {firewallRules.map((rule) => (
                <tr key={rule.id}>
                  <td className="border-b border-slate-800 px-1 py-1">
                    <TruncatedValueTooltip
                      value={rule.id}
                      maxWidthClass="max-w-[26px]"
                      className="text-[10px] text-slate-400"
                    />
                  </td>
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
                  <td className="border-b border-slate-800 px-1 py-1">
                    <TruncatedValueTooltip
                      value={rule.origem}
                      maxWidthClass="max-w-[115px]"
                    />
                  </td>
                  <td className="border-b border-slate-800 px-1 py-1">
                    <div className="mt-1 space-y-1">
                      <select
                        value={rule.sourceScope}
                        onChange={(event) => {
                          const scope = event.target.value as AclEndpointScope;
                          const vlanOptions = getVlanOptions(
                            rule.sourceNodeSiteId,
                          );
                          handleScopeChange(
                            rule.aclRuleId,
                            'source',
                            scope,
                            vlanOptions[0]?.vlanId,
                          );
                        }}
                        disabled={rule.isDerivedAllocation}
                        className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[11px] text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="node">{copy.endpointNode}</option>
                        <option value="vlan">{copy.endpointVlan}</option>
                        <option value="ip">{copy.endpointIp}</option>
                      </select>

                      {rule.sourceScope === 'vlan' && (
                        <select
                          value={rule.sourceVlanId ?? ''}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            dispatch(
                              updateAclRule({
                                id: rule.aclRuleId,
                                changes: {
                                  sourceVlanId: Number.isFinite(value)
                                    ? value
                                    : undefined,
                                },
                              }),
                            );
                          }}
                          disabled={rule.isDerivedAllocation}
                          className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[11px] text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">{copy.selectVlan}</option>
                          {getVlanOptions(rule.sourceNodeSiteId).map((vlan) => (
                            <option
                              key={`source-${rule.aclRuleId}-${vlan.vlanId}`}
                              value={vlan.vlanId}
                            >
                              VLAN {vlan.vlanId} ({vlan.name})
                            </option>
                          ))}
                        </select>
                      )}

                      {rule.sourceScope === 'ip' && (
                        <input
                          value={rule.sourceIp ?? ''}
                          onChange={(event) => {
                            dispatch(
                              updateAclRule({
                                id: rule.aclRuleId,
                                changes: {
                                  sourceIp: event.target.value,
                                },
                              }),
                            );
                          }}
                          disabled={rule.isDerivedAllocation}
                          className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[11px] text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder={copy.ipAddress}
                        />
                      )}
                    </div>
                  </td>
                  <td className="border-b border-slate-800 px-1 py-1">
                    <TruncatedValueTooltip
                      value={rule.destino}
                      maxWidthClass="max-w-[115px]"
                    />
                  </td>
                  <td className="border-b border-slate-800 px-1 py-1">
                    <div className="mt-1 space-y-1">
                      <select
                        value={rule.destinationScope}
                        onChange={(event) => {
                          const scope = event.target.value as AclEndpointScope;
                          const vlanOptions = getVlanOptions(
                            rule.destinationNodeSiteId,
                          );
                          handleScopeChange(
                            rule.aclRuleId,
                            'destination',
                            scope,
                            vlanOptions[0]?.vlanId,
                          );
                        }}
                        disabled={rule.isDerivedAllocation}
                        className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[11px] text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="node">{copy.endpointNode}</option>
                        <option value="vlan">{copy.endpointVlan}</option>
                        <option value="ip">{copy.endpointIp}</option>
                      </select>

                      {rule.destinationScope === 'vlan' && (
                        <select
                          value={rule.destinationVlanId ?? ''}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            dispatch(
                              updateAclRule({
                                id: rule.aclRuleId,
                                changes: {
                                  destinationVlanId: Number.isFinite(value)
                                    ? value
                                    : undefined,
                                },
                              }),
                            );
                          }}
                          disabled={rule.isDerivedAllocation}
                          className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[11px] text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">{copy.selectVlan}</option>
                          {getVlanOptions(rule.destinationNodeSiteId).map(
                            (vlan) => (
                              <option
                                key={`destination-${rule.aclRuleId}-${vlan.vlanId}`}
                                value={vlan.vlanId}
                              >
                                VLAN {vlan.vlanId} ({vlan.name})
                              </option>
                            ),
                          )}
                        </select>
                      )}

                      {rule.destinationScope === 'ip' && (
                        <input
                          value={rule.destinationIp ?? ''}
                          onChange={(event) => {
                            dispatch(
                              updateAclRule({
                                id: rule.aclRuleId,
                                changes: {
                                  destinationIp: event.target.value,
                                },
                              }),
                            );
                          }}
                          disabled={rule.isDerivedAllocation}
                          className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[11px] text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder={copy.ipAddress}
                        />
                      )}
                    </div>
                  </td>
                  <td className="border-b border-slate-800 px-1 py-1">
                    <input
                      value={rule.servico}
                      onChange={(event) => {
                        dispatch(
                          updateAclRule({
                            id: rule.aclRuleId,
                            changes: {
                              service: event.target.value,
                            },
                          }),
                        );
                      }}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[10px] text-slate-100"
                      placeholder="ANY, VPN, HTTPS:443"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
