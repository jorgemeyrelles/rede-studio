import {
  privateIpIssue,
  readIdList,
  suggestIpInSubnet,
} from '../engines/addressing';
import { securityGroupsOf } from '../engines/connections';
import { INTERNET_TYPE, CLOUDFRONT_TYPE, publishIssues } from '../engines/edge';
import { igwOf } from '../engines/routing';
import { reachabilityIssue, securityIssues } from '../engines/secrets';
import { parsePorts, readSgRules, SG_PEER_PREFIX } from '../engines/security';
import {
  azCountOf,
  closest,
  isSubnet,
  subnetsPerAz,
  subnetTier,
  VPC_TYPE,
} from '../network';
import type { CloudResource } from '../types';
import { certificateField, dnsFields, wafField } from './awsEdge';
import { cognitoField, instanceAccessFields, kmsKeyField } from './awsSecurity';
import { isArmInstanceType } from './awsInstances';
import { alarmFields, observabilityIssues } from './awsObservability';
import type { CloudCatalogEntry, CloudField, LocalizedText } from './types';

/**
 * Recursos L5 do Studio Cloud (F4 — `sprint-cloud-f4-recursos-conexoes.md`):
 * EC2, Auto Scaling, ALB, NLB, RDS e S3. Os campos `config` descrevem o
 * recurso; os de `operation`, como ele roda (horas, volume) — o motor de
 * custo da F6 lê os dois.
 */

const SUBNETS = ['aws.subnet.public', 'aws.subnet.private'];

const vpcIdOf = (resources: CloudResource[], id: string | null) =>
  closest(resources, id, VPC_TYPE)?.id ?? '';

// ── Campos compartilhados ────────────────────────────────────────────────
export const securityGroupsField: CloudField = {
  key: 'securityGroupIds',
  section: 'config',
  type: 'refs',
  source: 'vpcSecurityGroups',
  label: {
    pt: 'Security groups',
    en: 'Security groups',
    es: 'Security groups',
  },
  help: {
    pt: 'As conexões que chegam neste recurso viram regras de entrada nestes SGs.',
    en: 'Connections arriving at this resource become inbound rules in these SGs.',
    es: 'Las conexiones que llegan a este recurso se vuelven reglas de entrada en estos SG.',
  },
};

export const privateIpField: CloudField = {
  key: 'privateIp',
  section: 'config',
  type: 'text',
  mono: true,
  autofill: (resources, resource) =>
    resource.parentId
      ? suggestIpInSubnet(resources, resource.parentId, resource.id)
      : null,
  label: { pt: 'IP privado', en: 'Private IP', es: 'IP privada' },
  help: {
    pt: 'Próximo livre da subnet (a AWS reserva as 4 primeiras e a última).',
    en: 'Next free in the subnet (AWS reserves the first 4 and the last).',
    es: 'Siguiente libre de la subnet (AWS reserva las 4 primeras y la última).',
  },
};

export const subnetsField = (help: LocalizedText): CloudField => ({
  key: 'subnetIds',
  section: 'config',
  type: 'refs',
  source: 'vpcSubnets',
  label: { pt: 'Subnets', en: 'Subnets', es: 'Subnets' },
  help,
});

const hoursField: CloudField = {
  key: 'hoursPerMonth',
  section: 'operation',
  type: 'number',
  min: 0,
  max: 744,
  step: 1,
  unit: 'h',
  label: { pt: 'Horas por mês', en: 'Hours per month', es: 'Horas por mes' },
  help: {
    pt: '730 = ligado o mês inteiro.',
    en: '730 = on all month.',
    es: '730 = encendido todo el mes.',
  },
};

const monitoringField: CloudField = {
  key: 'detailedMonitoring',
  section: 'operation',
  type: 'boolean',
  label: {
    pt: 'Monitoramento detalhado (1 min)',
    en: 'Detailed monitoring (1 min)',
    es: 'Monitoreo detallado (1 min)',
  },
  help: {
    pt: 'Métricas a cada 1 min: 7 métricas pagas por instância no custo.',
    en: 'Metrics every 1 min: 7 paid metrics per instance in the cost.',
    es: 'Métricas cada 1 min: 7 métricas pagas por instancia en el costo.',
  },
};

