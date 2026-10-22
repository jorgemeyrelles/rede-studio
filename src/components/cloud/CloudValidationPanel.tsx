import {
  AlertTriangle,
  CircleCheck,
  CircleX,
  Crosshair,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  selectCloudConnection,
  selectCloudResource,
} from '../../features/cloud/cloudSlice';
import { getCatalogEntry } from '../../features/cloud/catalog';
import {
  VALIDATION_SEVERITIES,
  type ValidationItem,
  type ValidationSeverity,
} from '../../features/cloud/engines/validation';
import { ancestorsOf, isOnCanvas } from '../../features/cloud/tree';
import type { CloudResource } from '../../features/cloud/types';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';
import { focusOnCanvas } from './focusOnCanvas';

const SEVERITY: Record<ValidationSeverity, { icon: LucideIcon; tone: string }> =
  {
    error: { icon: CircleX, tone: 'text-signal-down' },
    warning: { icon: AlertTriangle, tone: 'text-signal-warn' },
    tip: { icon: Lightbulb, tone: 'text-chalk-dim' },
  };

/** O próprio elemento ou, se ele não aparece no canvas (SG, NACL), o container mais próximo que aparece. */
function canvasTarget(resources: CloudResource[], resource: CloudResource) {
  if (isOnCanvas(resource)) return resource.id;
  return ancestorsOf(resources, resource.id).find(isOnCanvas)?.id ?? null;
}

/**
 * Aba "Validação": tudo o que o rascunho precisa resolver, consolidado pelo
 * motor (`engines/validation.ts`) — erros que bloqueiam o Terraform, avisos
 * e dicas de boas práticas. Filtra por severidade; o botão do elemento o
 * seleciona e enquadra no canvas.
 */
export default function CloudValidationPanel({
  language,
  items,
  counts,
  pricesPending,
}: {
  language: AppLanguage;
  items: ValidationItem[];
  counts: Record<ValidationSeverity, number>;
  pricesPending: boolean;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const c = copy.validation;
  const { resources, connections } = useAppSelector((state) => state.cloud);
  const [filter, setFilter] = useState<ValidationSeverity | 'all'>('all');
  const visible =
    filter === 'all' ? items : items.filter((i) => i.severity === filter);

  const element = (item: ValidationItem) => {
    if (item.connectionId) {
      const connection = connections.find((x) => x.id === item.connectionId);
      const name = (id?: string) =>
        resources.find((r) => r.id === id)?.name ?? '—';
      return {
        name: `${name(connection?.source)} → ${name(connection?.target)}`,
        type: null,
        locate: () => {
          if (!connection) return;
          dispatch(selectCloudConnection(connection.id));
          focusOnCanvas([connection.source, connection.target]);
        },
      };
    }
    const resource = resources.find((r) => r.id === item.resourceId);
    if (!resource) return { name: c.project, type: null, locate: null };
    return {
      name: resource.name,
      type: getCatalogEntry(resource.type)?.label[language] ?? resource.type,
      locate: () => {
        dispatch(selectCloudResource(resource.id));
        const target = canvasTarget(resources, resource);
        if (target) focusOnCanvas([target]);
      },
    };
  };

  const filters: {
    id: ValidationSeverity | 'all';
    label: string;
    n: number;
  }[] = [
    { id: 'all', label: c.all, n: items.length },
    ...VALIDATION_SEVERITIES.map((severity) => ({
      id: severity,
      label: c.severities[severity],
      n: counts[severity],
    })),
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <p className="max-w-2xl text-xs leading-5 text-chalk-dim">{c.hint}</p>
        <div
          role="group"
          aria-label={c.filterLabel}
          className="inline-flex rounded-sm border border-line bg-ink p-0.5"
        >
          {filters.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
              className={`rounded-[1px] px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === option.id
                  ? 'bg-ink-raised-2 text-chalk'
                  : 'text-chalk-dim hover:text-chalk'
              }`}
            >
              {option.label}
              <span className="ml-1.5 font-mono tabular-nums text-chalk-faint">
                {option.n}
              </span>
            </button>
          ))}
        </div>
      </div>

      {pricesPending && (
        <p className="px-4 pb-3 text-2xs leading-4 text-chalk-faint">
          {c.pricesPending}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="flex items-center gap-2 px-4 pb-6 pt-2 text-xs text-chalk-faint">
          {items.length === 0 && (
            <CircleCheck
              size={14}
              aria-hidden="true"
              className="text-signal-up"
            />
          )}
          {items.length === 0 ? c.empty : c.emptyFiltered}
        </p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col" className="text-left">
                  {c.columns.severity}
                </th>
                <th scope="col" className="text-left">
                  {c.columns.rule}
                </th>
                <th scope="col" className="text-left">
                  {c.columns.element}
                </th>
                <th scope="col" className="text-left">
                  {c.columns.fix}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const { icon: Icon, tone } = SEVERITY[item.severity];
                const target = element(item);
                return (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 ${tone}`}
                      >
                        <Icon size={13} aria-hidden="true" />
                        {c.severities[item.severity]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-chalk">
                      {item.rule[language]}
                    </td>
                    <td className="whitespace-nowrap">
                      {target.locate ? (
                        <button
                          type="button"
                          onClick={target.locate}
                          className="group inline-flex items-center gap-1.5 text-left text-chalk hover:text-accent"
                        >
                          <Crosshair
                            size={12}
                            aria-hidden="true"
                            className="shrink-0 text-chalk-faint group-hover:text-accent"
                          />
                          <span>
                            {target.name}
                            {target.type && (
                              <span className="ml-1.5 text-chalk-faint">
                                {target.type}
                              </span>
                            )}
                          </span>
                        </button>
                      ) : (
                        <span className="text-chalk-dim">{target.name}</span>
                      )}
                    </td>
                    <td className="min-w-[18rem] leading-5">
                      {item.message[language]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
