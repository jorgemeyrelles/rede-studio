import {
  ACM_TYPE,
  certificateCovers,
  certificateNames,
  CLOUDFRONT_TYPE,
  cloudfrontOrigins,
  dnsNameOf,
  GLOBAL_TYPE,
  INTERNET_TYPE,
  isValidDomain,
  normalizeDomain,
  publishIssues,
  validationZoneOf,
  WAF_MANAGED_GROUPS,
  WAF_TYPE,
  wafRuleCount,
  ZONE_TYPE,
  certificateOf,
} from '../engines/edge';
import type {
  CloudCatalogEntry,
  CloudField,
  CloudFieldOption,
  LocalizedText,
} from './types';

/**
 * Borda e entrega (F7 onda 7A — `sprint-cloud-f7a-borda.md`): Serviços
 * globais, Internet / usuários, Route 53, ACM, CloudFront e WAF. As relações
 * ficam no recurso que usa (`wafId`, `certificateId`, `dnsZoneId`); os
 * campos compartilhados com ALB/NLB saem daqui (`publishFields`).
 */

const same = (text: string): LocalizedText => ({
  pt: text,
  en: text,
  es: text,
});

// ── Campos de publicação (ALB, NLB e CloudFront) ─────────────────────────
export const certificateField = (
  visibleWhen?: CloudField['visibleWhen'],
): CloudField => ({
  key: 'certificateId',
  section: 'config',
  type: 'select',
  optionsSource: 'acmCertificates',
  visibleWhen,
  label: { pt: 'Certificado', en: 'Certificate', es: 'Certificado' },
  help: {
    pt: 'Certificados ACM do projeto: na mesma Região (ALB/NLB) ou em Serviços globais (CloudFront).',
    en: 'Project ACM certificates: in the same Region (ALB/NLB) or in Global services (CloudFront).',
    es: 'Certificados ACM del proyecto: en la misma Región (ALB/NLB) o en Servicios globales (CloudFront).',
  },
});

export const wafField: CloudField = {
  key: 'wafId',
  section: 'config',
  type: 'select',
  optionsSource: 'wafAcls',
  label: { pt: 'WAF', en: 'WAF', es: 'WAF' },
  help: {
    pt: 'Web ACL que filtra as requisições antes de chegarem aqui.',
    en: 'Web ACL that filters requests before they reach this resource.',
    es: 'Web ACL que filtra las solicitudes antes de llegar aquí.',
  },
};

export const dnsFields: CloudField[] = [
  {
    key: 'dnsZoneId',
    section: 'config',
    type: 'select',
    optionsSource: 'route53Zones',
    label: { pt: 'Zona DNS', en: 'DNS zone', es: 'Zona DNS' },
    help: {
      pt: 'Publica um registro alias na zona Route 53 escolhida.',
      en: 'Publishes an alias record in the chosen Route 53 zone.',
      es: 'Publica un registro alias en la zona Route 53 elegida.',
    },
  },
  {
    key: 'dnsRecord',
    section: 'config',
    type: 'text',
    mono: true,
    placeholder: 'www',
    visibleWhen: (config) => Boolean(config.dnsZoneId),
    label: { pt: 'Nome', en: 'Name', es: 'Nombre' },
    help: {
      pt: 'Subdomínio (www, api…) ou @ para o próprio domínio.',
      en: 'Subdomain (www, api…) or @ for the apex.',
      es: 'Subdominio (www, api…) o @ para el propio dominio.',
    },
  },
];

const domainField = (help: LocalizedText): CloudField => ({
  key: 'domain',
  section: 'config',
  type: 'text',
  mono: true,
  placeholder: 'exemplo.com.br',
  label: { pt: 'Domínio', en: 'Domain', es: 'Dominio' },
  help,
});

const invalidDomain: LocalizedText = {
  pt: 'Domínio inválido (ex.: exemplo.com.br).',
  en: 'Invalid domain (e.g. example.com).',
  es: 'Dominio inválido (ej.: ejemplo.com).',
};

