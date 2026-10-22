import { getCatalogEntry } from './catalog';
import { readIdList } from './engines/addressing';
import { readManualRoutes } from './engines/routing';
import { readSgRules, SG_PEER_PREFIX, SG_TYPE } from './engines/security';
import { VPC_TYPE } from './network';
import type { CloudResource } from './types';

/**
 * Remove as referências a elementos que não existem mais: ids nos campos
 * `refs` (SGs, subnets, VPCs), zona DNS/certificado/WAF escolhidos, a NACL
 * da subnet, regras de SG que apontam para um SG excluído e rotas manuais
 * para um alvo excluído. Roda ao excluir (mesmo
 * passo de desfazer) e ao abrir um rascunho salvo antes desta limpeza.
 *
 * Devolve os mesmos objetos quando nada muda (seguro dentro do Immer).
 */
/** Seleções que guardam o id de outro elemento (zona DNS, certificado, WAF, chave KMS, user pool). */
const ASSOCIATION_SOURCES = [
  'route53Zones',
  'acmCertificates',
  'wafAcls',
  'kmsKeys',
  'cognitoPools',
  'clusters',
  'ecrRepositories',
  'sqsQueues',
  'logGroups',
  'snsTopics',
  'projectBuckets',
];

export function pruneDanglingRefs<T extends CloudResource>(
  resources: T[],
): T[] {
  const ids = new Set(resources.map((r) => r.id));
  const sgIds = new Set(
    resources.filter((r) => r.type === SG_TYPE).map((r) => r.id),
  );
  return resources.map((resource) => {
    const patch: Record<string, unknown> = {};
    for (const field of getCatalogEntry(resource.type)?.fields ?? []) {
      if (field.type === 'refs') {
        const list = readIdList(resource.config[field.key]);
        const kept = list.filter((id) => ids.has(id));
        if (kept.length !== list.length) patch[field.key] = kept;
      } else if (
        field.type === 'select' &&
        field.optionsSource &&
        ASSOCIATION_SOURCES.includes(field.optionsSource)
      ) {
        const id = resource.config[field.key];
        if (typeof id === 'string' && id && !ids.has(id)) patch[field.key] = '';
      }
    }
    const naclId = resource.config.naclId;
    if (typeof naclId === 'string' && naclId && !ids.has(naclId)) {
      patch.naclId = '';
    }
    if (resource.type === SG_TYPE) {
      const rules = readSgRules(resource);
      const kept = rules.filter(
        (rule) =>
          !rule.peer.startsWith(SG_PEER_PREFIX) ||
          sgIds.has(rule.peer.slice(SG_PEER_PREFIX.length)),
      );
      if (kept.length !== rules.length) patch.rules = kept;
    }
    if (resource.type === VPC_TYPE) {
      const routes = readManualRoutes(resource);
      const kept = routes.filter((route) => ids.has(route.targetId));
      if (kept.length !== routes.length) patch.manualRoutes = kept;
    }
    return Object.keys(patch).length
      ? { ...resource, config: { ...resource.config, ...patch } }
      : resource;
  });
}
