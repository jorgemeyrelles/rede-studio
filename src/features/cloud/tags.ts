import { ancestorsOf, findResource } from './tree';
import type { CloudResource } from './types';

/**
 * Tags herdáveis do rascunho cloud: definidas na conta (padrão do projeto)
 * e herdadas por tudo que está dentro dela; qualquer elemento pode
 * sobrescrever só para si (`config.tags[<Tag>]`). Nada é copiado — o valor
 * efetivo é calculado subindo pela árvore, então mudar na conta reflete
 * na hora em tudo que herda.
 *
 * No Terraform (F5) as tags da conta viram `default_tags` do provider e só
 * as sobrescritas geram `tags` no recurso; o custo (F6) agrupa por elas.
 */

export const INHERITED_TAGS = ['Owner', 'CostCenter', 'Environment'] as const;
export type InheritedTag = (typeof INHERITED_TAGS)[number];

/** Na conta, cada tag mora num campo próprio da configuração. */
const ACCOUNT_FIELD: Record<InheritedTag, string> = {
  Owner: 'owner',
  CostCenter: 'costCenter',
  Environment: 'environment',
};

export type EffectiveTag = {
  tag: InheritedTag;
  value: string;
  /** Recurso de onde o valor vem (ele mesmo, se sobrescrito). */
  sourceId: string | null;
  inherited: boolean;
};

/** Valor que `resource` define para `tag` (não herdado), ou `''`. */
export function ownTagValue(
  resource: CloudResource,
  tag: InheritedTag,
): string {
  if (resource.type === 'aws.account') {
    const value = resource.config[ACCOUNT_FIELD[tag]];
    return typeof value === 'string' ? value.trim() : '';
  }
  const tags = resource.config.tags;
  const value =
    tags && typeof tags === 'object'
      ? (tags as Record<string, unknown>)[tag]
      : undefined;
  return typeof value === 'string' ? value.trim() : '';
}

/** Tags efetivas de `id`: o próprio valor, ou o do ancestral mais próximo que define. */
export function effectiveTags(
  resources: CloudResource[],
  id: string,
): EffectiveTag[] {
  const resource = findResource(resources, id);
  if (!resource) return [];
  const chain = [resource, ...ancestorsOf(resources, id)];
  return INHERITED_TAGS.map((tag) => {
    const source = chain.find((r) => ownTagValue(r, tag));
    return {
      tag,
      value: source ? ownTagValue(source, tag) : '',
      sourceId: source?.id ?? null,
      inherited: Boolean(source && source.id !== id),
    };
  });
}

/** Patch de configuração que define (ou limpa, com `''`) a sobrescrita de `tag` em `resource`. */
export function tagOverridePatch(
  resource: CloudResource,
  tag: InheritedTag,
  value: string,
): Record<string, unknown> {
  if (resource.type === 'aws.account') return { [ACCOUNT_FIELD[tag]]: value };
  const current =
    resource.config.tags && typeof resource.config.tags === 'object'
      ? { ...(resource.config.tags as Record<string, string>) }
      : {};
  if (value.trim()) current[tag] = value;
  else delete current[tag];
  return { tags: current };
}

/** Valores distintos já usados para `tag` no rascunho (sugestões). */
export function usedTagValues(
  resources: CloudResource[],
  tag: InheritedTag,
): string[] {
  return [
    ...new Set(resources.map((r) => ownTagValue(r, tag)).filter(Boolean)),
  ];
}
