import type { LocalizedText } from '../catalog/types';
import { closest } from '../network';
import type { CloudConnection, CloudResource } from '../types';
import { readIdList } from './addressing';
import { clusterOf, ecrOf } from './compute';
import { deadLetterQueueOf } from './data';
import {
  alarmTopicOf,
  backupTargetsOf,
  BACKUP_TYPE,
  bucketOf,
  logGroupOf,
  TRAIL_TYPE,
} from './observability';
import { cognitoOf, kmsKeyOf, readsOf } from './secrets';

/**
 * Borda e entrega (F7 onda 7A — `sprint-cloud-f7a-borda.md`): Serviços
 * globais, Internet, Route 53, certificados ACM, CloudFront e WAF. Puro: não
 * importa o catálogo (o catálogo importa este módulo).
 *
 * As relações de configuração (WAF, certificado, nome DNS) ficam como ids
 * no recurso que usa (`wafId`, `certificateId`, `dnsZoneId` + `dnsRecord`);
 * daqui saem as associações derivadas que o canvas desenha e os selos.
 */

export const GLOBAL_TYPE = 'aws.global';
export const INTERNET_TYPE = 'ext.internet';
export const ZONE_TYPE = 'aws.route53.zone';
export const ACM_TYPE = 'aws.acm.certificate';
export const CLOUDFRONT_TYPE = 'aws.cloudfront';
export const WAF_TYPE = 'aws.waf.acl';

/** Região onde o Terraform cria os serviços globais (e o certificado do CloudFront). */
export const GLOBAL_PROVIDER_REGION = 'us-east-1';
/** Região da tabela de preços dos serviços globais (pseudo-região `aws-other` da AWS). */
export const GLOBAL_PRICE_REGION = 'global';

/** Recursos que podem ter WAF, certificado e nome DNS. */
export const PUBLISHABLE_TYPES = [
  'aws.alb',
  'aws.nlb',
  CLOUDFRONT_TYPE,
  'aws.apigw.http',
];

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const byId = (resources: CloudResource[], id: unknown) =>
  typeof id === 'string' && id ? resources.find((r) => r.id === id) : undefined;

export const isGlobal = (resources: CloudResource[], id: string | null) =>
  Boolean(closest(resources, id, GLOBAL_TYPE));

/**
 * Onde o elemento vive para preço e escopo: `global` (dentro de Serviços
 * globais) ou o código da região AWS do container Região.
 */
export function priceRegionOf(resources: CloudResource[], id: string | null) {
  if (isGlobal(resources, id)) return GLOBAL_PRICE_REGION;
  return str(closest(resources, id, 'aws.region')?.config.region);
}

/** Container de escopo (Região ou Serviços globais) do elemento. */
export const scopeOf = (resources: CloudResource[], id: string | null) =>
  closest(resources, id, GLOBAL_TYPE) ?? closest(resources, id, 'aws.region');

// ---------------------------------------------------------------------------
//  DNS
// ---------------------------------------------------------------------------