const twoAzError = (count: number): LocalizedText => ({
  pt: `As subnets cobrem ${count} AZ: a AWS exige ao menos 2.`,
  en: `The subnets cover ${count} AZ: AWS requires at least 2.`,
  es: `Las subnets cubren ${count} AZ: AWS exige al menos 2.`,
});

export const noSgWarning: LocalizedText = {
  pt: 'Sem security group: a AWS usaria o SG padrão da VPC. Escolha um (aba Segurança).',
  en: 'No security group: AWS would use the VPC default SG. Pick one (Security tab).',
  es: 'Sin security group: AWS usaría el SG predeterminado de la VPC. Elige uno (pestaña Seguridad).',
};

/** Junta dois avisos gerais do elemento num texto só (por idioma). */
export const joinIssues = (
  first: LocalizedText | undefined,
  second: LocalizedText,
): LocalizedText =>
  first
    ? {
        pt: `${first.pt} ${second.pt}`,
        en: `${first.en} ${second.en}`,
        es: `${first.es} ${second.es}`,
      }
    : second;

const ipIssues = (
  resource: CloudResource,
  resources: CloudResource[],
): Record<string, LocalizedText> => {
  const issue = privateIpIssue(resources, resource);
  return issue ? { privateIp: issue } : {};
};

// ── EC2 ──────────────────────────────────────────────────────────────────
const ec2: CloudCatalogEntry = {
  type: 'aws.ec2',
  layer: 5,
  kind: 'node',
  category: 'compute',
  label: { pt: 'EC2', en: 'EC2', es: 'EC2' },
  summary: {
    pt: 'Máquina virtual. Tipo do catálogo de preços da região.',
    en: 'Virtual machine. Type from the region price catalog.',
    es: 'Máquina virtual. Tipo del catálogo de precios de la región.',
  },
  namePrefix: { pt: 'ec2', en: 'ec2', es: 'ec2' },
  parents: SUBNETS,
  defaults: {
    instanceType: 't3.micro',
    os: 'linux',
    ebsGb: 20,
    ebsIops: 3000,
    ebsThroughput: 125,
    securityGroupIds: [],
    keyPair: '',
    kmsKeyId: '',
    sessionManager: false,
    secretIds: [],
    detailedMonitoring: false,
    hoursPerMonth: 730,
  },
  derive: ({ state, parent }) => ({
    privateIp: parent
      ? (suggestIpInSubnet(state.resources, parent.id, null) ?? '')
      : '',
    publicIp: parent?.config.mapPublicIpOnLaunch === true,
  }),
  validate: (resource, resources, connections) => {
    const issues: Record<string, LocalizedText> = {
      ...ipIssues(resource, resources),
    };
    const subnet = resources.find((r) => r.id === resource.parentId);
    if (
      resource.config.publicIp === true &&
      subnet &&
      subnetTier(subnet) !== 'public'
    ) {
      issues.publicIp = {
        pt: 'Subnet sem rota para o IGW: o IP público não seria alcançável.',
        en: 'Subnet without a route to the IGW: the public IP would be unreachable.',
        es: 'Subnet sin ruta al IGW: la IP pública no sería alcanzable.',
      };
    }
    if (
      resource.config.os === 'windows' &&
      isArmInstanceType(resource.config.instanceType)
    ) {
      issues.os = {
        pt: 'Windows não roda em instâncias Graviton (arm64). Escolha um tipo x86 (t3, m6i…) ou Linux.',
        en: 'Windows does not run on Graviton (arm64) instances. Pick an x86 type (t3, m6i…) or Linux.',
        es: 'Windows no corre en instancias Graviton (arm64). Elige un tipo x86 (t3, m6i…) o Linux.',
      };
    }
    if (securityGroupsOf(resource).length === 0) issues['*'] = noSgWarning;
    Object.assign(issues, securityIssues(resources, resource));
    Object.assign(issues, observabilityIssues(resource, resources));
    // Avisos gerais somam (o de alcance não pode sumir atrás do "sem SG").
    const unreachable = reachabilityIssue(resources, resource, connections);
    if (unreachable) issues['*'] = joinIssues(issues['*'], unreachable);
    return issues;
  },
  fields: [
    {
      key: 'instanceType',
      section: 'config',
      type: 'select',
      optionsSource: 'ec2InstanceTypes',
      label: {
        pt: 'Tipo de instância',
        en: 'Instance type',
        es: 'Tipo de instancia',
      },
    },
    {
      key: 'os',
      section: 'config',
      type: 'select',
      label: {
        pt: 'Sistema operacional',
        en: 'Operating system',
        es: 'Sistema operativo',
      },
      options: [
        { value: 'linux', label: { pt: 'Linux', en: 'Linux', es: 'Linux' } },
        {
          value: 'windows',
          label: {
            pt: 'Windows (licença incluída)',
            en: 'Windows (license included)',
            es: 'Windows (licencia incluida)',
          },
        },
      ],
    },
    privateIpField,
    {
      key: 'publicIp',
      section: 'config',
      type: 'boolean',
      label: { pt: 'IP público', en: 'Public IP', es: 'IP pública' },
    },
    securityGroupsField,
    {
      key: 'ebsGb',
      section: 'config',
      type: 'number',
      min: 1,
      max: 16384,
      step: 1,
      unit: 'GB',
      label: { pt: 'Disco EBS gp3', en: 'EBS gp3 volume', es: 'Disco EBS gp3' },
    },
    {
      key: 'ebsIops',
      section: 'config',
      type: 'number',
      min: 3000,
      max: 16000,
      step: 100,
      unit: 'IOPS',
      label: { pt: 'IOPS do disco', en: 'Volume IOPS', es: 'IOPS del disco' },
    },
    {
      key: 'ebsThroughput',
      section: 'config',
      type: 'number',
      min: 125,
      max: 1000,
      step: 25,
      unit: 'MiB/s',
      label: {
        pt: 'Vazão do disco',
        en: 'Volume throughput',
        es: 'Rendimiento del disco',
      },
    },
    {
      key: 'keyPair',
      section: 'config',
      type: 'text',
      placeholder: 'minha-chave',
      label: {
        pt: 'Key pair (SSH)',
        en: 'Key pair (SSH)',
        es: 'Key pair (SSH)',
      },
    },
    kmsKeyField(),
    ...instanceAccessFields,
    monitoringField,
    ...alarmFields,
    hoursField,
  ],
};

