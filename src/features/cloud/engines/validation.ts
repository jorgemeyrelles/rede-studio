import { getCatalogEntry, type LocalizedText } from '../catalog';
import { closest, isSubnet } from '../network';
import { effectiveTags } from '../tags';
import type { CloudConnection, CloudResource } from '../types';
import { readIdList } from './addressing';
import { connectionIssue } from './connections';
import type { CostEstimate } from './cost';
import { ALARM_SPECS, TRAIL_TYPE } from './observability';
import { BLOCKING_KEYS, type TerraformTodo } from './terraform';

/**
 * Aba Validação: junta num lugar só o que cada motor já sabe — o `validate`
 * do catálogo (o mesmo do inspetor e do ⚠ do canvas), os problemas das
 * conexões, os itens sem preço e os TODOs do Terraform — e acrescenta as
 * dicas de boas práticas (Well-Architected), que não impedem nada.
 *
 * Severidade: erro = bloqueia o Terraform; aviso = o resto dos problemas;
 * dica = boa prática.
 */

export type ValidationSeverity = 'error' | 'warning' | 'tip';
export const VALIDATION_SEVERITIES: ValidationSeverity[] = [
  'error',
  'warning',
  'tip',
];

export type ValidationItem = {
  /** Estável entre renders (chave da linha). */
  id: string;
  severity: ValidationSeverity;
  /** Nome curto da regra (coluna "Regra"). */
  rule: LocalizedText;
  resourceId: string | null;
  connectionId: string | null;
  /** O problema e como corrigir. */
  message: LocalizedText;
};

export type ValidationInput = {
  resources: CloudResource[];
  connections: CloudConnection[];
  /** Estimativa já calculada; `null`/ausente = preços ainda não carregados. */
  cost?: CostEstimate | null;
  /** TODOs do Terraform gerado (os explicados por um erro não repetem). */
  todos?: TerraformTodo[];
};

const RULE = {
  general: { pt: 'Configuração', en: 'Configuration', es: 'Configuración' },
  connection: { pt: 'Conexão', en: 'Connection', es: 'Conexión' },
  price: {
    pt: 'Preço na Região',
    en: 'Regional price',
    es: 'Precio en la Región',
  },
  terraform: { pt: 'Terraform', en: 'Terraform', es: 'Terraform' },
  availability: {
    pt: 'Alta disponibilidade',
    en: 'High availability',
    es: 'Alta disponibilidad',
  },
  backup: { pt: 'Backup', en: 'Backup', es: 'Backup' },
  encryption: { pt: 'Criptografia', en: 'Encryption', es: 'Cifrado' },
  versioning: { pt: 'Versionamento', en: 'Versioning', es: 'Versionado' },
  audit: { pt: 'Auditoria', en: 'Audit', es: 'Auditoría' },
  monitoring: { pt: 'Monitoramento', en: 'Monitoring', es: 'Monitoreo' },
} satisfies Record<string, LocalizedText>;

const SEVERITY_ORDER: Record<ValidationSeverity, number> = {
  error: 0,
  warning: 1,
  tip: 2,
};

const isProduction = (resources: CloudResource[], id: string) =>
  effectiveTags(resources, id).find((tag) => tag.tag === 'Environment')
    ?.value === 'prod';

/** AZs onde o recurso roda: a do pai (subnet) e as das `subnetIds`. */
function zonesOf(resources: CloudResource[], resource: CloudResource) {
  const subnetIds = readIdList(resource.config.subnetIds);
  const parent = resources.find((r) => r.id === resource.parentId);
  if (parent && isSubnet(parent)) subnetIds.push(parent.id);
  return new Set(
    subnetIds
      .map((id) => closest(resources, id, 'aws.az')?.id)
      .filter((id): id is string => Boolean(id)),
  );
}

