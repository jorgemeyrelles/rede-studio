import {
  Handle,
  NodeResizeControl,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  AlertTriangle,
  Globe,
  KeyRound,
  Lock,
  LockKeyhole,
  MoveDiagonal2,
  ShieldCheck,
  Shrink,
  SquareTerminal,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { resizeCloudResource } from '../../features/cloud/cloudSlice';
import {
  awsRegionName,
  getCatalogEntry,
  type CloudGroupColor,
} from '../../features/cloud/catalog';
import { CONNECTABLE_TYPES } from '../../features/cloud/engines/connections';
import {
  badgesOf,
  GLOBAL_PROVIDER_REGION,
  wafScopeOf,
} from '../../features/cloud/engines/edge';
import { readIamSelections } from '../../features/cloud/iam';
import {
  isSubnet,
  subnetSummary,
  zoneName,
} from '../../features/cloud/network';
import type { CloudResource, CloudSize } from '../../features/cloud/types';
import type { AppLanguage } from '../../types/i18n';
import { sizeOf } from '../../features/cloud/tree';
import { getCloudIcon } from './awsIcons';
import { getCloudCopy } from './cloudCopy';
import IamInfoPopover from './IamInfoPopover';

export type CloudNodeData = {
  resource: CloudResource;
  language: AppLanguage;
  childCount: number;
  minSize?: CloudSize;
  /** Começa uma ligação a partir deste recurso (ponto lateral ou clique segurado). */
  onStartConnect?: (id: string, clientX: number, clientY: number) => void;
};

/** Quanto tempo segurar o clique sobre o recurso para começar uma ligação. */
const HOLD_TO_CONNECT_MS = 350;
/** Movimento que cancela o "segurar" (vira arrasto normal do recurso). */
const HOLD_SLOP_PX = 5;

/** Alças do React Flow só para as arestas renderizarem (as ligações são nossas). */
function HiddenHandles() {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="cloud-handle-hidden"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="cloud-handle-hidden"
      />
    </>
  );
}

export type CloudContainerNode = Node<CloudNodeData, 'cloudContainer'>;
export type CloudResourceNode = Node<CloudNodeData, 'cloudResource'>;

/** Classes de borda/fundo por cor de grupo AWS (tokens `--aws-*`, listadas por extenso pro JIT do Tailwind). */
const GROUP_CLASSES: Record<CloudGroupColor, string> = {
  account: 'border-aws-account bg-aws-account/[0.04]',
  region: 'border-aws-region bg-aws-region/[0.03]',
  vpc: 'border-aws-vpc bg-aws-vpc/[0.04]',
  az: 'border-aws-az/70 bg-transparent',
  'subnet-public': 'border-aws-subnet-public bg-aws-subnet-public/[0.06]',
  'subnet-private': 'border-aws-subnet-private bg-aws-subnet-private/[0.06]',
  asg: 'border-aws-asg bg-transparent',
  global: 'border-aws-cloud/70 bg-aws-cloud/[0.03]',
};

const asStringList = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

/** Metadado técnico mostrado à direita do título (código da região, CIDR...). */
function containerMeta(
  resource: CloudResource,
  resources: CloudResource[],
  language: AppLanguage,
): string | null {
  const copy = getCloudCopy(language);
  if (resource.type === 'aws.account') {
    const { iamUsers, iamGroups, iamRoles, mfaRequired } = resource.config;
    const summary = copy.iamSummary(
      asStringList(iamUsers).length,
      readIamSelections(iamGroups).length,
      readIamSelections(iamRoles).length,
    );
    return mfaRequired ? `${summary} · ${copy.mfaOn}` : summary;
  }
  if (resource.type === 'aws.region') {
    const code = String(resource.config.region ?? '');
    const name = awsRegionName(code);
    return name ? `${code} · ${name}` : code;
  }
  if (resource.type === 'aws.az') return zoneName(resources, resource);
  if (resource.type === 'aws.global') return GLOBAL_PROVIDER_REGION;
  const cidr =
    typeof resource.config.cidr === 'string' ? resource.config.cidr : '';
  if (isSubnet(resource) && cidr) return subnetSummary(cidr);
  return cidr || null;
}

/** Primeiro problema de validação do elemento (CIDR sobreposto, zona repetida...). */
function useFirstIssue(
  resource: CloudResource,
  language: AppLanguage,
): string | null {
  const { resources, connections } = useAppSelector((state) => state.cloud);
  const issues =
    getCatalogEntry(resource.type)?.validate?.(
      resource,
      resources,
      connections,
    ) ?? {};
  const first = Object.values(issues)[0];
  return first ? first[language] : null;
}

