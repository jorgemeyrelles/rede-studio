/**
 * Motor Terraform do Studio Cloud (F5 — `sprint-cloud-f5-terraform.md`).
 * Função pura: rascunho → arquivos `.tf` determinísticos + TODOs.
 *
 * Este módulo: tipos públicos, textos (`T`) e utilitários de nível de
 * módulo. Estado por geração em `context.ts`; cada seção em `files/`.
 *
 * Elemento com problema que impede o recurso (ou com dependência
 * incompleta) não gera bloco inválido: vira `# TODO(rede-studio): …` no
 * arquivo e entra na lista de TODOs (decisão D3).
 */
import type { AppLanguage } from '../../../../types/i18n';
import type { LocalizedText } from '../../catalog';
import type { CloudConnection, CloudResource } from '../../types';
import { raw, type HclEntry } from './hcl';

export type IamTemplateLite = {
  key: string;
  iamName?: string | null;
  policyArn?: string | null;
  trustedService?: string | null;
};

export type TerraformInput = {
  resources: CloudResource[];
  connections: CloudConnection[];
  projectName: string;
  language: AppLanguage;
  /** Catálogo IAM (ARNs das políticas, nomes e serviço de confiança). `null` = indisponível. */
  iamCatalog: {
    groups: IamTemplateLite[];
    roles: IamTemplateLite[];
    policies: IamTemplateLite[];
  } | null;
};

export type TerraformBlock = {
  resourceIds: string[];
  startLine: number;
  endLine: number;
};
export type TerraformFile = {
  path: string;
  content: string;
  blocks: TerraformBlock[];
};
export type TerraformTodo = {
  resourceId: string | null;
  file: string;
  message: LocalizedText;
  /** Chave do `validate` do catálogo que este TODO repete (a aba Validação não duplica). */
  issueKey?: string;
};
export type TerraformOutput = {
  files: TerraformFile[];
  todos: TerraformTodo[];
};

export const TERRAFORM_FILES = [
  'providers.tf',
  'variables.tf',
  'iam.tf',
  'network.tf',
  'security.tf',
  'compute.tf',
  'data.tf',
  'edge.tf',
  'observability.tf',
  'outputs.tf',
] as const;
export type FileName = (typeof TERRAFORM_FILES)[number];

/** Chaves do `validate` do catálogo que impedem gerar o recurso (viram TODO). */
export const BLOCKING_KEYS = [
  'cidr',
  'privateIp',
  'subnetIds',
  'desiredSize',
  'zone',
  'certificateArn',
  'service',
  'os',
  'domain',
  'vpcIds',
  'certificateId',
  'wafId',
  'rateLimit',
  'kmsKeyId',
  'cognitoUserPoolId',
  'secretIds',
  'path',
  'partitionKey',
  'deadLetterQueueId',
  'logGroupId',
  'alarmTopicId',
  'bucketId',
];

export const T: Record<
  AppLanguage,
  {
    header: Record<FileName, string>;
    vars: {
      project: string;
      environment: string;
      owner: string;
      costCenter: string;
      dbUsername: string;
    };
    noRegion: string;
    dependsOn: (name: string) => string;
    noIamCatalog: string;
    noTrust: string;
    flowLogs: string;
    missingIgw: string;
    vpceManual: string;
    ruleInvalid: string;
    noTargets: string;
    nlbTls: string;
    certManual: string;
    noOrigin: string;
    originBlocked: (name: string) => string;
    originTls: (name: string) => string;
    pathMissing: (name: string) => string;
    recordInvalid: string;
    shieldSubscription: string;
    secretRotation: string;
    secretValue: string;
    lambdaPackage: (path: string) => string;
    triggerVisibility: (queue: string, fn: string) => string;
    subscriptionBlocked: (name: string) => string;
    snsKms: (key: string) => string;
    keyPolicy: (key: string, service: string) => string;
    backupTargetSkipped: (name: string) => string;
    configNoBucket: string;
    routeTarget: (name: string) => string;
    lbPortUnused: (port: number, used: number) => string;
    nlbNoCompatible: (protocol: string) => string;
    rdsIp: string;
    sgDefault: string;
    generated: string;
  }
