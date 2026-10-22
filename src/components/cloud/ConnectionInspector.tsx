import { AlertTriangle, ArrowLeftRight, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  removeCloudConnection,
  reverseCloudConnection,
  selectCloudConnection,
  selectCloudResource,
  setCloudConnectionMode,
  updateCloudConnection,
} from '../../features/cloud/cloudSlice';
import {
  CONNECTION_KINDS,
  connectionIssue,
  connectionMode,
  derivedSgRules,
  readConnectionConfig,
  type ConnectionKind,
  type ConnectionMode,
} from '../../features/cloud/engines/connections';
import {
  PROTOCOLS,
  usesPorts,
  type RuleProtocol,
} from '../../features/cloud/engines/security';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';

const MODES: ConnectionMode[] = ['one-way', 'both', 'pair'];

/**
 * Inspetor da conexão selecionada: pontas, tipo, modo de direção (ida /
 * ida e volta iguais / diferentes), protocolo, portas, criptografia e
 * volume. Mostra em quais SGs a conexão vira regra.
 */
export default function ConnectionInspector({
  connectionId,
  language,
  onDeleted,
}: {
  connectionId: string;
  language: AppLanguage;
  onDeleted: () => void;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const c = copy.connection;
  const sec = copy.security;
  const { resources, connections } = useAppSelector((state) => state.cloud);
  const connection = connections.find((x) => x.id === connectionId);
  const baseId = useId();
  if (!connection) return null;

  const config = readConnectionConfig(connection);
  const mode = connectionMode(connection);
  const issue = connectionIssue(resources, connection, connections);
  const name = (id: string) => resources.find((r) => r.id === id)?.name ?? id;
  const sgNames = [
    ...new Set(
      derivedSgRules(resources, connections)
        .filter((rule) => rule.connectionId === connection.id)
        .map((rule) => name(rule.sgId)),
    ),
  ];
  // Caminho: regra de listener (ALB → destino) ou comportamento (CloudFront → origem).
  const sourceType = resources.find((r) => r.id === connection.source)?.type;
  const routesByPath =
    (sourceType === 'aws.alb' && connection.kind === 'association') ||
    sourceType === 'aws.cloudfront';
  const patch = (values: Record<string, unknown>) =>
    dispatch(updateCloudConnection({ id: connection.id, patch: values }));

  return (
    <aside aria-label={c.title} className="panel flex min-h-0 flex-col">
      <div className="panel-header justify-start">
        <ArrowLeftRight
          size={18}
          aria-hidden="true"
          className="shrink-0 text-chalk-dim"
        />
        <div className="min-w-0">
          <h2 className="panel-title truncate">{c.title}</h2>
          <p className="text-label truncate text-chalk-faint">
            {name(connection.source)} → {name(connection.target)}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        {issue && (
          <p
            role="alert"
            className="flex gap-2 rounded-sm border border-signal-warn/40 bg-signal-warn/10 px-2.5 py-2 text-2xs leading-4 text-chalk"
          >
            <AlertTriangle
              size={13}
              aria-hidden="true"
              className="mt-px shrink-0 text-signal-warn"
            />
            {issue[language]}
          </p>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-chalk-dim">{c.from}</dt>
          <dd>
            <button
              type="button"
              onClick={() => dispatch(selectCloudResource(connection.source))}
              className="text-chalk underline-offset-2 hover:underline"
            >
              {name(connection.source)}
            </button>
          </dd>
          <dt className="text-chalk-dim">{c.to}</dt>
          <dd>
            <button
              type="button"
              onClick={() => dispatch(selectCloudResource(connection.target))}
              className="text-chalk underline-offset-2 hover:underline"
            >
              {name(connection.target)}
            </button>
          </dd>
        </dl>

        <div>
          <label
            htmlFor={`${baseId}-kind`}
            className="mb-1 block text-xs font-medium text-chalk-dim"
          >
            {c.kind}
          </label>
          <select
            id={`${baseId}-kind`}
            value={connection.kind}
            onChange={(e) =>
              dispatch(
                updateCloudConnection({
                  id: connection.id,
                  kind: e.target.value as ConnectionKind,
                }),
              )
            }
            className="field-sm"
          >
            {CONNECTION_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {c.kinds[kind]}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-chalk-dim">
            {c.mode}
          </legend>
          <div className="space-y-1.5">
            {MODES.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-2"
              >
                <input
                  type="radio"
                  name={`${baseId}-mode`}
                  checked={mode === option}
                  onChange={() =>
                    dispatch(
                      setCloudConnectionMode({
                        id: connection.id,
                        mode: option,
                      }),
                    )
                  }
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
                />
                <span>
                  <span className="block text-xs text-chalk">
                    {c.modes[option]}
                  </span>
                  <span className="block text-2xs leading-4 text-chalk-faint">
                    {c.modeHelp[option]}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mode === 'one-way' && (
              <button
                type="button"
                onClick={() => dispatch(reverseCloudConnection(connection.id))}
                className="btn btn-secondary btn-sm"
              >
                <ArrowLeftRight size={13} aria-hidden="true" />
                {c.reverse}
              </button>
            )}
            {mode === 'pair' && connection.pairId && (
              <button
                type="button"
                onClick={() =>
                  dispatch(selectCloudConnection(connection.pairId))
                }
                className="btn btn-secondary btn-sm"
              >
                {c.partner}
              </button>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-label mb-2 text-chalk-faint">
            {copy.sectionConfig}
          </legend>
          <div className="flex gap-2">
            <div>
              <label
                htmlFor={`${baseId}-protocol`}
                className="mb-1 block text-xs font-medium text-chalk-dim"
              >
                {c.protocol}
              </label>
              <select
                id={`${baseId}-protocol`}
                value={config.protocol}
                onChange={(e) => {
                  const protocol = e.target.value as RuleProtocol;
                  patch({
                    protocol,
                    ports: usesPorts(protocol) ? config.ports || '443' : '',
                  });
                }}
                className="field-sm w-auto"
              >
                {PROTOCOLS.map((p) => (
                  <option key={p} value={p}>
                    {sec.protocols[p]}
                  </option>
                ))}
              </select>
            </div>
            {usesPorts(config.protocol) && (
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`${baseId}-ports`}
                  className="mb-1 block text-xs font-medium text-chalk-dim"
                >
                  {c.ports}
                </label>
                <input
                  id={`${baseId}-ports`}
                  value={config.ports}
                  onChange={(e) => patch({ ports: e.target.value })}
                  className="field-sm font-mono tabular-nums"
                />
              </div>
            )}
          </div>
          {routesByPath && (
            <div>
              <label
                htmlFor={`${baseId}-path`}
                className="mb-1 block text-xs font-medium text-chalk-dim"
              >
                {c.pathPattern}
              </label>
              <input
                id={`${baseId}-path`}
                value={String(connection.config.pathPattern ?? '')}
                placeholder="/api/*"
                aria-describedby={`${baseId}-path-help`}
                onChange={(e) => patch({ pathPattern: e.target.value })}
                className="field-sm font-mono"
              />
              <p
                id={`${baseId}-path-help`}
                className="mt-1 text-2xs leading-4 text-chalk-faint"
              >
                {c.pathHelp}
              </p>
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-chalk">
            <input
              type="checkbox"
              checked={config.encrypted}
              onChange={(e) => patch({ encrypted: e.target.checked })}
              className="h-3.5 w-3.5 accent-accent"
            />
            {c.encrypted}
          </label>
          <p className="text-2xs leading-4 text-chalk-faint">
            {sgNames.length ? c.sgRule(sgNames.join(', ')) : c.noSgRule}
          </p>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-label mb-2 text-chalk-faint">
            {copy.sectionOperation}
          </legend>
          <div>
            <label
              htmlFor={`${baseId}-gb`}
              className="mb-1 block text-xs font-medium text-chalk-dim"
            >
              {c.gbMonth}
            </label>
            <input
              id={`${baseId}-gb`}
              type="number"
              min={0}
              value={config.gbMonth}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (e.target.value !== '' && !Number.isNaN(value))
                  patch({ gbMonth: Math.max(0, value) });
              }}
              className="field-sm font-mono tabular-nums"
            />
          </div>
        </fieldset>
      </div>

      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={() => {
            dispatch(removeCloudConnection(connection.id));
            onDeleted();
          }}
          className="btn btn-ghost btn-sm w-full justify-center text-signal-down hover:bg-signal-down/10 hover:text-signal-down"
        >
          <Trash2 size={14} aria-hidden="true" />
          {c.remove}
        </button>
      </div>
    </aside>
  );
}