// ── Auto Scaling ─────────────────────────────────────────────────────────
const asg: CloudCatalogEntry = {
  type: 'aws.asg',
  layer: 5,
  kind: 'node',
  category: 'compute',
  label: { pt: 'Auto Scaling', en: 'Auto Scaling', es: 'Auto Scaling' },
  summary: {
    pt: 'Grupo de EC2 que cresce e encolhe, espalhado pelas AZs.',
    en: 'EC2 group that scales out and in, spread across AZs.',
    es: 'Grupo de EC2 que crece y se reduce, repartido entre AZ.',
  },
  namePrefix: { pt: 'asg', en: 'asg', es: 'asg' },
  parents: SUBNETS,
  defaults: {
    instanceType: 't3.small',
    os: 'linux',
    minSize: 2,
    desiredSize: 2,
    maxSize: 4,
    ebsGb: 20,
    kmsKeyId: '',
    sessionManager: false,
    secretIds: [],
    securityGroupIds: [],
    detailedMonitoring: false,
    hoursPerMonth: 730,
  },
  derive: ({ state, parent }) =>
    parent
      ? {
          subnetIds: subnetsPerAz(
            state.resources,
            vpcIdOf(state.resources, parent.id),
            subnetTier(parent),
            parent.id,
          ),
        }
      : { subnetIds: [] },
  validate: (resource, resources, connections) => {
    const issues: Record<string, LocalizedText> = {};
    const { minSize, desiredSize, maxSize } = resource.config as Record<
      string,
      number
    >;
    if (!(minSize <= desiredSize && desiredSize <= maxSize)) {
      issues.desiredSize = {
        pt: 'Use mínimo ≤ desejado ≤ máximo.',
        en: 'Use minimum ≤ desired ≤ maximum.',
        es: 'Usa mínimo ≤ deseado ≤ máximo.',
      };
    }
    const azs = azCountOf(resources, readIdList(resource.config.subnetIds));
    if (azs < 2) {
      issues.subnetIds = {
        pt: 'Uma AZ só: sem alta disponibilidade. Inclua uma subnet de outra AZ.',
        en: 'Single AZ: no high availability. Add a subnet from another AZ.',
        es: 'Una sola AZ: sin alta disponibilidad. Incluye una subnet de otra AZ.',
      };
    }
    if (securityGroupsOf(resource).length === 0) issues['*'] = noSgWarning;
    Object.assign(issues, securityIssues(resources, resource));
    Object.assign(issues, observabilityIssues(resource, resources));
    // Avisos gerais somam (o de alcance não pode sumir atrás do "sem SG").
    const unreachable = reachabilityIssue(resources, resource, connections);
    if (unreachable) issues['*'] = joinIssues(issues['*'], unreachable);
    return issues;
  },
  fields: [
    {
      key: 'instanceType',
      section: 'config',
      type: 'select',
      optionsSource: 'ec2InstanceTypes',
      label: {
        pt: 'Tipo de instância',
        en: 'Instance type',
        es: 'Tipo de instancia',
      },
    },
    subnetsField({
      pt: 'Uma por AZ: o grupo distribui as instâncias entre elas.',
      en: 'One per AZ: the group spreads instances across them.',
      es: 'Una por AZ: el grupo reparte las instancias entre ellas.',
    }),
    securityGroupsField,
    {
      key: 'ebsGb',
      section: 'config',
      type: 'number',
      min: 1,
      max: 16384,
      step: 1,
      unit: 'GB',
      label: {
        pt: 'Disco EBS gp3 (por instância)',
        en: 'EBS gp3 volume (per instance)',
        es: 'Disco EBS gp3 (por instancia)',
      },
    },
    {
      key: 'minSize',
      section: 'operation',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      label: { pt: 'Mínimo', en: 'Minimum', es: 'Mínimo' },
    },
    {
      key: 'desiredSize',
      section: 'operation',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      label: { pt: 'Desejado', en: 'Desired', es: 'Deseado' },
    },
    {
      key: 'maxSize',
      section: 'operation',
      type: 'number',
      min: 1,
      max: 100,
      step: 1,
      label: { pt: 'Máximo', en: 'Maximum', es: 'Máximo' },
    },
    kmsKeyField(),
    ...instanceAccessFields,
    monitoringField,
    ...alarmFields,
    hoursField,
  ],
};

