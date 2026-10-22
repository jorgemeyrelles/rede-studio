import type { LocalizedText } from '../catalog/types';
import type { CloudResource } from '../types';
import { parseCidr } from './ip';

/**
 * Motor de segurança do Studio Cloud (F3): regras de security group e de
 * NACL, portas, presets e regras arriscadas. Puro (scripts `jiti`); não
 * importa o catálogo.
 */

export const SG_TYPE = 'aws.security_group';
export const NACL_TYPE = 'aws.nacl';

export type RuleDirection = 'ingress' | 'egress';
export type RuleProtocol = 'tcp' | 'udp' | 'icmp' | 'all';

/** `peer`: CIDR (`10.0.0.0/16`, `0.0.0.0/0`) ou outro SG (`sg:<id>`). */
export type SgRule = {
  id: string;
  direction: RuleDirection;
  protocol: RuleProtocol;
  /** "443", "1024-65535"; vazio quando o protocolo é `all`/`icmp`. */
  ports: string;
  peer: string;
  description: string;
};

export type NaclRule = {
  id: string;
  number: number;
  direction: RuleDirection;
  protocol: RuleProtocol;
  ports: string;
  cidr: string;
  action: 'allow' | 'deny';
};

export const SG_PEER_PREFIX = 'sg:';
/** Origem por prefix list gerenciada da AWS (`pl:cloudfront`). */
export const PL_PEER_PREFIX = 'pl:';

/** Prefix lists conhecidas: nome na AWS e rótulo curto da tabela. */
export const PREFIX_LISTS: Record<string, { awsName: string; label: string }> =
  {
    'pl:cloudfront': {
      awsName: 'com.amazonaws.global.cloudfront.origin-facing',
      label: 'CloudFront (prefix list)',
    },
  };

export const PROTOCOLS: RuleProtocol[] = ['tcp', 'udp', 'icmp', 'all'];

export const usesPorts = (protocol: RuleProtocol) =>
  protocol === 'tcp' || protocol === 'udp';

/** Faixa de portas de "443" ou "1024-65535"; `null` se inválida. */
export function parsePorts(text: string): [number, number] | null {
  const match = /^\s*(\d{1,5})(?:\s*-\s*(\d{1,5}))?\s*$/.exec(text ?? '');
  if (!match) return null;
  const from = Number(match[1]);
  const to = match[2] ? Number(match[2]) : from;
  if (from < 0 || to > 65535 || from > to) return null;
  return [from, to];
}

export type RulePreset = {
  key: string;
  label: string;
  protocol: RuleProtocol;
  ports: string;
};

/** Presets da aba Segurança (entrada). */
export const SG_PRESETS: RulePreset[] = [
  { key: 'https', label: 'HTTPS 443', protocol: 'tcp', ports: '443' },
  { key: 'http', label: 'HTTP 80', protocol: 'tcp', ports: '80' },
  { key: 'ssh', label: 'SSH 22', protocol: 'tcp', ports: '22' },
  { key: 'rdp', label: 'RDP 3389', protocol: 'tcp', ports: '3389' },
  { key: 'postgres', label: 'PostgreSQL 5432', protocol: 'tcp', ports: '5432' },
  { key: 'mysql', label: 'MySQL 3306', protocol: 'tcp', ports: '3306' },
];

/** Portas de administração que nunca deveriam abrir para a internet toda. */
const ADMIN_PORTS = [22, 3389];

const isAnywhere = (peer: string) =>
  peer.trim() === '0.0.0.0/0' || peer.trim() === '::/0';

/** Entrada de `0.0.0.0/0` cobrindo SSH (22) ou RDP (3389). */
export function isRiskyRule(
  rule: Pick<SgRule, 'direction' | 'protocol' | 'ports' | 'peer'>,
): boolean {
  if (rule.direction !== 'ingress' || !isAnywhere(rule.peer)) return false;
  if (rule.protocol === 'all') return true;
  if (rule.protocol !== 'tcp') return false;
  const range = parsePorts(rule.ports);
  return Boolean(
    range && ADMIN_PORTS.some((port) => port >= range[0] && port <= range[1]),
  );
}

export function readSgRules(sg: CloudResource): SgRule[] {
  return Array.isArray(sg.config.rules) ? (sg.config.rules as SgRule[]) : [];
}

export function readNaclRules(nacl: CloudResource): NaclRule[] {
  return Array.isArray(nacl.config.rules)
    ? (nacl.config.rules as NaclRule[])
    : [];
}

export type RuleIssue =
  | 'ports'
  | 'peer'
  | 'missingSg'
  | 'number'
  | 'duplicateNumber';