// ── Serviços globais ─────────────────────────────────────────────────────
const global: CloudCatalogEntry = {
  type: GLOBAL_TYPE,
  layer: 1,
  kind: 'container',
  category: 'foundation',
  optional: true,
  groupColor: 'global',
  label: {
    pt: 'Serviços globais',
    en: 'Global services',
    es: 'Servicios globales',
  },
  summary: {
    pt: 'CloudFront, Route 53 e o que roda fora das regiões (us-east-1).',
    en: 'CloudFront, Route 53 and what runs outside regions (us-east-1).',
    es: 'CloudFront, Route 53 y lo que corre fuera de las regiones (us-east-1).',
  },
  namePrefix: { pt: 'Global', en: 'Global', es: 'Global' },
  parents: ['aws.account'],
  maxPerParent: 1,
  defaultSize: { width: 412, height: 200 },
  inspectorHint: {
    pt: 'No Terraform, tudo aqui usa o provider de us-east-1 (exigência do CloudFront para certificado e WAF).',
    en: 'In Terraform, everything here uses the us-east-1 provider (CloudFront requires it for certificates and WAF).',
    es: 'En Terraform, todo aquí usa el provider de us-east-1 (CloudFront lo exige para certificado y WAF).',
  },
  defaults: {},
  fields: [],
};

// ── Internet / usuários ──────────────────────────────────────────────────
const internet: CloudCatalogEntry = {
  type: INTERNET_TYPE,
  layer: 0,
  kind: 'node',
  category: 'edge',
  optional: true,
  rootPlacement: 'left',
  label: {
    pt: 'Internet / usuários',
    en: 'Internet / users',
    es: 'Internet / usuarios',
  },
  summary: {
    pt: 'De onde vem o tráfego externo. Ligue no CloudFront, num ALB/NLB público ou numa EC2 com IP público.',
    en: 'Where external traffic comes from. Connect it to CloudFront, a public ALB/NLB or an EC2 with a public IP.',
    es: 'De dónde viene el tráfico externo. Conéctalo a CloudFront, a un ALB/NLB público o a una EC2 con IP pública.',
  },
  namePrefix: { pt: 'Internet', en: 'Internet', es: 'Internet' },
  parents: [],
  maxPerParent: 1,
  inspectorHint: {
    pt: 'Conectar a Internet a um ALB ou EC2 cria a regra de entrada 0.0.0.0/0 na porta da conexão.',
    en: 'Connecting the Internet to an ALB or EC2 creates the 0.0.0.0/0 inbound rule on the connection port.',
    es: 'Conectar Internet a un ALB o EC2 crea la regla de entrada 0.0.0.0/0 en el puerto de la conexión.',
  },
  defaults: {},
  fields: [],
};

// ── Route 53 ─────────────────────────────────────────────────────────────
const zone: CloudCatalogEntry = {
  type: ZONE_TYPE,
  layer: 5,
  kind: 'node',
  category: 'edge',
  optional: true,
  label: {
    pt: 'Route 53 — zona',
    en: 'Route 53 — zone',
    es: 'Route 53 — zona',
  },
  summary: {
    pt: 'Zona DNS. CloudFront, ALB e NLB publicam nomes nela.',
    en: 'DNS zone. CloudFront, ALB and NLB publish names in it.',
    es: 'Zona DNS. CloudFront, ALB y NLB publican nombres en ella.',
  },
  namePrefix: { pt: 'zona', en: 'zone', es: 'zona' },
  parents: [GLOBAL_TYPE],
  defaults: { domain: '', private: false, vpcIds: [], queriesMillionsMonth: 1 },
  validate: (resource, resources) => {
    const issues: Record<string, LocalizedText> = {};
    if (!isValidDomain(resource.config.domain)) issues.domain = invalidDomain;
    else if (
      resources.some(
        (r) =>
          r.type === ZONE_TYPE &&
          r.id !== resource.id &&
          r.config.private === resource.config.private &&
          normalizeDomain(r.config.domain) ===
            normalizeDomain(resource.config.domain),
      )
    ) {
      issues.domain = {
        pt: 'Outra zona do projeto já usa este domínio.',
        en: 'Another project zone already uses this domain.',
        es: 'Otra zona del proyecto ya usa este dominio.',
      };
    }
    const vpcs = Array.isArray(resource.config.vpcIds)
      ? resource.config.vpcIds
      : [];
    if (resource.config.private === true && vpcs.length === 0) {
      issues.vpcIds = {
        pt: 'Zona privada precisa de pelo menos uma VPC.',
        en: 'A private zone needs at least one VPC.',
        es: 'Una zona privada necesita al menos una VPC.',
      };
    }
    return issues;
  },
  fields: [
    domainField({
      pt: 'O domínio precisa estar registrado; depois aponte os name servers do registrador para esta zona.',
      en: 'The domain must be registered; then point the registrar’s name servers to this zone.',
      es: 'El dominio debe estar registrado; luego apunta los name servers del registrador a esta zona.',
    }),
    {
      key: 'private',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Zona privada (só dentro das VPCs)',
        en: 'Private zone (only inside VPCs)',
        es: 'Zona privada (solo dentro de las VPC)',
      },
    },
    {
      key: 'vpcIds',
      section: 'config',
      type: 'refs',
      source: 'projectVpcs',
      visibleWhen: (config) => config.private === true,
      label: { pt: 'VPCs', en: 'VPCs', es: 'VPC' },
    },
    {
      key: 'queriesMillionsMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1,
      unit: 'mi',
      label: {
        pt: 'Consultas por mês (milhões)',
        en: 'Queries per month (millions)',
        es: 'Consultas por mes (millones)',
      },
      help: {
        pt: 'Só as consultas a registros comuns. Alias para recursos AWS não são cobrados.',
        en: 'Only queries to standard records. Alias queries to AWS resources are free.',
        es: 'Solo las consultas a registros comunes. Los alias a recursos AWS no se cobran.',
      },
    },
  ],
};

