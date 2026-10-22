import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  reparentCloudResource,
  selectCloudResource,
  updateCloudResourceConfig,
} from '../../features/cloud/cloudSlice';
import { getCatalogEntry } from '../../features/cloud/catalog';
import {
  allAddresses,
  ec2InternalDns,
  FIXED_IP_TYPES,
  privateIpIssue,
  readIdList,
  suggestIpInSubnet,
} from '../../features/cloud/engines/addressing';
import { securityGroupsOf } from '../../features/cloud/engines/connections';
import {
  regionCodeOf,
  subnetsOfVpc,
  vpcOf,
} from '../../features/cloud/network';
import type { CloudResource } from '../../features/cloud/types';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';
import { focusOnCanvas } from './focusOnCanvas';

const ADDRESSED_TYPES = [
  'aws.ec2',
  'aws.asg',
  'aws.alb',
  'aws.nlb',
  'aws.rds',
  'aws.nat',
];
/** Recursos que mudam de subnet pela tabela (os de borda da VPC, não). */
const MOVABLE_TYPES = ['aws.ec2', 'aws.asg', 'aws.rds', 'aws.nat'];

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '') || 'recurso';

/** DNS que a AWS dá ao recurso (o sufixo aleatório aparece como `xxxx`). */
function internalDns(resource: CloudResource, region: string): string | null {
  const ip =
    typeof resource.config.privateIp === 'string'
      ? resource.config.privateIp
      : '';
  switch (resource.type) {
    case 'aws.ec2':
      return ip ? ec2InternalDns(ip, region) : null;
    case 'aws.rds':
      return `${slug(resource.name)}.xxxx.${region}.rds.amazonaws.com`;
    case 'aws.alb':
    case 'aws.nlb':
      return `${resource.config.scheme === 'internal' ? 'internal-' : ''}${slug(resource.name)}-xxxx.${region}.elb.amazonaws.com`;
    default:
      return null;
  }
}

/**
 * Aba "Recursos e endereços": IP privado (fixo, editável, com "próximo
 * livre"; ou dinâmico), IP público, SGs e DNS interno de cada recurso com
 * endereço. Trocar a subnet move o recurso no canvas e refaz o IP.
 */
