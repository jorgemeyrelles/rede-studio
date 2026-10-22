import { useId } from 'react';
import { useAppSelector } from '../../app/hooks';
import type { CloudField } from '../../features/cloud/catalog';
import {
  AURORA_FALLBACK_CLASSES,
  CACHE_FALLBACK_NODES,
  EC2_FALLBACK_TYPES,
  RDS_FALLBACK_CLASSES,
  type InstanceSpec,
  isArmInstanceType,
} from '../../features/cloud/catalog/awsInstances';
import { readIdList } from '../../features/cloud/engines/addressing';
import { clustersFor, ecrReposFor } from '../../features/cloud/engines/compute';
import { deadLetterQueuesFor } from '../../features/cloud/engines/data';
import {
  alarmTopicsFor,
  backupTargetsFor,
  logGroupsFor,
  projectBucketsFor,
} from '../../features/cloud/engines/observability';
import {
  cognitoPoolsFor,
  kmsKeysFor,
  PARAMETER_TYPE,
  secretSourcesFor,
} from '../../features/cloud/engines/secrets';
import {
  certificateNames,
  certificatesFor,
  wafsFor,
  wafScopeOf,
  zonesFor,
} from '../../features/cloud/engines/edge';
import { SG_TYPE } from '../../features/cloud/engines/security';
import {
  cidrOf,
  regionCodeOf,
  subnetsOfVpc,
  subnetTier,
  VPC_TYPE,
  vpcOf,
} from '../../features/cloud/network';
import { useCloudPriceCatalogQuery } from '../../features/cloud/queries';
import type { CloudResource } from '../../features/cloud/types';
import type { AppLanguage } from '../../types/i18n';
import { getCloudCopy } from './cloudCopy';
import { NUMBER_LOCALE } from './money';

type PricedSpec = InstanceSpec & { usd: number | null; brl: number | null };

/** Tipo de cada alvo do AWS Backup na lista de marcar. */
const BACKUP_LABELS: Record<string, string> = {
  'aws.rds': 'RDS',
  'aws.aurora': 'Aurora',
  'aws.efs': 'EFS',
  'aws.dynamodb.table': 'DynamoDB',
  'aws.ec2': 'EC2',
};

type InstanceSource =
  | 'ec2InstanceTypes'
  | 'rdsInstanceClasses'
  | 'auroraInstanceClasses'
  | 'cacheNodeTypes';

type PriceItem = NonNullable<
  ReturnType<typeof useCloudPriceCatalogQuery>['data']
>['items'][number];

/** Itens do catálogo de preços que valem para o recurso, o atributo do tipo e a lista de reserva. */
function instanceSourceOf(
  source: InstanceSource,
  resource: CloudResource,
): {
  match: (item: PriceItem) => boolean;
  typeKey: string;
  fallback: InstanceSpec[];
} {
  const config = resource.config;
  switch (source) {
    case 'rdsInstanceClasses': {
      const engine = config.engine === 'mysql' ? 'MySQL' : 'PostgreSQL';
      const deployment = config.multiAz === true ? 'Multi-AZ' : 'Single-AZ';
      return {
        match: (item) =>
          item.resourceType === 'aws.rds.instance' &&
          item.attributes.engine === engine &&
          item.attributes.deployment === deployment,
        typeKey: 'instanceClass',
        fallback: RDS_FALLBACK_CLASSES,
      };
    }
    case 'auroraInstanceClasses': {
      const engine =
        config.engine === 'aurora-mysql' ? 'Aurora MySQL' : 'Aurora PostgreSQL';
      const storageMode =
        config.storageMode === 'io-optimized' ? 'io-optimized' : 'standard';
      return {
        match: (item) =>
          item.resourceType === 'aws.aurora.instance' &&
          item.attributes.engine === engine &&
          item.attributes.storageMode === storageMode,
        typeKey: 'instanceClass',
        fallback: AURORA_FALLBACK_CLASSES,
      };
    }
    case 'cacheNodeTypes': {
      const engine = config.engine === 'redis' ? 'Redis' : 'Valkey';
      return {
        match: (item) =>
          item.resourceType === 'aws.elasticache.node' &&
          item.attributes.engine === engine,
        typeKey: 'nodeType',
        fallback: CACHE_FALLBACK_NODES,
      };
    }
    default:
      return {
        match: (item) => item.resourceType === 'aws.ec2.instance',
        typeKey: 'instanceType',
        fallback: EC2_FALLBACK_TYPES,
      };
  }
}

const SIZE_ORDER = [
  'nano',
  'micro',
  'small',
  'medium',
  'large',
  'xlarge',
  '2xlarge',
  '4xlarge',
  '8xlarge',
  '12xlarge',
  '16xlarge',
  '24xlarge',
  '32xlarge',
];
const sizeRank = (type: string) =>
  SIZE_ORDER.indexOf(type.split('.').pop() ?? '');

/** Ordena por família e depois por tamanho (t3.nano, t3.micro… m6i.large…). */
function byFamilyAndSize(a: InstanceSpec, b: InstanceSpec) {
  const family = (t: string) => t.split('.').slice(0, -1).join('.');
  return (
    family(a.type).localeCompare(family(b.type)) ||
    sizeRank(a.type) - sizeRank(b.type)
  );
}