// ── ACM ──────────────────────────────────────────────────────────────────
const acm: CloudCatalogEntry = {
  type: ACM_TYPE,
  layer: 5,
  kind: 'node',
  category: 'security',
  optional: true,
  label: {
    pt: 'Certificado ACM',
    en: 'ACM certificate',
    es: 'Certificado ACM',
  },
  summary: {
    pt: 'Certificado TLS público e gratuito. Na Região para ALB/NLB; em Serviços globais para o CloudFront.',
    en: 'Free public TLS certificate. In a Region for ALB/NLB; in Global services for CloudFront.',
    es: 'Certificado TLS público y gratuito. En la Región para ALB/NLB; en Servicios globales para CloudFront.',
  },
  namePrefix: { pt: 'cert', en: 'cert', es: 'cert' },
  parents: ['aws.region', GLOBAL_TYPE],
  defaults: { domain: '', alternativeNames: [] },
  // Primeiro domínio público do projeto, com o curinga como nome alternativo.
  derive: ({ state }) => {
    const zoneDomain = state.resources
      .filter((r) => r.type === ZONE_TYPE && r.config.private !== true)
      .map((r) => normalizeDomain(r.config.domain))
      .find((d) => isValidDomain(d));
    return zoneDomain
      ? { domain: zoneDomain, alternativeNames: [`*.${zoneDomain}`] }
      : {};
  },
  validate: (resource, resources) => {
    const issues: Record<string, LocalizedText> = {};
    const names = certificateNames(resource);
    const bad = names.find((n) => !isValidDomain(n.replace(/^\*\./, '')));
    if (!names.length || !normalizeDomain(resource.config.domain))
      issues.domain = invalidDomain;
    else if (bad)
      issues.domain = {
        pt: `Nome inválido: ${bad}.`,
        en: `Invalid name: ${bad}.`,
        es: `Nombre inválido: ${bad}.`,
      };
    else if (!validationZoneOf(resources, resource))
      issues['*'] = {
        pt: 'Nenhuma zona Route 53 pública do projeto cobre o domínio: a validação DNS fica manual (no seu provedor de DNS).',
        en: 'No public Route 53 zone in the project covers the domain: DNS validation is manual (at your DNS provider).',
        es: 'Ninguna zona Route 53 pública del proyecto cubre el dominio: la validación DNS es manual (en su proveedor de DNS).',
      };
    return issues;
  },
  fields: [
    domainField({
      pt: 'Pode ser curinga: *.exemplo.com.br.',
      en: 'May be a wildcard: *.example.com.',
      es: 'Puede ser comodín: *.ejemplo.com.',
    }),
    {
      key: 'alternativeNames',
      section: 'config',
      type: 'list',
      label: {
        pt: 'Nomes alternativos',
        en: 'Alternative names',
        es: 'Nombres alternativos',
      },
      itemPlaceholder: same('www.exemplo.com.br'),
    },
  ],
};