/** Container da hierarquia (conta, região, VPC, AZ, subnet): sub-flow do React Flow. */
export function ContainerNode({
  id,
  data,
  selected,
}: NodeProps<CloudContainerNode>) {
  const dispatch = useAppDispatch();
  const { resource, language, minSize } = data;
  const entry = getCatalogEntry(resource.type);
  const icon = getCloudIcon(resource.type);
  const resources = useAppSelector((state) => state.cloud.resources);
  const meta = containerMeta(resource, resources, language);
  const issue = useFirstIssue(resource, language);
  const group = entry?.groupColor
    ? GROUP_CLASSES[entry.groupColor]
    : 'border-line';
  const copy = getCloudCopy(language);
  const size = sizeOf(resource);
  // "Ajustar ao conteúdo": o menor tamanho que ainda contém os filhos com a
  // folga padrão (o reducer limita ao mínimo, então pedir o mínimo basta).
  const fitted =
    !minSize ||
    (size.width === minSize.width && size.height === minSize.height);

  return (
    <div
      className={`h-full w-full rounded-[6px] border ${entry?.dashed ? 'border-dashed' : ''} ${group} ${
        selected ? 'outline outline-2 outline-offset-2 outline-accent' : ''
      }`}
    >
      <HiddenHandles />
      <div className="group flex h-11 items-center gap-2 px-3">
        {icon && (
          <img
            src={icon}
            alt=""
            width={24}
            height={24}
            className="shrink-0"
            draggable={false}
          />
        )}
        <span className="truncate text-xs font-semibold text-chalk">
          {resource.name}
        </span>
        {meta && (
          <span className="ml-auto truncate pl-3 font-mono text-2xs tabular-nums text-chalk-dim">
            {meta}
          </span>
        )}
        {issue && (
          <span
            className={meta ? 'shrink-0' : 'ml-auto shrink-0'}
            title={issue}
            role="img"
            aria-label={issue}
          >
            <AlertTriangle
              size={14}
              className="text-signal-warn"
              aria-hidden="true"
            />
          </span>
        )}
        {minSize && (
          <button
            type="button"
            disabled={fitted}
            onClick={(event) => {
              event.stopPropagation();
              dispatch(resizeCloudResource({ id, size: minSize }));
            }}
            aria-label={`${copy.fitToContent}: ${resource.name}`}
            title={fitted ? copy.fitDone : copy.fitToContent}
            className={`nodrag shrink-0 rounded-[2px] p-1 text-chalk-dim enabled:hover:bg-ink-raised-2 enabled:hover:text-chalk disabled:cursor-default disabled:text-chalk-faint ${
              meta || issue ? '' : 'ml-auto'
            } ${selected ? 'inline-flex' : 'hidden group-hover:inline-flex'}`}
          >
            <Shrink size={14} aria-hidden="true" />
          </button>
        )}
        {resource.type === 'aws.account' && (
          <span className={meta ? '' : 'ml-auto'}>
            <IamInfoPopover account={resource} language={language} />
          </span>
        )}
      </div>
      {selected && (
        <NodeResizeControl
          position="bottom-right"
          minWidth={minSize?.width}
          minHeight={minSize?.height}
          onResizeEnd={(_event, params) =>
            dispatch(
              resizeCloudResource({
                id,
                size: { width: params.width, height: params.height },
              }),
            )
          }
          style={{ background: 'transparent', border: 'none' }}
        >
          <MoveDiagonal2
            size={14}
            className="absolute bottom-1 right-1 text-chalk-dim"
            aria-hidden="true"
          />
        </NodeResizeControl>
      )}
    </div>
  );
}

