import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import {
  selectCloudResource,
  updateCloudResourceConfig,
} from '../../features/cloud/cloudSlice';
import {
  blockSize,
  parseCidr,
  subnetCapacity,
} from '../../features/cloud/engines/ip';
import { usedInSubnet } from '../../features/cloud/engines/addressing';
import { routeTableOfSubnet } from '../../features/cloud/engines/routing';
import {
  cidrIssueText,
  cidrOf,
  subnetCidrIssue,
  subnetsOfVpc,
  subnetTier,
  VPC_TYPE,
  zoneName,
} from '../../features/cloud/network';
import type { CloudResource } from '../../features/cloud/types';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';
import VpcFilter from './VpcFilter';

const TIER_DOT: Record<ReturnType<typeof subnetTier>, string> = {
  public: 'bg-aws-subnet-public',
  private: 'bg-aws-subnet-private',
  isolated: 'bg-chalk-faint',
};

/**
 * Aba "IPs (IPAM)": uma linha por subnet, agrupada por VPC, com CIDR
 * editável na linha (mesma validação do inspetor), capacidade descontando
 * os 5 reservados da AWS e o total alocado × livre de cada VPC. Clicar no
 * nome seleciona a subnet no canvas. "Usados" fica em 0 até haver recursos
 * com IP nas subnets.
 */
export default function CloudIpamTable({
  language,
}: {
  language: AppLanguage;
}) {
  const dispatch = useAppDispatch();
  const copy = getCloudCopy(language);
  const { resources, ui } = useAppSelector((state) => state.cloud);
  const [vpcFilter, setVpcFilter] = useState('');

  const vpcs = resources.filter((r) => r.type === VPC_TYPE);
  const shown = vpcFilter ? vpcs.filter((v) => v.id === vpcFilter) : vpcs;
  const hasSubnets = vpcs.some(
    (vpc) => subnetsOfVpc(resources, vpc.id).length > 0,
  );
  const columns = copy.ipamColumns;

  if (!hasSubnets) {
    return (
      <p className="px-4 py-6 text-xs text-chalk-faint">{copy.ipamEmpty}</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2">
        <VpcFilter
          vpcs={vpcs}
          value={vpcFilter}
          onChange={setVpcFilter}
          language={language}
          allowAll
        />
        <p className="text-2xs text-chalk-faint">{copy.ipamUsedHint}</p>
      </div>

      <div className="relative overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col" className="text-left">
                {columns.vpc}
              </th>
              <th scope="col" className="text-left">
                {columns.az}
              </th>
              <th scope="col" className="text-left">
                {columns.subnet}
              </th>
              <th scope="col" className="text-left">
                {columns.tier}
              </th>
              <th scope="col" className="text-left">
                {columns.cidr}
              </th>
              <th scope="col" className="text-right">
                {columns.usable}
              </th>
              <th scope="col" className="text-right">
                {columns.used}
              </th>
              <th scope="col" className="text-right">
                {columns.free}
              </th>
              <th scope="col" className="text-left">
                {columns.range}
              </th>
              <th scope="col" className="text-left">
                {copy.ipamRouteTable}
              </th>
              <th scope="col" className="text-left">
                {copy.ipamNacl}
              </th>
            </tr>
          </thead>
          {shown.map((vpc) => {
            const subnets = subnetsOfVpc(resources, vpc.id);
            const vpcBlock = parseCidr(cidrOf(vpc));
            const vpcSize = vpcBlock ? blockSize(vpcBlock.prefix) : 0;
            const allocated = subnets.reduce((sum, subnet) => {
              const block = parseCidr(cidrOf(subnet));
              return sum + (block ? blockSize(block.prefix) : 0);
            }, 0);
            return (
              <tbody key={vpc.id}>
                {subnets.map((subnet) => (
                  <IpamRow
                    key={subnet.id}
                    vpc={vpc}
                    subnet={subnet}
                    resources={resources}
                    selected={ui.selectedResourceId === subnet.id}
                    language={language}
                    onSelect={() => dispatch(selectCloudResource(subnet.id))}
                    onCommit={(cidr) =>
                      dispatch(
                        updateCloudResourceConfig({
                          id: subnet.id,
                          patch: { cidr },
                        }),
                      )
                    }
                  />
                ))}
                <tr>
                  <td
                    colSpan={11}
                    className="bg-ink-raised-2/40 text-2xs text-chalk-dim"
                  >
                    <span className="font-medium text-chalk">{vpc.name}</span>{' '}
                    <span className="font-mono">{cidrOf(vpc)}</span>
                    {' · '}
                    <span className="tabular-nums">
                      {copy.ipamVpcTotal(
                        allocated,
                        vpcSize,
                        Math.max(0, vpcSize - allocated),
                      )}
                    </span>
                  </td>
                </tr>
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}

function IpamRow({
  vpc,
  subnet,
  resources,
  selected,
  language,
  onSelect,
  onCommit,
}: {
  vpc: CloudResource;
  subnet: CloudResource;
  resources: CloudResource[];
  selected: boolean;
  language: AppLanguage;
  onSelect: () => void;
  onCommit: (cidr: string) => void;
}) {
  const copy = getCloudCopy(language);
  const saved = cidrOf(subnet);
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);

  const issue = subnetCidrIssue(resources, subnet, draft);
  const error = issue ? cidrIssueText(issue)[language] : null;
  const capacity = issue ? null : subnetCapacity(saved);
  const used = usedInSubnet(resources, subnet.id);
  const tier = subnetTier(subnet);
  const az = resources.find((r) => r.id === subnet.parentId);
  const errorId = `${subnet.id}-cidr-error`;

  const commit = () => {
    const value = draft.trim();
    if (value !== saved) onCommit(value);
  };

  return (
    <tr className={selected ? 'bg-accent/[0.06]' : ''}>
      <td className="whitespace-nowrap">{vpc.name}</td>
      <td className="whitespace-nowrap font-mono">
        {az ? zoneName(resources, az) : '—'}
      </td>
      <td className="whitespace-nowrap">
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="text-left text-chalk underline-offset-2 hover:underline"
        >
          {subnet.name}
        </button>
      </td>
      <td className="whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${TIER_DOT[tier]}`}
          />
          {copy.tiers[tier]}
        </span>
      </td>
      <td>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            } else if (event.key === 'Escape') {
              setDraft(saved);
            }
          }}
          aria-label={copy.ipamEditCidr(subnet.name)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          className={`field-sm w-36 font-mono tabular-nums ${error ? 'border-signal-down' : ''}`}
        />
        {error && (
          <p
            id={errorId}
            className="mt-0.5 max-w-[220px] text-2xs leading-4 text-signal-down"
          >
            {error}
          </p>
        )}
      </td>
      <td className="text-right font-mono tabular-nums">
        {capacity?.usable ?? '—'}
      </td>
      <td className="text-right font-mono tabular-nums">{used}</td>
      <td className="text-right font-mono tabular-nums">
        {capacity ? Math.max(0, capacity.usable - used) : '—'}
      </td>
      <td className="whitespace-nowrap font-mono tabular-nums">
        {capacity?.firstUsable
          ? `${capacity.firstUsable} – ${capacity.lastUsable}`
          : '—'}
      </td>
      <td className="whitespace-nowrap font-mono">
        {routeTableOfSubnet(resources, subnet)?.name ?? '—'}
      </td>
      <td className="whitespace-nowrap">
        {resources.find((r) => r.id === subnet.config.naclId)?.name ?? (
          <span className="text-chalk-faint">{copy.naclDefault}</span>
        )}
      </td>
    </tr>
  );
}
