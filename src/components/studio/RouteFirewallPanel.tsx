import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { updateAclRule } from '../../features/network/networkSlice';
import {
  selectFirewallRules,
  selectRouteTable,
  type RouteRow,
} from '../../features/network/selectors';
import type { AclAction } from '../../features/network/types';

const ROUTE_TYPE_CLASS: Record<string, string> = {
  Direta: 'text-emerald-400',
  Estática: 'text-amber-300',
  Default: 'text-orange-400',
  VPN: 'text-cyan-300',
};

function groupRoutesBySite(
  rows: RouteRow[],
): { siteId: string; siteName: string; rows: RouteRow[] }[] {
  const order: string[] = [];
  const map: Record<
    string,
    { siteId: string; siteName: string; rows: RouteRow[] }
  > = {};
  for (const row of rows) {
    if (!map[row.siteId]) {
      order.push(row.siteId);
      map[row.siteId] = {
        siteId: row.siteId,
        siteName: row.siteName,
        rows: [],
      };
    }
    map[row.siteId].rows.push(row);
  }
  return order.map((id) => map[id]);
}

export default function RouteFirewallPanel() {
  const dispatch = useAppDispatch();
  const routes = useAppSelector(selectRouteTable);
  const firewallRules = useAppSelector(selectFirewallRules);

  return (
    <section className="w-full grid gap-3 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
          Tabela de Rotas (gerada)
        </h3>
        <div className="theme-scrollbar max-h-48 overflow-auto text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="border-b border-slate-700 px-1 py-1">Tipo</th>
                <th className="border-b border-slate-700 px-1 py-1">
                  Rede Destino
                </th>
                <th className="border-b border-slate-700 px-1 py-1">
                  <span className="group relative inline-flex cursor-help items-center gap-1">
                    Gateway
                    <span className="text-slate-500">ⓘ</span>
                    <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-72 rounded border border-slate-600 bg-slate-900 p-2 text-left text-[10px] leading-relaxed text-slate-300 shadow-xl group-hover:block">
                      <strong className="mb-1 block text-amber-300">Gateway por tipo de rota</strong>
                      <table className="w-full border-collapse">
                        <tbody>
                          <tr className="border-b border-slate-700">
                            <td className="py-0.5 pr-2 font-semibold text-emerald-400">Direta</td>
                            <td className="py-0.5 text-slate-400">— pacote entregue diretamente na interface</td>
                          </tr>
                          <tr className="border-b border-slate-700">
                            <td className="py-0.5 pr-2 font-semibold text-orange-400">Default</td>
                            <td className="py-0.5 text-slate-400">IP do nó WAN (ISP/borda)</td>
                          </tr>
                          <tr className="border-b border-slate-700">
                            <td className="py-0.5 pr-2 font-semibold text-cyan-300">VPN</td>
                            <td className="py-0.5 text-slate-400">IP do endpoint local do túnel</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 pr-2 font-semibold text-amber-300">Estática</td>
                            <td className="py-0.5 text-slate-400">IP do próximo salto lógico (destino)</td>
                          </tr>
                        </tbody>
                      </table>
                    </span>
                  </span>
                </th>
                <th className="border-b border-slate-700 px-1 py-1">
                  <span className="group relative inline-flex cursor-help items-center gap-1">
                    Interface
                    <span className="text-slate-500">ⓘ</span>
                    <span className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-72 rounded border border-slate-600 bg-slate-900 p-2 text-left text-[10px] leading-relaxed text-slate-300 shadow-xl group-hover:block">
                      <strong className="mb-1 block text-amber-300">Numeração dinâmica de interfaces</strong>
                      Links <span className="text-emerald-400 font-semibold">lan/other</span> e{' '}
                      <span className="text-orange-400 font-semibold">wan</span> incrementam o contador{' '}
                      <code className="text-slate-200">eth</code> do site →{' '}
                      <code className="text-slate-200">eth0</code>, <code className="text-slate-200">eth1</code>…
                      <br />
                      Links <span className="text-cyan-300 font-semibold">vpn/ipsec</span> incrementam o contador{' '}
                      <code className="text-slate-200">tun</code> →{' '}
                      <code className="text-slate-200">tun0</code>, <code className="text-slate-200">tun1</code>…
                      <br />
                      Cada nó ganha interfaces numeradas sequencialmente por site, como em um roteador real com múltiplas placas de rede.
                    </span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {routes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-1 py-2 text-slate-500">
                    Sem rotas ainda. Crie conexões no dashboard.
                  </td>
                </tr>
              )}
              {groupRoutesBySite(routes).map((group) => (
                <>
                  <tr key={`group-${group.siteId}`}>
                    <td
                      colSpan={4}
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
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-300">
          Regras de Segurança/Firewall
        </h3>
        <div className="theme-scrollbar max-h-48 overflow-auto text-xs">
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