/** Recurso folha (EC2, NAT, ALB, RDS...): ícone oficial + nome. */
export function ResourceNode({
  id,
  data,
  selected,
}: NodeProps<CloudResourceNode>) {
  const { resource, language, onStartConnect } = data;
  const icon = getCloudIcon(resource.type);
  const issue = useFirstIssue(resource, language);
  const copy = getCloudCopy(language);
  const connectable =
    CONNECTABLE_TYPES.includes(resource.type) && Boolean(onStartConnect);
  const resources = useAppSelector((state) => state.cloud.resources);
  const subtitle = resourceSubtitle(resource, resources, language);
  const badges = badgesOf(resources, resource);
  // Selos: o que protege, certifica, publica, cifra ou é lido por este recurso.
  const badgeList = (
    [
      ['waf', ShieldCheck, badges.waf && `WAF: ${badges.waf}`],
      [
        'certificate',
        Lock,
        badges.certificate && `${copy.badgeCertificate}: ${badges.certificate}`,
      ],
      ['dns', Globe, badges.dns && `DNS: ${badges.dns}`],
      ['kms', KeyRound, badges.kms && `KMS: ${badges.kms}`],
      [
        'secrets',
        LockKeyhole,
        badges.secrets && `${copy.badgeSecrets}: ${badges.secrets}`,
      ],
      ['cognito', UserCheck, badges.cognito && `Cognito: ${badges.cognito}`],
      ['ssm', SquareTerminal, badges.sessionManager && 'Session Manager'],
    ] as [string, LucideIcon, string | false | null][]
  )
    .filter((b): b is [string, LucideIcon, string] => Boolean(b[2]))
    .map(([key, Icon, label]) => ({ key, Icon, label }));
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  const cancelHold = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
  };
  useEffect(() => cancelHold, []);

  return (
    <div
      className={`cloud-resource relative flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-[6px] border bg-ink-raised px-2 ${
        selected
          ? 'is-selected border-accent'
          : issue
            ? 'border-signal-warn'
            : 'border-line'
      }`}
      title={issue ?? undefined}
      // Segurar o clique sem mover começa uma ligação; mover antes vira arrasto.
      onPointerDown={(event) => {
        if (!connectable || event.button !== 0) return;
        const start = { x: event.clientX, y: event.clientY };
        cancelHold();
        hold.current = {
          x: start.x,
          y: start.y,
          timer: window.setTimeout(() => {
            const last = hold.current;
            hold.current = null;
            if (last) onStartConnect?.(id, last.x, last.y);
          }, HOLD_TO_CONNECT_MS),
        };
      }}
      onPointerMove={(event) => {
        const h = hold.current;
        if (!h) return;
        if (Math.hypot(event.clientX - h.x, event.clientY - h.y) > HOLD_SLOP_PX)
          cancelHold();
      }}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
    >
      <HiddenHandles />
      {connectable &&
        (['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <span
            key={side}
            aria-hidden="true"
            title={`${copy.connectFrom} ${resource.name}`}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
              cancelHold();
              onStartConnect?.(id, event.clientX, event.clientY);
            }}
            className={`cloud-port cloud-port-${side} nodrag nopan`}
          />
        ))}
      {badgeList.length > 0 && (
        <span className="absolute left-1.5 top-1.5 flex gap-0.5 text-chalk-dim">
          {badgeList.map(({ key, Icon, label }) => (
            <span key={key} role="img" aria-label={label} title={label}>
              <Icon size={12} aria-hidden="true" />
            </span>
          ))}
        </span>
      )}
      {icon && (
        <img src={icon} alt="" width={40} height={40} draggable={false} />
      )}
      <span className="w-full truncate text-center text-2xs font-medium text-chalk">
        {resource.name}
      </span>
      {subtitle && (
        <span className="-mt-1 w-full truncate text-center font-mono text-2xs text-chalk-faint">
          {subtitle}
        </span>
      )}
    </div>
  );
}

/** Linha técnica sob o nome do recurso (tipo, engine, esquema, IP, serviço, domínio). */
function resourceSubtitle(
  resource: CloudResource,
  resources: CloudResource[],
  language: AppLanguage,
): string | null {
  const c = resource.config;
  const text = (value: unknown) =>
    typeof value === 'string' && value ? value : null;
  switch (resource.type) {
    case 'aws.ec2':
    case 'aws.asg':
      return text(c.instanceType);
    case 'aws.rds':
      return text(c.instanceClass);
    case 'aws.alb':
    case 'aws.nlb':
      return c.scheme === 'internal' ? 'internal' : 'internet-facing';
    case 'aws.nat':
      return text(c.privateIp);
    case 'aws.vpc_endpoint.gateway':
      return text(c.service);
    case 'aws.route53.zone':
    case 'aws.acm.certificate':
      return text(c.domain);
    case 'aws.waf.acl':
      return wafScopeOf(resources, resource);
    case 'aws.vpc_endpoint.interface':
      return text(c.service);
    case 'aws.ssm.parameter':
      return text(c.path);
    case 'aws.cognito.userpool':
      return text(c.plan);
    case 'aws.lambda':
      return text(c.runtime);
    case 'aws.ecs.service':
      return `${language === 'en' ? Number(c.cpu) / 1024 : String(Number(c.cpu) / 1024).replace('.', ',')} vCPU · ${Number(c.desiredCount)}×`;
    case 'aws.eks.cluster':
      return text(c.version) && `v${text(c.version)}`;
    case 'aws.eks.nodegroup':
      return `${text(c.instanceType) ?? ''} · ${Number(c.desiredSize)}×`;
    case 'aws.cloudfront':
      return text(c.viewerGeography);
    case 'aws.aurora':
      return `${text(c.instanceClass) ?? ''} · ${1 + Number(c.readers)}×`;
    case 'aws.elasticache':
      return `${text(c.nodeType) ?? ''} · ${1 + Number(c.replicas)}×`;
    case 'aws.dynamodb.table':
      return c.billingMode === 'PROVISIONED' ? 'provisioned' : 'on-demand';
    case 'aws.sqs.queue':
    case 'aws.sns.topic':
      return c.fifo === true ? 'FIFO' : 'Standard';
    case 'aws.efs':
      return text(c.throughputMode);
    case 'aws.logs.group':
      return Number(c.retentionDays) > 0 ? `${Number(c.retentionDays)} d` : '∞';
    case 'aws.backup.plan':
      return `${c.schedule === 'weekly' ? 'weekly' : 'daily'} · ${Number(c.retentionDays)} d`;
    case 'aws.cloudtrail':
      return c.dataEvents === true ? 'data events' : 'management';
    default:
      return null;
  }
}

export const cloudNodeTypes = {
  cloudContainer: ContainerNode,
  cloudResource: ResourceNode,
};