> = {
  pt: {
    header: {
      'providers.tf': 'Versões, provider AWS e tags padrão (default_tags).',
      'variables.tf':
        'Variáveis do projeto (padrões vindos da conta no rascunho).',
      'iam.tf':
        'Identidades: usuários, grupos e roles IAM com políticas gerenciadas.',
      'network.tf':
        'Rede: VPC, subnets, gateways, NAT, route tables e endpoints.',
      'security.tf':
        'Segurança: security groups (regras próprias e das conexões), NACLs, chaves KMS, segredos, parâmetros e Cognito.',
      'compute.tf': 'Computação: AMIs, EC2, Auto Scaling e load balancers.',
      'data.tf':
        'Dados e mensageria: RDS, Aurora, ElastiCache, DynamoDB, EFS, S3, SQS e SNS.',
      'edge.tf': 'Borda: Route 53, certificados, CloudFront, WAF e Shield.',
      'observability.tf':
        'Observabilidade e governança: grupos de logs, Flow Logs, alarmes, CloudTrail, AWS Backup, GuardDuty, Security Hub e Config.',
      'outputs.tf': 'Saídas úteis depois do apply.',
    },
    vars: {
      project: 'Nome do projeto (tag Project).',
      environment: 'Ambiente: dev, stage ou prod (tag Environment).',
      owner: 'Responsável (tag Owner).',
      costCenter: 'Centro de custo (tag CostCenter).',
      dbUsername: 'Usuário mestre do RDS (a senha fica no Secrets Manager).',
    },
    noRegion: 'crie uma Região na conta para gerar o provider.',
    dependsOn: (name) => `depende de ${name}, que está incompleto.`,
    noIamCatalog:
      'catálogo IAM indisponível: os anexos de políticas foram omitidos.',
    noTrust:
      'role sem serviço de confiança no catálogo: defina o assume_role_policy.',
    flowLogs:
      'Flow Logs ligado sem grupo de logs: escolha o grupo na VPC (crie um na Região).',
    missingIgw: 'rota 0.0.0.0/0 sem Internet Gateway na VPC.',
    vpceManual:
      'rota manual para endpoint: a AWS só aceita prefix list (já coberta pelo endpoint).',
    ruleInvalid: 'regra inválida omitida.',
    noTargets:
      'sem destinos ligados (conexão de associação): listener omitido.',
    nlbTls: 'listener TLS precisa de certificado ACM.',
    certManual:
      'nenhuma zona Route 53 do projeto cobre o domínio: crie os registros de validação no seu DNS.',
    noOrigin:
      'sem origem (ligue o CloudFront a um S3, ALB ou EC2): distribuição omitida.',
    originBlocked: (name) => `origem ${name} omitida (o recurso tem problema).`,
    originTls: (name) =>
      `origem ${name} em HTTPS sem nome DNS próprio: o certificado não cobre o nome do load balancer; dê a ele um nome na zona do projeto.`,
    pathMissing: (name) =>
      `origem ${name} sem caminho (só a primeira origem sem caminho é a padrão): comportamento omitido.`,
    recordInvalid: 'nome DNS inválido: registro omitido.',
    shieldSubscription:
      'assine o Shield Advanced no console (US$ 3.000/mês, compromisso de 1 ano) antes de aplicar as proteções.',
    secretRotation:
      'rotação automática precisa de uma função Lambda de rotação (onda 7C): configure depois.',
    secretValue:
      'o valor do segredo não vai para o Terraform: grave-o depois (console ou `aws secretsmanager put-secret-value`).',
    lambdaPackage: (path) =>
      `empacote o código da função em ${path} antes do plan (o Studio não gera código).`,
    triggerVisibility: (queue, fn) =>
      `gatilho ${queue} → ${fn} omitido: a visibilidade da fila precisa ser ≥ o tempo limite da função.`,
    subscriptionBlocked: (name) =>
      `assinatura para ${name} omitida (FIFO incompatível ou destino com problema).`,
    snsKms: (key) =>
      `a fila recebe do SNS e usa a chave ${key}: libere sns.amazonaws.com (kms:GenerateDataKey, kms:Decrypt) na política da chave, senão as entregas falham.`,
    keyPolicy: (key, service) =>
      `a chave ${key} precisa liberar ${service} na política dela (kms:Encrypt*, kms:Decrypt, kms:GenerateDataKey*), senão a gravação falha.`,
    backupTargetSkipped: (name) =>
      `${name} fica fora do plano de backup (o recurso tem problema).`,
    configNoBucket:
      'AWS Config ligado sem bucket válido: escolha o bucket na conta.',
    routeTarget: (name) =>
      `rota para ${name} omitida (o destino tem problema ou não tem listener).`,
    lbPortUnused: (port, used) =>
      `target group da porta ${port} sem regra de listener (o listener só encaminha para a porta ${used}).`,
    nlbNoCompatible: (protocol) =>
      `listener ${protocol} sem destino compatível (a conexão de associação precisa usar ${protocol === 'UDP' ? 'UDP' : 'TCP'}): listener omitido.`,
    rdsIp:
      'O IP do rascunho é só referência: a AWS não fixa IP de instância RDS.',
    sgDefault: 'Gerado pelo Rede Studio',
    generated:
      'Gerado pelo Rede Studio a partir do rascunho: edite o rascunho, não este arquivo.',
  },
  en: {
    header: {
      'providers.tf': 'Versions, AWS provider and default tags (default_tags).',
      'variables.tf': 'Project variables (defaults from the draft account).',
      'iam.tf':
        'Identities: IAM users, groups and roles with managed policies.',
      'network.tf':
        'Network: VPC, subnets, gateways, NAT, route tables and endpoints.',
      'security.tf':
        'Security: security groups (own and connection rules), NACLs, KMS keys, secrets, parameters and Cognito.',
      'compute.tf': 'Compute: AMIs, EC2, Auto Scaling and load balancers.',
      'data.tf':
        'Data and messaging: RDS, Aurora, ElastiCache, DynamoDB, EFS, S3, SQS and SNS.',
      'edge.tf': 'Edge: Route 53, certificates, CloudFront, WAF and Shield.',
      'observability.tf':
        'Observability and governance: log groups, Flow Logs, alarms, CloudTrail, AWS Backup, GuardDuty, Security Hub and Config.',
      'outputs.tf': 'Useful outputs after apply.',
    },
    vars: {
      project: 'Project name (Project tag).',
      environment: 'Environment: dev, stage or prod (Environment tag).',
      owner: 'Owner (Owner tag).',
      costCenter: 'Cost center (CostCenter tag).',
      dbUsername: 'RDS master user (the password lives in Secrets Manager).',
    },
    noRegion: 'create a Region in the account to generate the provider.',
    dependsOn: (name) => `depends on ${name}, which is incomplete.`,
    noIamCatalog: 'IAM catalog unavailable: policy attachments were omitted.',
    noTrust:
      'role with no trusted service in the catalog: set assume_role_policy.',
    flowLogs:
      'Flow Logs on without a log group: pick the group in the VPC (create one in the Region).',
    missingIgw: '0.0.0.0/0 route with no Internet Gateway in the VPC.',
    vpceManual:
      'manual route to an endpoint: AWS only accepts a prefix list (already covered by the endpoint).',
    ruleInvalid: 'invalid rule omitted.',
    noTargets: 'no linked targets (association connection): listener omitted.',
    nlbTls: 'TLS listener needs an ACM certificate.',
    certManual:
      'no project Route 53 zone covers the domain: create the validation records at your DNS.',
    noOrigin:
      'no origin (connect CloudFront to an S3, ALB or EC2): distribution omitted.',
    originBlocked: (name) =>
      `origin ${name} omitted (the resource has a problem).`,
    originTls: (name) =>
      `origin ${name} over HTTPS without its own DNS name: the certificate does not cover the load balancer name; give it a name in the project zone.`,
    pathMissing: (name) =>
      `origin ${name} has no path (only the first origin without a path is the default): behavior omitted.`,
    recordInvalid: 'invalid DNS name: record omitted.',
    shieldSubscription:
      'subscribe to Shield Advanced in the console (US$ 3,000/month, 1-year commitment) before applying the protections.',
    secretRotation:
      'automatic rotation needs a rotation Lambda function (wave 7C): set it up later.',
    secretValue:
      'the secret value does not go into Terraform: set it afterwards (console or `aws secretsmanager put-secret-value`).',
    lambdaPackage: (path) =>
      `package the function code at ${path} before plan (the Studio does not generate code).`,
    triggerVisibility: (queue, fn) =>
      `trigger ${queue} → ${fn} omitted: the queue visibility must be ≥ the function timeout.`,
    subscriptionBlocked: (name) =>
      `subscription to ${name} omitted (FIFO mismatch or the target has a problem).`,
    snsKms: (key) =>
      `the queue receives from SNS and uses key ${key}: allow sns.amazonaws.com (kms:GenerateDataKey, kms:Decrypt) in the key policy, or deliveries fail.`,
    keyPolicy: (key, service) =>
      `key ${key} must allow ${service} in its policy (kms:Encrypt*, kms:Decrypt, kms:GenerateDataKey*), or writes fail.`,
    backupTargetSkipped: (name) =>
      `${name} is left out of the backup plan (the resource has a problem).`,
    configNoBucket:
      'AWS Config on without a valid bucket: pick the bucket in the account.',
    routeTarget: (name) =>
      `route to ${name} omitted (the target has a problem or no listener).`,
    lbPortUnused: (port, used) =>
      `target group for port ${port} has no listener rule (the listener only forwards to port ${used}).`,
    nlbNoCompatible: (protocol) =>
      `${protocol} listener has no compatible target (the association connection must use ${protocol === 'UDP' ? 'UDP' : 'TCP'}): listener omitted.`,
    rdsIp:
      'The draft IP is a reference only: AWS does not pin RDS instance IPs.',
    sgDefault: 'Generated by Rede Studio',
    generated:
      'Generated by Rede Studio from the draft: edit the draft, not this file.',
  },
  es: {
    header: {
      'providers.tf':
        'Versiones, provider AWS y tags predeterminadas (default_tags).',
      'variables.tf':
        'Variables del proyecto (valores de la cuenta del borrador).',
      'iam.tf':
        'Identidades: usuarios, grupos y roles IAM con políticas administradas.',
      'network.tf':
        'Red: VPC, subnets, gateways, NAT, route tables y endpoints.',
      'security.tf':
        'Seguridad: security groups (reglas propias y de las conexiones), NACL, claves KMS, secretos, parámetros y Cognito.',
      'compute.tf': 'Cómputo: AMI, EC2, Auto Scaling y balanceadores.',
      'data.tf':
        'Datos y mensajería: RDS, Aurora, ElastiCache, DynamoDB, EFS, S3, SQS y SNS.',
      'edge.tf': 'Borde: Route 53, certificados, CloudFront, WAF y Shield.',
      'observability.tf':
        'Observabilidad y gobernanza: grupos de logs, Flow Logs, alarmas, CloudTrail, AWS Backup, GuardDuty, Security Hub y Config.',
      'outputs.tf': 'Salidas útiles después del apply.',
    },
    vars: {
      project: 'Nombre del proyecto (tag Project).',
      environment: 'Entorno: dev, stage o prod (tag Environment).',
      owner: 'Responsable (tag Owner).',
      costCenter: 'Centro de costo (tag CostCenter).',
      dbUsername:
        'Usuario maestro de RDS (la contraseña queda en Secrets Manager).',
    },
    noRegion: 'crea una Región en la cuenta para generar el provider.',
    dependsOn: (name) => `depende de ${name}, que está incompleto.`,
    noIamCatalog:
      'catálogo IAM no disponible: se omitieron los adjuntos de políticas.',
    noTrust:
      'rol sin servicio de confianza en el catálogo: define assume_role_policy.',
    flowLogs:
      'Flow Logs activo sin grupo de logs: elige el grupo en la VPC (crea uno en la Región).',
    missingIgw: 'ruta 0.0.0.0/0 sin Internet Gateway en la VPC.',
    vpceManual:
      'ruta manual a endpoint: AWS solo acepta prefix list (ya cubierta por el endpoint).',
    ruleInvalid: 'regla inválida omitida.',
    noTargets:
      'sin destinos vinculados (conexión de asociación): listener omitido.',
    nlbTls: 'el listener TLS necesita un certificado ACM.',
    certManual:
      'ninguna zona Route 53 del proyecto cubre el dominio: crea los registros de validación en tu DNS.',
    noOrigin:
      'sin origen (conecta CloudFront a un S3, ALB o EC2): distribución omitida.',
    originBlocked: (name) =>
      `origen ${name} omitido (el recurso tiene un problema).`,
    originTls: (name) =>
      `origen ${name} en HTTPS sin nombre DNS propio: el certificado no cubre el nombre del balanceador; dale un nombre en la zona del proyecto.`,
    pathMissing: (name) =>
      `origen ${name} sin ruta (solo el primer origen sin ruta es el predeterminado): comportamiento omitido.`,
    recordInvalid: 'nombre DNS inválido: registro omitido.',
    shieldSubscription:
      'suscribe Shield Advanced en la consola (US$ 3.000/mes, compromiso de 1 año) antes de aplicar las protecciones.',
    secretRotation:
      'la rotación automática necesita una función Lambda de rotación (ola 7C): configúrala después.',
    secretValue:
      'el valor del secreto no va a Terraform: grábalo después (consola o `aws secretsmanager put-secret-value`).',
    lambdaPackage: (path) =>
      `empaqueta el código de la función en ${path} antes del plan (el Studio no genera código).`,
    triggerVisibility: (queue, fn) =>
      `disparador ${queue} → ${fn} omitido: la visibilidad de la cola debe ser ≥ el tiempo límite de la función.`,
    subscriptionBlocked: (name) =>
      `suscripción a ${name} omitida (FIFO incompatible o destino con problema).`,
    snsKms: (key) =>
      `la cola recibe de SNS y usa la clave ${key}: permite sns.amazonaws.com (kms:GenerateDataKey, kms:Decrypt) en la política de la clave, o las entregas fallan.`,
    keyPolicy: (key, service) =>
      `la clave ${key} debe permitir ${service} en su política (kms:Encrypt*, kms:Decrypt, kms:GenerateDataKey*), o la escritura falla.`,
    backupTargetSkipped: (name) =>
      `${name} queda fuera del plan de backup (el recurso tiene un problema).`,
    configNoBucket:
      'AWS Config activo sin bucket válido: elige el bucket en la cuenta.',
    routeTarget: (name) =>
      `ruta a ${name} omitida (el destino tiene un problema o no tiene listener).`,
    lbPortUnused: (port, used) =>
      `target group del puerto ${port} sin regla de listener (el listener solo reenvía al puerto ${used}).`,
    nlbNoCompatible: (protocol) =>
      `listener ${protocol} sin destino compatible (la conexión de asociación debe usar ${protocol === 'UDP' ? 'UDP' : 'TCP'}): listener omitido.`,
    rdsIp:
      'La IP del borrador es solo referencia: AWS no fija IP de instancias RDS.',
    sgDefault: 'Generado por Rede Studio',
    generated:
      'Generado por Rede Studio a partir del borrador: edita el borrador, no este archivo.',
  },
};

