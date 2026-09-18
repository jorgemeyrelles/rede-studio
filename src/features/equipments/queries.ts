import { useQuery } from '@tanstack/react-query';
import { equipmentsRoutes } from '../../services/routes/equipmentsRoutes';

/** Catálogo admin-managed, muda pouco — staleTime generoso evita refetch a cada abertura do NodeInspector. */
const EQUIPMENTS_STALE_TIME_MS = 5 * 60 * 1000;

export function equipmentsQueryKey() {
  return ['equipments'] as const;
}

/** Lista completa do catálogo — usada pelo NodeInspector (Fase 5) para montar marca+modelo em cascata. */
export function useEquipmentsQuery() {
  return useQuery({
    queryKey: equipmentsQueryKey(),
    queryFn: () => equipmentsRoutes.listEquipments(),
    staleTime: EQUIPMENTS_STALE_TIME_MS,
  });
}

export function equipmentsByBrandQueryKey(brand: string) {
  return ['equipments', 'brand', brand] as const;
}

export function useEquipmentsByBrandQuery(brand: string | undefined) {
  return useQuery({
    queryKey: equipmentsByBrandQueryKey(brand ?? ''),
    queryFn: () => equipmentsRoutes.listEquipmentsByBrand(brand as string),
    enabled: Boolean(brand),
    staleTime: EQUIPMENTS_STALE_TIME_MS,
  });
}