// ── Load balancers (faixa de borda da VPC) ───────────────────────────────
const lbRequires: CloudCatalogEntry['requires'] = ({ state, parent }) => {
  if (!parent) return null;
  const azs = azCountOf(
    state.resources,
    subnetsPerAz(state.resources, parent.id, ['public', 'private', 'isolated']),
  );
  return azs >= 2
    ? null
    : {
        pt: 'Crie antes subnets em 2 AZs diferentes desta VPC.',
        en: 'Create subnets in 2 different AZs of this VPC first.',
        es: 'Crea antes subnets en 2 AZ distintas de esta VPC.',
      };
};

const lbDerive: CloudCatalogEntry['derive'] = ({ state, parent }) => {
  if (!parent) return { subnetIds: [] };
  const publics = subnetsPerAz(state.resources, parent.id, 'public');
  return publics.length >= 2
    ? { scheme: 'internet-facing', subnetIds: publics }
    : {
        scheme: 'internal',
        subnetIds: subnetsPerAz(state.resources, parent.id, 'private'),
      };
};

const lbValidate = (resource: CloudResource, resources: CloudResource[]) => {
  const issues: Record<string, LocalizedText> = {};
  const ids = readIdList(resource.config.subnetIds);
  const azs = azCountOf(resources, ids);
  if (azs < 2) issues.subnetIds = twoAzError(azs);
  if (resource.config.scheme === 'internet-facing') {
    const nonPublic = ids
      .map((id) => resources.find((r) => r.id === id))
      .filter((s): s is CloudResource =>
        Boolean(s && isSubnet(s) && subnetTier(s) !== 'public'),
      );
    if (nonPublic.length) {
      issues.scheme = {
        pt: `Voltado à internet, mas ${nonPublic.map((s) => s.name).join(', ')} não é pública.`,
        en: `Internet-facing, but ${nonPublic.map((s) => s.name).join(', ')} is not public.`,
        es: `Expuesto a internet, pero ${nonPublic.map((s) => s.name).join(', ')} no es pública.`,
      };
    }
    if (resource.parentId && !igwOf(resources, resource.parentId)) {
      issues['*'] = {
        pt: 'Voltado à internet sem Internet Gateway na VPC.',
        en: 'Internet-facing with no Internet Gateway in the VPC.',
        es: 'Expuesto a internet sin Internet Gateway en la VPC.',
      };
    }
  }
  return issues;
};

