import { Plus, Trash2 } from 'lucide-react';
import { Fragment, useId, useState, type FormEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  selectCloudResource,
  updateCloudResourceConfig,
} from '../../features/cloud/cloudSlice';
import { parseCidr } from '../../features/cloud/engines/ip';
import {
  deriveRouteTables,
  readManualRoutes,
  routeTargetsOf,
  type Route,
  type RouteTable,
} from '../../features/cloud/engines/routing';
import { cidrOf, VPC_TYPE } from '../../features/cloud/network';
import type { CloudResource } from '../../features/cloud/types';
import { makeServiceId } from '../../services/_core/id';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';
import VpcFilter from './VpcFilter';

/**
 * Aba "Rotas": as route tables derivadas de cada VPC (ver
 * `engines/routing.ts`) com subnets associadas, destino, alvo e origem.
 * Rota que falta (pública sem IGW) aparece em vermelho; NAT de outra AZ,
 * marcada. Rotas manuais são acrescentadas/removidas aqui.
 */
export default function CloudRoutesTable({
  language,
}: {
  language: AppLanguage;
}) {
  const copy = getCloudCopy(language);
  const resources = useAppSelector((state) => state.cloud.resources);
  const vpcs = resources.filter((r) => r.type === VPC_TYPE);
  const [vpcFilter, setVpcFilter] = useState('');
  const shown = vpcFilter ? vpcs.filter((v) => v.id === vpcFilter) : vpcs;
  const withTables = shown
    .map((vpc) => ({ vpc, tables: deriveRouteTables(resources, vpc.id) }))
    .filter((item) => item.tables.length > 0);

  if (!vpcs.some((vpc) => deriveRouteTables(resources, vpc.id).length > 0)) {
    return (
      <p className="px-4 py-6 text-xs text-chalk-faint">{copy.routes.empty}</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2">
        <VpcFilter
          vpcs={vpcs}
          value={vpcFilter}
          onChange={setVpcFilter}
          language={language}
          allowAll
        />
        <p className="text-2xs text-chalk-faint">{copy.routes.hint}</p>
      </div>
      {withTables.map(({ vpc, tables }) => (
        <VpcRoutes
          key={vpc.id}
          vpc={vpc}
          tables={tables}
          resources={resources}
          language={language}
        />
      ))}
    </div>
  );
}

function VpcRoutes({
  vpc,
  tables,
  resources,
  language,
}: {
  vpc: CloudResource;
  tables: RouteTable[];
  resources: CloudResource[];
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const columns = copy.routes.columns;
  const subnetName = (id: string) =>
    resources.find((r) => r.id === id)?.name ?? id;

  const removeManual = (manualId: string) =>
    dispatch(
      updateCloudResourceConfig({
        id: vpc.id,
        patch: {
          manualRoutes: readManualRoutes(vpc).filter((r) => r.id !== manualId),
        },
      }),
    );

  return (
    <section
      aria-label={`${vpc.name} · ${copy.routes.tab}`}
      className="space-y-2"
    >
      <h3 className="px-3 text-xs font-semibold text-chalk">
        {vpc.name}{' '}
        <span className="font-mono font-normal text-chalk-dim">
          {cidrOf(vpc)}
        </span>
      </h3>
      <div className="relative overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col" className="text-left">
                {columns.table}
              </th>
              <th scope="col" className="text-left">
                {columns.subnets}
              </th>
              <th scope="col" className="text-left">
                {columns.destination}
              </th>
              <th scope="col" className="text-left">
                {columns.target}
              </th>
              <th scope="col" className="text-left">
                {columns.origin}
              </th>
              <th scope="col" className="w-8">
                <span className="sr-only">{copy.routes.remove}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => {
              const hasDefault = table.routes.some(
                (r) => r.destination === '0.0.0.0/0',
              );
              const rows = table.routes.length;
              return (
                <Fragment key={table.key}>
                  {table.routes.map((route, index) => (
                    <tr key={`${table.key}-${index}`}>
                      {index === 0 && (
                        <>
                          <th
                            scope="rowgroup"
                            rowSpan={rows}
                            className="whitespace-nowrap border-b border-line text-left !align-top font-mono text-xs font-normal normal-case tracking-normal text-chalk"
                          >
                            {table.name}
                            {table.kind === 'private' && !hasDefault && (
                              <span className="mt-1 block font-sans text-2xs text-chalk-faint">
                                {copy.routes.noEgress}
                              </span>
                            )}
                          </th>
                          <td rowSpan={rows} className="!align-top">
                            <ul className="space-y-0.5">
                              {table.subnetIds.map((id) => (
                                <li key={id}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      dispatch(selectCloudResource(id))
                                    }
                                    className="text-left text-chalk underline-offset-2 hover:underline"
                                  >
                                    {subnetName(id)}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </>
                      )}
                      <td className="whitespace-nowrap font-mono tabular-nums text-chalk">
                        {route.destination}
                      </td>
                      <td className="whitespace-nowrap">
                        <TargetCell route={route} language={language} />
                      </td>
                      <td className="whitespace-nowrap">
                        {copy.routes.origin[route.origin]}
                      </td>
                      <td>
                        {route.manualId && (
                          <button
                            type="button"
                            onClick={() => removeManual(route.manualId!)}
                            aria-label={`${copy.routes.remove} ${route.destination}`}
                            title={copy.routes.remove}
                            className="rounded-[2px] p-1 text-chalk-faint hover:bg-signal-down/15 hover:text-signal-down"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <ManualRouteForm
        vpc={vpc}
        tables={tables}
        resources={resources}
        language={language}
      />
    </section>
  );
}

function TargetCell({
  route,
  language,
}: {
  route: Route;
  language: AppLanguage;
}) {
  const copy = getCloudCopy(language);
  const { target } = route;
  if (target.kind === 'missing') {
    return (
      <span className="font-medium text-signal-down">
        {copy.routes.targets.missing}
      </span>
    );
  }
  if (target.kind === 'local') return <span className="font-mono">local</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-chalk-dim">{copy.routes.targets[target.kind]}</span>
      <span className="text-chalk">{target.label}</span>
      {route.crossAz && (
        <span className="chip text-signal-warn">{copy.routes.crossAz}</span>
      )}
    </span>
  );
}

function ManualRouteForm({
  vpc,
  tables,
  resources,
  language,
}: {
  vpc: CloudResource;
  tables: RouteTable[];
  resources: CloudResource[];
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const id = useId();
  const targets = routeTargetsOf(resources, vpc.id);
  const [table, setTable] = useState(tables[0]?.key ?? '');
  const [destination, setDestination] = useState('');
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const validTable = tables.some((t) => t.key === table)
    ? table
    : (tables[0]?.key ?? '');
  const validTarget = targets.some((t) => t.id === targetId)
    ? targetId
    : (targets[0]?.id ?? '');
  const canAdd = Boolean(validTable && validTarget && parseCidr(destination));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canAdd) return;
    dispatch(
      updateCloudResourceConfig({
        id: vpc.id,
        patch: {
          manualRoutes: [
            ...readManualRoutes(vpc),
            {
              id: makeServiceId('route'),
              table: validTable,
              destination: destination.trim(),
              targetId: validTarget,
            },
          ],
        },
      }),
    );
    setDestination('');
  }

  if (targets.length === 0) return null;

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={copy.routes.addTitle}
      className="flex flex-wrap items-end gap-2 px-3"
    >
      <label
        htmlFor={`${id}-table`}
        className="flex flex-col gap-1 text-2xs text-chalk-dim"
      >
        {copy.routes.tableLabel}
        <select
          id={`${id}-table`}
          value={validTable}
          onChange={(e) => setTable(e.target.value)}
          className="field-sm w-auto font-mono"
        >
          {tables.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label
        htmlFor={`${id}-dest`}
        className="flex flex-col gap-1 text-2xs text-chalk-dim"
      >
        {copy.routes.destinationLabel}
        <input
          id={`${id}-dest`}
          value={destination}
          placeholder="192.168.0.0/16"
          onChange={(e) => setDestination(e.target.value)}
          className="field-sm w-40 font-mono"
        />
      </label>
      <label
        htmlFor={`${id}-target`}
        className="flex flex-col gap-1 text-2xs text-chalk-dim"
      >
        {copy.routes.targetLabel}
        <select
          id={`${id}-target`}
          value={validTarget}
          onChange={(e) => setTargetId(e.target.value)}
          className="field-sm w-auto"
        >
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={!canAdd}
        className="btn btn-secondary btn-sm"
      >
        <Plus size={13} aria-hidden="true" />
        {copy.routes.add}
      </button>
    </form>
  );
}
