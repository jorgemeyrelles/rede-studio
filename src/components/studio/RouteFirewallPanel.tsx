import { Fragment, useState, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { updateAclRule } from '../../features/network/networkSlice';
import {
  selectFirewallRules,
  selectRouteTable,
} from '../../features/network/selectors';
import type { AclAction } from '../../features/network/types';
import {
  ROUTE_TYPE_CLASS,
  getSiteOtherIps,
  groupRoutesBySite,
} from './catalog';
import type { TooltipPosition } from './catalog';

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

export default function RouteFirewallPanel() {
  const dispatch = useAppDispatch();
  const routes = useAppSelector(selectRouteTable);
  const firewallRules = useAppSelector(selectFirewallRules);
  const sites = useAppSelector((state) => state.network.sites);

  return (
    <section className="w-full grid gap-3 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
          Tabela de Rotas (gerada)
        </h3>
        <div className="theme-scrollbar h-[400px] overflow-x-auto overflow-y-auto text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="border-b border-slate-700 px-1 py-1">Tipo</th>
                <th className="border-b border-slate-700 px-1 py-1">VLAN</th>
                <th className="border-b border-slate-700 px-1 py-1">
                  Rede Destino
                </th>
                <th className="border-b border-slate-700 px-1 py-1">
                  <HeaderInfoTooltip label="Gateway">
                    <strong className="mb-1 block text-amber-300">
                      Gateway por tipo de rota
                    </strong>
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr className="border-b border-slate-700">
                          <td className="py-0.5 pr-2 font-semibold text-emerald-400">
                            Direta
                          </td>
                          <td className="py-0.5 text-slate-400">
                            — pacote entregue diretamente na interface
                          </td>
                        </tr>
                        <tr className="border-b border-slate-700">
                          <td className="py-0.5 pr-2 font-semibold text-orange-400">
                            Default
                          </td>
                          <td className="py-0.5 text-slate-400">
                            IP do nó WAN (ISP/borda)
                          </td>
                        </tr>
                        <tr className="border-b border-slate-700">
                          <td className="py-0.5 pr-2 font-semibold text-cyan-300">
                            VPN
                          </td>
                          <td className="py-0.5 text-slate-400">
                            IP do endpoint local do túnel
                          </td>
                        </tr>
                        <tr>
                          <td className="py-0.5 pr-2 font-semibold text-amber-300">
                            Estática
                          </td>
                          <td className="py-0.5 text-slate-400">
                            IP do próximo salto lógico (destino)
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </HeaderInfoTooltip>
                </th>
                <th className="border-b border-slate-700 px-1 py-1">
                  <HeaderInfoTooltip label="Interface">
                    <strong className="mb-1 block text-amber-300">
                      Numeração dinâmica de interfaces
                    </strong>
                    Links{' '}
                    <span className="font-semibold text-emerald-400">
                      lan/other
                    </span>{' '}
                    e <span className="font-semibold text-orange-400">wan</span>{' '}
                    incrementam o contador{' '}
                    <span className="text-slate-200">eth</span> do site &gt;{' '}
                    <span className="text-slate-200">eth0</span>,{' '}
                    <span className="text-slate-200">eth1</span>...
                    <br />
                    Links{' '}
                    <span className="font-semibold text-cyan-300">
                      vpn/ipsec
                    </span>{' '}
                    incrementam o contador{' '}
                    <span className="text-slate-200">tun</span> &gt;{' '}
                    <span className="text-slate-200">tun0</span>,{' '}
                    <span className="text-slate-200">tun1</span>...
                    <br />O resultado e que links diferentes no mesmo no recebem
                    interfaces numeradas sequencialmente, como em um roteador
                    real com multiplas placas de rede.
                  </HeaderInfoTooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {routes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-1 py-2 text-slate-500">
                    Sem rotas ainda. Crie conexões no dashboard.
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
                          {route.tipo}
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
                      Outros IPs:{' '}
                      {getSiteOtherIps(group.siteId, group.rows, sites)}
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
          Regras de Segurança/Firewall
        </h3>
        <div className="theme-scrollbar h-[400px] overflow-x-auto overflow-y-auto text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="border-b border-slate-700 px-1 py-1">ID</th>
                <th className="border-b border-slate-700 px-1 py-1">Ação</th>
                <th className="border-b border-slate-700 px-1 py-1">Origem</th>
                <th className="border-b border-slate-700 px-1 py-1">Destino</th>
                <th className="border-b border-slate-700 px-1 py-1">
                  Porta/Serviço
                </th>
              </tr>
            </thead>
            <tbody>
              {firewallRules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-1 py-2 text-slate-500">
                    Sem regras geradas ainda.
                  </td>
                </tr>
              )}
              {firewallRules.map((rule) => (
                <tr key={rule.id}>
                  <td className="border-b border-slate-800 px-1 py-1">
                    {rule.id}
                  </td>
                  <td className="border-b border-slate-800 px-1 py-1">
                    <select
                      value={rule.acao}
                      onChange={(event) => {
                        dispatch(
                          updateAclRule({
                            id: rule.id,
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
                    {rule.origem}
                  </td>
                  <td className="border-b border-slate-800 px-1 py-1">
                    {rule.destino}
                  </td>
                  <td className="border-b border-slate-800 px-1 py-1">
                    <input
                      value={rule.servico}
                      onChange={(event) => {
                        dispatch(
                          updateAclRule({
                            id: rule.id,
                            changes: {
                              service: event.target.value,
                            },
                          }),
                        );
                      }}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[11px] text-slate-100"
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