// ── CloudFront ───────────────────────────────────────────────────────────
const GEO_OPTIONS: CloudFieldOption[] = [
  {
    value: 'SA',
    label: { pt: 'América do Sul', en: 'South America', es: 'Sudamérica' },
  },
  {
    value: 'US',
    label: {
      pt: 'Estados Unidos e México',
      en: 'United States and Mexico',
      es: 'Estados Unidos y México',
    },
  },
  { value: 'CA', label: { pt: 'Canadá', en: 'Canada', es: 'Canadá' } },
  {
    value: 'EU',
    label: {
      pt: 'Europa e Israel',
      en: 'Europe and Israel',
      es: 'Europa e Israel',
    },
  },
  { value: 'JP', label: { pt: 'Japão', en: 'Japan', es: 'Japón' } },
  {
    value: 'AP',
    label: { pt: 'Ásia-Pacífico', en: 'Asia Pacific', es: 'Asia-Pacífico' },
  },
  {
    value: 'AU',
    label: {
      pt: 'Austrália e Nova Zelândia',
      en: 'Australia and New Zealand',
      es: 'Australia y Nueva Zelanda',
    },
  },
  { value: 'IN', label: { pt: 'Índia', en: 'India', es: 'India' } },
  {
    value: 'ZA',
    label: { pt: 'África do Sul', en: 'South Africa', es: 'Sudáfrica' },
  },
  {
    value: 'ME',
    label: { pt: 'Oriente Médio', en: 'Middle East', es: 'Oriente Medio' },
  },
];

/** Geografias atendidas por cada classe de preço do CloudFront. */
export const PRICE_CLASS_GEOS: Record<string, string[]> = {
  PriceClass_100: ['US', 'CA', 'EU'],
  PriceClass_200: ['US', 'CA', 'EU', 'JP', 'AP', 'IN', 'ZA', 'ME'],
  PriceClass_All: GEO_OPTIONS.map((o) => o.value),
};