const num = (value: unknown) =>
  typeof value === 'number' ? value : Number(value) || 0;

/**
 * Tipo de instância (EC2/ASG) ou classe (RDS) com vCPU, memória e preço
 * por hora vindos do catálogo de preços da região do recurso (decisão D5
 * da F4). Região sem preço carregado → lista embutida, sem preço.
 */
export function InstanceSelect({
  id,
  describedBy,
  value,
  source,
  resource,
  resources,
  language,
  onChange,
}: {
  id: string;
  describedBy: string | undefined;
  value: unknown;
  source: InstanceSource;
  resource: CloudResource;
  resources: CloudResource[];
  language: AppLanguage;
  onChange: (value: unknown) => void;
}) {
  const copy = getCloudCopy(language);
  const currency = useAppSelector((state) => state.cloud.assumptions.currency);
  const region = regionCodeOf(resources, resource.id);
  const { data } = useCloudPriceCatalogQuery(region || null);
  const windows =
    source === 'ec2InstanceTypes' && resource.config.os === 'windows';
  const { match, typeKey, fallback } = instanceSourceOf(source, resource);

  const priced: PricedSpec[] = (data?.items ?? [])
    .filter(match)
    .map((item) => ({
      type: String(item.attributes[typeKey]),
      vcpu: num(item.attributes.vcpu),
      memoryGiB: num(item.attributes.memoryGiB),
      usd: item.usd,
      brl: item.brl,
    }));
  const fromCatalog = priced.length > 0;
  const specs: PricedSpec[] = fromCatalog
    ? priced
    : fallback.map((spec) => ({
        ...spec,
        usd: null,
        brl: null,
      }));
  const unique = [...new Map(specs.map((s) => [s.type, s])).values()].sort(
    byFamilyAndSize,
  );
  const current = typeof value === 'string' ? value : '';
  const money = new Intl.NumberFormat(NUMBER_LOCALE[language], {
    style: 'currency',
    currency,
    maximumFractionDigits: 4,
  });

  return (
    <>
      <select
        id={id}
        value={current}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className="field-sm font-mono"
      >
        {current && !unique.some((s) => s.type === current) && (
          <option value={current}>{current}</option>
        )}
        {unique.map((spec) => {
          const price = currency === 'BRL' ? spec.brl : spec.usd;
          // Windows não roda em Graviton: tipo arm fica visível, mas desabilitado.
          const blocked = windows && isArmInstanceType(spec.type);
          return (
            <option key={spec.type} value={spec.type} disabled={blocked}>
              {spec.type} — {copy.instanceSpec(spec.vcpu, spec.memoryGiB)}
              {blocked
                ? ` · ${copy.armNoWindows}`
                : price !== null
                  ? ` · ${money.format(price)}${copy.perHour}`
                  : ''}
            </option>
          );
        })}
      </select>
      {!fromCatalog && data !== undefined && (
        <p className="mt-1 text-2xs text-chalk-faint">{copy.noRegionPrices}</p>
      )}
    </>
  );
}

/**
 * Múltipla escolha de elementos da VPC do recurso: security groups ou
 * subnets (com zona, camada e CIDR). Grava a lista de ids no campo.
 */
export function RefsEditor({
  field,
  label,
  help,
  error,
  value,
  resource,
  resources,
  language,
  onChange,
}: {
  field: Extract<CloudField, { type: 'refs' }>;
  label: string;
  help?: string;
  error: string | null;
  value: unknown;
  resource: CloudResource;
  resources: CloudResource[];
  language: AppLanguage;
  onChange: (value: unknown) => void;
}) {
  const copy = getCloudCopy(language);
  const vpc = vpcOf(resources, resource.id);
  const selected = readIdList(value);
  const options: CheckOption[] =
    field.source === 'regionSecrets'
      ? secretSourcesFor(resources, resource).map((r) => ({
          id: r.id,
          label: r.name,
          meta:
            r.type === 'aws.rds' || r.type === 'aws.aurora'
              ? copy.rdsManagedSecret
              : r.type === PARAMETER_TYPE
                ? `SSM · ${String(r.config.path ?? '')}`
                : 'Secrets Manager',
        }))
      : field.source === 'backupTargets'
        ? backupTargetsFor(resources, resource).map((r) => ({
            id: r.id,
            label: r.name,
            meta: BACKUP_LABELS[r.type] ?? r.type,
          }))
        : field.source === 'projectVpcs'
          ? resources
              .filter((r) => r.type === VPC_TYPE)
              .map((v) => ({ id: v.id, label: v.name, meta: cidrOf(v) }))
          : !vpc
            ? []
            : field.source === 'vpcSecurityGroups'
              ? resources
                  .filter((r) => r.type === SG_TYPE && r.parentId === vpc.id)
                  .map((sg) => ({
                    id: sg.id,
                    label: sg.name,
                    meta:
                      typeof sg.config.description === 'string'
                        ? sg.config.description
                        : '',
                  }))
              : subnetsOfVpc(resources, vpc.id).map((subnet) => {
                  const az = resources.find((r) => r.id === subnet.parentId);
                  return {
                    id: subnet.id,
                    label: subnet.name,
                    meta: `${copy.tiers[subnetTier(subnet)]} · ${String(az?.config.zone ?? '')} · ${cidrOf(subnet)}`,
                  };
                });

  return (
    <CheckList
      label={label}
      help={help}
      error={error}
      emptyText={copy.refsEmpty[field.source]}
      options={options}
      selected={selected}
      onChange={onChange}
    />
  );
}