/** Problema de uma regra de SG (para destacar a célula). */
export function sgRuleIssue(
  rule: SgRule,
  resources: CloudResource[],
): RuleIssue | null {
  if (usesPorts(rule.protocol) && !parsePorts(rule.ports)) return 'ports';
  if (rule.peer.startsWith(PL_PEER_PREFIX))
    return PREFIX_LISTS[rule.peer] ? null : 'peer';
  if (rule.peer.startsWith(SG_PEER_PREFIX)) {
    const id = rule.peer.slice(SG_PEER_PREFIX.length);
    return resources.some((r) => r.id === id && r.type === SG_TYPE)
      ? null
      : 'missingSg';
  }
  return parseCidr(rule.peer) ? null : 'peer';
}

export function naclRuleIssue(
  rule: NaclRule,
  rules: NaclRule[],
): RuleIssue | null {
  if (!Number.isInteger(rule.number) || rule.number < 1 || rule.number > 32766)
    return 'number';
  if (
    rules.some(
      (other) =>
        other.id !== rule.id &&
        other.direction === rule.direction &&
        other.number === rule.number,
    )
  ) {
    return 'duplicateNumber';
  }
  if (usesPorts(rule.protocol) && !parsePorts(rule.ports)) return 'ports';
  return parseCidr(rule.cidr) ? null : 'peer';
}

export function ruleIssueText(issue: RuleIssue): LocalizedText {
  switch (issue) {
    case 'ports':
      return {
        pt: 'Porta inválida (ex.: 443 ou 1024-65535).',
        en: 'Invalid port (e.g. 443 or 1024-65535).',
        es: 'Puerto inválido (ej.: 443 o 1024-65535).',
      };
    case 'peer':
      return {
        pt: 'Use um CIDR (ex.: 10.0.0.0/16).',
        en: 'Use a CIDR (e.g. 10.0.0.0/16).',
        es: 'Usa un CIDR (ej.: 10.0.0.0/16).',
      };
    case 'missingSg':
      return {
        pt: 'O security group de origem foi excluído.',
        en: 'The source security group was deleted.',
        es: 'El security group de origen fue eliminado.',
      };
    case 'number':
      return {
        pt: 'Número de 1 a 32766.',
        en: 'Number from 1 to 32766.',
        es: 'Número de 1 a 32766.',
      };
    case 'duplicateNumber':
      return {
        pt: 'Número repetido nesta direção.',
        en: 'Number repeated in this direction.',
        es: 'Número repetido en esta dirección.',
      };
  }
}

/** Problema geral do SG (inspetor e ⚠): regra arriscada ou inválida. */
export function sgIssue(
  sg: CloudResource,
  resources: CloudResource[],
): LocalizedText | null {
  const rules = readSgRules(sg);
  const broken = rules.find((rule) => sgRuleIssue(rule, resources));
  if (broken) {
    const text = ruleIssueText(sgRuleIssue(broken, resources)!);
    return {
      pt: `Regra inválida: ${text.pt}`,
      en: `Invalid rule: ${text.en}`,
      es: `Regla inválida: ${text.es}`,
    };
  }
  if (rules.some(isRiskyRule)) {
    return {
      pt: 'Entrada de 0.0.0.0/0 em SSH/RDP: restrinja a origem (VPN, bastion ou seu IP).',
      en: 'Inbound 0.0.0.0/0 on SSH/RDP: restrict the source (VPN, bastion or your IP).',
      es: 'Entrada de 0.0.0.0/0 en SSH/RDP: restringe el origen (VPN, bastion o tu IP).',
    };
  }
  return null;
}

export function naclIssue(nacl: CloudResource): LocalizedText | null {
  const rules = readNaclRules(nacl);
  const broken = rules.find((rule) => naclRuleIssue(rule, rules));
  if (!broken) return null;
  const text = ruleIssueText(naclRuleIssue(broken, rules)!);
  return {
    pt: `Regra ${broken.number}: ${text.pt}`,
    en: `Rule ${broken.number}: ${text.en}`,
    es: `Regla ${broken.number}: ${text.es}`,
  };
}

/** Próximo número livre de regra NACL (de 10 em 10, como a AWS sugere: 100, 110...). */
export function nextNaclNumber(rules: NaclRule[], direction: RuleDirection) {
  const used = rules
    .filter((r) => r.direction === direction)
    .map((r) => r.number);
  const max = used.length ? Math.max(...used) : 90;
  return Math.min(32766, Math.floor(max / 10) * 10 + 10);
}