/** Mesma mensagem nos três idiomas a partir do dicionário. */
export const localized = (
  pick: (t: (typeof T)['pt']) => string,
): LocalizedText => ({
  pt: pick(T.pt),
  en: pick(T.en),
  es: pick(T.es),
});

// ---------------------------------------------------------------------------
//  Nomes
// ---------------------------------------------------------------------------

export const ascii = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Identificador Terraform: `[a-z0-9_]`, começando por letra. */
export function tfSlug(text: string) {
  const slug = ascii(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!slug) return 'item';
  return /^[0-9]/.test(slug) ? `r_${slug}` : slug;
}

/** Nome AWS em formato DNS (`a-z0-9-`), com limite de tamanho. */
export function dnsName(text: string, max = 63) {
  const slug = ascii(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const safe = /^[a-z]/.test(slug) ? slug : `r-${slug || 'item'}`;
  return safe.slice(0, max).replace(/-+$/g, '');
}

/** Texto aceito pela AWS em descrições de SG/regras (ASCII restrito). */
export const awsDescription = (text: string) =>
  ascii(text)
    .replace(/→/g, '->')
    .replace(/[^a-zA-Z0-9. _\-:/()#,@[\]+=&;{}!$*>]/g, '')
    .slice(0, 255);

/** Nomes únicos por tipo de recurso Terraform, atribuídos na primeira vez que a chave aparece. */
export class Namer {
  private used = new Map<string, Set<string>>();
  private assigned = new Map<string, string>();

  name(tfType: string, key: string, base: string): string {
    const id = `${tfType}|${key}`;
    const known = this.assigned.get(id);
    if (known) return known;
    const used = this.used.get(tfType) ?? new Set<string>();
    this.used.set(tfType, used);
    const root = tfSlug(base);
    let candidate = root;
    for (let n = 2; used.has(candidate); n++) candidate = `${root}_${n}`;
    used.add(candidate);
    this.assigned.set(id, candidate);
    return candidate;
  }

  /** Já recebeu nome (o recurso foi gerado)? */
  has(tfType: string, key: string) {
    return this.assigned.has(`${tfType}|${key}`);
  }

  ref(tfType: string, key: string, base: string, attribute = 'id') {
    return raw(`${tfType}.${this.name(tfType, key, base)}.${attribute}`);
  }
}

// ---------------------------------------------------------------------------
//  Gerador
// ---------------------------------------------------------------------------

export type Chunk = { resourceIds: string[]; entries: HclEntry[] };
