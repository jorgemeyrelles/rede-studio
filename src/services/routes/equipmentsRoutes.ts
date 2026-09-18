import { httpGet } from '../_core/httpClient';

/**
 * Corpo retornado pela `rede-studio-api` em GET /api/equipments*
 * (ver `EquipmentResponse.java`/`EquipmentPriceResponse.java` no backend).
 * Catálogo compartilhado, gerido por ADMIN — só leitura aqui.
 */
export type EquipmentResponse = {
  id: string;
  brand: string;
  model: string;
  function: string;
  price: {
    approxPriceUsd: number | null;
    approxPriceBrl: number | null;
    scannedAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

/** Lista todo o catálogo de equipamentos. */
export function listEquipments(): Promise<EquipmentResponse[]> {
  return httpGet<EquipmentResponse[]>('/api/equipments');
}

/** Lista o catálogo filtrado por marca. */
export function listEquipmentsByBrand(
  brand: string,
): Promise<EquipmentResponse[]> {
  return httpGet<EquipmentResponse[]>(
    `/api/equipments/brand/${encodeURIComponent(brand)}`,
  );
}

/** Busca por substring do modelo (case-insensitive, tratado no backend). */
export function searchEquipments(term: string): Promise<EquipmentResponse[]> {
  return httpGet<EquipmentResponse[]>(
    `/api/equipments/search?name=${encodeURIComponent(term)}`,
  );
}

export const equipmentsRoutes = {
  listEquipments,
  listEquipmentsByBrand,
  searchEquipments,
};