/** Algum SG do LB aceita entrada de um CIDR (não de outro SG) na porta do listener? */
function opensListenerToCidr(
  lb: CloudResource,
  resources: CloudResource[],
  sgIds: string[],
) {
  const port = Number(lb.config.listenerPort) || 443;
  return sgIds.some((id) => {
    const sg = resources.find((r) => r.id === id);
    return (
      sg !== undefined &&
      readSgRules(sg).some((rule) => {
        if (rule.direction !== 'ingress') return false;
        if (rule.peer.startsWith(SG_PEER_PREFIX)) return false;
        if (rule.protocol === 'all') return true;
        const range = rule.protocol === 'tcp' ? parsePorts(rule.ports) : null;
        return range !== null && range[0] <= port && port <= range[1];
      })
    );
  });
}

const schemeField: CloudField = {
  key: 'scheme',
  section: 'config',
  type: 'select',
  label: { pt: 'Esquema', en: 'Scheme', es: 'Esquema' },
  options: [
    {
      value: 'internet-facing',
      label: {
        pt: 'Voltado à internet',
        en: 'Internet-facing',
        es: 'Expuesto a internet',
      },
    },
    {
      value: 'internal',
      label: { pt: 'Interno', en: 'Internal', es: 'Interno' },
    },
  ],
};

const lbSubnetsHelp: LocalizedText = {
  pt: 'Uma por AZ, ao menos 2. Públicas se for voltado à internet.',
  en: 'One per AZ, at least 2. Public if internet-facing.',
  es: 'Una por AZ, al menos 2. Públicas si está expuesto a internet.',
};

const alb: CloudCatalogEntry = {
  type: 'aws.alb',
  layer: 5,
  kind: 'node',
  category: 'edge',
  label: {
    pt: 'Application Load Balancer',
    en: 'Application Load Balancer',
    es: 'Application Load Balancer',
  },
  summary: {
    pt: 'HTTP/HTTPS (camada 7) na frente das instâncias, em 2+ AZs.',
    en: 'HTTP/HTTPS (layer 7) in front of instances, across 2+ AZs.',
    es: 'HTTP/HTTPS (capa 7) delante de las instancias, en 2+ AZ.',
  },
  namePrefix: { pt: 'alb', en: 'alb', es: 'alb' },
  parents: [VPC_TYPE],
  requires: lbRequires,
  defaults: {
    listenerProtocol: 'HTTPS',
    listenerPort: 443,
    certificateId: '',
    certificateArn: '',
    wafId: '',
    cognitoUserPoolId: '',
    dnsZoneId: '',
    dnsRecord: '',
    securityGroupIds: [],
    lcuPerHour: 1,
    hoursPerMonth: 730,
  },
  derive: lbDerive,
  validate: (resource, resources, connections) => {
    const issues = {
      ...lbValidate(resource, resources),
      ...publishIssues(resources, resource),
      ...securityIssues(resources, resource),
      ...observabilityIssues(resource, resources),
    };
    if (
      resource.config.listenerProtocol === 'HTTPS' &&
      !String(resource.config.certificateId ?? '').trim() &&
      !String(resource.config.certificateArn ?? '').trim()
    ) {
      issues.certificateArn = {
        pt: 'HTTPS precisa de um certificado ACM.',
        en: 'HTTPS needs an ACM certificate.',
        es: 'HTTPS necesita un certificado ACM.',
      };
    }
    const sgIds = securityGroupsOf(resource);
    if (sgIds.length === 0) issues['*'] ??= noSgWarning;
    else if (
      resource.config.scheme === 'internet-facing' &&
      !opensListenerToCidr(resource, resources, sgIds) &&
      // A conexão vinda da Internet ou do CloudFront já deriva a entrada.
      !(connections ?? []).some(
        (c) =>
          c.target === resource.id &&
          [INTERNET_TYPE, CLOUDFRONT_TYPE].includes(
            resources.find((r) => r.id === c.source)?.type ?? '',
          ),
      )
    ) {
      const port = Number(resource.config.listenerPort) || 443;
      issues['*'] ??= {
        pt: `ALB voltado à internet sem entrada na porta ${port}: ligue a Internet (ou o CloudFront) nele, ou crie a regra na aba Segurança.`,
        en: `Internet-facing ALB has no inbound traffic on port ${port}: connect the Internet (or CloudFront) to it, or add the rule in the Security tab.`,
        es: `ALB expuesto a internet sin entrada en el puerto ${port}: conecta Internet (o CloudFront) a él, o crea la regla en la pestaña Seguridad.`,
      };
    }
    return issues;
  },
  fields: [
    schemeField,
    subnetsField(lbSubnetsHelp),
    securityGroupsField,
    {
      key: 'listenerProtocol',
      section: 'config',
      type: 'select',
      label: { pt: 'Listener', en: 'Listener', es: 'Listener' },
      options: [
        { value: 'HTTPS', label: { pt: 'HTTPS', en: 'HTTPS', es: 'HTTPS' } },
        { value: 'HTTP', label: { pt: 'HTTP', en: 'HTTP', es: 'HTTP' } },
      ],
    },
    {
      key: 'listenerPort',
      section: 'config',
      type: 'number',
      min: 1,
      max: 65535,
      step: 1,
      label: {
        pt: 'Porta do listener',
        en: 'Listener port',
        es: 'Puerto del listener',
      },
    },
    certificateField((config) => config.listenerProtocol === 'HTTPS'),
    {
      key: 'certificateArn',
      section: 'config',
      type: 'text',
      mono: true,
      placeholder: 'arn:aws:acm:…',
      visibleWhen: (config) =>
        config.listenerProtocol === 'HTTPS' && !config.certificateId,
      label: {
        pt: 'Ou ARN de um certificado externo',
        en: 'Or the ARN of an external certificate',
        es: 'O el ARN de un certificado externo',
      },
    },
    wafField,
    cognitoField,
    ...dnsFields,
    {
      key: 'lcuPerHour',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 0.5,
      unit: 'LCU',
      label: {
        pt: 'Capacidade média por hora',
        en: 'Average capacity per hour',
        es: 'Capacidad media por hora',
      },
    },
    ...alarmFields,
    hoursField,
  ],
};