const cloudfront: CloudCatalogEntry = {
  type: CLOUDFRONT_TYPE,
  layer: 5,
  kind: 'node',
  category: 'edge',
  optional: true,
  label: { pt: 'CloudFront', en: 'CloudFront', es: 'CloudFront' },
  summary: {
    pt: 'CDN na frente de S3, ALB ou EC2. As origens são as conexões que saem dele.',
    en: 'CDN in front of S3, ALB or EC2. Origins are the connections leaving it.',
    es: 'CDN delante de S3, ALB o EC2. Los orígenes son las conexiones que salen de él.',
  },
  namePrefix: { pt: 'cdn', en: 'cdn', es: 'cdn' },
  parents: [GLOBAL_TYPE],
  inspectorHint: {
    pt: 'Origem: arraste daqui até um S3, ALB ou EC2. Com várias, dê um caminho (/api/*) a cada conexão extra.',
    en: 'Origin: drag from here to an S3, ALB or EC2. With several, give each extra connection a path (/api/*).',
    es: 'Origen: arrastra desde aquí a un S3, ALB o EC2. Con varios, da una ruta (/api/*) a cada conexión extra.',
  },
  defaults: {
    viewerGeography: 'SA',
    priceClass: 'PriceClass_All',
    defaultRootObject: 'index.html',
    certificateId: '',
    wafId: '',
    dnsZoneId: '',
    dnsRecord: 'www',
    dataOutGbMonth: 100,
    requestsMillionsMonth: 1,
  },
  validate: (resource, resources, connections) => {
    const issues: Record<string, LocalizedText> = publishIssues(
      resources,
      resource,
    );
    const fqdn = dnsNameOf(resources, resource);
    const cert = certificateOf(resources, resource);
    // Nome próprio no CloudFront exige certificado que o cubra (a AWS recusa).
    if (
      fqdn &&
      !issues.certificateId &&
      !(cert && certificateCovers(cert, fqdn))
    ) {
      issues.certificateId = {
        pt: `Para publicar ${fqdn}, escolha um certificado de Serviços globais que cubra esse nome.`,
        en: `To publish ${fqdn}, pick a Global services certificate that covers that name.`,
        es: `Para publicar ${fqdn}, elige un certificado de Servicios globales que cubra ese nombre.`,
      };
      delete issues.dnsRecord;
    }
    const geo = String(resource.config.viewerGeography ?? 'SA');
    const served = PRICE_CLASS_GEOS[String(resource.config.priceClass)] ?? [];
    if (served.length && !served.includes(geo)) {
      issues.priceClass = {
        pt: 'A classe de preço não inclui bordas onde está o público principal: ele será atendido de longe.',
        en: 'The price class excludes edges where the main audience is: it will be served from far away.',
        es: 'La clase de precio no incluye bordes donde está el público principal: se atenderá desde lejos.',
      };
    }
    if (
      connections &&
      cloudfrontOrigins(resources, connections, resource).length === 0
    ) {
      issues['*'] = {
        pt: 'Sem origem: arraste uma conexão do CloudFront até um S3, ALB ou EC2.',
        en: 'No origin: drag a connection from CloudFront to an S3, ALB or EC2.',
        es: 'Sin origen: arrastra una conexión desde CloudFront a un S3, ALB o EC2.',
      };
    }
    return issues;
  },
  fields: [
    {
      key: 'viewerGeography',
      section: 'config',
      type: 'select',
      options: GEO_OPTIONS,
      label: {
        pt: 'Público principal',
        en: 'Main audience',
        es: 'Público principal',
      },
      help: {
        pt: 'Define a tabela de preço de saída e requisições.',
        en: 'Sets the egress and request price table.',
        es: 'Define la tabla de precios de salida y solicitudes.',
      },
    },
    {
      key: 'priceClass',
      section: 'config',
      type: 'select',
      label: {
        pt: 'Classe de preço',
        en: 'Price class',
        es: 'Clase de precio',
      },
      options: [
        {
          value: 'PriceClass_All',
          label: {
            pt: 'Todas as bordas',
            en: 'All edges',
            es: 'Todos los bordes',
          },
        },
        {
          value: 'PriceClass_200',
          label: {
            pt: 'Sem América do Sul e Oceania',
            en: 'Without South America and Oceania',
            es: 'Sin Sudamérica ni Oceanía',
          },
        },
        {
          value: 'PriceClass_100',
          label: {
            pt: 'Só América do Norte e Europa',
            en: 'North America and Europe only',
            es: 'Solo Norteamérica y Europa',
          },
        },
      ],
    },
    {
      key: 'defaultRootObject',
      section: 'config',
      type: 'text',
      mono: true,
      placeholder: 'index.html',
      label: {
        pt: 'Objeto raiz',
        en: 'Default root object',
        es: 'Objeto raíz',
      },
    },
    certificateField(),
    wafField,
    ...dnsFields,
    {
      key: 'dataOutGbMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 10,
      unit: 'GB',
      label: {
        pt: 'Saída para usuários por mês',
        en: 'Egress to viewers per month',
        es: 'Salida a usuarios por mes',
      },
    },
    {
      key: 'requestsMillionsMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1,
      unit: 'mi',
      label: {
        pt: 'Requisições HTTPS por mês (milhões)',
        en: 'HTTPS requests per month (millions)',
        es: 'Solicitudes HTTPS por mes (millones)',
      },
    },
  ],
};

// ── WAF ──────────────────────────────────────────────────────────────────
const MANAGED_LABELS: Record<
  (typeof WAF_MANAGED_GROUPS)[number],
  LocalizedText
> = {
  AWSManagedRulesCommonRuleSet: {
    pt: 'Regras comuns (OWASP)',
    en: 'Core rule set (OWASP)',
    es: 'Reglas comunes (OWASP)',
  },
  AWSManagedRulesKnownBadInputsRuleSet: {
    pt: 'Entradas maliciosas conhecidas',
    en: 'Known bad inputs',
    es: 'Entradas maliciosas conocidas',
  },
  AWSManagedRulesSQLiRuleSet: {
    pt: 'Injeção de SQL',
    en: 'SQL injection',
    es: 'Inyección SQL',
  },
  AWSManagedRulesAmazonIpReputationList: {
    pt: 'IPs de má reputação',
    en: 'IP reputation list',
    es: 'IP de mala reputación',
  },
  AWSManagedRulesAnonymousIpList: {
    pt: 'IPs anônimos (VPN, Tor)',
    en: 'Anonymous IPs (VPN, Tor)',
    es: 'IP anónimas (VPN, Tor)',
  },
  AWSManagedRulesBotControlRuleSet: {
    pt: 'Bot Control (cobrança extra)',
    en: 'Bot Control (extra charge)',
    es: 'Bot Control (cobro extra)',
  },
};