const DOMAIN = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/;
const LABEL =
  /^(\*|@|[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

export const normalizeDomain = (value: unknown) =>
  str(value).toLowerCase().replace(/\.$/, '');

export function isValidDomain(value: unknown) {
  return DOMAIN.test(normalizeDomain(value));
}

/** `www` + `exemplo.com.br` → `www.exemplo.com.br`; `@` (ou vazio) → o próprio domínio. */
export function recordFqdn(zone: CloudResource, record: unknown) {
  const domain = normalizeDomain(zone.config.domain);
  const name = str(record).toLowerCase();
  return !name || name === '@' ? domain : `${name}.${domain}`;
}

export const isValidRecordName = (value: unknown) => {
  const name = str(value).toLowerCase();
  return !name || LABEL.test(name);
};

/** Zona DNS escolhida pelo recurso, se ainda existir. */
export const zoneOf = (resources: CloudResource[], resource: CloudResource) => {
  const zone = byId(resources, resource.config.dnsZoneId);
  return zone?.type === ZONE_TYPE ? zone : undefined;
};

/** Nome DNS publicado do recurso (`www.exemplo.com.br`) ou `null`. */
export function dnsNameOf(resources: CloudResource[], resource: CloudResource) {
  const zone = zoneOf(resources, resource);
  return zone && isValidDomain(zone.config.domain)
    ? recordFqdn(zone, resource.config.dnsRecord)
    : null;
}

/** Zonas do projeto que podem publicar o recurso (a privada só para recursos internos). */
export function zonesFor(resources: CloudResource[], resource: CloudResource) {
  const internal = resource.config.scheme === 'internal';
  return resources.filter(
    (r) =>
      r.type === ZONE_TYPE && (r.config.private === true ? internal : true),
  );
}

// ---------------------------------------------------------------------------
//  Certificados
// ---------------------------------------------------------------------------

export function certificateNames(cert: CloudResource): string[] {
  return [
    normalizeDomain(cert.config.domain),
    ...readIdList(cert.config.alternativeNames).map(normalizeDomain),
  ].filter(Boolean);
}

/** O nome `fqdn` é coberto por `pattern` (com curinga de um nível: `*.exemplo.com`)? */
export function nameMatches(pattern: string, fqdn: string) {
  if (pattern === fqdn) return true;
  if (!pattern.startsWith('*.')) return false;
  const base = pattern.slice(2);
  const dot = fqdn.indexOf('.');
  return dot > 0 && fqdn.slice(dot + 1) === base;
}

export const certificateCovers = (cert: CloudResource, fqdn: string) =>
  certificateNames(cert).some((name) => nameMatches(name, fqdn));

/**
 * Certificados que o recurso pode usar: o CloudFront só aceita os de
 * Serviços globais (us-east-1); ALB e NLB, os da mesma Região.
 */
export function certificatesFor(
  resources: CloudResource[],
  resource: CloudResource,
) {
  const scope =
    resource.type === CLOUDFRONT_TYPE
      ? closest(resources, resource.id, GLOBAL_TYPE)
      : closest(resources, resource.id, 'aws.region');
  return resources.filter(
    (r) =>
      r.type === ACM_TYPE &&
      scope !== undefined &&
      scopeOf(resources, r.id)?.id === scope.id,
  );
}

export const certificateOf = (
  resources: CloudResource[],
  resource: CloudResource,
) => {
  const cert = byId(resources, resource.config.certificateId);
  return cert?.type === ACM_TYPE ? cert : undefined;
};

/** Zona pública do projeto que valida o certificado por DNS (a de domínio mais longo). */
export function validationZoneOf(
  resources: CloudResource[],
  cert: CloudResource,
) {
  const domain = normalizeDomain(cert.config.domain).replace(/^\*\./, '');
  return resources
    .filter(
      (r) =>
        r.type === ZONE_TYPE &&
        r.config.private !== true &&
        isValidDomain(r.config.domain),
    )
    .map((zone) => ({ zone, apex: normalizeDomain(zone.config.domain) }))
    .filter(({ apex }) => domain === apex || domain.endsWith(`.${apex}`))
    .sort((a, b) => b.apex.length - a.apex.length)[0]?.zone;
}

// ---------------------------------------------------------------------------
//  WAF
// ---------------------------------------------------------------------------

/** Escopo do web ACL: `CLOUDFRONT` em Serviços globais, `REGIONAL` numa Região. */
export const wafScopeOf = (resources: CloudResource[], waf: CloudResource) =>
  isGlobal(resources, waf.id) ? 'CLOUDFRONT' : 'REGIONAL';

/** Web ACLs que o recurso pode usar: CloudFront → escopo CloudFront; ALB → mesma Região. */
export function wafsFor(resources: CloudResource[], resource: CloudResource) {
  if (resource.type === CLOUDFRONT_TYPE)
    return resources.filter(
      (r) => r.type === WAF_TYPE && isGlobal(resources, r.id),
    );
  const region = closest(resources, resource.id, 'aws.region');
  return resources.filter(
    (r) =>
      r.type === WAF_TYPE &&
      region !== undefined &&
      closest(resources, r.id, 'aws.region')?.id === region.id,
  );
}

export const wafOf = (resources: CloudResource[], resource: CloudResource) => {
  const waf = byId(resources, resource.config.wafId);
  return waf?.type === WAF_TYPE ? waf : undefined;
};

/** Grupos de regras gerenciadas da AWS oferecidos no web ACL. */
export const WAF_MANAGED_GROUPS = [
  'AWSManagedRulesCommonRuleSet',
  'AWSManagedRulesKnownBadInputsRuleSet',
  'AWSManagedRulesSQLiRuleSet',
  'AWSManagedRulesAmazonIpReputationList',
  'AWSManagedRulesAnonymousIpList',
  'AWSManagedRulesBotControlRuleSet',
] as const;

export const BOT_CONTROL_GROUP = 'AWSManagedRulesBotControlRuleSet';

export function wafRuleGroups(waf: CloudResource): string[] {
  return readIdList(waf.config.managedRules).filter((g) =>
    (WAF_MANAGED_GROUPS as readonly string[]).includes(g),
  );
}

/** Regras cobradas: um grupo gerenciado = uma regra; o limite por IP é outra. */
export function wafRuleCount(waf: CloudResource) {
  const rate = Number(waf.config.rateLimit) > 0 ? 1 : 0;
  return wafRuleGroups(waf).length + rate;
}

// ---------------------------------------------------------------------------
//  CloudFront
// ---------------------------------------------------------------------------

/** Tipos que podem ser origem do CloudFront (a origem é a conexão que sai dele). */
export const CLOUDFRONT_ORIGIN_TYPES = [
  'aws.s3',
  'aws.alb',
  'aws.nlb',
  'aws.ec2',
];

/** Conexões CloudFront → origem, na ordem do rascunho (a 1ª sem caminho é a padrão). */
export function cloudfrontOrigins(
  resources: CloudResource[],
  connections: CloudConnection[],
  distribution: CloudResource,
) {
  return connections
    .filter((c) => c.source === distribution.id)
    .map((connection) => ({
      connection,
      origin: resources.find((r) => r.id === connection.target),
    }))
    .filter((o): o is { connection: CloudConnection; origin: CloudResource } =>
      Boolean(o.origin && CLOUDFRONT_ORIGIN_TYPES.includes(o.origin.type)),
    );
}

/** Caminho da conexão (`/api/*`) — regra de listener do ALB ou comportamento do CloudFront. */
export const pathPatternOf = (connection: CloudConnection) =>
  str(connection.config.pathPattern);

/** Geografias de borda do CloudFront (prefixo da tabela de preços). */
export const CLOUDFRONT_GEOS = [
  'SA',
  'US',
  'CA',
  'EU',
  'JP',
  'AP',
  'AU',
  'IN',
  'ZA',
  'ME',
] as const;

// ---------------------------------------------------------------------------
//  Associações derivadas (canvas) e selos
// ---------------------------------------------------------------------------

export type EdgeAssociationKind =
  | 'waf'
  | 'certificate'
  | 'dns'
  | 'kms'
  | 'secret'
  | 'cognito'
  | 'cluster'
  | 'image'
  | 'dlq'
  | 'logs'
  | 'alarm'
  | 'trail'
  | 'backup';

export type EdgeAssociation = {
  kind: EdgeAssociationKind;
  /** Quem protege/certifica/publica. */
  from: string;
  /** O recurso associado. */
  to: string;
};

export function edgeAssociations(
  resources: CloudResource[],
): EdgeAssociation[] {
  const out: EdgeAssociation[] = [];
  for (const resource of resources) {
    // 7B: chave KMS → quem cifra; segredo/parâmetro → quem lê; user pool → ALB.
    const key = kmsKeyOf(resources, resource);
    if (key) out.push({ kind: 'kms', from: key.id, to: resource.id });
    for (const source of readsOf(resources, resource))
      out.push({ kind: 'secret', from: source.id, to: resource.id });
    const pool = cognitoOf(resources, resource);
    if (pool) out.push({ kind: 'cognito', from: pool.id, to: resource.id });
    // 7C: cluster → serviço/node group; repositório ECR → serviço.
    const cluster = clusterOf(resources, resource);
    if (cluster)
      out.push({ kind: 'cluster', from: cluster.id, to: resource.id });
    const repo = ecrOf(resources, resource);
    if (repo) out.push({ kind: 'image', from: repo.id, to: resource.id });
    // 7C parte 2: fila morta → fila de origem.
    const dlq = deadLetterQueueOf(resources, resource);
    if (dlq) out.push({ kind: 'dlq', from: dlq.id, to: resource.id });
    // 7D: grupo de logs → quem manda logs; tópico → quem alarma; trilha → bucket; plano → protegidos.
    const group = logGroupOf(resources, resource);
    if (group) out.push({ kind: 'logs', from: group.id, to: resource.id });
    const topic =
      resource.config.alarms === true
        ? alarmTopicOf(resources, resource)
        : undefined;
    if (topic) out.push({ kind: 'alarm', from: topic.id, to: resource.id });
    if (resource.type === TRAIL_TYPE) {
      const bucket = bucketOf(resources, resource);
      if (bucket) out.push({ kind: 'trail', from: resource.id, to: bucket.id });
    }
    if (resource.type === BACKUP_TYPE)
      for (const target of backupTargetsOf(resources, resource))
        out.push({ kind: 'backup', from: resource.id, to: target.id });
    if (!PUBLISHABLE_TYPES.includes(resource.type)) continue;
    const waf = wafOf(resources, resource);
    if (waf) out.push({ kind: 'waf', from: waf.id, to: resource.id });
    const cert = certificateOf(resources, resource);
    if (cert) out.push({ kind: 'certificate', from: cert.id, to: resource.id });
    const zone = zoneOf(resources, resource);
    if (zone) out.push({ kind: 'dns', from: zone.id, to: resource.id });
  }
  return out;
}

/** Selos do nó: o que protege/certifica/publica este recurso. */
export function badgesOf(resources: CloudResource[], resource: CloudResource) {
  const reads = readsOf(resources, resource);
  return {
    waf: wafOf(resources, resource)?.name ?? null,
    certificate: certificateOf(resources, resource)?.name ?? null,
    dns: dnsNameOf(resources, resource),
    kms: kmsKeyOf(resources, resource)?.name ?? null,
    secrets: reads.length ? reads.map((r) => r.name).join(', ') : null,
    cognito: cognitoOf(resources, resource)?.name ?? null,
    sessionManager: resource.config.sessionManager === true,
  };
}

// ---------------------------------------------------------------------------
//  Problemas (catálogo → inspetor, ⚠ e Terraform)
// ---------------------------------------------------------------------------

/** Problemas de WAF, certificado e DNS de um recurso publicável (chave → mensagem). */
export function publishIssues(
  resources: CloudResource[],
  resource: CloudResource,
): Record<string, LocalizedText> {
  const issues: Record<string, LocalizedText> = {};
  const certId = str(resource.config.certificateId);
  if (certId) {
    const cert = certificateOf(resources, resource);
    if (!cert || !certificatesFor(resources, resource).includes(cert)) {
      issues.certificateId =
        resource.type === CLOUDFRONT_TYPE
          ? {
              pt: 'O CloudFront só aceita certificado de Serviços globais (us-east-1).',
              en: 'CloudFront only accepts a certificate from Global services (us-east-1).',
              es: 'CloudFront solo acepta un certificado de Servicios globales (us-east-1).',
            }
          : {
              pt: 'O certificado precisa estar na mesma Região do load balancer.',
              en: 'The certificate must be in the same Region as the load balancer.',
              es: 'El certificado debe estar en la misma Región que el balanceador.',
            };
    }
  }
  const wafId = str(resource.config.wafId);
  if (wafId) {
    const waf = wafOf(resources, resource);
    if (!waf || !wafsFor(resources, resource).includes(waf)) {
      issues.wafId =
        resource.type === CLOUDFRONT_TYPE
          ? {
              pt: 'O CloudFront usa web ACL de escopo CloudFront (em Serviços globais).',
              en: 'CloudFront uses a CloudFront-scope web ACL (in Global services).',
              es: 'CloudFront usa un web ACL de alcance CloudFront (en Servicios globales).',
            }
          : {
              pt: 'O web ACL precisa estar na mesma Região do load balancer.',
              en: 'The web ACL must be in the same Region as the load balancer.',
              es: 'El web ACL debe estar en la misma Región que el balanceador.',
            };
    }
  }
  if (str(resource.config.dnsZoneId)) {
    if (!isValidRecordName(resource.config.dnsRecord)) {
      issues.dnsRecord = {
        pt: 'Nome inválido: use letras, números e hífen (ex.: www, api, @ para o domínio).',
        en: 'Invalid name: use letters, digits and hyphens (e.g. www, api, @ for the apex).',
        es: 'Nombre inválido: usa letras, números y guion (ej.: www, api, @ para el dominio).',
      };
    } else {
      const fqdn = dnsNameOf(resources, resource);
      const cert = certificateOf(resources, resource);
      if (fqdn && cert && !certificateCovers(cert, fqdn)) {
        issues.dnsRecord = {
          pt: `O certificado ${cert.name} não cobre ${fqdn}.`,
          en: `Certificate ${cert.name} does not cover ${fqdn}.`,
          es: `El certificado ${cert.name} no cubre ${fqdn}.`,
        };
      }
    }
  }
  return issues;
}