export default function CloudResourcesTable({
  language,
}: {
  language: AppLanguage;
}) {
  const copy = getCloudCopy(language);
  const resources = useAppSelector((state) => state.cloud.resources);
  const rows = resources.filter((r) => ADDRESSED_TYPES.includes(r.type));
  const columns = copy.resourceColumns;

  if (rows.length === 0)
    return (
      <p className="px-4 py-6 text-xs text-chalk-faint">
        {copy.resourcesEmpty}
      </p>
    );

  return (
    <div className="relative overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col" className="text-left">
              {columns.resource}
            </th>
            <th scope="col" className="text-left">
              {columns.type}
            </th>
            <th scope="col" className="text-left">
              {columns.subnet}
            </th>
            <th scope="col" className="text-left">
              {columns.privateIp}
            </th>
            <th scope="col" className="text-left">
              {columns.publicIp}
            </th>
            <th scope="col" className="text-left">
              {columns.sgs}
            </th>
            <th scope="col" className="text-left">
              {columns.dns}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((resource) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              resources={resources}
              language={language}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResourceRow({
  resource,
  resources,
  language,
}: {
  resource: CloudResource;
  resources: CloudResource[];
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const entry = getCatalogEntry(resource.type);
  const vpc = vpcOf(resources, resource.id);
  const region = regionCodeOf(resources, resource.id);
  const name = (id: string) => resources.find((r) => r.id === id)?.name ?? '—';
  const fixed = FIXED_IP_TYPES.includes(resource.type);
  const savedIp =
    typeof resource.config.privateIp === 'string'
      ? resource.config.privateIp
      : '';
  const [draft, setDraft] = useState(savedIp);
  useEffect(() => setDraft(savedIp), [savedIp]);
  const ipIssue = fixed ? privateIpIssue(resources, resource) : null;
  const dynamic = allAddresses(resources).filter(
    (a) => a.resourceId === resource.id && a.kind === 'dynamic',
  );
  const dynamicCount = dynamic.reduce((sum, a) => sum + a.count, 0);
  const subnetOptions = vpc
    ? subnetsOfVpc(resources, vpc.id).filter((s) =>
        entry?.parents.includes(s.type),
      )
    : [];
  const commitIp = (value: string) => {
    if (value !== savedIp)
      dispatch(
        updateCloudResourceConfig({
          id: resource.id,
          patch: { privateIp: value },
        }),
      );
  };

  const publicIp = (() => {
    switch (resource.type) {
      case 'aws.nat':
        return copy.publicIpKinds.eip;
      case 'aws.alb':
      case 'aws.nlb':
        return resource.config.scheme === 'internal'
          ? copy.publicIpKinds.none
          : copy.publicIpKinds.dns;
      case 'aws.ec2':
        return null; // checkbox
      default:
        return copy.publicIpKinds.none;
    }
  })();
  const label = `${resource.name} · ${copy.resourceColumns.privateIp}`;

  return (
    <tr>
      <td className="whitespace-nowrap">
        <button
          type="button"
          onClick={() => {
            dispatch(selectCloudResource(resource.id));
            focusOnCanvas([resource.id]);
          }}
          className="text-left text-chalk underline-offset-2 hover:underline"
        >
          {resource.name}
        </button>
      </td>
      <td className="whitespace-nowrap">
        {entry?.label[language] ?? resource.type}
      </td>
      <td className="whitespace-nowrap">
        {MOVABLE_TYPES.includes(resource.type) && subnetOptions.length > 1 ? (
          <select
            aria-label={`${resource.name} · ${copy.resourceColumns.subnet}`}
            value={resource.parentId ?? ''}
            onChange={(e) =>
              dispatch(
                reparentCloudResource({
                  id: resource.id,
                  parentId: e.target.value,
                }),
              )
            }
            className="field-sm w-auto"
          >
            {subnetOptions.map((subnet) => (
              <option key={subnet.id} value={subnet.id}>
                {subnet.name}
              </option>
            ))}
          </select>
        ) : resource.type === 'aws.alb' || resource.type === 'aws.nlb' ? (
          readIdList(resource.config.subnetIds).map(name).join(', ') || '—'
        ) : (
          name(resource.parentId ?? '')
        )}
      </td>
      <td>
        {fixed ? (
          <div className="flex items-center gap-1.5">
            <input
              aria-label={label}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => commitIp(draft.trim())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitIp(draft.trim());
                if (e.key === 'Escape') setDraft(savedIp);
              }}
              aria-invalid={Boolean(ipIssue) || undefined}
              className={`field-sm w-32 font-mono tabular-nums ${ipIssue ? 'border-signal-down' : ''}`}
            />
            <button
              type="button"
              onClick={() => {
                const next = resource.parentId
                  ? suggestIpInSubnet(resources, resource.parentId, resource.id)
                  : null;
                if (next) commitIp(next);
              }}
              className="btn btn-ghost btn-sm whitespace-nowrap"
            >
              {copy.assignNextIp}
            </button>
          </div>
        ) : (
          <span className="font-mono text-chalk-dim">
            {copy.dynamicIp(dynamicCount)}
          </span>
        )}
        {ipIssue && (
          <p className="mt-0.5 max-w-[240px] text-2xs leading-4 text-signal-down">
            {ipIssue[language]}
          </p>
        )}
        {resource.type === 'aws.rds' && dynamicCount > 0 && (
          <p className="mt-0.5 text-2xs text-chalk-faint">
            standby: {copy.dynamicIp(dynamicCount)}
          </p>
        )}
      </td>
      <td className="whitespace-nowrap">
        {publicIp === null ? (
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={resource.config.publicIp === true}
              onChange={(e) =>
                dispatch(
                  updateCloudResourceConfig({
                    id: resource.id,
                    patch: { publicIp: e.target.checked },
                  }),
                )
              }
              className="h-3.5 w-3.5 accent-accent"
            />
            {resource.config.publicIp === true
              ? copy.publicIpKinds.auto
              : copy.publicIpKinds.none}
          </label>
        ) : (
          publicIp
        )}
      </td>
      <td className="whitespace-nowrap">
        {securityGroupsOf(resource).map(name).join(', ') || '—'}
      </td>
      <td className="whitespace-nowrap font-mono text-2xs text-chalk-dim">
        {internalDns(resource, region) ?? '—'}
      </td>
    </tr>
  );
}