/** Dicas Well-Architected de um recurso (D3: alta disponibilidade só em produção). */
function tipsOf(
  resources: CloudResource[],
  resource: CloudResource,
): { key: string; rule: LocalizedText; message: LocalizedText }[] {
  const config = resource.config;
  const prod = isProduction(resources, resource.id);
  const tips: { key: string; rule: LocalizedText; message: LocalizedText }[] =
    [];
  const availability = (message: LocalizedText) =>
    prod && tips.push({ key: 'ha', rule: RULE.availability, message });

  switch (resource.type) {
    case 'aws.ec2':
      availability({
        pt: 'Instância avulsa em produção: se ela atende tráfego, use um Auto Scaling group em 2 AZs.',
        en: 'Standalone instance in production: if it serves traffic, use an Auto Scaling group across 2 AZs.',
        es: 'Instancia suelta en producción: si atiende tráfico, usa un Auto Scaling group en 2 AZ.',
      });
      break;
    case 'aws.asg':
      if (zonesOf(resources, resource).size < 2)
        availability({
          pt: 'O grupo roda numa única AZ: escolha subnets de pelo menos 2 AZs.',
          en: 'The group runs in a single AZ: pick subnets in at least 2 AZs.',
          es: 'El grupo corre en una sola AZ: elige subnets de al menos 2 AZ.',
        });
      break;
    case 'aws.rds':
      if (config.multiAz !== true)
        availability({
          pt: 'Banco numa única AZ: ligue o Multi-AZ (standby síncrono em outra AZ).',
          en: 'Database in a single AZ: turn on Multi-AZ (synchronous standby in another AZ).',
          es: 'Base en una sola AZ: activa Multi-AZ (standby síncrono en otra AZ).',
        });
      if (Number(config.backupRetentionDays) === 0)
        tips.push({
          key: 'backup',
          rule: RULE.backup,
          message: {
            pt: 'Backup automático desligado (retenção 0): sem restauração para um ponto no tempo.',
            en: 'Automated backups off (retention 0): no point-in-time restore.',
            es: 'Backup automático apagado (retención 0): sin restauración a un punto en el tiempo.',
          },
        });
      if (config.encrypted === false)
        tips.push({
          key: 'encryption',
          rule: RULE.encryption,
          message: {
            pt: 'Armazenamento sem criptografia: só dá para ligar recriando o banco a partir de um snapshot.',
            en: 'Unencrypted storage: it can only be turned on by restoring the database from a snapshot.',
            es: 'Almacenamiento sin cifrado: solo se activa recreando la base desde un snapshot.',
          },
        });
      break;
    case 'aws.aurora':
      if (Number(config.readers) < 1)
        availability({
          pt: 'Cluster sem leitor: com ao menos 1 leitor em outra AZ, a falha do escritor vira failover.',
          en: 'Cluster without a reader: with at least 1 reader in another AZ, a writer failure becomes a failover.',
          es: 'Clúster sin lector: con al menos 1 lector en otra AZ, la falla del escritor se vuelve failover.',
        });
      break;
    case 'aws.elasticache':
      if (Number(config.replicas) < 1)
        availability({
          pt: 'Cache sem réplica: um nó só perde os dados se cair. Use ao menos 1 réplica em outra AZ.',
          en: 'Cache without a replica: a single node loses its data if it fails. Use at least 1 replica in another AZ.',
          es: 'Caché sin réplica: un solo nodo pierde los datos si cae. Usa al menos 1 réplica en otra AZ.',
        });
      break;
    case 'aws.dynamodb.table':
      if (prod && config.pitr === false)
        tips.push({
          key: 'backup',
          rule: RULE.backup,
          message: {
            pt: 'Tabela de produção sem PITR: ligue a recuperação para um ponto no tempo (35 dias).',
            en: 'Production table without PITR: turn on point-in-time recovery (35 days).',
            es: 'Tabla de producción sin PITR: activa la recuperación a un punto en el tiempo (35 días).',
          },
        });
      break;
    case 'aws.s3':
      if (prod && config.versioning === false)
        tips.push({
          key: 'versioning',
          rule: RULE.versioning,
          message: {
            pt: 'Bucket de produção sem versionamento: um objeto apagado ou sobrescrito não volta.',
            en: 'Production bucket without versioning: a deleted or overwritten object cannot be recovered.',
            es: 'Bucket de producción sin versionado: un objeto borrado o sobrescrito no se recupera.',
          },
        });
      break;
    case 'aws.account': {
      const hasRegion = resources.some((r) => r.type === 'aws.region');
      if (hasRegion && !resources.some((r) => r.type === TRAIL_TYPE))
        tips.push({
          key: 'trail',
          rule: RULE.audit,
          message: {
            pt: 'Sem CloudTrail: crie uma trilha para registrar quem mudou o quê na conta.',
            en: 'No CloudTrail: create a trail to record who changed what in the account.',
            es: 'Sin CloudTrail: crea un trail para registrar quién cambió qué en la cuenta.',
          },
        });
      break;
    }
  }

  if (prod && ALARM_SPECS[resource.type] && config.alarms !== true)
    tips.push({
      key: 'alarms',
      rule: RULE.monitoring,
      message: {
        pt: 'Recurso de produção sem alarmes: ligue os alarmes padrão e escolha um tópico SNS para o aviso.',
        en: 'Production resource without alarms: turn on the default alarms and pick an SNS topic for notifications.',
        es: 'Recurso de producción sin alarmas: activa las alarmas predeterminadas y elige un tópico SNS para el aviso.',
      },
    });
  return tips;
}