const nlb: CloudCatalogEntry = {
  type: 'aws.nlb',
  layer: 5,
  kind: 'node',
  category: 'edge',
  label: {
    pt: 'Network Load Balancer',
    en: 'Network Load Balancer',
    es: 'Network Load Balancer',
  },
  summary: {
    pt: 'TCP/UDP (camada 4), latência baixa e IP fixo por AZ.',
    en: 'TCP/UDP (layer 4), low latency and a fixed IP per AZ.',
    es: 'TCP/UDP (capa 4), baja latencia e IP fija por AZ.',
  },
  namePrefix: { pt: 'nlb', en: 'nlb', es: 'nlb' },
  parents: [VPC_TYPE],
  requires: lbRequires,
  defaults: {
    listenerProtocol: 'TCP',
    listenerPort: 443,
    certificateId: '',
    dnsZoneId: '',
    dnsRecord: '',
    lcuPerHour: 1,
    hoursPerMonth: 730,
  },
  derive: lbDerive,
  validate: (resource, resources) => {
    const issues = {
      ...lbValidate(resource, resources),
      ...publishIssues(resources, resource),
    };
    if (
      resource.config.listenerProtocol === 'TLS' &&
      !String(resource.config.certificateId ?? '').trim()
    ) {
      issues.certificateId ??= {
        pt: 'Listener TLS precisa de um certificado ACM da mesma Região.',
        en: 'A TLS listener needs an ACM certificate from the same Region.',
        es: 'Un listener TLS necesita un certificado ACM de la misma Región.',
      };
    }
    return issues;
  },
  fields: [
    schemeField,
    subnetsField(lbSubnetsHelp),
    {
      key: 'listenerProtocol',
      section: 'config',
      type: 'select',
      label: { pt: 'Listener', en: 'Listener', es: 'Listener' },
      options: [
        { value: 'TCP', label: { pt: 'TCP', en: 'TCP', es: 'TCP' } },
        { value: 'TLS', label: { pt: 'TLS', en: 'TLS', es: 'TLS' } },
        { value: 'UDP', label: { pt: 'UDP', en: 'UDP', es: 'UDP' } },
      ],
    },
    {
      key: 'listenerPort',
      section: 'config',
      type: 'number',
      min: 1,
      max: 65535,
      step: 1,
      label: {
        pt: 'Porta do listener',
        en: 'Listener port',
        es: 'Puerto del listener',
      },
    },
    certificateField((config) => config.listenerProtocol === 'TLS'),
    ...dnsFields,
    {
      key: 'lcuPerHour',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 0.5,
      unit: 'NLCU',
      label: {
        pt: 'Capacidade média por hora',
        en: 'Average capacity per hour',
        es: 'Capacidad media por hora',
      },
    },
    hoursField,
  ],
};