export type CheckOption = { id: string; label: string; meta?: string };

/** Lista de marcar com legenda, ajuda e erro (refs e múltipla escolha). */
export function CheckList({
  label,
  help,
  error,
  emptyText,
  options,
  selected,
  onChange,
}: {
  label: string;
  help?: string;
  error: string | null;
  emptyText?: string;
  options: CheckOption[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const legendId = useId();
  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );

  return (
    <fieldset aria-describedby={error || help ? `${legendId}-help` : undefined}>
      <legend id={legendId} className="mb-1 text-xs font-medium text-chalk-dim">
        {label}
      </legend>
      {options.length === 0 ? (
        <p className="text-2xs text-chalk-faint">{emptyText}</p>
      ) : (
        <ul
          className={`space-y-1 rounded-sm border p-1.5 ${error ? 'border-signal-down' : 'border-line'}`}
        >
          {options.map((option) => (
            <li key={option.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded-[2px] px-1 py-0.5 hover:bg-ink-raised-2">
                <input
                  type="checkbox"
                  checked={selected.includes(option.id)}
                  onChange={() => toggle(option.id)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
                />
                <span className="min-w-0">
                  <span className="block text-xs text-chalk">
                    {option.label}
                  </span>
                  {option.meta && (
                    <span className="block truncate font-mono text-2xs text-chalk-faint">
                      {option.meta}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {(error || help) && (
        <p
          id={`${legendId}-help`}
          role={error ? 'alert' : undefined}
          className={`mt-1 text-2xs leading-4 ${error ? 'text-signal-down' : 'text-chalk-faint'}`}
        >
          {error ?? help}
        </p>
      )}
    </fieldset>
  );
}

/**
 * Associação de configuração (zona DNS, certificado, WAF): só os elementos
 * válidos para este recurso (mesma Região ou Serviços globais). Um valor que
 * deixou de valer continua visível, marcado, para o erro do campo explicar.
 */
export function AssociationSelect({
  id,
  describedBy,
  value,
  source,
  resource,
  resources,
  language,
  onChange,
}: {
  id: string;
  describedBy: string | undefined;
  value: unknown;
  source:
    | 'route53Zones'
    | 'acmCertificates'
    | 'wafAcls'
    | 'kmsKeys'
    | 'cognitoPools'
    | 'clusters'
    | 'ecrRepositories'
    | 'sqsQueues'
    | 'logGroups'
    | 'snsTopics'
    | 'projectBuckets';
  resource: CloudResource;
  resources: CloudResource[];
  language: AppLanguage;
  onChange: (value: unknown) => void;
}) {
  const copy = getCloudCopy(language);
  const current = typeof value === 'string' ? value : '';
  const candidates =
    source === 'route53Zones'
      ? zonesFor(resources, resource)
      : source === 'acmCertificates'
        ? certificatesFor(resources, resource)
        : source === 'kmsKeys'
          ? kmsKeysFor(resources, resource)
          : source === 'cognitoPools'
            ? cognitoPoolsFor(resources, resource)
            : source === 'clusters'
              ? clustersFor(resources, resource)
              : source === 'ecrRepositories'
                ? ecrReposFor(resources, resource)
                : source === 'sqsQueues'
                  ? deadLetterQueuesFor(resources, resource)
                  : source === 'logGroups'
                    ? logGroupsFor(resources, resource)
                    : source === 'snsTopics'
                      ? alarmTopicsFor(resources, resource)
                      : source === 'projectBuckets'
                        ? projectBucketsFor(resources)
                        : wafsFor(resources, resource);
  const describe = (r: CloudResource) =>
    source === 'route53Zones'
      ? `${String(r.config.domain || r.name)}${r.config.private === true ? ` (${copy.privateZone})` : ''}`
      : source === 'acmCertificates'
        ? `${r.name} — ${certificateNames(r)[0] ?? ''}`
        : source === 'wafAcls'
          ? `${r.name} · ${wafScopeOf(resources, r)}`
          : r.name;
  const stale = current && !candidates.some((c) => c.id === current);
  const staleResource = resources.find((r) => r.id === current);
  return (
    <select
      id={id}
      value={current}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
      className="field-sm"
    >
      <option value="">{copy.noneOption}</option>
      {stale && (
        <option value={current}>
          {staleResource?.name ?? current} ({copy.outOfScope})
        </option>
      )}
      {candidates.map((candidate) => (
        <option key={candidate.id} value={candidate.id}>
          {describe(candidate)}
        </option>
      ))}
    </select>
  );
}