/** Todos os itens do rascunho, por severidade e depois na ordem dos elementos. */
export function validateCloud(input: ValidationInput): ValidationItem[] {
  const { resources, connections, cost, todos = [] } = input;
  const items: ValidationItem[] = [];
  const blocking = BLOCKING_KEYS as readonly string[];

  for (const resource of resources) {
    const entry = getCatalogEntry(resource.type);
    const issues = entry?.validate?.(resource, resources, connections) ?? {};
    for (const [key, message] of Object.entries(issues)) {
      if (!message) continue;
      const error = blocking.includes(key);
      const field = entry?.fields.find((f) => f.key === key);
      items.push({
        id: `${resource.id}:${key}`,
        severity: error ? 'error' : 'warning',
        rule: field?.label ?? RULE.general,
        resourceId: resource.id,
        connectionId: null,
        message,
      });
    }
    for (const tip of tipsOf(resources, resource)) {
      items.push({
        id: `${resource.id}:tip:${tip.key}`,
        severity: 'tip',
        rule: tip.rule,
        resourceId: resource.id,
        connectionId: null,
        message: tip.message,
      });
    }
  }

  for (const connection of connections) {
    const message = connectionIssue(resources, connection, connections);
    if (message)
      items.push({
        id: `connection:${connection.id}`,
        severity: 'warning',
        rule: RULE.connection,
        resourceId: null,
        connectionId: connection.id,
        message,
      });
  }

  // Sem preço: uma linha por elemento, com os itens que ficaram de fora do total.
  const unpriced = new Map<
    string,
    { region: string; items: LocalizedText[] }
  >();
  for (const line of cost?.lines ?? []) {
    if (line.status !== 'unpriced') continue;
    const key = line.resourceId ?? `region:${line.region}`;
    const group = unpriced.get(key) ?? { region: line.region, items: [] };
    if (!group.items.some((item) => item.en === line.item.en))
      group.items.push(line.item);
    unpriced.set(key, group);
  }
  for (const [key, group] of unpriced) {
    const list = (language: keyof LocalizedText) =>
      group.items.map((item) => item[language]).join(', ');
    items.push({
      id: `price:${key}`,
      severity: 'warning',
      rule: RULE.price,
      resourceId: key.startsWith('region:') ? null : key,
      connectionId: null,
      message: {
        pt: `Sem preço em ${group.region}: ${list('pt')}. Fica fora do total.`,
        en: `No price in ${group.region}: ${list('en')}. Left out of the total.`,
        es: `Sin precio en ${group.region}: ${list('es')}. Queda fuera del total.`,
      },
    });
  }

  // O TODO que repete um problema do catálogo já listado não aparece de novo.
  const listed = new Set(items.map((item) => item.id));
  todos.forEach((todo, index) => {
    if (todo.issueKey && listed.has(`${todo.resourceId}:${todo.issueKey}`))
      return;
    items.push({
      id: `todo:${index}:${todo.resourceId ?? 'project'}`,
      severity: 'warning',
      rule: RULE.terraform,
      resourceId: todo.resourceId,
      connectionId: null,
      message: todo.message,
    });
  });

  const order = new Map(resources.map((r, i) => [r.id, i]));
  const rank = (item: ValidationItem) =>
    item.resourceId !== null
      ? (order.get(item.resourceId) ?? resources.length)
      : resources.length + 1;
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.item.severity] - SEVERITY_ORDER[b.item.severity] ||
        rank(a.item) - rank(b.item) ||
        a.index - b.index,
    )
    .map(({ item }) => item);
}

export function validationCounts(items: ValidationItem[]) {
  const counts: Record<ValidationSeverity, number> = {
    error: 0,
    warning: 0,
    tip: 0,
  };
  for (const item of items) counts[item.severity] += 1;
  return counts;
}
