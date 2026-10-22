import { useId, useState, type FormEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  selectCloudResource,
  updateCloudResourceConfig,
} from '../../features/cloud/cloudSlice';
import { getCatalogEntry, getFieldOptions } from '../../features/cloud/catalog';
import { readIdList } from '../../features/cloud/engines/addressing';
import { azCountOf } from '../../features/cloud/network';
import {
  effectiveTags,
  INHERITED_TAGS,
  tagOverridePatch,
  type InheritedTag,
} from '../../features/cloud/tags';
import type { CloudResource } from '../../features/cloud/types';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';

const OPERATED_TYPES = [
  'aws.ec2',
  'aws.asg',
  'aws.alb',
  'aws.nlb',
  'aws.rds',
  'aws.s3',
  'aws.nat',
];

const num = (value: unknown) => (typeof value === 'number' ? value : null);
const text = (value: unknown) =>
  typeof value === 'string' && value ? value : null;

/** Tamanho/classe e quantidade como a operação enxerga. */
function sizeAndQuantity(resource: CloudResource) {
  const c = resource.config;
  switch (resource.type) {
    case 'aws.ec2':
      return { size: text(c.instanceType), quantity: '1' };
    case 'aws.asg':
      return {
        size: text(c.instanceType),
        quantity: `${num(c.minSize)} / ${num(c.desiredSize)} / ${num(c.maxSize)}`,
      };
    case 'aws.rds':
      return {
        size: text(c.instanceClass),
        quantity: c.multiAz === true ? '2' : '1',
      };
    case 'aws.alb':
    case 'aws.nlb':
      return {
        size: `${num(c.lcuPerHour) ?? 0} LCU`,
        quantity: String(readIdList(c.subnetIds).length),
      };
    case 'aws.s3':
      return { size: `${num(c.storageGbMonth) ?? 0} GB`, quantity: '—' };
    default:
      return { size: null, quantity: '1' };
  }
}

function multiAz(
  resource: CloudResource,
  resources: CloudResource[],
): boolean | null {
  if (resource.type === 'aws.rds') return resource.config.multiAz === true;
  if (['aws.asg', 'aws.alb', 'aws.nlb'].includes(resource.type)) {
    return azCountOf(resources, readIdList(resource.config.subnetIds)) >= 2;
  }
  return null;
}

/**
 * Aba "Operação": como cada recurso roda (tamanho, quantidade, Multi-AZ,
 * backup, monitoramento) e suas tags efetivas. Seleção de linhas para
 * aplicar Owner/CostCenter/Environment em massa (como sobrescrita, igual
 * ao inspetor) e o ambiente do projeto (na conta, herdado por tudo).
 */