// ── RDS ──────────────────────────────────────────────────────────────────
const rds: CloudCatalogEntry = {
  type: 'aws.rds',
  layer: 5,
  kind: 'node',
  category: 'data',
  label: { pt: 'RDS', en: 'RDS', es: 'RDS' },
  summary: {
    pt: 'Banco gerenciado (PostgreSQL/MySQL) em subnet privada.',
    en: 'Managed database (PostgreSQL/MySQL) in a private subnet.',
    es: 'Base de datos administrada (PostgreSQL/MySQL) en subnet privada.',
  },
  namePrefix: { pt: 'db', en: 'db', es: 'db' },
  parents: ['aws.subnet.private'],
  defaults: {
    engine: 'postgres',
    engineVersion: '16',
    instanceClass: 'db.t4g.micro',
    storageGb: 20,
    multiAz: false,
    encrypted: true,
    kmsKeyId: '',
    securityGroupIds: [],
    backupRetentionDays: 7,
    hoursPerMonth: 730,
  },
  derive: ({ state, parent }) =>
    parent
      ? {
          privateIp: suggestIpInSubnet(state.resources, parent.id, null) ?? '',
          subnetIds: subnetsPerAz(
            state.resources,
            vpcIdOf(state.resources, parent.id),
            subnetTier(parent),
            parent.id,
          ),
        }
      : {},
  validate: (resource, resources) => {
    const issues: Record<string, LocalizedText> = {
      ...ipIssues(resource, resources),
    };
    const ids = readIdList(resource.config.subnetIds);
    const azs = azCountOf(resources, ids);
    if (azs < 2) issues.subnetIds = twoAzError(azs);
    if (resource.parentId && !ids.includes(resource.parentId)) {
      issues.subnetIds ??= {
        pt: 'A subnet da instância precisa estar no subnet group.',
        en: 'The instance subnet must be in the subnet group.',
        es: 'La subnet de la instancia debe estar en el subnet group.',
      };
    }
    if (securityGroupsOf(resource).length === 0) issues['*'] = noSgWarning;
    Object.assign(issues, securityIssues(resources, resource));
    Object.assign(issues, observabilityIssues(resource, resources));
    return issues;
  },
  fields: [
    {
      key: 'engine',
      section: 'config',
      type: 'select',
      label: { pt: 'Engine', en: 'Engine', es: 'Engine' },
      options: [
        {
          value: 'postgres',
          label: { pt: 'PostgreSQL', en: 'PostgreSQL', es: 'PostgreSQL' },
        },
        { value: 'mysql', label: { pt: 'MySQL', en: 'MySQL', es: 'MySQL' } },
      ],
    },
    {
      key: 'engineVersion',
      section: 'config',
      type: 'text',
      mono: true,
      label: { pt: 'Versão', en: 'Version', es: 'Versión' },
    },
    {
      key: 'instanceClass',
      section: 'config',
      type: 'select',
      optionsSource: 'rdsInstanceClasses',
      label: { pt: 'Classe', en: 'Class', es: 'Clase' },
    },
    {
      key: 'storageGb',
      section: 'config',
      type: 'number',
      min: 20,
      max: 65536,
      step: 1,
      unit: 'GB',
      label: { pt: 'Storage gp3', en: 'gp3 storage', es: 'Storage gp3' },
    },
    {
      key: 'multiAz',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Multi-AZ (standby em outra AZ)',
        en: 'Multi-AZ (standby in another AZ)',
        es: 'Multi-AZ (standby en otra AZ)',
      },
    },
    {
      key: 'encrypted',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Criptografia em repouso (KMS)',
        en: 'Encryption at rest (KMS)',
        es: 'Cifrado en reposo (KMS)',
      },
    },
    kmsKeyField((config) => config.encrypted !== false),
    privateIpField,
    subnetsField({
      pt: 'Subnet group: ao menos 2 AZs, mesmo sem Multi-AZ (exigência da AWS).',
      en: 'Subnet group: at least 2 AZs, even without Multi-AZ (AWS requirement).',
      es: 'Subnet group: al menos 2 AZ, incluso sin Multi-AZ (exigencia de AWS).',
    }),
    securityGroupsField,
    {
      key: 'backupRetentionDays',
      section: 'operation',
      type: 'number',
      min: 0,
      max: 35,
      step: 1,
      label: {
        pt: 'Retenção de backup (dias)',
        en: 'Backup retention (days)',
        es: 'Retención de backup (días)',
      },
    },
    ...alarmFields,
    hoursField,
  ],
};

