import { Crosshair } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  selectCloudConnection,
  setCloudConnectionMode,
} from '../../features/cloud/cloudSlice';
import {
  connectionIssue,
  connectionLabel,
  connectionMode,
  readConnectionConfig,
  type ConnectionKind,
} from '../../features/cloud/engines/connections';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';
import { focusOnCanvas } from './focusOnCanvas';

const MODE_SYMBOL = { 'one-way': '→', both: '↔', pair: '⇄' } as const;

/**
 * Aba "Conexões": uma linha por conexão (o par ida/volta aparece como duas
 * linhas ⇄, cada uma com sua configuração). Separar/juntar ida e volta e
 * localizar no canvas; o resto se edita no inspetor da conexão.
 */
export default function CloudConnectionsTable({
  language,
}: {
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const { resources, connections, ui } = useAppSelector((state) => state.cloud);
  const columns = copy.connectionColumns;
  const name = (id: string) => resources.find((r) => r.id === id)?.name ?? id;

  if (connections.length === 0) {
    return (
      <p className="px-4 py-6 text-xs text-chalk-faint">
        {copy.connectionsEmpty}
      </p>
    );
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col" className="text-left">
              {columns.from}
            </th>
            <th scope="col" className="text-left">
              {columns.to}
            </th>
            <th scope="col" className="text-left">
              {columns.kind}
            </th>
            <th scope="col" className="text-left">
              {columns.direction}
            </th>
            <th scope="col" className="text-left">
              {columns.port}
            </th>
            <th scope="col" className="text-left">
              {columns.encrypted}
            </th>
            <th scope="col" className="text-right">
              {columns.gbMonth}
            </th>
            <th scope="col">
              <span className="sr-only">{copy.locate}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {connections.map((connection) => {
            const config = readConnectionConfig(connection);
            const mode = connectionMode(connection);
            const issue = connectionIssue(resources, connection, connections);
            const selected = ui.selectedConnectionId === connection.id;
            return (
              <tr
                key={connection.id}
                className={selected ? 'bg-accent/[0.06]' : ''}
              >
                <td className="whitespace-nowrap text-chalk">
                  {name(connection.source)}
                </td>
                <td className="whitespace-nowrap text-chalk">
                  {name(connection.target)}
                </td>
                <td className="whitespace-nowrap">
                  {copy.connection.kinds[connection.kind as ConnectionKind] ??
                    connection.kind}
                </td>
                <td className="whitespace-nowrap">
                  <span
                    aria-hidden="true"
                    className="mr-1.5 font-mono text-chalk"
                  >
                    {MODE_SYMBOL[mode]}
                  </span>
                  {copy.connection.modes[mode]}
                </td>
                <td
                  className={`whitespace-nowrap font-mono ${issue ? 'text-signal-warn' : ''}`}
                  title={issue?.[language]}
                >
                  {connectionLabel(connection)}
                </td>
                <td className="whitespace-nowrap">
                  {config.encrypted ? copy.yes : copy.no}
                </td>
                <td className="text-right font-mono tabular-nums">
                  {config.gbMonth}
                </td>
                <td className="whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() =>
                      dispatch(
                        setCloudConnectionMode({
                          id: connection.id,
                          mode: mode === 'pair' ? 'both' : 'pair',
                        }),
                      )
                    }
                    className="btn btn-ghost btn-sm"
                  >
                    {mode === 'pair' ? copy.merge : copy.split}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch(selectCloudConnection(connection.id));
                      focusOnCanvas([connection.source, connection.target]);
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    <Crosshair size={13} aria-hidden="true" />
                    {copy.locate}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