const waf: CloudCatalogEntry = {
  type: WAF_TYPE,
  layer: 5,
  kind: 'node',
  category: 'security',
  optional: true,
  label: { pt: 'WAF — web ACL', en: 'WAF — web ACL', es: 'WAF — web ACL' },
  summary: {
    pt: 'Firewall de aplicação. Na Região protege ALBs; em Serviços globais, o CloudFront.',
    en: 'Application firewall. In a Region it protects ALBs; in Global services, CloudFront.',
    es: 'Firewall de aplicación. En la Región protege ALB; en Servicios globales, CloudFront.',
  },
  namePrefix: { pt: 'waf', en: 'waf', es: 'waf' },
  parents: ['aws.region', GLOBAL_TYPE],
  inspectorHint: {
    pt: 'Para proteger um recurso, escolha este web ACL no campo WAF do ALB ou do CloudFront.',
    en: 'To protect a resource, pick this web ACL in the WAF field of the ALB or CloudFront.',
    es: 'Para proteger un recurso, elige este web ACL en el campo WAF del ALB o de CloudFront.',
  },
  defaults: {
    managedRules: [
      'AWSManagedRulesCommonRuleSet',
      'AWSManagedRulesKnownBadInputsRuleSet',
      'AWSManagedRulesAmazonIpReputationList',
    ],
    rateLimit: 2000,
    requestsMillionsMonth: 10,
  },
  validate: (resource, resources) => {
    const issues: Record<string, LocalizedText> = {};
    const rate = Number(resource.config.rateLimit);
    if (rate > 0 && rate < 10) {
      issues.rateLimit = {
        pt: 'O mínimo da AWS é 10 requisições por IP a cada 5 minutos (0 desliga).',
        en: 'The AWS minimum is 10 requests per IP every 5 minutes (0 turns it off).',
        es: 'El mínimo de AWS es 10 solicitudes por IP cada 5 minutos (0 lo apaga).',
      };
    }
    if (wafRuleCount(resource) === 0) {
      issues['*'] = {
        pt: 'Sem regras: o web ACL só deixa passar.',
        en: 'No rules: the web ACL just lets traffic through.',
        es: 'Sin reglas: el web ACL solo deja pasar.',
      };
    } else if (!resources.some((r) => r.config.wafId === resource.id)) {
      issues['*'] = {
        pt: 'Não protege nada ainda (e já é cobrado): escolha-o no campo WAF de um ALB ou CloudFront.',
        en: 'Protects nothing yet (and is already billed): pick it in the WAF field of an ALB or CloudFront.',
        es: 'Aún no protege nada (y ya se cobra): elígelo en el campo WAF de un ALB o CloudFront.',
      };
    }
    return issues;
  },
  fields: [
    {
      key: 'managedRules',
      section: 'config',
      type: 'multi',
      options: WAF_MANAGED_GROUPS.map((value) => ({
        value,
        label: MANAGED_LABELS[value],
      })),
      label: {
        pt: 'Regras gerenciadas da AWS',
        en: 'AWS managed rules',
        es: 'Reglas administradas de AWS',
      },
    },
    {
      key: 'rateLimit',
      section: 'config',
      type: 'number',
      min: 0,
      max: 2000000000,
      step: 100,
      label: {
        pt: 'Limite por IP (a cada 5 min)',
        en: 'Limit per IP (every 5 min)',
        es: 'Límite por IP (cada 5 min)',
      },
      help: {
        pt: 'Bloqueia o IP que passar disso. 0 desliga.',
        en: 'Blocks the IP that goes over it. 0 turns it off.',
        es: 'Bloquea la IP que lo supere. 0 lo apaga.',
      },
    },
    {
      key: 'requestsMillionsMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1,
      unit: 'mi',
      label: {
        pt: 'Requisições por mês (milhões)',
        en: 'Requests per month (millions)',
        es: 'Solicitudes por mes (millones)',
      },
    },
  ],
};

export const AWS_EDGE: CloudCatalogEntry[] = [
  global,
  internet,
  zone,
  acm,
  cloudfront,
  waf,
];