// ── S3 (regional, fora da VPC) ───────────────────────────────────────────
const s3: CloudCatalogEntry = {
  type: 'aws.s3',
  layer: 5,
  kind: 'node',
  category: 'data',
  label: { pt: 'S3', en: 'S3', es: 'S3' },
  summary: {
    pt: 'Bucket de objetos, regional (fora da VPC).',
    en: 'Object bucket, regional (outside the VPC).',
    es: 'Bucket de objetos, regional (fuera de la VPC).',
  },
  namePrefix: { pt: 'bucket', en: 'bucket', es: 'bucket' },
  parents: ['aws.region'],
  defaults: {
    versioning: true,
    encryption: 'sse-s3',
    blockPublicAccess: true,
    kmsKeyId: '',
    storageGbMonth: 100,
    requestsPerMonth: 100000,
    putRequestsPerMonth: 10000,
  },
  validate: (resource, resources) => ({
    ...securityIssues(resources, resource),
    ...(resource.config.blockPublicAccess === false
      ? {
          blockPublicAccess: {
            pt: 'Bucket pode ficar público. Só desligue para site estático.',
            en: 'The bucket may become public. Turn off only for a static site.',
            es: 'El bucket puede quedar público. Desactiva solo para sitio estático.',
          },
        }
      : {}),
  }),
  fields: [
    {
      key: 'versioning',
      section: 'config',
      type: 'boolean',
      label: { pt: 'Versionamento', en: 'Versioning', es: 'Versionado' },
    },
    {
      key: 'encryption',
      section: 'config',
      type: 'select',
      label: { pt: 'Criptografia', en: 'Encryption', es: 'Cifrado' },
      options: [
        {
          value: 'sse-s3',
          label: {
            pt: 'SSE-S3 (padrão)',
            en: 'SSE-S3 (default)',
            es: 'SSE-S3 (predeterminado)',
          },
        },
        {
          value: 'sse-kms',
          label: { pt: 'SSE-KMS', en: 'SSE-KMS', es: 'SSE-KMS' },
        },
      ],
    },
    kmsKeyField((config) => config.encryption === 'sse-kms'),
    {
      key: 'blockPublicAccess',
      section: 'config',
      type: 'boolean',
      label: {
        pt: 'Bloquear acesso público',
        en: 'Block public access',
        es: 'Bloquear acceso público',
      },
    },
    {
      key: 'storageGbMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 10,
      unit: 'GB',
      label: { pt: 'Armazenado', en: 'Stored', es: 'Almacenado' },
    },
    {
      key: 'requestsPerMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1000,
      label: {
        pt: 'Leituras (GET) por mês',
        en: 'Reads (GET) per month',
        es: 'Lecturas (GET) por mes',
      },
    },
    {
      key: 'putRequestsPerMonth',
      section: 'operation',
      type: 'number',
      min: 0,
      step: 1000,
      label: {
        pt: 'Gravações (PUT, COPY, POST, LIST) por mês',
        en: 'Writes (PUT, COPY, POST, LIST) per month',
        es: 'Escrituras (PUT, COPY, POST, LIST) por mes',
      },
    },
  ],
};

export const AWS_RESOURCES: CloudCatalogEntry[] = [ec2, asg, alb, nlb, rds, s3];
