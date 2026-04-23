import { useAppSelector } from '../../app/hooks';
import {
  selectFirewallRules,
  selectRouteTable,
} from '../../features/network/selectors';

export default function RouteFirewallPanel() {
  const routes = useAppSelector(selectRouteTable);
  const firewallRules = useAppSelector(selectFirewallRules);

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
          Tabela de Rotas (gerada)
        </h3>
        <div className="max-h-48 overflow-auto text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="border-b border-slate-700 px-1 py-1">ID</th>
                <th className="border-b border-slate-700 px-1 py-1">Origem</th>
                <th className="border-b border-slate-700 px-1 py-1">Destino</th>
                <th className="border-b border-slate-700 px-1 py-1">Rede</th>
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
              {routes.map((route) => (
                <tr key={route.id}>
                  <td className="border-b border-slate-800 px-1 py-1">
                    {route.id}
                  </td>
                  <td className="border-b border-slate-800 px-1 py-1">
                    {route.origem}
                  </td>
                  <td className="border-b border-slate-800 px-1 py-1">
                    {route.destino}
                  </td>
                  <td className="border-b border-slate-800 px-1 py-1">
                    {route.redeDestino}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-300">
          Regras de Segurança/Firewall (gerada)
        </h3>
        <div className="max-h-48 overflow-auto text-xs">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="border-b border-slate-700 px-1 py-1">ID</th>
                <th className="border-b border-slate-700 px-1 py-1">Ação</th>
                <th className="border-b border-slate-700 px-1 py-1">Origem</th>
                <th className="border-b border-slate-700 px-1 py-1">Destino</th>
              </tr>
            </thead>
            <tbody>
              {firewallRules.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-1 py-2 text-slate-500">
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
                    {rule.acao}
                  </td>
                  <td className="border-b border-slate-800 px-1 py-1">
                    {rule.origem}
                  </td>
                  <td className="border-b border-slate-800 px-1 py-1">
                    {rule.destino}
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
