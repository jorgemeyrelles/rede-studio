import type { NodeCategory } from '../network/types/primitives';
import type { EquipmentResponse } from '../../services/routes/equipmentsRoutes';

/**
 * Sprint equipamentos Fase 13 — mesmo critério de cruzamento marca+modelo
 * usado em `EquipmentInventoryPanel.tsx` (cascata de `<select>`), extraído
 * aqui para ser reaproveitado por `StudioPage.tsx` ao montar os dados de
 * preço do inventário para o PDF.
 */
export function findEquipmentCatalogMatch(
  catalog: EquipmentResponse[],
  brand: string | undefined,
  model: string | undefined,
): EquipmentResponse | undefined {
  if (!brand || !model) return undefined;
  return catalog.find((item) => item.brand === brand && item.model === model);
}

/**
 * Termo de `EquipmentResponse.function` que corresponde a cada categoria de
 * nó com suporte a equipamento (`EQUIPMENT_SUPPORT_CATEGORIES`). O catálogo
 * grava as funções em minúsculas (ver `EquipmentFunctions` na API).
 */
export const EQUIPMENT_FUNCTION_BY_CATEGORY: Partial<
  Record<NodeCategory, string>
> = {
  router: 'roteador',
  firewall: 'firewall',
  switch: 'switch',
  'access-point': 'access point',
  'load-balancer': 'load balancer',
  ids: 'ids',
  ips: 'ips',
  proxy: 'proxy',
  modem: 'modem',
  dns: 'dns',
  dhcp: 'dhcp',
};

/** Equipamentos do catálogo cuja lista `function` inclui a função do tipo do nó. */
export function filterCatalogByNodeCategory(
  catalog: EquipmentResponse[],
  category: NodeCategory | undefined,
): EquipmentResponse[] {
  const wanted = category && EQUIPMENT_FUNCTION_BY_CATEGORY[category];
  if (!wanted) return [];
  return catalog.filter((item) => item.function?.includes(wanted));
}

/**
 * Opções de um `<select>` com o valor já escolhido garantido na lista: um
 * projeto salvo antes do filtro por tipo pode ter marca/modelo que não
 * atende mais à categoria do nó, e sem isso o `<select>` exibiria outra opção
 * no lugar do valor que de fato está no estado.
 */
export function withSelectedOption(
  options: string[],
  selected: string,
): string[] {
  return selected && !options.includes(selected)
    ? [selected, ...options]
    : options;
}