export default function CloudOperationTable({
  language,
}: {
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const resources = useAppSelector((state) => state.cloud.resources);
  const rows = resources.filter((r) => OPERATED_TYPES.includes(r.type));
  const account = resources.find((r) => r.type === 'aws.account');
  const environments = getFieldOptions('aws.account', 'environment');
  const [checked, setChecked] = useState<string[]>([]);
  const [tag, setTag] = useState<InheritedTag>('Owner');
  const [tagValue, setTagValue] = useState('');
  const envId = useId();
  const tagId = useId();
  const columns = copy.operationColumns;
  const selected = checked.filter((id) => rows.some((r) => r.id === id));

  function applyTag(event: FormEvent) {
    event.preventDefault();
    for (const id of selected) {
      const resource = resources.find((r) => r.id === id);
      if (resource)
        dispatch(
          updateCloudResourceConfig({
            id,
            patch: tagOverridePatch(resource, tag, tagValue.trim()),
          }),
        );
    }
  }

  if (rows.length === 0)
    return (
      <p className="px-4 py-6 text-xs text-chalk-faint">
        {copy.operationEmpty}
      </p>
    );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-3 px-3 pt-2">
        {account && (
          <label
            htmlFor={envId}
            className="flex items-center gap-2 text-xs text-chalk-dim"
          >
            {copy.projectEnvironment}
            <select
              id={envId}
              value={String(account.config.environment ?? '')}
              onChange={(e) =>
                dispatch(
                  updateCloudResourceConfig({
                    id: account.id,
                    patch: { environment: e.target.value },
                  }),
                )
              }
              className="field-sm w-auto"
            >
              {environments.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label[language]}
                </option>
              ))}
            </select>
          </label>
        )}
        <form onSubmit={applyTag} className="flex flex-wrap items-center gap-2">
          <span className="text-2xs text-chalk-dim">
            {copy.bulkTags(selected.length)}
          </span>
          <select
            aria-label={copy.tagsSection}
            value={tag}
            onChange={(e) => setTag(e.target.value as InheritedTag)}
            className="field-sm w-auto"
          >
            {INHERITED_TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {tag === 'Environment' ? (
            <select
              id={tagId}
              aria-label={tag}
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              className="field-sm w-auto"
            >
              <option value="">{copy.inheritOption('…')}</option>
              {environments.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label[language]}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={tagId}
              aria-label={tag}
              value={tagValue}
              placeholder={copy.inheritOption('…')}
              onChange={(e) => setTagValue(e.target.value)}
              className="field-sm w-44"
            />
          )}
          <button
            type="submit"
            disabled={selected.length === 0}
            className="btn btn-secondary btn-sm"
          >
            {copy.applyTag}
          </button>
        </form>
      </div>
      <div className="relative overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col" className="w-8">
                <input
                  type="checkbox"
                  aria-label={copy.bulkTags(rows.length)}
                  checked={selected.length === rows.length}
                  onChange={(e) =>
                    setChecked(e.target.checked ? rows.map((r) => r.id) : [])
                  }
                  className="h-3.5 w-3.5 accent-accent"
                />
              </th>
              <th scope="col" className="text-left">
                {columns.resource}
              </th>
              <th scope="col" className="text-left">
                {columns.size}
              </th>
              <th scope="col" className="text-left">
                {columns.quantity}
              </th>
              <th scope="col" className="text-left">
                {columns.multiAz}
              </th>
              <th scope="col" className="text-left">
                {columns.backup}
              </th>
              <th scope="col" className="text-left">
                {columns.monitoring}
              </th>
              <th scope="col" className="text-left">
                {columns.tags}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((resource) => {
              const { size, quantity } = sizeAndQuantity(resource);
              const ha = multiAz(resource, resources);
              const tags = effectiveTags(resources, resource.id);
              const backup =
                resource.type === 'aws.rds'
                  ? `${num(resource.config.backupRetentionDays) ?? 0} d`
                  : resource.type === 'aws.s3'
                    ? resource.config.versioning === true
                      ? 'versioning'
                      : '—'
                    : '—';
              const monitoring =
                resource.config.detailedMonitoring === undefined
                  ? '—'
                  : resource.config.detailedMonitoring
                    ? '1 min'
                    : '5 min';
              return (
                <tr key={resource.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={copy.selectRow(resource.name)}
                      checked={selected.includes(resource.id)}
                      onChange={(e) =>
                        setChecked((current) =>
                          e.target.checked
                            ? [...current, resource.id]
                            : current.filter((id) => id !== resource.id),
                        )
                      }
                      className="h-3.5 w-3.5 accent-accent"
                    />
                  </td>
                  <td className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => dispatch(selectCloudResource(resource.id))}
                      className="text-left text-chalk underline-offset-2 hover:underline"
                    >
                      {resource.name}
                    </button>
                    <span className="ml-1.5 text-2xs text-chalk-faint">
                      {getCatalogEntry(resource.type)?.label[language]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap font-mono">{size ?? '—'}</td>
                  <td className="whitespace-nowrap font-mono tabular-nums">
                    {quantity}
                  </td>
                  <td>{ha === null ? '—' : ha ? copy.yes : copy.no}</td>
                  <td className="whitespace-nowrap font-mono">{backup}</td>
                  <td className="whitespace-nowrap font-mono">{monitoring}</td>
                  <td className="whitespace-nowrap">
                    <span className="flex flex-wrap gap-1">
                      {tags
                        .filter((t) => t.value)
                        .map((t) => (
                          <span
                            key={t.tag}
                            className={`chip ${t.inherited ? '' : 'text-chalk'}`}
                            title={t.tag}
                          >
                            {t.value}
                          </span>
                        ))}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
