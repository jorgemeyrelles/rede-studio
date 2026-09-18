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
